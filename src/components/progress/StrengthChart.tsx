import React, { useEffect, useMemo, useState, useId, useCallback } from 'react';
import { Card } from '../ui/Card';
import { api } from '../../services/api';
import { AppLanguage, getActiveLanguage, getLanguageLocale, getStoredLanguage } from '../../services/language';

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
  if (!Number.isFinite(numericValue) || numericValue <= 0) return '0 kg';
  return `${Math.round(numericValue)} kg`;
};

const STRENGTH_CHART_I18N = {
  en: {
    heading: 'Strength Progress',
    subtitle: 'Estimated 1RM weekly average',
    trend: 'Trend',
    baseline: 'Baseline',
    current: 'Current',
    noData: 'Log weighted sets to unlock your strength trend.',
    min: 'Min',
    max: 'Max',
    start: 'Start',
    mid: 'Mid',
    now: 'Now',
  },
  ar: {
    heading: 'تقدم القوة',
    subtitle: 'متوسط 1RM الأسبوعي التقديري',
    trend: 'الاتجاه',
    baseline: 'الأساس',
    current: 'الحالي',
    noData: 'سجل مجموعات بأوزان لعرض منحنى تقدم قوتك.',
    min: 'الحد الأدنى',
    max: 'الحد الأقصى',
    start: 'البداية',
    mid: 'الوسط',
    now: 'الآن',
  },
  it: {
    heading: 'Progressi di Forza',
    subtitle: 'Media settimanale stimata del 1RM',
    trend: 'Trend',
    baseline: 'Base',
    current: 'Attuale',
    noData: 'Registra serie con peso per sbloccare il tuo trend di forza.',
    min: 'Min',
    max: 'Max',
    start: 'Inizio',
    mid: 'Meta',
    now: 'Ora',
  },
  de: {
    heading: 'Kraftfortschritt',
    subtitle: 'Geschaetzter 1RM-Wochendurchschnitt',
    trend: 'Trend',
    baseline: 'Basis',
    current: 'Aktuell',
    noData: 'Protokolliere gewichtete Saetze, um deinen Krafttrend freizuschalten.',
    min: 'Min',
    max: 'Max',
    start: 'Start',
    mid: 'Mitte',
    now: 'Jetzt',
  },
} as const;

interface StrengthChartProps {
  coachmarkTargetId?: string;
}

export function StrengthChart({ coachmarkTargetId }: StrengthChartProps) {
  const [data, setData] = useState<StrengthProgressResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [language, setLanguage] = useState<AppLanguage>('en');
  const gradientId = useId().replace(/:/g, '');
  const strokeGradientId = `${gradientId}-stroke`;
  const copy = STRENGTH_CHART_I18N[language as keyof typeof STRENGTH_CHART_I18N] || STRENGTH_CHART_I18N.en;

  useEffect(() => {
    setLanguage(getActiveLanguage());

    const handleLanguageChanged = () => {
      setLanguage(getStoredLanguage());
    };

    window.addEventListener('app-language-changed', handleLanguageChanged);
    window.addEventListener('storage', handleLanguageChanged);
    return () => {
      window.removeEventListener('app-language-changed', handleLanguageChanged);
      window.removeEventListener('storage', handleLanguageChanged);
    };
  }, []);

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
        firstLabel: copy.start,
        midLabel: copy.mid,
        lastLabel: copy.now,
        points: [] as ChartPoint[],
        minLabel: '0 kg',
        maxLabel: '0 kg',
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
      return date.toLocaleDateString(getLanguageLocale(language), { month: 'short', day: 'numeric' });
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
  }, [copy.mid, copy.now, copy.start, language, points, values]);

  const hasStrengthData = points.length > 0;
  const pct = Number(data?.summary?.percentChange || 0);
  const roundedPct = Math.round(pct * 10) / 10;
  const pctText = hasStrengthData ? `${roundedPct >= 0 ? '+' : ''}${roundedPct}%` : '0%';
  const trendToneClass = pct > 0
    ? 'border-emerald-500/35 bg-emerald-500/10 text-emerald-400'
    : pct < 0
      ? 'border-rose-500/35 bg-rose-500/10 text-rose-400'
      : 'border-white/10 bg-white/5 text-text-secondary';

  const baselineText = formatKg(data?.summary?.baselineAvgE1RM);
  const currentText = formatKg(data?.summary?.currentAvgE1RM);

  return (
    <Card coachmarkTargetId={coachmarkTargetId} className="relative overflow-hidden p-6">
      <div className="pointer-events-none absolute inset-x-0 top-0 h-20 bg-[radial-gradient(circle_at_top_left,rgba(var(--color-accent)/0.18),transparent_70%)]" />
      <div className="relative">
        <div className="mb-5 flex items-start justify-between gap-4">
          <div>
            <h3 className="text-lg font-semibold text-text-primary">{copy.heading}</h3>
            <p className="text-xs text-text-secondary">{copy.subtitle}</p>
          </div>
          <div className={`rounded-xl border px-3 py-2 text-right ${trendToneClass}`}>
            <div className="text-[10px] uppercase tracking-[0.14em]">{copy.trend}</div>
            <div className="text-xl font-electrolize leading-none">{loading ? '0%' : pctText}</div>
          </div>
        </div>

        <div className="mb-4 grid grid-cols-2 gap-3 text-xs">
          <div className="rounded-xl border border-white/10 bg-background/45 px-3 py-2">
            <div className="uppercase tracking-[0.12em] text-text-tertiary">{copy.baseline}</div>
            <div className="mt-1 text-sm font-semibold text-text-primary">{loading ? '0 kg' : baselineText}</div>
          </div>
          <div className="rounded-xl border border-white/10 bg-background/45 px-3 py-2">
            <div className="uppercase tracking-[0.12em] text-text-tertiary">{copy.current}</div>
            <div className="mt-1 text-sm font-semibold text-text-primary">{loading ? '0 kg' : currentText}</div>
          </div>
        </div>

        <div className="relative h-44 w-full overflow-hidden rounded-xl border border-white/10 bg-background/35 p-2">
          {loading ? (
            <div className="h-full w-full animate-pulse rounded-lg bg-white/5" />
          ) : !hasStrengthData ? (
            <div className="flex h-full items-center justify-center rounded-lg border border-dashed border-white/12 text-center text-xs text-text-secondary">
              {copy.noData}
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
          <span>{copy.min} {chart.minLabel}</span>
          <span>{copy.max} {chart.maxLabel}</span>
        </div>
      </div>
    </Card>);

}
