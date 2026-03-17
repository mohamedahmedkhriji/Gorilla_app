import React, { useEffect, useMemo, useRef, useState } from 'react';
import { CoachmarkOverlay, type CoachmarkStep } from '../components/coachmarks/CoachmarkOverlay';
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
import {
  getCoachmarkUserScope,
  incrementCoachmarkVisitCount,
  patchCoachmarkProgress,
  PROGRESS_COACHMARK_TOUR_ID,
  PROGRESS_COACHMARK_VERSION,
  readCoachmarkProgress,
} from '../services/coachmarks';
import { getActiveLanguage, getStoredLanguage } from '../services/language';
import { useScrollToTopOnChange } from '../shared/scroll';
interface ProgressProps {
  resetSignal?: number;
}

const hasCoachmarkTargets = (steps: CoachmarkStep[]) =>
  typeof document !== 'undefined'
  && steps.every((step) => Boolean(document.querySelector(`[data-coachmark-target="${step.targetId}"]`)));

export function Progress({ resetSignal = 0 }: ProgressProps) {
  const [view, setView] = useState<'dashboard' | 'report' | 'recovery' | 'measurements' | 'photos' | 'exercise' | 'insights' | 'weeklyCheckin' | 'strengthScore'>(
    'dashboard'
  );
  const [coachmarkStepIndex, setCoachmarkStepIndex] = useState(0);
  const [isCoachmarkOpen, setIsCoachmarkOpen] = useState(false);
  const hasTrackedVisitRef = useRef(false);
  const isArabic = getActiveLanguage(getStoredLanguage()) === 'ar';
  const coachmarkScope = getCoachmarkUserScope();
  const coachmarkDefaultSeenSteps = useMemo(
    () => ({
      strength_chart: false,
      consistency: false,
      total_volume: false,
      muscle_distribution: false,
      report: false,
      overload: false,
    }),
    [],
  );
  const coachmarkStorageOptions = useMemo(
    () => ({
      tourId: PROGRESS_COACHMARK_TOUR_ID,
      version: PROGRESS_COACHMARK_VERSION,
      userScope: coachmarkScope,
      defaultSeenSteps: coachmarkDefaultSeenSteps,
    }),
    [coachmarkDefaultSeenSteps, coachmarkScope],
  );
  const coachmarkCopy = useMemo(
    () => ({
      next: isArabic ? 'التالي' : 'Next',
      skip: isArabic ? 'تخطي' : 'Skip',
      finish: isArabic ? 'حسناً' : 'Got it',
      steps: [
        {
          id: 'strength_chart',
          targetId: 'progress_strength_chart',
          title: isArabic ? 'قوتك الحقيقية' : 'Your real strength',
          body: isArabic
            ? 'يعرض هذا المخطط اتجاه 1RM التقديري حتى ترى هل قوتك تتقدم فعلاً.'
            : 'This chart shows your estimated 1RM trend so you can see if strength is truly moving up.',
          placement: 'bottom' as const,
        },
        {
          id: 'consistency',
          targetId: 'progress_consistency_card',
          title: isArabic ? 'حافظ على الانتظام' : 'Stay consistent',
          body: isArabic
            ? 'هنا ترى نسبة التزامك هذا الأسبوع وعدد الأيام التي أنجزتها.'
            : 'See your weekly consistency and how many planned training days you completed.',
          placement: 'bottom' as const,
        },
        {
          id: 'total_volume',
          targetId: 'progress_total_volume_card',
          title: isArabic ? 'تتبّع الحمل' : 'Track workload',
          body: isArabic
            ? 'إجمالي الحجم يوضح كمية العمل التي رفعتها عبر الجلسات.'
            : 'Total volume helps you understand how much work you are accumulating across sessions.',
          placement: 'bottom' as const,
        },
        {
          id: 'muscle_distribution',
          targetId: 'progress_muscle_distribution_card',
          title: isArabic ? 'شاهد تركيز الخطة' : 'See plan focus',
          body: isArabic
            ? 'هذا يوضح العضلات التي تستهدفها خطتك الحالية أكثر من غيرها.'
            : 'This shows which muscle groups your current plan is emphasizing the most.',
          placement: 'bottom' as const,
        },
        {
          id: 'report',
          targetId: 'progress_biweekly_report_button',
          title: isArabic ? 'راجع تقريرك' : 'Review your report',
          body: isArabic
            ? 'افتح التقرير نصف الأسبوعي لمراجعة الملخصات والاتجاهات المهمة.'
            : 'Open your bi-weekly report for a clearer summary of your key progress trends.',
          placement: 'top' as const,
        },
        {
          id: 'overload',
          targetId: 'progress_overload_card',
          title: isArabic ? 'طوّر الفترة التالية' : 'Progress the next block',
          body: isArabic
            ? 'هنا يقترح RepSet أهداف التدرج القادمة بناءً على خطتك وأدائك الأخير.'
            : 'RepSet suggests your next overload targets here based on your plan and recent training.',
          placement: 'top' as const,
        },
      ] satisfies CoachmarkStep[],
    }),
    [isArabic],
  );
  const coachmarkSteps = coachmarkCopy.steps;
  const activeCoachmarkStep = coachmarkSteps[coachmarkStepIndex] || null;

  useScrollToTopOnChange([view, resetSignal]);

  useEffect(() => {
    setView('dashboard');
  }, [resetSignal]);

  useEffect(() => {
    if (view !== 'dashboard' || hasTrackedVisitRef.current) return;

    hasTrackedVisitRef.current = true;
    incrementCoachmarkVisitCount(coachmarkStorageOptions);
  }, [coachmarkStorageOptions, view]);

  useEffect(() => {
    if (view !== 'dashboard' || isCoachmarkOpen) return;

    const timer = window.setTimeout(() => {
      const progress = readCoachmarkProgress(coachmarkStorageOptions);
      const canShowTour =
        !progress.completed
        && !progress.dismissed
        && hasCoachmarkTargets(coachmarkSteps);

      if (canShowTour) {
        setCoachmarkStepIndex(Math.min(progress.currentStep, coachmarkSteps.length - 1));
        setIsCoachmarkOpen(true);
      }
    }, 460);

    return () => window.clearTimeout(timer);
  }, [coachmarkSteps, coachmarkStorageOptions, isCoachmarkOpen, view]);

  const closeCoachmarks = () => {
    setIsCoachmarkOpen(false);
    setCoachmarkStepIndex(0);
  };

  const handleCoachmarkNext = () => {
    if (!activeCoachmarkStep) return;
    if (coachmarkStepIndex >= coachmarkSteps.length - 1) return;

    patchCoachmarkProgress(coachmarkStorageOptions, (current) => ({
      currentStep: coachmarkStepIndex + 1,
      seenSteps: {
        ...current.seenSteps,
        [activeCoachmarkStep.id]: true,
      },
    }));

    setCoachmarkStepIndex((current) => Math.min(current + 1, coachmarkSteps.length - 1));
  };

  const handleCoachmarkFinish = () => {
    if (!activeCoachmarkStep) return;

    patchCoachmarkProgress(coachmarkStorageOptions, (current) => ({
      completed: true,
      dismissed: false,
      currentStep: Math.max(coachmarkSteps.length - 1, 0),
      seenSteps: {
        ...current.seenSteps,
        [activeCoachmarkStep.id]: true,
      },
    }));

    closeCoachmarks();
  };

  const handleCoachmarkSkip = () => {
    patchCoachmarkProgress(coachmarkStorageOptions, {
      dismissed: true,
      currentStep: coachmarkStepIndex,
    });
    closeCoachmarks();
  };

  const handleCoachmarkTargetAction = () => {
    if (!activeCoachmarkStep) return;

    if (activeCoachmarkStep.id === 'total_volume') {
      patchCoachmarkProgress(coachmarkStorageOptions, (current) => ({
        seenSteps: {
          ...current.seenSteps,
          total_volume: true,
        },
      }));
      closeCoachmarks();
      setView('strengthScore');
      return;
    }

    if (activeCoachmarkStep.id === 'report') {
      patchCoachmarkProgress(coachmarkStorageOptions, (current) => ({
        seenSteps: {
          ...current.seenSteps,
          report: true,
        },
      }));
      closeCoachmarks();
      setView('report');
    }
  };

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
    <div data-coachmark-target="progress_page" className="relative pb-24">
      <div className="space-y-2">
        <ProgressDashboard
          onViewReport={() => setView('report')}
          onViewStrengthScore={() => setView('strengthScore')}
        />

        <div className="px-4 sm:px-6">
          <OverloadPlanning coachmarkTargetId="progress_overload_card" />
        </div>
      </div>

      <CoachmarkOverlay
        isOpen={isCoachmarkOpen}
        step={activeCoachmarkStep}
        stepIndex={coachmarkStepIndex}
        totalSteps={coachmarkSteps.length}
        nextLabel={coachmarkCopy.next}
        finishLabel={coachmarkCopy.finish}
        skipLabel={coachmarkCopy.skip}
        onNext={handleCoachmarkNext}
        onFinish={handleCoachmarkFinish}
        onSkip={handleCoachmarkSkip}
        onTargetAction={
          activeCoachmarkStep?.id === 'total_volume' || activeCoachmarkStep?.id === 'report'
            ? handleCoachmarkTargetAction
            : null
        }
      />
    </div>);

}

