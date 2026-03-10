import React, { useEffect, useMemo, useState, useId, useCallback } from 'react';
import { Card } from '../ui/Card';
import { api } from '../../services/api';

interface StrengthWeekPoint {
  yearWeek: number;
  weekStart: string;
  avgE1RM: number;
}

interface StrengthProgressResponse {
  weeks: StrengthWeekPoint[];
  summary: {
    weeksRequested: number;
    baselineAvgE1RM: number | null;
    currentAvgE1RM: number | null;
    percentChange: number;
  };
}

type ChartPoint = {
  x: number;
  y: number;
};

const buildSmoothPath = (points: ChartPoint[]) => {
  if (!points.length) return '';
  if (points.length === 1) return `M ${points[0].x},${points[0].y}`;

  let path = `M ${points[0].x},${points[0].y}`;
  for (let index = 1; index < points.length; index += 1) {
    const prev = points[index - 1];
    const current = points[index];
    const deltaX = current.x - prev.x;
    const cp1x = prev.x + (deltaX / 3);
    const cp2x = current.x - (deltaX / 3);
    path += ` C ${cp1x},${prev.y} ${cp2x},${current.y} ${current.x},${current.y}`;
  }
  return path;
};

const formatKg = (value: number | null | undefined) => {
  const numericValue = Number(value);
  if (!Number.isFinite(numericValue) || numericValue <= 0) return '--';
  return `${Math.round(numericValue)} kg`;
};

