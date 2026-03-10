import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { ChevronRight, CircleHelp } from 'lucide-react';
import { Header } from '../ui/Header';
import { Card } from '../ui/Card';
import { api } from '../../services/api';
import { getBodyPartImage } from '../../services/bodyPartTheme';

interface StrengthScoreScreenProps {
  onBack: () => void;
}

type RangeKey = 'month' | '6months' | 'year' | 'all';
type TopTab = 'statistics' | 'friends';

type StrengthScoreHistoryPoint = {
  bucket: string;
  label: string;
  avgE1RM: number;
  score: number;
};

type StrengthScoreMuscleItem = {
  name: string;
  avgE1RM: number;
  bestE1RM: number;
  score: number;
  tier: string;
};

type StrengthScorePayload = {
  range: RangeKey;
  summary: {
    overallScore: number;
    overallAvgE1RM: number;
    level: string;
    minScale: number;
    maxScale: number;
    samples: number;
  };
  history: StrengthScoreHistoryPoint[];
  muscles: StrengthScoreMuscleItem[];
};

const getMuscleImage = (muscle: string) => getBodyPartImage(muscle);

const rangeOptions: Array<{ key: RangeKey; label: string }> = [
  { key: 'month', label: 'Month' },
  { key: '6months', label: '6 months' },
  { key: 'year', label: 'Year' },
  { key: 'all', label: 'All time' },
];

const getStoredUserId = () => {
  const localUserId = Number(localStorage.getItem('appUserId') || localStorage.getItem('userId') || 0);
  const user = JSON.parse(localStorage.getItem('appUser') || localStorage.getItem('user') || '{}');
  const parsedUserId = Number(user?.id || 0);
  return localUserId || parsedUserId;
};

const buildLinePath = (points: Array<{ x: number; y: number }>) => {
  if (!points.length) return '';
  return points
    .map((point, index) => `${index === 0 ? 'M' : 'L'} ${point.x},${point.y}`)
    .join(' ');
};

