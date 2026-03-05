import React from 'react';
import { motion } from 'framer-motion';
import { BatteryCharging } from 'lucide-react';

interface RecoveryIndicatorProps {
  percentage: number;
  onClick?: () => void;
}

export function RecoveryIndicator({ percentage, onClick }: RecoveryIndicatorProps) {
  const safePercentage = Math.max(0, Math.min(100, Math.round(percentage)));

  const getRecoveryStatus = (value: number) => {
    if (value >= 90) return 'Ready to train hard';
    if (value >= 70) return 'Solid recovery';
    if (value >= 50) return 'Moderate fatigue';
    return 'Recovery needed';
  };

  const getBarClass = (value: number) => {
    if (value >= 90) return 'from-success to-accent';
    if (value >= 70) return 'from-accent to-info';
    if (value >= 50) return 'from-orange-400 to-yellow-300';
    return 'from-red-500 to-orange-400';
  };

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
        delay: 0.2,
      }}
      onClick={onClick}
      className={`surface-card rounded-2xl p-5 border border-white/15 ${onClick ? 'cursor-pointer hover:border-accent/30 transition-colors' : ''}`}
    >
      <div className="flex justify-between items-start mb-4">
        <div className="flex items-center gap-2">
          <div className="w-9 h-9 rounded-xl bg-accent/12 border border-accent/30 flex items-center justify-center">
            <BatteryCharging size={17} className="text-accent" />
          </div>
          <div>
            <span className="text-[11px] font-semibold uppercase tracking-[0.12em] text-text-secondary">Recovery</span>
            <p className="text-xs text-text-tertiary mt-1">{getRecoveryStatus(safePercentage)}</p>
          </div>
        </div>
        <span className="text-3xl leading-none text-text-primary">{safePercentage}%</span>
      </div>

      <div className="h-2 w-full bg-white/10 rounded-full overflow-hidden border border-white/10">
        <div
          style={{ width: `${safePercentage}%` }}
          className={`h-full rounded-full bg-gradient-to-r ${getBarClass(safePercentage)}`}
        />
      </div>
    </motion.div>
  );
}
