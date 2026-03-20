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
import { AppLanguage, getActiveLanguage, pickLanguage } from '../services/language';
import { useScrollToTopOnChange } from '../shared/scroll';

interface ProgressProps {
  resetSignal?: number;
  guidedTourActive?: boolean;
  onGuidedTourComplete?: () => void;
  onGuidedTourDismiss?: () => void;
}

const hasCoachmarkTargets = (steps: CoachmarkStep[]) =>
  typeof document !== 'undefined'
  && steps.every((step) => Boolean(document.querySelector(`[data-coachmark-target="${step.targetId}"]`)));

export function Progress({
  resetSignal = 0,
  guidedTourActive = false,
  onGuidedTourComplete,
  onGuidedTourDismiss,
}: ProgressProps) {
  const [view, setView] = useState<'dashboard' | 'report' | 'recovery' | 'measurements' | 'photos' | 'exercise' | 'insights' | 'weeklyCheckin' | 'strengthScore'>(
    'dashboard',
  );
  const [language, setLanguage] = useState<AppLanguage>(() => getActiveLanguage());
  const [coachmarkStepIndex, setCoachmarkStepIndex] = useState(0);
  const [isCoachmarkOpen, setIsCoachmarkOpen] = useState(false);
  const hasTrackedVisitRef = useRef(false);
  const coachmarkScope = getCoachmarkUserScope();
  const coachmarkDefaultSeenSteps = useMemo(
    () => ({
      page_intro: false,
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
    () => pickLanguage(language, {
      en: {
        next: 'Next',
        skip: 'Skip',
        finish: 'Got it',
        steps: [
          {
            id: 'page_intro',
            targetId: 'progress_dashboard',
            title: 'This is your progress page',
            body: 'This page shows your full progress flow from top to bottom.',
            placement: 'bottom' as const,
          },
          {
            id: 'strength_chart',
            targetId: 'progress_strength_chart',
            title: 'Your real strength',
            body: 'This chart shows your estimated 1RM trend so you can see if strength is truly moving up.',
            placement: 'bottom' as const,
          },
          {
            id: 'consistency',
            targetId: 'progress_consistency_card',
            title: 'Stay consistent',
            body: 'See your weekly consistency and how many planned training days you completed.',
            placement: 'bottom' as const,
          },
          {
            id: 'total_volume',
            targetId: 'progress_total_volume_card',
            title: 'Track workload',
            body: 'Total volume helps you understand how much work you are accumulating across sessions.',
            placement: 'bottom' as const,
          },
          {
            id: 'muscle_distribution',
            targetId: 'progress_muscle_distribution_card',
            title: 'See plan focus',
            body: 'This shows which muscle groups your current plan is emphasizing the most.',
            placement: 'bottom' as const,
          },
          {
            id: 'report',
            targetId: 'progress_biweekly_report_button',
            title: 'Review your report',
            body: 'Open your bi-weekly report for a clearer summary of your key progress trends.',
            placement: 'top' as const,
          },
          {
            id: 'overload',
            targetId: 'progress_overload_card',
            title: 'Progress the next block',
            body: 'RepSet suggests your next overload targets here based on your plan and recent training.',
            placement: 'top' as const,
          },
        ] satisfies CoachmarkStep[],
      },
      ar: {
        next: 'التالي',
        skip: 'تخطي',
        finish: 'حسنًا',
        steps: [
          {
            id: 'page_intro',
            targetId: 'progress_dashboard',
            title: 'هذه صفحة التقدم',
            body: 'هنا تتابع تقدمك كاملًا من الأعلى إلى الأسفل.',
            placement: 'bottom' as const,
          },
          {
            id: 'strength_chart',
            targetId: 'progress_strength_chart',
            title: 'قوتك الحقيقية',
            body: 'يعرض هذا المخطط اتجاه 1RM التقديري حتى ترى هل قوتك تتقدم فعلًا.',
            placement: 'bottom' as const,
          },
          {
            id: 'consistency',
            targetId: 'progress_consistency_card',
            title: 'حافظ على الانتظام',
            body: 'هنا ترى نسبة التزامك هذا الأسبوع وعدد الأيام التي أنجزتها.',
            placement: 'bottom' as const,
          },
          {
            id: 'total_volume',
            targetId: 'progress_total_volume_card',
            title: 'تتبّع الحمل',
            body: 'إجمالي الحجم يوضح كمية العمل التي رفعتها عبر الجلسات.',
            placement: 'bottom' as const,
          },
          {
            id: 'muscle_distribution',
            targetId: 'progress_muscle_distribution_card',
            title: 'شاهد تركيز الخطة',
            body: 'هذا يوضح العضلات التي تستهدفها خطتك الحالية أكثر من غيرها.',
            placement: 'bottom' as const,
          },
          {
            id: 'report',
            targetId: 'progress_biweekly_report_button',
            title: 'راجع تقريرك',
            body: 'افتح التقرير نصف الأسبوعي لمراجعة الملخصات والاتجاهات المهمة.',
            placement: 'top' as const,
          },
          {
            id: 'overload',
            targetId: 'progress_overload_card',
            title: 'طوّر الفترة التالية',
            body: 'هنا يقترح RepSet أهداف التدرج القادمة بناءً على خطتك وأدائك الأخير.',
            placement: 'top' as const,
          },
        ] satisfies CoachmarkStep[],
      },
      it: {
        next: 'Avanti',
        skip: 'Salta',
        finish: 'Ho capito',
        steps: [
          {
            id: 'page_intro',
            targetId: 'progress_dashboard',
            title: 'Questa e la tua pagina progressi',
            body: 'Qui puoi seguire tutto il tuo andamento dall’inizio alla fine.',
            placement: 'bottom' as const,
          },
          {
            id: 'strength_chart',
            targetId: 'progress_strength_chart',
            title: 'La tua forza reale',
            body: 'Questo grafico mostra l’andamento del tuo 1RM stimato per capire se la forza sta davvero crescendo.',
            placement: 'bottom' as const,
          },
          {
            id: 'consistency',
            targetId: 'progress_consistency_card',
            title: 'Resta costante',
            body: 'Qui vedi la tua costanza settimanale e quanti giorni pianificati hai completato.',
            placement: 'bottom' as const,
          },
          {
            id: 'total_volume',
            targetId: 'progress_total_volume_card',
            title: 'Monitora il carico',
            body: 'Il volume totale ti aiuta a capire quanto lavoro stai accumulando tra le sessioni.',
            placement: 'bottom' as const,
          },
          {
            id: 'muscle_distribution',
            targetId: 'progress_muscle_distribution_card',
            title: 'Guarda il focus del piano',
            body: 'Questo mostra quali gruppi muscolari il tuo piano attuale sta enfatizzando di piu.',
            placement: 'bottom' as const,
          },
          {
            id: 'report',
            targetId: 'progress_biweekly_report_button',
            title: 'Rivedi il tuo report',
            body: 'Apri il report bisettimanale per una sintesi piu chiara delle tue tendenze principali.',
            placement: 'top' as const,
          },
          {
            id: 'overload',
            targetId: 'progress_overload_card',
            title: 'Fai avanzare il prossimo blocco',
            body: 'Qui RepSet suggerisce i prossimi obiettivi di sovraccarico in base al tuo piano e agli allenamenti recenti.',
            placement: 'top' as const,
          },
        ] satisfies CoachmarkStep[],
      },
      de: {
        next: 'Weiter',
        skip: 'Uberspringen',
        finish: 'Verstanden',
        steps: [
          {
            id: 'page_intro',
            targetId: 'progress_dashboard',
            title: 'Das ist deine Fortschrittsseite',
            body: 'Hier siehst du deinen kompletten Fortschritt von oben bis unten.',
            placement: 'bottom' as const,
          },
          {
            id: 'strength_chart',
            targetId: 'progress_strength_chart',
            title: 'Deine echte Kraft',
            body: 'Dieses Diagramm zeigt den Trend deines geschatzten 1RM, damit du echte Kraftentwicklung erkennst.',
            placement: 'bottom' as const,
          },
          {
            id: 'consistency',
            targetId: 'progress_consistency_card',
            title: 'Bleib konstant',
            body: 'Hier siehst du deine Wochenkonstanz und wie viele geplante Trainingstage du geschafft hast.',
            placement: 'bottom' as const,
          },
          {
            id: 'total_volume',
            targetId: 'progress_total_volume_card',
            title: 'Belastung verfolgen',
            body: 'Das Gesamtvolumen hilft dir zu verstehen, wie viel Arbeit du uber mehrere Einheiten sammelst.',
            placement: 'bottom' as const,
          },
          {
            id: 'muscle_distribution',
            targetId: 'progress_muscle_distribution_card',
            title: 'Fokus des Plans sehen',
            body: 'Das zeigt, welche Muskelgruppen dein aktueller Plan am starksten betont.',
            placement: 'bottom' as const,
          },
          {
            id: 'report',
            targetId: 'progress_biweekly_report_button',
            title: 'Deinen Report prufen',
            body: 'Offne deinen Zwei-Wochen-Report fur eine klarere Zusammenfassung deiner wichtigsten Trends.',
            placement: 'top' as const,
          },
          {
            id: 'overload',
            targetId: 'progress_overload_card',
            title: 'Den nachsten Block steigern',
            body: 'Hier schlagt RepSet deine nachsten Uberlastungsziele basierend auf Plan und aktuellem Training vor.',
            placement: 'top' as const,
          },
        ] satisfies CoachmarkStep[],
      },
    }),
    [language],
  );
  const coachmarkSteps = coachmarkCopy.steps;
  const activeCoachmarkStep = coachmarkSteps[coachmarkStepIndex] || null;

  useScrollToTopOnChange([view, resetSignal]);

  useEffect(() => {
    const handleLanguageChanged = () => {
      setLanguage(getActiveLanguage());
    };

    handleLanguageChanged();
    window.addEventListener('app-language-changed', handleLanguageChanged);
    return () => window.removeEventListener('app-language-changed', handleLanguageChanged);
  }, []);

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
        guidedTourActive
        && !progress.completed
        && !progress.dismissed
        && hasCoachmarkTargets(coachmarkSteps);

      if (canShowTour) {
        setCoachmarkStepIndex(Math.min(progress.currentStep, coachmarkSteps.length - 1));
        setIsCoachmarkOpen(true);
      }
    }, 460);

    return () => window.clearTimeout(timer);
  }, [coachmarkSteps, coachmarkStorageOptions, guidedTourActive, isCoachmarkOpen, view]);

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
    if (guidedTourActive) onGuidedTourComplete?.();
  };

  const handleCoachmarkSkip = () => {
    patchCoachmarkProgress(coachmarkStorageOptions, {
      dismissed: true,
      currentStep: coachmarkStepIndex,
    });
    closeCoachmarks();
    if (guidedTourActive) onGuidedTourDismiss?.();
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
        onTargetAction={null}
      />
    </div>
  );
}
