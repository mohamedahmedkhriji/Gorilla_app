import React from 'react';
import { BellRing, Crown, Flame, Sparkles, Swords, Target, Trophy, Zap } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import type {
  GamificationDelta,
  GamificationNextAction,
  GamificationNotificationTrigger,
  GamificationReward,
  GamificationSummaryInsight,
} from '../../types/gamification';

const accentClassMap: Record<string, string> = {
  accent: 'text-accent border-accent/25 bg-accent/10',
  emerald: 'text-emerald-200 border-emerald-400/25 bg-emerald-500/10',
  sky: 'text-sky-200 border-sky-400/25 bg-sky-500/10',
  violet: 'text-violet-200 border-violet-400/25 bg-violet-500/10',
  amber: 'text-amber-200 border-amber-400/25 bg-amber-500/10',
};

const getActionIcon = (reasonCode?: string | null) => {
  switch (reasonCode) {
    case 'save_streak':
      return Flame;
    case 'rank_up_close':
      return Crown;
    case 'beat_next_player':
      return Swords;
    case 'high_recovery_opportunity':
      return Sparkles;
    case 'complete_daily_mission':
      return Target;
    default:
      return Zap;
  }
};

const getTriggerIcon = (type?: string | null) => {
  switch (type) {
    case 'streak_risk':
      return Flame;
    case 'rank_almost_reached':
      return Crown;
    case 'rivalry_pressure':
      return Swords;
    case 'weekly_summary':
      return Trophy;
    default:
      return BellRing;
  }
};

const getInsightToneClass = (tone?: string | null) => {
  if (tone === 'positive' || tone === 'good') return 'border-emerald-400/20 bg-emerald-500/10 text-emerald-100';
  if (tone === 'warning' || tone === 'watch') return 'border-amber-400/20 bg-amber-500/10 text-amber-100';
  if (tone === 'alert') return 'border-rose-400/20 bg-rose-500/10 text-rose-100';
  return 'border-white/10 bg-white/[0.04] text-text-primary';
};

interface NextActionCardProps {
  action: GamificationNextAction | null | undefined;
  eyebrow?: string;
  compact?: boolean;
  onClick?: () => void;
}

export function NextActionCard({ action, eyebrow = 'Next step', compact = false, onClick }: NextActionCardProps) {
  if (!action) return null;
  const Icon = getActionIcon(action.reasonCode);
  const accentClass = accentClassMap[action.accent || 'accent'] || accentClassMap.accent;
  const Wrapper = onClick ? motion.button : motion.div;

  return (
    <Wrapper
      {...(onClick ? { type: 'button', onClick } : {})}
      whileHover={{ scale: 1.01 }}
      {...(onClick ? { whileTap: { scale: 0.99 } } : {})}
      className={`group relative w-full overflow-hidden rounded-[1.6rem] border border-white/10 bg-card/75 text-left shadow-[0_16px_40px_rgba(0,0,0,0.22)] transition-all duration-300 ${compact ? 'p-4' : 'p-5'}`}
    >
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_left,rgba(191,255,0,0.14),transparent_34%),linear-gradient(180deg,rgba(255,255,255,0.05),rgba(7,11,17,0.76))]" aria-hidden="true" />
      <div className="pointer-events-none absolute -right-8 top-2 h-24 w-24 rounded-full bg-accent/15 blur-3xl transition-opacity duration-300 group-hover:opacity-100" aria-hidden="true" />
      <div className="relative z-10">
        <div className="flex items-start justify-between gap-3">
          <div className={`inline-flex items-center gap-2 rounded-full border px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.16em] ${accentClass}`}>
            <Icon size={12} />
            <span>{eyebrow}</span>
          </div>
          <div className="text-[10px] uppercase tracking-[0.14em] text-text-tertiary">{Math.round(Number(action.priorityScore || 0))}</div>
        </div>
        <h3 className={`mt-3 font-semibold text-white ${compact ? 'text-base' : 'text-lg'}`}>{action.title}</h3>
        <p className={`mt-1 max-w-[32rem] text-text-secondary ${compact ? 'text-sm' : 'text-[0.95rem]'}`}>{action.description}</p>
        <div className="mt-4 inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/[0.04] px-3.5 py-2 text-xs font-semibold uppercase tracking-[0.12em] text-text-primary transition-all duration-300 group-hover:border-white/20 group-hover:bg-white/[0.08]">
          <span>{action.ctaLabel}</span>
          <span className="transition-transform duration-300 group-hover:translate-x-0.5">→</span>
        </div>
      </div>
    </Wrapper>
  );
}

interface TriggerPillsProps {
  triggers?: GamificationNotificationTrigger[] | null;
  limit?: number;
}

