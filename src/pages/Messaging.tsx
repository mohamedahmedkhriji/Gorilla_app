import React, { useEffect, useRef, useState } from 'react';
import { Header } from '../components/ui/Header';
import { Send, User } from 'lucide-react';
import { api } from '../services/api';
import { socketService } from '../services/socket';

interface MessagingProps {
  onBack: () => void;
  coachId?: number;
  coachName?: string;
}

export function Messaging({ onBack, coachId: propCoachId, coachName: propCoachName }: MessagingProps) {
  const [messages, setMessages] = useState<any[]>([]);
  const [input, setInput] = useState('');
  const [coachId, setCoachId] = useState<number | null>(propCoachId || null);
  const [coachName, setCoachName] = useState(propCoachName || '');
  const [userProfilePicture, setUserProfilePicture] = useState<string | null>(null);
  const [coachProfilePicture, setCoachProfilePicture] = useState<string | null>(null);
  const [sessionError, setSessionError] = useState('');
  const [isCoachTyping, setIsCoachTyping] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const typingTimeoutRef = useRef<number | null>(null);
  const isLightTheme = typeof document !== 'undefined' && document.documentElement.getAttribute('data-theme') === 'light';

  const user = JSON.parse(localStorage.getItem('appUser') || localStorage.getItem('user') || '{}');
  const userId = Number(user.id || 0);
  const isUserSession = user?.role === 'user';
  const isValidImageDataUrl = (value: string | null | undefined) =>
    typeof value === 'string' && value.startsWith('data:image/') && value.includes(';base64,');

  useEffect(() => {
    if (!coachId || !userId || !isUserSession) {
      if (!isUserSession) {
        setSessionError('Invalid user session. Please login from the User Login page.');
      }
      return;
    }

    socketService.connect(userId, 'user');
    loadMessages();
    markAsRead();

    const unsubscribeMessage = socketService.onNewMessage((msg) => {
      const senderId = Number(msg.sender_id);
      const receiverId = Number(msg.receiver_id);
      const senderType = msg.sender_type;
      const receiverType = msg.receiver_type;

      const isCurrentConversation =
        (senderType === 'user' && receiverType === 'coach' && senderId === userId && receiverId === coachId) ||
        (senderType === 'coach' && receiverType === 'user' && senderId === coachId && receiverId === userId);

      if (!isCurrentConversation) return;

      setMessages((prev) => {
        if (prev.some((m) => Number(m.id) === Number(msg.id))) {
          return prev;
        }
        return [...prev, msg];
      });
      if (senderType === 'coach') {
        setIsCoachTyping(false);
      }
    });

    const unsubscribeTyping = socketService.onTyping((payload) => {
      const isCurrentConversation =
        Number(payload.sender_id) === coachId &&
        payload.sender_type === 'coach' &&
        Number(payload.receiver_id) === userId &&
        payload.receiver_type === 'user';

      if (!isCurrentConversation) return;
      setIsCoachTyping(Boolean(payload.is_typing));
    });

    return () => {
      unsubscribeMessage?.();
      unsubscribeTyping?.();
      if (typingTimeoutRef.current) {
        window.clearTimeout(typingTimeoutRef.current);
        typingTimeoutRef.current = null;
      }
      socketService.sendTyping(userId, 'user', coachId, 'coach', false);
    };
  }, [coachId, userId, isUserSession]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, isCoachTyping]);

  const markAsRead = async () => {
    if (!coachId || !userId) return;
    try {
      await api.markUserMessagesAsRead(userId, coachId);
    } catch (error) {
      console.error('Failed to mark user messages as read:', error);
    }
  };

  const loadMessages = async () => {
    if (!coachId || !userId) return;
    try {
      const data = await api.getMessages(userId, coachId);
      setMessages(data);
    } catch (error) {
      console.error('Failed to load messages:', error);
    }
  };

  const emitTyping = (value: string) => {
    if (!coachId || !userId || !isUserSession) return;
    const hasText = value.trim().length > 0;
    socketService.sendTyping(userId, 'user', coachId, 'coach', hasText);

    if (typingTimeoutRef.current) {
      window.clearTimeout(typingTimeoutRef.current);
      typingTimeoutRef.current = null;
    }

    if (hasText) {
      typingTimeoutRef.current = window.setTimeout(() => {
        socketService.sendTyping(userId, 'user', coachId, 'coach', false);
      }, 1200);
    }
  };

  const handleSend = async () => {
    if (!input.trim() || !coachId || !userId || !isUserSession) return;
    const messageText = input.trim();
    setInput('');
    socketService.sendTyping(userId, 'user', coachId, 'coach', false);

    const optimisticMessage = {
      id: `tmp-${Date.now()}`,
      sender_id: userId,
      receiver_id: coachId,
      sender_type: 'user',
      receiver_type: 'coach',
      sender_name: 'You',
      message: messageText,
      created_at: new Date().toISOString(),
      read: false,
    };
    setMessages((prev) => [...prev, optimisticMessage]);

    socketService.sendMessage(userId, 'user', coachId, 'coach', messageText);

    window.setTimeout(async () => {
      try {
        await loadMessages();
      } catch (error) {
        console.error('Failed to refresh messages after send:', error);
      }
    }, 250);
  };

  useEffect(() => {
    if (propCoachId && propCoachName) {
      setCoachId(propCoachId);
      setCoachName(propCoachName);
    }
  }, [propCoachId, propCoachName]);

  useEffect(() => {
    const loadProfilePictures = async () => {
      if (userId > 0) {
        try {
          const userPicture = await api.getProfilePicture(userId);
          setUserProfilePicture(isValidImageDataUrl(userPicture?.profilePicture) ? userPicture.profilePicture : null);
        } catch {
          setUserProfilePicture(null);
        }
      }

      if (coachId && coachId > 0) {
        try {
          const coachPicture = await api.getProfilePicture(coachId);
          setCoachProfilePicture(isValidImageDataUrl(coachPicture?.profilePicture) ? coachPicture.profilePicture : null);
        } catch {
          setCoachProfilePicture(null);
        }
      }
    };

    loadProfilePictures();
  }, [userId, coachId]);

  return (
    <div className="flex-1 flex flex-col bg-background h-screen pb-24">
      <div className="px-6 pt-2">
        <Header title={coachName || 'Coach Chat'} onBack={onBack} />
        {sessionError && <p className="text-xs text-red-500 mt-2">{sessionError}</p>}
      </div>

      <div className="flex-1 overflow-y-auto px-5 py-4 space-y-3 pb-24">
        {messages.map((msg, i) => {
          const isMe = Number(msg.sender_id) === userId && msg.sender_type === 'user';
          const senderName = msg.sender_name || (isMe ? 'You' : coachName || 'Coach');
          const time = new Date(msg.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

          return (
            <div
              key={msg.id || i}
              className={`flex items-end gap-2 chat-message-in ${isMe ? 'justify-end' : 'justify-start'}`}
            >
              {!isMe && (
                <div className="w-8 h-8 rounded-full bg-card border border-white/10 flex items-center justify-center shrink-0">
                  {coachProfilePicture ? (
                    <img src={coachProfilePicture} alt={`${coachName || 'Coach'} profile`} className="w-full h-full object-cover rounded-full" />
                  ) : (
                    <User size={14} className="text-text-secondary" />
                  )}
                </div>
              )}

              <div className={`flex flex-col ${isMe ? 'items-end' : 'items-start'}`}>
                {!isMe && <div className="text-[11px] text-text-tertiary mb-1 ml-1">{senderName}</div>}
                <div
                  className={`relative min-w-[56px] max-w-[75vw] md:max-w-[70%] px-4 py-2.5 rounded-[20px] shadow-[0_2px_10px_rgba(0,0,0,0.14)] break-words [overflow-wrap:anywhere] ${
                    isMe
                      ? 'bg-accent text-black rounded-br-[8px]'
                      : isLightTheme
                        ? 'bg-white text-slate-800 border border-slate-200 rounded-bl-[8px] shadow-[0_2px_8px_rgba(15,23,42,0.06)]'
                        : 'bg-card text-text-primary border border-white/10 rounded-bl-[8px]'
                  }`}
                >
                  <div className="text-sm leading-relaxed whitespace-pre-wrap">{msg.message}</div>
                  <div className={`text-[11px] mt-1 ${isMe ? 'text-black/60' : 'text-text-tertiary'}`}>{time}</div>
                  <span
                    className={`absolute bottom-2 w-2.5 h-2.5 rotate-45 ${
                      isMe
                        ? 'right-[-4px] bg-accent'
                        : isLightTheme
                          ? 'left-[-4px] bg-white border-l border-b border-slate-200'
                          : 'left-[-4px] bg-card border-l border-b border-white/10'
                    }`}
                  />
                </div>
              </div>

              {isMe && (
                <div className="w-8 h-8 rounded-full bg-accent/15 border border-accent/40 flex items-center justify-center shrink-0">
                  {userProfilePicture ? (
                    <img src={userProfilePicture} alt="Your profile" className="w-full h-full object-cover rounded-full" />
                  ) : (
                    <User size={14} className="text-accent" />
                  )}
                </div>
              )}
            </div>
          );
        })}

        {isCoachTyping && (
          <div className="flex items-end gap-2 justify-start chat-message-in">
            <div className="w-8 h-8 rounded-full bg-card border border-white/10 flex items-center justify-center shrink-0">
              {coachProfilePicture ? (
                <img src={coachProfilePicture} alt={`${coachName || 'Coach'} profile`} className="w-full h-full object-cover rounded-full" />
              ) : (
                <User size={14} className="text-text-secondary" />
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

      <div className="fixed bottom-20 left-0 right-0 px-4 sm:px-6 py-4 bg-background border-t border-white/10">
        <div className="flex gap-3 items-end">
          <textarea
            value={input}
            onChange={(e) => {
              setInput(e.target.value);
              emitTyping(e.target.value);
            }}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                handleSend();
              }
            }}
            placeholder="Type a message..."
            rows={1}
            className={`flex-1 rounded-2xl px-4 py-3 text-text-primary border focus:outline-none focus:border-accent/50 resize-none min-h-[48px] max-h-32 ${
              isLightTheme
                ? 'bg-white border-slate-200 placeholder-slate-400'
                : 'bg-card border-white/10 placeholder-text-tertiary'
            }`}
          />
          <button
            onClick={handleSend}
            className="bg-accent text-black p-3 rounded-2xl hover:bg-accent/90 transition-colors shadow-[0_4px_14px_rgba(191,255,0,0.22)]"
          >
            <Send size={20} />
          </button>
        </div>
      </div>
    </div>
  );
}
