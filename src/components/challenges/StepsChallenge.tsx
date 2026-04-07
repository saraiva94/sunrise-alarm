import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Vibration,
  Platform,
  PermissionsAndroid,
} from 'react-native';
import { accelerometer, SensorTypes, setUpdateIntervalForType } from 'react-native-sensors';

type Difficulty = 'easy' | 'medium' | 'hard';

interface StepsChallengeProps {
  difficulty: Difficulty;
  onComplete: () => void;
}

const STEPS_REQUIRED = {
  easy: 10,
  medium: 20,
  hard: 40,
};

const MAGNITUDE_THRESHOLD = 12.5; // Higher to ignore vibration noise (gravity ~9.8)
const STEP_COOLDOWN_MS = 500;

export function StepsChallenge({ difficulty, onComplete }: StepsChallengeProps) {
  const [steps, setSteps] = useState(0);
  const [isListening, setIsListening] = useState(false);
  const [permissionDenied, setPermissionDenied] = useState(false);
  const targetSteps = STEPS_REQUIRED[difficulty];
  const lastStepTime = useRef(0);
  const lastMagnitude = useRef(9.8);
  const wasAboveThreshold = useRef(false);
  const subscriptionRef = useRef<any>(null);
  const magnitudeHistory = useRef<number[]>([]);

  const requestPermission = async (): Promise<boolean> => {
    if (Platform.OS !== 'android') return true;

    try {
      const granted = await PermissionsAndroid.request(
        PermissionsAndroid.PERMISSIONS.ACTIVITY_RECOGNITION,
        {
          title: 'Permissão de Atividade Física',
          message: 'O app precisa acessar o sensor de movimento para contar seus passos.',
          buttonPositive: 'Permitir',
          buttonNegative: 'Negar',
        },
      );
      return granted === PermissionsAndroid.RESULTS.GRANTED;
    } catch {
      return false;
    }
  };

  const startListening = useCallback(async () => {
    const hasPermission = await requestPermission();
    if (!hasPermission) {
      setPermissionDenied(true);
      return;
    }

    setUpdateIntervalForType(SensorTypes.accelerometer, 50);

    subscriptionRef.current = accelerometer.subscribe(({ x, y, z }) => {
      const currentTime = Date.now();
      const rawMagnitude = Math.sqrt(x * x + y * y + z * z);

      // Moving average filter (window of 4) to smooth vibration noise
      const history = magnitudeHistory.current;
      history.push(rawMagnitude);
      if (history.length > 4) history.shift();
      const magnitude = history.reduce((a, b) => a + b, 0) / history.length;

      const isAbove = magnitude > MAGNITUDE_THRESHOLD;
      const wasAbove = wasAboveThreshold.current;

      // Detect step on zero-crossing: magnitude goes above threshold then back below
      if (wasAbove && !isAbove && currentTime - lastStepTime.current > STEP_COOLDOWN_MS) {
        lastStepTime.current = currentTime;
        setSteps(prev => prev + 1);
      }

      wasAboveThreshold.current = isAbove;
      lastMagnitude.current = magnitude;
    });

    setIsListening(true);
  }, []);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (subscriptionRef.current) {
        subscriptionRef.current.unsubscribe();
      }
    };
  }, []);

  // Check completion
  useEffect(() => {
    if (steps >= targetSteps) {
      if (subscriptionRef.current) {
        subscriptionRef.current.unsubscribe();
        subscriptionRef.current = null;
      }
      setIsListening(false);
      Vibration.vibrate([100, 50, 100]);
      setTimeout(onComplete, 500);
    }
  }, [steps, targetSteps, onComplete]);

  // Tap fallback for testing
  const handleTapStep = () => {
    if (!isListening) return;
    setSteps(prev => prev + 1);
  };

  const progress = Math.min((steps / targetSteps) * 100, 100);
  const remaining = Math.max(targetSteps - steps, 0);

  return (
    <View style={styles.card}>
      {/* Header */}
      <View style={styles.header}>
        <View style={styles.headerLeft}>
          <Text style={styles.headerIcon}>🚶</Text>
          <Text style={styles.headerTitle}>Desafio de Passos</Text>
        </View>
        <Text style={styles.counter}>{steps}/{targetSteps}</Text>
      </View>

      {/* Progress */}
      <View style={styles.progressBg}>
        <View style={[styles.progressFill, { width: `${progress}%` }]} />
      </View>

      {!isListening ? (
        /* Start Button */
        <View style={styles.startBox}>
          <Text style={styles.startIcon}>📱</Text>
          <Text style={styles.startTitle}>Ativar Sensor de Movimento</Text>
          <Text style={styles.startDesc}>
            Precisamos acessar o sensor de movimento para contar seus passos.
          </Text>
          {permissionDenied && (
            <Text style={styles.permissionError}>
              Permissão negada. Habilite nas configurações do app.
            </Text>
          )}
          <TouchableOpacity
            style={styles.startButton}
            onPress={startListening}
            activeOpacity={0.8}
          >
            <Text style={styles.startButtonText}>🚶 Permitir e Começar</Text>
          </TouchableOpacity>
        </View>
      ) : (
        /* Active Counter */
        <TouchableOpacity
          style={styles.activeBox}
          onPress={handleTapStep}
          activeOpacity={0.9}
        >
          <Text style={styles.bigFootprint}>🚶</Text>

          <View style={styles.isListeningDot} />

          <Text style={styles.remainingNumber}>{remaining}</Text>
          <Text style={styles.remainingLabel}>passos restantes</Text>

          <Text style={styles.hint}>
            Comece a caminhar ou sacudir o celular!
          </Text>
          <Text style={styles.tapHint}>
            Toque na tela para simular passos (teste)
          </Text>
        </TouchableOpacity>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: '#1a1a2e',
    borderRadius: 16,
    padding: 18,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  headerIcon: {
    fontSize: 20,
  },
  headerTitle: {
    fontSize: 17,
    fontWeight: '700',
    color: '#fff',
  },
  counter: {
    fontSize: 14,
    color: '#999',
  },
  progressBg: {
    height: 6,
    backgroundColor: 'rgba(255,255,255,0.1)',
    borderRadius: 3,
    marginBottom: 16,
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    backgroundColor: '#f59e0b',
    borderRadius: 3,
  },
  startBox: {
    alignItems: 'center',
    padding: 24,
    backgroundColor: 'rgba(245,158,11,0.1)',
    borderRadius: 14,
    borderWidth: 1,
    borderColor: 'rgba(245,158,11,0.2)',
    gap: 10,
  },
  startIcon: {
    fontSize: 40,
  },
  startTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#fff',
  },
  startDesc: {
    fontSize: 13,
    color: '#999',
    textAlign: 'center',
    lineHeight: 20,
  },
  permissionError: {
    fontSize: 13,
    color: '#ef4444',
    textAlign: 'center',
    fontWeight: '600',
  },
  startButton: {
    marginTop: 6,
    width: '100%',
    height: 50,
    backgroundColor: '#f59e0b',
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  startButtonText: {
    fontSize: 16,
    fontWeight: '700',
    color: '#000',
  },
  activeBox: {
    alignItems: 'center',
    padding: 32,
    borderRadius: 14,
    backgroundColor: 'rgba(245,158,11,0.08)',
    borderWidth: 2,
    borderColor: 'rgba(245,158,11,0.3)',
    gap: 6,
  },
  bigFootprint: {
    fontSize: 56,
  },
  isListeningDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: '#f59e0b',
    marginBottom: 8,
  },
  remainingNumber: {
    fontSize: 52,
    fontWeight: '700',
    color: '#f59e0b',
  },
  remainingLabel: {
    fontSize: 14,
    color: '#999',
  },
  hint: {
    fontSize: 12,
    color: '#777',
    marginTop: 10,
  },
  tapHint: {
    fontSize: 11,
    color: '#555',
    fontStyle: 'italic',
  },
});
