import { Capacitor, registerPlugin } from '@capacitor/core';

type ScreenshotSecurityPlugin = {
  setEnabled(options: { enabled: boolean }): Promise<{ enabled: boolean }>;
};

const ScreenshotSecurity = registerPlugin<ScreenshotSecurityPlugin>('ScreenshotSecurity');

let activeProtectionLocks = 0;
let appliedProtectionState = false;
let pendingProtectionUpdate: Promise<void> = Promise.resolve();

const supportsNativeScreenshotProtection = () =>
  Capacitor.isNativePlatform() && ['android', 'ios'].includes(Capacitor.getPlatform());

const queueProtectionUpdate = (enabled: boolean) => {
  pendingProtectionUpdate = pendingProtectionUpdate
    .catch(() => undefined)
    .then(async () => {
      if (!supportsNativeScreenshotProtection()) return;
      if (enabled === appliedProtectionState) return;

      try {
        await ScreenshotSecurity.setEnabled({ enabled });
        appliedProtectionState = enabled;
      } catch (error) {
        console.warn('Failed to update screenshot protection state.', error);
      }
    });

  return pendingProtectionUpdate;
};

export const enableScreenshotProtection = () => {
  activeProtectionLocks += 1;
  return queueProtectionUpdate(true);
};

export const disableScreenshotProtection = () => {
  activeProtectionLocks = Math.max(0, activeProtectionLocks - 1);
  return queueProtectionUpdate(activeProtectionLocks > 0);
};
