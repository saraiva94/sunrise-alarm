import React, {useEffect, useRef} from 'react';
import {Animated, Easing, StyleSheet, View, Text} from 'react-native';

const RAYS_COUNT = 8;
const RAY_ANGLES = Array.from({length: RAYS_COUNT}, (_, i) => (i * 360) / RAYS_COUNT);

export function SplashScreen({onFinish}: {onFinish: () => void}) {
  const sunScale = useRef(new Animated.Value(0.3)).current;
  const raysRotation = useRef(new Animated.Value(0)).current;
  const textOpacity = useRef(new Animated.Value(0)).current;
  const screenOpacity = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    const sunAnim = Animated.timing(sunScale, {
      toValue: 1,
      duration: 1500,
      easing: Easing.out(Easing.back(1.2)),
      useNativeDriver: true,
    });
    sunAnim.start();

    const raysAnim = Animated.loop(
      Animated.timing(raysRotation, {
        toValue: 1,
        duration: 4000,
        easing: Easing.linear,
        useNativeDriver: true,
      }),
    );
    raysAnim.start();

    const textAnim = Animated.timing(textOpacity, {
      toValue: 1,
      duration: 1000,
      delay: 500,
      useNativeDriver: true,
    });
    textAnim.start();

    const timeout = setTimeout(() => {
      Animated.timing(screenOpacity, {
        toValue: 0,
        duration: 400,
        useNativeDriver: true,
      }).start(() => onFinish());
    }, 2500);

    return () => {
      clearTimeout(timeout);
      sunAnim.stop();
      raysAnim.stop();
      textAnim.stop();
    };
  }, [sunScale, raysRotation, textOpacity, screenOpacity, onFinish]);

  const raysRotate = raysRotation.interpolate({
    inputRange: [0, 1],
    outputRange: ['0deg', '360deg'],
  });

  return (
    <Animated.View style={[styles.container, {opacity: screenOpacity}]}>
      {/* Sun + Rays */}
      <View style={styles.sunArea}>
        {/* Rotating rays */}
        <Animated.View
          style={[styles.raysContainer, {transform: [{rotate: raysRotate}]}]}>
          {RAY_ANGLES.map((angle, i) => (
            <View
              key={i}
              style={[
                styles.ray,
                {transform: [{rotate: `${angle}deg`}, {translateY: -52}]},
              ]}
            />
          ))}
        </Animated.View>

        {/* Sun circle */}
        <Animated.View
          style={[styles.sun, {transform: [{scale: sunScale}]}]}
        />
      </View>

      {/* Text */}
      <Animated.View style={[styles.textContainer, {opacity: textOpacity}]}>
        <Text style={styles.title}>Alarme Solar</Text>
        <Text style={styles.loading}>Carregando...</Text>
      </Animated.View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  container: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: '#0d1f3c',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 999,
  },
  sunArea: {
    width: 140,
    height: 140,
    alignItems: 'center',
    justifyContent: 'center',
  },
  raysContainer: {
    ...StyleSheet.absoluteFillObject,
    alignItems: 'center',
    justifyContent: 'center',
  },
  ray: {
    position: 'absolute',
    width: 3,
    height: 22,
    borderRadius: 2,
    backgroundColor: '#f59e0b',
    opacity: 0.6,
  },
  sun: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: '#f59e0b',
    shadowColor: '#f59e0b',
    shadowOffset: {width: 0, height: 0},
    shadowOpacity: 0.8,
    shadowRadius: 20,
    elevation: 12,
  },
  textContainer: {
    alignItems: 'center',
    marginTop: 32,
  },
  title: {
    fontSize: 28,
    fontWeight: '800',
    color: '#f59e0b',
    letterSpacing: 1,
  },
  loading: {
    fontSize: 14,
    color: '#777',
    marginTop: 8,
  },
});
