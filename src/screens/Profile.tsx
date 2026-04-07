import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  ScrollView,
  ActivityIndicator,
  StyleSheet,
  Switch,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import type { RootStackParamList } from '@/navigation/AppNavigator';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';

type ProfileNav = NativeStackNavigationProp<RootStackParamList, 'Profile'>;

interface ProfileData {
  full_name: string;
  avatar_url: string | null;
  main_purpose: string | null;
  instagram_handle: string | null;
  twitter_handle: string | null;
  tiktok_handle: string | null;
}

export default function ProfileScreen() {
  const navigation = useNavigation<ProfileNav>();
  const { user, loading: authLoading } = useAuth();
  const { toast } = useToast();

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [isAdmin, setIsAdmin] = useState(false);
  const [profile, setProfile] = useState<ProfileData>({
    full_name: '',
    avatar_url: null,
    main_purpose: null,
    instagram_handle: null,
    twitter_handle: null,
    tiktok_handle: null,
  });

  const [selectedSocials, setSelectedSocials] = useState({
    instagram: false,
    twitter: false,
    tiktok: false,
  });

  // Navigation is handled automatically by AppNavigator's conditional stack.
  // When user becomes null, the navigator unmounts Profile and shows Auth.

  useEffect(() => {
    if (user) {
      fetchProfile();
      checkAdmin();
    }
  }, [user]);

  const checkAdmin = async () => {
    if (!user) return;

    const adminEmails = ['swami_gs@live.com', 'sir.saraiva94@gmail.com'];
    const isAdminByEmail = user.email && adminEmails.includes(user.email.toLowerCase());

    if (isAdminByEmail) {
      setIsAdmin(true);
      return;
    }

    const { data } = await supabase
      .from('user_roles')
      .select('role')
      .eq('user_id', user.id)
      .eq('role', 'admin')
      .maybeSingle();
    setIsAdmin(!!data);
  };

  const fetchProfile = async () => {
    try {
      const { data, error } = await supabase
        .from('profiles')
        .select('full_name, avatar_url, main_purpose, instagram_handle, twitter_handle, tiktok_handle')
        .eq('id', user!.id)
        .single();

      if (error) throw error;

      if (data) {
        setProfile({
          full_name: data.full_name || '',
          avatar_url: data.avatar_url,
          main_purpose: data.main_purpose,
          instagram_handle: data.instagram_handle,
          twitter_handle: data.twitter_handle,
          tiktok_handle: data.tiktok_handle,
        });

        setSelectedSocials({
          instagram: !!data.instagram_handle,
          twitter: !!data.twitter_handle,
          tiktok: !!data.tiktok_handle,
        });
      }
    } catch {
      // Profile fetch failed silently
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async () => {
    if (!user) return;

    setSaving(true);

    try {
      const updateData = {
        full_name: profile.full_name,
        avatar_url: profile.avatar_url,
        main_purpose: profile.main_purpose,
        instagram_handle: selectedSocials.instagram ? profile.instagram_handle : null,
        twitter_handle: selectedSocials.twitter ? profile.twitter_handle : null,
        tiktok_handle: selectedSocials.tiktok ? profile.tiktok_handle : null,
      };

      const { error } = await supabase
        .from('profiles')
        .update(updateData)
        .eq('id', user.id);

      if (error) throw error;

      toast({
        type: 'success',
        text1: 'Sucesso',
        text2: 'Perfil atualizado com sucesso!',
      });
    } catch {
      toast({
        type: 'error',
        text1: 'Erro',
        text2: 'Não foi possível salvar o perfil.',
      });
    } finally {
      setSaving(false);
    }
  };

  const getInitials = (name: string) => {
    return name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2);
  };

  if (authLoading || loading) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#f59e0b" />
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <View style={styles.headerLeft}>
          <TouchableOpacity onPress={() => navigation.navigate('Home')}>
            <Text style={styles.backText}>← Voltar</Text>
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Meu Perfil</Text>
        </View>
        {isAdmin && (
          <TouchableOpacity
            style={styles.adminButton}
            onPress={() => navigation.navigate('Admin')}
          >
            <Text style={styles.adminButtonText}>⚙️ Admin</Text>
          </TouchableOpacity>
        )}
      </View>

      <ScrollView contentContainerStyle={styles.scrollContent} keyboardShouldPersistTaps="handled">
        <View style={styles.card}>
          {/* Avatar */}
          <View style={styles.avatarSection}>
            <View style={styles.avatar}>
              <Text style={styles.avatarText}>{getInitials(profile.full_name || 'U')}</Text>
            </View>
            <Text style={styles.avatarName}>{profile.full_name || 'Seu Nome'}</Text>
          </View>

          {/* Name */}
          <View style={styles.fieldGroup}>
            <Text style={styles.label}>Nome</Text>
            <TextInput
              style={styles.input}
              value={profile.full_name}
              onChangeText={(text) => setProfile(prev => ({ ...prev, full_name: text }))}
              placeholder="Seu nome completo"
              placeholderTextColor="#666"
            />
          </View>

          {/* Purpose */}
          <View style={styles.fieldGroup}>
            <Text style={styles.label}>Propósito Principal</Text>
            <TextInput
              style={[styles.input, styles.textarea]}
              value={profile.main_purpose || ''}
              onChangeText={(text) => setProfile(prev => ({ ...prev, main_purpose: text }))}
              placeholder="Por que você quer vencer o sol e acordar antes dele?"
              placeholderTextColor="#666"
              multiline
              numberOfLines={3}
              textAlignVertical="top"
            />
          </View>

          {/* Social Media */}
          <View style={styles.fieldGroup}>
            <Text style={styles.label}>Redes Sociais</Text>
            <Text style={styles.hint}>Selecione as redes que deseja compartilhar no ranking</Text>

            {/* Instagram */}
            <View style={styles.socialRow}>
              <Switch
                value={selectedSocials.instagram}
                onValueChange={(val) => setSelectedSocials(prev => ({ ...prev, instagram: val }))}
                trackColor={{ false: '#333', true: 'rgba(236,72,153,0.4)' }}
                thumbColor={selectedSocials.instagram ? '#ec4899' : '#888'}
              />
              <Text style={styles.socialLabel}>📸 Instagram</Text>
            </View>
            {selectedSocials.instagram && (
              <TextInput
                style={[styles.input, styles.socialInput]}
                value={profile.instagram_handle || ''}
                onChangeText={(text) => setProfile(prev => ({ ...prev, instagram_handle: text }))}
                placeholder="@seu_usuario"
                placeholderTextColor="#666"
                autoCapitalize="none"
              />
            )}

            {/* Twitter */}
            <View style={styles.socialRow}>
              <Switch
                value={selectedSocials.twitter}
                onValueChange={(val) => setSelectedSocials(prev => ({ ...prev, twitter: val }))}
                trackColor={{ false: '#333', true: 'rgba(14,165,233,0.4)' }}
                thumbColor={selectedSocials.twitter ? '#0ea5e9' : '#888'}
              />
              <Text style={styles.socialLabel}>🐦 Twitter / X</Text>
            </View>
            {selectedSocials.twitter && (
              <TextInput
                style={[styles.input, styles.socialInput]}
                value={profile.twitter_handle || ''}
                onChangeText={(text) => setProfile(prev => ({ ...prev, twitter_handle: text }))}
                placeholder="@seu_usuario"
                placeholderTextColor="#666"
                autoCapitalize="none"
              />
            )}

            {/* TikTok */}
            <View style={styles.socialRow}>
              <Switch
                value={selectedSocials.tiktok}
                onValueChange={(val) => setSelectedSocials(prev => ({ ...prev, tiktok: val }))}
                trackColor={{ false: '#333', true: 'rgba(245,158,11,0.4)' }}
                thumbColor={selectedSocials.tiktok ? '#f59e0b' : '#888'}
              />
              <Text style={styles.socialLabel}>🎵 TikTok</Text>
            </View>
            {selectedSocials.tiktok && (
              <TextInput
                style={[styles.input, styles.socialInput]}
                value={profile.tiktok_handle || ''}
                onChangeText={(text) => setProfile(prev => ({ ...prev, tiktok_handle: text }))}
                placeholder="@seu_usuario"
                placeholderTextColor="#666"
                autoCapitalize="none"
              />
            )}
          </View>

          {/* Save */}
          <TouchableOpacity
            style={[styles.saveButton, saving && styles.saveDisabled]}
            onPress={handleSave}
            disabled={saving}
            activeOpacity={0.8}
          >
            {saving ? (
              <ActivityIndicator color="#000" size="small" />
            ) : (
              <Text style={styles.saveText}>💾 Salvar Perfil</Text>
            )}
          </TouchableOpacity>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0a0a0a',
  },
  loadingContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  backText: {
    fontSize: 15,
    color: '#999',
  },
  headerTitle: {
    fontSize: 22,
    fontWeight: '700',
    color: '#fff',
  },
  adminButton: {
    borderWidth: 1,
    borderColor: 'rgba(245,158,11,0.3)',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 6,
  },
  adminButtonText: {
    fontSize: 13,
    color: '#f59e0b',
    fontWeight: '600',
  },
  scrollContent: {
    padding: 16,
    paddingTop: 0,
  },
  card: {
    backgroundColor: '#1a1a2e',
    borderRadius: 20,
    padding: 24,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)',
    gap: 20,
  },
  avatarSection: {
    alignItems: 'center',
    gap: 12,
  },
  avatar: {
    width: 100,
    height: 100,
    borderRadius: 50,
    backgroundColor: 'rgba(245,158,11,0.15)',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 3,
    borderColor: 'rgba(245,158,11,0.3)',
  },
  avatarText: {
    fontSize: 32,
    fontWeight: '700',
    color: '#f59e0b',
  },
  avatarName: {
    fontSize: 18,
    fontWeight: '600',
    color: '#fff',
  },
  fieldGroup: {
    gap: 8,
  },
  label: {
    fontSize: 14,
    fontWeight: '600',
    color: '#ccc',
  },
  hint: {
    fontSize: 13,
    color: '#777',
  },
  input: {
    height: 50,
    backgroundColor: 'rgba(255,255,255,0.06)',
    borderRadius: 12,
    borderWidth: 2,
    borderColor: 'rgba(255,255,255,0.12)',
    paddingHorizontal: 16,
    fontSize: 16,
    color: '#fff',
  },
  textarea: {
    height: 90,
    paddingTop: 14,
  },
  socialRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginTop: 8,
  },
  socialLabel: {
    fontSize: 15,
    color: '#ccc',
  },
  socialInput: {
    marginLeft: 20,
  },
  saveButton: {
    height: 52,
    backgroundColor: '#f59e0b',
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 8,
  },
  saveDisabled: {
    opacity: 0.6,
  },
  saveText: {
    fontSize: 16,
    fontWeight: '700',
    color: '#000',
  },
});
