const API_URL = 'http://localhost:5001/api';

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
    return res.json();
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
  }
};
