import React, {useEffect} from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  ScrollView,
  ActivityIndicator,
  StyleSheet,
} from 'react-native';
import {SafeAreaView} from 'react-native-safe-area-context';
import {useNavigation} from '@react-navigation/native';
import type {NativeStackNavigationProp} from '@react-navigation/native-stack';
import type {RootStackParamList} from '@/navigation/AppNavigator';
import {useSubscription} from '@/hooks/useSubscription';
import {useIAP} from '@/hooks/useIAP';
import {useToast} from '@/hooks/use-toast';

type PlansNav = NativeStackNavigationProp<RootStackParamList, 'Plans'>;

const FREE_FEATURES = [
  'Alarme solar e manual',
  'Sons básicos',
  'Desafios de despertar',
  'Exibe anúncios (AdMob)',
];

const PREMIUM_FEATURES = [
  'Tudo do plano FREE',
  'Sem anúncios',
  'Recursos premium avançados',
  'Suporte prioritário',
];

export default function PlansScreen() {
  const navigation = useNavigation<PlansNav>();
  const {isPremium, checkSubscription} = useSubscription();
  const {subscribe, restorePurchases, loading, error} = useIAP();
  const {toast} = useToast();

  // Refresh subscription status after purchase completes
  const handleSubscribe = async () => {
    await subscribe();
    // Give Supabase a moment to update, then refresh
    setTimeout(() => checkSubscription(), 1500);
  };

  const handleRestore = async () => {
    await restorePurchases();
    setTimeout(() => checkSubscription(), 1500);
  };

  // Show toast when payment error occurs
  useEffect(() => {
    if (error) {
      toast({
        type: 'error',
        text1: 'Erro no pagamento',
        text2: error,
      });
    }
  }, [error, toast]);

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView contentContainerStyle={styles.content}>
        <View style={styles.headerRow}>
          <TouchableOpacity onPress={() => navigation.navigate('Home')}>
            <Text style={styles.backText}>← Voltar</Text>
          </TouchableOpacity>
          <Text style={styles.title}>Planos</Text>
        </View>

        <View style={styles.card}>
          <View style={styles.cardTop}>
            <Text style={styles.planName}>FREE</Text>
            <Text style={styles.price}>Gratuito</Text>
          </View>

          <View style={styles.features}>
            {FREE_FEATURES.map(item => (
              <Text key={item} style={styles.featureText}>
                • {item}
              </Text>
            ))}
          </View>

          <TouchableOpacity
            style={[styles.button, styles.buttonMuted]}
            disabled>
            <Text style={styles.buttonMutedText}>
              {!isPremium ? 'Plano Atual' : 'Disponível'}
            </Text>
          </TouchableOpacity>
        </View>

        <View style={[styles.card, styles.premiumCard]}>
          <View style={styles.cardTop}>
            <Text style={styles.planName}>PREMIUM</Text>
            <Text style={styles.price}>R$ 4,99/mês</Text>
          </View>

          <View style={styles.features}>
            {PREMIUM_FEATURES.map(item => (
              <Text key={item} style={styles.featureText}>
                • {item}
              </Text>
            ))}
          </View>

          <TouchableOpacity
            style={[styles.button, loading && styles.buttonDisabled]}
            onPress={handleSubscribe}
            disabled={loading || isPremium}>
            {loading ? (
              <ActivityIndicator color="#000" size="small" />
            ) : (
              <Text style={styles.buttonText}>
                {isPremium ? 'Plano Atual ✓' : 'Assinar R$ 4,99/mês'}
              </Text>
            )}
          </TouchableOpacity>

          <TouchableOpacity onPress={handleRestore} disabled={loading}>
            <Text style={styles.restoreText}>Restaurar compras</Text>
          </TouchableOpacity>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {flex: 1, backgroundColor: '#0a0a0a'},
  content: {padding: 16, gap: 14},
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginBottom: 6,
  },
  backText: {color: '#999', fontSize: 15},
  title: {color: '#fff', fontSize: 24, fontWeight: '700'},
  card: {
    backgroundColor: '#1a1a2e',
    borderRadius: 16,
    padding: 18,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)',
    gap: 12,
  },
  premiumCard: {
    borderColor: 'rgba(245,158,11,0.4)',
  },
  cardTop: {gap: 4},
  planName: {
    color: '#f59e0b',
    fontSize: 13,
    fontWeight: '700',
    letterSpacing: 1,
  },
  price: {color: '#fff', fontSize: 28, fontWeight: '800'},
  features: {gap: 6, marginTop: 4},
  featureText: {color: '#d4d4d8', fontSize: 14, lineHeight: 20},
  button: {
    marginTop: 10,
    height: 48,
    borderRadius: 12,
    backgroundColor: '#f59e0b',
    alignItems: 'center',
    justifyContent: 'center',
  },
  buttonDisabled: {
    opacity: 0.6,
  },
  buttonText: {color: '#000', fontWeight: '700', fontSize: 15},
  buttonMuted: {backgroundColor: 'rgba(255,255,255,0.08)'},
  buttonMutedText: {color: '#aaa', fontWeight: '700', fontSize: 15},
  restoreText: {
    color: '#d4d4d8',
    fontSize: 13,
    textAlign: 'center',
    textDecorationLine: 'underline',
  },
});
