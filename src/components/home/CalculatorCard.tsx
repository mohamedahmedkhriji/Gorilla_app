import React from 'react';
import { Card } from '../ui/Card';
import { emojiMyNutrition, emojiNutritionBg, emojiRightArrow } from '../../services/emojiTheme';
import { getActiveLanguage, getStoredLanguage, pickLanguage } from '../../services/language';
import { HOME_CARD_HOVER_CLASS, HOME_CARD_OVERLAY_CLASS, HOME_CARD_TITLE_CLASS } from './homeCardStyles';

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
      whileHover={{ y: -2 }}
      className={`group relative flex items-center justify-between overflow-hidden border border-white/15 p-4 shadow-card ${HOME_CARD_HOVER_CLASS} cursor-pointer hover:border-accent/35`}
    >
      <div
        className="absolute inset-0 bg-cover bg-center opacity-60"
        style={{ backgroundImage: `url(${emojiNutritionBg})` }}
        aria-hidden="true"
      />
      <div
        className={HOME_CARD_OVERLAY_CLASS}
        aria-hidden="true"
      />
      <div className="relative z-10 flex items-center gap-4">
        <div className="flex h-10 w-10 items-center justify-center rounded-2xl border border-info/30 bg-info/15 text-info transition-colors group-hover:text-accent">
          <img src={emojiMyNutrition} alt={copy.title} className="h-7 w-7 object-contain" />
        </div>
        <div className="min-w-0 flex items-center">
          <h4 className={HOME_CARD_TITLE_CLASS}>{copy.title}</h4>
        </div>
      </div>
      <img
        src={emojiRightArrow}
        alt=""
        aria-hidden="true"
        className="relative z-10 h-[18px] w-[18px] shrink-0 object-contain opacity-70 transition-opacity group-hover:opacity-100"
      />
    </Card>
  );
}
