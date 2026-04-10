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
      subtitle: 'Calories and protein targets',
    },
    ar: {
      title: 'التغذية الذكية',
      subtitle: 'أهداف السعرات والبروتين',
    },
    it: {
      title: 'Nutrizione Smart',
      subtitle: 'Obiettivi di calorie e proteine',
    },
    de: {
      title: 'Smarte Ernahrung',
      subtitle: 'Kalorien- und Proteinziele',
    },
    fr: {
      title: 'Nutrition Auto',
      subtitle: 'Objectifs de calories et de proteines',
    },
  });

  return (
    <Card onClick={onClick} className="p-4 relative overflow-hidden flex items-center justify-between cursor-pointer border border-white/15 hover:border-accent/35 transition-colors group">
      <div
        className="absolute inset-0 bg-cover bg-center opacity-60"
        style={{ backgroundImage: `url(${emojiNutritionBg})` }}
        aria-hidden="true"
      />
      <div
        className="absolute inset-0 bg-gradient-to-r from-background/65 via-background/45 to-background/25"
        aria-hidden="true"
      />
      <div className="relative z-10 flex items-center gap-4">
        <div className="w-10 h-10 rounded-2xl bg-info/15 border border-info/30 flex items-center justify-center text-info group-hover:text-accent transition-colors">
          <img src={emojiMyNutrition} alt={copy.title} className="h-7 w-7 object-contain" />
        </div>
        <div>
          <div className="text-xl leading-none text-white">{copy.title}</div>
          <div className="text-[11px] uppercase tracking-[0.09em] text-text-secondary mt-1">{copy.subtitle}</div>
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