export function StrengthScoreScreen({ onBack }: StrengthScoreScreenProps) {
  const [activeTopTab, setActiveTopTab] = useState<TopTab>('statistics');
  const [activeRange, setActiveRange] = useState<RangeKey>('6months');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [data, setData] = useState<StrengthScorePayload | null>(null);

  const loadScore = useCallback(async (range: RangeKey) => {
    const userId = getStoredUserId();
    if (!userId) {
      setData(null);
      setError(null);
      setLoading(false);
      return;
    }

    try {
      setLoading(true);
      setError(null);
      const response = await api.getStrengthScore(userId, range);
      setData(response as StrengthScorePayload);
    } catch (loadError) {
      const message = loadError instanceof Error ? loadError.message : 'Could not load strength score.';
      setError(message);
      setData(null);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadScore(activeRange);
  }, [activeRange, loadScore]);

  useEffect(() => {
    const handleRefresh = () => {
      void loadScore(activeRange);
    };
    window.addEventListener('gamification-updated', handleRefresh);
    window.addEventListener('recovery-updated', handleRefresh);

    return () => {
      window.removeEventListener('gamification-updated', handleRefresh);
      window.removeEventListener('recovery-updated', handleRefresh);
    };
  }, [activeRange, loadScore]);

  const chart = useMemo(() => {
    const history = Array.isArray(data?.history) ? data.history : [];
    if (!history.length) {
      return {
        linePath: '',
        points: [] as Array<{ x: number; y: number; label: string }>,
      };
    }

    const scores = history.map((entry) => Number(entry.score || 0));
    const minScore = Math.min(...scores);
    const maxScore = Math.max(...scores);
    const range = maxScore - minScore || 1;

    const points = history.map((entry, index) => {
      const x = history.length === 1 ? 50 : 4 + ((index / (history.length - 1)) * 92);
      const y = 90 - (((Number(entry.score || 0) - minScore) / range) * 70);
      return { x, y, label: entry.label };
    });

    return {
      linePath: buildLinePath(points),
      points,
    };
  }, [data?.history]);

  const summary = data?.summary;
  const overallScore = Number(summary?.overallScore || 0);
  const minScale = Number(summary?.minScale || 0);
  const maxScale = Number(summary?.maxScale || 0);
  const progressPercent = maxScale > minScale
    ? Math.max(0, Math.min(100, ((overallScore - minScale) / (maxScale - minScale)) * 100))
    : 0;

  return (
    <div className="min-h-screen bg-background pb-24">
      <div className="px-4 sm:px-6 pt-2">
        <Header
          title="Strength Score"
          onBack={onBack}
          rightElement={(
            <button
              type="button"
              className="flex h-9 w-9 items-center justify-center rounded-full border border-white/10 bg-card/70 text-text-secondary transition-colors hover:border-accent/30 hover:text-text-primary"
              aria-label="Strength score info"
            >
              <CircleHelp size={16} />
            </button>
          )}
        />

        <div className="mt-2 grid grid-cols-2 rounded-xl border border-white/10 bg-card/70 p-1">
          <button
            type="button"
            onClick={() => setActiveTopTab('statistics')}
            className={`rounded-lg px-3 py-2 text-sm font-semibold transition-colors ${
              activeTopTab === 'statistics'
                ? 'bg-white/12 text-white'
                : 'text-text-secondary hover:text-text-primary'
            }`}
          >
            Statistics
          </button>
          <button
            type="button"
            onClick={() => setActiveTopTab('friends')}
            className={`rounded-lg px-3 py-2 text-sm font-semibold transition-colors ${
              activeTopTab === 'friends'
                ? 'bg-white/12 text-white'
                : 'text-text-secondary hover:text-text-primary'
            }`}
          >
            Friends
          </button>
        </div>

        {activeTopTab === 'friends' ? (
          <Card className="mt-4 p-5">
            <div className="text-sm text-text-secondary">
              Friends strength ranking is coming soon.
            </div>
          </Card>
        ) : (
          <div className="space-y-5">
            <div className="pt-4 text-center">
              <div className="mx-auto flex h-28 w-28 items-center justify-center rounded-full border-2 border-rose-500/90 bg-rose-500/10">
                <span className="font-electrolize text-4xl text-white">{loading ? '--' : overallScore || '--'}</span>
              </div>
              <div className="mt-2 text-4xl font-semibold text-white">{summary?.level || 'Athlete'}</div>
              <div className="mt-1 text-xs text-text-tertiary">
                Avg E1RM {Number(summary?.overallAvgE1RM || 0).toFixed(1)} kg
              </div>
            </div>

            <div>
              <div className="h-2 w-full overflow-hidden rounded-full bg-white/10">
                <div
                  className="h-full rounded-full bg-gradient-to-r from-rose-600 to-red-400"
                  style={{ width: `${progressPercent}%` }}
                />
              </div>
              <div className="mt-1 flex justify-between text-sm text-text-secondary">
                <span>{minScale || 0}</span>
                <span>{maxScale || 0}</span>
              </div>
            </div>

            <div>
              <h3 className="text-3xl font-semibold text-white">Strength History</h3>
              <div className="mt-3 grid grid-cols-4 rounded-xl border border-white/10 bg-card/70 p-1">
                {rangeOptions.map((option) => (
                  <button
                    key={option.key}
                    type="button"
                    onClick={() => setActiveRange(option.key)}
                    className={`rounded-lg px-2 py-1.5 text-xs font-semibold transition-colors ${
                      activeRange === option.key
                        ? 'bg-white/12 text-white'
                        : 'text-text-secondary hover:text-text-primary'
                    }`}
                  >
                    {option.label}
                  </button>
                ))}
              </div>

              <div className="mt-3 h-64 rounded-2xl border border-white/10 bg-card/70 p-3">
                {loading ? (
                  <div className="h-full animate-pulse rounded-xl bg-white/5" />
                ) : error ? (
                  <div className="flex h-full items-center justify-center text-sm text-rose-300">{error}</div>
                ) : !chart.points.length ? (
                  <div className="flex h-full items-center justify-center text-sm text-text-secondary">
                    Not enough weighted sets yet.
                  </div>
                ) : (
                  <svg className="h-full w-full" viewBox="0 0 100 100" preserveAspectRatio="none">
                    <line x1="0" y1="15" x2="100" y2="15" stroke="rgba(255,255,255,0.08)" strokeWidth="0.7" />
                    <line x1="0" y1="50" x2="100" y2="50" stroke="rgba(255,255,255,0.08)" strokeWidth="0.7" />
                    <line x1="0" y1="92" x2="100" y2="92" stroke="rgba(255,255,255,0.08)" strokeWidth="0.7" />
                    <path d={chart.linePath} fill="none" stroke="#F8FAFC" strokeWidth="1.8" />
                    {chart.points.map((point) => (
                      <circle key={`${point.x}-${point.y}`} cx={point.x} cy={point.y} r="1.2" fill="#F8FAFC" />
                    ))}
                  </svg>
                )}
              </div>

              {!!chart.points.length && (
                <div className="mt-2 flex justify-between text-xs text-text-tertiary">
                  <span>{chart.points[0]?.label || '-'}</span>
                  <span>{chart.points[chart.points.length - 1]?.label || '-'}</span>
                </div>
              )}
            </div>

            <div>
              <h3 className="text-3xl font-semibold text-white">Strength per Muscle</h3>
              <div className="mt-3 space-y-2">
                {(data?.muscles || []).map((muscle) => (
                  <button
                    key={muscle.name}
                    type="button"
                    className="flex w-full items-center gap-3 rounded-2xl border border-white/10 bg-card/80 p-3 text-left transition-colors hover:border-accent/30"
                  >
                    <div className="h-12 w-12 overflow-hidden rounded-xl border border-white/10 bg-white/5">
                      <img src={getMuscleImage(muscle.name)} alt={muscle.name} className="h-full w-full object-cover" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="truncate text-sm font-semibold text-white">{muscle.name}</div>
                      <div className="mt-0.5 text-xs text-text-secondary">{muscle.tier}</div>
                    </div>
                    <div className="inline-flex items-center gap-2">
                      <div className="rounded-full border border-rose-500/70 bg-rose-500/10 px-3 py-1 text-sm font-electrolize text-white">
                        {muscle.score}
                      </div>
                      <ChevronRight size={16} className="text-text-tertiary" />
                    </div>
                  </button>
                ))}
                {!loading && !error && (!data?.muscles || data.muscles.length === 0) && (
                  <Card className="p-4">
                    <div className="text-sm text-text-secondary">
                      Start logging weighted sets to unlock per-muscle strength scores.
                    </div>
                  </Card>
                )}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
