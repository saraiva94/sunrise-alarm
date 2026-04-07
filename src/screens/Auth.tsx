import React, {useEffect, useRef, useState} from 'react';
import {
  ActivityIndicator,
  Animated,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import {SafeAreaView} from 'react-native-safe-area-context';
import {useAuth} from '@/hooks/useAuth';
import {supabase} from '@/integrations/supabase/client';
import {useToast} from '@/hooks/use-toast';
import {z} from 'zod';


function GoogleIcon() {
  return (
    <View style={{
      width: 20,
      height: 20,
      alignItems: 'center',
      justifyContent: 'center',
      marginRight: 8,
    }}>
      <Text style={{
        fontSize: 16,
        fontWeight: '800',
        color: '#4285F4',
      }}>G</Text>
    </View>
  );
}

const loginSchema = z.object({
  email: z.string().email('Email inválido'),
  password: z.string().min(1, 'Senha é obrigatória'),
});

const passwordSchema = z
  .string()
  .min(8, 'Senha deve ter no mínimo 8 caracteres')
  .regex(/[A-Z]/, 'Senha deve ter pelo menos uma letra maiúscula')
  .regex(/[a-z]/, 'Senha deve ter pelo menos uma letra minúscula')
  .regex(/[0-9]/, 'Senha deve ter pelo menos um número')
  .regex(/[^A-Za-z0-9]/, 'Senha deve ter pelo menos um símbolo (!@#$%...)');

const signupSchema = z
  .object({
    name: z
      .string()
      .min(2, 'Nome deve ter no mínimo 2 caracteres')
      .max(100, 'Nome muito longo'),
    email: z.string().email('Email inválido'),
    password: passwordSchema,
    confirmPassword: z.string(),
  })
  .refine(data => data.password === data.confirmPassword, {
    message: 'Senhas não conferem',
    path: ['confirmPassword'],
  });

export default function AuthScreen() {
  const [isLogin, setIsLogin] = useState(true);
  const [isForgotPassword, setIsForgotPassword] = useState(false);
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const {signInWithEmail, signUpWithEmail, signInWithGoogle} = useAuth();
  const {toast} = useToast();

  const pulseAnim = useRef(new Animated.Value(0)).current;

  // Navigation is handled automatically by AppNavigator's conditional stack.
  // No manual reset needed — when user becomes non-null, Auth is unmounted.

  useEffect(() => {
    const anim = Animated.loop(
      Animated.sequence([
        Animated.timing(pulseAnim, {
          toValue: 1,
          duration: 1200,
          useNativeDriver: true,
        }),
        Animated.timing(pulseAnim, {
          toValue: 0,
          duration: 1200,
          useNativeDriver: true,
        }),
      ]),
    );
    anim.start();
    return () => anim.stop();
  }, [pulseAnim]);

  const logoScale = pulseAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [1, 1.08],
  });

  const clearForm = () => {
    setName('');
    setEmail('');
    setPassword('');
    setConfirmPassword('');
    setErrors({});
  };

  const handleToggleMode = () => {
    setIsLogin(!isLogin);
    setIsForgotPassword(false);
    clearForm();
  };

  const handleForgotPassword = async () => {
    setErrors({});

    if (!email || !z.string().email().safeParse(email).success) {
      setErrors({email: 'Email inválido'});
      return;
    }

    setLoading(true);
    try {
      const {error} = await supabase.auth.resetPasswordForEmail(email, {
        redirectTo: 'sunrisealarm://reset-password',
      });
      if (error) throw error;

      toast({
        type: 'success',
        text1: 'Email enviado!',
        text2: 'Verifique sua caixa de entrada para redefinir sua senha.',
      });

      setIsForgotPassword(false);
      clearForm();
    } catch (error: any) {
      toast({
        type: 'error',
        text1: 'Erro ao enviar email',
        text2: error.message,
      });
    } finally {
      setLoading(false);
    }
  };

  const handleEmailAuth = async () => {
    setErrors({});
    setLoading(true);
    try {
      if (isLogin) {
        const result = loginSchema.safeParse({email, password});
        if (!result.success) {
          const fieldErrors: Record<string, string> = {};
          result.error.issues.forEach(err => {
            if (err.path[0]) fieldErrors[err.path[0] as string] = err.message;
          });
          setErrors(fieldErrors);
          return;
        }
        await signInWithEmail(email, password);
      } else {
        const result = signupSchema.safeParse({
          name,
          email,
          password,
          confirmPassword,
        });
        if (!result.success) {
          const fieldErrors: Record<string, string> = {};
          result.error.issues.forEach(err => {
            if (err.path[0]) fieldErrors[err.path[0] as string] = err.message;
          });
          setErrors(fieldErrors);
          return;
        }
        await signUpWithEmail(email, password, name);
      }
    } catch {
      // Error toast is already shown by useAuth
    } finally {
      setLoading(false);
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.overlay}>
        <KeyboardAvoidingView
          style={styles.flex}
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
          <ScrollView
            contentContainerStyle={styles.scrollContent}
            keyboardShouldPersistTaps="handled">
            <View style={styles.card}>
              <View style={styles.header}>
                <Animated.View style={{transform: [{scale: logoScale}]}}>
                  <Text style={styles.sunIcon}>☀️</Text>
                </Animated.View>
                <Text style={styles.title}>
                  {isForgotPassword ? 'Recuperar Senha' : 'Alarme Solar'}
                </Text>
                <Text style={styles.subtitle}>
                  {isForgotPassword
                    ? 'Digite seu email para receber o link de recuperação'
                    : 'Acorde com o sol'}
                </Text>
              </View>

              {isForgotPassword ? (
                <View style={styles.form}>
                  <View style={styles.fieldGroup}>
                    <Text style={styles.label}>Email</Text>
                    <TextInput
                      style={[styles.input, errors.email ? styles.inputError : null]}
                      value={email}
                      onChangeText={setEmail}
                      placeholder="seu@email.com"
                      placeholderTextColor="#888"
                      keyboardType="email-address"
                      autoCapitalize="none"
                      autoCorrect={false}
                    />
                    {errors.email && <Text style={styles.errorText}>{errors.email}</Text>}
                  </View>
                  <TouchableOpacity
                    style={[styles.primaryButton, loading && styles.buttonDisabled]}
                    onPress={handleForgotPassword}
                    disabled={loading}
                    activeOpacity={0.8}>
                    {loading ? (
                      <ActivityIndicator color="#000" size="small" />
                    ) : (
                      <Text style={styles.primaryButtonText}>
                        Enviar Link de Recuperação
                      </Text>
                    )}
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={styles.backButton}
                    onPress={() => {
                      setIsForgotPassword(false);
                      clearForm();
                    }}>
                    <Text style={styles.backButtonText}>← Voltar para login</Text>
                  </TouchableOpacity>
                </View>
              ) : (
                <View style={styles.form}>
                  {!isLogin && (
                    <View style={styles.fieldGroup}>
                      <Text style={styles.label}>Nome completo</Text>
                      <TextInput
                        style={[styles.input, errors.name ? styles.inputError : null]}
                        value={name}
                        onChangeText={setName}
                        placeholder="Seu nome"
                        placeholderTextColor="#888"
                        autoCapitalize="words"
                      />
                      {errors.name && <Text style={styles.errorText}>{errors.name}</Text>}
                    </View>
                  )}

                  <View style={styles.fieldGroup}>
                    <Text style={styles.label}>Email</Text>
                    <TextInput
                      style={[styles.input, errors.email ? styles.inputError : null]}
                      value={email}
                      onChangeText={setEmail}
                      placeholder="seu@email.com"
                      placeholderTextColor="#888"
                      keyboardType="email-address"
                      autoCapitalize="none"
                      autoCorrect={false}
                    />
                    {errors.email && <Text style={styles.errorText}>{errors.email}</Text>}
                  </View>

                  <View style={styles.fieldGroup}>
                    <Text style={styles.label}>Senha</Text>
                    <View style={styles.passwordContainer}>
                      <TextInput
                        style={[styles.input, styles.passwordInput, errors.password ? styles.inputError : null]}
                        value={password}
                        onChangeText={setPassword}
                        placeholder="••••••••"
                        placeholderTextColor="#888"
                        secureTextEntry={!showPassword}
                        autoCapitalize="none"
                      />
                      <TouchableOpacity
                        style={styles.eyeButton}
                        onPress={() => setShowPassword(!showPassword)}
                        activeOpacity={0.7}>
                        <Text style={styles.eyeIcon}>{showPassword ? '\u{1F441}\u200D\u{1F5E8}' : '\u{1F441}'}</Text>
                      </TouchableOpacity>
                    </View>
                    {errors.password && (
                      <Text style={styles.errorText}>{errors.password}</Text>
                    )}
                    {!isLogin && !errors.password && (
                      <Text style={styles.hintText}>
                        Mínimo 8 caracteres, com maiúscula, minúscula, número e
                        símbolo
                      </Text>
                    )}
                  </View>

                  {!isLogin && (
                    <View style={styles.fieldGroup}>
                      <Text style={styles.label}>Confirmar Senha</Text>
                      <View style={styles.passwordContainer}>
                        <TextInput
                          style={[styles.input, styles.passwordInput, errors.confirmPassword ? styles.inputError : null]}
                          value={confirmPassword}
                          onChangeText={setConfirmPassword}
                          placeholder="••••••••"
                          placeholderTextColor="#888"
                          secureTextEntry={!showConfirmPassword}
                          autoCapitalize="none"
                        />
                        <TouchableOpacity
                          style={styles.eyeButton}
                          onPress={() => setShowConfirmPassword(!showConfirmPassword)}
                          activeOpacity={0.7}>
                          <Text style={styles.eyeIcon}>{showConfirmPassword ? '\u{1F441}\u200D\u{1F5E8}' : '\u{1F441}'}</Text>
                        </TouchableOpacity>
                      </View>
                      {errors.confirmPassword && (
                        <Text style={styles.errorText}>{errors.confirmPassword}</Text>
                      )}
                    </View>
                  )}

                  <TouchableOpacity
                    style={[styles.primaryButton, loading && styles.buttonDisabled]}
                    onPress={handleEmailAuth}
                    disabled={loading}
                    activeOpacity={0.8}>
                    {loading ? (
                      <ActivityIndicator color="#000" size="small" />
                    ) : (
                      <Text style={styles.primaryButtonText}>
                        {isLogin ? 'Entrar' : 'Criar Conta'}
                      </Text>
                    )}
                  </TouchableOpacity>

                  {isLogin && (
                    <TouchableOpacity
                      style={styles.forgotButton}
                      onPress={() => {
                        setIsForgotPassword(true);
                        clearForm();
                      }}>
                      <Text style={styles.forgotButtonText}>Esqueceu sua senha?</Text>
                    </TouchableOpacity>
                  )}

                  <View style={styles.divider}>
                    <View style={styles.dividerLine} />
                    <Text style={styles.dividerText}>OU CONTINUE COM</Text>
                    <View style={styles.dividerLine} />
                  </View>

                  <TouchableOpacity
                    style={styles.googleButton}
                    onPress={signInWithGoogle}
                    activeOpacity={0.8}>
                    <GoogleIcon />
                    <Text style={styles.googleButtonText}>Entrar com Google</Text>
                  </TouchableOpacity>

                  <TouchableOpacity style={styles.toggleButton} onPress={handleToggleMode}>
                    <Text style={styles.toggleText}>
                      {isLogin ? 'Não tem conta? ' : 'Já tem conta? '}
                      <Text style={styles.toggleHighlight}>
                        {isLogin ? 'Criar conta' : 'Entrar'}
                      </Text>
                    </Text>
                  </TouchableOpacity>
                </View>
              )}
            </View>
          </ScrollView>
        </KeyboardAvoidingView>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  flex: {flex: 1},
  container: {
    flex: 1,
    backgroundColor: '#0a0a0a',
  },
  overlay: {
    flex: 1,
    backgroundColor: 'transparent',
  },
  scrollContent: {
    flexGrow: 1,
    padding: 20,
    paddingTop: 40,
  },
  card: {
    backgroundColor: 'rgba(26,26,46,0.9)',
    borderRadius: 20,
    padding: 24,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)',
  },
  header: {
    alignItems: 'center',
    marginBottom: 20,
  },
  sunIcon: {
    fontSize: 72,
    marginBottom: 10,
  },
  title: {
    fontSize: 32,
    fontWeight: '800',
    color: '#f59e0b',
    marginBottom: 8,
    textAlign: 'center',
  },
  subtitle: {
    fontSize: 15,
    color: '#777',
    textAlign: 'center',
    lineHeight: 22,
  },
  googleButton: {
    height: 48,
    backgroundColor: '#ffffff',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#dadce0',
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
    elevation: 1,
    shadowColor: '#000',
    shadowOffset: {width: 0, height: 1},
    shadowOpacity: 0.1,
    shadowRadius: 2,
  },
  googleButtonText: {
    fontSize: 14,
    fontWeight: '500',
    color: '#3c4043',
  },
  divider: {
    flexDirection: 'row',
    alignItems: 'center',
    marginVertical: 4,
  },
  dividerLine: {
    flex: 1,
    height: 1,
    backgroundColor: 'rgba(255,255,255,0.1)',
  },
  dividerText: {
    fontSize: 11,
    color: '#666',
    marginHorizontal: 12,
    letterSpacing: 0.5,
  },
  form: {
    gap: 16,
    marginTop: 16,
  },
  fieldGroup: {
    gap: 6,
  },
  label: {
    fontSize: 14,
    fontWeight: '600',
    color: '#ccc',
  },
  input: {
    height: 52,
    backgroundColor: 'rgba(255,255,255,0.06)',
    borderRadius: 12,
    borderWidth: 2,
    borderColor: 'rgba(255,255,255,0.12)',
    paddingHorizontal: 16,
    fontSize: 16,
    color: '#fff',
  },
  passwordContainer: {
    position: 'relative',
  },
  passwordInput: {
    paddingRight: 50,
  },
  eyeButton: {
    position: 'absolute',
    right: 0,
    top: 0,
    height: 52,
    width: 50,
    alignItems: 'center',
    justifyContent: 'center',
  },
  eyeIcon: {
    fontSize: 20,
  },
  inputError: {
    borderColor: '#ef4444',
  },
  errorText: {
    fontSize: 13,
    color: '#ef4444',
  },
  hintText: {
    fontSize: 12,
    color: '#777',
  },
  primaryButton: {
    height: 52,
    backgroundColor: '#f59e0b',
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 8,
  },
  primaryButtonText: {
    fontSize: 16,
    fontWeight: '700',
    color: '#000',
  },
  buttonDisabled: {
    opacity: 0.6,
  },
  forgotButton: {
    alignItems: 'center',
    paddingVertical: 8,
  },
  forgotButtonText: {
    fontSize: 14,
    color: '#999',
  },
  backButton: {
    alignItems: 'center',
    paddingVertical: 8,
  },
  backButtonText: {
    fontSize: 14,
    color: '#999',
  },
  toggleButton: {
    alignItems: 'center',
    marginTop: 20,
    paddingVertical: 8,
  },
  toggleText: {
    fontSize: 14,
    color: '#999',
  },
  toggleHighlight: {
    color: '#f59e0b',
    textDecorationLine: 'underline',
  },
});
