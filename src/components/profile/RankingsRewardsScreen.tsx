import React, { useEffect, useMemo, useState } from 'react';
import { Header } from '../ui/Header';
import { Card } from '../ui/Card';
import { Trophy } from 'lucide-react';
import { LeaderboardScreen } from './LeaderboardScreen';
import { api } from '../../services/api';
import { getRankBadgeImage } from '../../services/rankTheme';
import {
  emojiChallenges,
  emojiDone,
  emojiMissions,
  emojiNew,
  emojiViewLeaderboard,
} from '../../services/emojiTheme';

interface RankingsRewardsScreenProps {
  onBack: () => void;
}

type MissionItem = {
  id: number;
  title: string;
  description: string;
  points_reward: number;
  progress: number;
  target: number;
  completed: boolean;
  remaining: number;
  status?: 'active' | 'completed' | 'expired';
  completed_at?: string | null;
  assigned_at?: string | null;
  created_at?: string | null;
};

type ChallengeItem = {
  id: number;
  title: string;
  description: string;
  challenge_type: 'daily' | 'weekly';
  points_reward: number;
  progress: number;
  target: number;
  completed: boolean;
  remaining: number;
  status?: 'active' | 'completed' | 'expired';
  completed_at?: string | null;
  created_at?: string | null;
};

type Summary = {
  totalPoints: number;
  rank: string;
  nextRank: { name: string; minPoints: number; pointsNeeded: number } | null;
};

const NEW_ITEM_WINDOW_MS = 24 * 60 * 60 * 1000;

const isNewWithin24Hours = (dateValue?: string | null) => {
  if (!dateValue) return false;
  const timestamp = new Date(dateValue).getTime();
  if (!Number.isFinite(timestamp)) return false;
  return Date.now() - timestamp <= NEW_ITEM_WINDOW_MS;
};

function CardLoadingSkeleton({ tone = 'accent' }: { tone?: 'accent' | 'blue' }) {
  const barTone = tone === 'blue' ? 'bg-blue-400/45' : 'bg-accent/45';
  return (
    <Card className="!p-2.5">
      <div className="animate-pulse">
        <div className="flex items-start justify-between mb-2">
          <div className="h-4 w-40 rounded bg-white/10" />
          <div className="h-5 w-12 rounded bg-white/10" />
        </div>
        <div className="h-3 w-full rounded bg-white/10 mb-1.5" />
        <div className="h-3 w-2/3 rounded bg-white/10 mb-2" />
        <div className="flex items-center gap-2">
          <div className="flex-1 h-1.5 rounded-full bg-white/5 overflow-hidden">
            <div className={`h-full w-1/2 rounded-full ${barTone}`} />
          </div>
          <div className="h-3 w-12 rounded bg-white/10" />
        </div>
      </div>
    </Card>
  );
}