export function TriggerPills({ triggers, limit = 3 }: TriggerPillsProps) {
  const items = (Array.isArray(triggers) ? triggers : []).filter((trigger) => trigger?.active).slice(0, limit);
  if (!items.length) return null;

  return (
    <div className="flex flex-wrap gap-2">
      {items.map((trigger) => {
        const Icon = getTriggerIcon(trigger.type);
        return (
          <div key={`${trigger.type}-${trigger.title}`} className="inline-flex max-w-full items-center gap-2 rounded-full border border-white/10 bg-white/[0.04] px-3 py-1.5 text-[11px] text-text-secondary">
            <Icon size={12} className="shrink-0 text-accent" />
            <span className="truncate">{trigger.title}</span>
          </div>
        );
      })}
    </div>
  );
}

interface InsightStackProps {
  insights?: GamificationSummaryInsight[] | null;
  limit?: number;
}

export function InsightStack({ insights, limit = 2 }: InsightStackProps) {
  const items = (Array.isArray(insights) ? insights : []).slice(0, limit);
  if (!items.length) return null;

  return (
    <div className="space-y-2">
      {items.map((insight) => (
        <div
          key={`${insight.title}-${insight.detail}`}
          className={`rounded-2xl border px-4 py-3 ${getInsightToneClass(insight.tone)}`}
        >
          <div className="text-sm font-semibold">{insight.title}</div>
          <div className="mt-1 text-xs opacity-80">{insight.detail}</div>
        </div>
      ))}
    </div>
  );
}

const collectRewardNames = (rewards: GamificationReward[] = []) =>
  rewards
    .slice(0, 2)
    .map((reward) => reward.name)
    .filter(Boolean)
    .join(' • ');

interface DeltaFeedbackOverlayProps {
  delta: GamificationDelta | null;
  onClose: () => void;
}

export function DeltaFeedbackOverlay({ delta, onClose }: DeltaFeedbackOverlayProps) {
  if (!delta || (!delta.xpGained && !delta.pointsGained && !delta.leveledUp && !delta.rankedUp && !(delta.unlockedRewards || []).length)) {
    return null;
  }

  const rewards = delta.unlockedRewards || [];
  const rewardText = collectRewardNames(rewards);

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0, y: 24 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: 24 }}
        className="fixed inset-x-4 bottom-[calc(env(safe-area-inset-bottom,0px)+1rem)] z-[170]"
      >
        <div className="relative overflow-hidden rounded-[1.8rem] border border-accent/25 bg-card/90 p-5 shadow-[0_22px_52px_rgba(0,0,0,0.34)] backdrop-blur-md">
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_left,rgba(191,255,0,0.16),transparent_36%),linear-gradient(180deg,rgba(255,255,255,0.06),rgba(7,11,17,0.8))]" aria-hidden="true" />
          <div className="relative z-10">
            <div className="flex items-start justify-between gap-3">
              <div>
                <div className="inline-flex items-center gap-2 rounded-full border border-accent/25 bg-accent/10 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.16em] text-accent">
                  <Sparkles size={12} />
                  <span>Progress update</span>
                </div>
                <h3 className="mt-3 text-lg font-semibold text-white">
                  {delta.rankedUp ? `Rank up to ${delta.currentRank}` : delta.leveledUp ? 'Level up' : 'Session rewards added'}
                </h3>
                <p className="mt-1 text-sm text-text-secondary">
                  {delta.nextAction?.description || 'Your latest session moved your progression forward.'}
                </p>
              </div>
              <button
                type="button"
                onClick={onClose}
                className="rounded-full border border-white/10 bg-white/[0.04] px-3 py-1 text-xs font-semibold text-text-secondary transition-colors hover:border-white/20 hover:text-white"
              >
                Close
              </button>
            </div>

            <div className="mt-4 grid grid-cols-2 gap-3">
              <div className="rounded-2xl border border-white/10 bg-white/[0.04] px-4 py-3">
                <div className="text-[10px] uppercase tracking-[0.14em] text-text-tertiary">XP gained</div>
                <div className="mt-1 text-2xl font-electrolize text-white">+{delta.xpGained}</div>
              </div>
              <div className="rounded-2xl border border-white/10 bg-white/[0.04] px-4 py-3">
                <div className="text-[10px] uppercase tracking-[0.14em] text-text-tertiary">Points gained</div>
                <div className="mt-1 text-2xl font-electrolize text-white">+{delta.pointsGained}</div>
              </div>
            </div>

            {(delta.rankedUp || delta.leveledUp || rewardText) && (
              <div className="mt-4 space-y-2">
                {delta.rankedUp && (
                  <div className="rounded-2xl border border-amber-400/20 bg-amber-500/10 px-4 py-3 text-sm text-amber-100">
                    Rank unlocked: {delta.currentRank}
                  </div>
                )}
                {delta.leveledUp && (
                  <div className="rounded-2xl border border-sky-400/20 bg-sky-500/10 px-4 py-3 text-sm text-sky-100">
                    Level up achieved
                  </div>
                )}
                {rewardText && (
                  <div className="rounded-2xl border border-violet-400/20 bg-violet-500/10 px-4 py-3 text-sm text-violet-100">
                    Unlocked reward: {rewardText}
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      </motion.div>
    </AnimatePresence>
  );
}
