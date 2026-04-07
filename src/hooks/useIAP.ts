import {useEffect, useState} from 'react';
import {
  finishTransaction,
  getAvailablePurchases,
  getSubscriptions,
  initConnection,
  purchaseErrorListener,
  purchaseUpdatedListener,
  requestSubscription,
} from 'react-native-iap';
import {supabase} from '@/integrations/supabase/client';
import {useAuth} from '@/hooks/useAuth';

const SUBSCRIPTION_ID = 'sunrise_alarm_premium_monthly';

export function useIAP() {
  const {user} = useAuth();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    initConnection()
      .then(() => getSubscriptions({skus: [SUBSCRIPTION_ID]}))
      .catch(() => {});

    const purchaseUpdate = purchaseUpdatedListener(async purchase => {
      if (purchase.productId !== SUBSCRIPTION_ID) return;

      await finishTransaction({purchase, isConsumable: false});

      // Atualizar subscription no Supabase
      if (user) {
        const endsAt = new Date();
        endsAt.setMonth(endsAt.getMonth() + 1);

        await supabase
          .from('profiles')
          .update({
            subscription_tier: 'premium',
            subscription_ends_at: endsAt.toISOString(),
          })
          .eq('id', user.id);
      }
    });

    const purchaseError = purchaseErrorListener(eventError => {
      setError(eventError.message);
    });

    return () => {
      purchaseUpdate.remove();
      purchaseError.remove();
    };
  }, [user]);

  const subscribe = async () => {
    setLoading(true);
    setError(null);

    try {
      await requestSubscription({sku: SUBSCRIPTION_ID});
    } catch (err: any) {
      setError(err.message ?? 'Erro ao iniciar assinatura');
    } finally {
      setLoading(false);
    }
  };

  const restorePurchases = async () => {
    setLoading(true);
    setError(null);

    try {
      const purchases = await getAvailablePurchases();
      const hasPremium = purchases.some(p => p.productId === SUBSCRIPTION_ID);

      if (hasPremium && user) {
        const endsAt = new Date();
        endsAt.setMonth(endsAt.getMonth() + 1);

        await supabase
          .from('profiles')
          .update({
            subscription_tier: 'premium',
            subscription_ends_at: endsAt.toISOString(),
          })
          .eq('id', user.id);
      }
    } catch (err: any) {
      setError(err.message ?? 'Erro ao restaurar compras');
    } finally {
      setLoading(false);
    }
  };

  return {subscribe, restorePurchases, loading, error};
}
