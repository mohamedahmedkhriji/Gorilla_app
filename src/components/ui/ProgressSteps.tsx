import React from 'react';
import { motion } from 'framer-motion';
import { pickLanguage } from '../../services/language';
import { useAppLanguage } from '../../hooks/useAppLanguage';

interface ProgressStepsProps {
  currentStep: number;
  totalSteps: number;
}

export function ProgressSteps({ currentStep, totalSteps }: ProgressStepsProps) {
  const { language, isArabic } = useAppLanguage();
  const copy = pickLanguage(language, {
    en: { step: 'Step', of: 'of' },
    ar: { step: 'الخطوة', of: 'من' },
    it: { step: 'Passo', of: 'di' },
    de: { step: 'Schritt', of: 'von' },
    fr: { step: 'Etape', of: 'sur' },
  });
  const stepIndex = Math.min(Math.max(currentStep + 1, 1), Math.max(totalSteps, 1));
  const progress = totalSteps > 0 ? Math.min(1, stepIndex / totalSteps) : 0;

  return (
    <div dir={isArabic ? 'rtl' : 'ltr'} className="w-full mb-8 space-y-2">
      <div className="flex items-center justify-between text-[11px] tracking-[0.18em] text-text-tertiary">
        <span>{copy.step} {stepIndex}</span>
        <span>{copy.of} {totalSteps}</span>
      </div>
      <div className="h-1.5 w-full rounded-full bg-white/10 overflow-hidden">
        <motion.div
          initial={{ width: 0 }}
          animate={{ width: `${progress * 100}%` }}
          transition={{ duration: 0.35 }}
          className="h-full bg-accent"
        />
      </div>
    </div>
  );
}
