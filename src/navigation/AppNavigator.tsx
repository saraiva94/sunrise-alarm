import React, {useEffect, useRef, useCallback} from 'react';
import {NavigationContainer, createNavigationContainerRef} from '@react-navigation/native';
import {createStackNavigator} from '@react-navigation/stack';
import {ActivityIndicator, AppState, View} from 'react-native';
import {checkInitialNotification, consumePendingAlarm} from '@/services/notificationHandler';
import AuthScreen from '@/screens/Auth';
import AlarmScreen from '@/screens/Alarm';
import HomeScreen from '@/screens/Home';
import AlarmActiveScreen from '@/screens/AlarmActive';
import SleepAlarmActiveScreen from '@/screens/SleepAlarmActive';
import ProfileScreen from '@/screens/Profile';
import RankingScreen from '@/screens/Ranking';
import PlansScreen from '@/screens/Plans';
import AdminScreen from '@/screens/Admin';
import ResetPasswordScreen from '@/screens/ResetPassword';
import {useAuth} from '@/hooks/useAuth';

export type RootStackParamList = {
  Home: {editAlarm?: any} | undefined;
  Auth: undefined;
  Alarm: undefined;
  AlarmActive: {
    url: string;
    purpose?: string;
    challengeType?: string;
    challengeDifficulty?: string;
    challengeEnabled?: boolean;
    alarmSoundUrl?: string;
  };
  Profile: undefined;
  Ranking: undefined;
  Plans: undefined;
  SleepAlarmActive: {
    url: string;
    purpose?: string;
    isSleepAlert?: boolean;
    alertType?: string;
  };
  Admin: undefined;
  ResetPassword: undefined;
};

export const navigationRef = createNavigationContainerRef<RootStackParamList>();

const Stack = createStackNavigator<RootStackParamList>();
const linking = {
  prefixes: ['sunrisealarm://'],
  config: {
    screens: {
      Auth: 'auth-callback',
      Home: 'home',
      ResetPassword: 'reset-password',
    },
  },
};

export function AppNavigator() {
  const {user, loading} = useAuth();
  const processingRef = useRef(false);

  const processPendingAlarm = useCallback(async () => {
    // Prevent concurrent processing
    if (processingRef.current) return;
    processingRef.current = true;

    try {
      // First, check if the app was opened by a notification (cold start)
      await checkInitialNotification();

      // Then consume any pending alarm (from background, foreground, or initial)
      const data = await consumePendingAlarm();
      if (data && navigationRef.isReady()) {
        // Skip if already on an alarm screen (prevents duplicate navigation)
        const state = navigationRef.getRootState();
        const currentRoute = state?.routes?.[state.routes.length - 1]?.name;
        if (currentRoute === 'AlarmActive' || currentRoute === 'SleepAlarmActive') {
          return;
        }

        if (data.isSleepAlert === 'true') {
          navigationRef.reset({
            index: 0,
            routes: [{
              name: 'SleepAlarmActive',
              params: {
                url: data.url || '',
                purpose: data.purpose,
                isSleepAlert: true,
                alertType: data.alertType,
              },
            }],
          });
        } else {
          navigationRef.reset({
            index: 0,
            routes: [{
              name: 'AlarmActive',
              params: {
                url: data.url || '',
                purpose: data.purpose,
                challengeType: data.challengeType,
                challengeDifficulty: data.challengeDifficulty,
                challengeEnabled: data.challengeEnabled === 'true',
                alarmSoundUrl: data.alarmSoundUrl || '',
              },
            }],
          });
        }
      }
    } finally {
      processingRef.current = false;
    }
  }, []);

  // When NavigationContainer is ready, check for pending alarms
  const handleNavigationReady = useCallback(() => {
    if (user) {
      processPendingAlarm();
    }
  }, [user, processPendingAlarm]);

  // On mount and when auth resolves: check for pending alarm
  useEffect(() => {
    if (!loading && user && navigationRef.isReady()) {
      processPendingAlarm();
    }
  }, [loading, user, processPendingAlarm]);

  // On app returning from background: check for pending alarm
  useEffect(() => {
    if (!user) return;

    const subscription = AppState.addEventListener('change', nextState => {
      if (nextState === 'active') {
        // Small delay to ensure background handler has saved the data
        setTimeout(() => processPendingAlarm(), 300);
      }
    });

    return () => subscription.remove();
  }, [user, processPendingAlarm]);

  if (loading) {
    return (
      <View
        style={{
          flex: 1,
          backgroundColor: '#0a0a0a',
          alignItems: 'center',
          justifyContent: 'center',
        }}>
        <ActivityIndicator size="large" color="#f59e0b" />
      </View>
    );
  }

  return (
    <NavigationContainer
      ref={navigationRef}
      linking={linking}
      onReady={handleNavigationReady}>
      <Stack.Navigator
        screenOptions={{
          headerShown: false,
          cardStyle: {backgroundColor: '#0a0a0a'},
        }}>
        {!user ? (
          <>
            <Stack.Screen name="Auth" component={AuthScreen} />
            <Stack.Screen
              name="ResetPassword"
              component={ResetPasswordScreen}
            />
          </>
        ) : (
          <>
            <Stack.Screen name="Home" component={HomeScreen} />
            <Stack.Screen name="Alarm" component={AlarmScreen} />
            <Stack.Screen name="AlarmActive" component={AlarmActiveScreen} />
            <Stack.Screen name="Profile" component={ProfileScreen} />
            <Stack.Screen name="Ranking" component={RankingScreen} />
            <Stack.Screen name="Plans" component={PlansScreen} />
            <Stack.Screen
              name="SleepAlarmActive"
              component={SleepAlarmActiveScreen}
            />
            <Stack.Screen name="Admin" component={AdminScreen} />
          </>
        )}
      </Stack.Navigator>
    </NavigationContainer>
  );
}
