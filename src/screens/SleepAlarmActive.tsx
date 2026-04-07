import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Dimensions,
  Vibration,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation, useRoute } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import type { RouteProp } from '@react-navigation/native';
import type { RootStackParamList } from '@/navigation/AppNavigator';
import { WebView } from 'react-native-webview';
import notifee from '@notifee/react-native';
import { SlideToUnlock } from '@/components/SlideToUnlock';

type SleepActiveNav = NativeStackNavigationProp<RootStackParamList, 'SleepAlarmActive'>;
type SleepActiveRoute = RouteProp<RootStackParamList, 'SleepAlarmActive'>;

const { width: SCREEN_WIDTH } = Dimensions.get('window');

const SLEEP_MESSAGES: Record<string, { title: string; subtitle: string; message: string; icon: string; color: string }> = {
  '90': {
    title: 'Hora de se Organizar',
    subtitle: '1h30 antes de dormir',
    message: 'Comece a finalizar suas atividades do dia. Desligue telas brilhantes e prepare-se para uma boa noite de descanso.',
    icon: '⭐',
    color: '#f59e0b',
  },
  '60': {
    title: 'Hora de se Recolher',
    subtitle: '1h antes de dormir',
    message: 'Para uma boa noite de descanso, devemos nos recolher agora. Finalize suas últimas tarefas com calma.',
    icon: '🌙',
    color: '#f97316',
  },
  '30': {
    title: 'Último Aviso',
    subtitle: '30 minutos antes de dormir',
    message: 'Último alerta para descansar o quanto deseja, recolha-se agora.',
    icon: '❤️',
    color: '#ef4444',
  },
};

