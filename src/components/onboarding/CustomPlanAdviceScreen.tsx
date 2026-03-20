import React, { useEffect, useMemo, useState } from 'react';
import { Button } from '../ui/Button';
import { api } from '../../services/api';
import { getOnboardingLanguage } from './onboardingI18n';

type CustomAdvice = {
  summary?: string;
  strengths?: string[];
  recommendations?: string[];
  metrics?: {
    trainingDays?: number;
    totalExercises?: number;
    avgExercisesPerDay?: number;
  };
};

interface CustomPlanAdviceScreenProps {
  onComplete: () => void;
  onboardingData?: any;
  userId?: number;
}

export function CustomPlanAdviceScreen({
  onComplete,
  onboardingData,
  userId,
}: CustomPlanAdviceScreenProps) {
  const language = getOnboardingLanguage();
  const isArabic = language === 'ar';
  const copy = isArabic
    ? {
        title: '\u0646\u0635\u0627\u0626\u062d \u0627\u0644\u0630\u0643\u0627\u0621 \u0627\u0644\u0627\u0635\u0637\u0646\u0627\u0639\u064a \u0644\u062e\u0637\u062a\u0643 \u0627\u0644\u0645\u062e\u0635\u0635\u0629',
        subtitle: '\u062a\u0645 \u062d\u0641\u0638 \u062e\u0637\u062a\u0643. \u0625\u0644\u064a\u0643 \u062a\u062d\u0633\u064a\u0646\u0627\u062a \u0645\u062e\u0635\u0635\u0629 \u0644\u0645\u0644\u0641\u0643 \u0648\u062c\u062f\u0648\u0644\u0643.',
        loading: '\u062c\u0627\u0631\u064a \u0645\u0631\u0627\u062c\u0639\u0629 \u062e\u0637\u062a\u0643 \u0648\u0625\u0646\u0634\u0627\u0621 \u0627\u0644\u0646\u0635\u0627\u0626\u062d...',
        error: '\u062a\u0639\u0630\u0631 \u0625\u0646\u0634\u0627\u0621 \u0646\u0635\u0627\u0626\u062d \u0627\u0644\u062e\u0637\u0629 \u0627\u0644\u0645\u062e\u0635\u0635\u0629.',
        summaryFallback: '\u062e\u0637\u062a\u0643 \u0627\u0644\u0645\u062e\u0635\u0635\u0629 \u062a\u0628\u062f\u0648 \u062c\u064a\u062f\u0629. \u0648\u0627\u0635\u0644 \u0627\u0644\u062a\u0642\u062f\u0645 \u0645\u0639 \u062d\u0645\u0644 \u062a\u062f\u0631\u064a\u0628\u064a \u062b\u0627\u0628\u062a \u0648\u062a\u0639\u0627\u0641\u064d \u0643\u0627\u0641\u064d.',
        strengths: '\u0645\u0627 \u064a\u0639\u0645\u0644 \u0628\u0634\u0643\u0644 \u062c\u064a\u062f',
        recommendations: '\u062a\u0648\u0635\u064a\u0627\u062a \u0627\u0644\u0630\u0643\u0627\u0621 \u0627\u0644\u0627\u0635\u0637\u0646\u0627\u0639\u064a',
        cta: '\u0627\u0628\u062f\u0623 \u0627\u0644\u0622\u0646',
      }
    : {
        title: 'AI advice for your custom plan',
        subtitle: 'Your plan is saved. Here are improvements tailored to your profile and schedule.',
        loading: 'Reviewing your plan and generating advice...',
        error: 'Failed to generate custom-plan advice.',
        summaryFallback: 'Your custom plan looks good. Keep progressing with steady overload and recovery.',
        strengths: 'What is working',
        recommendations: 'AI recommendations',
        cta: 'Start Home',
      };
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [advice, setAdvice] = useState<CustomAdvice | null>(null);
  const customPlan = onboardingData?.customPlan;

  const resolvedUserId = useMemo(() => {
    const fromProp = Number(userId || 0);
    if (Number.isFinite(fromProp) && fromProp > 0) return fromProp;
    const localUser = JSON.parse(localStorage.getItem('appUser') || localStorage.getItem('user') || '{}');
    return Number(localStorage.getItem('appUserId') || localUser?.id || 0);
  }, [userId]);

  const isCustomPlanReady = useMemo(() => {
    const cycleWeeks = Number(customPlan?.cycleWeeks || 0);
    const templateWeekCount = Math.max(1, Math.min(2, Number(customPlan?.templateWeekCount || 1) || 1));
    const selectedDays = Array.isArray(customPlan?.selectedDays) ? customPlan.selectedDays : [];
    const weekPlans = Array.isArray(customPlan?.weekPlans) ? customPlan.weekPlans : [];
    const firstWeek = weekPlans[0];
    const firstWeekWorkouts = Array.isArray(firstWeek?.weeklyWorkouts) ? firstWeek.weeklyWorkouts : [];
    const secondWeek = weekPlans[1];
    const secondWeekWorkouts = Array.isArray(secondWeek?.weeklyWorkouts) ? secondWeek.weeklyWorkouts : [];

    return Number.isFinite(cycleWeeks)
      && cycleWeeks >= 6
      && cycleWeeks <= 16
      && selectedDays.length > 0
      && firstWeekWorkouts.length > 0
      && (templateWeekCount < 2 || secondWeekWorkouts.length > 0);
  }, [customPlan]);

  useEffect(() => {
    if (!isCustomPlanReady) {
      setLoading(true);
      return;
    }

    let cancelled = false;

    const run = async () => {
      setLoading(true);
      setError('');
      try {
        const data = await api.saveOnboarding(Number(resolvedUserId || 0), {
          ...(onboardingData || {}),
          language,
          useClaude: true,
          disableClaude: false,
        });

        if (cancelled) return;

        if (data?.assignedProgram) {
          localStorage.setItem('assignedProgramTemplate', JSON.stringify(data.assignedProgram));
        }
        if (data?.customAdvice) {
          localStorage.setItem('onboardingCustomAdvice', JSON.stringify(data.customAdvice));
          setAdvice(data.customAdvice as CustomAdvice);
        } else {
          setAdvice(null);
          localStorage.removeItem('onboardingCustomAdvice');
        }
        if (data?.warning) {
          localStorage.setItem('onboardingPlanWarning', String(data.warning));
        } else {
          localStorage.removeItem('onboardingPlanWarning');
        }
      } catch (e) {
        if (cancelled) return;
        setError(
          e instanceof Error
            ? e.message
            : copy.error,
        );
      } finally {
        if (!cancelled) setLoading(false);
      }
    };

    void run();
    return () => {
      cancelled = true;
    };
  }, [isArabic, isCustomPlanReady, language, onboardingData, resolvedUserId]);

  return (
    <div className="flex-1 flex flex-col space-y-5">
      <div className="space-y-2">
        <h2 className="text-2xl font-light text-white">
          {copy.title}
        </h2>
        <p className="text-text-secondary">
          {copy.subtitle}
        </p>
      </div>

      {loading && (
        <div className="rounded-2xl border border-white/10 bg-card/70 p-4 text-sm text-text-secondary">
          {copy.loading}
        </div>
      )}

      {!loading && error && (
        <div className="rounded-2xl border border-red-500/40 bg-red-500/10 p-4 text-sm text-red-300">
          {error}
        </div>
      )}

      {!loading && !error && (
        <>
          <div className="rounded-2xl border border-accent/30 bg-accent/10 p-4">
            <p className="text-sm text-white">
              {advice?.summary || copy.summaryFallback}
            </p>
          </div>

          {Array.isArray(advice?.strengths) && advice.strengths.length > 0 && (
            <div className="rounded-2xl border border-white/10 bg-card/70 p-4">
              <p className="text-xs font-semibold uppercase tracking-[0.1em] text-accent">
                {copy.strengths}
              </p>
              <div className="mt-2 space-y-1.5 text-sm text-text-secondary">
                {advice.strengths.slice(0, 4).map((item) => (
                  <p key={item}>- {item}</p>
                ))}
              </div>
            </div>
          )}

          {Array.isArray(advice?.recommendations) && advice.recommendations.length > 0 && (
            <div className="rounded-2xl border border-white/10 bg-card/70 p-4">
              <p className="text-xs font-semibold uppercase tracking-[0.1em] text-accent">
                {copy.recommendations}
              </p>
              <div className="mt-2 space-y-1.5 text-sm text-text-secondary">
                {advice.recommendations.slice(0, 5).map((item) => (
                  <p key={item}>- {item}</p>
                ))}
              </div>
            </div>
          )}
        </>
      )}

      <div className="flex-1" />

      <Button onClick={onComplete} disabled={loading}>
        {copy.cta}
      </Button>
    </div>
  );
}

