type OfflineCacheEntry<T> = {
  updatedAt: string;
  value: T;
};

const OFFLINE_CACHE_PREFIX = 'offlineCache:v1:';

const hasWindow = () =>
  typeof window !== 'undefined' && typeof window.localStorage !== 'undefined';

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

export const writeOfflineCache = <T>(key: string, value: T) => {
  if (!hasWindow()) return;

  try {
    const payload: OfflineCacheEntry<T> = {
      updatedAt: new Date().toISOString(),
      value,
    };
    window.localStorage.setItem(key, JSON.stringify(payload));
  } catch (error) {
    // Preserve runtime behavior if the browser quota is exhausted.
    console.warn('Failed to write offline cache entry:', error);
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
