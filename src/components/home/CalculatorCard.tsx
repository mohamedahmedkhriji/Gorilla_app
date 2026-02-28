import React from 'react';
import { Card } from '../ui/Card';
import { Target, ChevronRight } from 'lucide-react';

interface CalculatorCardProps {
  onClick: () => void;
}

export function CalculatorCard({ onClick }: CalculatorCardProps) {
  return (
    <Card onClick={onClick} className="p-4 flex items-center justify-between cursor-pointer border border-white/15 hover:border-accent/35 transition-colors group">
      <div className="flex items-center gap-4">
        <div className="w-10 h-10 rounded-2xl bg-info/15 border border-info/30 flex items-center justify-center text-info group-hover:text-accent transition-colors">
          <Target size={19} />
        </div>
        <div>
          <div className="text-xl leading-none text-white">Auto Nutrition</div>
          <div className="text-[11px] uppercase tracking-[0.09em] text-text-secondary mt-1">Calories and protein targets</div>
        </div>
      </div>
      <ChevronRight size={18} className="text-text-tertiary group-hover:text-text-primary transition-colors" />
    </Card>
  );
}
