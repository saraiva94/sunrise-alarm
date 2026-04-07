import React, {useState, useEffect, useRef, useReducer, useCallback} from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  ScrollView,
  Switch,
  ActivityIndicator,
  StyleSheet,
  Platform,
  KeyboardAvoidingView,
  Dimensions,
} from 'react-native';
import {SafeAreaView} from 'react-native-safe-area-context';
import {useNavigation, useRoute} from '@react-navigation/native';
import type {NativeStackNavigationProp} from '@react-navigation/native-stack';
import type {RouteProp} from '@react-navigation/native';
import type {RootStackParamList} from '@/navigation/AppNavigator';
import AsyncStorage from '@react-native-async-storage/async-storage';
import {Picker} from '@react-native-picker/picker';
import {useAuth} from '@/hooks/useAuth';
import {useSubscription} from '@/hooks/useSubscription';
import {useAudioPreview} from '@/hooks/useAudioPreview';
import {supabase} from '@/integrations/supabase/client';
import {useToast} from '@/hooks/use-toast';
import {
  getLocationFromCity,
  getLocationFromCep,
  getLocationFromQuery,
  getDeviceLocation,
} from '@/services/location';
import {getSunrise, calculateFinalAlarmTime} from '@/services/sunrise';
import {
  validateURL,
  requestNotificationPermission,
  scheduleNotification,
  isSupportedMediaUrl,
} from '@/services/alarm';
import {
  scheduleSleepAlerts,
  calculateSleepAlertTimes,
} from '@/services/sleepAlarm';
import {DEFAULT_ALARM_SOUNDS} from '@/data/defaultSounds';
import {
  brazilianStates,
  fetchCitiesByState,
  getLocationFromCepDetails,
} from '@/data/brazilianLocations';
import type {Alarm} from '@/screens/Alarm';
import {AdBanner} from '@/components/AdBanner';
import {SlotTimePicker} from '@/components/SlotTimePicker';
import {SolarSection} from '@/components/SolarSection';
import YoutubeIframe from 'react-native-youtube-iframe';

type ChallengeType = 'math' | 'memory' | 'steps';
type ChallengeDifficulty = 'easy' | 'medium' | 'hard';
type AlarmType = 'solar' | 'manual';
type SleepHours = 6 | 7 | 8 | 9;

type HomeNavigationProp = NativeStackNavigationProp<RootStackParamList, 'Home'>;
type HomeRouteProp = RouteProp<RootStackParamList, 'Home'>;

const SAVED_LOCATION_KEY = 'sunrise-alarm-saved-location';

function extractVideoId(videoUrl: string): string | null {
  const match = videoUrl.match(
    /(?:youtube\.com\/watch\?v=|youtu\.be\/)([\w-]{11})/,
  );
  return match ? match[1] : null;
}

const DEFAULT_ALERT_MESSAGES: Record<string, string> = {
  '90': '⏰ Faltam 90 minutos para dormir! Hora de começar a relaxar.',
  '60': '🌙 Faltam 60 minutos para dormir! Prepare-se para descansar.',
  '30': '😴 Faltam 30 minutos! Hora de ir para a cama.',
};

// Form state consolidated in a reducer for single-dispatch updates
interface FormState {
  alarmType: AlarmType;
  url: string;
  purpose: string;
  anticipation: boolean;
  customTime: string;
  editingAlarmId: string | null;
  selectedDefaultSound: string;
  vibrateOnAlarm: boolean;
  challengeEnabled: boolean;
  challengeType: ChallengeType;
  challengeDifficulty: ChallengeDifficulty;
  sleepAlarmEnabled: boolean;
  sleepHours: SleepHours;
  sleepAlert90Url: string;
  sleepAlert60Url: string;
  sleepAlert30Url: string;
  sleepAlert90Message: string;
  sleepAlert60Message: string;
  sleepAlert30Message: string;
}

const initialFormState: FormState = {
  alarmType: 'solar',
  url: '',
  purpose: '',
  anticipation: false,
  customTime: '06:00',
  editingAlarmId: null,
  selectedDefaultSound: 'birds',
  vibrateOnAlarm: true,
  challengeEnabled: false,
  challengeType: 'math',
  challengeDifficulty: 'easy',
  sleepAlarmEnabled: false,
  sleepHours: 8,
  sleepAlert90Url: '',
  sleepAlert60Url: '',
  sleepAlert30Url: '',
  sleepAlert90Message: DEFAULT_ALERT_MESSAGES['90'],
  sleepAlert60Message: DEFAULT_ALERT_MESSAGES['60'],
  sleepAlert30Message: DEFAULT_ALERT_MESSAGES['30'],
};

type FormAction =
  | { type: 'SET_FIELD'; field: keyof FormState; value: any }
  | { type: 'LOAD_ALARM'; payload: FormState }
  | { type: 'RESET' };

function formReducer(state: FormState, action: FormAction): FormState {
  switch (action.type) {
    case 'SET_FIELD':
      return { ...state, [action.field]: action.value };
    case 'LOAD_ALARM':
      return { ...action.payload };
    case 'RESET':
      return initialFormState;
    default:
      return state;
  }
}


