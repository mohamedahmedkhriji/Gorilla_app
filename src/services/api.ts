const API_URL = 'http://localhost:5001/api';

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
    return res.json();
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
    return res.json();
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
    return res.json();
  },

  updateRecoveryFactors: async (userId: number, data: any) => {
    const res = await fetch(`${API_URL}/user/${userId}/recovery`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data)
    });
    return res.json();
  },

  recalculateTodayRecovery: async (userId: number) => {
    const res = await fetch(`${API_URL}/user/${userId}/recovery/recalculate-today`, {
      method: 'POST'
    });
    return res.json();
  },

  getGymMembers: async (userId: number) => {
    const res = await fetch(`${API_URL}/user/${userId}/gym-members`);
    return res.json();
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
    return res.json();
  },

  getMissionHistory: async (userId: number) => {
    const res = await fetch(`${API_URL}/missions/${userId}/history`);
    return res.json();
  },

  getUserChallenges: async (userId: number) => {
    const res = await fetch(`${API_URL}/challenges/${userId}`);
    return res.json();
  },

  getChallengeHistory: async (userId: number) => {
    const res = await fetch(`${API_URL}/challenges/${userId}/history`);
    return res.json();
  },

  getGamificationSummary: async (userId: number) => {
    const res = await fetch(`${API_URL}/gamification/${userId}/summary`);
    return res.json();
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
