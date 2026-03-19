type StoredAdminUser = Record<string, unknown> & {
  id?: number | string;
};

const ADMIN_USER_STORAGE_KEYS = ['adminUser'] as const;
const ADMIN_USER_ID_STORAGE_KEYS = ['adminUserId'] as const;
const ADMIN_TOKEN_STORAGE_KEYS = ['adminAuthToken'] as const;

const hasWindow = () => typeof window !== 'undefined' && typeof window.localStorage !== 'undefined';

const toPositiveInteger = (value: unknown) => {
  const parsed = Number(value);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : null;
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

const syncStoredAdminUser = (user: StoredAdminUser, userId: number | null) => {
  if (!hasWindow()) return;

  const normalizedUser = userId ? { ...user, id: userId } : { ...user };
  const serializedUser = JSON.stringify(normalizedUser);

  ADMIN_USER_STORAGE_KEYS.forEach((key) => {
    window.localStorage.setItem(key, serializedUser);
  });

  if (userId) {
    ADMIN_USER_ID_STORAGE_KEYS.forEach((key) => {
      window.localStorage.setItem(key, String(userId));
    });
    return;
  }

  ADMIN_USER_ID_STORAGE_KEYS.forEach((key) => {
    window.localStorage.removeItem(key);
  });
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

  const resolvedUserId = toPositiveInteger(user.id);
  syncStoredAdminUser(user, resolvedUserId);

  const normalizedToken = String(token || '').trim();
  if (normalizedToken) {
    ADMIN_TOKEN_STORAGE_KEYS.forEach((key) => {
      window.localStorage.setItem(key, normalizedToken);
    });
  } else {
    ADMIN_TOKEN_STORAGE_KEYS.forEach((key) => {
      window.localStorage.removeItem(key);
    });
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

  [...ADMIN_USER_STORAGE_KEYS, ...ADMIN_USER_ID_STORAGE_KEYS, ...ADMIN_TOKEN_STORAGE_KEYS, 'coach', 'coachId'].forEach((key) => {
    window.localStorage.removeItem(key);
  });
};
