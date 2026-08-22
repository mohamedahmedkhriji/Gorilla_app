import React from 'react';
import { Header } from '../ui/Header';
import { getActiveLanguage, pickLanguage } from '../../services/language';

interface CurrentWeekPlanScreenProps {
  onBack: () => void;
  onOpenWorkout: () => void;
  onCreateCustom: () => void;
}

export function CurrentWeekPlanScreen({ onBack }: CurrentWeekPlanScreenProps) {
  const copy = pickLanguage(getActiveLanguage(), {
    en: {
      title: 'Current Week Plan',
    },
    ar: {
      title: 'خطة الأسبوع الحالي',
    },
    it: {
      title: 'Piano della settimana attuale',
    },
    de: {
      title: 'Aktueller Wochenplan',
    },
  });

  return (
    <div className="flex-1 flex flex-col h-full bg-background pb-24">
      <div className="px-4 sm:px-6 pt-2">
        <Header title={copy.title} onBack={onBack} />
      </div>
      <div className="flex-1" />
    </div>
  );
}
