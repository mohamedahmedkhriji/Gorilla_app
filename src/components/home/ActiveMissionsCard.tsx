import React, { useEffect, useState } from 'react';
import { Card } from '../ui/Card';
import { Target } from 'lucide-react';
import { api } from '../../services/api';

interface ActiveMissionsCardProps {
  onClick: () => void;
}

export function ActiveMissionsCard({ onClick }: ActiveMissionsCardProps) {
  const [missions, setMissions] = useState<any[]>([]);
  const userId = parseInt(localStorage.getItem('appUserId') || localStorage.getItem('userId') || '0');

  useEffect(() => {
    const fetchMissions = async () => {
      try {
        const data = await api.getUserMissions(userId);
        if (Array.isArray(data)) {
          setMissions(data.filter(m => !m.completed).slice(0, 5));
        }
      } catch (error) {
        console.error('Error fetching missions:', error);
      }
    };
    fetchMissions();
  }, [userId]);

  return (
    <Card className="p-4 cursor-pointer" onClick={onClick}>
      <div className="flex items-center gap-2 mb-3">
        <Target size={18} className="text-accent" />
        <h3 className="font-bold text-white text-sm">Active Missions</h3>
      </div>
      <div className="space-y-2">
        {missions.slice(0, 3).map((mission) => (
          <div key={mission.id} className="bg-white/5 rounded-lg p-2">
            <div className="flex justify-between items-start mb-1">
              <p className="text-xs font-semibold text-white">{mission.title}</p>
              <span className="text-xs font-bold text-accent">+{mission.points_reward}</span>
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
            +{missions.length - 3} more missions
          </p>
        )}
      </div>
    </Card>
  );
}
