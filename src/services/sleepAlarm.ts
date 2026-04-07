import notifee, {
  TriggerType,
  TimestampTrigger,
  AndroidImportance,
} from '@notifee/react-native';

export interface SleepAlertConfig {
  time: Date;
  url: string;
  message: string;
  alertType: '90' | '60' | '30';
}

export async function scheduleSleepAlerts(
  alerts: SleepAlertConfig[],
): Promise<string[]> {
  const notificationIds: string[] = [];

  // Create a channel for Android
  const channelId = await notifee.createChannel({
    id: 'sleep-alerts',
    name: 'Alertas de Sono',
    importance: AndroidImportance.HIGH,
    sound: 'default',
    vibration: true,
    vibrationPattern: [500, 500, 200, 500],
  });

  for (const alert of alerts) {
    const now = new Date();
    const timeUntilAlert = alert.time.getTime() - now.getTime();

    if (timeUntilAlert <= 0) {
      continue;
    }

    const trigger: TimestampTrigger = {
      type: TriggerType.TIMESTAMP,
      timestamp: alert.time.getTime(),
      alarmManager: {
        allowWhileIdle: true,
      },
    };

    const notificationId = await notifee.createTriggerNotification(
      {
        title: 'Hora de Descansar 🌙',
        body: alert.message,
        android: {
          channelId,
          importance: AndroidImportance.HIGH,
          pressAction: {
            id: 'default',
          },
          sound: 'default',
          tag: `sleep-alert-${alert.alertType}`,
        },
        data: {
          url: alert.url,
          purpose: alert.message,
          isSleepAlert: 'true',
          alertType: alert.alertType,
          type: 'sleep-alert',
        },
      },
      trigger,
    );

    notificationIds.push(notificationId);
  }

  return notificationIds;
}

export async function cancelSleepAlerts(
  notificationIds: string[],
): Promise<void> {
  for (const id of notificationIds) {
    await notifee.cancelNotification(id);
  }
}

export function calculateSleepAlertTimes(
  wakeUpTime: Date,
  sleepHours: number,
  anticipationEnabled: boolean,
): {
  sleepTime: Date;
  alert90: Date;
  alert60: Date;
  alert30: Date;
} {
  const wakeTime = new Date(wakeUpTime);

  // Adjust for anticipation (15 min before to see sunrise)
  if (anticipationEnabled) {
    wakeTime.setMinutes(wakeTime.getMinutes() - 15);
  }

  // Calculate when to fall asleep (wake time - sleep hours)
  const sleepTime = new Date(wakeTime);
  sleepTime.setHours(sleepTime.getHours() - sleepHours);

  // Calculate alert times (before sleep time)
  const alert90 = new Date(sleepTime);
  alert90.setMinutes(alert90.getMinutes() - 90);

  const alert60 = new Date(sleepTime);
  alert60.setMinutes(alert60.getMinutes() - 60);

  const alert30 = new Date(sleepTime);
  alert30.setMinutes(alert30.getMinutes() - 30);

  return {
    sleepTime,
    alert90,
    alert60,
    alert30,
  };
}
