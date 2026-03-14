type StoredUser = Record<string, unknown> & {
  id?: number | string;
  userId?: number | string;
};

const USER_STORAGE_KEYS = ['appUser', 'user'] as const;
const USER_ID_STORAGE_KEYS = ['appUserId', 'userId'] as const;

const hasWindow = () => typeof window !== 'undefined' && typeof window.localStorage !== 'undefined';

const toPositiveInteger = (value: unknown) => {
  const parsed = Number(value);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : null;
};

const parseStoredUser = (raw: string | null): StoredUser | null => {
  if (!raw) return null;

  try {
    const parsed = JSON.parse(raw);
    return parsed && typeof parsed === 'object' ? (parsed as StoredUser) : null;
  } catch {
    return null;
  }
};

const readStoredUser = () => {
  if (!hasWindow()) return null;

  for (const key of USER_STORAGE_KEYS) {
    const parsed = parseStoredUser(window.localStorage.getItem(key));
    if (parsed) return parsed;
  }

  return null;
};

const readStoredUserId = () => {
  if (!hasWindow()) return null;

  for (const key of USER_ID_STORAGE_KEYS) {
    const parsed = toPositiveInteger(window.localStorage.getItem(key));
    if (parsed) return parsed;
  }

  return null;
};

const syncStoredUser = (user: StoredUser, userId: number | null) => {
  if (!hasWindow()) return;

  const normalizedUser = userId ? { ...user, id: userId } : { ...user };
  const serializedUser = JSON.stringify(normalizedUser);

  USER_STORAGE_KEYS.forEach((key) => {
    window.localStorage.setItem(key, serializedUser);
  });

  if (userId) {
    USER_ID_STORAGE_KEYS.forEach((key) => {
      window.localStorage.setItem(key, String(userId));
    });
    return;
  }

  USER_ID_STORAGE_KEYS.forEach((key) => {
    window.localStorage.removeItem(key);
  });
};

export const getStoredAppUser = (): StoredUser | null => {
  const storedUser = readStoredUser();
  if (!storedUser) return null;

  const storedUserId = readStoredUserId();
  const userIdFromObject = toPositiveInteger(storedUser.id ?? storedUser.userId);
  const resolvedUserId = userIdFromObject ?? storedUserId;

  if (resolvedUserId) {
    syncStoredUser(storedUser, resolvedUserId);
    return { ...storedUser, id: resolvedUserId };
  }

  return storedUser;
};

export const getStoredUserId = () => {
  const storedUser = readStoredUser();
  const storedUserId = readStoredUserId();
  const userIdFromObject = toPositiveInteger(storedUser?.id ?? storedUser?.userId);
  const resolvedUserId = userIdFromObject ?? storedUserId;

  if (storedUser && resolvedUserId) {
    syncStoredUser(storedUser, resolvedUserId);
  }

  return resolvedUserId;
};

export const persistStoredUser = (user: StoredUser | null) => {
  if (!hasWindow()) return;
  if (!user || typeof user !== 'object') {
    clearStoredUserSession();
    return;
  }

  const resolvedUserId = toPositiveInteger(user.id ?? user.userId);
  syncStoredUser(user, resolvedUserId);
};

export const clearStoredUserSession = () => {
  if (!hasWindow()) return;

  [...USER_STORAGE_KEYS, ...USER_ID_STORAGE_KEYS].forEach((key) => {
    window.localStorage.removeItem(key);
  });
};
