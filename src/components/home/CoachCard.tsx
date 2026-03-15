import React, { useState, useEffect } from 'react';
import { Card } from '../ui/Card';
import { MessageSquare } from 'lucide-react';
import { api } from '../../services/api';
import { emojiCoachSupportBg, emojiRightArrow } from '../../services/emojiTheme';
import coachSupportLogo from '../../../assets/emoji/coach.png';

interface CoachCardProps {
  onClick: () => void;
}

export function CoachCard({ onClick }: CoachCardProps) {
  const [unreadCount, setUnreadCount] = useState(0);

  useEffect(() => {
    loadUnreadCount();
  }, []);

  const loadUnreadCount = async () => {
    const user = JSON.parse(localStorage.getItem('appUser') || localStorage.getItem('user') || '{}');
    if (user.id && user.coach_id) {
      const msgs = await api.getMessages(user.id, user.coach_id);
      const unread = msgs.filter((m: any) => m.sender_type === 'coach' && !m.read).length;
      setUnreadCount(unread);
    }
  };

  return (
    <Card onClick={onClick} className="relative overflow-hidden p-4 flex flex-col justify-between h-full cursor-pointer border border-white/15 hover:border-info/35 transition-colors group">
      <div
        className="absolute inset-0 bg-cover bg-center opacity-45 transition-transform duration-300 group-hover:scale-105"
        style={{ backgroundImage: `url(${emojiCoachSupportBg})` }}
      />
      <div className="absolute inset-0 bg-gradient-to-b from-black/45 via-black/50 to-black/70" />

      <div className="relative z-10 flex justify-between items-start">
        <div className="relative">
          <div className="w-10 h-10 rounded-2xl bg-white/10 border border-white/15 flex items-center justify-center text-text-secondary overflow-hidden">
            <img src={coachSupportLogo} alt="Coach support logo" className="w-full h-full object-cover" />
          </div>
          <div className="absolute -top-1 -right-1 w-3 h-3 bg-accent rounded-full border-2 border-card shadow-glow" />
        </div>
        <img src={emojiRightArrow} alt="" aria-hidden="true" className="h-4 w-4 object-contain opacity-70 group-hover:opacity-100 transition-opacity" />
      </div>

      <div className="relative z-10 mt-4 min-w-0">
        <div className="text-lg leading-none text-white truncate">Our Coach Support</div>
        <div className="text-[10px] text-text-secondary uppercase tracking-[0.12em] mt-1">Chat Support</div>
      </div>

      <div className="relative z-10 mt-3 flex items-center gap-2 text-accent text-[11px] font-semibold uppercase tracking-[0.1em]">
        <MessageSquare size={12} />
        <span>Chat Now</span>
        {unreadCount > 0 && (
          <span className="absolute -top-2 -right-2 bg-red-500 text-white text-[10px] w-5 h-5 rounded-full flex items-center justify-center font-bold">{unreadCount}</span>
        )}
      </div>
    </Card>
  );
}
