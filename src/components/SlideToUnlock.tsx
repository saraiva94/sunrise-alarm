import React, {useRef, useState, useCallback, useMemo} from 'react';
import {
  View,
  Text,
  StyleSheet,
  Animated,
  PanResponder,
  Vibration,
  LayoutChangeEvent,
} from 'react-native';

interface SlideToUnlockProps {
  onUnlock: () => void;
  label?: string;
}

const THUMB_SIZE = 48;
const TRACK_PADDING = 4;
const UNLOCK_THRESHOLD = 0.9;

export function SlideToUnlock({onUnlock, label = 'Deslize para desligar'}: SlideToUnlockProps) {
  const [trackWidth, setTrackWidth] = useState(0);
  const [isUnlocking, setIsUnlocking] = useState(false);
  const translateX = useRef(new Animated.Value(0)).current;
  const trackWidthRef = useRef(0);

  const maxPosition = Math.max(0, trackWidth - THUMB_SIZE - TRACK_PADDING * 2);
  const maxPositionRef = useRef(maxPosition);
  maxPositionRef.current = maxPosition;

  const labelOpacity = useMemo(
    () =>
      maxPosition > 0
        ? translateX.interpolate({
            inputRange: [0, maxPosition * 0.5],
            outputRange: [1, 0],
            extrapolate: 'clamp',
          })
        : new Animated.Value(1),
    [translateX, maxPosition],
  );

  const progressWidth = Animated.add(translateX, THUMB_SIZE + TRACK_PADDING);

  const panResponder = useMemo(
    () =>
      PanResponder.create({
        onStartShouldSetPanResponder: () => !isUnlocking,
        onMoveShouldSetPanResponder: (_, g) => !isUnlocking && Math.abs(g.dx) > 5,
        onPanResponderGrant: () => {},
        onPanResponderMove: (_, gestureState) => {
          if (isUnlocking) return;
          const max = maxPositionRef.current;
          if (max <= 0) return;
          const newX = Math.min(Math.max(0, gestureState.dx), max);
          translateX.setValue(newX);
        },
        onPanResponderRelease: (_, gestureState) => {
          const max = maxPositionRef.current;
          if (max <= 0) return;

          const currentX = Math.min(Math.max(0, gestureState.dx), max);

          if (currentX >= max * UNLOCK_THRESHOLD) {
            setIsUnlocking(true);
            Animated.spring(translateX, {
              toValue: max,
              useNativeDriver: false,
            }).start();

            Vibration.vibrate([50, 30, 50]);

            setTimeout(() => {
              onUnlock();
            }, 300);
          } else {
            Animated.spring(translateX, {
              toValue: 0,
              friction: 7,
              tension: 40,
              useNativeDriver: false,
            }).start();
          }
        },
      }),
    [translateX, isUnlocking, onUnlock],
  );

  const handleLayout = useCallback((e: LayoutChangeEvent) => {
    const width = e.nativeEvent.layout.width;
    trackWidthRef.current = width;
    setTrackWidth(width);
  }, []);

  return (
    <View
      style={[styles.track, isUnlocking && styles.trackUnlocking]}
      onLayout={handleLayout}>
      {/* Progress glow */}
      <Animated.View
        style={[
          styles.progressGlow,
          {width: progressWidth},
        ]}
      />

      {/* Label */}
      <Animated.View style={[styles.labelContainer, {opacity: labelOpacity}]}>
        <Text style={styles.labelText}>›› {label} ››</Text>
      </Animated.View>

      {/* Thumb */}
      {trackWidth > 0 && (
        <Animated.View
          style={[
            styles.thumb,
            isUnlocking && styles.thumbUnlocking,
            {transform: [{translateX}]},
          ]}
          {...panResponder.panHandlers}>
          <Text style={styles.thumbIcon}>›</Text>
        </Animated.View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  track: {
    height: 56,
    borderRadius: 28,
    backgroundColor: 'rgba(255,255,255,0.08)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.12)',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  trackUnlocking: {
    backgroundColor: 'rgba(34,197,94,0.15)',
    borderColor: 'rgba(34,197,94,0.4)',
  },
  progressGlow: {
    position: 'absolute',
    top: 0,
    left: 0,
    bottom: 0,
    borderRadius: 28,
    backgroundColor: 'rgba(245,158,11,0.15)',
  },
  labelContainer: {
    position: 'absolute',
    left: 0,
    right: 0,
    top: 0,
    bottom: 0,
    alignItems: 'center',
    justifyContent: 'center',
  },
  labelText: {
    fontSize: 14,
    fontWeight: '500',
    color: '#888',
    letterSpacing: 0.5,
  },
  thumb: {
    position: 'absolute',
    top: TRACK_PADDING,
    left: TRACK_PADDING,
    width: THUMB_SIZE,
    height: THUMB_SIZE,
    borderRadius: THUMB_SIZE / 2,
    backgroundColor: '#f59e0b',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#f59e0b',
    shadowOffset: {width: 0, height: 2},
    shadowOpacity: 0.4,
    shadowRadius: 6,
    elevation: 6,
  },
  thumbUnlocking: {
    backgroundColor: '#22c55e',
  },
  thumbIcon: {
    fontSize: 24,
    fontWeight: '700',
    color: '#000',
  },
});
