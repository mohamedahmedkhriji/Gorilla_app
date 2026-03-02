import React, { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import logoImage from '../../../assets/logo.png';

interface SplashScreenProps {
  onComplete: () => void;
}

export function SplashScreen({ onComplete }: SplashScreenProps) {
  const [isVisible, setIsVisible] = useState(true);

  useEffect(() => {
    const timer = setTimeout(() => {
      setIsVisible(false);
    }, 4000);
    return () => clearTimeout(timer);
  }, []);

  useEffect(() => {
    if (!isVisible) {
      const exitTimer = setTimeout(onComplete, 500);
      return () => clearTimeout(exitTimer);
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
          <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,rgba(170,241,238,0.92)_0%,rgba(145,219,214,0.72)_17%,rgba(109,183,180,0.9)_35%,rgba(61,132,130,0.98)_68%,rgba(16,83,82,1)_100%)]" />

          <motion.div
            animate={{
              scale: [1, 1.08, 1, 1.12, 1],
              opacity: [0.98, 1, 0.99, 1, 0.98],
            }}
            transition={{
              duration: 1.2,
              repeat: Infinity,
              ease: 'easeInOut',
            }}
            className="relative w-52 h-52 md:w-60 md:h-60"
          >
            <div className="absolute inset-0 rounded-full bg-[rgba(151,215,214,0.28)] blur-3xl" />
            <img src={logoImage} alt="RepSet Logo" className="relative w-full h-full object-contain drop-shadow-[0_0_24px_rgba(151,215,214,0.45)]" />
          </motion.div>

          <motion.h1
            initial={{
              opacity: 0,
              y: 12,
            }}
            animate={{
              opacity: 1,
              y: 0,
            }}
            transition={{
              delay: 0.16,
              duration: 0.45,
            }}
            className="mt-5 text-center text-white text-[2rem] md:text-[2.45rem] font-black tracking-[0.08em] leading-none drop-shadow-[0_2px_12px_rgba(10,45,44,0.55)]"
          >
            RepSet
          </motion.h1>

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
            className="absolute bottom-12 left-0 right-0 text-center text-accent text-xs font-semibold tracking-[0.35em] uppercase"
          >
            Train Smart. Train Strong.
          </motion.p>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
