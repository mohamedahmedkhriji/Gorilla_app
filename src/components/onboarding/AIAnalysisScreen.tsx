import React, { useEffect, useMemo, useRef, useState } from 'react';
import { motion } from 'framer-motion';
import { CheckCircle2, Circle } from 'lucide-react';
import { api } from '../../services/api';
import { persistStoredUser } from '../../shared/authStorage';
import { BrandLogo } from '../ui/BrandLogo';
import { getOnboardingLanguage } from './onboardingI18n';

interface AIAnalysisScreenProps {
  onComplete: () => void;
  onboardingData?: any;
  userId?: number;
}

const COPY = {
  en: {
    title: 'Generating your daily schedule...',
    subtitle: 'This can take a little time while we build your personalized plan.',
    checkpoints: [
      'Analyzing your profile and activity level',
      'Building your personalized training schedule',
      'Finalizing plan and recovery targets',
    ],
    finalizing: 'Finalizing your plan...',
    preparing: 'This can take a little time. We are preparing everything for you...',
  },
  ar: {
    title: '\u062c\u0627\u0631\u064a \u0625\u0646\u0634\u0627\u0621 \u062c\u062f\u0648\u0644\u0643 \u0627\u0644\u064a\u0648\u0645\u064a...',
    subtitle: '\u0642\u062f \u064a\u0633\u062a\u063a\u0631\u0642 \u0647\u0630\u0627 \u0628\u0639\u0636 \u0627\u0644\u0648\u0642\u062a \u0644\u0623\u0646\u0646\u0627 \u0646\u0628\u0646\u064a \u062e\u0637\u0629 \u0645\u062e\u0635\u0635\u0629 \u0644\u0643.',
    checkpoints: [
      '\u062c\u0627\u0631\u064a \u062a\u062d\u0644\u064a\u0644 \u0645\u0644\u0641\u0643 \u0648\u0645\u0633\u062a\u0648\u0649 \u0646\u0634\u0627\u0637\u0643',
      '\u062c\u0627\u0631\u064a \u0628\u0646\u0627\u0621 \u062c\u062f\u0648\u0644 \u062a\u062f\u0631\u064a\u0628\u0643 \u0627\u0644\u0645\u062e\u0635\u0635',
      '\u062c\u0627\u0631\u064a \u0625\u0646\u0647\u0627\u0621 \u0627\u0644\u062e\u0637\u0629 \u0648\u0623\u0647\u062f\u0627\u0641 \u0627\u0644\u062a\u0639\u0627\u0641\u064a',
    ],
    finalizing: '\u062c\u0627\u0631\u064a \u0625\u0646\u0647\u0627\u0621 \u062e\u0637\u062a\u0643...',
    preparing: '\u0642\u062f \u064a\u0633\u062a\u063a\u0631\u0642 \u0647\u0630\u0627 \u0628\u0639\u0636 \u0627\u0644\u0648\u0642\u062a. \u0646\u062c\u0647\u0632 \u0643\u0644 \u0634\u064a\u0621 \u0644\u0643...',
  },
  it: {
    title: 'Stiamo creando il tuo programma quotidiano...',
    subtitle: 'Potrebbe richiedere un po di tempo mentre costruiamo il tuo piano personalizzato.',
    checkpoints: [
      'Analisi del tuo profilo e livello di attivita',
      'Creazione del tuo programma di allenamento personalizzato',
      'Definizione finale del piano e del recupero',
    ],
    finalizing: 'Stiamo finalizzando il tuo piano...',
    preparing: 'Potrebbe volerci un momento. Stiamo preparando tutto per te...',
  },
  de: {
    title: 'Dein Tagesplan wird erstellt...',
    subtitle: 'Das kann einen Moment dauern, waehrend wir deinen persoenlichen Plan aufbauen.',
    checkpoints: [
      'Dein Profil und Aktivitaetslevel werden analysiert',
      'Dein persoenlicher Trainingsplan wird aufgebaut',
      'Plan und Erholungsziele werden finalisiert',
    ],
    finalizing: 'Dein Plan wird finalisiert...',
    preparing: 'Das kann kurz dauern. Wir bereiten gerade alles fuer dich vor...',
  },
  fr: {
    title: 'Creation de ton planning quotidien...',
    subtitle: 'Cela peut prendre un petit moment pendant que nous construisons ton programme personnalise.',
    checkpoints: [
      'Analyse de ton profil et de ton niveau d activite',
      'Construction de ton planning d entrainement personnalise',
      'Finalisation du programme et des objectifs de recuperation',
    ],
    finalizing: 'Finalisation de ton programme...',
    preparing: 'Cela peut prendre un petit moment. Nous preparons tout pour toi...',
  },
} as const;

