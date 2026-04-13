import React, { useState, useEffect } from 'react';
import { Card } from '../ui/Card';
import { MessageSquare } from 'lucide-react';
import { api } from '../../services/api';
import { emojiCoachSupportBg, emojiRightArrow } from '../../services/emojiTheme';
import coachSupportLogo from '../../../assets/emoji/coach.png';
import { AppLanguage, getActiveLanguage, getStoredLanguage } from '../../services/language';

interface CoachCardProps {
  onClick: () => void;
  coachmarkTargetId?: string;
}

const COACH_CARD_I18N = {
  en: {
    coachSupportLogoAlt: 'Coach support logo',
    title: 'Our Coach Support',
    subtitle: 'Chat Support',
    cta: 'Chat Now',
  },
  ar: {
    coachSupportLogoAlt: 'شعار دعم المدرب',
    title: 'دعم المدرب',
    subtitle: 'دعم المحادثة',
    cta: 'ابدأ المحادثة',
  },
  it: {
    coachSupportLogoAlt: 'Logo supporto coach',
    title: 'Supporto del Nostro Coach',
    subtitle: 'Supporto Chat',
    cta: 'Chatta Ora',
  },
  fr: {
    coachSupportLogoAlt: 'Logo du support coach',
    title: 'Support de Notre Coach',
    subtitle: 'Support chat',
    cta: 'Discuter maintenant',
  },
  de: {
    coachSupportLogoAlt: 'Coach-Support-Logo',
    title: 'Unser Coach-Support',
    subtitle: 'Chat-Support',
    cta: 'Jetzt Chatten',
  },
} as const;

export function CoachCard({ onClick, coachmarkTargetId }: CoachCardProps) {
  const [unreadCount, setUnreadCount] = useState(0);
  const [language, setLanguage] = useState<AppLanguage>('en');
  const copy = COACH_CARD_I18N[language as keyof typeof COACH_CARD_I18N] || COACH_CARD_I18N.en;

  useEffect(() => {
    setLanguage(getActiveLanguage());

    const handleLanguageChanged = () => {
      setLanguage(getStoredLanguage());
    };

    window.addEventListener('app-language-changed', handleLanguageChanged);
    window.addEventListener('storage', handleLanguageChanged);
    return () => {
      window.removeEventListener('app-language-changed', handleLanguageChanged);
      window.removeEventListener('storage', handleLanguageChanged);
    };
  }, []);

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
    <Card
      onClick={onClick}
      coachmarkTargetId={coachmarkTargetId}
      className="relative h-full cursor-pointer overflow-hidden rounded-[24px] border border-white/10 p-4 shadow-[0_18px_40px_-28px_rgba(0,0,0,0.9)] ring-1 ring-inset ring-white/[0.03] transition-all duration-300 group hover:-translate-y-1 hover:border-info/25 active:scale-[0.985]"
    >
      <div
        className="absolute inset-0 bg-cover bg-center opacity-50 transition-transform duration-300 group-hover:scale-105"
        style={{ backgroundImage: `url(${emojiCoachSupportBg})` }}
      />
      <div className="absolute inset-x-4 top-0 h-px bg-gradient-to-r from-transparent via-white/25 to-transparent" />
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_left,rgba(255,255,255,0.1),transparent_32%),linear-gradient(180deg,rgba(7,11,17,0.28),rgba(7,11,17,0.74))]" />

      <div className="relative z-10 flex justify-between items-start">
        <div className="relative">
          <div className="relative flex h-11 w-11 items-center justify-center overflow-hidden rounded-[18px] border border-white/14 bg-white/[0.08] text-text-secondary shadow-[inset_0_1px_0_rgba(255,255,255,0.07)]">
            <div className="absolute inset-x-2 top-0 h-px bg-gradient-to-r from-transparent via-white/20 to-transparent" />
            <img src={coachSupportLogo} alt={copy.coachSupportLogoAlt} className="w-full h-full object-cover" />
          </div>
          <div className="absolute -top-1 -right-1 h-3 w-3 rounded-full border-2 border-card bg-accent shadow-[0_0_0_3px_rgba(205,255,88,0.12)]" />
        </div>
        <img src={emojiRightArrow} alt="" aria-hidden="true" className="h-4 w-4 object-contain opacity-70 transition-all duration-300 group-hover:translate-x-0.5 group-hover:opacity-100" />
      </div>

      <div className="relative z-10 mt-4 min-w-0">
        <div className="text-[11px] font-medium uppercase tracking-[0.16em] text-white/52">{copy.subtitle}</div>
        <div className="mt-2 text-[20px] font-semibold leading-none tracking-[-0.03em] text-white truncate">{copy.title}</div>
      </div>

      <div className="relative z-10 mt-3 flex items-center gap-2 text-accent text-[11px] font-medium uppercase tracking-[0.16em]">
        <MessageSquare size={12} />
        <span>{copy.cta}</span>
        {unreadCount > 0 && (
          <span className="absolute -top-2 -right-2 flex h-5 w-5 items-center justify-center rounded-full bg-red-500 text-[10px] font-bold text-white shadow-[0_10px_20px_-12px_rgba(239,68,68,0.9)]">{unreadCount}</span>
        )}
      </div>
    </Card>
  );
}
