import React, { useEffect } from 'react';
import { motion } from 'framer-motion';
import { api } from '../../services/api';
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
        const data = await api.saveOnboarding(Number(userId || 0), onboardingData || {});
        if (data?.assignedProgram) {
          localStorage.setItem('assignedProgramTemplate', JSON.stringify(data.assignedProgram));
        }
        if (data?.claudePlan) {
          localStorage.setItem('onboardingCoachPlan', JSON.stringify(data.claudePlan));
        }
        if (data?.planSource) {
          localStorage.setItem('onboardingPlanSource', String(data.planSource));
        }
        if (data?.warning) {
          localStorage.setItem('onboardingPlanWarning', String(data.warning));
        } else {
          localStorage.removeItem('onboardingPlanWarning');
        }
      } catch (error) {
        console.error('Onboarding save error:', error);
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
          <video
            autoPlay
            muted
            loop
            playsInline
            className="w-20 h-20 object-cover rounded-full"
          >
            <source src="/body part/loading.mp4" type="video/mp4" />
          </video>
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
