import React from 'react';
import { motion } from 'framer-motion';
import { getUserRankBadge } from '../../services/missions';
import { getRankBadgeImage, rankCardIcon } from '../../services/rankTheme';
import { emojiLevelUpBg } from '../../services/emojiTheme';
import { getActiveLanguage, getStoredLanguage, pickLanguage, repairMojibakeText } from '../../services/language';

interface RankDisplayProps {
  points?: number;
  coachmarkTargetId?: string;
}

const RANK_NAME_MAP = {
  en: {
    bronze: 'Bronze',
    silver: 'Silver',
    gold: 'Gold',
    platinum: 'Platinum',
    diamond: 'Diamond',
    elite: 'Elite',
  },
  ar: {
    bronze: 'برونزي',
    silver: 'فضي',
    gold: 'ذهبي',
    platinum: 'بلاتيني',
    diamond: 'ألماسي',
    elite: 'نخبوي',
  },
  it: {
    bronze: 'Bronzo',
    silver: 'Argento',
    gold: 'Oro',
    platinum: 'Platino',
    diamond: 'Diamante',
    elite: 'Elite',
  },
  de: {
    bronze: 'Bronze',
    silver: 'Silber',
    gold: 'Gold',
    platinum: 'Platin',
    diamond: 'Diamant',
    elite: 'Elite',
  },
} as const;

export function RankDisplay({ points = 420, coachmarkTargetId }: RankDisplayProps) {
  const language = getActiveLanguage(getStoredLanguage());
  const rankBadge = getUserRankBadge(points);
  const rankBadgeImage = getRankBadgeImage(rankBadge.name);
  const rankKey = String(rankBadge.name || '').trim().toLowerCase() as keyof typeof RANK_NAME_MAP.en;
  const rankNameDisplay = repairMojibakeText(RANK_NAME_MAP[language][rankKey] || rankBadge.name);
  const copy = pickLanguage(language, {
    en: {
      pointsLabel: `${points} points`,
      iconAlt: 'Rank icon',
    },
    ar: {
      pointsLabel: `${points} نقطة`,
      iconAlt: 'أيقونة الرتبة',
    },
    it: {
      pointsLabel: `${points} punti`,
      iconAlt: 'Icona grado',
    },
    de: {
      pointsLabel: `${points} Punkte`,
      iconAlt: 'Rangsymbol',
    },
  });

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
        delay: 0.4,
      }}
      className="surface-card relative overflow-hidden rounded-2xl p-4 border border-accent/25 shadow-card"
    >
      <div
        className="absolute inset-0 bg-cover bg-center opacity-60"
        style={{ backgroundImage: `url(${emojiLevelUpBg})` }}
        aria-hidden="true"
      />
      <div
        className="absolute inset-0 bg-gradient-to-r from-background/65 via-background/45 to-background/25"
        aria-hidden="true"
      />

      <div className="relative z-10 flex items-center justify-between">
        <div className="flex items-center gap-3 min-w-0">
          <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-accent/30 to-info/25 flex items-center justify-center border border-accent/35 shrink-0">
            <img src={rankBadgeImage} alt={rankNameDisplay} className="h-10 w-10 object-contain" />
          </div>
          <div className="min-w-0">
            <h4 className="text-2xl leading-none text-white truncate">{rankNameDisplay}</h4>
            <p className="text-text-secondary text-xs uppercase tracking-[0.1em] mt-2">{copy.pointsLabel}</p>
          </div>
        </div>
        <img src={rankCardIcon} alt={copy.iconAlt} className="h-8 w-8 shrink-0 object-contain" />
      </div>
    </motion.div>
  );
}
