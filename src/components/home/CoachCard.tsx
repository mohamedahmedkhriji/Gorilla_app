import React, { useState, useEffect } from 'react';
import { Card } from '../ui/Card';
import { MessageSquare, ChevronRight } from 'lucide-react';
import { api } from '../../services/api';

interface CoachCardProps {
  onClick: () => void;
}

export function CoachCard({ onClick }: CoachCardProps) {
  const [unreadCount, setUnreadCount] = useState(0);
  const [coachName, setCoachName] = useState('Coach Mike');
  const [coachProfilePicture, setCoachProfilePicture] = useState<string | null>(null);

  useEffect(() => {
    loadUnreadCount();
    loadCoachProfile();
  }, []);

  const loadUnreadCount = async () => {
    const user = JSON.parse(localStorage.getItem('appUser') || localStorage.getItem('user') || '{}');
    if (user.id && user.coach_id) {
      const msgs = await api.getMessages(user.id, user.coach_id);
      const unread = msgs.filter((m: any) => m.sender_type === 'coach' && !m.read).length;
      setUnreadCount(unread);
    }
  };

  const loadCoachProfile = async () => {
    const user = JSON.parse(localStorage.getItem('appUser') || localStorage.getItem('user') || '{}');
    if (!user.coach_id) return;

    const coaches = await api.getAllCoaches();
    const assignedCoach = coaches.find((c: any) => Number(c.id) === Number(user.coach_id));
    if (!assignedCoach) return;

    setCoachName(assignedCoach.name || 'Coach');
    setCoachProfilePicture(assignedCoach.profile_picture || null);
  };

  const coachInitials = coachName
    .split(' ')
    .filter(Boolean)
    .map((n: string) => n[0])
    .join('')
    .slice(0, 2)
    .toUpperCase();

  return (
    <Card onClick={onClick} className="p-4 flex flex-col justify-between h-full cursor-pointer border border-white/15 hover:border-info/35 transition-colors group">
      <div className="flex justify-between items-start">
        <div className="relative">
          <div className="w-10 h-10 rounded-2xl bg-white/10 border border-white/15 flex items-center justify-center text-text-secondary overflow-hidden">
            {coachProfilePicture ? (
              <img src={coachProfilePicture} alt={`${coachName} profile`} className="w-full h-full object-cover" />
            ) : (
              <span className="font-bold text-xs text-text-primary">{coachInitials || 'CM'}</span>
            )}
          </div>
          <div className="absolute -top-1 -right-1 w-3 h-3 bg-accent rounded-full border-2 border-card shadow-glow" />
        </div>
        <ChevronRight size={16} className="text-text-tertiary group-hover:text-text-primary transition-colors" />
      </div>

      <div className="mt-4 min-w-0">
        <div className="text-lg leading-none text-white truncate">{coachName}</div>
        <div className="text-[10px] text-text-secondary uppercase tracking-[0.12em] mt-1">Assigned Coach</div>
      </div>

      <div className="mt-3 flex items-center gap-2 text-accent text-[11px] font-semibold uppercase tracking-[0.1em] relative">
        <MessageSquare size={12} />
        <span>Chat Now</span>
        {unreadCount > 0 && (
          <span className="absolute -top-2 -right-2 bg-red-500 text-white text-[10px] w-5 h-5 rounded-full flex items-center justify-center font-bold">{unreadCount}</span>
        )}
      </div>
    </Card>
  );
}
