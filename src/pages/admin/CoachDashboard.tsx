import React, { useState, useEffect, useRef } from 'react';
import { Users, Calendar, TrendingUp, Bell, LogOut, UserPlus, Send, Camera, X } from 'lucide-react';
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

export const CoachDashboard: React.FC = () => {
  const [view, setView] = useState<'dashboard' | 'schedule' | 'clients' | 'activity' | 'notifications' | 'adduser'>('dashboard');
  const [clients, setClients] = useState<Client[]>([]);
  const [selectedClient, setSelectedClient] = useState<Client | null>(null);
  const [messages, setMessages] = useState<any[]>([]);
  const [inputText, setInputText] = useState('');
  const [coachName, setCoachName] = useState('Coach');
  const [coachId, setCoachId] = useState<number | null>(null);
  const [coachProfilePicture, setCoachProfilePicture] = useState<string | null>(null);
  const [uploadingPicture, setUploadingPicture] = useState(false);
  const [pictureError, setPictureError] = useState('');
  const [networkError, setNetworkError] = useState('');
  const [previewImage, setPreviewImage] = useState<string | null>(null);
  const [previewAlt, setPreviewAlt] = useState('Profile image');
  const fileInputRef = useRef<HTMLInputElement>(null);
  const selectedClientRef = useRef<Client | null>(null);

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
    }
    
    loadClients();

    return () => {
      unsubscribe?.();
      socketService.disconnect();
    };
  }, []);

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

  const handleSendMessage = async () => {
    if (!inputText.trim() || !selectedClient) return;
    try {
      const coach = JSON.parse(localStorage.getItem('coach') || '{}');
      const selectedUserId = parseInt(selectedClient.id);
      const messageText = inputText.trim();
      socketService.sendMessage(coach.id, 'coach', selectedUserId, 'user', messageText);
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

  const handleClientSelect = async (client: Client) => {
    try {
      setSelectedClient(client);
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
    sessionsThisWeek: 42
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

  return (
    <>
      <div className="min-h-screen bg-[#1A1A1A] text-white">
      <div className="border-b border-gray-800 p-3 md:p-4">
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3">
          <div>
            <h1 className="text-xl md:text-2xl font-bold">{coachName}</h1>
            <p className="text-gray-400 text-xs md:text-sm">Manage your clients</p>
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
              className="relative w-12 h-12 md:w-14 md:h-14 rounded-full overflow-hidden border border-gray-700 bg-[#242424] hover:border-[#BFFF00] transition-colors disabled:opacity-60"
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
              onClick={() => setView('adduser')}
              className="flex items-center gap-2 bg-[#BFFF00] text-black px-3 md:px-4 py-2 rounded-lg text-sm font-semibold hover:bg-[#a8e600] transition-colors"
            >
              <UserPlus size={18} />
              <span className="hidden sm:inline">Add User</span>
            </button>
            <button
              onClick={() => window.location.href = '/admin.html'}
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

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 md:gap-4 p-3 md:p-4">
        <div className="bg-[#242424] rounded-lg p-3 md:p-4 cursor-pointer hover:bg-[#2A2A2A] transition-colors" onClick={() => setView('clients')}>
          <Users size={18} className="text-[#BFFF00] mb-2" />
          <div className="text-xl md:text-2xl font-bold">{stats.totalClients}</div>
          <div className="text-xs text-gray-400">Total Clients</div>
        </div>
        <div className="bg-[#242424] rounded-lg p-3 md:p-4 cursor-pointer hover:bg-[#2A2A2A] transition-colors" onClick={() => setView('activity')}>
          <TrendingUp size={18} className="text-green-500 mb-2" />
          <div className="text-xl md:text-2xl font-bold">{stats.activeToday}</div>
          <div className="text-xs text-gray-400">Active Today</div>
        </div>
        <div className="bg-[#242424] rounded-lg p-3 md:p-4 cursor-pointer hover:bg-[#2A2A2A] transition-colors" onClick={() => setView('notifications')}>
          <Bell size={18} className="text-blue-500 mb-2" />
          <div className="text-xl md:text-2xl font-bold">{stats.notifications}</div>
          <div className="text-xs text-gray-400">Notifications</div>
        </div>
        <div className="bg-[#242424] rounded-lg p-3 md:p-4 cursor-pointer hover:bg-[#2A2A2A] transition-colors" onClick={() => setView('schedule')}>
          <Calendar size={18} className="text-purple-500 mb-2" />
          <div className="text-xl md:text-2xl font-bold">{stats.sessionsThisWeek}</div>
          <div className="text-xs text-gray-400">Sessions This Week</div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-3 md:gap-4 p-3 md:p-4 h-auto lg:h-[calc(100vh-250px)]">
        <div className="bg-[#242424] rounded-lg p-3 md:p-4 overflow-y-auto max-h-96 lg:max-h-none">
          <h2 className="font-semibold mb-3 md:mb-4 text-sm md:text-base">Clients</h2>
          <div className="space-y-2">
            {clients.map(client => (
              <button
                key={client.id}
                onClick={() => handleClientSelect(client)}
                className={`w-full p-2 md:p-3 rounded-lg text-left transition-colors ${
                  selectedClient?.id === client.id ? 'bg-[#BFFF00]/10 border border-[#BFFF00]' : 'bg-[#1A1A1A] hover:bg-[#2A2A2A]'
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
                    <p className="text-xs text-gray-400 truncate">{client.lastMessage}</p>
                    <p className="text-xs text-gray-500">{client.lastActive}</p>
                  </div>
                </div>
              </button>
            ))}
          </div>
        </div>

        <div className="lg:col-span-2 bg-[#242424] rounded-lg flex flex-col h-auto lg:h-[calc(100vh-250px)]">
          {selectedClient ? (
            <>
              <div className="p-4 border-b border-gray-800">
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
                    <div className="text-xs text-gray-400">Active {selectedClient.lastActive}</div>
                  </div>
                </div>
              </div>

              <div className="flex-1 p-4 overflow-y-auto">
                {messages.map((msg, i) => {
                  const coach = JSON.parse(localStorage.getItem('coach') || '{}');
                  const isCoach = Number(msg.sender_id) === Number(coach.id) && msg.sender_type === 'coach';
                  const senderName = msg.sender_name || (isCoach ? 'You' : selectedClient?.name);
                  console.log('Message:', msg, 'Coach ID:', coach.id, 'isCoach:', isCoach);
                  return (
                    <div key={i} className={`mb-4 flex ${isCoach ? 'justify-end' : 'justify-start'}`}>
                      <div>
                        {!isCoach && <div className="text-xs text-gray-400 mb-1 ml-1">{senderName}</div>}
                        <div className={`max-w-[70%] rounded-lg p-3 ${
                          isCoach ? 'bg-[#BFFF00] text-black' : 'bg-[#1A1A1A]'
                        }`}>
                          <p className="text-sm">{msg.message}</p>
                          <p className="text-xs opacity-70 mt-1">
                            {new Date(msg.created_at).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })}
                          </p>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>

              <div className="p-4 border-t border-gray-800 sticky bottom-0 bg-[#242424]">
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={inputText}
                    onChange={(e) => setInputText(e.target.value)}
                    onKeyPress={(e) => e.key === 'Enter' && handleSendMessage()}
                    placeholder="Type a message..."
                    className="flex-1 bg-[#1A1A1A] rounded-lg px-4 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#BFFF00]"
                  />
                  <button
                    onClick={handleSendMessage}
                    className="bg-[#BFFF00] text-black p-3 rounded-lg hover:bg-[#a8e600] transition-colors">
                    <Send size={20} />
                  </button>
                </div>
              </div>
            </>
          ) : (
            <div className="flex-1 flex items-center justify-center text-gray-400">
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
