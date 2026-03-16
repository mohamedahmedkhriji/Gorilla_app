import React from 'react';
import { motion } from 'framer-motion';
import { emojiMuscleRecovery, emojiRecoveryBg } from '../../services/emojiTheme';
import { getActiveLanguage, getStoredLanguage } from '../../services/language';

interface RecoveryIndicatorProps {
  percentage: number;
  onClick?: () => void;
}

export function RecoveryIndicator({ percentage, onClick }: RecoveryIndicatorProps) {
  const safePercentage = Math.max(0, Math.min(100, Math.round(percentage)));
  const isArabic = getActiveLanguage(getStoredLanguage()) === 'ar';
  const copy = {
    title: isArabic ? 'التعافي' : 'Recovery',
    statuses: {
      high: isArabic ? 'جاهز للتدريب بقوة' : 'Ready to train hard',
      solid: isArabic ? 'تعافٍ جيد' : 'Solid recovery',
      moderate: isArabic ? 'إرهاق متوسط' : 'Moderate fatigue',
      low: isArabic ? 'تحتاج لتعافٍ' : 'Recovery needed',
    },
    alt: isArabic ? 'تعافي العضلات' : 'Muscle Recovery',
  };

  const getRecoveryStatus = (value: number) => {
    if (value >= 90) return copy.statuses.high;
    if (value >= 70) return copy.statuses.solid;
    if (value >= 50) return copy.statuses.moderate;
    return copy.statuses.low;
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
      className={`surface-card relative overflow-hidden rounded-2xl p-5 border border-white/15 ${onClick ? 'cursor-pointer hover:border-accent/30 transition-colors' : ''}`}
    >
      <div
        className="absolute inset-0 bg-cover bg-center opacity-60"
        style={{ backgroundImage: `url(${emojiRecoveryBg})` }}
        aria-hidden="true"
      />
      <div
        className="absolute inset-0 bg-gradient-to-r from-background/65 via-background/45 to-background/25"
        aria-hidden="true"
      />

      <div className="relative z-10 flex justify-between items-start mb-4">
        <div className="flex items-center gap-2">
          <div className="w-10 h-10 rounded-xl bg-accent/12 border border-accent/30 p-1.5 flex items-center justify-center">
            <img src={emojiMuscleRecovery} alt={copy.alt} className="h-6 w-6 object-contain" />
          </div>
          <div>
            <span className="text-[15px] font-electrolize font-extrabold uppercase tracking-[0.14em] text-text-primary">{copy.title}</span>
            <p className="text-sm font-semibold text-text-tertiary mt-1">{getRecoveryStatus(safePercentage)}</p>
          </div>
        </div>
        <span className="text-3xl leading-none text-text-primary font-electrolize">{safePercentage}%</span>
      </div>

      <div className="relative z-10 h-2 w-full bg-white/10 rounded-full overflow-hidden border border-white/10">
        <div
          style={{ width: `${safePercentage}%` }}
          className={`h-full rounded-full bg-gradient-to-r ${getBarClass(safePercentage)}`}
        />
      </div>
    </motion.div>
  );
}
