import { getStoredUserAuthToken } from '../shared/authStorage';
import { getStoredAdminAuthToken } from '../shared/adminAuthStorage';
import {
  isOfflineApiError,
  offlineCacheKeys,
  readOfflineCacheEntry,
  writeOfflineCache,
} from './offlineCache';

const DEFAULT_API_ORIGIN =
  typeof window !== 'undefined'
    ? `${window.location.protocol}//${window.location.hostname}:5001`
    : 'http://localhost:5001';

const API_URL = import.meta.env.VITE_API_URL || `${DEFAULT_API_ORIGIN}/api`;
const nativeFetch = globalThis.fetch.bind(globalThis);

type ApiError = Error & {
  status?: number;
  data?: unknown;
  code?: string;
};

type ApiAuthContext = 'auto' | 'user' | 'admin' | 'none';

const resolveDefaultAuthContext = (): ApiAuthContext => {
  if (typeof window === 'undefined') return 'user';
  return /admin/i.test(window.location.pathname) ? 'admin' : 'user';
};

const resolveAuthToken = (context: ApiAuthContext = 'auto') => {
  if (context === 'none') return null;

  const normalizedContext = context === 'auto' ? resolveDefaultAuthContext() : context;
  if (normalizedContext === 'admin') {
    return getStoredAdminAuthToken();
  }
  return getStoredUserAuthToken();
};

const withAuthHeaders = (init: RequestInit = {}, context: ApiAuthContext = 'auto') => {
  const headers = new Headers(init.headers || {});
  const token = resolveAuthToken(context);
  if (token) {
    headers.set('Authorization', `Bearer ${token}`);
  }

  return {
    ...init,
    headers,
  };
};

const isNetworkRequestError = (error: unknown) => {
  if (error instanceof TypeError) return true;
  const message = String((error as Error)?.message || '').toLowerCase();
  return (
    message.includes('failed to fetch')
    || message.includes('networkerror')
    || message.includes('load failed')
    || message.includes('connection refused')
  );
};

const toNetworkApiError = (error: unknown) => {
  if (!isNetworkRequestError(error)) return error;
  return createApiError(
    'Backend is offline. Please wait a moment or restart the backend server.',
    503,
    undefined,
    'backend_offline',
  );
};

const fetch = async (input: RequestInfo | URL, init?: RequestInit) => {
  try {
    return await nativeFetch(input, withAuthHeaders(init));
  } catch (error) {
    throw toNetworkApiError(error);
  }
};

const fetchWithContext = async (input: RequestInfo | URL, init: RequestInit | undefined, context: ApiAuthContext) => {
  try {
    return await nativeFetch(input, withAuthHeaders(init, context));
  } catch (error) {
    throw toNetworkApiError(error);
  }
};

const fetchWithTimeout = async (
  input: RequestInfo | URL,
  init: RequestInit | undefined,
  timeoutMs = 12000,
) => {
  const controller = new AbortController();
  const timer = globalThis.setTimeout(() => controller.abort(), timeoutMs);

  try {
    return await fetch(input, {
      ...init,
      signal: controller.signal,
    });
  } catch (error) {
    if ((error as Error)?.name === 'AbortError') {
      throw createApiError('Request timed out. Please try again.', 408);
    }
    throw toNetworkApiError(error);
  } finally {
    globalThis.clearTimeout(timer);
  }
};

const isOnboardingGatewayTimeout = (error: unknown) => {
  if ((error as ApiError)?.code === 'backend_offline') return false;

  const status = Number((error as ApiError)?.status || 0);
  if ([408, 502, 503, 504].includes(status)) return true;

  const message = String((error as Error)?.message || '').toLowerCase();
  return (
    message.includes('gateway') ||
    message.includes('timed out') ||
    message.includes('timeout') ||
    message.includes('temporarily unavailable')
  );
};

const createApiError = (
  message: string,
  status: number,
  data?: unknown,
  code?: string,
): ApiError => {
  const error = new Error(message) as ApiError;
  error.status = status;
  error.data = data;
  error.code = code;
  return error;
};

const normalizeApiErrorMessage = (message: string, fallbackError: string) => {
  const text = String(message || '').trim();
  if (!text) return fallbackError;

  if (/^email already exists$/i.test(text)) {
    return 'A user with this email already exists.';
  }

  if (/^coach email already exists$/i.test(text)) {
    return 'A coach with this email already exists.';
  }

  if (/^gym email already exists$/i.test(text)) {
    return 'A gym with this email already exists.';
  }

  if (/access denied for user .*using password:\s*no/i.test(text)) {
    return 'Database authentication failed. Set DB_PASSWORD in .env and restart the backend.';
  }

  if (/connect econnrefused/i.test(text) && /mysql|127\.0\.0\.1|localhost/i.test(text)) {
    return 'Database is offline. Check DB_HOST/DB_PORT and make sure MySQL is running.';
  }

  return text;
};

const parseApiResponse = async (res: Response, fallbackError = 'Request failed') => {
  const contentType = res.headers.get('content-type') || '';
  if (!contentType.includes('application/json')) {
    const text = await res.text();
    throw createApiError(
      `Server returned non-JSON response (status ${res.status}). ` +
      `If you just changed backend routes, restart backend. Response: ${text.slice(0, 120)}`,
      res.status,
      { text },
    );
  }

  const data = await res.json();
  if (!res.ok) {
    throw createApiError(
      normalizeApiErrorMessage(data?.error || fallbackError, fallbackError),
      res.status,
      data,
    );
  }
  return data;
};

