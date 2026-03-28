type OfflineCacheEntry<T> = {
  updatedAt: string;
  value: T;
};

const OFFLINE_CACHE_PREFIX = 'offlineCache:v1:';
const OFFLINE_CACHE_MAX_ENTRY_BYTES = 250_000;
const OFFLINE_CACHE_EVICTION_BATCH_SIZE = 8;
const warnedOfflineCacheKeys = new Set<string>();

const hasWindow = () =>
  typeof window !== 'undefined' && typeof window.localStorage !== 'undefined';

const isQuotaExceededError = (error: unknown) => {
  if (!error || typeof error !== 'object') return false;
  const name = String((error as { name?: unknown }).name || '');
  const code = Number((error as { code?: unknown }).code || 0);
  return (
    name === 'QuotaExceededError'
    || name === 'NS_ERROR_DOM_QUOTA_REACHED'
    || code === 22
    || code === 1014
  );
};

const stableSerialize = (value: unknown): string => {
  if (value == null) return 'null';
  if (Array.isArray(value)) {
    return `[${value.map((entry) => stableSerialize(entry)).join(',')}]`;
  }
  if (typeof value === 'object') {
    const objectValue = value as Record<string, unknown>;
    return `{${Object.keys(objectValue)
      .sort()
      .map((key) => `${JSON.stringify(key)}:${stableSerialize(objectValue[key])}`)
      .join(',')}}`;
  }
  return JSON.stringify(value);
};

const hashString = (input: string) => {
  let hash = 2166136261;

  for (let index = 0; index < input.length; index += 1) {
    hash ^= input.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }

  return (hash >>> 0).toString(36);
};

