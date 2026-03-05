import React, { useCallback, useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import introVideo from '../../../assets/intro.mp4';
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
          className="fixed inset-0 z-[100] bg-black flex items-center justify-center overflow-hidden"
        >
          <video
            autoPlay
            muted
            playsInline
            preload="auto"
            onEnded={closeSplash}
            onError={closeSplash}
            className="absolute inset-0 h-full w-full object-cover"
          >
            <source src={introVideo} type="video/mp4" />
          </video>

          <div className="absolute inset-0 bg-black/25" />

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
            className="relative z-10 w-28 h-28 md:w-20 md:h-20 lg:w-16 lg:h-16"
          >
            <BrandLogo className="rounded-2xl bg-black/35 border border-white/20 p-2" imageClassName="object-contain" />
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
