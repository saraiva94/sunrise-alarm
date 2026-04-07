import notifee, { TriggerType, TimestampTrigger, AndroidImportance, AndroidCategory, AndroidVisibility } from '@notifee/react-native';

export function validateURL(url: string): boolean {
  try {
    new URL(url);
    return true;
  } catch {
    return false;
  }
}

// Validates if URL is from a supported platform with autoplay
export function isSupportedMediaUrl(url: string): { supported: boolean; platform: string } {
  // YouTube (including shorts)
  if (url.match(/(?:youtube\.com\/(?:watch\?v=|embed\/|shorts\/)|youtu\.be\/)/)) {
    return { supported: true, platform: 'YouTube' };
  }

  // Vimeo
  if (url.match(/vimeo\.com\/\d+/)) {
    return { supported: true, platform: 'Vimeo' };
  }

  // Direct video files
  if (url.match(/\.(mp4|webm|ogg|mov)(\?|$)/i)) {
    return { supported: true, platform: 'Vídeo direto' };
  }

  // Direct audio files
  if (url.match(/\.(mp3|wav|ogg|m4a)(\?|$)/i)) {
    return { supported: true, platform: 'Áudio direto' };
  }

  // Supabase storage URLs (uploaded files)
  if (url.includes('supabase.co/storage')) {
    return { supported: true, platform: 'Upload' };
  }

  return { supported: false, platform: 'Não suportado' };
}

export async function requestNotificationPermission(): Promise<boolean> {
  const settings = await notifee.requestPermission();
  return settings.authorizationStatus >= 1;
}

export async function scheduleNotification(
  time: Date,
  url: string,
  purpose?: string,
  challengeType?: string | null,
  challengeDifficulty?: string | null,
  challengeEnabled?: boolean,
  alarmSoundUrl?: string,
  vibrateOnAlarm?: boolean
): Promise<string> {
  const now = new Date();
  const timeUntilAlarm = time.getTime() - now.getTime();

  if (timeUntilAlarm <= 0) {
    throw new Error('O horário do alarme já passou');
  }

  // Single channel — vibration always enabled at channel level
  const channelId = await notifee.createChannel({
    id: 'sunrise-alarm-v3',
    name: 'Alarme do Nascer do Sol',
    importance: AndroidImportance.HIGH,
    sound: 'default',
    vibration: true,
    vibrationPattern: [500, 500, 200, 500],
    bypassDnd: true,
    visibility: AndroidVisibility.PUBLIC,
  });

  // Create the trigger
  const trigger: TimestampTrigger = {
    type: TriggerType.TIMESTAMP,
    timestamp: time.getTime(),
    alarmManager: {
      allowWhileIdle: true,
    },
  };

  // Schedule the notification
  // Vibration controlled per-notification: pattern when on, undefined when off
  const notificationId = await notifee.createTriggerNotification(
    {
      title: 'Alarme do Nascer do Sol',
      body: purpose || 'Seu alarme está tocando!',
      android: {
        channelId,
        importance: AndroidImportance.HIGH,
        category: AndroidCategory.ALARM,
        visibility: AndroidVisibility.PUBLIC,
        vibrationPattern: vibrateOnAlarm !== false ? [500, 500, 200, 500] : undefined,
        pressAction: {
          id: 'default',
        },
        fullScreenAction: {
          id: 'default',
          launchActivity: 'default',
        },
        actions: [
          {
            title: 'Desligar',
            pressAction: {
              id: 'dismiss',
              launchActivity: 'default',
            },
          },
        ],
        sound: 'default',
        autoCancel: false,
        ongoing: true,
      },
      data: {
        url: url || alarmSoundUrl || '',
        purpose: purpose || '',
        challengeType: challengeType || '',
        challengeDifficulty: challengeDifficulty || '',
        challengeEnabled: challengeEnabled ? 'true' : 'false',
        alarmSoundUrl: alarmSoundUrl || '',
        type: 'sunrise-alarm',
        pendingAlarm: 'true',
      },
    },
    trigger,
  );

  return notificationId;
}

export async function cancelNotification(notificationId: string): Promise<void> {
  await notifee.cancelNotification(notificationId);
}
