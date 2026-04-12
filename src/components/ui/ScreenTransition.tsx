import React from 'react';
import { AnimatePresence, motion, useReducedMotion } from 'framer-motion';

type ScreenTransitionProps = {
  screenKey: string;
  direction?: number;
  className?: string;
  children: React.ReactNode;
};

type ScreenSectionProps = {
  children: React.ReactNode;
  index?: number;
  className?: string;
};

const SCREEN_EASE: [number, number, number, number] = [0.22, 1, 0.36, 1];
const SCREEN_EXIT_EASE: [number, number, number, number] = [0.4, 0, 1, 1];

export const getNavigationDirection = <T extends string>(
  nextKey: T,
  previousKey: T | null | undefined,
  orderedKeys: readonly T[],
) => {
  if (!previousKey || previousKey === nextKey) return 1;

  const nextIndex = orderedKeys.indexOf(nextKey);
  const previousIndex = orderedKeys.indexOf(previousKey);
  if (nextIndex === -1 || previousIndex === -1) return 1;
  return nextIndex >= previousIndex ? 1 : -1;
};

export function ScreenTransition({
  screenKey,
  direction = 1,
  className = '',
  children,
}: ScreenTransitionProps) {
  const prefersReducedMotion = useReducedMotion();

  return (
    <AnimatePresence initial={false} mode="wait">
      <motion.div
        key={screenKey}
        initial={
          prefersReducedMotion
            ? { opacity: 0 }
            : {
                opacity: 0,
                x: direction * 28,
                y: 10,
                scale: 0.992,
              }
        }
        animate={
          prefersReducedMotion
            ? { opacity: 1 }
            : {
                opacity: 1,
                x: 0,
                y: 0,
                scale: 1,
              }
        }
        exit={
          prefersReducedMotion
            ? { opacity: 0 }
            : {
                opacity: 0,
                x: direction * -18,
                y: -6,
                scale: 0.996,
              }
        }
        transition={
          prefersReducedMotion
            ? { duration: 0.16 }
            : {
                duration: 0.42,
                ease: SCREEN_EASE,
              }
        }
        className={`min-h-full transform-gpu will-change-transform ${className}`.trim()}
      >
        {children}
      </motion.div>
    </AnimatePresence>
  );
}

export function ScreenSection({
  children,
  index = 0,
  className = '',
}: ScreenSectionProps) {
  const prefersReducedMotion = useReducedMotion();

  return (
    <motion.div
      initial={
        prefersReducedMotion
          ? false
          : {
              opacity: 0,
              y: 18,
              scale: 0.988,
            }
      }
      animate={{
        opacity: 1,
        y: 0,
        scale: 1,
      }}
      transition={
        prefersReducedMotion
          ? { duration: 0.16 }
          : {
              duration: 0.5,
              delay: index * 0.06,
              ease: SCREEN_EXIT_EASE,
            }
      }
      className={`transform-gpu will-change-transform ${className}`.trim()}
    >
      {children}
    </motion.div>
  );
}