export function StrengthChart() {
  const [data, setData] = useState<StrengthProgressResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const gradientId = useId().replace(/:/g, '');
  const strokeGradientId = `${gradientId}-stroke`;

  const getUserId = () => {
    const localUserId = Number(localStorage.getItem('appUserId') || localStorage.getItem('userId') || 0);
    const user = JSON.parse(localStorage.getItem('appUser') || localStorage.getItem('user') || '{}');
    const parsedUserId = Number(user?.id || 0);
    return localUserId || parsedUserId;
  };

  const fetchStrength = useCallback(async () => {
    const userId = getUserId();

    if (!userId) {
      setLoading(false);
      return;
    }

    try {
      const response = await api.getStrengthProgress(userId, 8);
      setData(response);
    } catch (error) {
      console.error('Failed to load strength chart:', error);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void fetchStrength();

    const handleRefresh = () => {
      setLoading(true);
      void fetchStrength();
    };

    window.addEventListener('gamification-updated', handleRefresh);
    window.addEventListener('recovery-updated', handleRefresh);

    const intervalId = window.setInterval(() => {
      void fetchStrength();
    }, 30000);

    return () => {
      window.removeEventListener('gamification-updated', handleRefresh);
      window.removeEventListener('recovery-updated', handleRefresh);
      window.clearInterval(intervalId);
    };
  }, [fetchStrength]);

  const points = useMemo(() => data?.weeks || [], [data?.weeks]);
  const values = useMemo(() => points.map((p) => Number(p.avgE1RM || 0)), [points]);

  const chart = useMemo(() => {
    if (!values.length) {
      return {
        linePath: '',
        areaPath: '',
        firstLabel: '-',
        midLabel: '-',
        lastLabel: '-',
        points: [] as ChartPoint[],
        minLabel: '--',
        maxLabel: '--',
      };
    }

    const minValue = Math.min(...values);
    const maxValue = Math.max(...values);
    const range = maxValue - minValue || 1;

    const mapped = values.map((value, index) => {
      const x = values.length === 1 ? 50 : 6 + ((index / (values.length - 1)) * 88);
      const normalized = (value - minValue) / range;
      const y = range === 0 ? 48 : 88 - (normalized * 72);
      return { x, y };
    });

    const linePath = buildSmoothPath(mapped);

    const firstX = mapped[0]?.x ?? 0;
    const lastX = mapped[mapped.length - 1]?.x ?? 100;
    const areaPath = `${linePath} L${lastX},96 L${firstX},96 Z`;

    const middleIndex = Math.floor((points.length - 1) / 2);
    const formatLabel = (value: string | undefined) => {
      if (!value) return '-';
      const date = new Date(value);
      if (Number.isNaN(date.getTime())) return '-';
      return date.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
    };

    return {
      linePath,
      areaPath,
      firstLabel: formatLabel(points[0]?.weekStart),
      midLabel: formatLabel(points[middleIndex]?.weekStart),
      lastLabel: formatLabel(points[points.length - 1]?.weekStart),
      points: mapped,
      minLabel: formatKg(minValue),
      maxLabel: formatKg(maxValue),
    };
  }, [points, values]);

  const hasStrengthData = points.length > 0;
  const pct = Number(data?.summary?.percentChange || 0);
  const pctText = hasStrengthData ? `${pct >= 0 ? '+' : ''}${pct}%` : '--';
  const trendToneClass = pct > 0
    ? 'border-emerald-500/35 bg-emerald-500/10 text-emerald-400'
    : pct < 0
      ? 'border-rose-500/35 bg-rose-500/10 text-rose-400'
      : 'border-white/10 bg-white/5 text-text-secondary';

  const baselineText = formatKg(data?.summary?.baselineAvgE1RM);
  const currentText = formatKg(data?.summary?.currentAvgE1RM);

  return (
    <Card className="relative overflow-hidden p-6">
      <div className="pointer-events-none absolute inset-x-0 top-0 h-20 bg-[radial-gradient(circle_at_top_left,rgba(var(--color-accent)/0.18),transparent_70%)]" />
      <div className="relative">
        <div className="mb-5 flex items-start justify-between gap-4">
          <div>
            <h3 className="text-lg font-semibold text-text-primary">Strength Progress</h3>
            <p className="text-xs text-text-secondary">Estimated 1RM weekly average</p>
          </div>
          <div className={`rounded-xl border px-3 py-2 text-right ${trendToneClass}`}>
            <div className="text-[10px] uppercase tracking-[0.14em]">Trend</div>
            <div className="text-xl font-electrolize leading-none">{loading ? '--' : pctText}</div>
          </div>
        </div>

        <div className="mb-4 grid grid-cols-2 gap-3 text-xs">
          <div className="rounded-xl border border-white/10 bg-background/45 px-3 py-2">
            <div className="uppercase tracking-[0.12em] text-text-tertiary">Baseline</div>
            <div className="mt-1 text-sm font-semibold text-text-primary">{loading ? '--' : baselineText}</div>
          </div>
          <div className="rounded-xl border border-white/10 bg-background/45 px-3 py-2">
            <div className="uppercase tracking-[0.12em] text-text-tertiary">Current</div>
            <div className="mt-1 text-sm font-semibold text-text-primary">{loading ? '--' : currentText}</div>
          </div>
        </div>

        <div className="relative h-44 w-full overflow-hidden rounded-xl border border-white/10 bg-background/35 p-2">
          {loading ? (
            <div className="h-full w-full animate-pulse rounded-lg bg-white/5" />
          ) : !hasStrengthData ? (
            <div className="flex h-full items-center justify-center rounded-lg border border-dashed border-white/12 text-center text-xs text-text-secondary">
              Log weighted sets to unlock your strength trend.
            </div>
          ) : (
            <svg
              className="h-full w-full overflow-visible"
              preserveAspectRatio="none"
              viewBox="0 0 100 100">
              <line x1="0" y1="12" x2="100" y2="12" stroke="rgba(255,255,255,0.08)" strokeWidth="0.8" />
              <line x1="0" y1="50" x2="100" y2="50" stroke="rgba(255,255,255,0.08)" strokeWidth="0.8" />
              <line x1="0" y1="96" x2="100" y2="96" stroke="rgba(255,255,255,0.08)" strokeWidth="0.8" />

              <path d={chart.areaPath} fill={`url(#${gradientId})`} />
              <path
                d={chart.linePath}
                fill="none"
                stroke={`url(#${strokeGradientId})`}
                strokeWidth="2.8"
                strokeLinecap="round"
                strokeLinejoin="round"
              />

              {chart.points.map((point, index) => {
                const isLast = index === chart.points.length - 1;
                return (
                  <g key={`${point.x}-${point.y}`}>
                    <circle
                      cx={point.x}
                      cy={point.y}
                      r={isLast ? 2.9 : 2.1}
                      fill={isLast ? '#BBFF5C' : '#9FD8FF'}
                      stroke="rgba(6,8,12,0.55)"
                      strokeWidth="0.8"
                    />
                  </g>
                );
              })}

              <defs>
                <linearGradient id={gradientId} x1="0%" y1="0%" x2="0%" y2="100%">
                  <stop offset="0%" stopColor="rgba(10,132,255,0.42)" />
                  <stop offset="100%" stopColor="rgba(10,132,255,0)" />
                </linearGradient>
                <linearGradient id={strokeGradientId} x1="0%" y1="0%" x2="100%" y2="0%">
                  <stop offset="0%" stopColor="#6CC8FF" />
                  <stop offset="100%" stopColor="#0A84FF" />
                </linearGradient>
              </defs>
            </svg>
          )}
        </div>

        <div className="mt-4 flex items-center justify-between text-xs text-text-tertiary">
          <span>{chart.firstLabel}</span>
          <span>{chart.midLabel}</span>
          <span>{chart.lastLabel}</span>
        </div>

        <div className="mt-1 flex items-center justify-between text-[11px] text-text-tertiary">
          <span>Min {chart.minLabel}</span>
          <span>Max {chart.maxLabel}</span>
        </div>
      </div>
    </Card>);

}
