import React from 'react';
import { motion } from 'framer-motion';
import { Play } from 'lucide-react';

interface WorkoutCardProps {
  title: string;
  duration: string;
  progress: number;
  isRestDay?: boolean;
}

export function WorkoutCard({ title, duration, progress, isRestDay = false }: WorkoutCardProps) {
  const safeProgress = Math.max(0, Math.min(100, progress));
  const radius = 72;
  const circumference = 2 * Math.PI * radius;
  const strokeDashoffset = circumference - (safeProgress / 100) * circumference;

  return (
    <motion.div
      initial={{
        opacity: 0,
        y: 20,
      }}
      animate={{
        opacity: 1,
        y: 0,
      }}
      transition={{
        duration: 0.5,
        delay: 0.1,
      }}
      className="surface-card rounded-2xl p-6 flex flex-col items-center justify-center relative overflow-hidden border border-white/12"
    >
      <div className="relative w-44 h-44 mb-4">
        <svg className="w-full h-full -rotate-90" viewBox="0 0 176 176">
          <circle cx="88" cy="88" r={radius} stroke="rgb(var(--color-border) / 0.55)" strokeWidth="8" fill="transparent" />

          <motion.circle
            cx="88"
            cy="88"
            r={radius}
            stroke="rgb(var(--color-accent))"
            strokeWidth="8"
            fill="transparent"
            strokeDasharray={circumference}
            initial={{
              strokeDashoffset: circumference,
            }}
            animate={{
              strokeDashoffset,
            }}
            transition={{
              duration: 1.3,
              ease: 'easeOut',
            }}
            strokeLinecap="round"
            className="drop-shadow-[0_0_8px_rgba(187,255,92,0.2)]"
          />
        </svg>

        <div className="absolute inset-0 flex flex-col items-center justify-center">
          <span className="text-4xl text-text-primary leading-none">{safeProgress}%</span>
          <span className="text-[10px] text-text-tertiary uppercase tracking-[0.16em] mt-2 font-semibold">
            {isRestDay ? 'Recovery' : 'Complete'}
          </span>
        </div>
      </div>

      <div className="text-center relative z-10">
        <h3 className="text-xl font-semibold text-text-primary">{title}</h3>
        <p className="text-text-secondary text-sm mt-1">
          {duration || (isRestDay ? 'Recovery Day' : '')}
        </p>
      </div>

      {!isRestDay && (
        <div className="absolute top-4 right-4 flex items-center gap-1 rounded-full bg-black/20 border border-white/10 px-2.5 py-1.5 text-[10px] text-text-secondary">
          Start
          <Play size={11} className="text-accent fill-accent" />
        </div>
      )}
    </motion.div>
  );
}
