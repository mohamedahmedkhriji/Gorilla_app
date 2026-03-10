import React from 'react';
import { motion } from 'framer-motion';
import { getUserRankBadge } from '../../services/missions';
import { getRankBadgeImage, rankCardIcon } from '../../services/rankTheme';

interface RankDisplayProps {
  points?: number;
}

export function RankDisplay({ points = 420 }: RankDisplayProps) {
  const rankBadge = getUserRankBadge(points);
  const rankBadgeImage = getRankBadgeImage(rankBadge.name);

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
        delay: 0.4,
      }}
      className="surface-card rounded-2xl p-4 border border-accent/25 shadow-card"
    >
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3 min-w-0">
          <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-accent/30 to-info/25 flex items-center justify-center border border-accent/35 shrink-0">
            <img src={rankBadgeImage} alt={rankBadge.name} className="h-10 w-10 object-contain" />
          </div>
          <div className="min-w-0">
            <h4 className="text-2xl leading-none text-white truncate">{rankBadge.name}</h4>
            <p className="text-text-secondary text-xs uppercase tracking-[0.1em] mt-2">{points} points</p>
          </div>
        </div>
        <img src={rankCardIcon} alt="Rank icon" className="h-8 w-8 shrink-0 object-contain" />
      </div>
    </motion.div>
  );
}
