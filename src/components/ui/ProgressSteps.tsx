import React from 'react';
import { motion } from 'framer-motion';
interface ProgressStepsProps {
  currentStep: number;
  totalSteps: number;
}
export function ProgressSteps({ currentStep, totalSteps }: ProgressStepsProps) {
  return (
    <div className="w-full flex gap-1 h-1 mb-8">
      {Array.from({
        length: totalSteps
      }).map((_, index) =>
      <div
        key={index}
        className="flex-1 h-full rounded-full bg-white/10 overflow-hidden">

          {index <= currentStep &&
        <motion.div
          initial={{
            width: 0
          }}
          animate={{
            width: '100%'
          }}
          transition={{
            duration: 0.3
          }}
          className="h-full bg-accent" />

        }
        </div>
      )}
    </div>);

}