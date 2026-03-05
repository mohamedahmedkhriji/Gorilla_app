import React, { useEffect, useMemo, useRef, useState } from 'react';
import { motion } from 'framer-motion';
import { CheckCircle2, Circle } from 'lucide-react';
import { api } from '../../services/api';

interface AIAnalysisScreenProps {
  onComplete: () => void;
  onboardingData?: any;
  userId?: number;
}

const CHECKPOINTS = [
  'Analyzing your profile and activity level',
  'Building your personalized training schedule',
  'Finalizing plan and recovery targets',
];

export function AIAnalysisScreen({ onComplete, onboardingData, userId }: AIAnalysisScreenProps) {
  const [isGenerationDone, setIsGenerationDone] = useState(false);
  const [progress, setProgress] = useState(0);
  const [completedSteps, setCompletedSteps] = useState<boolean[]>(
    () => CHECKPOINTS.map(() => false),
  );
  const completedRef = useRef(false);

  const checkpointThresholds = useMemo(() => {
    const count = CHECKPOINTS.length;
    return CHECKPOINTS.map((_, index) => Math.round(((index + 1) / count) * 100));
  }, []);

  useEffect(() => {
    let cancelled = false;

    const saveOnboarding = async () => {
      try {
        localStorage.removeItem('onboardingCoachPlan');
        localStorage.removeItem('onboardingPlanSource');
        localStorage.removeItem('onboardingPlanWarning');

        const data = await api.saveOnboarding(Number(userId || 0), {
          ...(onboardingData || {}),
          useClaude: true,
          disableClaude: false,
        });

        if (data?.assignedProgram) {
          localStorage.setItem('assignedProgramTemplate', JSON.stringify(data.assignedProgram));
        }
        if (data?.claudePlan) {
          localStorage.setItem('onboardingCoachPlan', JSON.stringify(data.claudePlan));
        } else {
          localStorage.removeItem('onboardingCoachPlan');
        }
        if (data?.planSource) {
          localStorage.setItem('onboardingPlanSource', String(data.planSource));
        } else {
          localStorage.removeItem('onboardingPlanSource');
        }
        if (data?.warning) {
          localStorage.setItem('onboardingPlanWarning', String(data.warning));
        } else {
          localStorage.removeItem('onboardingPlanWarning');
        }
      } catch (error) {
        console.error('Onboarding save error:', error);
        localStorage.removeItem('onboardingCoachPlan');
        localStorage.setItem('onboardingPlanSource', 'template');
        localStorage.setItem(
          'onboardingPlanWarning',
          error instanceof Error ? error.message : 'Failed to generate onboarding plan',
        );
      } finally {
        if (!cancelled) {
          setIsGenerationDone(true);
        }
      }
    };

    void saveOnboarding();

    return () => {
      cancelled = true;
    };
  }, [onboardingData, userId]);

  useEffect(() => {
    const interval = window.setInterval(() => {
      setProgress((prev) => {
        if (prev >= 100) return 100;

        if (isGenerationDone) {
          const boost = prev < 95 ? 3.4 : 1.2;
          return Math.min(100, prev + boost);
        }

        const cap = 88;
        if (prev >= cap) return cap;
        const pace = prev < 28 ? 2.2 : prev < 56 ? 1.6 : prev < 78 ? 1.05 : 0.45;
        return Math.min(cap, prev + pace);
      });
    }, 140);

    return () => window.clearInterval(interval);
  }, [isGenerationDone]);

  useEffect(() => {
    setCompletedSteps((current) => {
      let changed = false;
      const next = [...current];
      checkpointThresholds.forEach((threshold, index) => {
        if (progress >= threshold && !next[index]) {
          next[index] = true;
          changed = true;
        }
      });
      return changed ? next : current;
    });
  }, [progress, checkpointThresholds]);

  useEffect(() => {
    if (!isGenerationDone || progress < 100 || completedSteps.some((step) => !step)) {
      return;
    }
    if (completedRef.current) return;

    completedRef.current = true;
    const timer = window.setTimeout(() => {
      onComplete();
    }, 450);

    return () => window.clearTimeout(timer);
  }, [completedSteps, isGenerationDone, onComplete, progress]);

  const roundedProgress = Math.round(progress);

  return (
    <div className="flex-1 flex flex-col justify-center px-3 sm:px-6">
      <motion.div
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.35 }}
        className="mx-auto w-full max-w-sm rounded-3xl surface-card border border-white/10 px-6 py-8 sm:py-10"
      >
        <h2 className="text-center text-2xl sm:text-[2rem] leading-[1.05] text-white font-bold">
          Generating your daily schedule...
        </h2>

        <div className="mt-10 flex justify-center">
          <div className="relative w-48 h-48 flex items-center justify-center">
            <div className="absolute inset-0 rounded-full bg-accent/12" />
            <div className="absolute inset-4 rounded-full bg-accent/18" />
            <motion.div
              animate={{ scale: [1, 1.03, 1] }}
              transition={{ duration: 1.6, repeat: Infinity, ease: 'easeInOut' }}
              className="absolute inset-9 rounded-full bg-accent/28"
            />
            <div className="absolute inset-[3.35rem] rounded-full bg-accent/70 border border-accent/35 flex items-center justify-center">
              <span className="text-4xl font-black text-white leading-none">{roundedProgress}%</span>
            </div>
          </div>
        </div>

        <div className="mt-9 space-y-3.5">
          {CHECKPOINTS.map((item, index) => {
            const done = completedSteps[index];
            return (
              <div key={item} className="flex items-center gap-3">
                {done ? (
                  <CheckCircle2 size={18} className="text-accent shrink-0" />
                ) : (
                  <Circle size={18} className="text-text-tertiary shrink-0" />
                )}
                <p className={`text-sm ${done ? 'text-text-primary' : 'text-text-secondary'}`}>
                  {item}
                </p>
              </div>
            );
          })}
        </div>

        <p className="mt-6 text-center text-xs text-text-tertiary">
          {isGenerationDone ? 'Finalizing your plan...' : 'Preparing everything for you...'}
        </p>
      </motion.div>
    </div>
  );
}
