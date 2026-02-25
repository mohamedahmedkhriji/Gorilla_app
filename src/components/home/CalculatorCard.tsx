import React from 'react';
import { Card } from '../ui/Card';
import { Calculator, ChevronRight } from 'lucide-react';
interface CalculatorCardProps {
  onClick: () => void;
}
export function CalculatorCard({ onClick }: CalculatorCardProps) {
  return (
    <Card
      onClick={onClick}
      className="p-4 flex items-center justify-between cursor-pointer hover:border-accent/20 transition-colors group">

      <div className="flex items-center gap-4">
        <div className="w-10 h-10 rounded-full bg-white/5 flex items-center justify-center text-text-secondary group-hover:text-accent transition-colors">
          <Calculator size={20} />
        </div>
        <div>
          <div className="font-bold text-white">Calculators</div>
          <div className="text-xs text-text-secondary">
            BMR & TDEE Estimator
          </div>
        </div>
      </div>
      <ChevronRight
        size={20}
        className="text-text-tertiary group-hover:text-white transition-colors" />

    </Card>);

}