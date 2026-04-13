import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { ProgressSteps } from '../ui/ProgressSteps';
import { ArrowLeft } from 'lucide-react';
import { useScrollToTopOnChange } from '../../shared/scroll';
import { getActiveLanguage, getStoredLanguage } from '../../services/language';

interface OnboardingLayoutProps {
  children: React.ReactNode;
  currentStep: number;
  totalSteps: number;
  onBack?: () => void;
  title?: string;
  showBack?: boolean;
  showHeader?: boolean;
  showProgress?: boolean;
}

export function OnboardingLayout({
  children,
  currentStep,
  totalSteps,
  onBack,
  title,
  showBack = true,
  showHeader = true,
  showProgress = true,
}: OnboardingLayoutProps) {
  useScrollToTopOnChange([currentStep]);
  const language = getActiveLanguage(getStoredLanguage());
  const isArabic = language === 'ar';

  return (
    <div dir={isArabic ? 'rtl' : 'ltr'} className="min-h-screen px-4 py-6 sm:px-6 relative overflow-hidden">
      <div className="pointer-events-none absolute -top-20 -right-16 h-56 w-56 rounded-full blur-3xl bg-info/25" />
      <div className="pointer-events-none absolute -bottom-24 -left-12 h-64 w-64 rounded-full blur-3xl bg-accent/20" />

      <div className="relative min-h-[calc(100vh-3rem)] px-2 py-1 sm:px-4 flex flex-col">
        {showHeader && (
          <div className="flex items-center h-12 mb-4 relative">
            {showBack && onBack && (
              <button
                onClick={onBack}
                className={`absolute ${isArabic ? 'right-0' : 'left-0'} w-10 h-10 rounded-xl surface-glass flex items-center justify-center text-text-secondary hover:text-text-primary transition-colors`}
              >
                <ArrowLeft size={18} className={isArabic ? 'rotate-180' : ''} />
              </button>
            )}

            {title && <h1 className="w-full text-center text-xl text-text-primary font-electrolize">{title}</h1>}
          </div>
        )}

        {showProgress && <ProgressSteps currentStep={currentStep} totalSteps={totalSteps} />}

        <AnimatePresence mode="wait">
          <motion.div
            key={currentStep}
            initial={{
              opacity: 0,
              x: isArabic ? -20 : 20,
            }}
            animate={{
              opacity: 1,
              x: 0,
            }}
            exit={{
              opacity: 0,
              x: isArabic ? 20 : -20,
            }}
            transition={{
              duration: 0.3,
            }}
            className="flex-1 flex flex-col"
          >
            {children}
          </motion.div>
        </AnimatePresence>
      </div>
    </div>
  );
}
