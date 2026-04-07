import React, {useState, useEffect} from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  ScrollView,
  Switch,
  Modal,
  ActivityIndicator,
  StyleSheet,
} from 'react-native';
import {SafeAreaView} from 'react-native-safe-area-context';
import {useNavigation} from '@react-navigation/native';
import type {NativeStackNavigationProp} from '@react-navigation/native-stack';
import type {RootStackParamList} from '@/navigation/AppNavigator';
import {useAuth} from '@/hooks/useAuth';
import {supabase} from '@/integrations/supabase/client';
import {useToast} from '@/hooks/use-toast';
import {AdBanner} from '@/components/AdBanner';

export interface Alarm {
  id: string;
  alarm_type: string | null;
  custom_time: string | null;
  sunrise_time: string | null;
  anticipation: number | null;
  is_active: boolean | null;
  city: string | null;
  cep: string | null;
  url: string;
  purpose: string | null;
  challenge_type: string | null;
  challenge_difficulty: string | null;
  latitude: number | null;
  longitude: number | null;
  sleep_alarm_enabled: boolean | null;
  sleep_hours: number | null;
  sleep_alert_90_url: string | null;
  sleep_alert_60_url: string | null;
  sleep_alert_30_url: string | null;
  sleep_alert_90_message: string | null;
  sleep_alert_60_message: string | null;
  sleep_alert_30_message: string | null;
  vibrate_on_alarm: boolean | null;
}

type AlarmNavigationProp = NativeStackNavigationProp<
  RootStackParamList,
  'Alarm'
>;

