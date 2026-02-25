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
  const radius = 80;
  const circumference = 2 * Math.PI * radius;
  const strokeDashoffset = circumference - progress / 100 * circumference;
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
        delay: 0.1
      }}
      className="bg-card rounded-3xl p-8 flex flex-col items-center justify-center relative overflow-hidden border border-white/5">

      {/* Circular Progress */}
      <div className="relative w-48 h-48 mb-6">
        {/* Background Circle */}
        <svg className="w-full h-full transform -rotate-90">
          <circle
            cx="96"
            cy="96"
            r={radius}
            stroke="rgba(255, 255, 255, 0.1)"
            strokeWidth="4"
            fill="transparent" />

          {/* Progress Circle */}
          <motion.circle
            cx="96"
            cy="96"
            r={radius}
            stroke="#BFFF00" // Neon Lime
            strokeWidth="4"
            fill="transparent"
            strokeDasharray={circumference}
            initial={{
              strokeDashoffset: circumference
            }}
            animate={{
              strokeDashoffset
            }}
            transition={{
              duration: 1.5,
              ease: 'easeOut'
            }}
            strokeLinecap="round"
            className="drop-shadow-[0_0_4px_rgba(191,255,0,0.5)]" />

        </svg>

        {/* Center Content */}
        <div className="absolute inset-0 flex flex-col items-center justify-center">
          <span className="text-4xl font-bold text-text-primary tracking-tight">
            {progress}%
          </span>
          <span className="text-xs text-text-tertiary uppercase tracking-wider mt-1 font-medium">
            {isRestDay ? 'Recovery' : 'Complete'}
          </span>
        </div>
      </div>

      {/* Workout Info */}
      <div className="text-center">
        <h3 className="text-xl font-bold text-text-primary mb-1">{title}</h3>
        <p className="text-text-secondary text-sm">{duration || (isRestDay ? 'Recovery day' : '')}</p>
      </div>

      {/* Subtle Play Icon Overlay */}
      {!isRestDay && (
      <div className="absolute top-6 right-6">
        <div className="w-8 h-8 rounded-full bg-white/5 flex items-center justify-center hover:bg-white/10 transition-colors">
          <Play size={12} className="text-accent ml-0.5 fill-accent" />
        </div>
      </div>
      )}
    </motion.div>);

}
