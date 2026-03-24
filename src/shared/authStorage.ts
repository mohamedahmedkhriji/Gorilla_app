type StoredUser = Record<string, unknown> & {
  id?: number | string;
  userId?: number | string;
};

const PRIMARY_USER_STORAGE_KEY = 'appUser';
const LEGACY_USER_STORAGE_KEYS = ['user'] as const;
const PRIMARY_USER_ID_STORAGE_KEY = 'appUserId';
const LEGACY_USER_ID_STORAGE_KEYS = ['userId'] as const;
const PRIMARY_USER_TOKEN_STORAGE_KEY = 'appAuthToken';
const LEGACY_USER_TOKEN_STORAGE_KEYS = ['authToken'] as const;

const MAX_STORED_STRING_LENGTH = 32 * 1024;
const QUOTA_RECOVERY_STORAGE_KEYS = [
  'assignedProgramTemplate',
  'onboardingCoachPlan',
  'onboardingCustomAdvice',
  'onboardingPlanWarning',
  'onboardingPlanSource',
  'activeProgram',
  'programHistory',
  'progressPhotos',
  'bodyMeasurements',
] as const;
const OMITTED_USER_KEYS = new Set([
  'password',
  'body_image',
  'body_image_front',
  'body_image_back',
  'body_image_side',
  'body_image_data',
  'body_analysis',
  'analysis',
  'assignedprogram',
  'claudeplan',
]);
const MINIMAL_USER_KEYS = new Set([
  'id',
  'userId',
  'role',
  'email',
  'name',
  'firstName',
  'onboarding_completed',
  'first_login',
  'gym_id',
  'coach_id',
  'is_active',
  'age',
  'gender',
  'height',
  'height_cm',
  'weight',
  'weight_kg',
  'primaryGoal',
  'primary_goal',
  'fitnessGoal',
  'fitness_goal',
  'experienceLevel',
  'experience_level',
  'workoutDays',
  'workout_days',
  'sessionDuration',
  'session_duration_minutes',
  'preferredTime',
  'preferred_time',
  'workoutSplitPreference',
  'workout_split_preference',
  'workoutSplitLabel',
  'workout_split_label',
  'language',
  'rank',
  'total_points',
  'total_workouts',
]);

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

  const keys = [PRIMARY_USER_STORAGE_KEY, ...LEGACY_USER_STORAGE_KEYS];
  for (const key of keys) {
    const parsed = parseStoredUser(window.localStorage.getItem(key));
    if (parsed) return parsed;
  }

  return null;
};

const readStoredUserId = () => {
  if (!hasWindow()) return null;

  const keys = [PRIMARY_USER_ID_STORAGE_KEY, ...LEGACY_USER_ID_STORAGE_KEYS];
  for (const key of keys) {
    const parsed = toPositiveInteger(window.localStorage.getItem(key));
    if (parsed) return parsed;
  }

  return null;
};

const removeStorageKeys = (keys: readonly string[]) => {
  if (!hasWindow()) return;
  keys.forEach((key) => {
    window.localStorage.removeItem(key);
  });
};

const sanitizeStoredUser = (user: StoredUser, userId: number | null): StoredUser => {
  const normalizedUser = userId ? { ...user, id: userId } : { ...user };
  const next: StoredUser = {};

  Object.entries(normalizedUser).forEach(([key, value]) => {
    if (value == null) {
      next[key] = value;
      return;
    }

    const normalizedKey = String(key).trim();
    const lookupKey = normalizedKey.toLowerCase();
    if (OMITTED_USER_KEYS.has(lookupKey)) return;

    if (typeof value === 'string') {
      const isProfileImageKey = lookupKey === 'profile_picture' || lookupKey === 'profile_photo';
      if (isProfileImageKey && value.startsWith('data:')) return;
      if (value.length > MAX_STORED_STRING_LENGTH) return;
      next[normalizedKey] = value;
      return;
    }

    if (typeof value === 'number' || typeof value === 'boolean') {
      next[normalizedKey] = value;
      return;
    }

    if (
      Array.isArray(value)
      && value.length <= 12
      && value.every((item) => item == null || ['string', 'number', 'boolean'].includes(typeof item))
    ) {
      next[normalizedKey] = value;
    }
  });

  return next;
};

const buildMinimalStoredUser = (user: StoredUser, userId: number | null): StoredUser => {
  const sanitized = sanitizeStoredUser(user, userId);
  const minimal: StoredUser = {};

  Object.entries(sanitized).forEach(([key, value]) => {
    if (MINIMAL_USER_KEYS.has(key)) {
      minimal[key] = value;
    }
  });

  if (userId) {
    minimal.id = userId;
  }

  return minimal;
};

const writeStoredUserPayload = (user: StoredUser) => {
  if (!hasWindow()) return;
  removeStorageKeys(LEGACY_USER_STORAGE_KEYS);
  window.localStorage.setItem(PRIMARY_USER_STORAGE_KEY, JSON.stringify(user));
};

const syncStoredUser = (user: StoredUser, userId: number | null) => {
  if (!hasWindow()) return;

  const sanitizedUser = sanitizeStoredUser(user, userId);

  try {
    writeStoredUserPayload(sanitizedUser);
  } catch (error) {
    if (!isQuotaExceededError(error)) throw error;

    // Prefer a minimal authenticated session over stale cached program artifacts.
    removeStorageKeys(QUOTA_RECOVERY_STORAGE_KEYS);
    writeStoredUserPayload(buildMinimalStoredUser(sanitizedUser, userId));
  }

  if (userId) {
    removeStorageKeys(LEGACY_USER_ID_STORAGE_KEYS);
    window.localStorage.setItem(PRIMARY_USER_ID_STORAGE_KEY, String(userId));
    return;
  }

  removeStorageKeys([PRIMARY_USER_ID_STORAGE_KEY, ...LEGACY_USER_ID_STORAGE_KEYS]);
};

const readStoredUserToken = () => {
  if (!hasWindow()) return null;

  const keys = [PRIMARY_USER_TOKEN_STORAGE_KEY, ...LEGACY_USER_TOKEN_STORAGE_KEYS];
  for (const key of keys) {
    const token = String(window.localStorage.getItem(key) || '').trim();
    if (token) return token;
  }

  return null;
};

const syncStoredToken = (token: string | null) => {
  if (!hasWindow()) return;

  if (token) {
    removeStorageKeys(LEGACY_USER_TOKEN_STORAGE_KEYS);
    window.localStorage.setItem(PRIMARY_USER_TOKEN_STORAGE_KEY, token);
    return;
  }

  removeStorageKeys([PRIMARY_USER_TOKEN_STORAGE_KEY, ...LEGACY_USER_TOKEN_STORAGE_KEYS]);
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

export const persistStoredUserSession = ({
  user,
  token,
}: {
  user: StoredUser | null;
  token?: string | null;
}) => {
  if (!hasWindow()) return;
  if (!user || typeof user !== 'object') {
    clearStoredUserSession();
    return;
  }

  persistStoredUser(user);
  syncStoredToken(String(token || '').trim() || null);
};

export const getStoredUserAuthToken = () => readStoredUserToken();

export const clearStoredUserSession = () => {
  if (!hasWindow()) return;

  removeStorageKeys([
    PRIMARY_USER_STORAGE_KEY,
    ...LEGACY_USER_STORAGE_KEYS,
    PRIMARY_USER_ID_STORAGE_KEY,
    ...LEGACY_USER_ID_STORAGE_KEYS,
    PRIMARY_USER_TOKEN_STORAGE_KEY,
    ...LEGACY_USER_TOKEN_STORAGE_KEYS,
  ]);
};
