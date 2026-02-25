import React, { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
interface SplashScreenProps {
  onComplete: () => void;
}
export function SplashScreen({ onComplete }: SplashScreenProps) {
  const [isVisible, setIsVisible] = useState(true);
  useEffect(() => {
    // Fallback timeout in case video doesn't load or is short
    const timer = setTimeout(() => {
      setIsVisible(false);
      setTimeout(onComplete, 500); // Wait for exit animation
    }, 4000);
    return () => clearTimeout(timer);
  }, [onComplete]);
  return (
    <AnimatePresence>
      {isVisible &&
      <motion.div
        initial={{
          opacity: 1
        }}
        exit={{
          opacity: 0
        }}
        transition={{
          duration: 0.5
        }}
        className="fixed inset-0 z-[100] bg-black flex items-center justify-center overflow-hidden">

          <video
          autoPlay
          muted
          playsInline
          className="w-full h-full object-cover"
          onEnded={() => {
            setIsVisible(false);
            setTimeout(onComplete, 500);
          }}>
            <source src="/body part/loading.mp4" type="video/mp4" />
          </video>

          {/* Overlay gradient */}
          <div className="absolute inset-0 bg-gradient-to-t from-black/50 via-transparent to-transparent" />

          <motion.div
          initial={{
            opacity: 0,
            y: 20
          }}
          animate={{
            opacity: 1,
            y: 0
          }}
          transition={{
            delay: 0.5
          }}
          className="absolute bottom-12 left-0 right-0 text-center">

            <h1 className="text-4xl font-black italic text-white tracking-tighter">
              GORILLA
            </h1>
            <p className="text-black text-sm font-black tracking-widest uppercase mt-1">
              Train Smart. Train Strong.
            </p>
          </motion.div>
        </motion.div>
      }
    </AnimatePresence>);

}