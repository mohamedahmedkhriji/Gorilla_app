import React, { useState } from 'react';
import { ProgressDashboard } from '../components/progress/ProgressDashboard';
import { BiWeeklyReport } from '../components/progress/BiWeeklyReport';
import { MuscleRecoveryScreen } from '../components/progress/MuscleRecoveryScreen';
import { OverloadPlanning } from '../components/progress/OverloadPlanning';
import { BodyMeasurementsScreen } from '../components/progress/BodyMeasurementsScreen';
import { ProgressPhotosScreen } from '../components/progress/ProgressPhotosScreen';
import { ExerciseProgressScreen } from '../components/progress/ExerciseProgressScreen';
import { AIInsightsScreen } from '../components/progress/AIInsightsScreen';
import { WeeklyCheckInScreen } from '../components/progress/WeeklyCheckInScreen';
import { StrengthScoreScreen } from '../components/progress/StrengthScoreScreen';
interface ProgressProps {
  resetSignal?: number;
}

export function Progress({ resetSignal = 0 }: ProgressProps) {
  const [view, setView] = useState<'dashboard' | 'report' | 'recovery' | 'measurements' | 'photos' | 'exercise' | 'insights' | 'weeklyCheckin' | 'strengthScore'>(
    'dashboard'
  );

  React.useEffect(() => {
    setView('dashboard');
  }, [resetSignal]);

  if (view === 'report') {
    return <BiWeeklyReport onBack={() => setView('dashboard')} />;
  }
  if (view === 'recovery') {
    return <MuscleRecoveryScreen onBack={() => setView('dashboard')} />;
  }
  if (view === 'measurements') {
    return <BodyMeasurementsScreen onBack={() => setView('dashboard')} />;
  }
  if (view === 'photos') {
    return <ProgressPhotosScreen onBack={() => setView('dashboard')} />;
  }
  if (view === 'exercise') {
    return <ExerciseProgressScreen onBack={() => setView('dashboard')} />;
  }
  if (view === 'insights') {
    return <AIInsightsScreen onBack={() => setView('dashboard')} />;
  }
  if (view === 'weeklyCheckin') {
    return <WeeklyCheckInScreen onBack={() => setView('dashboard')} />;
  }
  if (view === 'strengthScore') {
    return <StrengthScoreScreen onBack={() => setView('dashboard')} />;
  }
  return (
    <div className="relative pb-24">
      <div className="space-y-2">
        <ProgressDashboard
          onViewReport={() => setView('report')}
          onViewStrengthScore={() => setView('strengthScore')}
        />

        <div className="px-4 sm:px-6">
          <OverloadPlanning />
        </div>
      </div>
    </div>);

}

