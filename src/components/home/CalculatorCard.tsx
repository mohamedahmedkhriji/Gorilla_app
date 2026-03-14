import React from 'react';
import { Card } from '../ui/Card';
import { ChevronRight } from 'lucide-react';
import { emojiMyNutrition, emojiNutritionBg } from '../../services/emojiTheme';

interface CalculatorCardProps {
  onClick: () => void;
}

export function CalculatorCard({ onClick }: CalculatorCardProps) {
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
          <img src={emojiMyNutrition} alt="Auto Nutrition" className="h-7 w-7 object-contain" />
        </div>
        <div>
          <div className="text-xl leading-none text-white">Auto Nutrition</div>
          <div className="text-[11px] uppercase tracking-[0.09em] text-text-secondary mt-1">Calories and protein targets</div>
        </div>
      </div>
      <ChevronRight size={18} className="relative z-10 text-text-tertiary group-hover:text-text-primary transition-colors" />
    </Card>
  );
}
