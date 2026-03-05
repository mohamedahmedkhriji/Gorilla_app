import React, { useEffect } from 'react';
import { motion } from 'framer-motion';
import { api } from '../../services/api';
import { BrandLogo } from '../ui/BrandLogo';
interface AIAnalysisScreenProps {
  onComplete: () => void;
  onboardingData?: any;
  userId?: number;
}
export function AIAnalysisScreen({ onComplete, onboardingData, userId }: AIAnalysisScreenProps) {
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
        setTimeout(() => {
          if (!cancelled) onComplete();
        }, 1000);
      }
    };
    void saveOnboarding();
    return () => {
      cancelled = true;
    };
  }, [onComplete, onboardingData, userId]);
  return (
    <div className="flex-1 flex flex-col items-center justify-center space-y-8 text-center">
      <div className="relative">
        <motion.div
          animate={{
            rotate: 360
          }}
          transition={{
            duration: 3,
            repeat: Infinity,
            ease: 'linear'
          }}
          className="w-32 h-32 rounded-full border-t-2 border-l-2 border-accent" />

        <div className="absolute inset-0 flex items-center justify-center">
          <div className="relative">
            <video
              autoPlay
              muted
              loop
              playsInline
              className="w-20 h-20 object-cover rounded-full border border-white/15"
            >
              <source src="/body part/loading.mp4" type="video/mp4" />
            </video>

            <motion.div
              animate={{
                scale: [1, 1.06, 1],
              }}
              transition={{
                duration: 1.4,
                repeat: Infinity,
                ease: 'easeInOut',
              }}
              className="absolute -bottom-2 -right-2 w-8 h-8 rounded-full bg-black/75 border border-white/20 p-1"
            >
              <BrandLogo className="rounded-full" imageClassName="object-cover" />
            </motion.div>
          </div>
        </div>
      </div>

      <div className="space-y-2">
        <h2 className="text-xl font-medium text-white">
          Analyzing Body Composition
        </h2>
        <p className="text-text-secondary text-sm">
          Building your personalized training plan...
        </p>
      </div>
    </div>);

}
