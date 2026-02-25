import React, { useEffect } from 'react';
import { motion } from 'framer-motion';
interface AIAnalysisScreenProps {
  onComplete: () => void;
  onboardingData?: any;
  userId?: number;
}
export function AIAnalysisScreen({ onComplete, onboardingData, userId }: AIAnalysisScreenProps) {
  useEffect(() => {
    const saveOnboarding = async () => {
      try {
        const response = await fetch('http://localhost:5001/api/user/onboarding', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ userId, ...onboardingData })
        });
        const data = await response.json();
        if (data?.assignedProgram) {
          localStorage.setItem('assignedProgramTemplate', JSON.stringify(data.assignedProgram));
        }
        setTimeout(onComplete, 1000);
      } catch (error) {
        console.error('Onboarding save error:', error);
        setTimeout(onComplete, 1000);
      }
    };
    saveOnboarding();
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
