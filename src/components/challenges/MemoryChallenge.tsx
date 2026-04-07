import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Dimensions,
  ScrollView,
} from 'react-native';

type Difficulty = 'easy' | 'medium' | 'hard';

interface MemoryChallengeProps {
  difficulty: Difficulty;
  onComplete: () => void;
}

const PIECES_COUNT = {
  easy: 10,
  medium: 20,
  hard: 30,
};

const COLORS = [
  '#ef4444', '#3b82f6', '#22c55e', '#eab308', '#a855f7',
  '#ec4899', '#f97316', '#06b6d4', '#6366f1', '#10b981',
  '#f43f5e', '#f59e0b', '#14b8a6', '#8b5cf6', '#84cc16',
];

interface MemoryCard {
  id: number;
  colorIndex: number;
  isFlipped: boolean;
  isMatched: boolean;
}

const { width: SCREEN_WIDTH } = Dimensions.get('window');

export function MemoryChallenge({ difficulty, onComplete }: MemoryChallengeProps) {
  const [cards, setCards] = useState<MemoryCard[]>([]);
  const [flippedCards, setFlippedCards] = useState<number[]>([]);
  const [matchedPairs, setMatchedPairs] = useState(0);
  const [isShowingCards, setIsShowingCards] = useState(true);
  const [canFlip, setCanFlip] = useState(false);
  const [countdown, setCountdown] = useState(3);

  const totalPieces = PIECES_COUNT[difficulty];
  const totalPairs = totalPieces / 2;
  const gridCols = difficulty === 'easy' ? 5 : difficulty === 'medium' ? 5 : 6;
  const cardSize = (SCREEN_WIDTH - 36 - 18 - (gridCols - 1) * 6) / gridCols;

  const initializeGame = useCallback(() => {
    const pairsCount = totalPieces / 2;
    const cardPairs: MemoryCard[] = [];

    for (let i = 0; i < pairsCount; i++) {
      const colorIndex = i % COLORS.length;
      cardPairs.push(
        { id: i * 2, colorIndex, isFlipped: true, isMatched: false },
        { id: i * 2 + 1, colorIndex, isFlipped: true, isMatched: false }
      );
    }

    // Shuffle
    for (let i = cardPairs.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [cardPairs[i], cardPairs[j]] = [cardPairs[j], cardPairs[i]];
    }

    setCards(cardPairs);
    setFlippedCards([]);
    setMatchedPairs(0);
    setIsShowingCards(true);
    setCanFlip(false);
    setCountdown(3);
  }, [totalPieces]);

  useEffect(() => {
    initializeGame();
  }, [initializeGame]);

  // Countdown to hide cards
  useEffect(() => {
    if (isShowingCards && countdown > 0) {
      const timer = setTimeout(() => setCountdown(countdown - 1), 1000);
      return () => clearTimeout(timer);
    } else if (isShowingCards && countdown === 0) {
      setCards(prev => prev.map(card => ({ ...card, isFlipped: false })));
      setIsShowingCards(false);
      setCanFlip(true);
    }
  }, [isShowingCards, countdown]);

  const handleCardClick = (cardId: number) => {
    if (!canFlip) return;

    const card = cards.find(c => c.id === cardId);
    if (!card || card.isFlipped || card.isMatched) return;
    if (flippedCards.length >= 2) return;

    const clickedCard = cards.find(c => c.id === cardId)!;

    setCards(prev =>
      prev.map(c => (c.id === cardId ? { ...c, isFlipped: true } : c))
    );

    const newFlipped = [...flippedCards, cardId];
    setFlippedCards(newFlipped);

    if (newFlipped.length === 2) {
      setCanFlip(false);

      const [first, second] = newFlipped;
      const firstCard = first === cardId ? clickedCard : cards.find(c => c.id === first)!;
      const secondCard = second === cardId ? clickedCard : cards.find(c => c.id === second)!;

      if (firstCard.colorIndex === secondCard.colorIndex) {
        // Match
        setCards(prev =>
          prev.map(c =>
            c.id === first || c.id === second ? { ...c, isMatched: true } : c
          )
        );
        setMatchedPairs(prev => {
          const newPairs = prev + 1;
          if (newPairs >= totalPairs) {
            setTimeout(onComplete, 500);
          }
          return newPairs;
        });
        setFlippedCards([]);
        setCanFlip(true);
      } else {
        // No match
        setTimeout(() => {
          setCards(prev =>
            prev.map(c =>
              c.id === first || c.id === second ? { ...c, isFlipped: false } : c
            )
          );
          setFlippedCards([]);
          setCanFlip(true);
        }, 1000);
      }
    }
  };

  const progress = (matchedPairs / totalPairs) * 100;

  return (
    <View style={styles.card}>
      {/* Header */}
      <View style={styles.header}>
        <View style={styles.headerLeft}>
          <Text style={styles.headerIcon}>🧠</Text>
          <Text style={styles.headerTitle}>Jogo da Memória</Text>
        </View>
        <Text style={styles.counter}>{matchedPairs}/{totalPairs} pares</Text>
      </View>

      {/* Progress */}
      <View style={styles.progressBg}>
        <View style={[styles.progressFill, { width: `${progress}%` }]} />
      </View>

      {/* Countdown */}
      {isShowingCards && (
        <View style={styles.countdownBox}>
          <Text style={styles.countdownLabel}>👁️ Memorize as posições!</Text>
          <Text style={styles.countdownNumber}>{countdown}</Text>
        </View>
      )}

      {/* Grid */}
      <ScrollView style={styles.gridScroll} nestedScrollEnabled>
        <View style={styles.grid}>
          {cards.map(card => (
            <TouchableOpacity
              key={card.id}
              style={[
                styles.gridCard,
                { width: cardSize, height: cardSize },
                (card.isFlipped || card.isMatched)
                  ? { backgroundColor: COLORS[card.colorIndex] }
                  : { backgroundColor: 'rgba(255,255,255,0.08)' },
                card.isMatched && styles.matchedCard,
              ]}
              onPress={() => handleCardClick(card.id)}
              disabled={!canFlip || card.isFlipped || card.isMatched}
              activeOpacity={0.7}
            />
          ))}
        </View>
      </ScrollView>

      {/* Restart */}
      {!isShowingCards && (
        <TouchableOpacity
          style={styles.restartButton}
          onPress={initializeGame}
          activeOpacity={0.8}
        >
          <Text style={styles.restartText}>Reiniciar Jogo</Text>
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
  countdownBox: {
    alignItems: 'center',
    padding: 14,
    backgroundColor: 'rgba(245,158,11,0.1)',
    borderRadius: 12,
    marginBottom: 14,
  },
  countdownLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: '#fff',
    marginBottom: 4,
  },
  countdownNumber: {
    fontSize: 28,
    fontWeight: '700',
    color: '#f59e0b',
  },
  gridScroll: {
    maxHeight: 320,
  },
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
  },
  gridCard: {
    borderRadius: 8,
  },
  matchedCard: {
    opacity: 0.5,
    borderWidth: 2,
    borderColor: '#22c55e',
  },
  restartButton: {
    marginTop: 14,
    height: 44,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.15)',
  },
  restartText: {
    fontSize: 15,
    fontWeight: '600',
    color: '#ccc',
  },
});
