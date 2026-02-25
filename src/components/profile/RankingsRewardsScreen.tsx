import React, { useState, useEffect } from 'react';
import { Header } from '../ui/Header';
import { Card } from '../ui/Card';
import { Trophy, BarChart3, Target, Calendar } from 'lucide-react';
import { getUserRankBadge } from '../../services/missions';
import { LeaderboardScreen } from './LeaderboardScreen';
import { api } from '../../services/api';

interface RankingsRewardsScreenProps {
  onBack: () => void;
}

export function RankingsRewardsScreen({ onBack }: RankingsRewardsScreenProps) {
  const [showLeaderboard, setShowLeaderboard] = useState(false);
  const [showHistory, setShowHistory] = useState(false);
  const [missions, setMissions] = useState<any[]>([]);
  const [missionHistory, setMissionHistory] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  
  const userId = parseInt(localStorage.getItem('appUserId') || localStorage.getItem('userId') || '0');
  const userPoints = 420;

  useEffect(() => {
    const fetchMissions = async () => {
      try {
        const data = await api.getUserMissions(userId);
        if (Array.isArray(data)) {
          setMissions(data);
        }
        const history = await api.getMissionHistory(userId);
        if (Array.isArray(history)) {
          setMissionHistory(history);
        }
      } catch (error) {
        console.error('Error fetching missions:', error);
      } finally {
        setLoading(false);
      }
    };
    fetchMissions();
  }, [userId]);

  const rankBadge = getUserRankBadge(userPoints);
  const activeMissions = missions.filter(m => !m.completed).slice(0, 5);
  const completedMissions = missions.filter(m => m.completed);

  if (showLeaderboard) {
    return <LeaderboardScreen onBack={() => setShowLeaderboard(false)} />;
  }

  if (showHistory) {
    return (
      <div className="flex-1 flex flex-col pb-24 bg-background">
        <div className="px-6 pt-2">
          <Header title="Mission History" onBack={() => setShowHistory(false)} />
        </div>
        <div className="px-6 space-y-4 mt-4">
          {Object.entries(
            missionHistory.reduce((acc, mission) => {
              if (!acc[mission.period]) acc[mission.period] = [];
              acc[mission.period].push(mission);
              return acc;
            }, {} as Record<string, typeof missionHistory>)
          ).map(([period, missions]) => (
            <div key={period}>
              <h3 className="text-xs font-bold text-text-secondary uppercase tracking-wider mb-3">
                {period}
              </h3>
              <div className="space-y-2">
                {missions.map((mission, idx) => (
                  <Card key={idx} className="p-4">
                    <div className="flex justify-between items-start">
                      <div>
                        <h4 className="font-bold text-white">{mission.title}</h4>
                        <p className="text-xs text-text-secondary mt-1">
                          Completed {new Date(mission.completed_at).toLocaleDateString()}
                        </p>
                      </div>
                      <div className="text-right">
                        <span className="text-green-500 text-xl">✓</span>
                        <p className="text-xs text-accent font-bold mt-1">+{mission.points_reward} pts</p>
                      </div>
                    </div>
                  </Card>
                ))}
              </div>
            </div>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="flex-1 flex flex-col pb-24 bg-background">
      <div className="px-6 pt-2">
        <Header title="Rank & Rewards" onBack={onBack} />
      </div>

      <div className="px-6 space-y-4 mt-2">
        <div className="flex flex-col items-center py-3">
          <div className="w-20 h-20 rounded-full bg-accent/10 border-2 border-accent/30 flex items-center justify-center mb-3">
            <span className="text-4xl">{rankBadge.emoji}</span>
          </div>
          <h2 className="text-lg font-bold text-white">{rankBadge.name}</h2>
          <p className="text-sm text-text-secondary mt-1">{userPoints} points</p>
        </div>

        <button
          onClick={() => setShowLeaderboard(true)}
          className="w-full bg-card rounded-lg p-3 border border-white/5 flex items-center justify-between hover:border-accent/20 transition-colors">
          <div className="flex items-center gap-3">
            <BarChart3 size={20} className="text-accent" />
            <div className="text-left">
              <h4 className="font-semibold text-white text-sm">View Leaderboard</h4>
              <p className="text-xs text-text-secondary">See gym rankings</p>
            </div>
          </div>
          <span className="text-accent">→</span>
        </button>

        <button
          onClick={() => setShowHistory(true)}
          className="w-full bg-card rounded-lg p-3 border border-white/5 flex items-center justify-between hover:border-accent/20 transition-colors">
          <div className="flex items-center gap-3">
            <Calendar size={20} className="text-accent" />
            <div className="text-left">
              <h4 className="font-semibold text-white text-sm">Mission History</h4>
              <p className="text-xs text-text-secondary">View completed missions</p>
            </div>
          </div>
          <span className="text-accent">→</span>
        </button>

        {loading ? (
          <p className="text-center text-text-secondary text-sm">Loading missions...</p>
        ) : activeMissions.length > 0 ? (
          <div className="space-y-2">
            <div className="flex items-center gap-2">
              <Target size={16} className="text-accent" />
              <h3 className="text-xs font-bold text-text-secondary uppercase tracking-wider">
                Active Missions
              </h3>
            </div>
            {activeMissions.map((mission) => (
              <Card key={mission.id} className="p-3">
                <div className="flex justify-between items-start mb-2">
                  <h4 className="font-semibold text-white text-sm">{mission.title}</h4>
                  <span className="text-xs font-bold text-accent bg-accent/10 px-2 py-0.5 rounded">
                    +{mission.points_reward}
                  </span>
                </div>
                <p className="text-xs text-text-secondary mb-2">{mission.description}</p>
                <div className="space-y-1">
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
                  <p className="text-xs text-text-tertiary">
                    {mission.remaining} more to complete
                  </p>
                </div>
              </Card>
            ))}
          </div>
        ) : (
          <p className="text-center text-text-secondary text-sm">No active missions</p>
        )}

        {completedMissions.length > 0 && (
          <div className="space-y-2">
            <div className="flex items-center gap-2">
              <Trophy size={16} className="text-green-500" />
              <h3 className="text-xs font-bold text-text-secondary uppercase tracking-wider">
                Completed Missions
              </h3>
            </div>
            {completedMissions.map((mission) => (
              <Card key={mission.id} className="p-3 opacity-60">
                <div className="flex justify-between items-start">
                  <div>
                    <h4 className="font-semibold text-white text-sm">{mission.title}</h4>
                    <p className="text-xs text-text-secondary mt-0.5">{mission.description}</p>
                  </div>
                  <span className="text-green-500 text-lg">✓</span>
                </div>
              </Card>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
