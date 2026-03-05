import React, { useCallback, useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { BrandLogo } from './BrandLogo';

interface SplashScreenProps {
  onComplete: () => void;
}

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
        >
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,rgba(255,255,255,0.08)_0%,rgba(255,255,255,0.02)_35%,rgba(5,5,5,1)_75%)]" />

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
            className="relative z-10 w-40 h-40 md:w-48 md:h-48 lg:w-52 lg:h-52"
          >
            <BrandLogo className="rounded-3xl bg-black/45 border border-white/20 p-3 md:p-4" imageClassName="object-contain" />
          </motion.div>

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