const sanitizeKeyPart = (value: unknown) =>
  String(value ?? 'none')
    .trim()
    .replace(/[\s:|/\\?&=#]+/g, '_')
    .slice(0, 120) || 'none';

export const hashOfflineCacheValue = (value: unknown) =>
  hashString(stableSerialize(value));

export const makeOfflineCacheKey = (...parts: unknown[]) =>
  `${OFFLINE_CACHE_PREFIX}${parts.map((part) => sanitizeKeyPart(part)).join(':')}`;

export const readOfflineCacheEntry = <T>(key: string): OfflineCacheEntry<T> | null => {
  if (!hasWindow()) return null;

  try {
    const raw = window.localStorage.getItem(key);
    if (!raw) return null;

    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== 'object' || !('updatedAt' in parsed) || !('value' in parsed)) {
      window.localStorage.removeItem(key);
      return null;
    }

    return parsed as OfflineCacheEntry<T>;
  } catch {
    try {
      window.localStorage.removeItem(key);
    } catch {
      // Ignore cleanup failures for invalid cached entries.
    }
    return null;
  }
};

export const readOfflineCacheValue = <T>(key: string): T | null =>
  readOfflineCacheEntry<T>(key)?.value ?? null;

const getOfflineCacheStorageKeys = () => {
  if (!hasWindow()) return [];

  const keys: string[] = [];
  for (let index = 0; index < window.localStorage.length; index += 1) {
    const key = window.localStorage.key(index);
    if (key?.startsWith(OFFLINE_CACHE_PREFIX)) {
      keys.push(key);
    }
  }

  return keys;
};

const getOfflineCacheUpdatedAt = (key: string) => {
  const entry = readOfflineCacheEntry<unknown>(key);
  const timestamp = new Date(String(entry?.updatedAt || '')).getTime();
  return Number.isFinite(timestamp) ? timestamp : 0;
};

const evictOldestOfflineCacheEntries = (excludeKey: string, count = OFFLINE_CACHE_EVICTION_BATCH_SIZE) => {
  if (!hasWindow()) return 0;

  const keys = getOfflineCacheStorageKeys()
    .filter((key) => key !== excludeKey)
    .sort((a, b) => getOfflineCacheUpdatedAt(a) - getOfflineCacheUpdatedAt(b));

  let removed = 0;
  for (const key of keys.slice(0, count)) {
    try {
      window.localStorage.removeItem(key);
      removed += 1;
    } catch {
      // Ignore eviction failures and continue trying other keys.
    }
  }

  return removed;
};

export const writeOfflineCache = <T>(key: string, value: T) => {
  if (!hasWindow()) return;

  const payload: OfflineCacheEntry<T> = {
    updatedAt: new Date().toISOString(),
    value,
  };

  let serialized = '';
  try {
    serialized = JSON.stringify(payload);
  } catch (error) {
    console.warn('Failed to serialize offline cache entry:', error);
    return;
  }

  if (serialized.length > OFFLINE_CACHE_MAX_ENTRY_BYTES) {
    removeOfflineCache(key);
    if (!warnedOfflineCacheKeys.has(key)) {
      warnedOfflineCacheKeys.add(key);
      console.warn(`Skipped offline cache entry because it is too large: ${key}`);
    }
    return;
  }

  try {
    window.localStorage.setItem(key, serialized);
    warnedOfflineCacheKeys.delete(key);
    return;
  } catch (error) {
    if (!isQuotaExceededError(error)) {
      console.warn('Failed to write offline cache entry:', error);
      return;
    }
  }

  evictOldestOfflineCacheEntries(key);

  try {
    window.localStorage.setItem(key, serialized);
    warnedOfflineCacheKeys.delete(key);
  } catch (error) {
    removeOfflineCache(key);
    if (!warnedOfflineCacheKeys.has(key)) {
      warnedOfflineCacheKeys.add(key);
      console.warn('Failed to write offline cache entry:', error);
    }
  }
};

export const removeOfflineCache = (key: string) => {
  if (!hasWindow()) return;
  try {
    window.localStorage.removeItem(key);
  } catch {
    // Ignore cache cleanup failures.
  }
};

export const isOfflineApiError = (error: unknown) => {
  const code = String((error as { code?: unknown })?.code || '').trim().toLowerCase();
  const status = Number((error as { status?: unknown })?.status || 0);
  const message = String((error as Error)?.message || '').toLowerCase();

  return (
    code === 'backend_offline'
    || [0, 408, 503].includes(status)
    || message.includes('backend is offline')
    || message.includes('failed to fetch')
    || message.includes('networkerror')
    || message.includes('load failed')
    || message.includes('connection refused')
    || message.includes('offline')
  );
};

export const offlineCacheKeys = {
  userProgram: (userId: number) => makeOfflineCacheKey('user', userId, 'program'),
  programProgress: (userId: number) => makeOfflineCacheKey('user', userId, 'program-progress'),
  recoveryStatus: (userId: number) => makeOfflineCacheKey('user', userId, 'recovery-status'),
  profileDetails: (userId: number) => makeOfflineCacheKey('user', userId, 'profile-details'),
  profileStats: (userId: number) => makeOfflineCacheKey('user', userId, 'profile-stats'),
  dailyNutritionPlan: (userId: number, input: unknown) =>
    makeOfflineCacheKey('user', userId, 'daily-nutrition', hashOfflineCacheValue(input)),
  blogsFeed: (
    userId: number,
    options: {
      limit?: number;
      cursorCreatedAt?: string;
      cursorId?: number;
      authorId?: number;
    } = {},
  ) => makeOfflineCacheKey(
    'user',
    userId,
    'blogs-feed',
    options.authorId || 'all',
    options.cursorCreatedAt || 'start',
    options.cursorId || 0,
    options.limit || 20,
  ),
  blogComments: (postId: number, limit = 120) =>
    makeOfflineCacheKey('blog', postId, 'comments', limit),
  strengthProgress: (userId: number, weeks = 8) =>
    makeOfflineCacheKey('user', userId, 'strength-progress', weeks),
  strengthScore: (userId: number, range: string) =>
    makeOfflineCacheKey('user', userId, 'strength-score', range),
  muscleDistribution: (userId: number, days = 30) =>
    makeOfflineCacheKey('user', userId, 'muscle-distribution', days),
  planMuscleDistribution: (userId: number) =>
    makeOfflineCacheKey('user', userId, 'plan-muscle-distribution'),
  biWeeklyReport: (userId: number) =>
    makeOfflineCacheKey('user', userId, 'bi-weekly-report'),
  overloadPlan: (userId: number) =>
    makeOfflineCacheKey('user', userId, 'overload-plan'),
  userMissions: (userId: number) =>
    makeOfflineCacheKey('user', userId, 'missions'),
  missionHistory: (userId: number) =>
    makeOfflineCacheKey('user', userId, 'mission-history'),
  userChallenges: (userId: number) =>
    makeOfflineCacheKey('user', userId, 'challenges'),
  challengeHistory: (userId: number) =>
    makeOfflineCacheKey('user', userId, 'challenge-history'),
  gamificationSummary: (userId: number) =>
    makeOfflineCacheKey('user', userId, 'gamification-summary'),
  leaderboard: (userId: number, period: 'monthly' | 'alltime' = 'alltime') =>
    makeOfflineCacheKey('user', userId, 'leaderboard', period),
};
