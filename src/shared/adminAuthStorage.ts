type StoredAdminUser = Record<string, unknown> & {
  id?: number | string;
};

const ADMIN_USER_STORAGE_KEYS = ['adminUser'] as const;
const ADMIN_USER_ID_STORAGE_KEYS = ['adminUserId'] as const;
const ADMIN_TOKEN_STORAGE_KEYS = ['adminAuthToken'] as const;
const ADMIN_QUOTA_RECOVERY_STORAGE_KEYS = ['coach'] as const;
const MAX_STORED_STRING_LENGTH = 32 * 1024;

const hasWindow = () => typeof window !== 'undefined' && typeof window.localStorage !== 'undefined';

const toPositiveInteger = (value: unknown) => {
  const parsed = Number(value);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : null;
};

const isQuotaExceededError = (error: unknown) => {
  if (typeof DOMException !== 'undefined' && error instanceof DOMException) {
    return error.name === 'QuotaExceededError' || error.name === 'NS_ERROR_DOM_QUOTA_REACHED';
  }
  return false;
};

const parseStoredAdminUser = (raw: string | null): StoredAdminUser | null => {
  if (!raw) return null;

  try {
    const parsed = JSON.parse(raw);
    return parsed && typeof parsed === 'object' ? (parsed as StoredAdminUser) : null;
  } catch {
    return null;
  }
};

const removeStorageKeys = (keys: readonly string[]) => {
  if (!hasWindow()) return;
  keys.forEach((key) => {
    window.localStorage.removeItem(key);
  });
};

const sanitizeStoredAdminUser = (user: StoredAdminUser, userId: number | null) => {
  const normalizedUser = userId ? { ...user, id: userId } : { ...user };
  const next: StoredAdminUser = {};

  Object.entries(normalizedUser).forEach(([key, value]) => {
    if (value == null) {
      next[key] = value;
      return;
    }

    const lookupKey = String(key).trim().toLowerCase();
    if (lookupKey === 'password') return;

    if (typeof value === 'string') {
      const isProfileImageKey = lookupKey === 'profile_picture' || lookupKey === 'profile_photo';
      if (isProfileImageKey && value.startsWith('data:')) return;
      if (value.length > MAX_STORED_STRING_LENGTH) return;
      next[key] = value;
      return;
    }

    if (typeof value === 'number' || typeof value === 'boolean') {
      next[key] = value;
      return;
    }

    if (
      Array.isArray(value)
      && value.length <= 12
      && value.every((item) => item == null || ['string', 'number', 'boolean'].includes(typeof item))
    ) {
      next[key] = value;
    }
  });

  return next;
};

const syncStoredAdminUser = (user: StoredAdminUser, userId: number | null) => {
  if (!hasWindow()) return;

  const sanitizedUser = sanitizeStoredAdminUser(user, userId);

  try {
    ADMIN_USER_STORAGE_KEYS.forEach((key) => {
      window.localStorage.setItem(key, JSON.stringify(sanitizedUser));
    });
  } catch (error) {
    if (!isQuotaExceededError(error)) throw error;

    removeStorageKeys(ADMIN_QUOTA_RECOVERY_STORAGE_KEYS);
    ADMIN_USER_STORAGE_KEYS.forEach((key) => {
      window.localStorage.setItem(key, JSON.stringify(sanitizedUser));
    });
  }

  if (userId) {
    ADMIN_USER_ID_STORAGE_KEYS.forEach((key) => {
      window.localStorage.setItem(key, String(userId));
    });
    return;
  }

  removeStorageKeys(ADMIN_USER_ID_STORAGE_KEYS);
};

export const persistStoredAdminUser = (user: StoredAdminUser | null) => {
  if (!hasWindow()) return;
  if (!user || typeof user !== 'object') {
    clearStoredAdminSession();
    return;
  }

  const resolvedUserId = toPositiveInteger(user.id);
  syncStoredAdminUser(user, resolvedUserId);
};

export const persistStoredAdminSession = ({
  user,
  token,
}: {
  user: StoredAdminUser | null;
  token?: string | null;
}) => {
  if (!hasWindow()) return;
  if (!user || typeof user !== 'object') {
    clearStoredAdminSession();
    return;
  }

  persistStoredAdminUser(user);

  const normalizedToken = String(token || '').trim();
  if (normalizedToken) {
    ADMIN_TOKEN_STORAGE_KEYS.forEach((key) => {
      window.localStorage.setItem(key, normalizedToken);
    });
  } else {
    removeStorageKeys(ADMIN_TOKEN_STORAGE_KEYS);
  }
};

export const getStoredAdminUser = () => {
  if (!hasWindow()) return null;

  for (const key of ADMIN_USER_STORAGE_KEYS) {
    const parsed = parseStoredAdminUser(window.localStorage.getItem(key));
    if (parsed) return parsed;
  }

  return null;
};

export const getStoredAdminAuthToken = () => {
  if (!hasWindow()) return null;

  for (const key of ADMIN_TOKEN_STORAGE_KEYS) {
    const token = String(window.localStorage.getItem(key) || '').trim();
    if (token) return token;
  }

  return null;
};

export const clearStoredAdminSession = () => {
  if (!hasWindow()) return;

  removeStorageKeys([
    ...ADMIN_USER_STORAGE_KEYS,
    ...ADMIN_USER_ID_STORAGE_KEYS,
    ...ADMIN_TOKEN_STORAGE_KEYS,
    'coach',
    'coachId',
  ]);
};
