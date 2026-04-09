import React, {useState, useEffect} from 'react';
import {StatusBar} from 'react-native';
import {GestureHandlerRootView} from 'react-native-gesture-handler';
import {SafeAreaProvider} from 'react-native-safe-area-context';
import {QueryClient, QueryClientProvider} from '@tanstack/react-query';
import Toast from 'react-native-toast-message';
import notifee from '@notifee/react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import {AppNavigator} from './src/navigation/AppNavigator';
import {AuthProvider} from './src/hooks/useAuth';
import {ThemeProvider} from './src/hooks/useTheme';
import {SubscriptionProvider} from './src/hooks/useSubscription';
import {SplashScreen} from './src/components/SplashScreen';
import {handleForegroundEvent} from './src/services/notificationHandler';

const queryClient = new QueryClient();

export default function App() {
  const [showSplash, setShowSplash] = useState(true);

  useEffect(() => {
    return notifee.onForegroundEvent(handleForegroundEvent);
  }, []);

  // Skip splash screen if there's a pending alarm (user needs to see AlarmActive immediately)
  useEffect(() => {
    async function checkPendingAlarm() {
      try {
        const initialNotification = await notifee.getInitialNotification();
        if (initialNotification?.notification?.data) {
          setShowSplash(false);
          return;
        }
        const pending = await AsyncStorage.getItem('pending_alarm_notification');
        if (pending) {
          setShowSplash(false);
        }
      } catch {
        // ignore — splash will show normally
      }
    }
    checkPendingAlarm();
  }, []);

  return (
    <GestureHandlerRootView style={{flex: 1}}>
      <SafeAreaProvider>
        <QueryClientProvider client={queryClient}>
          <ThemeProvider>
            <AuthProvider>
              <SubscriptionProvider>
                <StatusBar barStyle="light-content" backgroundColor="#000000" />
                {showSplash && <SplashScreen onFinish={() => setShowSplash(false)} />}
                <AppNavigator />
                <Toast />
              </SubscriptionProvider>
            </AuthProvider>
          </ThemeProvider>
        </QueryClientProvider>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}
