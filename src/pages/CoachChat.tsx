import React from 'react';
import { Header } from '../components/ui/Header';
import { Input } from '../components/ui/Input';
import { Send } from 'lucide-react';
interface CoachChatProps {
  onBack: () => void;
}
export function CoachChat({ onBack }: CoachChatProps) {
  const messages = [
  {
    id: 1,
    text: "Hey Alex! How's the new split feeling?",
    sender: 'coach',
    time: '10:30 AM'
  },
  {
    id: 2,
    text: 'Loving it so far. The volume on leg day is intense though!',
    sender: 'user',
    time: '10:32 AM'
  },
  {
    id: 3,
    text: "That's the goal! Make sure you're hitting your protein targets for recovery.",
    sender: 'coach',
    time: '10:33 AM'
  }];

  return (
    <div className="flex-1 flex flex-col bg-background min-h-screen">
      <div className="px-4 sm:px-6 pt-2 border-b border-white/5">
        <Header title="Coach Mike" onBack={onBack} />
      </div>

      <div className="flex-1 overflow-y-auto p-6 space-y-4">
        {messages.map((msg) =>
        <div
          key={msg.id}
          className={`flex ${msg.sender === 'user' ? 'justify-end' : 'justify-start'}`}>

            <div
            className={`
                max-w-[80%] p-3 rounded-2xl text-sm
                ${msg.sender === 'user' ? 'bg-white/10 text-white rounded-tr-none' : 'bg-accent/10 text-white border border-accent/20 rounded-tl-none'}
              `}>

              <p>{msg.text}</p>
              <span className="text-[10px] opacity-50 mt-1 block text-right">
                {msg.time}
              </span>
            </div>
          </div>
        )}
      </div>

      <div className="p-4 border-t border-white/5 bg-card pb-8">
        <div className="relative">
          <Input placeholder="Type a message..." className="pr-12" />
          <button className="absolute right-2 top-1/2 -translate-y-1/2 p-2 text-accent hover:text-white transition-colors">
            <Send size={20} />
          </button>
        </div>
      </div>
    </div>);

}
