import React, { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { Play, Pause, SkipForward, Lock } from 'lucide-react';
interface RestTimerProps {
  duration: number; // seconds
  onComplete: () => void;
}
export function RestTimer({ duration, onComplete }: RestTimerProps) {
  const [timeLeft, setTimeLeft] = useState(duration);
  const [isActive, setIsActive] = useState(true);
  useEffect(() => {
    let interval: any = null;
    if (isActive && timeLeft > 0) {
      interval = setInterval(() => {
        setTimeLeft((t) => t - 1);
      }, 1000);
    } else if (timeLeft === 0) {
      onComplete();
    }
    return () => clearInterval(interval);
  }, [isActive, timeLeft, onComplete]);
  const progress = (duration - timeLeft) / duration * 100;
  const radius = 36;
  const circumference = 2 * Math.PI * radius;
  const strokeDashoffset = circumference - progress / 100 * circumference;
  return (
    <div className="flex items-center justify-between bg-card rounded-2xl p-4 border border-white/5">
      <div className="flex items-center gap-4">
        <div className="relative w-20 h-20 flex items-center justify-center">
          <svg className="w-full h-full transform -rotate-90">
            <circle
              cx="40"
              cy="40"
              r={radius}
              stroke="rgba(255,255,255,0.1)"
              strokeWidth="4"
              fill="transparent" />

            <motion.circle
              cx="40"
              cy="40"
              r={radius}
              stroke="#10b981"
              strokeWidth="4"
              fill="transparent"
              strokeDasharray={circumference}
              animate={{
                strokeDashoffset
              }}
              strokeLinecap="round" />

          </svg>
          <span className="absolute text-xl font-bold text-white">
            {timeLeft}s
          </span>
        </div>
        <div>
          <div className="text-sm font-medium text-white">Rest Period</div>
          <div className="text-xs text-text-secondary flex items-center gap-1 mt-1">
            <Lock size={10} className="text-accent" />
            Next exercise locked
          </div>
        </div>
      </div>

      <div className="flex gap-2">
        <button
          onClick={() => setIsActive(!isActive)}
          className="w-10 h-10 rounded-full bg-white/10 flex items-center justify-center text-white hover:bg-white/20 transition-colors">

          {isActive ? <Pause size={18} /> : <Play size={18} />}
        </button>
        <button
          onClick={onComplete}
          className="w-10 h-10 rounded-full bg-white/10 flex items-center justify-center text-white hover:bg-white/20 transition-colors">

          <SkipForward size={18} />
        </button>
      </div>
    </div>);

}

