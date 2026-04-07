import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  ScrollView,
  ActivityIndicator,
  StyleSheet,
  Linking,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import type { RootStackParamList } from '@/navigation/AppNavigator';
import { supabase } from '@/integrations/supabase/client';

type RankingNav = NativeStackNavigationProp<RootStackParamList, 'Ranking'>;

interface RankingUser {
  user_id: string;
  full_name: string;
  avatar_url: string | null;
  instagram_handle: string | null;
  twitter_handle: string | null;
  tiktok_handle: string | null;
  streak_start: string;
  days_in_streak: number;
}

export default function RankingScreen() {
  const navigation = useNavigation<RankingNav>();
  const [loading, setLoading] = useState(true);
  const [rankings, setRankings] = useState<RankingUser[]>([]);

  useEffect(() => {
    fetchRankings();
  }, []);

  const fetchRankings = async () => {
    try {
      const { data: alarmsData, error: alarmsError } = await supabase
        .from('alarms')
        .select('user_id, created_at, updated_at, is_active')
        .eq('is_active', true)
        .order('created_at', { ascending: true });

      if (alarmsError) throw alarmsError;

      if (!alarmsData || alarmsData.length === 0) {
        setRankings([]);
        setLoading(false);
        return;
      }

      const userStreaks = new Map<string, { streak_start: string }>();

      alarmsData.forEach(alarm => {
        if (!userStreaks.has(alarm.user_id)) {
          userStreaks.set(alarm.user_id, { streak_start: alarm.created_at });
        }
      });

      const { data: profilesData, error: profilesError } = await supabase
        .rpc('get_ranking_profiles');

      if (profilesError) throw profilesError;

      const userIds = Array.from(userStreaks.keys());
      const filteredProfiles = (profilesData || []).filter(
        (profile: { id: string }) => userIds.includes(profile.id)
      );

      const now = new Date();
      const rankingData: RankingUser[] = filteredProfiles.map(
        (profile: { id: string; full_name: string; avatar_url: string | null; instagram_handle: string | null; twitter_handle: string | null; tiktok_handle: string | null }) => {
          const streak = userStreaks.get(profile.id)!;
          const streakStart = new Date(streak.streak_start);
          const days = Math.floor((now.getTime() - streakStart.getTime()) / (1000 * 60 * 60 * 24));

          return {
            user_id: profile.id,
            full_name: profile.full_name,
            avatar_url: profile.avatar_url,
            instagram_handle: profile.instagram_handle,
            twitter_handle: profile.twitter_handle,
            tiktok_handle: profile.tiktok_handle,
            streak_start: streak.streak_start,
            days_in_streak: days,
          };
        }
      );

      rankingData.sort((a, b) => b.days_in_streak - a.days_in_streak);
      setRankings(rankingData);
    } catch {
      // Rankings fetch failed silently
    } finally {
      setLoading(false);
    }
  };

  const getInitials = (name: string) => {
    return name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2);
  };

  const getRankIcon = (position: number) => {
    if (position === 0) return '🏆';
    if (position === 1) return '🥈';
    if (position === 2) return '🥉';
    return `${position + 1}`;
  };

  const getRankBorderColor = (position: number) => {
    if (position === 0) return 'rgba(234,179,8,0.4)';
    if (position === 1) return 'rgba(156,163,175,0.4)';
    if (position === 2) return 'rgba(217,119,6,0.4)';
    return 'rgba(255,255,255,0.1)';
  };

  const openSocial = (platform: string, handle: string) => {
    const clean = handle.replace('@', '');
    const urls: Record<string, string> = {
      instagram: `https://instagram.com/${clean}`,
      twitter: `https://twitter.com/${clean}`,
      tiktok: `https://tiktok.com/@${clean}`,
    };
    Linking.openURL(urls[platform]);
  };

  return (
    <SafeAreaView style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.navigate('Home')}>
          <Text style={styles.backText}>← Voltar</Text>
        </TouchableOpacity>
        <View>
          <Text style={styles.headerTitle}>🏆 Ranking Solar</Text>
          <Text style={styles.headerSubtitle}>Os guerreiros da rotina de ouro</Text>
        </View>
      </View>

      {/* Info */}
      <View style={styles.infoCard}>
        <Text style={styles.infoText}>
          Ranking mostra quem mantém o alarme solar ativo por mais tempo. Quanto mais tempo na{' '}
          <Text style={styles.infoHighlight}>rotina de ouro</Text>, maior a posição!
        </Text>
      </View>

      <ScrollView contentContainerStyle={styles.scrollContent}>
        {loading ? (
          <View style={styles.loadingContainer}>
            <ActivityIndicator size="large" color="#f59e0b" />
          </View>
        ) : rankings.length === 0 ? (
          <View style={styles.emptyCard}>
            <Text style={styles.emptyIcon}>🏆</Text>
            <Text style={styles.emptyText}>
              Nenhum participante ainda. Seja o primeiro a entrar na rotina de ouro!
            </Text>
          </View>
        ) : (
          <View style={styles.rankingList}>
            {rankings.map((user, index) => (
              <View
                key={user.user_id}
                style={[styles.rankCard, { borderColor: getRankBorderColor(index) }]}
              >
                <View style={styles.rankRow}>
                  {/* Rank Position */}
                  <View style={styles.rankPosition}>
                    <Text style={styles.rankIcon}>{getRankIcon(index)}</Text>
                  </View>

                  {/* Avatar */}
                  <View style={styles.avatar}>
                    <Text style={styles.avatarText}>{getInitials(user.full_name || 'U')}</Text>
                  </View>

                  {/* Info */}
                  <View style={styles.rankInfo}>
                    <Text style={styles.rankName} numberOfLines={1}>{user.full_name}</Text>
                    <Text style={styles.rankDays}>
                      {user.days_in_streak} {user.days_in_streak === 1 ? 'dia' : 'dias'} na rotina de ouro
                    </Text>

                    {/* Socials */}
                    <View style={styles.socialsRow}>
                      {user.instagram_handle && (
                        <TouchableOpacity onPress={() => openSocial('instagram', user.instagram_handle!)}>
                          <Text style={styles.socialIcon}>📸</Text>
                        </TouchableOpacity>
                      )}
                      {user.twitter_handle && (
                        <TouchableOpacity onPress={() => openSocial('twitter', user.twitter_handle!)}>
                          <Text style={styles.socialIcon}>🐦</Text>
                        </TouchableOpacity>
                      )}
                      {user.tiktok_handle && (
                        <TouchableOpacity onPress={() => openSocial('tiktok', user.tiktok_handle!)}>
                          <Text style={styles.socialIcon}>🎵</Text>
                        </TouchableOpacity>
                      )}
                    </View>
                  </View>
                </View>
              </View>
            ))}
          </View>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0a0a0a',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  backText: {
    fontSize: 15,
    color: '#999',
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: '#fff',
  },
  headerSubtitle: {
    fontSize: 13,
    color: '#777',
  },
  infoCard: {
    marginHorizontal: 16,
    backgroundColor: 'rgba(245,158,11,0.06)',
    borderRadius: 14,
    padding: 14,
    borderWidth: 1,
    borderColor: 'rgba(245,158,11,0.2)',
    marginBottom: 8,
  },
  infoText: {
    fontSize: 13,
    color: '#999',
    lineHeight: 20,
  },
  infoHighlight: {
    color: '#f59e0b',
    fontWeight: '600',
  },
  scrollContent: {
    padding: 16,
    paddingTop: 8,
  },
  loadingContainer: {
    paddingVertical: 60,
    alignItems: 'center',
  },
  emptyCard: {
    backgroundColor: '#1a1a2e',
    borderRadius: 16,
    padding: 32,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)',
  },
  emptyIcon: {
    fontSize: 48,
    marginBottom: 14,
  },
  emptyText: {
    fontSize: 14,
    color: '#999',
    textAlign: 'center',
    lineHeight: 22,
  },
  rankingList: {
    gap: 12,
  },
  rankCard: {
    backgroundColor: '#1a1a2e',
    borderRadius: 14,
    padding: 16,
    borderWidth: 1,
  },
  rankRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
  },
  rankPosition: {
    width: 40,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
  },
  rankIcon: {
    fontSize: 24,
  },
  avatar: {
    width: 52,
    height: 52,
    borderRadius: 26,
    backgroundColor: 'rgba(245,158,11,0.15)',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: 'rgba(245,158,11,0.3)',
  },
  avatarText: {
    fontSize: 18,
    fontWeight: '700',
    color: '#f59e0b',
  },
  rankInfo: {
    flex: 1,
  },
  rankName: {
    fontSize: 16,
    fontWeight: '600',
    color: '#fff',
  },
  rankDays: {
    fontSize: 13,
    fontWeight: '500',
    color: '#f59e0b',
    marginTop: 2,
  },
  socialsRow: {
    flexDirection: 'row',
    gap: 10,
    marginTop: 6,
  },
  socialIcon: {
    fontSize: 16,
  },
});
