import React from 'react';
import { motion } from 'framer-motion';
import { emojiMuscleRecovery, emojiRecoveryBg } from '../../services/emojiTheme';
import { getActiveLanguage, getStoredLanguage, pickLanguage } from '../../services/language';

interface RecoveryIndicatorProps {
  percentage: number;
  onClick?: () => void;
  coachmarkTargetId?: string;
}

export function RecoveryIndicator({ percentage, onClick, coachmarkTargetId }: RecoveryIndicatorProps) {
  const safePercentage = Math.max(0, Math.min(100, Math.round(percentage)));
  const language = getActiveLanguage(getStoredLanguage());
  const copy = pickLanguage(language, {
    en: {
      title: 'Recovery',
      statuses: {
        high: 'Ready to train hard',
        solid: 'Solid recovery',
        moderate: 'Moderate fatigue',
        low: 'Recovery needed',
      },
      alt: 'Muscle Recovery',
    },
    ar: {
      title: 'التعافي',
      statuses: {
        high: 'جاهز للتدريب بقوة',
        solid: 'تعافٍ جيد',
        moderate: 'إرهاق متوسط',
        low: 'تحتاج لتعافٍ',
      },
      alt: 'تعافي العضلات',
    },
    it: {
      title: 'Recupero',
      statuses: {
        high: 'Pronto a spingere forte',
        solid: 'Recupero solido',
        moderate: 'Fatica moderata',
        low: 'Serve recupero',
      },
      alt: 'Recupero muscolare',
    },
    de: {
      title: 'Erholung',
      statuses: {
        high: 'Bereit fur hartes Training',
        solid: 'Solide Erholung',
        moderate: 'Mittlere Ermudung',
        low: 'Mehr Erholung notig',
      },
      alt: 'Muskel-Erholung',
    },
    fr: {
      title: 'Recuperation',
      statuses: {
        high: 'Pret a t entrainer fort',
        solid: 'Recuperation solide',
        moderate: 'Fatigue moderee',
        low: 'Recuperation necessaire',
      },
      alt: 'Recuperation musculaire',
    },
  });

  const getBarClass = (value: number) => {
    if (value >= 90) return 'from-success to-accent';
    if (value >= 70) return 'from-accent to-info';
    if (value >= 50) return 'from-orange-400 to-yellow-300';
    return 'from-red-500 to-orange-400';
  };

  return (
    <motion.div
      data-coachmark-target={coachmarkTargetId}
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
      whileHover={onClick ? { y: -4 } : undefined}
      onClick={onClick}
      className={`surface-card relative overflow-hidden rounded-2xl p-5 border border-white/15 shadow-card transition-all duration-300 hover:shadow-[0_12px_32px_rgba(0,0,0,0.45),0_0_14px_rgba(191,255,0,0.07)] ${onClick ? 'cursor-pointer hover:border-accent/30' : ''}`}
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
      <div
        className="absolute inset-0 bg-[linear-gradient(180deg,rgba(255,255,255,0.05),transparent)] pointer-events-none"
        aria-hidden="true"
      />

      <div className="relative z-10 grid grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-3 mb-4">
        <div className="flex items-center justify-center">
          <div className="w-10 h-10 rounded-xl bg-accent/12 border border-accent/30 p-1.5 flex items-center justify-center">
            <img src={emojiMuscleRecovery} alt={copy.alt} className="h-6 w-6 object-contain" />
          </div>
        </div>
        <div className="flex items-center justify-center text-center">
          <span className="text-[1.05rem] font-electrolize font-extrabold uppercase tracking-[0.16em] text-text-primary">{copy.title}</span>
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
