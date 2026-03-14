import React, { useState, useEffect, useRef } from 'react';
import { ArrowLeft, Send, Paperclip, Image as ImageIcon } from 'lucide-react';
import { aiCoach } from '../../services/aiCoach';

interface Message {
  id: string;
  senderId: string;
  text: string;
  timestamp: Date;
  isMe: boolean;
}

interface CoachChatScreenProps {
  coach: any;
  onBack: () => void;
}

export const CoachChatScreen: React.FC<CoachChatScreenProps> = ({ coach, onBack }) => {
  const [messages, setMessages] = useState<Message[]>([]);
  const [inputText, setInputText] = useState('');
  const [isSending, setIsSending] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    // TODO: Replace with API call
    const mockMessages: Message[] = [
      {
        id: '1',
        senderId: coach.id,
        text: 'Hey! How can I help you with your training today?',
        timestamp: new Date(Date.now() - 3600000),
        isMe: false
      },
      {
        id: '2',
        senderId: 'me',
        text: 'I need help with my squat form',
        timestamp: new Date(Date.now() - 3000000),
        isMe: true
      },
      {
        id: '3',
        senderId: coach.id,
        text: 'Sure! Can you send me a video of your squat? I\'ll analyze it and give you feedback.',
        timestamp: new Date(Date.now() - 2400000),
        isMe: false
      }
    ];
    setMessages(mockMessages);
  }, [coach.id]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const handleSend = async () => {
    if (!inputText.trim() || isSending) return;

    const userMessage: Message = {
      id: Date.now().toString(),
      senderId: 'me',
      text: inputText,
      timestamp: new Date(),
      isMe: true
    };

    setMessages(prev => [...prev, userMessage]);
    setInputText('');
    setIsSending(true);

    try {
      // Build conversation history for AI
      const conversationHistory = messages.map(m => ({
        role: m.isMe ? 'user' : 'assistant',
        content: m.text
      }));
      conversationHistory.push({ role: 'user', content: inputText });

      // Get AI response
      const aiResponse = await aiCoach.chatWithCoach(conversationHistory);

      const coachMessage: Message = {
        id: (Date.now() + 1).toString(),
        senderId: coach.id,
        text: aiResponse,
        timestamp: new Date(),
        isMe: false
      };

      setMessages(prev => [...prev, coachMessage]);
    } catch (error) {
      console.error('AI chat failed:', error);
      const errorMessage: Message = {
        id: (Date.now() + 1).toString(),
        senderId: coach.id,
        text: 'Sorry, I\'m having trouble responding right now. Please try again.',
        timestamp: new Date(),
        isMe: false
      };
      setMessages(prev => [...prev, errorMessage]);
    } finally {
      setIsSending(false);
    }
  };

  const formatTime = (date: Date) => {
    return new Date(date).toLocaleTimeString('en-US', { 
      hour: 'numeric', 
      minute: '2-digit',
      hour12: true 
    });
  };

  return (
    <div className="min-h-screen bg-[#1A1A1A] text-white flex flex-col">
      <div className="p-4 bg-[#242424] border-b border-gray-800">
        <div className="flex items-center gap-3">
          <button onClick={onBack}>
            <ArrowLeft size={20} />
          </button>
          <div className="relative">
            <div className="w-10 h-10 rounded-full bg-[#10b981]/10 flex items-center justify-center">
              <span className="font-bold text-emerald-600">{coach.avatar}</span>
            </div>
            {coach.isOnline && (
              <div className="absolute -bottom-1 -right-1 w-3 h-3 bg-green-500 rounded-full border-2 border-[#242424]" />
            )}
          </div>
          <div className="flex-1">
            <div className="font-semibold">{coach.name}</div>
            <div className="text-xs text-gray-400">
              {coach.isOnline ? 'Online' : 'Offline'}
            </div>
          </div>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {messages.map((message) => (
          <div
            key={message.id}
            className={`flex ${message.isMe ? 'justify-end' : 'justify-start'}`}
          >
            <div className={`max-w-[75%] ${message.isMe ? 'order-2' : 'order-1'}`}>
              <div
                className={`rounded-2xl px-4 py-2 ${
                  message.isMe
                    ? 'bg-[#10b981] text-black'
                    : 'bg-[#242424] text-white'
                }`}
              >
                <p className="text-sm">{message.text}</p>
              </div>
              <div className={`text-xs text-gray-500 mt-1 ${message.isMe ? 'text-right' : 'text-left'}`}>
                {formatTime(message.timestamp)}
              </div>
            </div>
          </div>
        ))}
        <div ref={messagesEndRef} />
      </div>

      <div className="p-4 bg-[#242424] border-t border-gray-800">
        <div className="flex items-center gap-2">
          <button className="p-2 hover:bg-[#1A1A1A] rounded-lg transition-colors">
            <Paperclip size={20} className="text-gray-400" />
          </button>
          <button className="p-2 hover:bg-[#1A1A1A] rounded-lg transition-colors">
            <ImageIcon size={20} className="text-gray-400" />
          </button>
          <input
            type="text"
            value={inputText}
            onChange={(e) => setInputText(e.target.value)}
            onKeyPress={(e) => e.key === 'Enter' && handleSend()}
            placeholder="Type a message..."
            className="flex-1 bg-[#1A1A1A] rounded-lg px-4 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#10b981]"
          />
          <button
            onClick={handleSend}
            disabled={!inputText.trim() || isSending}
            className="p-2 bg-[#10b981] text-black rounded-lg hover:bg-[#10b981]/90 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isSending ? (
              <div className="w-5 h-5 border-2 border-black border-t-transparent rounded-full animate-spin" />
            ) : (
              <Send size={20} />
            )}
          </button>
        </div>
      </div>
    </div>
  );
};

