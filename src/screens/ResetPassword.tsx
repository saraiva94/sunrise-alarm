import React, {useEffect, useState} from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  ActivityIndicator,
  StyleSheet,
  ScrollView,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import {SafeAreaView} from 'react-native-safe-area-context';
import {useNavigation} from '@react-navigation/native';
import type {NativeStackNavigationProp} from '@react-navigation/native-stack';
import type {RootStackParamList} from '@/navigation/AppNavigator';
import {supabase} from '@/integrations/supabase/client';
import {useToast} from '@/hooks/use-toast';
import {z} from 'zod';

type ResetNav = NativeStackNavigationProp<RootStackParamList, 'ResetPassword'>;

const passwordSchema = z
  .string()
  .min(8, 'Senha deve ter no mínimo 8 caracteres')
  .regex(/[A-Z]/, 'Senha deve ter pelo menos uma letra maiúscula')
  .regex(/[a-z]/, 'Senha deve ter pelo menos uma letra minúscula')
  .regex(/[0-9]/, 'Senha deve ter pelo menos um número')
  .regex(/[^A-Za-z0-9]/, 'Senha deve ter pelo menos um símbolo (!@#$%...)');

const resetPasswordSchema = z
  .object({
    password: passwordSchema,
    confirmPassword: z.string(),
  })
  .refine(data => data.password === data.confirmPassword, {
    message: 'Senhas não conferem',
    path: ['confirmPassword'],
  });

export default function ResetPasswordScreen() {
  const navigation = useNavigation<ResetNav>();
  const {toast} = useToast();

  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [checkingSession, setCheckingSession] = useState(true);
  const [isValidSession, setIsValidSession] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});

  useEffect(() => {
    const checkSession = async () => {
      const {data} = await supabase.auth.getSession();
      setIsValidSession(!!data.session);
      setCheckingSession(false);
    };

    checkSession();

    const {
      data: {subscription},
    } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === 'PASSWORD_RECOVERY' || !!session) {
        setIsValidSession(true);
      }
    });

    return () => subscription.unsubscribe();
  }, []);

  const handleResetPassword = async () => {
    setErrors({});

    const result = resetPasswordSchema.safeParse({password, confirmPassword});

    if (!result.success) {
      const fieldErrors: Record<string, string> = {};
      result.error.errors.forEach(err => {
        const key = err.path[0] as string | undefined;
        if (key) fieldErrors[key] = err.message;
      });
      setErrors(fieldErrors);
      return;
    }

    setLoading(true);
    try {
      const {error} = await supabase.auth.updateUser({password});
      if (error) throw error;

      toast({
        type: 'success',
        text1: 'Senha alterada!',
        text2: 'Faça login com a nova senha.',
      });

      await supabase.auth.signOut();
      navigation.navigate('Auth');
    } catch (error: any) {
      toast({
        type: 'error',
        text1: 'Erro ao alterar senha',
        text2: error?.message || 'Tente novamente.',
      });
    } finally {
      setLoading(false);
    }
  };

  if (checkingSession) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.center}>
          <ActivityIndicator size="large" color="#f59e0b" />
        </View>
      </SafeAreaView>
    );
  }

  if (!isValidSession) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.card}>
          <Text style={styles.title}>Link inválido</Text>
          <Text style={styles.subtitle}>
            Este link de recuperação é inválido ou expirou.
          </Text>
          <TouchableOpacity
            style={styles.primaryButton}
            onPress={() => navigation.navigate('Auth')}>
            <Text style={styles.primaryButtonText}>Voltar para login</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
        <ScrollView
          contentContainerStyle={styles.scrollContent}
          keyboardShouldPersistTaps="handled">
          <View style={styles.card}>
            <Text style={styles.title}>Nova senha</Text>
            <Text style={styles.subtitle}>Digite sua nova senha abaixo.</Text>

            <View style={styles.fieldGroup}>
              <Text style={styles.label}>Senha</Text>
              <TextInput
                style={[
                  styles.input,
                  errors.password ? styles.inputError : null,
                ]}
                value={password}
                onChangeText={setPassword}
                secureTextEntry
                placeholder="••••••••"
                placeholderTextColor="#666"
                autoCapitalize="none"
              />
              {errors.password ? (
                <Text style={styles.errorText}>{errors.password}</Text>
              ) : (
                <Text style={styles.hintText}>
                  Minimo 8 caracteres, com maiuscula, minuscula, numero e
                  simbolo.
                </Text>
              )}
            </View>

            <View style={styles.fieldGroup}>
              <Text style={styles.label}>Confirmar senha</Text>
              <TextInput
                style={[
                  styles.input,
                  errors.confirmPassword ? styles.inputError : null,
                ]}
                value={confirmPassword}
                onChangeText={setConfirmPassword}
                secureTextEntry
                placeholder="••••••••"
                placeholderTextColor="#666"
                autoCapitalize="none"
              />
              {errors.confirmPassword && (
                <Text style={styles.errorText}>{errors.confirmPassword}</Text>
              )}
            </View>

            <TouchableOpacity
              style={[styles.primaryButton, loading && styles.buttonDisabled]}
              onPress={handleResetPassword}
              disabled={loading}>
              {loading ? (
                <ActivityIndicator color="#000" size="small" />
              ) : (
                <Text style={styles.primaryButtonText}>Alterar senha</Text>
              )}
            </TouchableOpacity>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  flex: {flex: 1},
  container: {flex: 1, backgroundColor: '#0a0a0a'},
  center: {flex: 1, alignItems: 'center', justifyContent: 'center'},
  scrollContent: {flexGrow: 1, justifyContent: 'center', padding: 20},
  card: {
    backgroundColor: '#1a1a2e',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)',
    padding: 20,
    gap: 14,
  },
  title: {color: '#fff', fontSize: 24, fontWeight: '700'},
  subtitle: {color: '#9ca3af', fontSize: 14, lineHeight: 20},
  fieldGroup: {gap: 6},
  label: {color: '#d4d4d8', fontWeight: '600', fontSize: 14},
  input: {
    height: 52,
    backgroundColor: 'rgba(255,255,255,0.06)',
    borderWidth: 2,
    borderColor: 'rgba(255,255,255,0.12)',
    borderRadius: 12,
    color: '#fff',
    paddingHorizontal: 14,
    fontSize: 16,
  },
  inputError: {borderColor: '#ef4444'},
  hintText: {color: '#777', fontSize: 12},
  errorText: {color: '#ef4444', fontSize: 12},
  primaryButton: {
    marginTop: 6,
    height: 52,
    borderRadius: 12,
    backgroundColor: '#f59e0b',
    alignItems: 'center',
    justifyContent: 'center',
  },
  buttonDisabled: {opacity: 0.6},
  primaryButtonText: {color: '#000', fontWeight: '700', fontSize: 16},
});
