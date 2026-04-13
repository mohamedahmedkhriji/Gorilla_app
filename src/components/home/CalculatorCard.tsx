import React from 'react';
import { Card } from '../ui/Card';
import { emojiMyNutrition, emojiNutritionBg, emojiRightArrow } from '../../services/emojiTheme';
import { getActiveLanguage, getStoredLanguage, pickLanguage } from '../../services/language';

interface CalculatorCardProps {
  onClick: () => void;
}

export function CalculatorCard({ onClick }: CalculatorCardProps) {
  const language = getActiveLanguage(getStoredLanguage());
  const copy = pickLanguage(language, {
    en: {
      title: 'Auto Nutrition',
    },
    ar: {
      title: 'التغذية الذكية',
      subtitle: 'أهداف السعرات والبروتين',
    },
    it: {
      title: 'Nutrizione Smart',
    },
    de: {
      title: 'Smarte Ernahrung',
    },
    fr: {
      title: 'Nutrition Auto',
    },
  });

  return (
    <Card
      onClick={onClick}
      whileHover={{ y: -4 }}
      className="p-4 relative overflow-hidden flex items-center justify-between cursor-pointer border border-white/15 shadow-card transition-all duration-300 hover:border-accent/35 hover:shadow-[0_12px_32px_rgba(0,0,0,0.45),0_0_14px_rgba(191,255,0,0.07)] group"
    >
      <div
        className="absolute inset-0 bg-cover bg-center opacity-60"
        style={{ backgroundImage: `url(${emojiNutritionBg})` }}
        aria-hidden="true"
      />
      <div
        className="absolute inset-0 bg-gradient-to-r from-background/65 via-background/45 to-background/25"
        aria-hidden="true"
      />
      <div
        className="absolute inset-0 bg-[linear-gradient(180deg,rgba(255,255,255,0.05),transparent)] pointer-events-none"
        aria-hidden="true"
      />
      <div className="relative z-10 flex items-center gap-4">
        <div className="w-10 h-10 rounded-2xl bg-info/15 border border-info/30 flex items-center justify-center text-info group-hover:text-accent transition-colors">
          <img src={emojiMyNutrition} alt={copy.title} className="h-7 w-7 object-contain" />
        </div>
        <div className="min-w-0 flex items-center">
          <h4 className="truncate text-[1.9rem] font-electrolize font-bold leading-none text-text-primary">{copy.title}</h4>
        </div>
      </div>
      <img
        src={emojiRightArrow}
        alt=""
        aria-hidden="true"
        className="relative z-10 h-[18px] w-[18px] object-contain opacity-70 group-hover:opacity-100 transition-opacity"
      />
    </Card>
  );
}
