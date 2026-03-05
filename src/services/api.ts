const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:5001/api';

const parseApiResponse = async (res: Response, fallbackError = 'Request failed') => {
  const contentType = res.headers.get('content-type') || '';
  if (!contentType.includes('application/json')) {
    const text = await res.text();
    throw new Error(
      `Server returned non-JSON response (status ${res.status}). ` +
      `If you just changed backend routes, restart backend. Response: ${text.slice(0, 120)}`
    );
  }

  const data = await res.json();
  if (!res.ok) {
    throw new Error(data?.error || fallbackError);
  }
  return data;
};

export const api = {
  login: async (email: string, password: string, role: string) => {
    const res = await fetch(`${API_URL}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password, role })
    });
    return res.json();
  },

  createUser: async (data: any) => {
    const res = await fetch(`${API_URL}/auth/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data)
    });
    const body = await res.json();
    if (!res.ok || body?.error) {
      throw new Error(body?.error || 'Failed to create user');
    }
    return body;
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
    return res.json();
  },

  saveOnboarding: async (userId: number, data: any) => {
    const res = await fetch(`${API_URL}/user/onboarding`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ userId, ...data })
    });
    return parseApiResponse(res, 'Failed to save onboarding data');
  },

  getUserProgram: async (userId: number) => {
    const res = await fetch(`${API_URL}/user/${userId}/program`);
    return res.json();
  },

  getProgramProgress: async (userId: number) => {
    const res = await fetch(`${API_URL}/user/${userId}/program-progress`);
    return res.json();
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
    const res = await fetch(`${API_URL}/coach/${coachId}/program-requests${query ? `?${query}` : ''}`);
    return parseApiResponse(res, 'Failed to load coach program requests');
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
  }) => {
    const res = await fetch(`${API_URL}/nutrition/daily-plan`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(input),
    });
    return parseApiResponse(res, 'Failed to generate daily nutrition plan');
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

    const res = await fetch(`${API_URL}/blogs?${params.toString()}`);
    return parseApiResponse(res, 'Failed to fetch blogs feed');
  },

  createBlogPost: async (input: {
    userId: number;
    description: string;
    category: 'Training' | 'Nutrition' | 'Recovery' | 'Mindset';
    mediaType: 'image' | 'video';
    mediaUrl: string;
    mediaAlt?: string;
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

    const res = await fetch(`${API_URL}/blogs/${postId}/comments?${params.toString()}`);
    return parseApiResponse(res, 'Failed to fetch blog comments');
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

  getMuscleDistribution: async (userId: number, days = 30) => {
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

  getPlanMuscleDistribution: async (userId: number) => {
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

  getBiWeeklyReport: async (userId: number) => {
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

  getOverloadPlan: async (userId: number) => {
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

  getRecoveryStatus: async (userId: number) => {
    const res = await fetch(`${API_URL}/user/${userId}/recovery`);
    return parseApiResponse(res, 'Failed to fetch recovery status');
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
    return res.json();
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
    return res.json();
  },

  getNotifications: async (userId: number) => {
    const res = await fetch(`${API_URL}/notifications/${userId}`);
    return res.json();
  },

  markNotificationRead: async (notificationId: number) => {
    const res = await fetch(`${API_URL}/notifications/${notificationId}/read`, {
      method: 'PUT'
    });
    return res.json();
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
    const res = await fetch(`${API_URL}/messages/${userId}/${coachId}`);
    return res.json();
  },

  markMessagesAsRead: async (coachId: number, userId: number) => {
    const res = await fetch(`${API_URL}/messages/read/${coachId}/${userId}`, {
      method: 'PUT'
    });
    return res.json();
  },

  markUserMessagesAsRead: async (userId: number, coachId: number) => {
    const res = await fetch(`${API_URL}/messages/read-user/${userId}/${coachId}`, {
      method: 'PUT'
    });
    return res.json();
  },

  getAllUsers: async () => {
    const res = await fetch(`${API_URL}/users`);
    return res.json();
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

  getUserMissions: async (userId: number) => {
    const res = await fetch(`${API_URL}/missions/${userId}`);
    return parseApiResponse(res, 'Failed to fetch missions');
  },

  getMissionHistory: async (userId: number) => {
    const res = await fetch(`${API_URL}/missions/${userId}/history`);
    return parseApiResponse(res, 'Failed to fetch mission history');
  },

  getUserChallenges: async (userId: number) => {
    const res = await fetch(`${API_URL}/challenges/${userId}`);
    return parseApiResponse(res, 'Failed to fetch challenges');
  },

  getChallengeHistory: async (userId: number) => {
    const res = await fetch(`${API_URL}/challenges/${userId}/history`);
    return parseApiResponse(res, 'Failed to fetch challenge history');
  },

  getGamificationSummary: async (userId: number) => {
    const res = await fetch(`${API_URL}/gamification/${userId}/summary`);
    return parseApiResponse(res, 'Failed to fetch gamification summary');
  },

  getLeaderboard: async (userId: number, period: 'monthly' | 'alltime' = 'alltime') => {
    const res = await fetch(`${API_URL}/leaderboard/${userId}?period=${period}`);
    const data = await res.json();
    if (!res.ok) {
      throw new Error(data?.error || 'Failed to fetch leaderboard');
    }
    return data;
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
    const res = await fetch(`${API_URL}/profile/${userId}/details`);
    const data = await res.json();
    if (!res.ok) {
      throw new Error(data?.error || 'Failed to fetch profile details');
    }
    return data;
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
};