export default function SleepAlarmActiveScreen() {
  const navigation = useNavigation<SleepActiveNav>();
  const route = useRoute<SleepActiveRoute>();
  const [currentTime, setCurrentTime] = useState(new Date());
  const [dismissed, setDismissed] = useState(false);
  const webviewRef = useRef<WebView>(null);

  const {
    url,
    purpose,
    isSleepAlert = false,
    alertType = '90',
  } = route.params || {};

  const alertInfo = SLEEP_MESSAGES[alertType] || SLEEP_MESSAGES['90'];

  useEffect(() => {
    if (!isSleepAlert) {
      navigation.navigate('Home');
      return;
    }

    // Start vibration
    Vibration.vibrate([500, 300, 500, 300], true);

    // Cancel the notification that triggered this screen
    notifee.cancelAllNotifications();

    const interval = setInterval(() => {
      setCurrentTime(new Date());
    }, 1000);

    return () => {
      clearInterval(interval);
      Vibration.cancel();
    };
  }, [isSleepAlert, navigation]);

  const handleDismiss = () => {
    if (dismissed) return;
    setDismissed(true);

    // Stop everything
    Vibration.cancel();
    notifee.cancelAllNotifications();
    notifee.cancelDisplayedNotifications();

    // Stop WebView audio by injecting pause
    webviewRef.current?.injectJavaScript(`
      document.querySelectorAll('audio,video').forEach(el => { el.pause(); el.src = ''; });
      true;
    `);

    navigation.reset({ index: 0, routes: [{ name: 'Home' }] });
  };

  const getVideoInfo = (videoUrl: string) => {
    const youtubeMatch = videoUrl?.match(
      /(?:youtube\.com\/(?:watch\?v=|embed\/|shorts\/)|youtu\.be\/)([a-zA-Z0-9_-]+)/
    );
    if (youtubeMatch) {
      return {
        embedUrl: `https://www.youtube.com/embed/${youtubeMatch[1]}?autoplay=1&mute=0&loop=1&playlist=${youtubeMatch[1]}`,
        type: 'youtube',
      };
    }

    if (videoUrl?.match(/\.(mp3|wav|ogg|m4a)(\?|$)/i) || videoUrl?.includes('supabase.co/storage')) {
      return { embedUrl: videoUrl, type: 'audio' };
    }

    return null;
  };

  const videoInfo = url ? getVideoInfo(url) : null;

  const getWebViewHtml = () => {
    if (!videoInfo) return '';

    if (videoInfo.type === 'audio') {
      return `<html><head><meta name="viewport" content="width=device-width,initial-scale=1"><style>*{margin:0;padding:0}body{background:#1e1b4b;display:flex;align-items:center;justify-content:center;height:100vh;padding:20px;box-sizing:border-box}audio{width:100%}.label{color:#818cf8;font-family:sans-serif;font-size:16px;text-align:center;margin-bottom:16px}</style></head><body><div><p class="label">🎵 Música relaxante</p><audio src="${videoInfo.embedUrl}" autoplay loop controls></audio></div></body></html>`;
    }

    return `<html><head><meta name="viewport" content="width=device-width,initial-scale=1"><style>*{margin:0;padding:0}body{background:#000}iframe{width:100%;height:100vh;border:none}</style></head><body><iframe src="${videoInfo.embedUrl}" allow="accelerometer;autoplay;clipboard-write;encrypted-media;gyroscope;picture-in-picture" allowfullscreen></iframe></body></html>`;
  };

  if (!isSleepAlert) return null;

  return (
    <SafeAreaView style={styles.container}>
      {/* Quick Dismiss */}
      <TouchableOpacity style={styles.closeButton} onPress={handleDismiss}>
        <Text style={styles.closeText}>✕</Text>
      </TouchableOpacity>

      {/* Main Alert */}
      <View style={[styles.alertCard, { borderColor: alertInfo.color + '44' }]}>
        <View style={[styles.alertIconCircle, { backgroundColor: alertInfo.color + '33' }]}>
          <Text style={styles.alertIcon}>{alertInfo.icon}</Text>
        </View>
        <Text style={styles.alertTitle}>{alertInfo.title}</Text>
        <Text style={[styles.alertSubtitle, { color: alertInfo.color }]}>{alertInfo.subtitle}</Text>
        <Text style={styles.alertMessage}>{alertInfo.message}</Text>
      </View>

      {/* Clock */}
      <View style={styles.clockCard}>
        <Text style={styles.clockEmoji}>🕐</Text>
        <Text style={styles.clockTime}>
          {currentTime.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}
        </Text>
      </View>

      {/* Purpose */}
      {purpose ? (
        <View style={styles.purposeCard}>
          <Text style={styles.purposeLabel}>Lembre-se do seu propósito</Text>
          <Text style={styles.purposeText}>"{purpose}"</Text>
        </View>
      ) : null}

      {/* Media Player */}
      {videoInfo && (
        <View style={styles.mediaCard}>
          <WebView
            ref={webviewRef}
            source={{ html: getWebViewHtml() }}
            style={styles.webview}
            allowsInlineMediaPlayback
            mediaPlaybackRequiresUserAction={false}
            javaScriptEnabled
          />
        </View>
      )}

      {/* Quotes */}
      <View style={styles.quoteCard}>
        <Text style={styles.quoteText}>
          "O sono é a melhor meditação." - Dalai Lama
        </Text>
      </View>

      {/* Slide to Dismiss */}
      <View style={styles.slideContainer}>
        <SlideToUnlock onUnlock={handleDismiss} />
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0a0a0a',
    padding: 16,
    gap: 14,
  },
  closeButton: {
    position: 'absolute',
    top: 50,
    left: 16,
    zIndex: 10,
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
  },
  closeText: {
    fontSize: 18,
    color: 'rgba(255,255,255,0.5)',
  },
  alertCard: {
    backgroundColor: 'rgba(255,255,255,0.05)',
    borderRadius: 16,
    padding: 24,
    alignItems: 'center',
    borderWidth: 1,
    marginTop: 30,
  },
  alertIconCircle: {
    width: 64,
    height: 64,
    borderRadius: 32,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 14,
  },
  alertIcon: {
    fontSize: 32,
  },
  alertTitle: {
    fontSize: 24,
    fontWeight: '700',
    color: '#fff',
    marginBottom: 4,
  },
  alertSubtitle: {
    fontSize: 14,
    fontWeight: '500',
    marginBottom: 14,
  },
  alertMessage: {
    fontSize: 15,
    color: 'rgba(255,255,255,0.8)',
    textAlign: 'center',
    lineHeight: 22,
  },
  clockCard: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    backgroundColor: 'rgba(255,255,255,0.05)',
    borderRadius: 14,
    padding: 14,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)',
  },
  clockEmoji: {
    fontSize: 20,
  },
  clockTime: {
    fontSize: 30,
    fontWeight: '700',
    color: '#fff',
  },
  purposeCard: {
    backgroundColor: 'rgba(255,255,255,0.05)',
    borderRadius: 14,
    padding: 16,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)',
  },
  purposeLabel: {
    fontSize: 11,
    color: 'rgba(255,255,255,0.5)',
    textTransform: 'uppercase',
    letterSpacing: 1,
    marginBottom: 6,
  },
  purposeText: {
    fontSize: 15,
    fontStyle: 'italic',
    color: 'rgba(255,255,255,0.9)',
    textAlign: 'center',
  },
  mediaCard: {
    height: SCREEN_WIDTH * 0.5,
    borderRadius: 14,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)',
  },
  webview: {
    flex: 1,
    backgroundColor: '#1e1b4b',
  },
  quoteCard: {
    backgroundColor: 'rgba(99,102,241,0.1)',
    borderRadius: 14,
    padding: 16,
    borderWidth: 1,
    borderColor: 'rgba(99,102,241,0.2)',
  },
  quoteText: {
    fontSize: 14,
    fontStyle: 'italic',
    color: 'rgba(255,255,255,0.7)',
    textAlign: 'center',
    lineHeight: 20,
  },
  slideContainer: {
    marginTop: 8,
  },
});
