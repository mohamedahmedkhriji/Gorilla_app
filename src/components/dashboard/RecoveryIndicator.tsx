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
    if (value >= 90) return 'Ready to train';
    if (value >= 70) return 'Almost ready';
    if (value >= 50) return 'Still recovering';
    return 'Needs more rest';
  };

  const getBarClass = (value: number) => {
    if (value >= 90) return 'bg-green-500';
    if (value >= 70) return 'bg-accent';
    if (value >= 50) return 'bg-orange-500';
    return 'bg-red-500';
  };

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
        delay: 0.2
      }}
      onClick={onClick}
      className={`bg-card rounded-2xl p-6 border border-white/5 ${onClick ? 'cursor-pointer hover:border-accent/20 transition-colors' : ''}`}>

      <div className="flex justify-between items-end mb-3">
        <div className="flex items-center gap-2">
          <BatteryCharging size={18} className="text-accent" />
          <span className="text-sm font-medium text-text-secondary">
            Recovery
          </span>
        </div>
        <span className="text-2xl font-bold text-text-primary">
          {safePercentage}%
        </span>
      </div>

      <div className="h-1.5 w-full bg-white/10 rounded-full overflow-hidden">
        <motion.div
          initial={{
            width: 0
          }}
          animate={{
            width: `${safePercentage}%`
          }}
          transition={{
            duration: 1,
            delay: 0.5,
            ease: 'easeOut'
          }}
          className={`h-full rounded-full shadow-glow ${getBarClass(safePercentage)}`} />

      </div>
      <p className="mt-2 text-xs text-text-tertiary">
        {getRecoveryStatus(safePercentage)}
      </p>
    </motion.div>);

}
