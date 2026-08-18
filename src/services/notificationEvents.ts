import { playNotificationSound } from './appSounds';

export interface NotificationEventPayload {
  id?: number | string;
  type?: string;
  route?: string;
  entityId?: string | number;
  [key: string]: unknown;
}

const seenIds = new Map<string, number>();
const DEDUPE_WINDOW_MS = 60_000;

const pruneSeenIds = () => {
  const cutoff = Date.now() - DEDUPE_WINDOW_MS;
  seenIds.forEach((timestamp, id) => {
    if (timestamp < cutoff) seenIds.delete(id);
  });
};

export const dispatchNotificationReceived = (payload: NotificationEventPayload) => {
  if (typeof window === 'undefined') return false;
  pruneSeenIds();
  const id = String(payload?.id || '').trim();
  if (id && seenIds.has(id)) return false;
  if (id) seenIds.set(id, Date.now());
  playNotificationSound();
  window.dispatchEvent(new CustomEvent('repset:notification:new', { detail: payload }));
  return true;
};

export const dispatchNotificationOpened = (payload: NotificationEventPayload) => {
  if (typeof window === 'undefined') return;
  window.dispatchEvent(new CustomEvent('repset:notification:open', { detail: payload }));
};
