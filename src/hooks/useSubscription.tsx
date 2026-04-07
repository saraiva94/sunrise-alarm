import {
  useState,
  useEffect,
  createContext,
  useContext,
  ReactNode,
  useCallback,
} from 'react';
import {supabase} from '@/integrations/supabase/client';
import {useAuth} from './useAuth';

export type SubscriptionTier =
  | 'free'
  | 'trial'
  | 'monthly'
  | 'yearly'
  | 'premium';

interface SubscriptionContextType {
  tier: SubscriptionTier;
  isSubscribed: boolean;
  isPremium: boolean;
  isTrial: boolean;
  trialEndsAt: Date | null;
  subscriptionEndsAt: Date | null;
  loading: boolean;
  checkSubscription: () => Promise<void>;
  createCheckout: (plan: 'monthly' | 'yearly') => Promise<void>;
  openCustomerPortal: () => Promise<void>;
}

const SubscriptionContext = createContext<SubscriptionContextType | undefined>(
  undefined,
);

export function SubscriptionProvider({children}: {children: ReactNode}) {
  const {user} = useAuth();
  const [tier, setTier] = useState<SubscriptionTier>('free');
  const [trialEndsAt, setTrialEndsAt] = useState<Date | null>(null);
  const [subscriptionEndsAt, setSubscriptionEndsAt] = useState<Date | null>(
    null,
  );
  const [loading, setLoading] = useState(true);

  const checkSubscription = useCallback(async () => {
    if (!user) {
      setTier('free');
      setTrialEndsAt(null);
      setSubscriptionEndsAt(null);
      setLoading(false);
      return;
    }

    try {
      const {data, error} = await supabase
        .from('profiles')
        .select('subscription_tier, subscription_ends_at, trial_ends_at')
        .eq('id', user.id)
        .single();

      if (error) throw error;

      const nextTier = (data?.subscription_tier || 'free') as SubscriptionTier;
      const nextTrialEndsAt = data?.trial_ends_at
        ? new Date(data.trial_ends_at)
        : null;
      const nextSubscriptionEndsAt = data?.subscription_ends_at
        ? new Date(data.subscription_ends_at)
        : null;

      const now = new Date();
      const hasActivePaidPlan =
        nextTier !== 'free' &&
        !!nextSubscriptionEndsAt &&
        nextSubscriptionEndsAt > now;
      const hasActiveTrial =
        nextTier === 'trial' && !!nextTrialEndsAt && nextTrialEndsAt > now;

      if (hasActivePaidPlan || hasActiveTrial) {
        setTier(nextTier);
      } else {
        setTier('free');
      }

      setTrialEndsAt(nextTrialEndsAt);
      setSubscriptionEndsAt(nextSubscriptionEndsAt);
    } catch {
      setTier('free');
      setTrialEndsAt(null);
      setSubscriptionEndsAt(null);
    } finally {
      setLoading(false);
    }
  }, [user]);

  const createCheckout = async (_plan: 'monthly' | 'yearly') => {
    // TODO: Integrar fluxo de compra nativa futuramente.
  };

  const openCustomerPortal = async () => {
    // TODO: Integrar portal de assinatura futuramente.
  };

  useEffect(() => {
    if (user) {
      checkSubscription();
    } else {
      setTier('free');
      setLoading(false);
    }
  }, [user, checkSubscription]);

  // Auto-refresh subscription status every minute
  useEffect(() => {
    if (!user) return;

    const interval = setInterval(() => {
      checkSubscription();
    }, 60000);

    return () => clearInterval(interval);
  }, [user, checkSubscription]);

  const isSubscribed = tier !== 'free';
  const isPremium = ['trial', 'monthly', 'yearly', 'premium'].includes(tier);
  const isTrial = tier === 'trial';

  return (
    <SubscriptionContext.Provider
      value={{
        tier,
        isSubscribed,
        isPremium,
        isTrial,
        trialEndsAt,
        subscriptionEndsAt,
        loading,
        checkSubscription,
        createCheckout,
        openCustomerPortal,
      }}>
      {children}
    </SubscriptionContext.Provider>
  );
}

export function useSubscription() {
  const context = useContext(SubscriptionContext);
  if (context === undefined) {
    throw new Error(
      'useSubscription must be used within a SubscriptionProvider',
    );
  }
  return context;
}
