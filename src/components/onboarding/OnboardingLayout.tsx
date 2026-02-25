import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { ProgressSteps } from '../ui/ProgressSteps';
import { ArrowLeft } from 'lucide-react';
interface OnboardingLayoutProps {
  children: React.ReactNode;
  currentStep: number;
  totalSteps: number;
  onBack?: () => void;
  title?: string;
  showBack?: boolean;
}
export function OnboardingLayout({
  children,
  currentStep,
  totalSteps,
  onBack,
  title,
  showBack = true
}: OnboardingLayoutProps) {
  return (
    <div className="min-h-screen bg-background text-text-primary p-6 flex flex-col max-w-md mx-auto">
      {/* Header */}
      <div className="flex items-center h-12 mb-4 relative">
        {showBack && onBack &&
        <button
          onClick={onBack}
          className="absolute left-0 p-2 -ml-2 text-text-secondary hover:text-text-primary transition-colors">

            <ArrowLeft size={24} />
          </button>
        }
        {title &&
        <h1 className="w-full text-center text-lg font-medium">{title}</h1>
        }
      </div>

      <ProgressSteps currentStep={currentStep} totalSteps={totalSteps} />

      <AnimatePresence mode="wait">
        <motion.div
          key={currentStep}
          initial={{
            opacity: 0,
            x: 20
          }}
          animate={{
            opacity: 1,
            x: 0
          }}
          exit={{
            opacity: 0,
            x: -20
          }}
          transition={{
            duration: 0.3
          }}
          className="flex-1 flex flex-col">

          {children}
        </motion.div>
      </AnimatePresence>
    </div>);

}