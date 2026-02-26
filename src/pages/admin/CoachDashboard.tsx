import React, { useState, useEffect, useRef } from 'react';
import { Users, Calendar, TrendingUp, Bell, LogOut, UserPlus, Send, Camera, X, Sun, Moon } from 'lucide-react';
import { CoachSchedule } from '../../components/admin/CoachSchedule';
import { ClientsListScreen } from '../../components/admin/ClientsListScreen';
import { TodaysActivity } from '../../components/admin/TodaysActivity';
import { Notifications } from '../../components/admin/Notifications';
import { AddUser } from '../../components/admin/AddUser';
import { api } from '../../services/api';
import { socketService } from '../../services/socket';

interface Client {
  id: string;
  name: string;
  avatar: string;
  profilePicture?: string | null;
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

export const CoachDashboard: React.FC<CoachDashboardProps> = ({ onLogout }) => {
  const [view, setView] = useState<'dashboard' | 'schedule' | 'clients' | 'activity' | 'notifications' | 'adduser' | 'planrequests'>('dashboard');
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
  const [activeRequestActionId, setActiveRequestActionId] = useState<number | null>(null);
  const [selectedProgramRequest, setSelectedProgramRequest] = useState<ProgramChangeRequest | null>(null);
  const [theme, setTheme] = useState<'dark' | 'light'>(() => {
    const saved = localStorage.getItem('coach-dashboard-theme');
    return saved === 'light' ? 'light' : 'dark';
  });
  const fileInputRef = useRef<HTMLInputElement>(null);
  const selectedClientRef = useRef<Client | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const typingTimeoutRef = useRef<number | null>(null);

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
    void refreshPendingProgramRequestsCount(coachId);
  }, [coachId]);

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

  const loadClients = async () => {
    try {
      setNetworkError('');
      const coach = JSON.parse(localStorage.getItem('coach') || '{}');
      const allUsers = await api.getAllUsers();
      
      // Get last message for each user
      const clientList = await Promise.all(allUsers.map(async (u: any) => {
        const msgs = await api.getMessages(u.id, coach.id);
        const lastMsg = msgs[msgs.length - 1];
        const unreadCount = msgs.filter((m: any) => m.sender_type === 'user' && !m.read).length;
        
        return {
          id: u.id.toString(),
          name: u.name,
          avatar: u.name.split(' ').map((n: string) => n[0]).join(''),
          profilePicture: u.profile_picture || null,
          lastMessage: lastMsg?.message || '',
          unread: unreadCount,
          lastActive: lastMsg ? new Date(lastMsg.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : 'Online'
        };
      }));
      
      // Sort by last message time
      clientList.sort((a, b) => {
        if (!a.lastMessage) return 1;
        if (!b.lastMessage) return -1;
        return 0;
      });
      
      setClients(clientList);
    } catch (error) {
      console.error('Failed to load clients:', error);
      setNetworkError('Server connection lost. Please make sure backend is running on port 5001.');
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

  const stats = {
    totalClients: 24,
    activeToday: 18,
    notifications: 5,
    sessionsThisWeek: 42,
    planRequests: pendingProgramRequestsCount,
  };
  const isLightTheme = theme === 'light';

  useEffect(() => {
    localStorage.setItem('coach-dashboard-theme', theme);
  }, [theme]);

  const toggleTheme = () => {
    setTheme((prev) => (prev === 'dark' ? 'light' : 'dark'));
  };

  if (view === 'schedule') {
    return <CoachSchedule onBack={() => setView('dashboard')} />;
  }

  if (view === 'clients') {
    return <ClientsListScreen onBack={() => setView('dashboard')} />;
  }

  if (view === 'activity') {
    return <TodaysActivity onBack={() => setView('dashboard')} />;
  }

  if (view === 'notifications') {
    return <Notifications onBack={() => setView('dashboard')} />;
  }

  if (view === 'adduser') {
    return <AddUser onBack={() => setView('dashboard')} />;
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
              onClick={toggleTheme}
              className={`flex items-center gap-2 px-3 py-2 rounded-lg text-sm transition-colors border ${
                isLightTheme
                  ? 'bg-white text-[#111827] border-slate-300 hover:bg-slate-50'
                  : 'bg-[#242424] text-white border-gray-700 hover:bg-[#2A2A2A]'
              }`}
              title={`Switch to ${isLightTheme ? 'dark' : 'light'} mode`}
            >
              {isLightTheme ? <Moon size={16} /> : <Sun size={16} />}
            </button>
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
                className="bg-[#242424] rounded-lg p-4 border border-gray-800 cursor-pointer hover:border-[#BFFF00]/40 transition-colors"
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
                    <div className="text-xs text-gray-400">{request.userEmail}</div>
                  </div>
                  <span className={`text-[11px] px-2 py-1 rounded border uppercase ${
                    request.status === 'pending'
                      ? 'text-amber-300 border-amber-500/40 bg-amber-500/10'
                      : request.status === 'approved'
                        ? 'text-green-300 border-green-500/40 bg-green-500/10'
                        : request.status === 'rejected'
                          ? 'text-red-300 border-red-500/40 bg-red-500/10'
                          : 'text-gray-300 border-gray-600 bg-gray-500/10'
                  }`}
                  >
                    {request.status}
                  </span>
                </div>

                <div className="mt-3 space-y-1 text-sm">
                  <div><span className="text-gray-400">Plan:</span> {request.planName}</div>
                  <div><span className="text-gray-400">Duration:</span> {request.cycleWeeks} weeks</div>
                  <div><span className="text-gray-400">Days:</span> {request.selectedDays.join(', ') || '-'}</div>
                  <div><span className="text-gray-400">Exercises per week:</span> {exercisesCount}</div>
                  <div className="text-[#BFFF00] text-xs pt-1">Click to review full details</div>
                </div>

                {request.reviewNotes && (
                  <div className="mt-2 text-xs text-gray-400">
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
                      className="px-4 py-2 rounded-lg bg-[#BFFF00] text-black font-semibold hover:bg-[#a8e600] transition-colors disabled:opacity-50"
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
            className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm p-4 flex items-center justify-center"
            onClick={() => setSelectedProgramRequest(null)}
          >
            <div
              className="w-full max-w-3xl max-h-[90vh] overflow-y-auto rounded-2xl bg-[#202020] border border-gray-700 p-5"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="flex items-start justify-between gap-3">
                <div>
                  <h2 className="text-xl font-semibold">{selectedProgramRequest.planName}</h2>
                  <p className="text-sm text-gray-400">
                    {selectedProgramRequest.userName} • {selectedProgramRequest.userEmail}
                  </p>
                  <p className="text-xs text-gray-500 mt-1">
                    {selectedProgramRequest.cycleWeeks} weeks • {selectedProgramRequest.selectedDays.length} training days
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => setSelectedProgramRequest(null)}
                  className="w-9 h-9 rounded-lg bg-[#2A2A2A] hover:bg-[#333] flex items-center justify-center"
                  title="Close"
                >
                  <X size={18} />
                </button>
              </div>

              {selectedProgramRequest.description && (
                <div className="mt-4 text-sm text-gray-300 bg-[#1A1A1A] border border-gray-700 rounded-lg p-3">
                  {selectedProgramRequest.description}
                </div>
              )}

              <div className="mt-4 space-y-3">
                {selectedProgramRequest.weeklyWorkouts.map((workout, workoutIndex) => {
                  const exercises = Array.isArray(workout.exercises) ? workout.exercises : [];
                  return (
                    <div key={`detail-workout-${workoutIndex}`} className="bg-[#1A1A1A] border border-gray-700 rounded-lg p-3">
                      <div className="flex items-center justify-between gap-2">
                        <div className="font-semibold">
                          {formatDayLabel(workout.dayName, workoutIndex)}
                          {workout.workoutName ? ` • ${workout.workoutName}` : ''}
                        </div>
                        <span className="text-xs text-gray-400">{exercises.length} exercises</span>
                      </div>
                      <div className="mt-2 space-y-1.5">
                        {exercises.map((exercise, exerciseIndex) => (
                          <div
                            key={`detail-workout-${workoutIndex}-exercise-${exerciseIndex}`}
                            className="text-sm text-gray-300 flex items-center justify-between gap-3 bg-[#232323] rounded-md px-2.5 py-1.5"
                          >
                            <span className="text-white">{exercise.exerciseName || `Exercise ${exerciseIndex + 1}`}</span>
                            <span className="text-xs text-gray-400">
                              {Number(exercise.sets || 0)} sets • {String(exercise.reps || '-')} reps
                            </span>
                          </div>
                        ))}
                        {exercises.length === 0 && (
                          <div className="text-xs text-gray-500">No exercises in this day.</div>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>

              {selectedProgramRequest.reviewNotes && (
                <div className="mt-4 text-sm text-gray-300">
                  <span className="text-gray-400">Review note:</span> {selectedProgramRequest.reviewNotes}
                </div>
              )}

              {selectedProgramRequest.status === 'pending' && (
                <div className="mt-5 flex flex-wrap gap-2">
                  <button
                    type="button"
                    disabled={activeRequestActionId === selectedProgramRequest.id}
                    onClick={() => void handleApproveSelectedRequest()}
                    className="px-4 py-2 rounded-lg bg-[#BFFF00] text-black font-semibold hover:bg-[#a8e600] transition-colors disabled:opacity-50"
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
      </div>
    );
  }

  return (
    <>
      <div className={`min-h-screen ${isLightTheme ? 'bg-[#F5F7FB] text-[#111827]' : 'bg-[#1A1A1A] text-white'}`}>
      <div className={`border-b p-3 md:p-4 ${isLightTheme ? 'border-slate-200' : 'border-gray-800'}`}>
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3">
          <div>
            <h1 className="text-xl md:text-2xl font-bold">{coachName}</h1>
            <p className={`text-xs md:text-sm ${isLightTheme ? 'text-slate-600' : 'text-gray-400'}`}>Manage your clients</p>
          </div>
          <div className="flex items-center gap-3">
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              className="hidden"
              onChange={handleProfileImageChange}
            />
            <button
              type="button"
              onClick={handleProfileImagePick}
              disabled={uploadingPicture}
              className={`relative w-12 h-12 md:w-14 md:h-14 rounded-full overflow-hidden border transition-colors disabled:opacity-60 ${
                isLightTheme
                  ? 'border-slate-300 bg-white hover:border-[#BFFF00]'
                  : 'border-gray-700 bg-[#242424] hover:border-[#BFFF00]'
              }`}
              title="Change profile image"
            >
              {coachProfilePicture ? (
                <img src={coachProfilePicture} alt="Coach profile" className="w-full h-full object-cover" />
              ) : (
                <span className="w-full h-full flex items-center justify-center text-sm font-bold text-[#BFFF00]">
                  {coachName
                    .split(' ')
                    .filter(Boolean)
                    .map((n) => n[0])
                    .join('')
                    .slice(0, 2)
                    .toUpperCase()}
                </span>
              )}
              <span className="absolute -bottom-0.5 -right-0.5 bg-[#BFFF00] text-black rounded-full p-1">
                <Camera size={12} />
              </span>
            </button>
            <button
              type="button"
              onClick={toggleTheme}
              className={`flex items-center gap-2 px-3 md:px-4 py-2 rounded-lg text-sm transition-colors border ${
                isLightTheme
                  ? 'bg-white text-[#111827] border-slate-300 hover:bg-slate-50'
                  : 'bg-[#242424] text-white border-gray-700 hover:bg-[#2A2A2A]'
              }`}
              title={`Switch to ${isLightTheme ? 'dark' : 'light'} mode`}
            >
              {isLightTheme ? <Moon size={16} /> : <Sun size={16} />}
              <span className="hidden sm:inline">{isLightTheme ? 'Dark' : 'Light'}</span>
            </button>
            <button
              onClick={() => setView('adduser')}
              className="flex items-center gap-2 bg-[#BFFF00] text-black px-3 md:px-4 py-2 rounded-lg text-sm font-semibold hover:bg-[#a8e600] transition-colors"
            >
              <UserPlus size={18} />
              <span className="hidden sm:inline">Add User</span>
            </button>
            <button
              onClick={() => {
                if (onLogout) {
                  onLogout();
                  return;
                }
                localStorage.removeItem('adminUser');
                localStorage.removeItem('adminUserId');
                localStorage.removeItem('coach');
                localStorage.removeItem('coachId');
                window.location.href = '/admin.html';
              }}
              className="flex items-center gap-2 bg-red-500 hover:bg-red-600 px-3 md:px-4 py-2 rounded-lg text-sm transition-colors"
            >
              <LogOut size={18} />
              <span className="hidden sm:inline">Logout</span>
            </button>
          </div>
        </div>
        {pictureError && (
          <p className="text-xs text-red-500 mt-2">{pictureError}</p>
        )}
        {networkError && (
          <p className="text-xs text-amber-400 mt-2">{networkError}</p>
        )}
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-5 gap-3 md:gap-4 p-3 md:p-4">
        <div className={`rounded-lg p-3 md:p-4 cursor-pointer transition-colors ${isLightTheme ? 'bg-white border border-slate-200 hover:bg-slate-50' : 'bg-[#242424] hover:bg-[#2A2A2A]'}`} onClick={() => setView('clients')}>
          <Users size={18} className="text-[#BFFF00] mb-2" />
          <div className="text-xl md:text-2xl font-bold">{stats.totalClients}</div>
          <div className={`text-xs ${isLightTheme ? 'text-slate-500' : 'text-gray-400'}`}>Total Clients</div>
        </div>
        <div className={`rounded-lg p-3 md:p-4 cursor-pointer transition-colors ${isLightTheme ? 'bg-white border border-slate-200 hover:bg-slate-50' : 'bg-[#242424] hover:bg-[#2A2A2A]'}`} onClick={() => setView('activity')}>
          <TrendingUp size={18} className="text-green-500 mb-2" />
          <div className="text-xl md:text-2xl font-bold">{stats.activeToday}</div>
          <div className={`text-xs ${isLightTheme ? 'text-slate-500' : 'text-gray-400'}`}>Active Today</div>
        </div>
        <div className={`rounded-lg p-3 md:p-4 cursor-pointer transition-colors ${isLightTheme ? 'bg-white border border-slate-200 hover:bg-slate-50' : 'bg-[#242424] hover:bg-[#2A2A2A]'}`} onClick={() => setView('notifications')}>
          <Bell size={18} className="text-blue-500 mb-2" />
          <div className="text-xl md:text-2xl font-bold">{stats.notifications}</div>
          <div className={`text-xs ${isLightTheme ? 'text-slate-500' : 'text-gray-400'}`}>Notifications</div>
        </div>
        <div className={`rounded-lg p-3 md:p-4 cursor-pointer transition-colors ${isLightTheme ? 'bg-white border border-slate-200 hover:bg-slate-50' : 'bg-[#242424] hover:bg-[#2A2A2A]'}`} onClick={() => setView('schedule')}>
          <Calendar size={18} className="text-purple-500 mb-2" />
          <div className="text-xl md:text-2xl font-bold">{stats.sessionsThisWeek}</div>
          <div className={`text-xs ${isLightTheme ? 'text-slate-500' : 'text-gray-400'}`}>Sessions This Week</div>
        </div>
        <div className={`rounded-lg p-3 md:p-4 cursor-pointer transition-colors ${isLightTheme ? 'bg-white border border-slate-200 hover:bg-slate-50' : 'bg-[#242424] hover:bg-[#2A2A2A]'}`} onClick={() => setView('planrequests')}>
          <UserPlus size={18} className="text-[#BFFF00] mb-2" />
          <div className="text-xl md:text-2xl font-bold">{stats.planRequests}</div>
          <div className={`text-xs ${isLightTheme ? 'text-slate-500' : 'text-gray-400'}`}>Plan Requests</div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-3 md:gap-4 p-3 md:p-4 h-auto lg:h-[calc(100vh-250px)]">
        <div className={`rounded-lg p-3 md:p-4 overflow-y-auto max-h-96 lg:max-h-none ${isLightTheme ? 'bg-white border border-slate-200' : 'bg-[#242424]'}`}>
          <h2 className="font-semibold mb-3 md:mb-4 text-sm md:text-base">Clients</h2>
          <div className="space-y-2">
            {clients.map(client => (
              <button
                key={client.id}
                onClick={() => handleClientSelect(client)}
                className={`w-full p-2 md:p-3 rounded-lg text-left transition-colors ${
                  selectedClient?.id === client.id
                    ? 'bg-[#BFFF00]/10 border border-[#BFFF00]'
                    : isLightTheme
                      ? 'bg-slate-50 border border-slate-200 hover:bg-slate-100'
                      : 'bg-[#1A1A1A] hover:bg-[#2A2A2A]'
                }`}
              >
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 md:w-10 md:h-10 rounded-full bg-[#BFFF00]/20 flex items-center justify-center">
                    {client.profilePicture ? (
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          openImagePreview(client.profilePicture || '', `${client.name} profile`);
                        }}
                        className="w-full h-full rounded-full overflow-hidden"
                      >
                        <img
                          src={client.profilePicture}
                          alt={`${client.name} profile`}
                          className="w-full h-full rounded-full object-cover"
                        />
                      </button>
                    ) : (
                      <span className="font-bold text-xs md:text-sm">{client.avatar}</span>
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between">
                      <span className="font-semibold text-sm">{client.name}</span>
                      {client.unread > 0 && (
                        <span className="bg-red-500 text-xs px-2 py-0.5 rounded-full">{client.unread}</span>
                      )}
                    </div>
                    <p className={`text-xs truncate ${isLightTheme ? 'text-slate-500' : 'text-gray-400'}`}>{client.lastMessage}</p>
                    <p className={`text-xs ${isLightTheme ? 'text-slate-400' : 'text-gray-500'}`}>{client.lastActive}</p>
                  </div>
                </div>
              </button>
            ))}
          </div>
        </div>

        <div className={`lg:col-span-2 rounded-lg flex flex-col h-auto lg:h-[calc(100vh-250px)] ${isLightTheme ? 'bg-white border border-slate-200' : 'bg-[#242424]'}`}>
          {selectedClient ? (
            <>
              <div className={`p-4 border-b ${isLightTheme ? 'border-slate-200' : 'border-gray-800'}`}>
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-full bg-[#BFFF00]/20 flex items-center justify-center">
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
                          className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold text-text-secondary shrink-0 overflow-hidden ${
                            isLightTheme ? 'bg-white border border-slate-200' : 'bg-card border border-white/10'
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
                        {!isCoach && <div className="text-[11px] text-text-tertiary mb-1 ml-1">{senderName}</div>}
                        <div
                          className={`relative min-w-[56px] max-w-[75vw] md:max-w-[70%] px-4 py-2.5 rounded-[20px] shadow-[0_2px_10px_rgba(0,0,0,0.14)] break-words [overflow-wrap:anywhere] ${
                            isCoach
                              ? 'bg-accent text-black rounded-br-[8px]'
                              : isLightTheme
                                ? 'bg-white text-slate-800 border border-slate-200 rounded-bl-[8px] shadow-[0_2px_8px_rgba(15,23,42,0.06)]'
                                : 'bg-card text-text-primary border border-white/10 rounded-bl-[8px]'
                          }`}
                        >
                          <p className="text-sm leading-relaxed whitespace-pre-wrap">{msg.message}</p>
                          <p className={`text-[11px] mt-1 ${isCoach ? 'text-black/60' : 'text-text-tertiary'}`}>
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
                      className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold text-text-secondary shrink-0 overflow-hidden ${
                        isLightTheme ? 'bg-white border border-slate-200' : 'bg-card border border-white/10'
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
                    className={`flex-1 rounded-2xl px-4 py-3 text-sm text-text-primary border focus:outline-none focus:ring-2 focus:ring-accent/40 resize-none min-h-[48px] max-h-32 ${
                      isLightTheme
                        ? 'bg-white border-slate-200 placeholder-slate-400'
                        : 'bg-background border-white/10 placeholder-text-tertiary'
                    }`}
                  />
                  <button
                    onClick={handleSendMessage}
                    className="bg-accent text-black p-3 rounded-2xl hover:bg-accent/90 transition-colors shadow-[0_4px_14px_rgba(191,255,0,0.22)]">
                    <Send size={20} />
                  </button>
                </div>
              </div>
            </>
          ) : (
            <div className={`flex-1 flex items-center justify-center ${isLightTheme ? 'text-slate-500' : 'text-gray-400'}`}>
              Select a client to start messaging
            </div>
          )}
        </div>
      </div>
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
