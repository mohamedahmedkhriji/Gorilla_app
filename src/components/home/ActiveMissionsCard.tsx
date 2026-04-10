import React, { useEffect, useRef, useState } from 'react';
import { Card } from '../ui/Card';
import { Target } from 'lucide-react';
import { api } from '../../services/api';
import { getCachedNotificationSettings, sendBrowserNotification } from '../../services/appNotifications';

interface ActiveMissionsCardProps {
  onClick: () => void;
}

export function ActiveMissionsCard({ onClick }: ActiveMissionsCardProps) {
  const [missions, setMissions] = useState<any[]>([]);
  const completedSnapshotRef = useRef<{ missions: number; challenges: number } | null>(null);
  const appUser = JSON.parse(localStorage.getItem('appUser') || localStorage.getItem('user') || '{}');
  const userId = parseInt(String(appUser?.id || localStorage.getItem('appUserId') || localStorage.getItem('userId') || '0'), 10);

  useEffect(() => {
    const fetchMissions = async () => {
      if (!userId || userId <= 0) {
        setMissions([]);
        return;
      }
      try {
        const [data, summary] = await Promise.all([
          api.getUserMissions(userId),
          api.getGamificationSummary(userId),
        ]);

        if (Array.isArray(data)) {
          const activeMissions = data
            .filter((m) => m?.status === 'active')
            .sort((a, b) => {
              const missionTypeOrder = (value: unknown) => {
                const normalized = String(value || '').toLowerCase();
                if (normalized === 'daily') return 0;
                if (normalized === 'weekly') return 1;
                if (normalized === 'monthly') return 2;
                return 3;
              };
              return missionTypeOrder(a?.mission_type) - missionTypeOrder(b?.mission_type);
            });
          setMissions(activeMissions.slice(0, 5));
        }

        const completedMissions = Number(summary?.completedMissions || 0);
        const completedChallenges = Number(summary?.completedChallenges || 0);
        if (completedSnapshotRef.current) {
          const notificationSettings = getCachedNotificationSettings();
          if (notificationSettings.missionChallenge) {
            if (completedMissions > completedSnapshotRef.current.missions) {
              sendBrowserNotification('Mission completed', {
                body: 'Great job. You just completed a mission.',
                tag: 'mission-complete',
              });
            }
            if (completedChallenges > completedSnapshotRef.current.challenges) {
              sendBrowserNotification('Challenge completed', {
                body: 'Awesome. You just completed a challenge.',
                tag: 'challenge-complete',
              });
            }
          }
        }
        completedSnapshotRef.current = { missions: completedMissions, challenges: completedChallenges };
      } catch (error) {
        console.error('Error fetching missions:', error);
      }
    };

    const handleGamificationUpdated = () => {
      void fetchMissions();
    };

    void fetchMissions();
    window.addEventListener('gamification-updated', handleGamificationUpdated);
    window.addEventListener('focus', handleGamificationUpdated);

    return () => {
      window.removeEventListener('gamification-updated', handleGamificationUpdated);
      window.removeEventListener('focus', handleGamificationUpdated);
    };
  }, [userId]);

  return (
    <Card className="p-4 cursor-pointer" onClick={onClick}>
      <div className="flex items-center gap-2 mb-3">
        <Target size={18} className="text-accent" />
        <h3 className="font-bold text-white text-sm">Micro Challenges</h3>
      </div>
      <div className="space-y-2">
        {missions.slice(0, 3).map((mission) => (
          <div key={mission.id} className="bg-white/5 rounded-lg p-2">
            <div className="flex justify-between items-start mb-1">
              <p className="text-xs font-semibold text-white">{mission.title}</p>
              <span className="text-xs font-bold text-accent">
                +{Number(mission.xp_reward || mission.points_reward || 0)} XP
              </span>
            </div>
            <div className="flex items-center gap-2">
              <div className="flex-1 h-1 bg-white/10 rounded-full overflow-hidden">
                <div
                  className="h-full bg-accent rounded-full"
                  style={{ width: `${Math.min((mission.progress / mission.target) * 100, 100)}%` }}
                />
              </div>
              <span className="text-xs text-text-tertiary font-mono">
                {mission.progress}/{mission.target}
              </span>
            </div>
          </div>
        ))}
        {missions.length > 3 && (
          <p className="text-xs text-text-secondary text-center pt-1">
            +{missions.length - 3} more challenges
          </p>
        )}
      </div>
    </Card>
  );
}
