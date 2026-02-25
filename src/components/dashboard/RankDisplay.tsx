import React from 'react';
import { motion } from 'framer-motion';
import { Trophy } from 'lucide-react';
import { getUserRankBadge } from '../../services/missions';

interface RankDisplayProps {
  points?: number;
}

export function RankDisplay({ points = 420 }: RankDisplayProps) {
  const rankBadge = getUserRankBadge(points);
  
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
        delay: 0.4
      }}
      className="bg-card rounded-2xl p-4 border border-accent/30 shadow-lg">

      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 rounded-full bg-accent/10 flex items-center justify-center border-2 border-accent/30">
            <span className="text-2xl">{rankBadge.emoji}</span>
          </div>
          <div>
            <h4 className="text-white text-base font-bold">{rankBadge.name}</h4>
            <p className="text-text-secondary text-xs">{points} points</p>
          </div>
        </div>
        <Trophy size={20} className="text-accent" />
      </div>
    </motion.div>);

}