import React from 'react';
import {View, StyleSheet, Text} from 'react-native';
import {useSubscription} from '@/hooks/useSubscription';

export function AdBanner() {
  const {isPremium} = useSubscription();

  if (isPremium) {
    return null;
  }

  return (
    <View style={styles.container}>
      <Text style={styles.placeholderText}>Espaco para anuncio</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    alignItems: 'center',
    paddingVertical: 8,
    backgroundColor: '#0a0a0a',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
  },
  placeholderText: {
    color: '#666',
    fontSize: 12,
    fontWeight: '500',
  },
});
