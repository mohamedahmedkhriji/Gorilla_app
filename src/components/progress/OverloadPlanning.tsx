import React, { useEffect, useState } from 'react';
import { Card } from '../ui/Card';
import { TrendingUp, ArrowUp } from 'lucide-react';
import { api } from '../../services/api';

interface OverloadRecommendation {
  name: string;
  current: string;
  next: string;
}

export function OverloadPlanning() {
  const [recommendations, setRecommendations] = useState<OverloadRecommendation[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const user = JSON.parse(localStorage.getItem('appUser') || localStorage.getItem('user') || '{}');
    const localUserId = Number(localStorage.getItem('appUserId') || localStorage.getItem('userId') || 0);
    const parsedUserId = Number(user?.id || 0);
    const userId = localUserId || parsedUserId;

    if (!userId) {
      setLoading(false);
      return;
    }

    const loadOverloadPlan = async () => {
      try {
        const data = await api.getOverloadPlan(userId);
        const list = Array.isArray(data?.recommendations) ? data.recommendations : [];
        setRecommendations(list.slice(0, 3));
      } catch (error) {
        console.error('Failed to load overload plan:', error);
      } finally {
        setLoading(false);
      }
    };

    loadOverloadPlan();
  }, []);

  return (
    <Card className="bg-gradient-to-br from-card to-accent/5 border-accent/20">
      <div className="flex items-center gap-2 mb-4">
        <TrendingUp className="text-accent" size={20} />
        <h3 className="font-bold text-white">Next Period Overload</h3>
      </div>

      <div className="space-y-3">
        {!loading && recommendations.length === 0 && (
          <div className="p-3 bg-black/20 rounded-xl border border-white/5 text-xs text-text-secondary">
            No overload recommendations yet. Log more sets to generate your next progression targets.
          </div>
        )}

        {recommendations.map((rec, i) =>
        <div
          key={i}
          className="flex items-center justify-between p-3 bg-black/20 rounded-xl border border-white/5">

            <span className="text-sm font-medium text-white">{rec.name}</span>
            <div className="flex items-center gap-3">
              <span className="text-xs text-text-tertiary">{rec.current}</span>
              <ArrowUp size={12} className="text-text-tertiary" />
              <span className="text-xs font-bold text-accent">{rec.next}</span>
            </div>
          </div>
        )}
      </div>

      <p className="text-xs text-text-secondary mt-4 leading-relaxed">
        Based on your recent performance, GORILLA recommends these increases to
        maintain progressive overload.
      </p>
    </Card>);

}