export function RankingsRewardsScreen({ onBack }: RankingsRewardsScreenProps) {
  const [showLeaderboard, setShowLeaderboard] = useState(false);
  const [showHistory, setShowHistory] = useState(false);
  const [missions, setMissions] = useState<MissionItem[]>([]);
  const [missionHistory, setMissionHistory] = useState<any[]>([]);
  const [dailyChallenges, setDailyChallenges] = useState<ChallengeItem[]>([]);
  const [weeklyChallenges, setWeeklyChallenges] = useState<ChallengeItem[]>([]);
  const [challengeHistory, setChallengeHistory] = useState<any[]>([]);
  const [summary, setSummary] = useState<Summary>({
    totalPoints: 0,
    rank: 'Bronze',
    nextRank: null,
  });
  const [loading, setLoading] = useState(true);

  const appUser = JSON.parse(localStorage.getItem('appUser') || localStorage.getItem('user') || '{}');
  const userId = parseInt(String(appUser?.id || localStorage.getItem('appUserId') || localStorage.getItem('userId') || '0'), 10);

  useEffect(() => {
    const fetchGamification = async () => {
      if (!userId || userId <= 0) {
        setLoading(false);
        return;
      }

      try {
        const [missionsData, missionHistoryData, challengesData, challengeHistoryData, summaryData] = await Promise.all([
          api.getUserMissions(userId),
          api.getMissionHistory(userId),
          api.getUserChallenges(userId),
          api.getChallengeHistory(userId),
          api.getGamificationSummary(userId),
        ]);

        if (Array.isArray(missionsData)) setMissions(missionsData);
        if (Array.isArray(missionHistoryData)) setMissionHistory(missionHistoryData);
        if (Array.isArray(challengeHistoryData)) setChallengeHistory(challengeHistoryData);

        if (challengesData && Array.isArray(challengesData.daily)) setDailyChallenges(challengesData.daily);
        if (challengesData && Array.isArray(challengesData.weekly)) setWeeklyChallenges(challengesData.weekly);

        if (summaryData && !summaryData.error) {
          setSummary({
            totalPoints: Number(summaryData.totalPoints || 0),
            rank: String(summaryData.rank || 'Bronze'),
            nextRank: summaryData.nextRank || null,
          });
        }
      } catch (error) {
        console.error('Error fetching gamification:', error);
      } finally {
        setLoading(false);
      }
    };

    const handleGamificationUpdated = () => {
      void fetchGamification();
    };

    void fetchGamification();
    window.addEventListener('gamification-updated', handleGamificationUpdated);
    window.addEventListener('focus', handleGamificationUpdated);

    return () => {
      window.removeEventListener('gamification-updated', handleGamificationUpdated);
      window.removeEventListener('focus', handleGamificationUpdated);
    };
  }, [userId]);

  const activeMissions = missions.filter((m) => m.status === 'active').slice(0, 5);
  const completedMissions = missions.filter((m) => m.completed);
  const activeDailyChallenges = dailyChallenges.filter((c) => c.status === 'active');
  const activeWeeklyChallenges = weeklyChallenges.filter((c) => c.status === 'active');
  const completedChallenges = [...dailyChallenges, ...weeklyChallenges].filter((c) => c.completed);

  const rankBadgeImage = getRankBadgeImage(summary.rank);
  const nextRankText = summary.nextRank
    ? `Next: ${summary.nextRank.name} (${summary.nextRank.pointsNeeded} pts)`
    : 'Top rank achieved';

  const missionHistoryByPeriod = useMemo(
    () => missionHistory.reduce((acc, item) => {
      const key = String(item.period || 'Unknown');
      if (!acc[key]) acc[key] = [];
      acc[key].push(item);
      return acc;
    }, {} as Record<string, any[]>),
    [missionHistory],
  );

  const challengeHistoryByPeriod = useMemo(
    () => challengeHistory.reduce((acc, item) => {
      const key = String(item.period || 'Unknown');
      if (!acc[key]) acc[key] = [];
      acc[key].push(item);
      return acc;
    }, {} as Record<string, any[]>),
    [challengeHistory],
  );

  if (showLeaderboard) {
    return <LeaderboardScreen onBack={() => setShowLeaderboard(false)} />;
  }

  if (showHistory) {
    return (
      <div className="flex-1 flex flex-col min-h-screen pb-24 bg-background">
        <div className="px-4 sm:px-6 pt-2">
          <Header title="History" onBack={() => setShowHistory(false)} compact />
        </div>

        <div className="px-4 sm:px-6 space-y-6 mt-4">
          {Object.keys(missionHistoryByPeriod).length > 0 && (
            <div>
              <h3 className="text-xs font-bold text-text-secondary uppercase tracking-wider mb-3">Mission History</h3>
              <div className="space-y-4">
                {Object.entries(missionHistoryByPeriod).map(([period, periodMissions]) => (
                  <div key={`mission-${period}`}>
                    <h4 className="text-xs font-bold text-text-secondary uppercase tracking-wider mb-2">{period}</h4>
                    <div className="space-y-2">
                      {periodMissions.map((mission, idx) => (
                        <Card key={`m-${period}-${idx}`} className="!p-4">
                          <div className="flex justify-between items-start">
                            <div>
                              <h5 className="font-bold text-white">{mission.title}</h5>
                              <p className="text-xs text-text-secondary mt-1">
                                Completed {new Date(mission.completed_at).toLocaleDateString()}
                              </p>
                            </div>
                            <p className="text-xs text-accent font-bold">+{mission.points_reward} pts</p>
                          </div>
                        </Card>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {Object.keys(challengeHistoryByPeriod).length > 0 && (
            <div>
              <h3 className="text-xs font-bold text-text-secondary uppercase tracking-wider mb-3">Challenge History</h3>
              <div className="space-y-4">
                {Object.entries(challengeHistoryByPeriod).map(([period, periodChallenges]) => (
                  <div key={`challenge-${period}`}>
                    <h4 className="text-xs font-bold text-text-secondary uppercase tracking-wider mb-2">{period}</h4>
                    <div className="space-y-2">
                      {periodChallenges.map((challenge, idx) => (
                        <Card key={`c-${period}-${idx}`} className="!p-4">
                          <div className="flex justify-between items-start">
                            <div>
                              <h5 className="font-bold text-white">{challenge.title}</h5>
                              <p className="text-xs text-text-secondary mt-1">
                                {challenge.challenge_type === 'daily' ? 'Daily' : 'Weekly'} challenge
                              </p>
                            </div>
                            <p className="text-xs text-accent font-bold">+{challenge.points_reward} pts</p>
                          </div>
                        </Card>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {Object.keys(missionHistoryByPeriod).length === 0 && Object.keys(challengeHistoryByPeriod).length === 0 && (
            <p className="text-center text-text-secondary text-sm">No history yet</p>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="flex-1 flex flex-col min-h-screen pb-24 bg-background">
      <div className="px-4 sm:px-6 pt-2">
        <Header title="Rank & Rewards" onBack={onBack} compact />
      </div>

      <div className="px-4 sm:px-6 space-y-2.5 mt-1">
        <div className="flex flex-col items-center py-1.5">
          <div className="w-20 h-20 rounded-full bg-accent/10 border-2 border-accent/30 flex items-center justify-center mb-2">
            <img src={rankBadgeImage} alt={summary.rank} className="h-12 w-12 object-contain" />
          </div>
          <h2 className="text-lg font-bold text-white">{summary.rank}</h2>
          <p className="mt-0.5 text-sm text-text-secondary">{summary.totalPoints} points</p>
          <p className="text-xs text-text-secondary mt-0.5">{nextRankText}</p>
        </div>

        <button
          onClick={() => setShowLeaderboard(true)}
          className="w-full bg-card rounded-lg p-3 border border-white/5 flex items-center justify-between hover:border-accent/20 transition-colors"
        >
          <div className="flex items-center gap-3">
            <img src={emojiViewLeaderboard} alt="View Leaderboard" className="w-5 h-5 object-contain" />
            <div className="text-left">
              <h4 className="font-semibold text-white text-sm">View Leaderboard</h4>
              <p className="text-xs text-text-secondary">See gym rankings</p>
            </div>
          </div>
          <span className="text-accent">→</span>
        </button>

        <button
          onClick={() => setShowHistory(true)}
          className="w-full bg-card rounded-lg p-3 border border-white/5 flex items-center justify-between hover:border-accent/20 transition-colors"
        >
          <div className="flex items-center gap-3">
            <img src={emojiChallenges} alt="Challenges" className="w-5 h-5 object-contain" />
            <div className="text-left">
              <h4 className="font-semibold text-white text-sm">Mission & Challenge History</h4>
              <p className="text-xs text-text-secondary">View completed items</p>
            </div>
          </div>
          <span className="text-accent">→</span>
        </button>

        {loading ? (
          <div className="space-y-3">
            <div className="space-y-2">
              <div className="flex items-center gap-2">
                <img src={emojiMissions} alt="Missions" className="w-4 h-4 object-contain opacity-70" />
                <h3 className="text-xs font-bold text-text-secondary uppercase tracking-wider">Active Missions</h3>
              </div>
              <div className="space-y-2">
                <CardLoadingSkeleton tone="accent" />
                <CardLoadingSkeleton tone="accent" />
              </div>
            </div>

            <div className="space-y-2">
              <div className="flex items-center gap-2">
                <img src={emojiChallenges} alt="Challenges" className="w-4 h-4 object-contain opacity-70" />
                <h3 className="text-xs font-bold text-text-secondary uppercase tracking-wider">Active Challenges</h3>
              </div>
              <div className="space-y-2">
                <CardLoadingSkeleton tone="blue" />
                <CardLoadingSkeleton tone="blue" />
              </div>
            </div>
          </div>
        ) : (
          <>
            {activeMissions.length > 0 && (
              <div className="space-y-2">
                <div className="flex items-center gap-2">
                  <img src={emojiMissions} alt="Missions" className="w-4 h-4 object-contain" />
                  <h3 className="text-xs font-bold text-text-secondary uppercase tracking-wider">Active Missions</h3>
                </div>
                <div className="space-y-2">
                  {activeMissions.map((mission) => (
                    <Card key={mission.id} className="!p-2.5">
                      <div className="flex justify-between items-start mb-2">
                        <div className="flex items-center gap-1.5">
                          <h4 className="font-semibold text-white text-sm">{mission.title}</h4>
                          {isNewWithin24Hours(mission.assigned_at || mission.created_at) && (
                            <img src={emojiNew} alt="new" className="w-6 h-4 object-contain" />
                          )}
                        </div>
                        <span className="text-xs font-bold text-accent bg-accent/10 px-2 py-0.5 rounded">
                          +{mission.points_reward}
                        </span>
                      </div>
                      <p className="text-xs text-text-secondary mb-1.5">{mission.description}</p>
                      <div className="space-y-0.5">
                        <div className="flex items-center gap-2">
                          <div className="flex-1 h-1.5 bg-white/5 rounded-full overflow-hidden">
                            <div
                              className="h-full bg-accent rounded-full"
                              style={{ width: `${Math.min((mission.progress / mission.target) * 100, 100)}%` }}
                            />
                          </div>
                          <span className="text-xs text-text-tertiary font-mono">
                            {mission.progress}/{mission.target}
                          </span>
                        </div>
                        <p className="text-xs text-text-tertiary">{mission.remaining} more to complete</p>
                      </div>
                    </Card>
                  ))}
                </div>
              </div>
            )}

            {(activeDailyChallenges.length > 0 || activeWeeklyChallenges.length > 0) && (
              <div className="space-y-2">
                <div className="flex items-center gap-2">
                  <img src={emojiMissions} alt="Missions" className="w-4 h-4 object-contain" />
                  <h3 className="text-xs font-bold text-text-secondary uppercase tracking-wider">Active Challenges</h3>
                </div>
                <div className="space-y-2">
                  {[...activeDailyChallenges, ...activeWeeklyChallenges].map((challenge) => (
                    <Card key={`${challenge.challenge_type}-${challenge.id}`} className="!p-2.5">
                      <div className="flex justify-between items-start mb-2">
                        <div>
                          <div className="flex items-center gap-1.5">
                            <h4 className="font-semibold text-white text-sm">{challenge.title}</h4>
                            {isNewWithin24Hours(challenge.created_at) && (
                              <img src={emojiNew} alt="new" className="w-6 h-4 object-contain" />
                            )}
                          </div>
                          <p className="text-[11px] text-text-secondary mt-0.5 uppercase">{challenge.challenge_type}</p>
                        </div>
                        <span className="text-xs font-bold text-blue-400 bg-blue-400/10 px-2 py-0.5 rounded">
                          +{challenge.points_reward}
                        </span>
                      </div>
                      <p className="text-xs text-text-secondary mb-1.5">{challenge.description}</p>
                      <div className="space-y-0.5">
                        <div className="flex items-center gap-2">
                          <div className="flex-1 h-1.5 bg-white/5 rounded-full overflow-hidden">
                            <div
                              className="h-full bg-blue-400 rounded-full"
                              style={{ width: `${Math.min((challenge.progress / challenge.target) * 100, 100)}%` }}
                            />
                          </div>
                          <span className="text-xs text-text-tertiary font-mono">
                            {challenge.progress}/{challenge.target}
                          </span>
                        </div>
                        <p className="text-xs text-text-tertiary">{challenge.remaining} more to complete</p>
                      </div>
                    </Card>
                  ))}
                </div>
              </div>
            )}

            {completedMissions.length > 0 && (
              <div className="space-y-1">
                <div className="flex items-center gap-2">
                  <Trophy size={16} className="text-green-500" />
                  <h3 className="text-xs font-bold text-text-secondary uppercase tracking-wider">Completed Missions</h3>
                </div>
                {completedMissions.map((mission) => (
                  <Card key={`done-m-${mission.id}`} className="!p-2.5 opacity-60">
                    <div className="flex justify-between items-start">
                      <div>
                        <h4 className="font-semibold text-white text-sm">{mission.title}</h4>
                        <p className="text-xs text-text-secondary mt-0.5">{mission.description}</p>
                      </div>
                      <img src={emojiDone} alt="done" className="w-4 h-4 object-contain" />
                    </div>
                  </Card>
                ))}
              </div>
            )}

            {completedChallenges.length > 0 && (
              <div className="space-y-1">
                <div className="flex items-center gap-2">
                  <Trophy size={16} className="text-green-500" />
                  <h3 className="text-xs font-bold text-text-secondary uppercase tracking-wider">Completed Challenges</h3>
                </div>
                {completedChallenges.map((challenge) => (
                  <Card key={`done-c-${challenge.challenge_type}-${challenge.id}`} className="!p-2.5 opacity-60">
                    <div className="flex justify-between items-start">
                      <div>
                        <h4 className="font-semibold text-white text-sm">{challenge.title}</h4>
                        <p className="text-xs text-text-secondary mt-0.5">{challenge.description}</p>
                      </div>
                      <img src={emojiDone} alt="done" className="w-4 h-4 object-contain" />
                    </div>
                  </Card>
                ))}
              </div>
            )}

            {activeMissions.length === 0
              && activeDailyChallenges.length === 0
              && activeWeeklyChallenges.length === 0
              && completedMissions.length === 0
              && completedChallenges.length === 0 && (
              <p className="text-center text-text-secondary text-sm">No missions or challenges found</p>
            )}
          </>
        )}
      </div>
    </div>
  );
}
