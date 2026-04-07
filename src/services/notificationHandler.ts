import notifee, {EventType, Event} from '@notifee/react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import {navigationRef} from '@/navigation/AppNavigator';

const PENDING_ALARM_KEY = 'pending_alarm_notification';

// In-memory fallback if AsyncStorage fails
let pendingAlarmInMemory: Record<string, string | undefined> | null = null;

function isAlarmNotification(data: Record<string, string | undefined>): boolean {
  return data.type === 'sunrise-alarm' || data.isSleepAlert === 'true';
}

function isUserAuthenticated(): boolean {
  if (!navigationRef.isReady()) return false;

  const state = navigationRef.getRootState();
  if (!state?.routes?.length) return false;

  return state.routes[0]?.name !== 'Auth';
}

function isAlreadyOnAlarmScreen(): boolean {
  if (!navigationRef.isReady()) return false;
  const state = navigationRef.getRootState();
  const currentRoute = state?.routes?.[state.routes.length - 1]?.name;
  return currentRoute === 'AlarmActive' || currentRoute === 'SleepAlarmActive';
}

function doNavigate(data: Record<string, string | undefined>) {
  // Prevent duplicate navigation if already on an alarm screen
  if (isAlreadyOnAlarmScreen()) return;

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

/**
 * Save alarm data to AsyncStorage so AppNavigator can pick it up on mount.
 * This covers cold start, warm start, and background→foreground transitions.
 */
export async function savePendingAlarm(data: Record<string, string | undefined>) {
  pendingAlarmInMemory = data;
  try {
    await AsyncStorage.setItem(PENDING_ALARM_KEY, JSON.stringify(data));
  } catch {
    // In-memory fallback is already set
  }
}

/**
 * Check and consume a pending alarm from AsyncStorage.
 * Called by AppNavigator when the authenticated stack mounts.
 */
export async function consumePendingAlarm(): Promise<Record<string, string | undefined> | null> {
  // Check in-memory first (faster, covers warm start)
  if (pendingAlarmInMemory) {
    const data = pendingAlarmInMemory;
    pendingAlarmInMemory = null;
    try {
      await AsyncStorage.removeItem(PENDING_ALARM_KEY);
    } catch {
      // ignore
    }
    return data;
  }

  // Check AsyncStorage (covers cold start)
  try {
    const raw = await AsyncStorage.getItem(PENDING_ALARM_KEY);
    if (raw) {
      await AsyncStorage.removeItem(PENDING_ALARM_KEY);
      return JSON.parse(raw);
    }
  } catch {
    // ignore
  }

  return null;
}

/**
 * Try to navigate immediately if the app is ready and user is authenticated.
 * If not ready, retry up to 10 times with 500ms intervals.
 */
function tryNavigateNow(data: Record<string, string | undefined>): void {
  if (navigationRef.isReady() && isUserAuthenticated()) {
    doNavigate(data);
    return;
  }

  // Navigation not ready yet — retry with backoff
  let retries = 0;
  const maxRetries = 10;
  const retryInterval = setInterval(() => {
    retries++;
    if (navigationRef.isReady() && isUserAuthenticated()) {
      clearInterval(retryInterval);
      doNavigate(data);
    } else if (retries >= maxRetries) {
      clearInterval(retryInterval);
      // Ensure data is persisted so processPendingAlarm can pick it up later
      savePendingAlarm(data);
    }
  }, 500);
}

/**
 * Handle foreground notification events.
 * Registered in App.tsx via notifee.onForegroundEvent().
 */
export function handleForegroundEvent({type, detail}: Event) {
  const {notification} = detail;
  if (!notification?.data) return;

  const data = notification.data as Record<string, string | undefined>;
  if (!isAlarmNotification(data)) return;

  switch (type) {
    case EventType.DELIVERED:
      // Alarm just fired while app is in foreground — navigate immediately
      savePendingAlarm(data);
      tryNavigateNow(data);
      break;
    case EventType.PRESS:
      // User tapped the notification
      savePendingAlarm(data);
      tryNavigateNow(data);
      break;
    case EventType.ACTION_PRESS: {
      // User pressed "Desligar" button
      const actionId = detail.pressAction?.id;
      if (actionId === 'dismiss' || actionId === 'default') {
        savePendingAlarm(data);
        tryNavigateNow(data);
      }
      break;
    }
  }
}

/**
 * Handle background notification events.
 * Registered in index.js via notifee.onBackgroundEvent().
 * React tree may not be mounted yet — just persist, don't navigate.
 */
export async function handleBackgroundEvent({type, detail}: Event) {
  const {notification} = detail;
  if (!notification?.data) return;

  const data = notification.data as Record<string, string | undefined>;
  if (!isAlarmNotification(data)) return;

  switch (type) {
    case EventType.DELIVERED:
    case EventType.PRESS:
    case EventType.ACTION_PRESS:
      // Persist so AppNavigator picks it up when the React tree mounts
      await savePendingAlarm(data);
      break;
  }
}

/**
 * Check if the app was opened from a killed state by a notification.
 * Called by AppNavigator after auth resolves.
 */
export async function checkInitialNotification() {
  const initialNotification = await notifee.getInitialNotification();
  if (initialNotification?.notification?.data) {
    const data = initialNotification.notification.data as Record<string, string | undefined>;
    if (isAlarmNotification(data)) {
      await savePendingAlarm(data);
    }
  }
}