export default function HomeScreen() {
  const navigation = useNavigation<HomeNavigationProp>();
  const route = useRoute<HomeRouteProp>();
  const {user} = useAuth();
  const {isPremium, isSubscribed} = useSubscription();
  const {play: previewPlay, stop: previewStop, playingId} = useAudioPreview();
  const {toast} = useToast();
  const scrollViewRef = useRef<ScrollView>(null);

  // State variables
  const [selectedState, setSelectedState] = useState('');
  const [selectedCity, setSelectedCity] = useState('');
  const [cities, setCities] = useState<string[]>([]);
  const [loadingCities, setLoadingCities] = useState(false);
  const [city, setCity] = useState('');
  const [cep, setCep] = useState('');
  const [cepStatus, setCepStatus] = useState('');

  // Form state — single reducer instead of 20+ useState = 1 re-render per dispatch
  const [form, dispatch] = useReducer(formReducer, initialFormState);
  const {
    alarmType, url, purpose, anticipation, customTime, editingAlarmId,
    selectedDefaultSound, vibrateOnAlarm, challengeEnabled, challengeType,
    challengeDifficulty, sleepAlarmEnabled, sleepHours,
    sleepAlert90Url, sleepAlert60Url, sleepAlert30Url,
    sleepAlert90Message, sleepAlert60Message, sleepAlert30Message,
  } = form;

  // Setter helpers — each dispatches a single field update
  const setField = useCallback(<K extends keyof FormState>(field: K, value: FormState[K]) => {
    dispatch({ type: 'SET_FIELD', field, value });
  }, []);

  const setAlarmType = useCallback((v: AlarmType) => setField('alarmType', v), [setField]);
  const setUrl = useCallback((v: string) => setField('url', v), [setField]);
  const setPurpose = useCallback((v: string) => setField('purpose', v), [setField]);
  const setAnticipation = useCallback((v: boolean) => setField('anticipation', v), [setField]);
  const setCustomTime = useCallback((v: string) => setField('customTime', v), [setField]);
  const setEditingAlarmId = useCallback((v: string | null) => setField('editingAlarmId', v), [setField]);
  const setSelectedDefaultSound = useCallback((v: string) => setField('selectedDefaultSound', v), [setField]);
  const setVibrateOnAlarm = useCallback((v: boolean) => setField('vibrateOnAlarm', v), [setField]);
  const setChallengeEnabled = useCallback((v: boolean) => setField('challengeEnabled', v), [setField]);
  const setChallengeType = useCallback((v: ChallengeType) => setField('challengeType', v), [setField]);
  const setChallengeDifficulty = useCallback((v: ChallengeDifficulty) => setField('challengeDifficulty', v), [setField]);
  const setSleepAlarmEnabled = useCallback((v: boolean) => setField('sleepAlarmEnabled', v), [setField]);
  const setSleepHours = useCallback((v: SleepHours) => setField('sleepHours', v), [setField]);
  const setSleepAlert90Url = useCallback((v: string) => setField('sleepAlert90Url', v), [setField]);
  const setSleepAlert60Url = useCallback((v: string) => setField('sleepAlert60Url', v), [setField]);
  const setSleepAlert30Url = useCallback((v: string) => setField('sleepAlert30Url', v), [setField]);
  const setSleepAlert90Message = useCallback((v: string) => setField('sleepAlert90Message', v), [setField]);
  const setSleepAlert60Message = useCallback((v: string) => setField('sleepAlert60Message', v), [setField]);
  const setSleepAlert30Message = useCallback((v: string) => setField('sleepAlert30Message', v), [setField]);

  // UI-only states (not part of alarm form data)
  const [loading, setLoading] = useState(false);
  const [hasPermissions, setHasPermissions] = useState(false);
  const [estimatedTime, setEstimatedTime] = useState('');
  const [loadingEstimate, setLoadingEstimate] = useState(false);
  const [saveLocation, setSaveLocation] = useState(false);
  const [isAdmin, setIsAdmin] = useState(false);
  const [permissionCardDismissed, setPermissionCardDismissed] = useState(false);
  const [sectionReady, setSectionReady] = useState(true);
  const [showPremiumModal, setShowPremiumModal] = useState(false);
  const [premiumFeatureName, setPremiumFeatureName] = useState('');

  // Validation errors
  const [validationErrors, setValidationErrors] = useState<{
    sound: string;
    location: string;
    time: string;
  }>({sound: '', location: '', time: ''});

  // Load edit alarm from route params
  useEffect(() => {
    const editAlarm = route.params?.editAlarm as Alarm | undefined;
    if (!editAlarm) return;

    // Clear params immediately to prevent re-triggering
    navigation.setParams({} as any);

    // Check if url matches a default sound
    const matchingSound = DEFAULT_ALARM_SOUNDS.find(
      s => s.url === editAlarm.url,
    );
    const resolvedUrl = matchingSound ? '' : (editAlarm.url || '');
    const resolvedSound = matchingSound ? matchingSound.id : 'birds';

    // Single dispatch = single re-render (instead of 20+ setState)
    dispatch({
      type: 'LOAD_ALARM',
      payload: {
        editingAlarmId: editAlarm.id,
        alarmType: (editAlarm.alarm_type as AlarmType) || 'solar',
        url: resolvedUrl,
        purpose: editAlarm.purpose || '',
        anticipation: !!editAlarm.anticipation,
        customTime: editAlarm.custom_time || '06:00',
        selectedDefaultSound: resolvedSound,
        vibrateOnAlarm: editAlarm.vibrate_on_alarm !== false,
        challengeEnabled: !!editAlarm.challenge_type,
        challengeType: (editAlarm.challenge_type as ChallengeType) || 'math',
        challengeDifficulty: (editAlarm.challenge_difficulty as ChallengeDifficulty) || 'easy',
        sleepAlarmEnabled: !!editAlarm.sleep_alarm_enabled,
        sleepHours: (editAlarm.sleep_hours as SleepHours) || 8,
        sleepAlert90Url: editAlarm.sleep_alert_90_url || '',
        sleepAlert60Url: editAlarm.sleep_alert_60_url || '',
        sleepAlert30Url: editAlarm.sleep_alert_30_url || '',
        sleepAlert90Message: editAlarm.sleep_alert_90_message || DEFAULT_ALERT_MESSAGES['90'],
        sleepAlert60Message: editAlarm.sleep_alert_60_message || DEFAULT_ALERT_MESSAGES['60'],
        sleepAlert30Message: editAlarm.sleep_alert_30_message || DEFAULT_ALERT_MESSAGES['30'],
      },
    });

    // Set location fields (still useState, not in form reducer)
    setCity(editAlarm.city || '');
    setCep(editAlarm.cep || '');
  }, [route.params?.editAlarm]);

  // Check admin status
  useEffect(() => {
    if (!user) return;

    const adminEmails = ['admin@sunrisealarm.com'];
    if (adminEmails.includes(user.email || '')) {
      setIsAdmin(true);
      return;
    }

    const checkAdminRole = async () => {
      try {
        const {data} = await supabase
          .from('profiles')
          .select('role')
          .eq('id', user.id)
          .single();
        if (data?.role === 'admin') {
          setIsAdmin(true);
        }
      } catch {
        // Not admin
      }
    };
    checkAdminRole();
  }, [user]);

  // Load saved location from AsyncStorage
  useEffect(() => {
    const loadSavedLocation = async () => {
      try {
        const saved = await AsyncStorage.getItem(SAVED_LOCATION_KEY);
        if (saved) {
          const parsed = JSON.parse(saved);
          if (parsed.state) setSelectedState(parsed.state);
          if (parsed.city) {
            setCity(parsed.city);
            setSelectedCity(parsed.city);
          }
          if (parsed.cep) setCep(parsed.cep);
          setSaveLocation(true);
        }
      } catch {
        // Ignore load errors
      }
    };
    loadSavedLocation();
  }, []);

  // Fetch cities when selectedState changes
  useEffect(() => {
    if (!selectedState) {
      setCities([]);
      return;
    }

    const loadCities = async () => {
      setLoadingCities(true);
      try {
        const stateInfo = brazilianStates.find(s => s.name === selectedState);
        if (stateInfo) {
          const cityList = await fetchCitiesByState(stateInfo.uf);
          setCities(cityList);
        }
      } catch {
        setCities([]);
      } finally {
        setLoadingCities(false);
      }
    };
    loadCities();
  }, [selectedState]);

  // Auto-fill from CEP with debounce
  useEffect(() => {
    const cleanCep = cep.replace(/\D/g, '');
    if (cleanCep.length !== 8) {
      setCepStatus('');
      return;
    }

    setCepStatus('Buscando...');
    const timeout = setTimeout(async () => {
      try {
        const result = await getLocationFromCepDetails(cleanCep);
        if (result) {
          setSelectedState(result.state);
          setCity(result.city);
          setSelectedCity(result.city);
          setCepStatus(`${result.city} - ${result.uf}`);
        } else {
          setCepStatus('CEP não encontrado');
        }
      } catch {
        setCepStatus('Erro ao buscar CEP');
      }
    }, 800);

    return () => clearTimeout(timeout);
  }, [cep]);

  // Fetch sunrise estimate with debounce
  useEffect(() => {
    if (alarmType !== 'solar' || (!city && !selectedState)) {
      setEstimatedTime('');
      return;
    }

    const timeout = setTimeout(async () => {
      setLoadingEstimate(true);
      try {
        const location = await getLocationFromQuery({ city: city || undefined, state: selectedState || undefined });
        const sunriseData = await getSunrise(location.coordinates);
        const finalTime = calculateFinalAlarmTime(
          sunriseData.sunrise,
          anticipation ? 15 : 0,
        );
        setEstimatedTime(
          finalTime.toLocaleTimeString('pt-BR', {
            hour: '2-digit',
            minute: '2-digit',
          }),
        );
      } catch {
        setEstimatedTime('');
      } finally {
        setLoadingEstimate(false);
      }
    }, 1000);

    return () => clearTimeout(timeout);
  }, [city, selectedState, anticipation, alarmType]);

  // Clear validation errors when inputs change
  useEffect(() => {
    setValidationErrors({sound: '', location: '', time: ''});
  }, [url, selectedDefaultSound, city, cep, customTime, alarmType]);

  // Check permissions on mount
  useEffect(() => {
    checkPermissions();
  }, []);

  const checkPermissions = async () => {
    const granted = await requestNotificationPermission();
    setHasPermissions(granted);
  };

  const requestPermissions = async () => {
    const granted = await requestNotificationPermission();
    setHasPermissions(granted);
    if (granted) {
      toast({
        type: 'success',
        text1: 'Permissões concedidas',
        text2: 'Notificações ativadas!',
      });
    } else {
      toast({
        type: 'error',
        text1: 'Permissão negada',
        text2: 'Ative as notificações nas configurações do dispositivo.',
      });
    }
  };

  const handleUseCurrentLocation = async () => {
    try {
      setLoadingEstimate(true);
      const location = await getDeviceLocation();
      if (location.city) {
        setCity(location.city);
        setSelectedCity(location.city);
      }
      if (location.state) {
        setSelectedState(location.state);
      }
      if (location.uf) {
        const stateInfo = brazilianStates.find(s => s.uf === location.uf);
        if (stateInfo) {
          setSelectedState(stateInfo.name);
        }
      }
      toast({
        type: 'success',
        text1: 'Localização obtida',
        text2: location.city || 'Coordenadas obtidas',
      });
    } catch (error: any) {
      toast({
        type: 'error',
        text1: 'Erro de localização',
        text2: error.message,
      });
    } finally {
      setLoadingEstimate(false);
    }
  };

  const handleSaveLocationToggle = async (value: boolean) => {
    setSaveLocation(value);
    if (!value) {
      try {
        await AsyncStorage.removeItem(SAVED_LOCATION_KEY);
      } catch {
        // Ignore
      }
    }
  };

  const handleSaveAlarm = async () => {
    if (!user) {
      toast({
        type: 'error',
        text1: 'Erro',
        text2: 'Você precisa estar logado.',
      });
      return;
    }

    // Validate
    const errors = {sound: '', location: '', time: ''};
    let hasErrors = false;

    // Sound validation — alarm sound is always required
    const selectedSound = DEFAULT_ALARM_SOUNDS.find(s => s.id === selectedDefaultSound);
    const alarmSoundUrl = selectedSound?.isLocal
      ? selectedSound.localFile!
      : selectedSound?.url || '';

    if (!selectedDefaultSound || !alarmSoundUrl) {
      errors.sound = 'Selecione um som de alarme.';
      hasErrors = true;
    }

    // YouTube/video URL validation (optional)
    if (url && !validateURL(url)) {
      errors.sound = 'URL de vídeo inválida.';
      hasErrors = true;
    }

    // finalUrl: YouTube URL if present, otherwise the alarm sound URL
    const finalUrl = url && validateURL(url) ? url : (selectedSound?.isLocal ? '' : alarmSoundUrl);

    // Location validation (solar only) — accepts state, city, or CEP
    if (alarmType === 'solar' && !selectedState && !city && !cep) {
      errors.location = 'Informe um estado, cidade ou CEP.';
      hasErrors = true;
    }

    // Time validation (manual only)
    if (alarmType === 'manual') {
      const timeRegex = /^([01]\d|2[0-3]):([0-5]\d)$/;
      if (!timeRegex.test(customTime)) {
        errors.time = 'Horário inválido. Use o formato HH:MM.';
        hasErrors = true;
      }
    }

    if (hasErrors) {
      setValidationErrors(errors);
      scrollViewRef.current?.scrollTo({y: 0, animated: true});
      return;
    }

    setLoading(true);

    try {
      let alarmTime: Date;
      let sunriseTimeStr: string | null = null;
      let latitude: number | null = null;
      let longitude: number | null = null;

      if (alarmType === 'solar') {
        // Get coordinates — most precise source first
        let location;
        if (cep) {
          location = await getLocationFromCep(cep);
        } else if (city) {
          location = await getLocationFromQuery({ city, state: selectedState });
        } else if (selectedState) {
          location = await getLocationFromQuery({ state: selectedState });
        } else {
          throw new Error('Localização não informada');
        }

        latitude = location.coordinates.latitude;
        longitude = location.coordinates.longitude;

        const sunriseData = await getSunrise(location.coordinates);
        sunriseTimeStr = sunriseData.sunrise.toISOString();
        alarmTime = calculateFinalAlarmTime(
          sunriseData.sunrise,
          anticipation ? 15 : 0,
        );

        // If today's sunrise already passed, schedule for tomorrow
        if (alarmTime.getTime() <= Date.now()) {
          alarmTime.setDate(alarmTime.getDate() + 1);
        }
      } else {
        // Manual time
        const [hours, minutes] = customTime.split(':').map(Number);
        alarmTime = new Date();
        alarmTime.setHours(hours, minutes, 0, 0);

        // If time already passed today, set for tomorrow
        if (alarmTime.getTime() <= Date.now()) {
          alarmTime.setDate(alarmTime.getDate() + 1);
        }
      }

      // Schedule notification
      const notificationId = await scheduleNotification(
        alarmTime,
        finalUrl,
        purpose,
        challengeEnabled ? challengeType : null,
        challengeEnabled ? challengeDifficulty : null,
        challengeEnabled,
        alarmSoundUrl,
        vibrateOnAlarm,
      );

      // Schedule sleep alerts if enabled
      let sleepNotificationIds: string[] = [];
      if (sleepAlarmEnabled) {
        const alertTimes = calculateSleepAlertTimes(
          alarmTime,
          sleepHours,
          anticipation,
        );
        const alerts = [];

        if (alertTimes.alert90.getTime() > Date.now()) {
          alerts.push({
            time: alertTimes.alert90,
            url: sleepAlert90Url || finalUrl,
            message: sleepAlert90Message,
            alertType: '90' as const,
          });
        }
        if (alertTimes.alert60.getTime() > Date.now()) {
          alerts.push({
            time: alertTimes.alert60,
            url: sleepAlert60Url || finalUrl,
            message: sleepAlert60Message,
            alertType: '60' as const,
          });
        }
        if (alertTimes.alert30.getTime() > Date.now()) {
          alerts.push({
            time: alertTimes.alert30,
            url: sleepAlert30Url || finalUrl,
            message: sleepAlert30Message,
            alertType: '30' as const,
          });
        }

        if (alerts.length > 0) {
          sleepNotificationIds = await scheduleSleepAlerts(alerts);
        }
      }

      // Save to Supabase
      const alarmData = {
        user_id: user.id,
        alarm_type: alarmType,
        custom_time: alarmType === 'manual' ? customTime : null,
        sunrise_time: sunriseTimeStr,
        anticipation: anticipation ? 15 : 0,
        is_active: true,
        city: city || null,
        cep: cep || null,
        url: finalUrl,
        purpose: purpose || null,
        challenge_type: challengeEnabled ? challengeType : null,
        challenge_difficulty: challengeEnabled ? challengeDifficulty : null,
        latitude,
        longitude,
        sleep_alarm_enabled: sleepAlarmEnabled,
        sleep_hours: sleepAlarmEnabled ? sleepHours : null,
        sleep_alert_90_url: sleepAlarmEnabled ? sleepAlert90Url || null : null,
        sleep_alert_60_url: sleepAlarmEnabled ? sleepAlert60Url || null : null,
        sleep_alert_30_url: sleepAlarmEnabled ? sleepAlert30Url || null : null,
        sleep_alert_90_message: sleepAlarmEnabled ? sleepAlert90Message : null,
        sleep_alert_60_message: sleepAlarmEnabled ? sleepAlert60Message : null,
        sleep_alert_30_message: sleepAlarmEnabled ? sleepAlert30Message : null,
        vibrate_on_alarm: vibrateOnAlarm,
      };

      if (editingAlarmId) {
        const {error} = await supabase
          .from('alarms')
          .update(alarmData)
          .eq('id', editingAlarmId);
        if (error) throw error;
      } else {
        const {error} = await supabase.from('alarms').insert(alarmData);
        if (error) throw error;
      }

      // Save location if toggle is on
      if (saveLocation && (city || cep || selectedState)) {
        await AsyncStorage.setItem(
          SAVED_LOCATION_KEY,
          JSON.stringify({state: selectedState, city, cep}),
        );
      }

      // Save notification IDs for cancellation later
      await AsyncStorage.setItem(
        'sunrise-alarm-notification-id',
        JSON.stringify({
          alarmNotificationId: notificationId,
          sleepNotificationIds,
        }),
      );

      toast({
        type: 'success',
        text1: editingAlarmId ? 'Alarme atualizado!' : 'Alarme ativado!',
        text2: `Despertador configurado para ${alarmTime.toLocaleTimeString(
          'pt-BR',
          {
            hour: '2-digit',
            minute: '2-digit',
          },
        )}`,
      });

      navigation.navigate('Alarm');
    } catch (error: any) {
      toast({
        type: 'error',
        text1: 'Erro ao salvar alarme',
        text2: error.message,
      });
    } finally {
      setLoading(false);
    }
  };

  const requirePremium = (feature: string) => {
    if (!isPremium && !isSubscribed) {
      setPremiumFeatureName(feature);
      setShowPremiumModal(true);
      return true;
    }
    return false;
  };

  return (
    <SafeAreaView style={styles.container}>
      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
        <ScrollView
          ref={scrollViewRef}
          contentContainerStyle={styles.scrollContent}
          keyboardShouldPersistTaps="handled">
          {/* ===== HEADER ===== */}
          <View style={styles.headerRow}>
            <View style={styles.headerLeft}>
              <Text style={styles.sunEmoji}>☀️</Text>
              <Text style={styles.headerTitle}>Alarme Solar</Text>
              {isPremium && (
                <View style={styles.premiumBadge}>
                  <Text style={styles.premiumBadgeText}>👑 Premium</Text>
                </View>
              )}
            </View>
            <View style={styles.headerNav}>
              <TouchableOpacity
                style={styles.navButton}
                onPress={() => navigation.navigate('Ranking')}>
                <Text style={styles.navButtonText}>Ranking</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.navButton}
                onPress={() => navigation.navigate('Alarm')}>
                <Text style={styles.navButtonText}>Alarmes</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.navButton}
                onPress={() => navigation.navigate('Profile')}>
                <Text style={styles.navButtonText}>Perfil</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.navButton}
                onPress={() => navigation.navigate('Plans')}>
                <Text style={styles.navButtonText}>Planos</Text>
              </TouchableOpacity>
              {isAdmin && (
                <TouchableOpacity
                  style={styles.navButton}
                  onPress={() => navigation.navigate('Admin')}>
                  <Text style={[styles.navButtonText, {color: '#f59e0b'}]}>
                    Admin
                  </Text>
                </TouchableOpacity>
              )}
            </View>
          </View>

          {/* ===== PERMISSIONS CARD ===== */}
          {!hasPermissions && !permissionCardDismissed && (
            <View style={styles.card}>
              <View style={styles.permissionRow}>
                <Text style={styles.permissionIcon}>🔔</Text>
                <View style={styles.permissionTextWrap}>
                  <Text style={styles.permissionTitle}>
                    Permissões de Notificação
                  </Text>
                  <Text style={styles.permissionDesc}>
                    Ative as notificações para que o alarme funcione
                    corretamente.
                  </Text>
                </View>
              </View>
              <View style={styles.permissionActions}>
                <TouchableOpacity
                  style={styles.primaryButton}
                  onPress={requestPermissions}>
                  <Text style={styles.primaryButtonText}>
                    Ativar Notificações
                  </Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={styles.secondaryButton}
                  onPress={() => setPermissionCardDismissed(true)}>
                  <Text style={styles.secondaryButtonText}>Depois</Text>
                </TouchableOpacity>
              </View>
            </View>
          )}

          {/* ===== MAIN FORM CARD ===== */}
          <View style={styles.card}>
            <Text style={styles.cardTitle}>
              {editingAlarmId ? 'Editar Despertador' : 'Configurar Despertador'}
            </Text>

            {/* ===== ALARM TYPE SELECTION ===== */}
            <Text style={styles.sectionLabel}>Tipo de Alarme</Text>
            <View style={styles.alarmTypeRow}>
              <TouchableOpacity
                style={[
                  styles.alarmTypeCard,
                  alarmType === 'solar' && styles.alarmTypeCardSelected,
                ]}
                onPress={() => {
                  if (alarmType === 'solar') return;
                  setSectionReady(false);
                  setAlarmType('solar');
                  setTimeout(() => setSectionReady(true), 50);
                }}
                activeOpacity={0.7}>
                <Text style={styles.alarmTypeIcon}>☀️</Text>
                <Text
                  style={[
                    styles.alarmTypeText,
                    alarmType === 'solar' && styles.alarmTypeTextSelected,
                  ]}>
                  Solar
                </Text>
                <Text style={styles.alarmTypeDesc}>Nascer do sol</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[
                  styles.alarmTypeCard,
                  alarmType === 'manual' && styles.alarmTypeCardSelected,
                ]}
                onPress={() => {
                  if (alarmType === 'manual') return;
                  setSectionReady(false);
                  setAlarmType('manual');
                  setTimeout(() => setSectionReady(true), 50);
                }}
                activeOpacity={0.7}>
                <Text style={styles.alarmTypeIcon}>🕐</Text>
                <Text
                  style={[
                    styles.alarmTypeText,
                    alarmType === 'manual' && styles.alarmTypeTextSelected,
                  ]}>
                  Manual
                </Text>
                <Text style={styles.alarmTypeDesc}>Horário fixo</Text>
              </TouchableOpacity>
            </View>

            {/* ===== SECTION LOADING ===== */}
            {!sectionReady && (
              <ActivityIndicator color="#f59e0b" style={{marginVertical: 24}} />
            )}

            {/* ===== SOLAR SECTION ===== */}
            {alarmType === 'solar' && sectionReady && (
              <SolarSection
                anticipation={anticipation}
                setAnticipation={setAnticipation}
                sleepAlarmEnabled={sleepAlarmEnabled}
                setSleepAlarmEnabled={setSleepAlarmEnabled}
                sleepHours={sleepHours}
                setSleepHours={setSleepHours}
                selectedState={selectedState}
                setSelectedState={setSelectedState}
                selectedCity={selectedCity}
                setSelectedCity={setSelectedCity}
                setCity={setCity}
                cities={cities}
                loadingCities={loadingCities}
                cep={cep}
                setCep={setCep}
                cepStatus={cepStatus}
                validationErrors={validationErrors}
                handleUseCurrentLocation={handleUseCurrentLocation}
                loadingEstimate={loadingEstimate}
                estimatedTime={estimatedTime}
              />
            )}

            {/* ===== MANUAL SECTION ===== */}
            {alarmType === 'manual' && sectionReady && (
              <View>
                <Text style={styles.sectionLabel}>🕐 Horário</Text>
                {validationErrors.time ? (
                  <Text style={styles.errorText}>
                    {validationErrors.time}
                  </Text>
                ) : null}
                <SlotTimePicker
                  value={customTime}
                  onChange={setCustomTime}
                />

                {/* Preview card */}
                <View style={[styles.estimateCard, {marginTop: 14}]}>
                  <Text style={styles.estimateLabel}>
                    Alarme configurado para
                  </Text>
                  <Text style={styles.estimateTime}>🕐 {customTime}</Text>
                </View>
              </View>
            )}

            {/* ===== SOUND SECTION ===== */}
            <View style={styles.sectionDivider} />
            <Text style={styles.sectionLabel}>🔊 Som do Alarme</Text>

            {validationErrors.sound ? (
              <Text style={styles.errorText}>{validationErrors.sound}</Text>
            ) : null}

            {/* Default Sounds Grid */}
            <View style={styles.soundsGrid}>
              {DEFAULT_ALARM_SOUNDS.map(sound => (
                <TouchableOpacity
                  key={sound.id}
                  style={[
                    styles.soundCard,
                    selectedDefaultSound === sound.id &&
                      styles.soundCardSelected,
                  ]}
                  onPress={() => {
                    setSelectedDefaultSound(sound.id);
                    previewPlay(sound.id, sound.isLocal ? sound.localFile! : sound.url, 3000, sound.isLocal);
                  }}
                  activeOpacity={0.7}>
                  <Text style={styles.soundIcon}>{sound.icon}</Text>
                  <Text
                    style={[
                      styles.soundName,
                      selectedDefaultSound === sound.id &&
                        styles.soundNameSelected,
                    ]}
                    numberOfLines={2}>
                    {sound.name}
                  </Text>
                  {playingId === sound.id && (
                    <Text style={styles.playingIndicator}>▶</Text>
                  )}
                </TouchableOpacity>
              ))}
            </View>

            {/* Custom URL (Premium) */}
            <View style={styles.fieldGroup}>
              <Text style={styles.label}>
                🔗 URL do YouTube / Vídeo (opcional) {!isPremium && '👑'}
              </Text>
              <TextInput
                style={styles.input}
                value={url}
                onChangeText={text => {
                  if (requirePremium('URL personalizada')) return;
                  setUrl(text);
                }}
                placeholder="https://youtube.com/watch?v=..."
                placeholderTextColor="#666"
                autoCapitalize="none"
                autoCorrect={false}
                editable={isPremium || isSubscribed}
              />
              {url && validateURL(url) && (
                <Text style={styles.hintText}>
                  {isSupportedMediaUrl(url).supported
                    ? `✅ ${isSupportedMediaUrl(url).platform} — tocará após iniciar o vídeo`
                    : '⚠️ Plataforma não verificada'}
                </Text>
              )}
              {url && extractVideoId(url) && (
                <View style={styles.youtubePreview}>
                  <Text style={styles.youtubePreviewLabel}>📺 Preview do vídeo</Text>
                  <YoutubeIframe
                    height={200}
                    width={Dimensions.get('window').width - 48}
                    videoId={extractVideoId(url)!}
                    play={false}
                    initialPlayerParams={{controls: true}}
                  />
                </View>
              )}
            </View>

            {/* ===== PURPOSE SECTION ===== */}
            <View style={styles.sectionDivider} />
            <Text style={styles.sectionLabel}>❤️ Propósito</Text>
            <View style={styles.fieldGroup}>
              <TextInput
                style={[styles.input, styles.textArea]}
                value={purpose}
                onChangeText={setPurpose}
                placeholder="Por que você quer acordar cedo? (opcional)"
                placeholderTextColor="#666"
                multiline
                numberOfLines={3}
                textAlignVertical="top"
              />
            </View>

            {/* ===== CHALLENGE SECTION ===== */}
            <View style={styles.sectionDivider} />
            <Text style={styles.sectionLabel}>🛡️ Desafio para Desligar</Text>
            <View style={styles.switchRow}>
              <View style={styles.switchTextWrap}>
                <Text style={styles.switchLabel}>Ativar desafio</Text>
                <Text style={styles.switchDesc}>
                  Resolva um desafio para desligar o alarme
                </Text>
              </View>
              <Switch
                value={challengeEnabled}
                onValueChange={setChallengeEnabled}
                trackColor={{false: '#333', true: 'rgba(245,158,11,0.4)'}}
                thumbColor={challengeEnabled ? '#f59e0b' : '#888'}
              />
            </View>

            {challengeEnabled && (
              <>
                {/* Challenge Type */}
                <Text style={styles.label}>Tipo de desafio</Text>
                <View style={styles.optionsRow}>
                  {(
                    [
                      {value: 'math', label: 'Matemática', icon: '🧮'},
                      {value: 'memory', label: 'Memória', icon: '🧠'},
                      {value: 'steps', label: 'Passos', icon: '🚶'},
                    ] as {value: ChallengeType; label: string; icon: string}[]
                  ).map(opt => (
                    <TouchableOpacity
                      key={opt.value}
                      style={[
                        styles.optionChip,
                        challengeType === opt.value &&
                          styles.optionChipSelected,
                      ]}
                      onPress={() => setChallengeType(opt.value)}>
                      <Text style={styles.optionChipIcon}>{opt.icon}</Text>
                      <Text
                        style={[
                          styles.optionChipText,
                          challengeType === opt.value &&
                            styles.optionChipTextSelected,
                        ]}>
                        {opt.label}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </View>

                {/* Challenge Difficulty */}
                <Text style={styles.label}>Dificuldade</Text>
                <View style={styles.optionsRow}>
                  {(
                    [
                      {value: 'easy', label: 'Fácil'},
                      {value: 'medium', label: 'Médio'},
                      {value: 'hard', label: 'Difícil'},
                    ] as {value: ChallengeDifficulty; label: string}[]
                  ).map(opt => (
                    <TouchableOpacity
                      key={opt.value}
                      style={[
                        styles.optionChip,
                        challengeDifficulty === opt.value &&
                          styles.optionChipSelected,
                      ]}
                      onPress={() => setChallengeDifficulty(opt.value)}>
                      <Text
                        style={[
                          styles.optionChipText,
                          challengeDifficulty === opt.value &&
                            styles.optionChipTextSelected,
                        ]}>
                        {opt.label}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </View>
              </>
            )}

            {/* ===== VIBRATION TOGGLE ===== */}
            <View style={styles.switchRow}>
              <View style={styles.switchTextWrap}>
                <Text style={styles.switchLabel}>Vibrar ao despertar</Text>
                <Text style={styles.switchDesc}>
                  Vibrar o celular quando o alarme tocar
                </Text>
              </View>
              <Switch
                value={vibrateOnAlarm}
                onValueChange={setVibrateOnAlarm}
                trackColor={{false: '#333', true: 'rgba(245,158,11,0.4)'}}
                thumbColor={vibrateOnAlarm ? '#f59e0b' : '#888'}
              />
            </View>

            {/* ===== SAVE LOCATION TOGGLE ===== */}
            <View style={styles.sectionDivider} />
            <View style={styles.switchRow}>
              <View style={styles.switchTextWrap}>
                <Text style={styles.switchLabel}>Salvar localização</Text>
                <Text style={styles.switchDesc}>
                  Lembrar sua cidade para próxima vez
                </Text>
              </View>
              <Switch
                value={saveLocation}
                onValueChange={handleSaveLocationToggle}
                trackColor={{false: '#333', true: 'rgba(245,158,11,0.4)'}}
                thumbColor={saveLocation ? '#f59e0b' : '#888'}
              />
            </View>

            {/* ===== SUBMIT BUTTON ===== */}
            <TouchableOpacity
              style={[styles.submitButton, loading && styles.buttonDisabled]}
              onPress={handleSaveAlarm}
              disabled={loading}
              activeOpacity={0.8}>
              {loading ? (
                <ActivityIndicator color="#000" size="small" />
              ) : (
                <Text style={styles.submitButtonText}>
                  {editingAlarmId ? 'Salvar Alterações' : 'Ativar Despertador'}
                </Text>
              )}
            </TouchableOpacity>
          </View>
          <AdBanner />
        </ScrollView>
      </KeyboardAvoidingView>

      {/* ===== PREMIUM MODAL ===== */}
      {showPremiumModal && (
        <View style={styles.modalOverlay}>
          <View style={styles.modalCard}>
            <Text style={styles.modalIcon}>👑</Text>
            <Text style={styles.modalTitle}>Recurso Premium</Text>
            <Text style={styles.modalDesc}>
              "{premiumFeatureName}" é um recurso exclusivo para assinantes
              Premium.
            </Text>
            <TouchableOpacity
              style={styles.primaryButton}
              onPress={() => {
                setShowPremiumModal(false);
                navigation.navigate('Plans');
              }}>
              <Text style={styles.primaryButtonText}>Ver Planos</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.secondaryButton}
              onPress={() => setShowPremiumModal(false)}>
              <Text style={styles.secondaryButtonText}>Fechar</Text>
            </TouchableOpacity>
          </View>
        </View>
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  flex: {
    flex: 1,
  },
  container: {
    flex: 1,
    backgroundColor: '#0a0a0a',
  },
  scrollContent: {
    padding: 16,
    paddingBottom: 40,
  },

  // Header
  headerRow: {
    backgroundColor: '#0a0a1a',
    borderRadius: 14,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
    padding: 12,
    marginBottom: 16,
  },
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
  },
  sunEmoji: {
    fontSize: 24,
    marginRight: 8,
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: '#fff',
    marginRight: 8,
  },
  premiumBadge: {
    backgroundColor: 'rgba(245,158,11,0.2)',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: 'rgba(245,158,11,0.4)',
  },
  premiumBadgeText: {
    fontSize: 11,
    color: '#f59e0b',
    fontWeight: '600',
  },
  headerNav: {
    flexDirection: 'row',
    justifyContent: 'space-evenly',
    width: '100%',
    paddingHorizontal: 8,
  },
  navButton: {
    backgroundColor: 'rgba(255,255,255,0.06)',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: 'rgba(245,158,11,0.3)',
  },
  navButtonText: {
    color: '#ccc',
    fontSize: 13,
    fontWeight: '500',
  },

  // Card
  card: {
    backgroundColor: '#1a1a2e',
    borderRadius: 16,
    padding: 20,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)',
    marginBottom: 16,
  },
  cardTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: '#fff',
    marginBottom: 20,
    textAlign: 'center',
  },

  // Sections
  sectionLabel: {
    fontSize: 16,
    fontWeight: '600',
    color: '#fff',
    marginBottom: 12,
    marginTop: 4,
  },
  sectionDivider: {
    height: 1,
    backgroundColor: 'rgba(255,255,255,0.08)',
    marginVertical: 20,
  },

  // Alarm Type
  alarmTypeRow: {
    flexDirection: 'row',
    gap: 12,
    marginBottom: 16,
  },
  alarmTypeCard: {
    flex: 1,
    backgroundColor: 'rgba(255,255,255,0.05)',
    borderRadius: 12,
    padding: 16,
    alignItems: 'center',
    borderWidth: 2,
    borderColor: 'rgba(255,255,255,0.1)',
    elevation: 4,
    shadowColor: '#000',
    shadowOpacity: 0.25,
    shadowRadius: 6,
    shadowOffset: {width: 0, height: 3},
  },
  alarmTypeCardSelected: {
    borderColor: '#f59e0b',
    backgroundColor: 'rgba(245,158,11,0.1)',
  },
  alarmTypeIcon: {
    fontSize: 28,
    marginBottom: 8,
  },
  alarmTypeText: {
    fontSize: 15,
    fontWeight: '600',
    color: '#999',
    marginBottom: 2,
  },
  alarmTypeTextSelected: {
    color: '#f59e0b',
  },
  alarmTypeDesc: {
    fontSize: 12,
    color: '#666',
  },

  // Switch Row
  switchRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  switchTextWrap: {
    flex: 1,
    marginRight: 12,
  },
  switchLabel: {
    fontSize: 15,
    fontWeight: '600',
    color: '#fff',
  },
  switchDesc: {
    fontSize: 12,
    color: '#777',
    marginTop: 2,
  },

  // Field Group
  fieldGroup: {
    marginBottom: 14,
  },
  label: {
    fontSize: 14,
    fontWeight: '600',
    color: '#ccc',
    marginBottom: 6,
  },
  input: {
    height: 48,
    backgroundColor: 'rgba(255,255,255,0.06)',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.12)',
    paddingHorizontal: 14,
    fontSize: 16,
    color: '#fff',
  },
  textArea: {
    height: 80,
    paddingTop: 12,
    textAlignVertical: 'top',
  },
  errorText: {
    fontSize: 13,
    color: '#ef4444',
    marginBottom: 6,
  },
  hintText: {
    fontSize: 12,
    color: '#777',
    marginTop: 4,
  },
  youtubePreview: {
    marginTop: 12,
    borderRadius: 12,
    overflow: 'hidden',
  },
  youtubePreviewLabel: {
    fontSize: 13,
    color: '#aaa',
    marginBottom: 8,
  },

  // Picker
  pickerContainer: {
    backgroundColor: 'rgba(255,255,255,0.06)',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.12)',
    overflow: 'hidden',
  },
  picker: {
    color: '#fff',
    height: 50,
  },

  // Buttons
  primaryButton: {
    height: 48,
    backgroundColor: '#f59e0b',
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 8,
  },
  primaryButtonText: {
    fontSize: 15,
    fontWeight: '700',
    color: '#000',
  },
  secondaryButton: {
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
  },
  secondaryButtonText: {
    fontSize: 14,
    color: '#999',
  },
  outlineButton: {
    height: 44,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: 'rgba(245,158,11,0.4)',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 12,
  },
  outlineButtonText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#f59e0b',
  },
  submitButton: {
    height: 56,
    backgroundColor: '#f59e0b',
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 8,
  },
  submitButtonText: {
    fontSize: 17,
    fontWeight: '700',
    color: '#000',
  },
  buttonDisabled: {
    opacity: 0.6,
  },

  // Estimate Card
  estimateCard: {
    backgroundColor: 'rgba(245,158,11,0.1)',
    borderRadius: 12,
    padding: 16,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: 'rgba(245,158,11,0.25)',
    marginVertical: 8,
  },
  estimateLabel: {
    fontSize: 13,
    color: '#999',
    marginBottom: 4,
  },
  estimateTime: {
    fontSize: 22,
    fontWeight: '700',
    color: '#f59e0b',
  },

  // Sounds Grid
  soundsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
    marginBottom: 16,
  },
  soundCard: {
    width: '30%',
    backgroundColor: 'rgba(255,255,255,0.05)',
    borderRadius: 12,
    padding: 12,
    alignItems: 'center',
    borderWidth: 2,
    borderColor: 'rgba(255,255,255,0.08)',
    minHeight: 80,
  },
  soundCardSelected: {
    borderColor: '#f59e0b',
    backgroundColor: 'rgba(245,158,11,0.1)',
  },
  soundIcon: {
    fontSize: 24,
    marginBottom: 4,
  },
  soundName: {
    fontSize: 11,
    color: '#999',
    textAlign: 'center',
  },
  soundNameSelected: {
    color: '#f59e0b',
    fontWeight: '600',
  },
  playingIndicator: {
    fontSize: 10,
    color: '#f59e0b',
    marginTop: 2,
  },

  // Options Row (challenge type, difficulty)
  optionsRow: {
    flexDirection: 'row',
    gap: 10,
    marginBottom: 14,
  },
  optionChip: {
    flex: 1,
    backgroundColor: 'rgba(255,255,255,0.05)',
    borderRadius: 10,
    paddingVertical: 10,
    paddingHorizontal: 8,
    alignItems: 'center',
    borderWidth: 2,
    borderColor: 'rgba(255,255,255,0.08)',
  },
  optionChipSelected: {
    borderColor: '#f59e0b',
    backgroundColor: 'rgba(245,158,11,0.1)',
  },
  optionChipIcon: {
    fontSize: 20,
    marginBottom: 4,
  },
  optionChipText: {
    fontSize: 13,
    color: '#999',
    fontWeight: '500',
  },
  optionChipTextSelected: {
    color: '#f59e0b',
    fontWeight: '600',
  },

  // Permissions Card
  permissionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 14,
  },
  permissionIcon: {
    fontSize: 28,
    marginRight: 12,
  },
  permissionTextWrap: {
    flex: 1,
  },
  permissionTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#fff',
    marginBottom: 4,
  },
  permissionDesc: {
    fontSize: 13,
    color: '#999',
  },
  permissionActions: {
    gap: 4,
  },

  // Premium Modal
  modalOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0,0,0,0.7)',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
  },
  modalCard: {
    backgroundColor: '#1a1a2e',
    borderRadius: 20,
    padding: 28,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.15)',
    width: '100%',
    maxWidth: 340,
  },
  modalIcon: {
    fontSize: 40,
    marginBottom: 12,
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: '#fff',
    marginBottom: 8,
  },
  modalDesc: {
    fontSize: 14,
    color: '#999',
    textAlign: 'center',
    marginBottom: 20,
    lineHeight: 20,
  },
});
