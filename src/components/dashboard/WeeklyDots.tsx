import React from 'react';
import { motion } from 'framer-motion';
export function WeeklyDots() {
  const days = ['M', 'T', 'W', 'T', 'F', 'S', 'S'];
  const completed = [true, true, true, true, false, false, false]; // Mon-Thu completed
  return (
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
        duration: 0.5,
        delay: 0.3
      }}
      className="bg-card rounded-2xl p-6 flex justify-between items-center border border-white/5">

      {days.map((day, index) =>
      <div key={index} className="flex flex-col items-center gap-3">
          <motion.div
          initial={{
            scale: 0
          }}
          animate={{
            scale: 1
          }}
          transition={{
            delay: 0.4 + index * 0.1,
            type: 'spring',
            stiffness: 200
          }}
          className={`
              w-3 h-3 rounded-full
              ${completed[index] ? 'bg-accent shadow-glow' : 'border border-white/20 bg-transparent'}
            `} />

          <span className="text-[10px] text-text-tertiary font-medium">
            {day}
          </span>
        </div>
      )}
    </motion.div>);

}