const withOfflineReadFallback = async <T>(
  cacheKey: string | null,
  fetcher: () => Promise<T>,
) => {
  try {
    const data = await fetcher();
    if (cacheKey) {
      writeOfflineCache(cacheKey, data);
    }
    return data;
  } catch (error) {
    if (cacheKey && isOfflineApiError(error)) {
      const cachedEntry = readOfflineCacheEntry<T>(cacheKey);
      if (cachedEntry) {
        return cachedEntry.value;
      }
    }

    throw error;
  }
};

const waitForMs = (ms: number) =>
  new Promise<void>((resolve) => {
    globalThis.setTimeout(resolve, ms);
  });

const withTransientReadRetry = async <T>(
  fetcher: () => Promise<T>,
  attempts = 2,
) => {
  let lastError: unknown;

  for (let attempt = 0; attempt < attempts; attempt += 1) {
    try {
      return await fetcher();
    } catch (error) {
      lastError = error;
      const shouldRetry = isOfflineApiError(error) && attempt < attempts - 1;
      if (!shouldRetry) {
        throw error;
      }
      await waitForMs(250 * (attempt + 1));
    }
  }

  throw lastError;
};

export const api = {
  login: async (email: string, password: string, role: string) => {
    const res = await fetchWithContext(`${API_URL}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password, role })
    }, 'none');
    return res.json();
  },

  getCurrentSession: async (context: ApiAuthContext = 'auto') => {
    const res = await fetchWithContext(`${API_URL}/auth/session`, undefined, context);
    return parseApiResponse(res, 'Failed to restore session');
  },

  createUser: async (data: any) => {
    const res = await fetch(`${API_URL}/auth/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data)
    });
    return parseApiResponse(res, 'Failed to create user');
  },

  getAllGyms: async () => {
    const res = await fetch(`${API_URL}/gyms`);
    return res.json();
  },

  createGym: async (data: any) => {
    const res = await fetch(`${API_URL}/gyms`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data)
    });
    return res.json();
  },

  getAllCoaches: async () => {
    const res = await fetch(`${API_URL}/coaches`);
    return res.json();
  },

  createCoach: async (data: any) => {
    const res = await fetch(`${API_URL}/coaches`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data)
    });
    return parseApiResponse(res, 'Failed to create coach');
  },

  saveOnboarding: async (userId: number, data: any) => {
    const payload = { ...(data || {}), userId };
    try {
      const res = await fetch(`${API_URL}/user/onboarding`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      return await parseApiResponse(res, 'Failed to save onboarding data');
    } catch (error) {
      if (payload?.disableClaude || !isOnboardingGatewayTimeout(error)) {
        throw error;
      }

      const fallbackRes = await fetch(`${API_URL}/user/onboarding`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...payload,
          useClaude: false,
          disableClaude: true,
        }),
      });

      return parseApiResponse(
        fallbackRes,
        'Failed to save onboarding data after AI timeout fallback',
      );
    }
  },

  getOnboardingConfig: async () => {
    const res = await fetch(`${API_URL}/onboarding/config`);
    return parseApiResponse(res, 'Failed to load onboarding config');
  },

  getUserProgram: async (userId: number) => {
    const cacheKey = offlineCacheKeys.userProgram(userId);

    try {
      const res = await fetch(`${API_URL}/user/${userId}/program`);
      const data = await parseApiResponse(res, 'Failed to fetch user program');
      if (res.ok) {
        writeOfflineCache(cacheKey, data);
      }
      return data;
    } catch (error) {
      if (isOfflineApiError(error)) {
        const cachedEntry = readOfflineCacheEntry<any>(cacheKey);
        if (cachedEntry) {
          return cachedEntry.value;
        }
      }
      throw error;
    }
  },

  markTodayWorkoutMissed: async (userId: number) => {
    const res = await fetch(`${API_URL}/user/${userId}/program/today-workout/miss`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
    });
    return parseApiResponse(res, 'Failed to mark today as missed');
  },

  syncPickedTodayWorkout: async (
    userId: number,
    payload: {
      workoutName?: string;
      dayLabel?: string;
      durationMinutes?: number;
      muscleGroups?: string[];
      muscleGroup?: string | null;
      exercises?: Array<{
        exerciseName?: string;
        targetMuscles?: string[];
        muscleGroup?: string | null;
        sets?: number;
        reps?: string;
      }>;
      programAssignmentId?: number;
    } = {},
  ) => {
    const res = await fetch(`${API_URL}/user/${userId}/program/today-workout/pick`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    return parseApiResponse(res, 'Failed to sync picked workout');
  },

  addExerciseToTodayWorkout: async (userId: number, payload: any = {}) => {
    const res = await fetch(`${API_URL}/user/${userId}/program/today-workout/exercises`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    return parseApiResponse(res, 'Failed to add exercise to today\'s workout');
  },

  removeExerciseFromTodayWorkout: async (userId: number, exerciseId: number) => {
    const res = await fetch(`${API_URL}/user/${userId}/program/today-workout/exercises/${exerciseId}`, {
      method: 'DELETE',
    });
    return parseApiResponse(res, 'Failed to remove exercise from today\'s workout');
  },

  getProgramProgress: async (userId: number) => {
    return withOfflineReadFallback(
      offlineCacheKeys.programProgress(userId),
      async () => {
        const res = await fetch(`${API_URL}/user/${userId}/program-progress`);
        return parseApiResponse(res, 'Failed to fetch program progress');
      },
    );
  },

  generatePersonalizedProgram: async (userId: number, payload: any = {}) => {
    const res = await fetch(`${API_URL}/user/${userId}/program/generate-personalized`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    return parseApiResponse(res, 'Failed to generate personalized program');
  },

  saveCustomProgram: async (userId: number, payload: any = {}) => {
    const res = await fetch(`${API_URL}/user/${userId}/program/custom`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    return parseApiResponse(res, 'Failed to save custom plan');
  },

  requestCustomProgramApproval: async (userId: number, payload: any = {}) => {
    const res = await fetch(`${API_URL}/user/${userId}/program/custom/request`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    return parseApiResponse(res, 'Failed to submit custom plan for coach review');
  },

  requestCoachPlanCreation: async (userId: number, coachId: number) => {
    const res = await fetch(`${API_URL}/user/${userId}/coach/${coachId}/plan-request`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
    });
    return parseApiResponse(res, 'Failed to send coach plan request');
  },

  coachSaveCustomProgram: async (coachId: number, userId: number, payload: any = {}) => {
    const res = await fetch(`${API_URL}/coach/${coachId}/user/${userId}/program/custom`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    return parseApiResponse(res, 'Failed to save coach plan');
  },

  getCoachProgramChangeRequests: async (coachId: number, status = '') => {
    const params = new URLSearchParams();
    if (status) params.set('status', status);
    const query = params.toString();
    return withTransientReadRetry(async () => {
      const res = await fetchWithTimeout(`${API_URL}/coach/${coachId}/program-requests${query ? `?${query}` : ''}`, undefined, 10000);
      return parseApiResponse(res, 'Failed to load coach program requests');
    });
  },

  approveCoachProgramChangeRequest: async (coachId: number, requestId: number, reason = '') => {
    const res = await fetch(`${API_URL}/coach/${coachId}/program-requests/${requestId}/approve`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ reason }),
    });
    return parseApiResponse(res, 'Failed to approve program request');
  },

  rejectCoachProgramChangeRequest: async (coachId: number, requestId: number, reason = '') => {
    const res = await fetch(`${API_URL}/coach/${coachId}/program-requests/${requestId}/reject`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ reason }),
    });
    return parseApiResponse(res, 'Failed to reject program request');
  },

  adaptProgramBiWeekly: async (userId: number) => {
    const res = await fetch(`${API_URL}/user/${userId}/program/adapt-biweekly`, {
      method: 'POST',
    });
    return res.json();
  },

  adaptProgramWeekly: async (userId: number, payload: { force?: boolean; trigger?: string } = {}) => {
    const res = await fetch(`${API_URL}/user/${userId}/program/adapt-weekly`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    return parseApiResponse(res, 'Failed to adapt weekly plan');
  },

  capturePlanValidationSnapshot: async (
    userId: number,
    payload: {
      adaptationId?: number;
      assignmentId?: number;
      programId?: number;
      source?: 'auto_weekly' | 'manual' | 'backfill';
      periodEnd?: string;
    } = {},
  ) => {
    const res = await fetch(`${API_URL}/user/${userId}/plan/validation/snapshot`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    return parseApiResponse(res, 'Failed to capture plan validation snapshot');
  },

  getPlanValidationHistory: async (userId: number, options: { limit?: number } = {}) => {
    const params = new URLSearchParams();
    params.set('limit', String(options.limit ?? 24));
    const res = await fetch(`${API_URL}/user/${userId}/plan/validation/history?${params.toString()}`);
    return parseApiResponse(res, 'Failed to load plan validation history');
  },

  getMonthlyValidationSummary: async (options: { months?: number } = {}) => {
    const params = new URLSearchParams();
    params.set('months', String(options.months ?? 6));
    const res = await fetch(`${API_URL}/insights/validation/monthly?${params.toString()}`);
    return parseApiResponse(res, 'Failed to load monthly validation summary');
  },

  getOnboardingInsights: async (input: Record<string, unknown>) => {
    const res = await fetch(`${API_URL}/insights/onboarding`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(input),
    });
    return parseApiResponse(res, 'Failed to build onboarding insights');
  },

  getDailyNutritionPlan: async (input: {
    targetCalories: number;
    targetProtein: number;
    targetCarbs?: number;
    targetFat?: number;
    targetWaterMl?: number;
    goal?: string;
    forceRefresh?: boolean;
    userId?: number;
  }) => {
    const cacheKey = input.userId
      ? offlineCacheKeys.dailyNutritionPlan(input.userId, {
          targetCalories: input.targetCalories,
          targetProtein: input.targetProtein,
          targetCarbs: input.targetCarbs,
          targetFat: input.targetFat,
          targetWaterMl: input.targetWaterMl,
          goal: input.goal,
        })
      : null;

    return withOfflineReadFallback(
      cacheKey,
      async () => {
        const res = await fetch(`${API_URL}/nutrition/daily-plan`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(input),
        });
        return parseApiResponse(res, 'Failed to generate daily nutrition plan');
      },
    );
  },

  getBlogsFeed: async (
    userId: number,
    options: {
      limit?: number;
      cursorCreatedAt?: string;
      cursorId?: number;
      authorId?: number;
    } = {},
  ) => {
    const params = new URLSearchParams();
    params.set('userId', String(userId));
    params.set('limit', String(options.limit ?? 20));
    if (options.cursorCreatedAt) params.set('cursorCreatedAt', options.cursorCreatedAt);
    if (options.cursorId) params.set('cursorId', String(options.cursorId));
    if (options.authorId) params.set('authorId', String(options.authorId));

    return withOfflineReadFallback(
      offlineCacheKeys.blogsFeed(userId, options),
      async () => {
        const res = await fetch(`${API_URL}/blogs?${params.toString()}`);
        return parseApiResponse(res, 'Failed to fetch blogs feed');
      },
    );
  },

  createBlogPost: async (input: {
    userId: number;
    description: string;
    category: 'Training' | 'Nutrition' | 'Recovery' | 'Mindset';
    mediaType: 'image' | 'video';
    mediaUrl: string;
    mediaAlt?: string;
    womenOnly?: boolean;
  }) => {
    const res = await fetch(`${API_URL}/blogs`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(input),
    });
    return parseApiResponse(res, 'Failed to create blog post');
  },

  updateBlogPost: async (
    postId: number,
    input: {
      userId: number;
      description?: string;
      category?: 'Training' | 'Nutrition' | 'Recovery' | 'Mindset';
      mediaAlt?: string;
    },
  ) => {
    const res = await fetch(`${API_URL}/blogs/${postId}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(input),
    });
    return parseApiResponse(res, 'Failed to update blog post');
  },

  deleteBlogPost: async (postId: number, userId: number) => {
    const res = await fetch(`${API_URL}/blogs/${postId}`, {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ userId }),
    });
    return parseApiResponse(res, 'Failed to delete blog post');
  },

  toggleBlogLike: async (
    postId: number,
    input: {
      userId: number;
      mode?: 'toggle' | 'like';
    },
  ) => {
    const res = await fetch(`${API_URL}/blogs/${postId}/like/toggle`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(input),
    });
    return parseApiResponse(res, 'Failed to update blog like');
  },

  setBlogReaction: async (
    postId: number,
    input: {
      userId: number;
      reactionType?: string | null;
    },
  ) => {
    const res = await fetch(`${API_URL}/blogs/${postId}/reaction`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(input),
    });
    return parseApiResponse(res, 'Failed to update blog reaction');
  },

  trackBlogView: async (postId: number, userId: number) => {
    const res = await fetch(`${API_URL}/blogs/${postId}/view`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ userId }),
    });
    return parseApiResponse(res, 'Failed to track blog view');
  },

  getBlogComments: async (postId: number, limit = 120) => {
    const params = new URLSearchParams();
    params.set('limit', String(limit));

    return withOfflineReadFallback(
      offlineCacheKeys.blogComments(postId, limit),
      async () => {
        const res = await fetch(`${API_URL}/blogs/${postId}/comments?${params.toString()}`);
        return parseApiResponse(res, 'Failed to fetch blog comments');
      },
    );
  },

  addBlogComment: async (
    postId: number,
    input: {
      userId: number;
      text: string;
    },
  ) => {
    const res = await fetch(`${API_URL}/blogs/${postId}/comments`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(input),
    });
    return parseApiResponse(res, 'Failed to add comment');
  },

  saveUserAnalysisInsights: async (
    userId: number,
    input: Record<string, unknown>,
    options: {
      snapshotDate?: string;
      source?: string;
      notes?: string;
      autoAdaptPlan?: boolean;
      modelVersion?: string;
    } = {},
  ) => {
    const res = await fetch(`${API_URL}/insights/user-analysis/save`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        userId,
        input,
        snapshotDate: options.snapshotDate,
        source: options.source || 'weekly_checkin',
        notes: options.notes || null,
        autoAdaptPlan: Boolean(options.autoAdaptPlan),
        modelVersion: options.modelVersion || 'fitness_insights_v2',
      }),
    });
    return parseApiResponse(res, 'Failed to save user analysis insights');
  },

  getUserInsightsHistory: async (
    userId: number,
    options: {
      days?: number;
      limit?: number;
      scoreTypes?: string[];
      includeExplanation?: boolean;
      includeRawPayload?: boolean;
    } = {},
  ) => {
    const params = new URLSearchParams();
    params.set('days', String(options.days ?? 90));
    params.set('limit', String(options.limit ?? 365));
    if (Array.isArray(options.scoreTypes) && options.scoreTypes.length) {
      params.set('scoreType', options.scoreTypes.join(','));
    }
    if (options.includeExplanation) params.set('includeExplanation', 'true');
    if (options.includeRawPayload) params.set('includeRawPayload', 'true');

    const res = await fetch(`${API_URL}/insights/user/${userId}/history?${params.toString()}`);
    return parseApiResponse(res, 'Failed to load user insight history');
  },

  getStrengthProgress: async (userId: number, weeks = 8) => {
    return withOfflineReadFallback(
      offlineCacheKeys.strengthProgress(userId, weeks),
      async () => {
        const res = await fetch(`${API_URL}/progress/strength/${userId}?weeks=${weeks}`);
        const contentType = res.headers.get('content-type') || '';
        if (!contentType.includes('application/json')) {
          const text = await res.text();
          throw new Error(`Strength API returned non-JSON response (status ${res.status}): ${text.slice(0, 120)}`);
        }
        const data = await res.json();
        if (!res.ok) {
          throw new Error(data?.error || `Strength API request failed (${res.status})`);
        }
        return data;
      },
    );
  },

  getStrengthScore: async (userId: number, range: 'month' | '6months' | 'year' | 'all' = '6months') => {
    const params = new URLSearchParams({ range });
    return withOfflineReadFallback(
      offlineCacheKeys.strengthScore(userId, range),
      async () => {
        const res = await fetch(`${API_URL}/progress/strength-score/${userId}?${params.toString()}`);
        return parseApiResponse(res, 'Failed to load strength score');
      },
    );
  },

  getMuscleDistribution: async (userId: number, days = 30) => {
    return withOfflineReadFallback(
      offlineCacheKeys.muscleDistribution(userId, days),
      async () => {
        const res = await fetch(`${API_URL}/progress/muscle-distribution/${userId}?days=${days}`);
        const contentType = res.headers.get('content-type') || '';
        if (!contentType.includes('application/json')) {
          const text = await res.text();
          throw new Error(`Muscle API returned non-JSON response (status ${res.status}): ${text.slice(0, 120)}`);
        }
        const data = await res.json();
        if (!res.ok) {
          throw new Error(data?.error || `Muscle API request failed (${res.status})`);
        }
        return data;
      },
    );
  },

  getPlanMuscleDistribution: async (userId: number) => {
    return withOfflineReadFallback(
      offlineCacheKeys.planMuscleDistribution(userId),
      async () => {
        const res = await fetch(`${API_URL}/progress/plan-muscle-distribution/${userId}`);
        const contentType = res.headers.get('content-type') || '';
        if (!contentType.includes('application/json')) {
          const text = await res.text();
          throw new Error(`Plan muscle API returned non-JSON response (status ${res.status}): ${text.slice(0, 120)}`);
        }
        const data = await res.json();
        if (!res.ok) {
          throw new Error(data?.error || `Plan muscle API request failed (${res.status})`);
        }
        return data;
      },
    );
  },

  getBiWeeklyReport: async (userId: number) => {
    return withOfflineReadFallback(
      offlineCacheKeys.biWeeklyReport(userId),
      async () => {
        const res = await fetch(`${API_URL}/progress/bi-weekly-report/${userId}`);
        const contentType = res.headers.get('content-type') || '';
        if (!contentType.includes('application/json')) {
          const text = await res.text();
          throw new Error(`Bi-weekly API returned non-JSON response (status ${res.status}): ${text.slice(0, 120)}`);
        }
        const data = await res.json();
        if (!res.ok) {
          throw new Error(data?.error || `Bi-weekly API request failed (${res.status})`);
        }
        return data;
      },
    );
  },

  getOverloadPlan: async (userId: number) => {
    return withOfflineReadFallback(
      offlineCacheKeys.overloadPlan(userId),
      async () => {
        const res = await fetch(`${API_URL}/progress/overload/${userId}`);
        const contentType = res.headers.get('content-type') || '';
        if (!contentType.includes('application/json')) {
          const text = await res.text();
          throw new Error(`Overload API returned non-JSON response (status ${res.status}): ${text.slice(0, 120)}`);
        }
        const data = await res.json();
        if (!res.ok) {
          throw new Error(data?.error || `Overload API request failed (${res.status})`);
        }
        return data;
      },
    );
  },

  getRecoveryStatus: async (userId: number) => {
    return withOfflineReadFallback(
      offlineCacheKeys.recoveryStatus(userId),
      async () => {
        const res = await fetch(`${API_URL}/user/${userId}/recovery`);
        return parseApiResponse(res, 'Failed to fetch recovery status');
      },
    );
  },

  updateRecoveryFactors: async (userId: number, data: any) => {
    const res = await fetch(`${API_URL}/user/${userId}/recovery`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data)
    });
    return parseApiResponse(res, 'Failed to update recovery factors');
  },

  recalculateTodayRecovery: async (userId: number) => {
    const res = await fetch(`${API_URL}/user/${userId}/recovery/recalculate-today`, {
      method: 'POST'
    });
    return parseApiResponse(res, 'Failed to recalculate recovery');
  },

  getGymMembers: async (userId: number) => {
    const res = await fetch(`${API_URL}/user/${userId}/gym-members`);
    return parseApiResponse(res, 'Failed to fetch gym members');
  },

  getFriendPlanPreview: async (viewerId: number, friendId: number) => {
    const res = await fetch(`${API_URL}/friends/${viewerId}/${friendId}/plan-preview`);
    return parseApiResponse(res, 'Failed to fetch friend plan preview');
  },

  getFriendChallengeWinStats: async (viewerId: number, friendId: number) => {
    const res = await fetch(`${API_URL}/friends/${viewerId}/${friendId}/challenge-win-stats`);
    return parseApiResponse(res, 'Failed to fetch friend challenge win stats');
  },

  completeFriendChallenge: async (input: {
    userId: number;
    friendId: number;
    winnerUserId: number;
    challengeKey: 'push_up_duel' | 'squat_rep_race' | 'bench_press' | 'deadlift_one';
    clientMatchId?: string;
    sessionId?: number;
    rounds?: Array<Record<string, unknown>>;
  }) => {
    const res = await fetch(`${API_URL}/friend-challenges/complete`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(input),
    });
    if (res.status === 404) {
      throw createApiError(
        'Friend challenge endpoint not found. Restart backend server and try again.',
        404,
      );
    }
    return parseApiResponse(res, 'Failed to complete friend challenge');
  },

  getFriendChallengeSession: async (userId: number, sessionId: number) => {
    const res = await fetch(`${API_URL}/friend-challenges/session/${sessionId}?userId=${userId}`);
    return parseApiResponse(res, 'Failed to fetch friend challenge session');
  },

  submitFriendChallengeTurn: async (input: {
    userId: number;
    sessionId: number;
    reps?: number;
    weightKg?: number;
    outcome?: 'made' | 'missed';
  }) => {
    const res = await fetch(`${API_URL}/friend-challenges/session/submit-turn`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(input),
    });
    return parseApiResponse(res, 'Failed to submit push-up count');
  },

  addFriendChallengeRound: async (input: {
    userId: number;
    sessionId: number;
  }) => {
    const res = await fetch(`${API_URL}/friend-challenges/session/add-round`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(input),
    });
    return parseApiResponse(res, 'Failed to add a new challenge round');
  },

  leaveFriendChallengeSession: async (input: {
    userId: number;
    sessionId: number;
  }) => {
    const res = await fetch(`${API_URL}/friend-challenges/session/leave`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(input),
    });
    return parseApiResponse(res, 'Failed to leave the challenge');
  },

  sendFriendChallengeInvite: async (input: {
    userId: number;
    friendId: number;
    challengeKey: string;
    challengeTitle: string;
  }) => {
    const res = await fetch(`${API_URL}/friend-challenges/invite`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(input),
    });
    return parseApiResponse(res, 'Failed to send friend challenge invite');
  },

  respondToFriendChallengeInvite: async (
    userId: number,
    notificationId: number,
    action: 'accept' | 'decline',
  ) => {
    const res = await fetchWithTimeout(`${API_URL}/friend-challenges/respond`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ userId, notificationId, action }),
    }, 12000);
    return parseApiResponse(res, 'Failed to respond to friend challenge invite');
  },

  sendFriendRequest: async (fromUserId: number, toUserId: number) => {
    const res = await fetch(`${API_URL}/friends/request`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ fromUserId, toUserId }),
    });
    return parseApiResponse(res, 'Failed to send friend request');
  },

  respondToFriendRequest: async (
    userId: number,
    friendshipId: number,
    action: 'accept' | 'decline',
  ) => {
    const res = await fetch(`${API_URL}/friends/respond`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ userId, friendshipId, action }),
    });
    return parseApiResponse(res, 'Failed to respond to friend request');
  },

  getRecentWorkoutActivity: async (userId: number) => {
    const res = await fetch(`${API_URL}/user/${userId}/recent-activity`);
    return parseApiResponse(res, 'Failed to fetch recent activity');
  },

  sendInvitation: async (fromUserId: number, toUserId: number, date: string, time: string) => {
    const res = await fetch(`${API_URL}/invitations/send`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ fromUserId, toUserId, date, time })
    });
    return parseApiResponse(res, 'Failed to send invitation');
  },

  getNotifications: async (userId: number) => {
    return withTransientReadRetry(async () => {
      const res = await fetchWithTimeout(`${API_URL}/notifications/${userId}`, undefined, 10000);
      return parseApiResponse(res, 'Failed to fetch notifications');
    });
  },

  markNotificationRead: async (notificationId: number) => {
    const res = await fetch(`${API_URL}/notifications/${notificationId}/read`, {
      method: 'PUT'
    });
    return parseApiResponse(res, 'Failed to mark notification as read');
  },

  clearNotifications: async (userId: number) => {
    const res = await fetch(`${API_URL}/notifications/${userId}`, {
      method: 'DELETE'
    });
    return res.json();
  },

  getNotificationSettings: async (userId: number) => {
    const res = await fetch(`${API_URL}/notification-settings/${userId}`);
    let data: any = null;
    try {
      data = await res.json();
    } catch {
      data = null;
    }
    if (res.status === 404) {
      return {
        coachMessages: true,
        restTimer: true,
        missionChallenge: true,
      };
    }
    if (!res.ok) {
      throw new Error(data?.error || 'Failed to fetch notification settings');
    }
    return data;
  },

  updateNotificationSettings: async (
    userId: number,
    data: { coachMessages: boolean; restTimer: boolean; missionChallenge: boolean },
  ) => {
    const res = await fetch(`${API_URL}/notification-settings/${userId}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    });
    let body: any = null;
    try {
      body = await res.json();
    } catch {
      body = null;
    }
    if (res.status === 404) {
      throw new Error('Notification settings endpoint not found. Restart backend server.');
    }
    if (!res.ok) {
      throw new Error(body?.error || 'Failed to update notification settings');
    }
    return body;
  },

  getMessages: async (userId: number, coachId: number) => {
    return withTransientReadRetry(async () => {
      const res = await fetchWithTimeout(`${API_URL}/messages/${userId}/${coachId}`, undefined, 10000);
      return parseApiResponse(res, 'Failed to fetch messages');
    });
  },

  markMessagesAsRead: async (coachId: number, userId: number) => {
    const res = await fetch(`${API_URL}/messages/read/${coachId}/${userId}`, {
      method: 'PUT'
    });
    return parseApiResponse(res, 'Failed to mark coach messages as read');
  },

  markUserMessagesAsRead: async (userId: number, coachId: number) => {
    const res = await fetch(`${API_URL}/messages/read-user/${userId}/${coachId}`, {
      method: 'PUT'
    });
    return parseApiResponse(res, 'Failed to mark user messages as read');
  },

  getAllUsers: async () => {
    return withTransientReadRetry(async () => {
      const res = await fetchWithTimeout(`${API_URL}/users`, undefined, 10000);
      return parseApiResponse(res, 'Failed to fetch users');
    });
  },

  getAdminUsersOverview: async () => {
    return withTransientReadRetry(async () => {
      const res = await fetchWithTimeout(`${API_URL}/users/admin-overview`, undefined, 10000);
      return parseApiResponse(res, 'Failed to fetch admin users overview');
    });
  },

  getUserSessionStatus: async (userId: number | string) => {
    const res = await fetch(`${API_URL}/users/${userId}/exists`);
    return parseApiResponse(res, 'Failed to validate user session');
  },

  deleteUser: async (userId: number | string) => {
    const res = await fetch(`${API_URL}/users/${userId}`, { method: 'DELETE' });
    let body: any = null;
    try {
      body = await res.json();
    } catch {
      body = null;
    }
    if (!res.ok) {
      throw new Error(body?.error || 'Failed to delete user');
    }
    return body;
  },

  getCoachSchedule: async (coachId: number | string, startDate: string, endDate: string) => {
    const params = new URLSearchParams();
    if (startDate) params.set('startDate', startDate);
    if (endDate) params.set('endDate', endDate);
    return withTransientReadRetry(async () => {
      const res = await fetchWithTimeout(`${API_URL}/coaches/${coachId}/schedule?${params.toString()}`, undefined, 10000);
      return parseApiResponse(res, 'Failed to fetch coach schedule');
    });
  },

  getCoachScheduleSummary: async (coachId: number | string, date?: string) => {
    const params = new URLSearchParams();
    if (date) params.set('date', date);
    const query = params.toString();
    const url = `${API_URL}/coaches/${coachId}/schedule-summary${query ? `?${query}` : ''}`;
    const res = await fetchWithTimeout(url, undefined, 8000);
    return parseApiResponse(res, 'Failed to fetch coach schedule summary');
  },

  getCoachSessionDetails: async (
    coachId: number | string,
    userId: number | string,
    params: {
      date: string;
      sessionId?: string | number | null;
      workoutName?: string | null;
    },
  ) => {
    const search = new URLSearchParams();
    search.set('date', params.date);
    if (params.sessionId) search.set('sessionId', String(params.sessionId));
    if (params.workoutName) search.set('workoutName', String(params.workoutName));
    const res = await fetchWithTimeout(
      `${API_URL}/coaches/${coachId}/users/${userId}/session-details?${search.toString()}`,
      undefined,
      10000,
    );
    return parseApiResponse(res, 'Failed to fetch coach session details');
  },

  sendCoachSessionNote: async (
    coachId: number | string,
    userId: number | string,
    payload: {
      sessionDate: string;
      sessionId?: string | number | null;
      workoutName?: string | null;
      note: string;
    },
  ) => {
    const res = await fetch(`${API_URL}/coaches/${coachId}/users/${userId}/session-notes`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    return parseApiResponse(res, 'Failed to send coach session note');
  },

  banUser: async (
    userId: number | string,
    payload: { days: number; reason: string; coachId?: number | string },
  ) => {
    const res = await fetch(`${API_URL}/users/${userId}/ban`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    let body: any = null;
    try {
      body = await res.json();
    } catch {
      body = null;
    }
    if (!res.ok) {
      throw new Error(body?.error || 'Failed to ban user');
    }
    return body;
  },

  getExerciseCatalogFilters: async () => {
    const res = await fetch(`${API_URL}/exercises/catalog/filters`);
    return res.json();
  },

  getExerciseCatalog: async (filter = 'All', search = '', limit = 300) => {
    const params = new URLSearchParams();
    if (filter) params.set('filter', filter);
    if (search) params.set('search', search);
    params.set('limit', String(limit));
    const res = await fetch(`${API_URL}/exercises/catalog?${params.toString()}`);
    return res.json();
  },

  getExerciseCatalogMuscles: async (exerciseCatalogId: number) => {
    const res = await fetch(`${API_URL}/exercises/catalog/${exerciseCatalogId}/muscles`);
    return parseApiResponse(res, 'Failed to load exercise muscle targets');
  },

  getExerciseCatalogMusclesByName: async (exerciseName: string, muscleHint?: string | null) => {
    const params = new URLSearchParams();
    params.set('name', exerciseName);
    if (muscleHint) params.set('muscle', muscleHint);
    const res = await fetch(`${API_URL}/exercises/catalog/muscles/resolve?${params.toString()}`);
    return parseApiResponse(res, 'Failed to resolve exercise muscle targets');
  },

  saveWorkoutSet: async (data: any) => {
    const res = await fetch(`${API_URL}/workout-sets`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data)
    });
    return res.json();
  },

  getWorkoutHistory: async (userId: number, exerciseName: string) => {
    const res = await fetch(`${API_URL}/workout-sets/${userId}/${encodeURIComponent(exerciseName)}`);
    return res.json();
  },

  getTodayWorkoutProgress: async (userId: number) => {
    const res = await fetch(`${API_URL}/workout-sets/today/${userId}`);
    return res.json();
  },

  saveWorkoutDaySummary: async (input: {
    userId: number;
    summaryDate: string;
    workoutName: string;
    durationSeconds: number;
    estimatedCalories: number;
    totalVolume: number;
    recordsCount: number;
    muscles: Array<{ name: string; score: number }>;
    exercises: Array<{
      name: string;
      sets: Array<{ set: number; reps: number; weight: number }>;
      totalSets: number;
      totalReps: number;
      topWeight: number;
      volume: number;
      targetMuscles: string[];
    }>;
    summaryText?: string;
  }) => {
    const res = await fetch(`${API_URL}/workout-summaries`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(input),
    });
    return parseApiResponse(res, 'Failed to save workout summary');
  },

  completeWorkoutDaySession: async (input: {
    userId: number;
    summaryDate?: string;
    workoutName?: string;
    durationSeconds?: number;
    muscles?: Array<{ name: string; score?: number }>;
    exercises?: Array<{
      name: string;
      sets?: Array<{ set: number; reps: number; weight: number }>;
      totalSets?: number;
      totalReps?: number;
      topWeight?: number;
      volume?: number;
      targetMuscles?: string[];
    }>;
    intensity?: 'low' | 'moderate' | 'high';
    volume?: 'low' | 'moderate' | 'high';
    eccentricFocus?: boolean;
    programAssignmentId?: number;
  }) => {
    const res = await fetch(`${API_URL}/workout-sessions/complete-day`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(input),
    });
    return parseApiResponse(res, 'Failed to complete workout session');
  },

  getLatestWorkoutDaySummary: async (userId: number) => {
    const res = await fetch(`${API_URL}/workout-summaries/latest/${userId}`);
    return parseApiResponse(res, 'Failed to load latest workout summary');
  },

  getWorkoutDaySummaries: async (userId: number, limit = 20) => {
    const params = new URLSearchParams();
    params.set('limit', String(limit));
    const res = await fetch(`${API_URL}/workout-summaries/${userId}?${params.toString()}`);
    return parseApiResponse(res, 'Failed to load workout summaries');
  },

  getUserMissions: async (userId: number) => {
    return withOfflineReadFallback(
      offlineCacheKeys.userMissions(userId),
      async () => {
        const res = await fetch(`${API_URL}/missions/${userId}`);
        return parseApiResponse(res, 'Failed to fetch missions');
      },
    );
  },

  getMissionHistory: async (userId: number) => {
    return withOfflineReadFallback(
      offlineCacheKeys.missionHistory(userId),
      async () => {
        const res = await fetch(`${API_URL}/missions/${userId}/history`);
        return parseApiResponse(res, 'Failed to fetch mission history');
      },
    );
  },

  getUserChallenges: async (userId: number) => {
    return withOfflineReadFallback(
      offlineCacheKeys.userChallenges(userId),
      async () => {
        const res = await fetch(`${API_URL}/challenges/${userId}`);
        return parseApiResponse(res, 'Failed to fetch challenges');
      },
    );
  },

  getChallengeHistory: async (userId: number) => {
    return withOfflineReadFallback(
      offlineCacheKeys.challengeHistory(userId),
      async () => {
        const res = await fetch(`${API_URL}/challenges/${userId}/history`);
        return parseApiResponse(res, 'Failed to fetch challenge history');
      },
    );
  },

  getGamificationSummary: async (userId: number) => {
    return withOfflineReadFallback(
      offlineCacheKeys.gamificationSummary(userId),
      async () => {
        const res = await fetch(`${API_URL}/gamification/${userId}/summary`);
        return parseApiResponse(res, 'Failed to fetch gamification summary');
      },
    );
  },

  getLeaderboard: async (userId: number, period: 'monthly' | 'alltime' = 'alltime') => {
    return withOfflineReadFallback(
      offlineCacheKeys.leaderboard(userId, period),
      async () => {
        const res = await fetch(`${API_URL}/leaderboard/${userId}?period=${period}`);
        const data = await res.json();
        if (!res.ok) {
          throw new Error(data?.error || 'Failed to fetch leaderboard');
        }
        return data;
      },
    );
  },

  updateProfilePicture: async (userId: number, profilePicture: string) => {
    const res = await fetch(`${API_URL}/profile/${userId}/picture`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ profilePicture })
    });
    const data = await res.json();
    if (!res.ok) {
      throw new Error(data?.error || 'Failed to save profile picture');
    }
    return data;
  },

  getProfilePicture: async (userId: number) => {
    const res = await fetch(`${API_URL}/profile/${userId}/picture`);
    const data = await res.json();
    if (!res.ok) {
      throw new Error(data?.error || 'Failed to fetch profile picture');
    }
    return data;
  },

  getProfileDetails: async (userId: number) => {
    return withOfflineReadFallback(
      offlineCacheKeys.profileDetails(userId),
      async () => {
        const res = await fetch(`${API_URL}/profile/${userId}/details`);
        const data = await res.json();
        if (!res.ok) {
          throw new Error(data?.error || 'Failed to fetch profile details');
        }
        return data;
      },
    );
  },

  updateProfileDetails: async (userId: number, payload: any) => {
    const res = await fetch(`${API_URL}/profile/${userId}/details`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    const data = await res.json();
    if (!res.ok) {
      throw new Error(data?.error || 'Failed to update profile details');
    }
    return data;
  },

  updateProfilePassword: async (
    userId: number,
    payload: { oldPassword: string; newPassword: string; confirmPassword: string },
  ) => {
    const res = await fetch(`${API_URL}/profile/${userId}/password`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    const data = await res.json();
    if (!res.ok) {
      throw new Error(data?.error || 'Failed to update password');
    }
    return data;
  },

  getProfileStats: async (userId: number) => {
    return withOfflineReadFallback(
      offlineCacheKeys.profileStats(userId),
      async () => {
        const res = await fetch(`${API_URL}/profile/${userId}/stats`);
        const contentType = res.headers.get('content-type') || '';
        if (!contentType.includes('application/json')) {
          if (res.status === 404) {
            return { completedExercises: 0, firstCompletedAt: null, rankPosition: 0, totalMembers: 0 };
          }
          const text = await res.text();
          throw new Error(`Profile stats API returned non-JSON response (status ${res.status}): ${text.slice(0, 120)}`);
        }
        const data = await res.json();
        if (!res.ok) {
          throw new Error(data?.error || 'Failed to fetch profile stats');
        }
        return data;
      },
    );
  },

  chatCompletions: async (payload: {
    messages: any[];
    model?: string;
    temperature?: number;
    maxTokens?: number;
  }) => {
    const res = await fetch(`${API_URL}/ai/chat-completions`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    return parseApiResponse(res, 'Failed to call AI service');
  },
};
