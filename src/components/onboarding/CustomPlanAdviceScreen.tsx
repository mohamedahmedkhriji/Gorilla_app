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

export function CustomPlanAdviceScreen({ onComplete, onboardingData, userId }: CustomPlanAdviceScreenProps) {
  const language = getOnboardingLanguage();
  const isArabic = language === 'ar';
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [advice, setAdvice] = useState<CustomAdvice | null>(null);

  const resolvedUserId = useMemo(() => {
    const fromProp = Number(userId || 0);
    if (Number.isFinite(fromProp) && fromProp > 0) return fromProp;
    const localUser = JSON.parse(localStorage.getItem('appUser') || localStorage.getItem('user') || '{}');
    return Number(localStorage.getItem('appUserId') || localUser?.id || 0);
  }, [userId]);

  useEffect(() => {
    let cancelled = false;

    const run = async () => {
      setLoading(true);
      setError('');
      try {
        const data = await api.saveOnboarding(Number(resolvedUserId || 0), {
          ...(onboardingData || {}),
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
        setError(e instanceof Error ? e.message : (isArabic ? 'تعذر إنشاء نصائح الخطة المخصصة.' : 'Failed to generate custom-plan advice.'));
      } finally {
        if (!cancelled) setLoading(false);
      }
    };

    void run();
    return () => {
      cancelled = true;
    };
  }, [onboardingData, resolvedUserId]);

  return (
    <div className="flex-1 flex flex-col space-y-5">
      <div className="space-y-2">
        <h2 className="text-2xl font-light text-white">
          {isArabic ? 'نصائح الذكاء الاصطناعي لخطةك المخصصة' : 'AI advice for your custom plan'}
        </h2>
        <p className="text-text-secondary">
          {isArabic
            ? 'تم حفظ خطتك. إليك تحسينات مخصصة لملفك وجدولك.'
            : 'Your plan is saved. Here are improvements tailored to your profile and schedule.'}
        </p>
      </div>

      {loading && (
        <div className="rounded-2xl border border-white/10 bg-card/70 p-4 text-sm text-text-secondary">
          {isArabic ? 'جاري مراجعة خطتك وإنشاء النصائح...' : 'Reviewing your plan and generating advice...'}
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
              {advice?.summary || (isArabic
                ? 'خطتك المخصصة تبدو جيدة. واصل التقدم مع حمل تدريبي ثابت وتعافٍ كافٍ.'
                : 'Your custom plan looks good. Keep progressing with steady overload and recovery.')}
            </p>
          </div>

          {Array.isArray(advice?.strengths) && advice.strengths.length > 0 && (
            <div className="rounded-2xl border border-white/10 bg-card/70 p-4">
              <p className="text-xs font-semibold uppercase tracking-[0.1em] text-accent">
                {isArabic ? 'ما يعمل بشكل جيد' : 'What is working'}
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
                {isArabic ? 'توصيات الذكاء الاصطناعي' : 'AI recommendations'}
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
        {isArabic ? 'ابدأ الآن' : 'Start Home'}
      </Button>
    </div>
  );
}
