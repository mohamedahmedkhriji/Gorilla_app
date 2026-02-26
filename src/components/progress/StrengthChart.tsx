import React, { useEffect, useMemo, useState, useId } from 'react';
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

export function StrengthChart() {
  const [data, setData] = useState<StrengthProgressResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const gradientId = useId().replace(/:/g, '');

  useEffect(() => {
    const localUserId = Number(localStorage.getItem('appUserId') || localStorage.getItem('userId') || 0);
    const user = JSON.parse(localStorage.getItem('appUser') || localStorage.getItem('user') || '{}');
    const parsedUserId = Number(user?.id || 0);
    const userId = localUserId || parsedUserId;

    if (!userId) {
      setLoading(false);
      return;
    }

    const fetchStrength = async () => {
      try {
        const response = await api.getStrengthProgress(userId, 8);
        setData(response);
      } catch (error) {
        console.error('Failed to load strength chart:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchStrength();
  }, []);

  const points = useMemo(() => data?.weeks || [], [data?.weeks]);
  const values = useMemo(() => points.map((p) => Number(p.avgE1RM || 0)), [points]);

  const chart = useMemo(() => {
    if (!values.length) return { linePath: '', areaPath: '', firstLabel: 'Week 1', midLabel: 'Week 4', lastLabel: 'Week 8' };

    const minValue = Math.min(...values);
    const maxValue = Math.max(...values);
    const range = maxValue - minValue || 1;

    const mapped = values.map((value, index) => {
      const x = values.length === 1 ? 50 : (index / (values.length - 1)) * 100;
      const normalized = (value - minValue) / range;
      const y = 90 - (normalized * 80);
      return { x, y };
    });

    const linePath = mapped.map((point, index) =>
      `${index === 0 ? 'M' : 'L'}${point.x},${point.y}`
    ).join(' ');

    const firstX = mapped[0]?.x ?? 0;
    const lastX = mapped[mapped.length - 1]?.x ?? 100;
    const areaPath = `${linePath} L${lastX},100 L${firstX},100 Z`;

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
    };
  }, [points, values]);

  const pct = Number(data?.summary?.percentChange || 0);
  const pctText = `${pct >= 0 ? '+' : ''}${pct}%`;

  return (
    <Card className="p-6">
      <div className="flex justify-between items-end mb-6">
        <div>
          <h3 className="text-lg font-medium text-white">Strength Progress</h3>
          <p className="text-xs text-text-secondary">Estimated 1RM Average</p>
        </div>
        <div className="text-2xl font-bold text-accent">
          {loading ? '--' : pctText}
        </div>
      </div>

      {/* Simple SVG Chart */}
      <div className="h-40 w-full relative">
        <svg
          className="w-full h-full overflow-visible"
          preserveAspectRatio="none"
          viewBox="0 0 100 100">

          {/* Grid lines */}
          <line
            x1="0"
            y1="0"
            x2="100"
            y2="0"
            stroke="rgba(255,255,255,0.05)"
            strokeWidth="1" />

          <line
            x1="0"
            y1="50"
            x2="100"
            y2="50"
            stroke="rgba(255,255,255,0.05)"
            strokeWidth="1" />

          <line
            x1="0"
            y1="100"
            x2="100"
            y2="100"
            stroke="rgba(255,255,255,0.05)"
            strokeWidth="1" />


          {/* Line */}
          {chart.linePath && (
            <path
              d={chart.linePath}
              fill="none"
              stroke="#0A84FF"
              strokeWidth="3"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          )}


          {/* Area under curve */}
          {chart.areaPath && (
            <path
              d={chart.areaPath}
              fill={`url(#${gradientId})`}
              opacity="0.2"
            />
          )}


          <defs>
            <linearGradient id={gradientId} x1="0%" y1="0%" x2="0%" y2="100%">
              <stop offset="0%" stopColor="#0A84FF" />
              <stop offset="100%" stopColor="#0A84FF" stopOpacity="0" />
            </linearGradient>
          </defs>
        </svg>
      </div>

      <div className="flex justify-between text-xs text-text-tertiary mt-4">
        <span>{chart.firstLabel}</span>
        <span>{chart.midLabel}</span>
        <span>{chart.lastLabel}</span>
      </div>
    </Card>);

}
