import {useEffect, useState} from 'react';
import {
  finishTransaction,
  getAvailablePurchases,
  getSubscriptions,
  initConnection,
  purchaseErrorListener,
  purchaseUpdatedListener,
  requestSubscription,
  type Purchase,
} from 'react-native-iap';
import {supabase} from '@/integrations/supabase/client';
import {useAuth} from '@/hooks/useAuth';

const SUBSCRIPTION_ID = 'sunrise_alarm_premium_monthly';

async function verifyAndActivate(
  purchase: Purchase,
  userId: string,
): Promise<void> {
  const {data, error} = await supabase.functions.invoke('verify-purchase', {
    body: {
      purchaseToken: purchase.purchaseToken,
      productId: purchase.productId,
      userId,
    },
  });

  if (error) {
    throw new Error(error.message ?? 'Erro ao verificar compra');
  }

  if (!data?.valid) {
    throw new Error('Compra inválida ou expirada');
  }
}

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

      if (!user) return;

      try {
        // FIX 1 & 2 & 3: Validar receipt via Edge Function ANTES de finalizar a transação
        await verifyAndActivate(purchase, user.id);

        // Só finaliza a transação após confirmação do servidor
        await finishTransaction({purchase, isConsumable: false});
      } catch (err: any) {
        setError(err.message ?? 'Erro ao processar compra');
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
      const premiumPurchase = purchases.find(
        p => p.productId === SUBSCRIPTION_ID,
      );

      if (premiumPurchase && user) {
        await verifyAndActivate(premiumPurchase, user.id);
      }
    } catch (err: any) {
      setError(err.message ?? 'Erro ao restaurar compras');
    } finally {
      setLoading(false);
    }
  };

  return {subscribe, restorePurchases, loading, error};
}
