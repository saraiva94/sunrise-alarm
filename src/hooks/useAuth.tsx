import {useState, useEffect, createContext, useContext, ReactNode} from 'react';
import {Linking} from 'react-native';
import {User, Session} from '@supabase/supabase-js';
import {supabase} from '@/integrations/supabase/client';
import {useToast} from '@/hooks/use-toast';

interface AuthContextType {
  user: User | null;
  session: Session | null;
  loading: boolean;
  signInWithEmail: (email: string, password: string) => Promise<void>;
  signUpWithEmail: (
    email: string,
    password: string,
    name?: string,
  ) => Promise<void>;
  signInWithGoogle: () => Promise<void>;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({children}: {children: ReactNode}) {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);
  const {toast} = useToast();

  useEffect(() => {
    // Set up auth state listener
    const {
      data: {subscription},
    } = supabase.auth.onAuthStateChange((event, session) => {
      setSession(session);
      setUser(session?.user ?? null);
      setLoading(false);
    });

    // Check for existing session
    supabase.auth.getSession().then(({data: {session}}) => {
      setSession(session);
      setUser(session?.user ?? null);
      setLoading(false);
    });

    return () => subscription.unsubscribe();
  }, []);

  useEffect(() => {
    const handleUrl = async ({url}: {url: string}) => {
      if (!url.includes('auth-callback') && !url.includes('reset-password'))
        return;

      const {data} = await supabase.auth.getSession();
      if (data.session) {
        setSession(data.session);
        setUser(data.session.user);
      }
    };

    const subscription = Linking.addEventListener('url', handleUrl);
    return () => subscription.remove();
  }, []);

  const signInWithEmail = async (email: string, password: string) => {
    const {error} = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    if (error) {
      toast({
        type: 'error',
        text1: 'Erro ao entrar',
        text2: error.message,
      });
      throw error;
    }
  };

  const signUpWithEmail = async (
    email: string,
    password: string,
    name?: string,
  ) => {
    const redirectUrl = 'sunrisealarm://auth-callback';

    const {data, error} = await supabase.auth.signUp({
      email,
      password,
      options: {
        emailRedirectTo: redirectUrl,
        data: {
          full_name: name,
        },
      },
    });

    if (error) {
      toast({
        type: 'error',
        text1: 'Erro ao criar conta',
        text2: error.message,
      });
      throw error;
    }

    // Check if email confirmation is required
    if (data.user && !data.session) {
      toast({
        type: 'info',
        text1: 'Verifique seu email',
        text2:
          'Enviamos um link de confirmação para seu email. Por favor, verifique sua caixa de entrada.',
      });
    } else {
      toast({
        type: 'success',
        text1: 'Conta criada!',
        text2: 'Você já pode fazer login.',
      });
    }
  };

  const signInWithGoogle = async () => {
    const {data, error} = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: {
        redirectTo: 'sunrisealarm://auth-callback',
        skipBrowserRedirect: true,
      },
    });

    if (error) {
      toast({
        type: 'error',
        text1: 'Erro ao entrar com Google',
        text2: error.message,
      });
      throw error;
    }

    if (data?.url) {
      await Linking.openURL(data.url);
    }
  };

  const signOut = async () => {
    const {error} = await supabase.auth.signOut();

    if (error) {
      toast({
        type: 'error',
        text1: 'Erro ao sair',
        text2: error.message,
      });
      throw error;
    }
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        session,
        loading,
        signInWithEmail,
        signUpWithEmail,
        signInWithGoogle,
        signOut,
      }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
