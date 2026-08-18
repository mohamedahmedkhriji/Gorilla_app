const accountCreatedSoundUrl = new URL('../../assets/sound/SUCCESS ACOUNT CRETING.wav', import.meta.url).href;
const notificationSoundUrl = new URL('../../assets/sound/GET NOTIFICATION.wav', import.meta.url).href;

const playSound = (url: string) => {
  if (typeof window === 'undefined') return;

  const audio = new Audio(url);
  audio.preload = 'auto';
  audio.volume = 1;

  void audio.play().catch(() => {
    // Browsers may block automatic audio until the user has interacted with the app.
  });
};

export const playAccountCreatedSound = () => {
  playSound(accountCreatedSoundUrl);
};

export const playNotificationSound = () => {
  playSound(notificationSoundUrl);
};
