import { serve } from 'https://deno.land/std@0.177.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const PACKAGE_NAME = 'com.sunrisealarmrn';

interface GoogleTokenInfo {
  kind: string;
  startTimeMillis: string;
  expiryTimeMillis: string;
  autoRenewing: boolean;
  priceCurrencyCode: string;
  priceAmountMicros: string;
  countryCode: string;
  developerPayload: string;
  paymentState: number;
  orderId: string;
}

async function getAccessToken(serviceAccountKey: string): Promise<string> {
  const key = JSON.parse(serviceAccountKey);

  const header = btoa(JSON.stringify({ alg: 'RS256', typ: 'JWT' }));
  const now = Math.floor(Date.now() / 1000);
  const claimSet = btoa(
    JSON.stringify({
      iss: key.client_email,
      scope: 'https://www.googleapis.com/auth/androidpublisher',
      aud: 'https://oauth2.googleapis.com/token',
      iat: now,
      exp: now + 3600,
    }),
  );

  const signInput = `${header}.${claimSet}`;

  // Import the private key and sign the JWT
  const pemContents = key.private_key
    .replace(/-----BEGIN PRIVATE KEY-----/, '')
    .replace(/-----END PRIVATE KEY-----/, '')
    .replace(/\n/g, '');

  const binaryKey = Uint8Array.from(atob(pemContents), (c) => c.charCodeAt(0));

  const cryptoKey = await crypto.subtle.importKey(
    'pkcs8',
    binaryKey,
    { name: 'RSASSA-PKCS1-v1_5', hash: 'SHA-256' },
    false,
    ['sign'],
  );

  const signature = await crypto.subtle.sign(
    'RSASSA-PKCS1-v1_5',
    cryptoKey,
    new TextEncoder().encode(signInput),
  );

  const base64Signature = btoa(String.fromCharCode(...new Uint8Array(signature)));

  const jwt = `${signInput}.${base64Signature}`;

  const tokenRes = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: `grant_type=urn:ietf:params:oauth:grant-type:jwt-bearer&assertion=${jwt}`,
  });

  const tokenData = await tokenRes.json();
  if (!tokenData.access_token) {
    throw new Error('Failed to obtain Google access token');
  }

  return tokenData.access_token;
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', {
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'POST',
        'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
      },
    });
  }

  try {
    const { purchaseToken, productId, userId } = await req.json();

    if (!purchaseToken || !productId || !userId) {
      return new Response(
        JSON.stringify({ valid: false, error: 'Missing required fields' }),
        { status: 400, headers: { 'Content-Type': 'application/json' } },
      );
    }

    // Get Google service account key from Supabase secrets
    const serviceAccountKey = Deno.env.get('GOOGLE_SERVICE_ACCOUNT_KEY');
    if (!serviceAccountKey) {
      throw new Error('GOOGLE_SERVICE_ACCOUNT_KEY not configured');
    }

    const accessToken = await getAccessToken(serviceAccountKey);

    // Call Google Play Developer API to verify the subscription
    const verifyUrl =
      `https://androidpublisher.googleapis.com/androidpublisher/v3/applications/${PACKAGE_NAME}/purchases/subscriptions/${productId}/tokens/${purchaseToken}`;

    const googleRes = await fetch(verifyUrl, {
      headers: { Authorization: `Bearer ${accessToken}` },
    });

    if (!googleRes.ok) {
      const errorBody = await googleRes.text();
      console.error('Google API error:', errorBody);
      return new Response(
        JSON.stringify({ valid: false, error: 'Google verification failed' }),
        { status: 200, headers: { 'Content-Type': 'application/json' } },
      );
    }

    const subscriptionData: GoogleTokenInfo = await googleRes.json();

    // paymentState: 0 = pending, 1 = received, 2 = free trial, 3 = deferred
    const isPaid =
      subscriptionData.paymentState === 1 || subscriptionData.paymentState === 2;
    const expiryTimeMillis = parseInt(subscriptionData.expiryTimeMillis, 10);
    const isActive = expiryTimeMillis > Date.now();
    const valid = isPaid && isActive;

    if (valid) {
      // Update profile in Supabase with verified data
      const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
      const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
      const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey);

      const expiresAt = new Date(expiryTimeMillis).toISOString();

      const { error: updateError } = await supabaseAdmin
        .from('profiles')
        .update({
          subscription_tier: 'premium',
          subscription_ends_at: expiresAt,
          purchase_token: purchaseToken,
        })
        .eq('id', userId);

      if (updateError) {
        console.error('Supabase update error:', updateError);
        throw new Error('Failed to update subscription');
      }

      return new Response(
        JSON.stringify({ valid: true, expiresAt }),
        { status: 200, headers: { 'Content-Type': 'application/json' } },
      );
    }

    return new Response(
      JSON.stringify({ valid: false, error: 'Subscription not active or unpaid' }),
      { status: 200, headers: { 'Content-Type': 'application/json' } },
    );
  } catch (err) {
    console.error('verify-purchase error:', err);
    return new Response(
      JSON.stringify({ valid: false, error: (err as Error).message }),
      { status: 500, headers: { 'Content-Type': 'application/json' } },
    );
  }
});
