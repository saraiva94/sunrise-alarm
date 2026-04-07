import React, {useEffect, useState} from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  Alert,
  FlatList,
} from 'react-native';
import {SafeAreaView} from 'react-native-safe-area-context';
import {useNavigation} from '@react-navigation/native';
import type {NativeStackNavigationProp} from '@react-navigation/native-stack';
import type {RootStackParamList} from '@/navigation/AppNavigator';
import {useAuth} from '@/hooks/useAuth';
import {supabase} from '@/integrations/supabase/client';
import {useToast} from '@/hooks/use-toast';

type AdminNav = NativeStackNavigationProp<RootStackParamList, 'Admin'>;

interface Profile {
  id: string;
  full_name: string;
  email: string;
  created_at: string;
}

export default function AdminScreen() {
  const navigation = useNavigation<AdminNav>();
  const {user, loading: authLoading} = useAuth();
  const {toast} = useToast();

  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [loading, setLoading] = useState(true);
  const [checkingRole, setCheckingRole] = useState(true);
  const [isAdmin, setIsAdmin] = useState(false);

  useEffect(() => {
    if (!authLoading && !user) {
      navigation.navigate('Auth');
      return;
    }

    if (user) {
      checkAdminRole();
    }
  }, [authLoading, user]);

  const checkAdminRole = async () => {
    if (!user) return;

    const adminEmails = ['swami_gs@live.com', 'sir.saraiva94@gmail.com'];
    const isAdminByEmail =
      user.email && adminEmails.includes(user.email.toLowerCase());

    if (isAdminByEmail) {
      setIsAdmin(true);
      setCheckingRole(false);
      fetchProfiles();
      return;
    }

    try {
      const {data, error} = await supabase.rpc('has_role', {
        _user_id: user.id,
        _role: 'admin',
      });

      if (error) throw error;

      const allowed = data === true;
      setIsAdmin(allowed);

      if (allowed) {
        fetchProfiles();
      }
    } catch {
      setIsAdmin(false);
    } finally {
      setCheckingRole(false);
    }
  };

  const fetchProfiles = async () => {
    try {
      const {data, error} = await supabase
        .from('profiles')
        .select('id, full_name, email, created_at')
        .order('created_at', {ascending: false});

      if (error) throw error;
      setProfiles(data || []);
    } catch {
      toast({
        type: 'error',
        text1: 'Erro',
        text2: 'Não foi possível carregar os usuários.',
      });
    } finally {
      setLoading(false);
    }
  };

  const clearProfiles = async () => {
    try {
      const adminEmails = ['swami_gs@live.com', 'sir.saraiva94@gmail.com'];
      const adminFilter = `(${adminEmails.map(e => `"${e}"`).join(',')})`;

      const {error} = await supabase
        .from('profiles')
        .delete()
        .not('email', 'in', adminFilter);

      if (error) throw error;

      await supabase.from('user_roles').delete().eq('role', 'user');
      await supabase
        .from('alarms')
        .delete()
        .neq('user_id', user?.id || '');

      setProfiles(prev =>
        prev.filter(p => adminEmails.includes((p.email || '').toLowerCase())),
      );

      toast({
        type: 'success',
        text1: 'Concluído',
        text2: 'Cadastros de usuários limpos.',
      });
    } catch {
      toast({
        type: 'error',
        text1: 'Erro',
        text2: 'Não foi possível limpar os cadastros.',
      });
    }
  };

  const confirmClear = () => {
    Alert.alert(
      'Limpar cadastros?',
      'Essa ação remove usuários (exceto admins), funções e alarmes relacionados.',
      [
        {text: 'Cancelar', style: 'cancel'},
        {text: 'Sim, limpar', style: 'destructive', onPress: clearProfiles},
      ],
    );
  };

  if (authLoading || checkingRole) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.center}>
          <ActivityIndicator size="large" color="#f59e0b" />
        </View>
      </SafeAreaView>
    );
  }

  if (!isAdmin) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.centerCard}>
          <Text style={styles.deniedTitle}>Acesso negado</Text>
          <Text style={styles.deniedText}>
            Você não tem permissão para esta tela.
          </Text>
          <TouchableOpacity
            style={styles.primaryButton}
            onPress={() => navigation.navigate('Home')}>
            <Text style={styles.primaryButtonText}>Voltar para Home</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.navigate('Home')}>
          <Text style={styles.backText}>← Voltar</Text>
        </TouchableOpacity>
        <Text style={styles.title}>Painel Admin</Text>
      </View>

      <View style={styles.actions}>
        <TouchableOpacity style={styles.primaryButton} onPress={fetchProfiles}>
          <Text style={styles.primaryButtonText}>Atualizar</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={styles.dangerButton}
          onPress={confirmClear}
          disabled={profiles.length === 0}>
          <Text style={styles.dangerButtonText}>Limpar cadastros</Text>
        </TouchableOpacity>
      </View>

      <View style={styles.statsCard}>
        <Text style={styles.statsLabel}>Total de usuários</Text>
        <Text style={styles.statsValue}>{profiles.length}</Text>
      </View>

      {loading ? (
        <View style={styles.center}>
          <ActivityIndicator size="large" color="#f59e0b" />
        </View>
      ) : (
        <FlatList
          data={profiles}
          keyExtractor={item => item.id}
          contentContainerStyle={styles.listContent}
          ListEmptyComponent={
            <View style={styles.emptyCard}>
              <Text style={styles.emptyText}>Nenhum usuário cadastrado.</Text>
            </View>
          }
          renderItem={({item}) => (
            <View style={styles.userCard}>
              <Text style={styles.userName}>
                {item.full_name || 'Sem nome'}
              </Text>
              <Text style={styles.userEmail}>{item.email || 'Sem email'}</Text>
              <Text style={styles.userDate}>
                {new Date(item.created_at).toLocaleString('pt-BR')}
              </Text>
            </View>
          )}
        />
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {flex: 1, backgroundColor: '#0a0a0a', paddingHorizontal: 16},
  center: {flex: 1, alignItems: 'center', justifyContent: 'center'},
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingVertical: 10,
  },
  backText: {color: '#999', fontSize: 15},
  title: {color: '#fff', fontSize: 23, fontWeight: '700'},
  actions: {flexDirection: 'row', gap: 10, marginBottom: 12},
  primaryButton: {
    flex: 1,
    backgroundColor: '#f59e0b',
    height: 46,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  primaryButtonText: {color: '#000', fontWeight: '700'},
  dangerButton: {
    flex: 1,
    backgroundColor: 'rgba(239,68,68,0.2)',
    borderWidth: 1,
    borderColor: 'rgba(239,68,68,0.45)',
    height: 46,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  dangerButtonText: {color: '#fca5a5', fontWeight: '700'},
  statsCard: {
    backgroundColor: '#1a1a2e',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)',
    padding: 14,
    marginBottom: 12,
  },
  statsLabel: {color: '#999', fontSize: 13},
  statsValue: {color: '#fff', fontSize: 28, fontWeight: '800', marginTop: 2},
  listContent: {paddingBottom: 24, gap: 10},
  userCard: {
    backgroundColor: '#1a1a2e',
    borderRadius: 12,
    padding: 14,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)',
  },
  userName: {color: '#fff', fontSize: 16, fontWeight: '700'},
  userEmail: {color: '#c5c5c5', fontSize: 13, marginTop: 3},
  userDate: {color: '#888', fontSize: 12, marginTop: 5},
  emptyCard: {
    backgroundColor: '#1a1a2e',
    borderRadius: 12,
    padding: 18,
    alignItems: 'center',
  },
  emptyText: {color: '#999'},
  centerCard: {
    marginTop: 80,
    backgroundColor: '#1a1a2e',
    padding: 18,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: 'rgba(239,68,68,0.3)',
    gap: 10,
  },
  deniedTitle: {color: '#fff', fontSize: 20, fontWeight: '700'},
  deniedText: {color: '#aaa', fontSize: 14},
});
