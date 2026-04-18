import React from 'react';
import { motion } from 'framer-motion';
import { getUserRankBadge } from '../../services/missions';
import { getRankBadgeImage } from '../../services/rankTheme';
import { HOME_CARD_HOVER_CLASS, HOME_CARD_OVERLAY_CLASS, HOME_CARD_TITLE_CLASS } from '../home/homeCardStyles';
import { getActiveLanguage, getStoredLanguage, pickLanguage, repairMojibakeText } from '../../services/language';
import type { GamificationRankProgress, GamificationStreakRisk } from '../../types/gamification';

interface RankDisplayProps {
  points?: number;
  coachmarkTargetId?: string;
  rankProgress?: GamificationRankProgress | null;
  streakRisk?: GamificationStreakRisk | null;
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
  fr: {
    bronze: 'Bronze',
    silver: 'Argent',
    gold: 'Or',
    platinum: 'Platine',
    diamond: 'Diamant',
    elite: 'Elite',
  },
} as const;

export function RankDisplay({
  points = 420,
  coachmarkTargetId,
  rankProgress = null,
  streakRisk = null,
}: RankDisplayProps) {
  const language = getActiveLanguage(getStoredLanguage());
  const totalPoints = Number(rankProgress?.totalPoints || points || 0);
  const rankBadge = getUserRankBadge(totalPoints);
  const rankBadgeImage = getRankBadgeImage(rankBadge.name);
  const rankKey = String(rankBadge.name || '').trim().toLowerCase() as keyof typeof RANK_NAME_MAP.en;
  const rankNameDisplay = repairMojibakeText((RANK_NAME_MAP[language] || RANK_NAME_MAP.en)[rankKey] || rankBadge.name);
  const copy = pickLanguage(language, {
    en: {
      pointsLabel: `${totalPoints} points`,
      iconAlt: 'Rank icon',
      progressLabel: rankProgress?.next ? `${Math.max(0, Number(rankProgress.pointsToNext || 0))} pts to ${rankProgress.next}` : 'Top rank achieved',
      pressureLabel: streakRisk?.active ? streakRisk.title : 'Rank momentum',
    },
    ar: {
      pointsLabel: `${totalPoints} نقطة`,
      iconAlt: 'أيقونة الرتبة',
      progressLabel: rankProgress?.next ? `${Math.max(0, Number(rankProgress.pointsToNext || 0))} نقطة إلى ${rankProgress.next}` : 'أعلى رتبة',
      pressureLabel: streakRisk?.active ? streakRisk.title : 'زخم الرتبة',
    },
    it: {
      pointsLabel: `${totalPoints} punti`,
      iconAlt: 'Icona grado',
      progressLabel: rankProgress?.next ? `${Math.max(0, Number(rankProgress.pointsToNext || 0))} pt a ${rankProgress.next}` : 'Grado massimo raggiunto',
      pressureLabel: streakRisk?.active ? streakRisk.title : 'Slancio del grado',
    },
    de: {
      pointsLabel: `${totalPoints} Punkte`,
      iconAlt: 'Rangsymbol',
      progressLabel: rankProgress?.next ? `${Math.max(0, Number(rankProgress.pointsToNext || 0))} Pkt bis ${rankProgress.next}` : 'Hoechster Rang erreicht',
      pressureLabel: streakRisk?.active ? streakRisk.title : 'Rang-Momentum',
    },
    fr: {
      pointsLabel: `${totalPoints} points`,
      iconAlt: 'Icone de rang',
      progressLabel: rankProgress?.next ? `${Math.max(0, Number(rankProgress.pointsToNext || 0))} pts vers ${rankProgress.next}` : 'Rang maximal atteint',
      pressureLabel: streakRisk?.active ? streakRisk.title : 'Elan du rang',
    },
  });

  return (
    <motion.div
      data-coachmark-target={coachmarkTargetId}
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5, delay: 0.4 }}
      whileHover={{ y: -2 }}
      className={`surface-card relative overflow-hidden rounded-2xl border border-accent/25 p-4 shadow-card ${HOME_CARD_HOVER_CLASS}`}
    >
      <div className={HOME_CARD_OVERLAY_CLASS} aria-hidden="true" />

      <div className="relative z-10 space-y-4">
        <div className="grid grid-cols-[auto_minmax(0,1fr)] items-center gap-3">
          <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl border border-accent/35 bg-gradient-to-br from-accent/30 to-info/25">
            <img src={rankBadgeImage} alt={rankNameDisplay} className="h-10 w-10 object-contain" />
          </div>
          <div className="min-w-0 flex items-center justify-center gap-3 text-center">
            <h4 className={HOME_CARD_TITLE_CLASS}>{rankNameDisplay}</h4>
            <p className="shrink-0 font-electrolize text-[1.35rem] leading-none text-text-primary">{copy.pointsLabel}</p>
          </div>
        </div>

        <div className="space-y-2">
          <div className="flex items-center justify-between gap-3 text-[11px] uppercase tracking-[0.14em] text-text-tertiary">
            <span>{copy.progressLabel}</span>
            <span>{Math.round(Number(rankProgress?.progressPercent || 0))}%</span>
          </div>
          <div className="h-2.5 overflow-hidden rounded-full border border-white/10 bg-white/[0.04] p-[2px]">
            <div
              className="h-full rounded-full bg-[linear-gradient(90deg,rgba(191,255,0,0.7),rgba(235,255,140,0.95))] shadow-[0_0_18px_rgba(191,255,0,0.18)] transition-[width] duration-700 ease-out"
              style={{ width: `${Math.max(8, Number(rankProgress?.progressPercent || 0))}%` }}
            />
          </div>
          <div className="text-xs text-text-secondary">{copy.pressureLabel}</div>
        </div>
      </div>
    </motion.div>
  );
}
