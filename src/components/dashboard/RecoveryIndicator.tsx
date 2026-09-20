import React from 'react';
import { motion } from 'framer-motion';
import { emojiRecoveryBg } from '../../services/emojiTheme';
import { HOME_CARD_HOVER_CLASS, HOME_CARD_OVERLAY_CLASS, HOME_CARD_TITLE_CLASS } from '../home/homeCardStyles';
import { getActiveLanguage, getStoredLanguage, pickLanguage } from '../../services/language';

interface RecoveryIndicatorProps {
  percentage: number;
  onClick?: () => void;
  coachmarkTargetId?: string;
  themeVariant?: 'default' | 'girls';
}

export function RecoveryIndicator({ percentage, onClick, coachmarkTargetId, themeVariant = 'default' }: RecoveryIndicatorProps) {
  const safePercentage = Math.max(0, Math.min(100, Math.round(percentage)));
  const isGirlsTheme = themeVariant === 'girls';
  const language = getActiveLanguage(getStoredLanguage());
  const copy = pickLanguage(language, {
    en: {
      title: 'Recovery',
      statuses: {
        high: 'Ready to train hard',
        solid: 'Solid recovery',
        moderate: 'Moderate fatigue',
        low: 'Recovery needed',
      },
    },
    ar: {
      title: 'التعافي',
      statuses: {
        high: 'جاهز للتدريب بقوة',
        solid: 'تعافٍ جيد',
        moderate: 'إرهاق متوسط',
        low: 'تحتاج لتعافٍ',
      },
    },
    it: {
      title: 'Recupero',
      statuses: {
        high: 'Pronto a spingere forte',
        solid: 'Recupero solido',
        moderate: 'Fatica moderata',
        low: 'Serve recupero',
      },
    },
    de: {
      title: 'Erholung',
      statuses: {
        high: 'Bereit fur hartes Training',
        solid: 'Solide Erholung',
        moderate: 'Mittlere Ermudung',
        low: 'Mehr Erholung notig',
      },
    },
    fr: {
      title: 'Recuperation',
      statuses: {
        high: 'Pret a t entrainer fort',
        solid: 'Recuperation solide',
        moderate: 'Fatigue moderee',
        low: 'Recuperation necessaire',
      },
    },
  });

  const getBarClass = (value: number) => {
    if (isGirlsTheme) {
      if (value >= 70) return 'from-[#CFECF3] to-[#F9B2D7]';
      if (value >= 50) return 'from-[#F7D6D0] to-[#F9B2D7]';
      return 'from-[#E2B4BD] to-[#F7D6D0]';
    }
    if (value >= 90) return 'from-success to-accent';
    if (value >= 70) return 'from-accent to-info';
    if (value >= 50) return 'from-orange-400 to-yellow-300';
    return 'from-red-500 to-orange-400';
  };
  const cardClassName = isGirlsTheme
    ? `relative overflow-hidden rounded-2xl border border-[#E2B4BD]/60 bg-white/[0.78] p-4 text-[#4A4A4A] shadow-[0_18px_42px_rgba(226,180,189,0.20)] transition-all duration-300 hover:shadow-[0_20px_46px_rgba(249,178,215,0.24)] ${onClick ? 'cursor-pointer hover:border-[#F9B2D7]/70' : ''}`
    : `surface-card relative overflow-hidden rounded-2xl p-4 border border-white/15 shadow-card ${HOME_CARD_HOVER_CLASS} ${onClick ? 'cursor-pointer hover:border-accent/30' : ''}`;
  const overlayClassName = isGirlsTheme
    ? 'pointer-events-none absolute inset-0 bg-[linear-gradient(120deg,rgba(255,245,245,0.70),rgba(247,214,208,0.46)),radial-gradient(circle_at_top_right,rgba(207,236,243,0.36),transparent_40%)]'
    : HOME_CARD_OVERLAY_CLASS;

  return (
    <motion.div
      data-coachmark-target={coachmarkTargetId}
      initial={{
        opacity: 0,
        y: 20,
      }}
      animate={{
        opacity: 1,
        y: 0,
      }}
      transition={{
        duration: 0.5,
        delay: 0.2,
      }}
      whileHover={onClick ? { y: -2 } : undefined}
      onClick={onClick}
      className={cardClassName}
    >
      <div
        className={`absolute inset-0 bg-cover bg-center ${isGirlsTheme ? 'opacity-[0.34]' : 'opacity-60'}`}
        style={{ backgroundImage: `url(${emojiRecoveryBg})` }}
        aria-hidden="true"
      />
      <div
        className={overlayClassName}
        aria-hidden="true"
      />

      <div className="relative z-10 grid grid-cols-[minmax(0,1fr)_auto] items-center gap-3 mb-3">
        <div className="min-w-0 flex items-center justify-center text-center">
          <h4 className={isGirlsTheme ? 'truncate text-[1.9rem] font-electrolize font-bold leading-none text-[#4A4A4A]' : HOME_CARD_TITLE_CLASS}>{copy.title}</h4>
        </div>
        <span className={`text-3xl leading-none font-electrolize ${isGirlsTheme ? 'text-[#4A4A4A]' : 'text-text-primary'}`}>{safePercentage}%</span>
      </div>

      <div className={`relative z-10 h-2 w-full overflow-hidden rounded-full border ${isGirlsTheme ? 'border-[#E2B4BD]/35 bg-[#F7D6D0]/45' : 'border-white/10 bg-white/10'}`}>
        <div
          style={{ width: `${safePercentage}%` }}
          className={`h-full rounded-full bg-gradient-to-r ${getBarClass(safePercentage)}`}
        />
      </div>
    </motion.div>
  );
}
