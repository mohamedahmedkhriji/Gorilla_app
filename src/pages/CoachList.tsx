import React, { useState, useEffect } from 'react';
import { Header } from '../components/ui/Header';
import { MessageSquare } from 'lucide-react';
import { api } from '../services/api';

interface CoachListProps {
  onBack: () => void;
  onSelectCoach: (coachId: number, coachName: string) => void;
}

export function CoachList({ onBack, onSelectCoach }: CoachListProps) {
  const [coaches, setCoaches] = useState<any[]>([]);
  const [unreadCounts, setUnreadCounts] = useState<{[key: number]: number}>({});

  useEffect(() => {
    loadCoaches();
  }, []);

  const loadCoaches = async () => {
    const data = await api.getAllCoaches();
    console.log('Coaches loaded:', data);
    setCoaches(data);
    
    // Load unread counts for each coach
    const user = JSON.parse(localStorage.getItem('appUser') || localStorage.getItem('user') || '{}');
    const counts: {[key: number]: number} = {};
    for (const coach of data) {
      const msgs = await api.getMessages(user.id, coach.id);
      const unread = msgs.filter((m: any) => m.sender_type === 'coach' && !m.read).length;
      counts[coach.id] = unread;
    }
    setUnreadCounts(counts);
  };

  const getCoachInitials = (name: string) =>
    String(name || '')
      .split(' ')
      .filter(Boolean)
      .map((n: string) => n[0])
      .join('')
      .slice(0, 2)
      .toUpperCase();

  return (
    <div className="flex-1 flex flex-col bg-background min-h-screen pb-24">
      <div className="px-4 sm:px-6 pt-2">
        <Header title="Select Coach" onBack={onBack} />
      </div>

      <div className="px-4 sm:px-6 py-4 space-y-3">
        {coaches.map((coach) => (
          <div
            key={coach.id}
            onClick={() => onSelectCoach(coach.id, coach.name)}
            className="bg-card rounded-xl p-4 border border-white/10 hover:border-accent/50 transition-colors cursor-pointer">
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 rounded-full bg-accent/20 flex items-center justify-center">
                {coach.profile_picture ? (
                  <img
                    src={coach.profile_picture}
                    alt={`${coach.name} profile`}
                    className="w-full h-full rounded-full object-cover"
                  />
                ) : (
                  <span className="text-lg font-bold text-accent">
                    {getCoachInitials(coach.name)}
                  </span>
                )}
              </div>
              <div className="flex-1">
                <div className="font-bold text-white">{coach.name}</div>
                <div className="text-sm text-text-secondary">{coach.specialization || 'Fitness Coach'}</div>
              </div>
              <div className="flex items-center gap-2">
                <div className="w-2 h-2 bg-green-500 rounded-full" />
                <span className="text-xs text-text-tertiary">Online</span>
              </div>
              <div className="relative">
                <MessageSquare size={20} className="text-accent" />
                {unreadCounts[coach.id] > 0 && (
                  <span className="absolute -top-2 -right-2 bg-red-500 text-white text-xs w-5 h-5 rounded-full flex items-center justify-center font-bold">
                    {unreadCounts[coach.id]}
                  </span>
                )}
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

