import React from 'react';
import { ExerciseTrackerPage } from '../features/exercise-tracker/pages/ExerciseTrackerPage';

interface ShopProps {
  onBack: () => void;
}

export function Shop({ onBack }: ShopProps) {
  return <ExerciseTrackerPage onBack={onBack} />;
}
