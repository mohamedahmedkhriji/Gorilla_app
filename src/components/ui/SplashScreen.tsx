import React, { useCallback, useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { BrandLogo } from './BrandLogo';

interface SplashScreenProps {
  onComplete: () => void;
}

const forcedDarkThemeVars: React.CSSProperties = {
  '--color-accent': '187 255 92',
  '--color-accent-dark': '187 255 92',
  '--color-background': '9 14 23',
  '--color-background-secondary': '16 24 36',
  '--color-card': '20 32 46',
  '--color-border': '134 161 189',
  '--color-text-primary': '243 248 255',
  '--color-text-secondary': '175 192 213',
  '--color-text-tertiary': '131 149 171',
} as React.CSSProperties;

export function SplashScreen({ onComplete }: SplashScreenProps) {
  const [isVisible, setIsVisible] = useState(true);
  const closeSplash = useCallback(() => {
    setIsVisible((prev) => (prev ? false : prev));
  }, []);

  useEffect(() => {
    const fallbackTimer = window.setTimeout(closeSplash, 8000);
    return () => window.clearTimeout(fallbackTimer);
  }, [closeSplash]);

  useEffect(() => {
    if (!isVisible) {
      const exitTimer = window.setTimeout(onComplete, 500);
      return () => window.clearTimeout(exitTimer);
    }
    return;
  }, [isVisible, onComplete]);

  return (
    <AnimatePresence>
      {isVisible && (
        <motion.div
          initial={{
            opacity: 1,
          }}
          exit={{
            opacity: 0,
          }}
          transition={{
            duration: 0.5,
          }}
          className="fixed inset-0 z-[100] bg-[#050505] flex items-center justify-center overflow-hidden"
          style={forcedDarkThemeVars}
        >
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,rgba(255,255,255,0.08)_0%,rgba(255,255,255,0.02)_35%,rgba(5,5,5,1)_75%)]" />

          <div className="relative z-10 flex flex-col items-center">
            <motion.div
              initial={{
                opacity: 0,
                scale: 0.94,
              }}
              animate={{
                opacity: 1,
                scale: 1,
              }}
              transition={{
                duration: 0.45,
                delay: 0.1,
              }}
              className="w-[10.5rem] h-[10.5rem] md:w-[12.5rem] md:h-[12.5rem] lg:w-56 lg:h-56"
            >
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
                  delay: 0.55,
                }}
                className="w-full h-full"
              >
                <BrandLogo
                  className="w-full h-full rounded-3xl bg-black/45 border border-white/10 p-1.5 md:p-2.5"
                  imageClassName="object-contain scale-[1.16]"
                />
              </motion.div>
            </motion.div>

            <motion.h1
              initial={{
                opacity: 0,
                y: 10,
              }}
              animate={{
                opacity: 1,
                y: 0,
              }}
              transition={{
                duration: 0.35,
                delay: 0.2,
              }}
              className="mt-6 font-brand text-[2.7rem] md:text-[3.1rem] leading-[0.95] text-white tracking-[0.01em]"
            >
              RepSet
            </motion.h1>
          </div>

          <motion.p
            initial={{
              opacity: 0,
              y: 14,
            }}
            animate={{
              opacity: 1,
              y: 0,
            }}
            transition={{
              delay: 0.2,
            }}
            className="absolute z-10 bottom-12 left-0 right-0 text-center text-white/90 text-sm md:text-base font-semibold tracking-[0.35em] uppercase"
          >
            Train Smart Train Strong.
          </motion.p>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
