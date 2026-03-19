import React, { useState, useEffect, useRef, useMemo } from 'react';
import { Users, Calendar, TrendingUp, Bell, LogOut, UserPlus, Send, Camera, X, Home, MessageSquare, ArrowLeft, ArrowRight, ClipboardList, Search } from 'lucide-react';
import { CoachSchedule } from '../../components/admin/CoachSchedule';
import { ClientsListScreen, type ClientRank, type CoachPanelClient } from '../../components/admin/ClientsListScreen';
import { TodaysActivity } from '../../components/admin/TodaysActivity';
import { Notifications } from '../../components/admin/Notifications';
import { AddUser } from '../../components/admin/AddUser';
import { BrandLogo } from '../../components/ui/BrandLogo';
import { WorkspacePlaceholderScreen } from '../../components/workspace/WorkspacePlaceholderScreen';
import { getWorkspacePage } from '../../config/workspacePages';
import { api } from '../../services/api';
import { socketService } from '../../services/socket';
import { useScrollToTopOnChange } from '../../shared/scroll';
import { clearStoredAdminSession } from '../../shared/adminAuthStorage';

interface Client extends CoachPanelClient {
  lastMessage: string;
  unread: number;
  lastActive: string;
}

interface ProgramChangeRequest {
  id: number;
  userId: number;
  userName: string;
  userEmail: string;
  planName: string;
  description: string;
  cycleWeeks: number;
  selectedDays: string[];
  weeklyWorkouts: Array<{
    dayName?: string;
    workoutName?: string;
    exercises?: Array<{
      exerciseName?: string;
      sets?: number;
      reps?: string | number;
      notes?: string | null;
    }>;
  }>;
  status: 'pending' | 'approved' | 'rejected' | 'cancelled';
  reviewNotes?: string | null;
  reviewedAt?: string | null;
  createdAt: string;
}

interface CoachDashboardProps {
  onLogout?: () => void;
}

const toClientAge = (value: unknown): number | null => {
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed <= 0) return null;
  return Math.round(parsed);
};

const toClientAvatar = (name: unknown): string => {
  const safeName = String(name || '').trim();
  if (!safeName) return 'U';

  const initials = safeName
    .split(' ')
    .filter(Boolean)
    .slice(0, 2)
    .map((chunk) => chunk.charAt(0).toUpperCase())
    .join('');

  return initials || safeName.charAt(0).toUpperCase() || 'U';
};

const toClientRank = (rankValue: unknown, pointsValue: unknown): ClientRank => {
  const normalizedRank = String(rankValue || '').trim().toLowerCase();

  if (normalizedRank === 'bronze') return 'bronze';
  if (normalizedRank === 'silver') return 'silver';
  if (normalizedRank === 'gold') return 'gold';
  if (normalizedRank === 'elite' || normalizedRank === 'diamond' || normalizedRank === 'platinum') return 'elite';

  const points = Number(pointsValue);
  if (Number.isFinite(points) && points >= 800) return 'elite';
  if (Number.isFinite(points) && points >= 400) return 'gold';
  if (Number.isFinite(points) && points >= 150) return 'silver';
  return 'bronze';
};

