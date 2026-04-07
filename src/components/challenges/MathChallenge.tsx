import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
} from 'react-native';

type Difficulty = 'easy' | 'medium' | 'hard';

interface MathChallengeProps {
  difficulty: Difficulty;
  onComplete: () => void;
}

interface Problem {
  question: string;
  answer: number;
}

const PROBLEMS_COUNT = {
  easy: 5,
  medium: 10,
  hard: 20,
};

export function MathChallenge({ difficulty, onComplete }: MathChallengeProps) {
  const [currentProblem, setCurrentProblem] = useState<Problem | null>(null);
  const [userAnswer, setUserAnswer] = useState('');
  const [solvedCount, setSolvedCount] = useState(0);
  const [feedback, setFeedback] = useState<'correct' | 'wrong' | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const totalProblems = PROBLEMS_COUNT[difficulty];

  const generateProblem = useCallback((): Problem => {
    const operations = {
      easy: ['+', '-'],
      medium: ['+', '-', '*'],
      hard: ['+', '-', '*', '/'],
    };

    const ops = operations[difficulty];

    if (difficulty === 'easy') {
      const a = Math.floor(Math.random() * 50) + 1;
      const b = Math.floor(Math.random() * 50) + 1;
      const op = ops[Math.floor(Math.random() * ops.length)];

      if (op === '+') {
        return { question: `${a} + ${b}`, answer: a + b };
      } else {
        const [big, small] = a > b ? [a, b] : [b, a];
        return { question: `${big} - ${small}`, answer: big - small };
      }
    } else if (difficulty === 'medium') {
      const a = Math.floor(Math.random() * 20) + 1;
      const b = Math.floor(Math.random() * 20) + 1;
      const c = Math.floor(Math.random() * 10) + 1;

      const patterns = [
        () => ({ question: `${a} + ${b} × ${c}`, answer: a + b * c }),
        () => ({ question: `${a} × ${c} + ${b}`, answer: a * c + b }),
        () => {
          const result = a * c - b;
          if (result >= 0) {
            return { question: `${a} × ${c} - ${b}`, answer: result };
          }
          return { question: `${a} × ${c} + ${b}`, answer: a * c + b };
        },
        () => {
          const bigger = Math.max(a, b);
          const smaller = Math.min(a, b);
          const result = bigger - smaller * c;
          if (result >= 0) {
            return { question: `${bigger} - ${smaller} × ${c}`, answer: result };
          }
          return { question: `${bigger} + ${smaller} × ${c}`, answer: bigger + smaller * c };
        },
      ];

      const pattern = patterns[Math.floor(Math.random() * patterns.length)];
      return pattern();
    } else {
      const a = Math.floor(Math.random() * 15) + 2;
      const b = Math.floor(Math.random() * 15) + 2;
      const c = Math.floor(Math.random() * 10) + 2;

      const patterns = [
        () => ({ question: `${a * c} ÷ ${c} + ${b}`, answer: a + b }),
        () => ({ question: `${a} × ${b} ÷ ${a}`, answer: b }),
        () => ({ question: `${a} + ${b} × ${c} - ${a}`, answer: b * c }),
        () => ({ question: `${a * b} ÷ ${a} × ${c}`, answer: b * c }),
        () => ({ question: `${a} × ${c} + ${b} - ${a}`, answer: a * c + b - a }),
      ];

      const pattern = patterns[Math.floor(Math.random() * patterns.length)];
      return pattern();
    }
  }, [difficulty]);

  useEffect(() => {
    setCurrentProblem(generateProblem());
  }, [generateProblem]);

  const handleSubmit = () => {
    if (!currentProblem || isProcessing) return;

    const numAnswer = parseInt(userAnswer, 10);

    if (numAnswer === currentProblem.answer) {
      setIsProcessing(true);
      setFeedback('correct');
      const newSolved = solvedCount + 1;
      setSolvedCount(newSolved);

      setTimeout(() => {
        setFeedback(null);
        setUserAnswer('');
        setIsProcessing(false);

        if (newSolved >= totalProblems) {
          onComplete();
        } else {
          setCurrentProblem(generateProblem());
        }
      }, 500);
    } else {
      setIsProcessing(true);
      setFeedback('wrong');
      setTimeout(() => {
        setFeedback(null);
        setUserAnswer('');
        setIsProcessing(false);
      }, 800);
    }
  };

  const progress = (solvedCount / totalProblems) * 100;

  return (
    <View style={styles.card}>
      {/* Header */}
      <View style={styles.header}>
        <View style={styles.headerLeft}>
          <Text style={styles.headerIcon}>🧮</Text>
          <Text style={styles.headerTitle}>Desafio Matemático</Text>
        </View>
        <Text style={styles.counter}>{solvedCount}/{totalProblems}</Text>
      </View>

      {/* Progress Bar */}
      <View style={styles.progressBg}>
        <View style={[styles.progressFill, { width: `${progress}%` }]} />
      </View>

      {currentProblem && (
        <View style={styles.content}>
          {/* Problem Display */}
          <View
            style={[
              styles.problemBox,
              feedback === 'correct' && styles.problemCorrect,
              feedback === 'wrong' && styles.problemWrong,
            ]}
          >
            <Text style={styles.problemText}>
              {currentProblem.question} = ?
            </Text>
          </View>

          {/* Answer Input */}
          <View style={styles.inputRow}>
            <TextInput
              style={styles.input}
              value={userAnswer}
              onChangeText={setUserAnswer}
              onSubmitEditing={handleSubmit}
              placeholder="Resposta"
              placeholderTextColor="#666"
              keyboardType="numbers-and-punctuation"
              autoFocus
              returnKeyType="done"
            />
            <TouchableOpacity
              style={[styles.submitButton, (!userAnswer || isProcessing) && styles.submitDisabled]}
              onPress={handleSubmit}
              disabled={!userAnswer || isProcessing}
              activeOpacity={0.8}
            >
              <Text style={styles.submitText}>
                {feedback === 'correct' ? '✅' : feedback === 'wrong' ? '❌' : 'OK'}
              </Text>
            </TouchableOpacity>
          </View>
        </View>
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
  content: {
    gap: 16,
  },
  problemBox: {
    padding: 24,
    borderRadius: 14,
    backgroundColor: 'rgba(255,255,255,0.06)',
    alignItems: 'center',
  },
  problemCorrect: {
    backgroundColor: 'rgba(34,197,94,0.15)',
    borderWidth: 2,
    borderColor: '#22c55e',
  },
  problemWrong: {
    backgroundColor: 'rgba(239,68,68,0.15)',
    borderWidth: 2,
    borderColor: '#ef4444',
  },
  problemText: {
    fontSize: 30,
    fontWeight: '700',
    color: '#fff',
    letterSpacing: 2,
  },
  inputRow: {
    flexDirection: 'row',
    gap: 10,
  },
  input: {
    flex: 1,
    height: 56,
    backgroundColor: 'rgba(255,255,255,0.06)',
    borderRadius: 12,
    borderWidth: 2,
    borderColor: 'rgba(255,255,255,0.12)',
    fontSize: 22,
    fontWeight: '700',
    color: '#fff',
    textAlign: 'center',
  },
  submitButton: {
    width: 56,
    height: 56,
    backgroundColor: '#f59e0b',
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  submitDisabled: {
    opacity: 0.4,
  },
  submitText: {
    fontSize: 18,
    fontWeight: '700',
    color: '#000',
  },
});
