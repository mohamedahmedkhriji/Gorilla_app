import React from 'react';
import { motion } from 'framer-motion';
import { HOME_CARD_HOVER_CLASS, HOME_CARD_OVERLAY_CLASS, HOME_CARD_TITLE_CLASS } from '../home/homeCardStyles';
import { getActiveLanguage, getStoredLanguage, pickLanguage } from '../../services/language';

interface RecoveryIndicatorProps {
  percentage: number;
  onClick?: () => void;
  coachmarkTargetId?: string;
  themeVariant?: 'default' | 'girls';
}

export function RecoveryIndicator({ onClick, coachmarkTargetId, themeVariant = 'default' }: RecoveryIndicatorProps) {
  const isGirlsTheme = themeVariant === 'girls';
  const language = getActiveLanguage(getStoredLanguage());
  const copy = pickLanguage(language, {
    en: {
      title: 'My Nutrition',
      body: 'Eat well and recover',
    },
    ar: {
      title: 'تغذيتي',
      body: 'كُل جيدًا وتعافَ أفضل',
    },
    it: {
      title: 'La mia nutrizione',
      body: 'Mangia bene e recupera',
    },
    de: {
      title: 'Meine Ernahrung',
      body: 'Gut essen und erholen',
    },
    fr: {
      title: 'Ma Nutrition',
      body: 'Bien manger et recuperer',
    },
  });

  const cardClassName = isGirlsTheme
    ? `relative overflow-hidden rounded-2xl border border-[#E2B4BD]/60 bg-white/[0.78] p-4 text-[#4A4A4A] shadow-[0_18px_42px_rgba(226,180,189,0.20)] transition-all duration-300 hover:shadow-[0_20px_46px_rgba(249,178,215,0.24)] ${onClick ? 'cursor-pointer hover:border-[#F9B2D7]/70' : ''}`
    : `surface-card group relative overflow-hidden rounded-2xl border border-white/15 p-4 shadow-card ${HOME_CARD_HOVER_CLASS} ${onClick ? 'cursor-pointer hover:border-accent/30' : ''}`;
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
      <div className={overlayClassName} aria-hidden="true" />

      <div className="relative z-10 flex min-h-[6.5rem] items-center justify-center text-center">
        <div className="min-w-0">
          <h4 className={isGirlsTheme ? 'truncate text-[1.9rem] font-electrolize font-bold leading-none text-[#4A4A4A]' : HOME_CARD_TITLE_CLASS}>
            {copy.title}
          </h4>
          <p className={`mt-2 truncate text-sm font-medium ${isGirlsTheme ? 'text-[#795E67]' : 'text-text-secondary'}`}>
            {copy.body}
          </p>
        </div>
      </div>
    </motion.div>
  );
}