export default function AlarmScreen() {
  const {user} = useAuth();
  const navigation = useNavigation<AlarmNavigationProp>();
  const {toast} = useToast();
  const [alarms, setAlarms] = useState<Alarm[]>([]);
  const [loading, setLoading] = useState(true);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [deleteAlarmId, setDeleteAlarmId] = useState<string | null>(null);

  useEffect(() => {
    if (user) {
      loadAlarms();
    }
  }, [user]);

  // Reset editing state when screen comes back into focus
  useEffect(() => {
    const unsubscribe = navigation.addListener('focus', () => {
      setEditingId(null);
    });
    return unsubscribe;
  }, [navigation]);

  const loadAlarms = async () => {
    try {
      const {data, error} = await supabase
        .from('alarms')
        .select('*')
        .eq('user_id', user!.id)
        .order('created_at', {ascending: false});

      if (error) throw error;
      setAlarms(data || []);
    } catch (error: any) {
      toast({
        type: 'error',
        text1: 'Erro ao carregar alarmes',
        text2: error.message,
      });
    } finally {
      setLoading(false);
    }
  };

  const handleToggleActive = async (alarm: Alarm) => {
    try {
      const newIsActive = !alarm.is_active;
      const {error} = await supabase
        .from('alarms')
        .update({is_active: newIsActive})
        .eq('id', alarm.id);

      if (error) throw error;

      setAlarms(prev =>
        prev.map(a => (a.id === alarm.id ? {...a, is_active: newIsActive} : a)),
      );

      toast({
        type: 'success',
        text1: newIsActive ? 'Alarme ativado' : 'Alarme desativado',
        text2: newIsActive
          ? 'O alarme foi ativado com sucesso.'
          : 'O alarme foi desativado.',
      });
    } catch (error: any) {
      toast({
        type: 'error',
        text1: 'Erro ao atualizar alarme',
        text2: error.message,
      });
    }
  };

  const handleDelete = async () => {
    if (!deleteAlarmId) return;

    try {
      const {error} = await supabase
        .from('alarms')
        .delete()
        .eq('id', deleteAlarmId);

      if (error) throw error;

      setAlarms(prev => prev.filter(a => a.id !== deleteAlarmId));

      toast({
        type: 'success',
        text1: 'Alarme excluído',
        text2: 'O alarme foi excluído com sucesso.',
      });
    } catch (error: any) {
      toast({
        type: 'error',
        text1: 'Erro ao excluir alarme',
        text2: error.message,
      });
    } finally {
      setDeleteAlarmId(null);
    }
  };

  const getAlarmTime = (alarm: Alarm) => {
    if (alarm.alarm_type === 'manual' && alarm.custom_time) {
      const timeParts = alarm.custom_time.split(':');
      return `${timeParts[0]}:${timeParts[1]}`;
    }

    if (alarm.sunrise_time) {
      const time = new Date(alarm.sunrise_time);
      if (alarm.anticipation) {
        time.setMinutes(time.getMinutes() - alarm.anticipation);
      }
      return time.toLocaleTimeString('pt-BR', {
        hour: '2-digit',
        minute: '2-digit',
      });
    }

    return '--:--';
  };

  const getAlarmLabel = (alarm: Alarm) => {
    if (alarm.alarm_type === 'manual') {
      return 'Manual';
    }
    return alarm.city || 'Solar';
  };

  const getChallengeLabel = (type: string) => {
    if (type === 'math') return 'Matemática';
    if (type === 'memory') return 'Memória';
    return 'Passos';
  };

  if (loading) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#f59e0b" />
          <Text style={styles.loadingText}>Carregando...</Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity
          style={styles.headerButton}
          onPress={() => navigation.navigate('Home')}>
          <Text style={styles.headerButtonText}>←</Text>
        </TouchableOpacity>

        <Text style={styles.headerTitle}>Meus Despertadores</Text>

        <TouchableOpacity
          style={styles.headerButton}
          onPress={() => navigation.navigate('Home')}>
          <Text style={styles.headerButtonPlus}>+</Text>
        </TouchableOpacity>
      </View>

      <ScrollView contentContainerStyle={styles.scrollContent}>
        {/* Empty State */}
        {alarms.length === 0 ? (
          <View style={styles.emptyCard}>
            <View style={styles.emptyIconCircle}>
              <Text style={styles.emptyIcon}>⏰</Text>
            </View>
            <Text style={styles.emptyTitle}>Seu primeiro despertar perfeito</Text>
            <Text style={styles.emptySubtitle}>
              Crie um alarme agora e comece a acordar no ritmo do sol.
            </Text>
            <TouchableOpacity
              style={styles.createButton}
              onPress={() => navigation.navigate('Home')}
              activeOpacity={0.8}>
              <Text style={styles.createButtonText}>+ Criar Despertador</Text>
            </TouchableOpacity>
          </View>
        ) : (
          /* Alarms List */
          <View style={styles.alarmsList}>
            {alarms.map(alarm => (
              <View
                key={alarm.id}
                style={[
                  styles.alarmCard,
                  !alarm.is_active && styles.alarmCardInactive,
                ]}>
                <View style={styles.alarmRow}>
                  {/* Toggle Switch */}
                  <Switch
                    value={alarm.is_active || false}
                    onValueChange={() => handleToggleActive(alarm)}
                    trackColor={{false: '#333', true: 'rgba(245,158,11,0.4)'}}
                    thumbColor={alarm.is_active ? '#f59e0b' : '#888'}
                  />

                  {/* Time and Info */}
                  <View style={styles.alarmInfo}>
                    <View style={styles.alarmTimeRow}>
                      <Text style={styles.alarmTypeIcon}>
                        {alarm.alarm_type === 'solar' ? '☀️' : '🕐'}
                      </Text>
                      <Text style={styles.alarmTime}>
                        {getAlarmTime(alarm)}
                      </Text>
                    </View>
                    <View style={styles.alarmLabelsRow}>
                      <Text style={styles.alarmLabel}>
                        {getAlarmLabel(alarm)}
                      </Text>
                      {alarm.sleep_alarm_enabled && (
                        <View style={styles.badge}>
                          <Text style={styles.badgeText}>
                            🌙 {alarm.sleep_hours}h sono
                          </Text>
                        </View>
                      )}
                      {alarm.challenge_type &&
                        alarm.challenge_type !== 'none' && (
                          <View style={styles.challengeBadge}>
                            <Text style={styles.challengeBadgeText}>
                              {getChallengeLabel(alarm.challenge_type)}
                            </Text>
                          </View>
                        )}
                    </View>
                  </View>

                  {/* Action Buttons */}
                  <View style={styles.actionButtons}>
                    <TouchableOpacity
                      style={styles.actionButton}
                      disabled={editingId === alarm.id}
                      onPress={() => {
                        setEditingId(alarm.id);
                        requestAnimationFrame(() =>
                          navigation.navigate('Home', {editAlarm: alarm})
                        );
                      }}>
                      {editingId === alarm.id ? (
                        <ActivityIndicator color="#f59e0b" size="small" />
                      ) : (
                        <Text style={styles.editIcon}>✏️</Text>
                      )}
                    </TouchableOpacity>
                    <TouchableOpacity
                      style={styles.actionButton}
                      onPress={() => setDeleteAlarmId(alarm.id)}>
                      <Text style={styles.deleteIcon}>🗑️</Text>
                    </TouchableOpacity>
                  </View>
                </View>
              </View>
            ))}
          </View>
        )}

        {/* Info Card */}
        {alarms.length > 0 && (
          <View style={styles.infoCard}>
            <Text style={styles.infoText}>
              Os alarmes funcionam mesmo com o app em segundo plano.
            </Text>
          </View>
        )}
        <AdBanner />
      </ScrollView>

      {/* Delete Confirmation Modal */}
      <Modal
        visible={!!deleteAlarmId}
        transparent
        animationType="fade"
        onRequestClose={() => setDeleteAlarmId(null)}>
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>Excluir despertador?</Text>
            <Text style={styles.modalDescription}>
              Deseja realmente excluir esse despertador? Esta ação não pode ser
              desfeita.
            </Text>
            <View style={styles.modalButtons}>
              <TouchableOpacity
                style={styles.modalCancelButton}
                onPress={() => setDeleteAlarmId(null)}>
                <Text style={styles.modalCancelText}>Cancelar</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.modalDeleteButton}
                onPress={handleDelete}>
                <Text style={styles.modalDeleteText}>Excluir</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
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
    gap: 12,
  },
  loadingText: {
    color: '#999',
    fontSize: 15,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  headerButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerButtonText: {
    fontSize: 22,
    color: '#fff',
  },
  headerButtonPlus: {
    fontSize: 26,
    color: '#f59e0b',
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: '#fff',
  },
  scrollContent: {
    padding: 16,
    paddingTop: 0,
    gap: 16,
  },
  emptyCard: {
    backgroundColor: '#1a1a2e',
    borderRadius: 16,
    padding: 32,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)',
  },
  emptyIconCircle: {
    width: 88,
    height: 88,
    borderRadius: 44,
    backgroundColor: 'rgba(245,158,11,0.15)',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 16,
  },
  emptyIcon: {
    fontSize: 50,
  },
  emptyTitle: {
    fontSize: 17,
    fontWeight: '600',
    color: '#fff',
    marginBottom: 8,
  },
  emptySubtitle: {
    fontSize: 14,
    color: '#999',
    marginBottom: 20,
    textAlign: 'center',
  },
  createButton: {
    backgroundColor: '#f59e0b',
    borderRadius: 10,
    paddingHorizontal: 20,
    paddingVertical: 12,
  },
  createButtonText: {
    fontSize: 15,
    fontWeight: '700',
    color: '#000',
  },
  alarmsList: {
    gap: 12,
  },
  alarmCard: {
    backgroundColor: '#1a1a2e',
    borderRadius: 14,
    padding: 16,
    borderWidth: 1,
    borderColor: 'rgba(245,158,11,0.3)',
    borderLeftWidth: 3,
    borderLeftColor: '#f59e0b',
  },
  alarmCardInactive: {
    opacity: 0.5,
    borderColor: 'rgba(255,255,255,0.08)',
  },
  alarmRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
  },
  alarmInfo: {
    flex: 1,
  },
  alarmTimeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  alarmTypeIcon: {
    fontSize: 16,
  },
  alarmTime: {
    fontSize: 28,
    fontWeight: '700',
    color: '#fff',
    letterSpacing: -1,
  },
  alarmLabelsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginTop: 4,
    flexWrap: 'wrap',
  },
  alarmLabel: {
    fontSize: 12,
    color: '#999',
  },
  badge: {
    backgroundColor: 'rgba(99,102,241,0.1)',
    borderRadius: 4,
    paddingHorizontal: 6,
    paddingVertical: 2,
  },
  badgeText: {
    fontSize: 10,
    fontWeight: '500',
    color: '#818cf8',
  },
  challengeBadge: {
    backgroundColor: 'rgba(245,158,11,0.1)',
    borderRadius: 4,
    paddingHorizontal: 6,
    paddingVertical: 2,
  },
  challengeBadgeText: {
    fontSize: 10,
    fontWeight: '500',
    color: '#f59e0b',
  },
  actionButtons: {
    flexDirection: 'row',
    gap: 4,
  },
  actionButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
  },
  editIcon: {
    fontSize: 16,
  },
  deleteIcon: {
    fontSize: 16,
  },
  infoCard: {
    backgroundColor: 'rgba(255,255,255,0.04)',
    borderRadius: 12,
    padding: 14,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.06)',
  },
  infoText: {
    fontSize: 12,
    color: '#777',
    textAlign: 'center',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.7)',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 32,
  },
  modalContent: {
    backgroundColor: '#1a1a2e',
    borderRadius: 16,
    padding: 24,
    width: '100%',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)',
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#fff',
    marginBottom: 8,
  },
  modalDescription: {
    fontSize: 14,
    color: '#999',
    lineHeight: 20,
    marginBottom: 24,
  },
  modalButtons: {
    flexDirection: 'row',
    gap: 12,
  },
  modalCancelButton: {
    flex: 1,
    height: 44,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.15)',
  },
  modalCancelText: {
    fontSize: 15,
    fontWeight: '600',
    color: '#ccc',
  },
  modalDeleteButton: {
    flex: 1,
    height: 44,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#ef4444',
  },
  modalDeleteText: {
    fontSize: 15,
    fontWeight: '600',
    color: '#fff',
  },
});
