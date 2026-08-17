import { Capacitor } from '@capacitor/core';
import { PushNotifications, type PluginListenerHandle } from '@capacitor/push-notifications';
import { api } from './api';
import { getStoredAppUser, getStoredUserAuthToken } from '../shared/authStorage';
import { dispatchNotificationOpened, dispatchNotificationReceived } from './notificationEvents';

const TOKEN_STORAGE_KEY = 'repSetPushToken';
const DEVICE_ID_STORAGE_KEY = 'repSetPushDeviceId';
let listenerHandles: PluginListenerHandle[] = [];
let initializationPromise: Promise<boolean> | null = null;

const isNative = () => Capacitor.isNativePlatform();

const getDeviceId = () => {
  let id = localStorage.getItem(DEVICE_ID_STORAGE_KEY);
  if (!id) {
    id = globalThis.crypto?.randomUUID?.() || `device-${Date.now()}-${Math.random().toString(36).slice(2)}`;
    localStorage.setItem(DEVICE_ID_STORAGE_KEY, id);
  }
  return id;
};

const locale = () => String(getStoredAppUser()?.language || navigator.language || 'en').slice(0, 10);
const timezone = () => Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC';

const normalizePushPayload = (data: Record<string, unknown> = {}) => ({
  ...data,
  id: data.notificationId || data.id,
  entityId: data.entityId,
});

export const initializePushNotifications = async () => {
  if (!isNative() || !getStoredUserAuthToken()) return false;
  if (initializationPromise) return initializationPromise;

  initializationPromise = (async () => {
    await Promise.all(listenerHandles.map((handle) => handle.remove()));
    listenerHandles = [];

    listenerHandles.push(await PushNotifications.addListener('registration', async ({ value }) => {
      localStorage.setItem(TOKEN_STORAGE_KEY, value);
      try {
        await api.registerPushDevice({
          token: value,
          platform: Capacitor.getPlatform() === 'ios' ? 'ios' : 'android',
          deviceId: getDeviceId(),
          appVersion: '0.0.1',
          locale: locale(),
          timezone: timezone(),
        });
      } catch (error) {
        console.warn('Push device registration failed:', error instanceof Error ? error.message : 'Unknown error');
      }
    }));

    listenerHandles.push(await PushNotifications.addListener('registrationError', (error) => {
      console.warn('Push registration failed:', error?.error || 'Unknown error');
    }));

    listenerHandles.push(await PushNotifications.addListener('pushNotificationReceived', (notification) => {
      dispatchNotificationReceived(normalizePushPayload(notification.data || {}));
    }));

    listenerHandles.push(await PushNotifications.addListener('pushNotificationActionPerformed', (action) => {
      dispatchNotificationOpened(normalizePushPayload(action.notification.data || {}));
    }));

    let permission = await PushNotifications.checkPermissions();
    if (permission.receive === 'prompt' || permission.receive === 'prompt-with-rationale') {
      permission = await PushNotifications.requestPermissions();
    }
    if (permission.receive !== 'granted') return false;

    await PushNotifications.register();
    return true;
  })().finally(() => {
    initializationPromise = null;
  });

  return initializationPromise;
};

export const removePushNotificationListeners = async () => {
  await Promise.all(listenerHandles.map((handle) => handle.remove()));
  listenerHandles = [];
};

export const deactivateCurrentPushDevice = async () => {
  if (!isNative()) return;
  const token = localStorage.getItem(TOKEN_STORAGE_KEY);
  if (token && getStoredUserAuthToken()) {
    try {
      await api.deactivatePushDevice(token);
    } catch (error) {
      console.warn('Push device deactivation failed:', error instanceof Error ? error.message : 'Unknown error');
    }
  }
  localStorage.removeItem(TOKEN_STORAGE_KEY);
  await removePushNotificationListeners();
};
