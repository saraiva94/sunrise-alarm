import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Dimensions,
  ScrollView,
  Vibration,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useNavigation, useRoute } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import type { RouteProp } from '@react-navigation/native';
import type { RootStackParamList } from '@/navigation/AppNavigator';
import { WebView } from 'react-native-webview';
import YoutubeIframe from 'react-native-youtube-iframe';
import notifee from '@notifee/react-native';
import Sound from 'react-native-sound';
import { MathChallenge, MemoryChallenge, StepsChallenge } from '@/components/challenges';
import { SlideToUnlock } from '@/components/SlideToUnlock';

Sound.setCategory('Playback');

type AlarmActiveNavigationProp = NativeStackNavigationProp<RootStackParamList, 'AlarmActive'>;
type AlarmActiveRouteProp = RouteProp<RootStackParamList, 'AlarmActive'>;

type ChallengeType = 'math' | 'memory' | 'steps' | null;
type ChallengeDifficulty = 'easy' | 'medium' | 'hard';

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window');
const PLAYER_HEIGHT = 200;

export default function AlarmActiveScreen() {
  const navigation = useNavigation<AlarmActiveNavigationProp>();
  const route = useRoute<AlarmActiveRouteProp>();
  const insets = useSafeAreaInsets();
  const [currentTime, setCurrentTime] = useState(new Date());
  const [challengeCompleted, setChallengeCompleted] = useState(false);

  const {
    url,
    purpose,
    challengeType = null,
    challengeDifficulty = 'easy',
    challengeEnabled = false,
    alarmSoundUrl = '',
  } = route.params || {};

  const hasChallenge = challengeEnabled && challengeType !== null;

  const getVideoInfo = (videoUrl: string) => {
    const youtubeMatch = videoUrl.match(
      /(?:youtube\.com\/(?:watch\?v=|embed\/|shorts\/)|youtu\.be\/)([a-zA-Z0-9_-]+)/
    );
    if (youtubeMatch) {
      const videoId = youtubeMatch[1];
      const isShort = videoUrl.includes('/shorts/');
      return { videoId, embedUrl: '', isVertical: isShort, type: 'youtube' as const };
    }
    const vimeoMatch = videoUrl.match(/vimeo\.com\/(\d+)/);
    if (vimeoMatch) {
      return { videoId: null, embedUrl: `https://player.vimeo.com/video/${vimeoMatch[1]}?autoplay=1&loop=1&background=1`, isVertical: false, type: 'vimeo' as const };
    }
    if (videoUrl.match(/\.(mp4|webm|ogg|mov)(\?|$)/i)) {
      return { videoId: null, embedUrl: videoUrl, isVertical: false, type: 'direct' as const };
    }
    if (videoUrl.match(/\.(mp3|wav|ogg|m4a)(\?|$)/i)) {
      return { videoId: null, embedUrl: videoUrl, isVertical: false, type: 'audio' as const };
    }
    if (videoUrl.includes('supabase.co/storage')) {
      if (videoUrl.match(/\.(mp3|wav|ogg|m4a)/i)) {
        return { videoId: null, embedUrl: videoUrl, isVertical: false, type: 'audio' as const };
      }
      return { videoId: null, embedUrl: videoUrl, isVertical: false, type: 'direct' as const };
    }
    return { videoId: null, embedUrl: videoUrl, isVertical: false, type: 'unsupported' as const };
  };

  const videoInfo = getVideoInfo(url || '');

  const [alarmSoundPlaying, setAlarmSoundPlaying] = useState(false);
  const alarmSoundRef = useRef<Sound | null>(null);
  const isLocalSound = alarmSoundUrl ? !alarmSoundUrl.startsWith('http') : false;

  useEffect(() => {
    if (!url && !alarmSoundUrl) {
      navigation.navigate('Home');
      return;
    }

    notifee.cancelAllNotifications();

    // Start vibration pattern (repeating)
    Vibration.vibrate([500, 500, 200, 500], true);

    let localSound: Sound | null = null;
    if (alarmSoundUrl && (videoInfo.type === 'youtube' || isLocalSound)) {
      if (isLocalSound) {
        localSound = new Sound(alarmSoundUrl, Sound.MAIN_BUNDLE, (error) => {
          if (error) {
            return;
          }
          localSound!.setNumberOfLoops(-1);
          localSound!.play();
        });
        alarmSoundRef.current = localSound;
      } else {
        setAlarmSoundPlaying(true);
      }
    }

    const interval = setInterval(() => {
      setCurrentTime(new Date());
    }, 1000);

    return () => {
      clearInterval(interval);
      if (alarmSoundRef.current) {
        alarmSoundRef.current.stop();
        alarmSoundRef.current.release();
        alarmSoundRef.current = null;
      }
      if (localSound) {
        localSound.stop();
        localSound.release();
        localSound = null;
      }
      setAlarmSoundPlaying(false);
      Vibration.cancel();
    };
  }, [url, navigation]);

  const stopAlarmSound = useCallback(() => {
    setAlarmSoundPlaying(false);
    Vibration.cancel();
    if (alarmSoundRef.current) {
      alarmSoundRef.current.stop();
      alarmSoundRef.current.release();
      alarmSoundRef.current = null;
    }
  }, []);

  const [dismissed, setDismissed] = useState(false);

  const handleDismiss = () => {
    if (dismissed) return; // Prevent double-dismiss
    setDismissed(true);

    // Stop ALL audio/vibration immediately
    Vibration.cancel();
    setYtPlaying(false);
    setAlarmSoundPlaying(false);

    if (alarmSoundRef.current) {
      alarmSoundRef.current.stop();
      alarmSoundRef.current.release();
      alarmSoundRef.current = null;
    }

    // Cancel all native notifications (stops notification sound/vibration too)
    notifee.cancelAllNotifications();
    notifee.cancelDisplayedNotifications();

    // Reset to Home — fully unmounts AlarmActive and all its WebViews
    navigation.reset({ index: 0, routes: [{ name: 'Home' }] });
  };

  const handleChallengeComplete = useCallback(() => {
    setChallengeCompleted(true);
  }, []);

  const getWebViewHtml = () => {
    if (videoInfo.type === 'direct') {
      return `<!DOCTYPE html><html><head><meta name="viewport" content="width=device-width,initial-scale=1"><style>*{margin:0;padding:0;box-sizing:border-box}body{background:#000;width:100vw;height:100vh}video{width:100%;height:100%;object-fit:contain}</style></head><body><video src="${videoInfo.embedUrl}" autoplay loop playsinline></video></body></html>`;
    }
    if (videoInfo.type === 'audio') {
      return `<!DOCTYPE html><html><head><meta name="viewport" content="width=device-width,initial-scale=1"><style>*{margin:0;padding:0;box-sizing:border-box}body{background:#1a1a2e;display:flex;align-items:center;justify-content:center;width:100vw;height:100vh;padding:20px}audio{width:100%}.label{color:#f59e0b;font-family:sans-serif;font-size:18px;text-align:center;margin-bottom:20px}</style></head><body><div><p class="label">🔊 Tocando...</p><audio src="${videoInfo.embedUrl}" autoplay loop></audio></div></body></html>`;
    }
    if (videoInfo.type === 'vimeo') {
      return `<!DOCTYPE html><html><head><meta name="viewport" content="width=device-width,initial-scale=1"><style>*{margin:0;padding:0;box-sizing:border-box}body{background:#000;width:100vw;height:100vh}iframe{width:100%;height:100%;border:none}</style></head><body><iframe src="${videoInfo.embedUrl}" allow="autoplay;fullscreen" allowfullscreen></iframe></body></html>`;
    }
    return `<!DOCTYPE html><html><head><meta name="viewport" content="width=device-width,initial-scale=1"><style>*{margin:0;padding:0;box-sizing:border-box}body{background:#000;width:100vw;height:100vh}iframe{width:100%;height:100%;border:none}</style></head><body><iframe src="${videoInfo.embedUrl}" allow="autoplay" allowfullscreen></iframe></body></html>`;
  };

  const youtubePlayerRef = useRef<any>(null);
  const [ytPlaying, setYtPlaying] = useState(true);

  const onYoutubeStateChange = useCallback((state: string) => {
    if (state === 'playing') {
      stopAlarmSound();
    } else if (state === 'ended') {
      setYtPlaying(false);
      setTimeout(() => setYtPlaying(true), 100);
    }
  }, [stopAlarmSound]);

  if (!url && !alarmSoundUrl) return null;

  const canDismiss = !hasChallenge || challengeCompleted;

  const alarmSoundHtml = `<!DOCTYPE html><html><head><meta name="viewport" content="width=device-width,initial-scale=1"></head><body><audio src="${alarmSoundUrl}" autoplay loop></audio></body></html>`;

  // Determine which elements are visible for layout
  const hasVideo = videoInfo.type === 'youtube' || videoInfo.type === 'vimeo' || videoInfo.type === 'direct';
  const hasAudio = videoInfo.type === 'audio';
  const hasLocalOnly = isLocalSound && !url;

  return (
    <View style={styles.container}>
      {/* Invisible WebView for remote alarm sound — always mounted */}
      {alarmSoundUrl && !isLocalSound && (
        <WebView
          source={{ html: alarmSoundPlaying ? alarmSoundHtml : '<html><body></body></html>' }}
          style={styles.hiddenWebView}
          mediaPlaybackRequiresUserAction={false}
          allowsInlineMediaPlayback={true}
          javaScriptEnabled={true}
        />
      )}

      <ScrollView
        contentContainerStyle={[
          styles.scrollContent,
          { paddingTop: insets.top + 16, paddingBottom: insets.bottom + 16 },
        ]}
        showsVerticalScrollIndicator={false}
        bounces={false}
      >
        <View style={[styles.centerWrapper, { minHeight: SCREEN_HEIGHT - insets.top - insets.bottom - 32 }]}>

        {/* 1. Challenge (largest card) */}
        {hasChallenge && !challengeCompleted && (
          <View>
            {challengeType === 'math' ? (
              <MathChallenge
                difficulty={challengeDifficulty as ChallengeDifficulty}
                onComplete={handleChallengeComplete}
              />
            ) : challengeType === 'memory' ? (
              <MemoryChallenge
                difficulty={challengeDifficulty as ChallengeDifficulty}
                onComplete={handleChallengeComplete}
              />
            ) : challengeType === 'steps' ? (
              <StepsChallenge
                difficulty={challengeDifficulty as ChallengeDifficulty}
                onComplete={handleChallengeComplete}
              />
            ) : null}
            <Text style={styles.challengeHint}>
              Complete o desafio para desligar o alarme
            </Text>
          </View>
        )}

        {/* 2. YouTube Player */}
        {videoInfo.type === 'youtube' && videoInfo.videoId && (
          <View style={[styles.mediaCard, { height: PLAYER_HEIGHT }]}>
            <YoutubeIframe
              ref={youtubePlayerRef}
              height={PLAYER_HEIGHT}
              width={SCREEN_WIDTH - 32}
              videoId={videoInfo.videoId}
              play={ytPlaying}
              onChangeState={onYoutubeStateChange}
              initialPlayerParams={{
                loop: true,
                controls: true,
                modestbranding: true,
                rel: false,
                preventFullScreen: true,
              }}
              webViewProps={{
                mediaPlaybackRequiresUserAction: false,
                allowsInlineMediaPlayback: true,
                javaScriptEnabled: true,
                domStorageEnabled: true,
                onShouldStartLoadWithRequest: (request) => {
                  return request.url.includes('youtube.com') || request.url.startsWith('about:');
                },
              }}
            />
          </View>
        )}

        {/* 2b. Other media (Vimeo, direct video, audio) */}
        {(hasAudio || videoInfo.type === 'vimeo' || videoInfo.type === 'direct') && (
          <View style={[styles.mediaCard, { height: PLAYER_HEIGHT }]}>
            <WebView
              source={{ html: getWebViewHtml() }}
              style={styles.webview}
              userAgent="Mozilla/5.0 (Linux; Android 11; Mobile) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/96.0.4664.45 Mobile Safari/537.36"
              mediaPlaybackRequiresUserAction={false}
              allowsInlineMediaPlayback={true}
              javaScriptEnabled={true}
              domStorageEnabled={true}
            />
          </View>
        )}

        {/* 2c. Local sound only (no video) */}
        {hasLocalOnly && (
          <View style={styles.localSoundCard}>
            <Text style={styles.localSoundIcon}>🔊</Text>
            <Text style={styles.localSoundText}>Tocando alarme...</Text>
          </View>
        )}

        {/* 3. Purpose */}
        {purpose ? (
          <View style={styles.purposeCard}>
            <Text style={styles.purposeLabel}>Seu Propósito</Text>
            <Text style={styles.purposeText}>"{purpose}"</Text>
          </View>
        ) : null}

        {/* 4. Slide to dismiss */}
        {canDismiss && (
          <View>
            {challengeCompleted && (
              <View style={styles.successCard}>
                <Text style={styles.successIcon}>✅</Text>
                <Text style={styles.successText}>Desafio Completo!</Text>
              </View>
            )}
            <SlideToUnlock onUnlock={handleDismiss} />
          </View>
        )}

        {/* 5. Clock (smallest) */}
        <View style={styles.clockCard}>
          <Text style={styles.clockIcon}>🕐</Text>
          <Text style={styles.clockTime}>
            {currentTime.toLocaleTimeString('pt-BR', {
              hour: '2-digit',
              minute: '2-digit',
            })}
          </Text>
        </View>
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0a0a0a',
  },
  scrollContent: {
    flexGrow: 1,
    paddingHorizontal: 16,
  },
  centerWrapper: {
    justifyContent: 'center',
    gap: 16,
  },
  successCard: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    backgroundColor: 'rgba(34,197,94,0.1)',
    borderRadius: 14,
    padding: 14,
    borderWidth: 1,
    borderColor: 'rgba(34,197,94,0.3)',
    marginBottom: 10,
  },
  successIcon: {
    fontSize: 20,
  },
  successText: {
    fontSize: 16,
    fontWeight: '700',
    color: '#22c55e',
  },
  purposeCard: {
    backgroundColor: '#1a1a2e',
    borderRadius: 14,
    padding: 18,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)',
  },
  purposeLabel: {
    fontSize: 11,
    color: '#777',
    textTransform: 'uppercase',
    letterSpacing: 1,
    marginBottom: 6,
  },
  purposeText: {
    fontSize: 16,
    fontWeight: '500',
    fontStyle: 'italic',
    color: '#fff',
    textAlign: 'center',
    lineHeight: 24,
  },
  challengeHint: {
    fontSize: 13,
    color: '#777',
    textAlign: 'center',
    marginTop: 10,
  },
  mediaCard: {
    borderRadius: 14,
    overflow: 'hidden',
    backgroundColor: '#000',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)',
  },
  webview: {
    flex: 1,
    backgroundColor: '#000',
  },
  localSoundCard: {
    backgroundColor: '#1a1a2e',
    borderRadius: 14,
    padding: 24,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 12,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)',
  },
  localSoundIcon: {
    fontSize: 48,
  },
  localSoundText: {
    fontSize: 18,
    fontWeight: '600',
    color: '#f59e0b',
  },
  clockCard: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: 'rgba(245,158,11,0.1)',
    borderRadius: 14,
    padding: 14,
    borderWidth: 1,
    borderColor: 'rgba(245,158,11,0.3)',
  },
  clockIcon: {
    fontSize: 18,
  },
  clockTime: {
    fontSize: 22,
    fontWeight: '700',
    color: '#f59e0b',
  },
  hiddenWebView: {
    height: 0,
    width: 0,
    opacity: 0,
    position: 'absolute',
  },
});