export function AIAnalysisScreen({ onComplete, onboardingData, userId }: AIAnalysisScreenProps) {
  const language = getOnboardingLanguage();
  const copy = COPY[language as keyof typeof COPY] ?? COPY.en;
  const checkpoints = copy.checkpoints;
  const [isGenerationDone, setIsGenerationDone] = useState(false);
  const [progress, setProgress] = useState(0);
  const [completedSteps, setCompletedSteps] = useState<boolean[]>(() => checkpoints.map(() => false));
  const completedRef = useRef(false);
  const saveStartedRef = useRef(false);

  const checkpointThresholds = useMemo(() => {
    const count = checkpoints.length;
    return checkpoints.map((_, index) => Math.round(((index + 1) / count) * 100));
  }, [checkpoints]);

  useEffect(() => {
    if (saveStartedRef.current) return;
    saveStartedRef.current = true;

    let cancelled = false;

    const saveOnboarding = async () => {
      try {
        localStorage.removeItem('onboardingCoachPlan');
        localStorage.removeItem('onboardingPlanSource');
        localStorage.removeItem('onboardingPlanWarning');
        localStorage.removeItem('onboardingCustomAdvice');
        localStorage.removeItem('assignedProgramTemplate');

        const data = await api.saveOnboarding(Number(userId || 0), {
          ...(onboardingData || {}),
          language,
          useClaude: true,
          disableClaude: false,
        });

        if (data?.user && typeof data.user === 'object') {
          persistStoredUser({
            ...data.user,
            id: data.user.id || userId || undefined,
          });
        }

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
        if (data?.customAdvice) {
          localStorage.setItem('onboardingCustomAdvice', JSON.stringify(data.customAdvice));
        } else {
          localStorage.removeItem('onboardingCustomAdvice');
        }
      } catch (error) {
        console.error('Onboarding save error:', error);
        localStorage.removeItem('onboardingCoachPlan');
        localStorage.setItem('onboardingPlanSource', 'template');
        localStorage.setItem(
          'onboardingPlanWarning',
          error instanceof Error ? error.message : 'Failed to generate onboarding plan',
        );
        localStorage.removeItem('onboardingCustomAdvice');
        localStorage.removeItem('assignedProgramTemplate');
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
  }, [language, onboardingData, userId]);

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

  const roundedProgress = Math.round(progress);
  const completedCount = completedSteps.filter(Boolean).length;
  const checkpointProgress = Math.round((completedCount / checkpoints.length) * 100);
  const displayProgress = Math.max(roundedProgress, checkpointProgress);

  useEffect(() => {
    if (!isGenerationDone || displayProgress < 100 || completedSteps.some((step) => !step)) {
      return;
    }
    if (completedRef.current) return;

    completedRef.current = true;
    const timer = window.setTimeout(() => {
      onComplete();
    }, 450);

    return () => window.clearTimeout(timer);
  }, [completedSteps, displayProgress, isGenerationDone, onComplete]);

  return (
    <div className="flex-1 flex flex-col justify-center px-3 sm:px-6">
      <motion.div
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.35 }}
        className="mx-auto w-full max-w-sm rounded-3xl surface-card border border-white/10 px-6 py-8 sm:py-10"
      >
        <h2 className="text-center text-2xl sm:text-[2rem] leading-[1.05] text-white font-bold">
          {copy.title}
        </h2>

        <p className="mt-3 text-center text-sm text-text-secondary">{copy.subtitle}</p>

        <div className="mt-10 flex justify-center">
          <div className="relative w-48 h-48 flex items-center justify-center">
            <div className="absolute inset-0 rounded-full bg-accent/12" />
            <div className="absolute inset-4 rounded-full bg-accent/18" />
            <motion.div
              animate={{ scale: [1, 1.03, 1] }}
              transition={{ duration: 1.6, repeat: Infinity, ease: 'easeInOut' }}
              className="absolute inset-9 rounded-full bg-accent/28"
            />
            <div className="absolute inset-[3.35rem] flex items-center justify-center">
              <motion.div
                animate={{
                  scale: [1, 1.09, 0.96, 1.13, 1],
                  filter: [
                    'drop-shadow(0 0 0px rgba(187,255,92,0.0))',
                    'drop-shadow(0 0 12px rgba(187,255,92,0.2))',
                    'drop-shadow(0 0 4px rgba(187,255,92,0.08))',
                    'drop-shadow(0 0 18px rgba(187,255,92,0.3))',
                    'drop-shadow(0 0 0px rgba(187,255,92,0.0))',
                  ],
                }}
                transition={{
                  duration: 1.1,
                  ease: 'easeInOut',
                  repeat: Infinity,
                  times: [0, 0.18, 0.34, 0.5, 1],
                  repeatDelay: 0.08,
                }}
                className="h-full w-full rounded-[1.65rem] border border-accent/30 bg-black/70 p-1.5"
              >
                <BrandLogo
                  className="rounded-[1.35rem] bg-black"
                  imageClassName="object-contain scale-[1.14]"
                />
              </motion.div>
            </div>
          </div>
        </div>

        <div className="mt-9 space-y-3.5">
          {checkpoints.map((item, index) => {
            const done = completedSteps[index];
            return (
              <div key={item} className="flex items-center gap-3">
                {done ? (
                  <CheckCircle2 size={18} className="text-accent shrink-0" />
                ) : (
                  <Circle size={18} className="text-text-tertiary shrink-0" />
                )}
                <p className={`text-sm ${done ? 'text-text-primary' : 'text-text-secondary'}`}>{item}</p>
              </div>
            );
          })}
        </div>

        <p className="mt-6 text-center text-xs text-text-tertiary">
          {isGenerationDone ? copy.finalizing : copy.preparing}
        </p>
      </motion.div>
    </div>
  );
}