export const CoachDashboard: React.FC<CoachDashboardProps> = ({ onLogout }) => {
  const [view, setView] = useState<'dashboard' | 'schedule' | 'clients' | 'activity' | 'notifications' | 'adduser' | 'planrequests' | 'programbuilder'>('dashboard');
  const [dashboardSection, setDashboardSection] = useState<'overview' | 'messages'>('overview');
  const [inboxSearch, setInboxSearch] = useState('');
  const [inboxFilter, setInboxFilter] = useState<'all' | 'unread' | 'online'>('all');
  const [clients, setClients] = useState<Client[]>([]);
  const [selectedClient, setSelectedClient] = useState<Client | null>(null);
  const [messages, setMessages] = useState<any[]>([]);
  const [inputText, setInputText] = useState('');
  const [isClientTyping, setIsClientTyping] = useState(false);
  const [coachName, setCoachName] = useState('Coach');
  const [coachId, setCoachId] = useState<number | null>(null);
  const [coachProfilePicture, setCoachProfilePicture] = useState<string | null>(null);
  const [uploadingPicture, setUploadingPicture] = useState(false);
  const [pictureError, setPictureError] = useState('');
  const [networkError, setNetworkError] = useState('');
  const [previewImage, setPreviewImage] = useState<string | null>(null);
  const [previewAlt, setPreviewAlt] = useState('Profile image');
  const [programRequests, setProgramRequests] = useState<ProgramChangeRequest[]>([]);
  const [programRequestsLoading, setProgramRequestsLoading] = useState(false);
  const [programRequestsError, setProgramRequestsError] = useState('');
  const [pendingProgramRequestsCount, setPendingProgramRequestsCount] = useState(0);
  const [notificationsCount, setNotificationsCount] = useState(0);
  const [scheduleStats, setScheduleStats] = useState({ activeToday: 0, sessionsThisWeek: 0 });
  const [activeRequestActionId, setActiveRequestActionId] = useState<number | null>(null);
  const [selectedProgramRequest, setSelectedProgramRequest] = useState<ProgramChangeRequest | null>(null);
  const [pendingOpenClientProfileId, setPendingOpenClientProfileId] = useState<string | null>(null);
  const [theme, setTheme] = useState<'dark' | 'light'>('light');
  const fileInputRef = useRef<HTMLInputElement>(null);
  const selectedClientRef = useRef<Client | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const typingTimeoutRef = useRef<number | null>(null);

  const formatDateKey = (date: Date) => date.toLocaleDateString('en-CA');
  const getWeekRange = (date: Date) => {
    const copy = new Date(date);
    const day = copy.getDay();
    const diffToMonday = day === 0 ? -6 : 1 - day;
    const start = new Date(copy);
    start.setDate(copy.getDate() + diffToMonday);
    start.setHours(0, 0, 0, 0);
    const end = new Date(start);
    end.setDate(start.getDate() + 6);
    end.setHours(23, 59, 59, 999);
    return { start, end };
  };

  useScrollToTopOnChange([view]);

  const formatDayLabel = (rawDay: string | undefined, fallbackIndex: number) => {
    const source = String(rawDay || `day-${fallbackIndex + 1}`).trim().toLowerCase();
    if (!source) return `Day ${fallbackIndex + 1}`;
    return source.charAt(0).toUpperCase() + source.slice(1);
  };

  const readFileAsDataUrl = (file: File) =>
    new Promise<string>((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(String(reader.result || ''));
      reader.onerror = () => reject(new Error('Failed to read file'));
      reader.readAsDataURL(file);
    });

  const loadImage = (src: string) =>
    new Promise<HTMLImageElement>((resolve, reject) => {
      const img = new Image();
      img.onload = () => resolve(img);
      img.onerror = () => reject(new Error('Failed to load image'));
      img.src = src;
    });

  const toCompressedAvatarDataUrl = async (file: File, maxChars = 60000) => {
    const originalDataUrl = await readFileAsDataUrl(file);
    const image = await loadImage(originalDataUrl);

    const canvas = document.createElement('canvas');
    const context = canvas.getContext('2d');
    if (!context) {
      throw new Error('Canvas not supported');
    }

    let width = image.width;
    let height = image.height;
    const maxDimension = 512;
    if (width > maxDimension || height > maxDimension) {
      const ratio = Math.min(maxDimension / width, maxDimension / height);
      width = Math.max(1, Math.round(width * ratio));
      height = Math.max(1, Math.round(height * ratio));
    }

    let quality = 0.85;
    for (let attempt = 0; attempt < 8; attempt += 1) {
      canvas.width = width;
      canvas.height = height;
      context.clearRect(0, 0, width, height);
      context.drawImage(image, 0, 0, width, height);

      const compressed = canvas.toDataURL('image/jpeg', quality);
      if (compressed.length <= maxChars) {
        return compressed;
      }

      if (quality > 0.45) {
        quality -= 0.1;
      } else {
        width = Math.max(96, Math.round(width * 0.8));
        height = Math.max(96, Math.round(height * 0.8));
      }
    }

    throw new Error('Image is too large. Please choose a smaller image.');
  };

  useEffect(() => {
    selectedClientRef.current = selectedClient;
  }, [selectedClient]);

  useEffect(() => {
    const coach = JSON.parse(localStorage.getItem('coach') || '{}');
    const coachIdNum = Number(coach.id || 0);
    let unsubscribe: (() => void) | undefined;

    if (coachIdNum) {
      socketService.connect(coachIdNum, 'coach');
      unsubscribe = socketService.onNewMessage((msg) => {
        const activeClient = selectedClientRef.current;
        const activeClientId = Number(activeClient?.id || 0);

        const senderId = Number(msg.sender_id);
        const receiverId = Number(msg.receiver_id);
        const senderType = msg.sender_type;
        const receiverType = msg.receiver_type;

        const isCurrentConversation =
          activeClientId > 0 &&
          (
            (senderType === 'coach' && receiverType === 'user' && senderId === coachIdNum && receiverId === activeClientId) ||
            (senderType === 'user' && receiverType === 'coach' && senderId === activeClientId && receiverId === coachIdNum)
          );

        if (isCurrentConversation) {
          setMessages((prev) => {
            if (prev.some((m) => Number(m.id) === Number(msg.id))) {
              return prev;
            }
            return [...prev, msg];
          });
        }
        loadClients();
      });

      const unsubscribeTyping = socketService.onTyping((payload) => {
        const activeClient = selectedClientRef.current;
        const activeClientId = Number(activeClient?.id || 0);
        const isCurrentConversation =
          activeClientId > 0 &&
          Number(payload.sender_id) === activeClientId &&
          payload.sender_type === 'user' &&
          Number(payload.receiver_id) === coachIdNum &&
          payload.receiver_type === 'coach';

        if (!isCurrentConversation) return;
        setIsClientTyping(Boolean(payload.is_typing));
      });

      const baseUnsubscribe = unsubscribe;
      unsubscribe = () => {
        baseUnsubscribe?.();
        unsubscribeTyping?.();
      };
    }
    
    loadClients();

    return () => {
      unsubscribe?.();
      socketService.disconnect();
    };
  }, []);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, isClientTyping]);

  useEffect(() => {
    const user = JSON.parse(localStorage.getItem('adminUser') || '{}');
    const coach = JSON.parse(localStorage.getItem('coach') || '{}');
    const resolvedId = Number(user.id || coach.id || 0) || null;

    setCoachName(user.name || coach.name || 'Coach');
    setCoachId(resolvedId);
    setCoachProfilePicture(user.profile_picture || coach.profile_picture || null);

    const loadProfilePicture = async () => {
      if (!resolvedId) return;
      try {
        const data = await api.getProfilePicture(resolvedId);
        setCoachProfilePicture(data.profilePicture || null);
      } catch (error) {
        console.error('Failed to load coach profile picture:', error);
      }
    };

    loadProfilePicture();
  }, []);

  useEffect(() => {
    if (!coachId) return;
    let cancelled = false;

    const refreshPending = async () => {
      await refreshPendingProgramRequestsCount(coachId);
      if (cancelled) return;
    };

    void refreshPending();
    const timer = window.setInterval(() => {
      void refreshPending();
    }, 10000);

    return () => {
      cancelled = true;
      window.clearInterval(timer);
    };
  }, [coachId, view]);

  useEffect(() => {
    if (!coachId) return;
    let cancelled = false;

    const refreshScheduleStats = async () => {
      try {
        const today = new Date();
        const todayKey = formatDateKey(today);
        const { start, end } = getWeekRange(today);
        const weekStart = formatDateKey(start);
        const weekEnd = formatDateKey(end);

        const [todayResponse, weekResponse] = await Promise.all([
          api.getCoachSchedule(coachId, todayKey, todayKey),
          api.getCoachSchedule(coachId, weekStart, weekEnd),
        ]);

        if (cancelled) return;
        const todaySessions = Array.isArray(todayResponse?.sessions) ? todayResponse.sessions : [];
        const weekSessions = Array.isArray(weekResponse?.sessions) ? weekResponse.sessions : [];

        setScheduleStats({
          activeToday: todaySessions.length,
          sessionsThisWeek: weekSessions.length,
        });
      } catch (error) {
        if (!cancelled) {
          setScheduleStats((prev) => ({ ...prev, activeToday: 0, sessionsThisWeek: 0 }));
        }
      }
    };

    void refreshScheduleStats();
    const timer = window.setInterval(() => {
      void refreshScheduleStats();
    }, 30000);

    return () => {
      cancelled = true;
      window.clearInterval(timer);
    };
  }, [coachId]);

  useEffect(() => {
    if (!coachId) return;
    let cancelled = false;

    const refreshNotificationsCount = async () => {
      try {
        const notifications = await api.getNotifications(coachId);
        if (cancelled) return;
        const unread = Array.isArray(notifications)
          ? notifications.filter((item: any) => Boolean(item?.unread)).length
          : 0;
        setNotificationsCount(unread);
      } catch (error) {
        if (!cancelled) setNotificationsCount(0);
      }
    };

    void refreshNotificationsCount();
    const timer = window.setInterval(() => {
      void refreshNotificationsCount();
    }, 10000);

    return () => {
      cancelled = true;
      window.clearInterval(timer);
    };
  }, [coachId, view]);

  useEffect(() => {
    if (view !== 'planrequests' || !coachId) return;
    void loadProgramRequests(coachId);
  }, [view, coachId]);

  const handleProfileImagePick = () => {
    fileInputRef.current?.click();
  };

  const handleProfileImageChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !coachId) return;

    setPictureError('');
    setUploadingPicture(true);

    try {
      const dataUrl = await toCompressedAvatarDataUrl(file);
      await api.updateProfilePicture(coachId, dataUrl);
      setCoachProfilePicture(dataUrl);

      const adminUser = JSON.parse(localStorage.getItem('adminUser') || '{}');
      localStorage.setItem('adminUser', JSON.stringify({ ...adminUser, profile_picture: dataUrl }));
    } catch (err: any) {
      const rawMessage = err?.message || 'Failed to save profile picture';
      const message = rawMessage.includes('413')
        ? 'Image too large. Please choose a smaller image.'
        : rawMessage;
      setPictureError(message);
    } finally {
      setUploadingPicture(false);
      e.target.value = '';
    }
  };

  const openImagePreview = (imageUrl: string, alt: string) => {
    setPreviewImage(imageUrl);
    setPreviewAlt(alt || 'Profile image');
  };

  const closeImagePreview = () => {
    setPreviewImage(null);
  };

  const loadClients = async (): Promise<Client[]> => {
    try {
      setNetworkError('');
      const coach = JSON.parse(localStorage.getItem('coach') || '{}');
      const coachId = Number(coach?.id || 0);

      type RawUser = {
        id: number | string;
        name?: string | null;
        coach_id?: number | string | null;
        profile_picture?: string | null;
        age?: number | string | null;
        rank?: string | null;
        total_points?: number | string | null;
      };

      const allUsersPayload = await api.getAllUsers();
      const allUsers = Array.isArray(allUsersPayload) ? (allUsersPayload as RawUser[]) : [];
      const visibleUsers = allUsers.filter((user) => {
        const userId = Number(user?.id || 0);
        if (!Number.isFinite(userId) || userId <= 0) return false;
        if (!coachId) return true;
        return Number(user?.coach_id || 0) === coachId;
      });

      const clientsWithLastMessage = await Promise.all(
        visibleUsers.map(async (user) => {
          const userId = Number(user.id || 0);
          const rawMessages = coachId ? await api.getMessages(userId, coachId) : [];
          const messages = Array.isArray(rawMessages) ? rawMessages : [];
          const lastMsg = messages[messages.length - 1];
          const unreadCount = messages.filter((message: any) => message.sender_type === 'user' && !message.read).length;
          const lastMessageAt = lastMsg?.created_at ? new Date(lastMsg.created_at).getTime() : 0;
          const safeName = String(user.name || `User ${userId}`).trim() || `User ${userId}`;

          const client: Client = {
            id: String(userId),
            name: safeName,
            age: toClientAge(user.age),
            avatar: toClientAvatar(safeName),
            rank: toClientRank(user.rank, user.total_points),
            profilePicture: typeof user.profile_picture === 'string' ? user.profile_picture : null,
            lastMessage: String(lastMsg?.message || ''),
            unread: unreadCount,
            lastActive: lastMessageAt
              ? new Date(lastMessageAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
              : 'Online',
          };

          return { client, lastMessageAt };
        }),
      );

      clientsWithLastMessage.sort((a, b) => b.lastMessageAt - a.lastMessageAt);
      const normalizedClients = clientsWithLastMessage.map(({ client }) => client);
      setClients(normalizedClients);
      return normalizedClients;
    } catch (error) {
      console.error('Failed to load clients:', error);
      setNetworkError('Server connection lost. Please make sure backend is running on port 5001.');
      return [];
    }
  };

  const handleRemoveClient = async (clientId: string) => {
    try {
      setNetworkError('');
      await api.deleteUser(clientId);
      setClients((prev) => prev.filter((client) => String(client.id) !== String(clientId)));
    } catch (error) {
      console.error('Failed to remove user:', error);
      setNetworkError('Failed to remove user. Please try again.');
      throw error;
    }
  };

  const handleBanClient = async (clientId: string, payload: { days: number; reason: string }) => {
    try {
      setNetworkError('');
      await api.banUser(clientId, { ...payload, coachId });
    } catch (error) {
      console.error('Failed to ban user:', error);
      setNetworkError('Failed to ban user. Please try again.');
      throw error;
    }
  };

  const refreshPendingProgramRequestsCount = async (resolvedCoachId: number) => {
    try {
      const response = await api.getCoachProgramChangeRequests(resolvedCoachId, 'pending');
      const requests = Array.isArray(response?.requests) ? response.requests : [];
      const pendingCount = Number(response?.pendingCount || requests.length || 0);
      setPendingProgramRequestsCount(pendingCount);
    } catch (error) {
      console.error('Failed to load pending program requests count:', error);
    }
  };

  const loadProgramRequests = async (resolvedCoachId: number) => {
    try {
      setProgramRequestsLoading(true);
      setProgramRequestsError('');
      const response = await api.getCoachProgramChangeRequests(resolvedCoachId);
      const requests = Array.isArray(response?.requests) ? response.requests : [];
      setProgramRequests(requests);
      const pendingCount = Number(response?.pendingCount || requests.filter((request: ProgramChangeRequest) => request.status === 'pending').length || 0);
      setPendingProgramRequestsCount(pendingCount);
    } catch (error) {
      console.error('Failed to load program requests:', error);
      setProgramRequestsError('Failed to load plan requests.');
    } finally {
      setProgramRequestsLoading(false);
    }
  };

  const handleApproveProgramRequest = async (requestId: number) => {
    if (!coachId) return;
    try {
      setActiveRequestActionId(requestId);
      setProgramRequestsError('');
      const response = await api.approveCoachProgramChangeRequest(coachId, requestId);
      if (!response?.success) {
        throw new Error(response?.error || 'Failed to approve plan request');
      }
      await loadProgramRequests(coachId);
    } catch (error: any) {
      console.error('Failed to approve program request:', error);
      setProgramRequestsError(error?.message || 'Failed to approve plan request');
    } finally {
      setActiveRequestActionId(null);
    }
  };

  const handleRejectProgramRequest = async (requestId: number) => {
    if (!coachId) return;
    const reasonInput = window.prompt('Optional rejection reason', '') ?? '';
    try {
      setActiveRequestActionId(requestId);
      setProgramRequestsError('');
      const response = await api.rejectCoachProgramChangeRequest(coachId, requestId, reasonInput);
      if (!response?.success) {
        throw new Error(response?.error || 'Failed to reject plan request');
      }
      await loadProgramRequests(coachId);
    } catch (error: any) {
      console.error('Failed to reject program request:', error);
      setProgramRequestsError(error?.message || 'Failed to reject plan request');
    } finally {
      setActiveRequestActionId(null);
    }
  };

  const handleApproveSelectedRequest = async () => {
    if (!selectedProgramRequest) return;
    await handleApproveProgramRequest(selectedProgramRequest.id);
    setSelectedProgramRequest(null);
  };

  const handleRejectSelectedRequest = async () => {
    if (!selectedProgramRequest) return;
    await handleRejectProgramRequest(selectedProgramRequest.id);
    setSelectedProgramRequest(null);
  };

  const handleSendMessage = async () => {
    if (!inputText.trim() || !selectedClient) return;
    try {
      const coach = JSON.parse(localStorage.getItem('coach') || '{}');
      const selectedUserId = parseInt(selectedClient.id);
      const messageText = inputText.trim();
      socketService.sendMessage(coach.id, 'coach', selectedUserId, 'user', messageText);
      socketService.sendTyping(coach.id, 'coach', selectedUserId, 'user', false);
      setInputText('');
      loadClients();

      // Ensure persisted history is reloaded even if realtime event is missed.
      window.setTimeout(async () => {
        try {
          const refreshed = await api.getMessages(selectedUserId, coach.id);
          setMessages(refreshed);
        } catch (error) {
          console.error('Failed to refresh coach messages after send:', error);
        }
      }, 250);
    } catch (error) {
      console.error('Failed to send message:', error);
      setNetworkError('Unable to send message. Please check server connection.');
    }
  };

  const emitCoachTyping = (value: string) => {
    if (!selectedClient) return;
    const coach = JSON.parse(localStorage.getItem('coach') || '{}');
    if (!coach?.id) return;
    const selectedUserId = parseInt(selectedClient.id);
    const hasText = value.trim().length > 0;
    socketService.sendTyping(coach.id, 'coach', selectedUserId, 'user', hasText);

    if (typingTimeoutRef.current) {
      window.clearTimeout(typingTimeoutRef.current);
      typingTimeoutRef.current = null;
    }

    if (hasText) {
      typingTimeoutRef.current = window.setTimeout(() => {
        socketService.sendTyping(coach.id, 'coach', selectedUserId, 'user', false);
      }, 1200);
    }
  };

  const handleClientSelect = async (client: Client) => {
    try {
      setDashboardSection('messages');
      setSelectedClient(client);
      setIsClientTyping(false);
      const coach = JSON.parse(localStorage.getItem('coach') || '{}');
      const msgs = await api.getMessages(parseInt(client.id), coach.id);
      setMessages(msgs);
      
      // Mark messages as read
      await api.markMessagesAsRead(coach.id, parseInt(client.id));
      loadClients();
    } catch (error) {
      console.error('Failed to load conversation:', error);
      setNetworkError('Unable to load conversation. Please check server connection.');
    }
  };

  const openClientChatFromNotification = async (userId: number) => {
    const normalizedUserId = Number(userId);
    if (!Number.isFinite(normalizedUserId) || normalizedUserId <= 0) return;

    setPendingOpenClientProfileId(null);
    setDashboardSection('messages');
    setView('dashboard');

    let targetClient = clients.find((client) => Number(client.id) === normalizedUserId) || null;
    if (!targetClient) {
      const refreshedClients = await loadClients();
      targetClient = refreshedClients.find((client) => Number(client.id) === normalizedUserId) || null;
    }

    if (!targetClient) {
      setNetworkError('Conversation not found for this notification.');
      return;
    }

    await handleClientSelect(targetClient);
  };

  const stats = {
    totalClients: clients.length,
    activeToday: scheduleStats.activeToday,
    notifications: notificationsCount,
    sessionsThisWeek: scheduleStats.sessionsThisWeek,
    planRequests: pendingProgramRequestsCount,
  };
  const isLightTheme = theme === 'light';
  const coachInitials = coachName
    .split(' ')
    .filter(Boolean)
    .map((name) => name[0])
    .join('')
    .slice(0, 2)
    .toUpperCase();
  const featuredClients = clients.slice(0, 4);
  const pendingRequestsPreview = programRequests.slice(0, 3);
  const mobileNavItems = [
    {
      key: 'home',
      label: 'Home',
      icon: Home,
      active: view === 'dashboard' && dashboardSection === 'overview',
      badge: 0,
      onClick: () => {
        setView('dashboard');
        setDashboardSection('overview');
      },
    },
    {
      key: 'inbox',
      label: 'Inbox',
      icon: MessageSquare,
      active: view === 'dashboard' && dashboardSection === 'messages',
      badge: clients.reduce((count, client) => count + Number(client.unread || 0), 0),
      onClick: () => {
        setView('dashboard');
        setDashboardSection('messages');
      },
    },
    {
      key: 'clients',
      label: 'Athletes',
      icon: Users,
      active: view === 'clients',
      badge: 0,
      onClick: () => setView('clients'),
    },
    {
      key: 'plans',
      label: 'Plans',
      icon: ClipboardList,
      active: view === 'planrequests',
      badge: pendingProgramRequestsCount,
      onClick: () => setView('planrequests'),
    },
    {
      key: 'alerts',
      label: 'Alerts',
      icon: Bell,
      active: view === 'notifications',
      badge: notificationsCount,
      onClick: () => setView('notifications'),
    },
  ] as const;
  const mobileNav = (
    <div className={`fixed inset-x-0 bottom-0 z-40 border-t px-3 py-3 lg:hidden ${
      isLightTheme ? 'border-slate-200 bg-white/95 backdrop-blur' : 'border-white/10 bg-[#101315]/95 backdrop-blur'
    }`}>
      <div className="mx-auto flex max-w-md items-center justify-between gap-2 rounded-[24px] px-1">
        {mobileNavItems.map((item) => {
          const Icon = item.icon;
          return (
            <button
              key={item.key}
              type="button"
              onClick={item.onClick}
              className={`relative flex min-w-0 flex-1 flex-col items-center justify-center rounded-2xl px-2 py-2.5 text-[11px] font-semibold transition-colors ${
                item.active
                  ? isLightTheme
                    ? 'bg-[#111827] text-white'
                    : 'bg-[#10b981] text-black'
                  : isLightTheme
                    ? 'text-slate-500 hover:bg-slate-100'
                    : 'text-white/55 hover:bg-white/10'
              }`}
            >
              <Icon size={18} />
              <span className="mt-1 truncate">{item.label}</span>
              {item.badge > 0 && (
                <span className={`absolute right-2 top-1 flex h-4 min-w-[16px] items-center justify-center rounded-full px-1 text-[10px] font-bold ${
                  item.active ? 'bg-black/15 text-inherit' : 'bg-[#10b981] text-black'
                }`}>
                  {item.badge > 9 ? '9+' : item.badge}
                </span>
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
  const summaryCards = [
    {
      key: 'clients',
      label: 'Athletes',
      value: stats.totalClients,
      icon: Users,
      tone: 'text-emerald-600',
      onClick: () => setView('clients'),
    },
    {
      key: 'activity',
      label: 'Active Today',
      value: stats.activeToday,
      icon: TrendingUp,
      tone: 'text-emerald-500',
      onClick: () => setView('activity'),
    },
    {
      key: 'notifications',
      label: 'Alerts',
      value: stats.notifications,
      icon: Bell,
      tone: 'text-sky-500',
      onClick: () => setView('notifications'),
    },
    {
      key: 'schedule',
      label: 'Sessions',
      value: stats.sessionsThisWeek,
      icon: Calendar,
      tone: 'text-violet-500',
      onClick: () => setView('schedule'),
    },
  ] as const;
  const inboxPreviewClients = useMemo(
    () =>
      clients.filter((client) => {
        const matchesSearch = client.name.toLowerCase().includes(inboxSearch.toLowerCase());
        if (!matchesSearch) return false;
        if (inboxFilter === 'unread') return client.unread > 0;
        if (inboxFilter === 'online') return client.lastActive === 'Online';
        return true;
      }),
    [clients, inboxFilter, inboxSearch],
  );

  if (view === 'schedule') {
    return (
      <>
        <CoachSchedule onBack={() => setView('dashboard')} />
        {mobileNav}
      </>
    );
  }

  if (view === 'clients') {
    return (
      <>
        <ClientsListScreen
          onBack={() => setView('dashboard')}
          clients={clients}
          isLightTheme={isLightTheme}
          initialSelectedClientId={pendingOpenClientProfileId}
          onConsumedInitialSelection={() => setPendingOpenClientProfileId(null)}
          onRemoveClient={handleRemoveClient}
          onBanClient={handleBanClient}
        />
        {mobileNav}
      </>
    );
  }

  if (view === 'activity') {
    return (
      <>
        <TodaysActivity onBack={() => setView('dashboard')} />
        {mobileNav}
      </>
    );
  }

  if (view === 'notifications') {
    return (
      <>
        <Notifications
          onBack={() => setView('dashboard')}
          coachId={coachId}
          isLightTheme={isLightTheme}
          onOpenMessageThread={(userId) => {
            void openClientChatFromNotification(userId);
          }}
          onOpenPlanInvitation={(userId) => {
            setPendingOpenClientProfileId(String(userId));
            setView('clients');
          }}
        />
        {mobileNav}
      </>
    );
  }

  if (view === 'adduser') {
    return (
      <>
        <AddUser
          onBack={() => setView('dashboard')}
          onSuccess={() => setView('clients')}
        />
        {mobileNav}
      </>
    );
  }

  if (view === 'programbuilder') {
    const page = getWorkspacePage('coach', 'program-builder');

    return (
      <>
        <WorkspacePlaceholderScreen
          title={page?.title || 'Program Builder'}
          description={page?.description || 'Coach program building tools will live here.'}
          onBack={() => setView('dashboard')}
          theme={theme}
          status={page?.status}
          implementation={page?.implementation}
          notes={[
            'Coaches can currently approve or reject athlete-submitted plan requests.',
            'A dedicated builder with workout authoring controls is not wired into the web panel yet.',
          ]}
          actions={[
            {
              label: 'Review Plan Requests',
              onClick: () => setView('planrequests'),
            },
            {
              label: 'Back to Dashboard',
              onClick: () => setView('dashboard'),
              variant: 'secondary',
            },
          ]}
        />
        {mobileNav}
      </>
    );
  }

  if (view === 'planrequests') {
    return (
      <div className={`min-h-screen ${isLightTheme ? 'bg-[#F5F7FB] text-[#111827]' : 'bg-[#1A1A1A] text-white'}`}>
        <div className={`border-b p-4 flex items-center justify-between gap-3 ${isLightTheme ? 'border-slate-200' : 'border-gray-800'}`}>
          <div>
            <h1 className="text-xl md:text-2xl font-bold">Plan Requests</h1>
            <p className={`text-xs md:text-sm ${isLightTheme ? 'text-slate-600' : 'text-gray-400'}`}>Approve or reject user custom plans before activation.</p>
          </div>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => setView('dashboard')}
              className={`px-3 py-2 rounded-lg text-sm transition-colors ${
                isLightTheme ? 'bg-white border border-slate-300 hover:bg-slate-50' : 'bg-[#242424] hover:bg-[#2A2A2A]'
              }`}
            >
              Back
            </button>
          </div>
        </div>

        <div className="p-4 space-y-3">
          {programRequestsError && (
            <div className="bg-red-500/10 border border-red-500 text-red-400 rounded-lg p-3 text-sm">
              {programRequestsError}
            </div>
          )}
          {programRequestsLoading && (
            <div className="text-sm text-gray-400">Loading requests...</div>
          )}
          {!programRequestsLoading && programRequests.length === 0 && (
            <div className="bg-[#242424] rounded-lg p-4 text-sm text-gray-400">
              No plan requests found.
            </div>
          )}
          {!programRequestsLoading && programRequests.map((request) => {
            const exercisesCount = request.weeklyWorkouts.reduce((total, workout) => {
              const count = Array.isArray(workout?.exercises) ? workout.exercises.length : 0;
              return total + count;
            }, 0);
            const isPending = request.status === 'pending';
            const isActing = activeRequestActionId === request.id;

            return (
                <div
                  key={request.id}
                  className={`rounded-lg p-4 border cursor-pointer hover:border-[#10b981]/40 transition-colors ${
                    isLightTheme ? 'bg-white border-slate-200' : 'bg-[#242424] border-gray-800'
                  }`}
                  onClick={() => setSelectedProgramRequest(request)}
                  role="button"
                  tabIndex={0}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' || e.key === ' ') {
                      e.preventDefault();
                      setSelectedProgramRequest(request);
                    }
                  }}
                >
                <div className="flex items-center justify-between gap-2">
                  <div>
                    <div className="font-semibold">{request.userName}</div>
                      <div className={`text-xs ${isLightTheme ? 'text-slate-500' : 'text-gray-400'}`}>{request.userEmail}</div>
                  </div>
                    <span className={`text-[11px] px-2 py-1 rounded border uppercase ${
                      request.status === 'pending'
                        ? (isLightTheme ? 'text-amber-700 border-amber-200 bg-amber-50' : 'text-amber-300 border-amber-500/40 bg-amber-500/10')
                        : request.status === 'approved'
                          ? (isLightTheme ? 'text-emerald-700 border-emerald-200 bg-emerald-50' : 'text-green-300 border-green-500/40 bg-green-500/10')
                          : request.status === 'rejected'
                            ? (isLightTheme ? 'text-rose-700 border-rose-200 bg-rose-50' : 'text-red-300 border-red-500/40 bg-red-500/10')
                            : (isLightTheme ? 'text-slate-600 border-slate-200 bg-slate-50' : 'text-gray-300 border-gray-600 bg-gray-500/10')
                    }`}
                    >
                      {request.status}
                    </span>
                  </div>

                  <div className="mt-3 space-y-1 text-sm">
                    <div className={isLightTheme ? 'text-slate-700' : undefined}>
                      <span className={`${isLightTheme ? 'text-slate-500' : 'text-gray-400'}`}>Plan:</span> {request.planName}
                    </div>
                    <div className={isLightTheme ? 'text-slate-700' : undefined}>
                      <span className={`${isLightTheme ? 'text-slate-500' : 'text-gray-400'}`}>Duration:</span> {request.cycleWeeks} weeks
                    </div>
                    <div className={isLightTheme ? 'text-slate-700' : undefined}>
                      <span className={`${isLightTheme ? 'text-slate-500' : 'text-gray-400'}`}>Days:</span> {request.selectedDays.join(', ') || '-'}
                    </div>
                    <div className={isLightTheme ? 'text-slate-700' : undefined}>
                      <span className={`${isLightTheme ? 'text-slate-500' : 'text-gray-400'}`}>Exercises per week:</span> {exercisesCount}
                    </div>
                    <div className={`text-xs pt-1 ${isLightTheme ? 'text-emerald-600' : 'text-emerald-600'}`}>Click to review full details</div>
                  </div>

                  {request.reviewNotes && (
                    <div className={`mt-2 text-xs ${isLightTheme ? 'text-slate-500' : 'text-gray-400'}`}>
                      Review note: {request.reviewNotes}
                    </div>
                  )}

                {isPending && (
                  <div className="mt-4 flex flex-wrap gap-2">
                    <button
                      type="button"
                      disabled={isActing}
                      onClick={(e) => {
                        e.stopPropagation();
                        void handleApproveProgramRequest(request.id);
                      }}
                      className="px-4 py-2 rounded-lg bg-[#10b981] text-black font-semibold hover:bg-[#a8e600] transition-colors disabled:opacity-50"
                    >
                      {isActing ? 'Working...' : 'Approve & Save'}
                    </button>
                    <button
                      type="button"
                      disabled={isActing}
                      onClick={(e) => {
                        e.stopPropagation();
                        void handleRejectProgramRequest(request.id);
                      }}
                      className="px-4 py-2 rounded-lg bg-red-500/20 text-red-300 border border-red-500/30 hover:bg-red-500/30 transition-colors disabled:opacity-50"
                    >
                      Reject
                    </button>
                  </div>
                )}
              </div>
            );
          })}
        </div>

          {selectedProgramRequest && (
            <div
              className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm p-0 md:flex md:items-center md:justify-center md:p-4"
              onClick={() => setSelectedProgramRequest(null)}
            >
              <div
                className={`absolute inset-x-0 bottom-0 max-h-[92vh] w-full overflow-y-auto rounded-t-[28px] border p-5 md:relative md:max-w-3xl md:rounded-[28px] ${
                  isLightTheme ? 'bg-white border-slate-200 text-[#111827]' : 'bg-[#202020] border-gray-700'
                }`}
                onClick={(e) => e.stopPropagation()}
              >
                <div className="mx-auto mb-3 h-1.5 w-14 rounded-full bg-current/15 md:hidden" />
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <h2 className="text-xl font-semibold">{selectedProgramRequest.planName}</h2>
                    <p className={`text-sm ${isLightTheme ? 'text-slate-500' : 'text-gray-400'}`}>
                      {selectedProgramRequest.userName} • {selectedProgramRequest.userEmail}
                    </p>
                    <p className={`text-xs mt-1 ${isLightTheme ? 'text-slate-500' : 'text-gray-500'}`}>
                      {selectedProgramRequest.cycleWeeks} weeks • {selectedProgramRequest.selectedDays.length} training days
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => setSelectedProgramRequest(null)}
                    className={`w-9 h-9 rounded-lg flex items-center justify-center ${
                      isLightTheme ? 'bg-slate-100 hover:bg-slate-200 text-slate-700' : 'bg-[#2A2A2A] hover:bg-[#333]'
                    }`}
                    title="Close"
                  >
                    <X size={18} />
                  </button>
                </div>

                {selectedProgramRequest.description && (
                  <div className={`mt-4 text-sm rounded-lg p-3 ${
                    isLightTheme ? 'text-slate-700 bg-slate-50 border border-slate-200' : 'text-gray-300 bg-[#1A1A1A] border border-gray-700'
                  }`}>
                    {selectedProgramRequest.description}
                  </div>
                )}

                <div className="mt-4 space-y-3">
                  {selectedProgramRequest.weeklyWorkouts.map((workout, workoutIndex) => {
                    const exercises = Array.isArray(workout.exercises) ? workout.exercises : [];
                    return (
                      <div
                        key={`detail-workout-${workoutIndex}`}
                        className={`rounded-lg p-3 ${
                          isLightTheme ? 'bg-white border border-slate-200' : 'bg-[#1A1A1A] border border-gray-700'
                        }`}
                      >
                        <div className="flex items-center justify-between gap-2">
                          <div className="font-semibold">
                            {formatDayLabel(workout.dayName, workoutIndex)}
                            {workout.workoutName ? ` • ${workout.workoutName}` : ''}
                          </div>
                          <span className={`text-xs ${isLightTheme ? 'text-slate-500' : 'text-gray-400'}`}>{exercises.length} exercises</span>
                        </div>
                        <div className="mt-2 space-y-1.5">
                          {exercises.map((exercise, exerciseIndex) => (
                            <div
                              key={`detail-workout-${workoutIndex}-exercise-${exerciseIndex}`}
                              className={`text-sm flex items-center justify-between gap-3 rounded-md px-2.5 py-1.5 ${
                                isLightTheme
                                  ? 'text-slate-700 bg-slate-50 border border-slate-200/70'
                                  : 'text-gray-300 bg-[#232323]'
                              }`}
                            >
                              <span className={isLightTheme ? 'text-slate-800' : 'text-white'}>
                                {exercise.exerciseName || `Exercise ${exerciseIndex + 1}`}
                              </span>
                              <span className={`text-xs ${isLightTheme ? 'text-slate-500' : 'text-gray-400'}`}>
                                {Number(exercise.sets || 0)} sets • {String(exercise.reps || '-')} reps
                              </span>
                            </div>
                          ))}
                          {exercises.length === 0 && (
                            <div className={`text-xs ${isLightTheme ? 'text-slate-500' : 'text-gray-500'}`}>No exercises in this day.</div>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>

                {selectedProgramRequest.reviewNotes && (
                  <div className={`mt-4 text-sm ${isLightTheme ? 'text-slate-700' : 'text-gray-300'}`}>
                    <span className={`${isLightTheme ? 'text-slate-500' : 'text-gray-400'}`}>Review note:</span> {selectedProgramRequest.reviewNotes}
                  </div>
                )}

              {selectedProgramRequest.status === 'pending' && (
                <div className="mt-5 flex flex-wrap gap-2">
                  <button
                    type="button"
                    disabled={activeRequestActionId === selectedProgramRequest.id}
                    onClick={() => void handleApproveSelectedRequest()}
                    className="px-4 py-2 rounded-lg bg-[#10b981] text-black font-semibold hover:bg-[#a8e600] transition-colors disabled:opacity-50"
                  >
                    {activeRequestActionId === selectedProgramRequest.id ? 'Working...' : 'Approve & Save'}
                  </button>
                  <button
                    type="button"
                    disabled={activeRequestActionId === selectedProgramRequest.id}
                    onClick={() => void handleRejectSelectedRequest()}
                    className="px-4 py-2 rounded-lg bg-red-500/20 text-red-300 border border-red-500/30 hover:bg-red-500/30 transition-colors disabled:opacity-50"
                  >
                    Reject
                  </button>
                </div>
              )}
            </div>
            </div>
          )}
          {mobileNav}
        </div>
      );
    }

  return (
    <>
      <div className={`min-h-screen ${isLightTheme ? 'bg-[#F5F7FB] text-[#111827]' : 'bg-[#1A1A1A] text-white'}`}>
      {dashboardSection === 'overview' && (
      <div className={`border-b px-3 pb-4 pt-3 md:px-4 md:pb-6 ${isLightTheme ? 'border-slate-200 bg-[radial-gradient(circle_at_top_right,_rgba(191,255,0,0.2),_transparent_28%),linear-gradient(180deg,_#ffffff,_#f5f7fb)]' : 'border-white/10 bg-[radial-gradient(circle_at_top_right,_rgba(191,255,0,0.16),_transparent_24%),linear-gradient(180deg,_#171b18,_#111315)]'}`}>
        <div className="mx-auto max-w-7xl">
          <div className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <div className="w-11 h-11 rounded-2xl border border-white/40 bg-white/70 p-2 shadow-[0_12px_28px_rgba(15,23,42,0.08)] md:w-12 md:h-12 md:p-2.5">
                <BrandLogo imageClassName="object-contain" />
              </div>
              <div>
                <p className={`text-[11px] uppercase tracking-[0.22em] ${isLightTheme ? 'text-slate-500' : 'text-white/45'}`}>Coach Panel</p>
                <h1 className="text-xl font-semibold md:text-2xl">{coachName}</h1>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                className="hidden"
                onChange={handleProfileImageChange}
              />
              <button
                onClick={() => {
                  if (onLogout) {
                    onLogout();
                    return;
                  }
                  clearStoredAdminSession();
                  window.location.href = '/admin.html';
                }}
                className={`inline-flex h-11 w-11 items-center justify-center rounded-2xl border transition-colors ${
                  isLightTheme
                    ? 'border-rose-200 bg-rose-50 text-rose-600 hover:bg-rose-100'
                    : 'border-rose-500/30 bg-rose-500/10 text-rose-300 hover:bg-rose-500/20'
                }`}
                title="Logout"
              >
                <LogOut size={18} />
              </button>
            </div>
          </div>

          <div className={`mt-5 overflow-hidden rounded-[28px] border p-4 md:p-6 ${
            isLightTheme
              ? 'border-slate-200 bg-white/90 shadow-[0_20px_50px_rgba(15,23,42,0.08)]'
              : 'border-white/10 bg-white/5 shadow-[0_18px_45px_rgba(0,0,0,0.22)]'
          }`}>
            <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
              <div className="flex items-start gap-4">
                <button
                  type="button"
                  onClick={handleProfileImagePick}
                  disabled={uploadingPicture}
                  className={`relative h-16 w-16 shrink-0 overflow-hidden rounded-2xl border transition-colors disabled:opacity-60 md:h-20 md:w-20 ${
                    isLightTheme
                      ? 'border-slate-200 bg-slate-50 hover:border-[#10b981]'
                      : 'border-white/10 bg-black/20 hover:border-[#10b981]'
                  }`}
                  title="Change profile image"
                >
                  {coachProfilePicture ? (
                    <img src={coachProfilePicture} alt="Coach profile" className="h-full w-full object-cover" />
                  ) : (
                    <span className="flex h-full w-full items-center justify-center text-lg font-bold text-emerald-600">
                      {coachInitials || 'CO'}
                    </span>
                  )}
                  <span className="absolute bottom-1.5 right-1.5 rounded-full bg-[#10b981] p-1 text-black">
                    <Camera size={12} />
                  </span>
                </button>

                <div className="min-w-0">
                  <div className={`inline-flex items-center rounded-full px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.18em] ${
                    isLightTheme ? 'bg-[#10b981]/20 text-[#3c4d00]' : 'bg-[#10b981]/15 text-[#dfff84]'
                  }`}>
                    Ready to coach
                  </div>
                  <h2 className="mt-3 text-2xl font-semibold md:text-3xl">Mobile-first workspace</h2>
                  <p className={`mt-2 max-w-2xl text-sm leading-6 md:text-base ${
                    isLightTheme ? 'text-slate-600' : 'text-white/65'
                  }`}>
                    Keep roster, chat, approvals, and alerts one tap away with a cleaner mobile coaching flow.
                  </p>

                  <div className="mt-4 flex flex-wrap gap-2">
                    <button
                      type="button"
                      onClick={() => setView('adduser')}
                      className="inline-flex items-center gap-2 rounded-2xl bg-[#10b981] px-4 py-3 text-sm font-semibold text-black transition-colors hover:bg-[#a8e600]"
                    >
                      <UserPlus size={18} />
                      Add Athlete
                    </button>
                    <button
                      type="button"
                      onClick={() => setView('planrequests')}
                      className={`inline-flex items-center gap-2 rounded-2xl px-4 py-3 text-sm font-semibold transition-colors ${
                        isLightTheme
                          ? 'border border-slate-200 bg-white text-slate-800 hover:bg-slate-50'
                          : 'border border-white/10 bg-white/5 text-white hover:bg-white/10'
                      }`}
                    >
                      <ClipboardList size={18} />
                      Review Plans
                    </button>
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3 lg:w-[320px]">
                <div className={`rounded-2xl border p-4 ${
                  isLightTheme ? 'border-slate-200 bg-slate-50' : 'border-white/10 bg-black/20'
                }`}>
                  <p className={`text-[11px] uppercase tracking-[0.2em] ${isLightTheme ? 'text-slate-500' : 'text-white/45'}`}>Unread</p>
                  <p className="mt-2 text-2xl font-semibold">{clients.reduce((count, client) => count + Number(client.unread || 0), 0)}</p>
                  <p className={`mt-1 text-xs ${isLightTheme ? 'text-slate-500' : 'text-white/55'}`}>Messages waiting</p>
                </div>
                <div className={`rounded-2xl border p-4 ${
                  isLightTheme ? 'border-slate-200 bg-slate-50' : 'border-white/10 bg-black/20'
                }`}>
                  <p className={`text-[11px] uppercase tracking-[0.2em] ${isLightTheme ? 'text-slate-500' : 'text-white/45'}`}>Plans</p>
                  <p className="mt-2 text-2xl font-semibold">{pendingProgramRequestsCount}</p>
                  <p className={`mt-1 text-xs ${isLightTheme ? 'text-slate-500' : 'text-white/55'}`}>Pending approvals</p>
                </div>
              </div>
            </div>
          </div>

          {pictureError && (
            <p className="mt-3 text-xs text-red-500">{pictureError}</p>
          )}
          {networkError && (
            <p className={`mt-2 text-xs ${isLightTheme ? 'text-amber-600' : 'text-amber-300'}`}>{networkError}</p>
          )}
        </div>
      </div>
      )}

      {dashboardSection === 'overview' && (
      <div className="grid grid-cols-2 gap-3 p-3 md:grid-cols-4 md:gap-4 md:p-4">
        {summaryCards.map((card) => {
          const Icon = card.icon;
          return (
            <button
              key={card.key}
              type="button"
              onClick={card.onClick}
              className={`rounded-[24px] border p-4 text-left transition-transform hover:-translate-y-0.5 ${
                isLightTheme
                  ? 'border-slate-200 bg-white shadow-[0_10px_24px_rgba(15,23,42,0.05)] hover:bg-slate-50'
                  : 'border-white/10 bg-white/5 hover:bg-white/10'
              }`}
            >
              <Icon size={18} className={card.tone} />
              <div className="mt-4 text-2xl font-semibold md:text-3xl">{card.value}</div>
              <div className={`mt-1 text-xs md:text-sm ${isLightTheme ? 'text-slate-500' : 'text-white/55'}`}>{card.label}</div>
            </button>
          );
        })}
      </div>
      )}

      <div className={`grid grid-cols-1 gap-3 p-3 pb-0 md:gap-4 md:p-4 lg:pb-4 lg:grid-cols-3 lg:h-[calc(100vh-250px)] ${dashboardSection === 'messages' ? 'block' : 'hidden lg:grid'}`}>
        <div className={`overflow-y-auto rounded-[32px] p-3 md:p-4 h-[calc(100dvh-84px)] lg:h-full ${selectedClient ? 'hidden lg:block' : 'block'} ${isLightTheme ? 'bg-white border border-slate-200 shadow-[0_10px_24px_rgba(15,23,42,0.05)]' : 'bg-[#f7f3ef] text-[#161616] border border-[#eadfd4] shadow-[0_18px_40px_rgba(0,0,0,0.18)]'}`}>

          <div className={`mb-3 flex items-center gap-3 rounded-full px-4 py-3 ${isLightTheme ? 'bg-slate-100 text-slate-500' : 'bg-white text-[#7a756e] shadow-[inset_0_1px_0_rgba(255,255,255,0.8)]'}`}>
            <Search size={16} />
            <input
              type="text"
              value={inboxSearch}
              onChange={(e) => setInboxSearch(e.target.value)}
              placeholder="Search chats..."
              className={`w-full bg-transparent text-sm outline-none ${isLightTheme ? 'placeholder:text-slate-400' : 'placeholder:text-[#999287]'}`}
            />
          </div>

          <div className="mb-4 flex gap-2 overflow-x-auto pb-1">
            {[
              { key: 'all', label: 'All' },
              { key: 'unread', label: `Unread ${clients.filter((client) => client.unread > 0).length}` },
              { key: 'online', label: 'Online' },
            ].map((filter) => (
              <button
                key={filter.key}
                type="button"
                onClick={() => setInboxFilter(filter.key as 'all' | 'unread' | 'online')}
                className={`whitespace-nowrap rounded-full px-3 py-1.5 text-xs font-semibold transition-colors ${
                  inboxFilter === filter.key
                    ? isLightTheme
                      ? 'bg-[#2563eb] text-white'
                      : 'bg-white text-[#2563eb] shadow-[0_6px_12px_rgba(0,0,0,0.08)]'
                    : isLightTheme
                      ? 'bg-slate-100 text-slate-500'
                      : 'bg-[#efe7de] text-[#8a8279]'
                }`}
              >
                {filter.label}
              </button>
            ))}
          </div>

          <div className="space-y-1">
            {inboxPreviewClients.map(client => (
              <button
                key={client.id}
                onClick={() => handleClientSelect(client)}
                className={`w-full p-3 rounded-[22px] text-left transition-colors ${
                  selectedClient?.id === client.id
                    ? isLightTheme
                      ? 'bg-blue-50 border border-blue-200'
                      : 'bg-white border border-[#d9cec2]'
                    : isLightTheme
                      ? 'bg-white border border-transparent hover:bg-slate-50'
                      : 'bg-transparent border border-transparent hover:bg-white/60'
                }`}
              >
                <div className="flex items-center gap-3">
                  <div className={`w-11 h-11 rounded-full flex items-center justify-center overflow-hidden ${isLightTheme ? 'bg-slate-200' : 'bg-[#e0d4c7]'}`}>
                    {client.profilePicture ? (
                      <div
                        onClick={(e) => {
                          e.stopPropagation();
                          openImagePreview(client.profilePicture || '', `${client.name} profile`);
                        }}
                        className="w-full h-full overflow-hidden cursor-zoom-in"
                      >
                        <img
                          src={client.profilePicture}
                          alt={`${client.name} profile`}
                          className="w-full h-full object-cover"
                        />
                      </div>
                    ) : (
                      <span className="font-bold text-sm">{client.avatar}</span>
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <span className="block truncate font-semibold text-sm">{client.name}</span>
                        <p className={`mt-0.5 truncate text-xs ${isLightTheme ? 'text-slate-500' : 'text-[#7e776f]'}`}>
                          {client.lastMessage || 'Tap to open conversation'}
                        </p>
                      </div>
                      <div className="flex shrink-0 flex-col items-end gap-1">
                        <span className={`text-[11px] ${isLightTheme ? 'text-slate-400' : 'text-[#8f877d]'}`}>{client.lastActive}</span>
                      {client.unread > 0 && (
                          <span className="flex h-4 min-w-[16px] items-center justify-center rounded-full bg-[#2563eb] px-1 text-[10px] font-semibold text-white">{client.unread}</span>
                      )}
                      </div>
                    </div>
                  </div>
                </div>
              </button>
            ))}
            {inboxPreviewClients.length === 0 && (
              <div className={`rounded-[22px] px-4 py-6 text-center text-sm ${isLightTheme ? 'bg-slate-50 text-slate-500' : 'bg-white/60 text-[#7e776f]'}`}>
                No chats match this filter.
              </div>
            )}
          </div>
        </div>

        {selectedClient ? (
          <div className={`lg:col-span-2 rounded-[28px] flex flex-col min-h-[58vh] h-[calc(100dvh-84px)] lg:h-[calc(100vh-250px)] ${isLightTheme ? 'bg-white border border-slate-200 shadow-[0_10px_24px_rgba(15,23,42,0.05)]' : 'bg-white/5 border border-white/10'}`}>
              <div className={`p-4 border-b ${isLightTheme ? 'border-slate-200' : 'border-white/10'}`}>
                <div className="flex items-center justify-between gap-3">
                  <div className="flex items-center gap-3">
                    <button
                      type="button"
                      onClick={() => setSelectedClient(null)}
                      className={`lg:hidden inline-flex h-10 w-10 items-center justify-center rounded-full ${
                        isLightTheme ? 'bg-slate-100 text-slate-700' : 'bg-white/10 text-white/70'
                      }`}
                      aria-label="Go back to conversations"
                    >
                      <ArrowLeft className="h-4 w-4" />
                    </button>
                    <div className="w-10 h-10 rounded-full bg-[#10b981]/20 flex items-center justify-center">
                      {selectedClient.profilePicture ? (
                        <button
                          type="button"
                          onClick={() => openImagePreview(selectedClient.profilePicture || '', `${selectedClient.name} profile`)}
                          className="w-full h-full rounded-full overflow-hidden"
                        >
                          <img
                            src={selectedClient.profilePicture}
                            alt={`${selectedClient.name} profile`}
                            className="w-full h-full rounded-full object-cover"
                          />
                        </button>
                      ) : (
                        <span className="font-bold">{selectedClient.avatar}</span>
                      )}
                    </div>
                    <div>
                      <div className="font-semibold">{selectedClient.name}</div>
                      <div className={`text-xs ${isLightTheme ? 'text-slate-500' : 'text-gray-400'}`}>Active {selectedClient.lastActive}</div>
                    </div>
                  </div>
                </div>
              </div>

              <div className="flex-1 p-4 overflow-y-auto space-y-3">
                {messages.map((msg, i) => {
                  const coach = JSON.parse(localStorage.getItem('coach') || '{}');
                  const isCoach = Number(msg.sender_id) === Number(coach.id) && msg.sender_type === 'coach';
                  const senderName = msg.sender_name || (isCoach ? 'You' : selectedClient?.name || 'Client');
                  const time = new Date(msg.created_at).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' });

                  return (
                    <div
                      key={msg.id || i}
                      className={`flex items-end gap-2 chat-message-in ${isCoach ? 'justify-end' : 'justify-start'}`}
                    >
                      {!isCoach && (
                          <div
                            className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold shrink-0 overflow-hidden ${
                              isLightTheme
                                ? 'bg-white border border-slate-200 text-slate-600'
                                : 'bg-card border border-white/10 text-text-secondary'
                            }`}
                          >
                          {selectedClient?.profilePicture ? (
                            <img
                              src={selectedClient.profilePicture}
                              alt={`${selectedClient.name} profile`}
                              className="w-full h-full object-cover"
                            />
                          ) : (
                            senderName.charAt(0).toUpperCase()
                          )}
                        </div>
                      )}

                      <div className={`flex flex-col ${isCoach ? 'items-end' : 'items-start'}`}>
                          {!isCoach && (
                            <div className={`text-xs mb-1 ml-1 ${isLightTheme ? 'text-slate-400' : 'text-text-tertiary'}`}>
                              {senderName}
                            </div>
                          )}
                        <div
                          className={`relative w-fit min-w-[88px] max-w-[75vw] md:max-w-[70%] px-4 py-2.5 rounded-[20px] shadow-[0_2px_10px_rgba(0,0,0,0.14)] ${
                            isCoach
                              ? 'bg-accent text-black rounded-br-[8px]'
                              : isLightTheme
                                ? 'bg-white text-slate-800 border border-slate-200 rounded-bl-[8px] shadow-[0_2px_8px_rgba(15,23,42,0.06)]'
                                : 'bg-card text-text-primary border border-white/10 rounded-bl-[8px]'
                          }`}
                        >
                          <p className="text-base leading-relaxed whitespace-pre-wrap break-words">{msg.message}</p>
                            <p className={`text-xs mt-1 whitespace-nowrap leading-none ${
                              isCoach ? 'text-black/60' : isLightTheme ? 'text-slate-400' : 'text-text-tertiary'
                            }`}>
                              {time}
                            </p>
                          <span
                            className={`absolute bottom-2 w-2.5 h-2.5 rotate-45 ${
                              isCoach
                                ? 'right-[-4px] bg-accent'
                                : isLightTheme
                                  ? 'left-[-4px] bg-white border-l border-b border-slate-200'
                                  : 'left-[-4px] bg-card border-l border-b border-white/10'
                            }`}
                          />
                        </div>
                      </div>

                      {isCoach && (
                        <div className="w-8 h-8 rounded-full bg-accent/15 border border-accent/40 flex items-center justify-center text-xs font-bold text-accent shrink-0 overflow-hidden">
                          {coachProfilePicture ? (
                            <img
                              src={coachProfilePicture}
                              alt={`${coachName || 'Coach'} profile`}
                              className="w-full h-full object-cover"
                            />
                          ) : (
                            (coachName || 'You').charAt(0).toUpperCase()
                          )}
                        </div>
                      )}
                    </div>
                  );
                })}

                {isClientTyping && (
                  <div className="flex items-end gap-2 justify-start chat-message-in">
                      <div
                        className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold shrink-0 overflow-hidden ${
                          isLightTheme
                            ? 'bg-white border border-slate-200 text-slate-600'
                            : 'bg-card border border-white/10 text-text-secondary'
                        }`}
                      >
                      {selectedClient?.profilePicture ? (
                        <img
                          src={selectedClient.profilePicture}
                          alt={`${selectedClient.name} profile`}
                          className="w-full h-full object-cover"
                        />
                      ) : (
                        (selectedClient?.name || 'C').charAt(0).toUpperCase()
                      )}
                    </div>
                    <div
                      className={`relative rounded-[20px] rounded-bl-[8px] px-4 py-3 ${
                        isLightTheme
                          ? 'bg-white border border-slate-200 shadow-[0_2px_8px_rgba(15,23,42,0.06)]'
                          : 'bg-card border border-white/10 shadow-[0_2px_10px_rgba(0,0,0,0.14)]'
                      }`}
                    >
                      <div className="flex items-center gap-1.5">
                        <span className="chat-typing-dot" />
                        <span className="chat-typing-dot" style={{ animationDelay: '0.2s' }} />
                        <span className="chat-typing-dot" style={{ animationDelay: '0.4s' }} />
                      </div>
                      <span
                        className={`absolute left-[-4px] bottom-2 w-2.5 h-2.5 rotate-45 ${
                          isLightTheme ? 'bg-white border-l border-b border-slate-200' : 'bg-card border-l border-b border-white/10'
                        }`}
                      />
                    </div>
                  </div>
                )}
                <div ref={messagesEndRef} />
              </div>

              <div className={`p-4 border-t sticky bottom-0 ${isLightTheme ? 'border-slate-200 bg-white' : 'border-white/10 bg-card'}`}>
                <div className="flex gap-2">
                  <textarea
                    value={inputText}
                    onChange={(e) => {
                      setInputText(e.target.value);
                      emitCoachTyping(e.target.value);
                    }}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' && !e.shiftKey) {
                        e.preventDefault();
                        handleSendMessage();
                      }
                    }}
                    placeholder="Type a message..."
                    rows={1}
                    className={`flex-1 rounded-2xl px-4 py-3 text-sm border focus:outline-none focus:ring-2 focus:ring-accent/40 resize-none min-h-[48px] max-h-32 ${
                      isLightTheme
                        ? 'bg-white border-slate-200 placeholder-slate-400 text-slate-900'
                        : 'bg-background border-white/10 placeholder-text-tertiary text-text-primary'
                    }`}
                  />
                  <button
                    onClick={handleSendMessage}
                    className="bg-accent text-black p-3 rounded-2xl hover:bg-accent/90 transition-colors shadow-[0_4px_14px_rgba(191,255,0,0.22)]">
                    <Send size={20} />
                  </button>
                </div>
                </div>
          </div>
        ) : null}
      </div>

        {mobileNav}
      </div>

      {previewImage && (
        <div
          className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4"
          onClick={closeImagePreview}
        >
          <div
            className="relative max-w-3xl w-full"
            onClick={(e) => e.stopPropagation()}
          >
            <button
              type="button"
              onClick={closeImagePreview}
              className="absolute -top-10 right-0 text-white/80 hover:text-white transition-colors"
              aria-label="Close image preview"
            >
              <X size={24} />
            </button>
            <img
              src={previewImage}
              alt={previewAlt}
              className="w-full max-h-[85vh] object-contain rounded-xl"
            />
          </div>
        </div>
      )}
    </>
  );
};

