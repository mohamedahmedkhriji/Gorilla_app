import React, { useState, useEffect, useRef } from 'react';
import { Header } from '../components/ui/Header';
import { Send } from 'lucide-react';
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
  const [sessionError, setSessionError] = useState('');
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const user = JSON.parse(localStorage.getItem('appUser') || localStorage.getItem('user') || '{}');
  const userId = Number(user.id || 0);
  const isUserSession = user?.role === 'user';

  useEffect(() => {
    if (!coachId || !userId || !isUserSession) {
      if (!isUserSession) {
        setSessionError('Invalid user session. Please login from the User Login page.');
      }
      return;
    }
    socketService.connect(userId, 'user');
    loadMessages();
    
    const unsubscribe = socketService.onNewMessage((msg) => {
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
    });

    // Mark messages as read when opening chat
    markAsRead();

    return () => {
      unsubscribe?.();
    };
  }, [coachId, userId, isUserSession]);

  const markAsRead = async () => {
    if (!coachId || !userId) return;
    try {
      await api.markUserMessagesAsRead(userId, coachId);
    } catch (error) {
      console.error('Failed to mark user messages as read:', error);
    }
  };

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const loadMessages = async () => {
    if (!coachId || !userId) return;
    try {
      const data = await api.getMessages(userId, coachId);
      setMessages(data);
    } catch (error) {
      console.error('Failed to load messages:', error);
    }
  };

  const handleSend = async () => {
    if (!input.trim() || !coachId || !userId || !isUserSession) return;
    const messageText = input.trim();
    console.log('Sending to coach:', coachId);
    setInput('');

    // Optimistic UI: show user message immediately on the right side.
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

    // Ensure persisted history is reloaded even if realtime event is missed.
    window.setTimeout(async () => {
      try {
        await loadMessages();
      } catch (error) {
        console.error('Failed to refresh messages after send:', error);
      }
    }, 250);
  };

  // Get coach from props
  useEffect(() => {
    if (propCoachId && propCoachName) {
      setCoachId(propCoachId);
      setCoachName(propCoachName);
    }
  }, [propCoachId, propCoachName]);

  return (
    <div className="flex-1 flex flex-col bg-background h-screen pb-24">
      <div className="px-6 pt-2">
        <Header title={coachName || 'Coach Chat'} onBack={onBack} />
        {sessionError && <p className="text-xs text-red-500 mt-2">{sessionError}</p>}
      </div>

      <div className="flex-1 overflow-y-auto px-6 py-4 space-y-3 pb-20">
        {messages.map((msg, i) => {
          const isMe = Number(msg.sender_id) === userId && msg.sender_type === 'user';
          const senderName = msg.sender_name || (isMe ? 'You' : coachName);
          console.log('Message:', msg, 'User ID:', userId, 'isMe:', isMe);
          return (
            <div key={i} className={`flex ${isMe ? 'justify-end' : 'justify-start'}`}>
              <div>
                {!isMe && <div className="text-xs text-text-tertiary mb-1 ml-1">{senderName}</div>}
                <div className={`max-w-[70%] rounded-2xl px-4 py-3 ${
                  isMe ? 'bg-accent text-black' : 'bg-card text-white'
                }`}>
                  <div className="text-sm">{msg.message}</div>
                  <div className={`text-xs mt-1 ${isMe ? 'text-black/60' : 'text-text-tertiary'}`}>
                    {new Date(msg.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                  </div>
                </div>
              </div>
            </div>
          );
        })}
        <div ref={messagesEndRef} />
      </div>

      <div className="fixed bottom-20 left-0 right-0 px-6 py-4 bg-background border-t border-white/10">
        <div className="flex gap-3">
          <input
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyPress={(e) => e.key === 'Enter' && handleSend()}
            placeholder="Type a message..."
            className="flex-1 bg-card rounded-xl px-4 py-3 text-white placeholder-text-tertiary border border-white/10 focus:outline-none focus:border-accent/50"
          />
          <button
            onClick={handleSend}
            className="bg-accent text-black p-3 rounded-xl hover:bg-accent/90 transition-colors">
            <Send size={20} />
          </button>
        </div>
      </div>
    </div>
  );
}
