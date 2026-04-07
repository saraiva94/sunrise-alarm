import {useState} from 'react';

// Placeholder ate AdMob nativo ser integrado
export function useAlarmInterstitial() {
  const [isLoaded] = useState(false);

  const load = () => {};
  const show = () => {};

  return {isLoaded, load, show};
}
