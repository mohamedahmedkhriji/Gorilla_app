type NotificationSettings = {
  coachMessages: boolean;
  restTimer: boolean;
  missionChallenge: boolean;
};

const DEFAULT_NOTIFICATION_SETTINGS: NotificationSettings = {
  coachMessages: true,
  restTimer: true,
  missionChallenge: true,
};

export const getCachedNotificationSettings = (): NotificationSettings => {
  try {
    const raw = localStorage.getItem('notificationSettings');
    if (!raw) return DEFAULT_NOTIFICATION_SETTINGS;
    const parsed = JSON.parse(raw);
    return {
      coachMessages: parsed?.coachMessages !== false,
      restTimer: parsed?.restTimer !== false,
      missionChallenge: parsed?.missionChallenge !== false,
    };
  } catch {
    return DEFAULT_NOTIFICATION_SETTINGS;
  }
};

export const sendBrowserNotification = (title: string, options?: NotificationOptions) => {
  if (typeof window === 'undefined' || !('Notification' in window)) return;

  const show = () => {
    try {
      new Notification(title, options);
    } catch {
      // ignore browser notification errors
    }
  };

  if (Notification.permission === 'granted') {
    show();
    return;
  }

  if (Notification.permission === 'default') {
    void Notification.requestPermission()
      .then((permission) => {
        if (permission === 'granted') show();
      })
      .catch(() => {
        // ignore permission request failures
      });
  }
};
