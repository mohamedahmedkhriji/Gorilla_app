import React, { useEffect, useMemo, useState } from 'react';
import { Header } from '../ui/Header';
import { Card } from '../ui/Card';
import { Button } from '../ui/Button';
import { api } from '../../services/api';

interface WeeklyCheckInScreenProps {
  onBack: () => void;
}

type TrendPoint = {
  date: string;
  recovery: number | null;
  risk: number | null;
  readiness: number | null;
  confidence: number | null;
};

const toNumberOrNull = (value: string) => {
  if (value === '') return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
};

const getCurrentUserId = () => {
  const user = JSON.parse(localStorage.getItem('appUser') || localStorage.getItem('user') || '{}');
  const localUserId = Number(localStorage.getItem('appUserId') || localStorage.getItem('userId') || 0);
  const parsedUserId = Number(user?.id || 0);
  return localUserId || parsedUserId || 0;
};

const formatDate = (isoDate: string) => {
  const date = new Date(isoDate);
  if (Number.isNaN(date.getTime())) return isoDate;
  return date.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
};

export function WeeklyCheckInScreen({ onBack }: WeeklyCheckInScreenProps) {
  const [hoursSleep, setHoursSleep] = useState('7');
  const [stressLevel, setStressLevel] = useState('5');
  const [dailySteps, setDailySteps] = useState('8000');
  const [hydrationLevel, setHydrationLevel] = useState('2.2');
  const [restingHeartRate, setRestingHeartRate] = useState('65');
  const [systolic, setSystolic] = useState('120');
  const [diastolic, setDiastolic] = useState('80');
  const [painLevel, setPainLevel] = useState('0');
  const [smokingStatus, setSmokingStatus] = useState('Never');
  const [injuryReported, setInjuryReported] = useState(false);
  const [chestPain, setChestPain] = useState(false);
  const [dizziness, setDizziness] = useState(false);

  const [loadingHistory, setLoadingHistory] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [latestInsights, setLatestInsights] = useState<any>(null);
  const [latestAdaptation, setLatestAdaptation] = useState<any>(null);
  const [trend, setTrend] = useState<TrendPoint[]>([]);

  const userId = useMemo(() => getCurrentUserId(), []);

  const loadHistory = async () => {
    if (!userId) {
      setLoadingHistory(false);
      return;
    }

    setLoadingHistory(true);
    try {
      const history = await api.getUserInsightsHistory(userId, {
        days: 90,
        limit: 120,
        scoreTypes: ['recovery', 'risk', 'readiness', 'confidence'],
      });
      const normalizedTrend = Array.isArray(history?.trend)
        ? history.trend.map((point: any) => ({
            date: String(point?.date || ''),
            recovery: typeof point?.recovery === 'number' ? point.recovery : null,
            risk: typeof point?.risk === 'number' ? point.risk : null,
            readiness: typeof point?.readiness === 'number' ? point.readiness : null,
            confidence: typeof point?.confidence === 'number' ? point.confidence : null,
          }))
        : [];
      setTrend(normalizedTrend);
    } catch (historyError: any) {
      console.error('Failed to load insight history:', historyError);
      setError(historyError?.message || 'Failed to load insight history');
    } finally {
      setLoadingHistory(false);
    }
  };

  useEffect(() => {
    void loadHistory();
  }, []);

  const handleSubmit = async () => {
    if (!userId) {
      setError('No active user session found.');
      return;
    }

    setError('');
    setSuccess('');
    setSaving(true);

    try {
      const input = {
        hoursSleep: toNumberOrNull(hoursSleep),
        stressLevel: toNumberOrNull(stressLevel),
        dailySteps: toNumberOrNull(dailySteps),
        hydrationLevel: toNumberOrNull(hydrationLevel),
        restingHeartRate: toNumberOrNull(restingHeartRate),
        systolic: toNumberOrNull(systolic),
        diastolic: toNumberOrNull(diastolic),
        painLevel: toNumberOrNull(painLevel),
        smokingStatus,
        injuryReported,
        chestPain,
        dizziness,
      };

      const payload = await api.saveUserAnalysisInsights(userId, input, {
        source: 'weekly_checkin',
        autoAdaptPlan: true,
        snapshotDate: new Date().toISOString().slice(0, 10),
        modelVersion: 'fitness_insights_v2',
      });

      setLatestInsights(payload?.insights || null);
      setLatestAdaptation(payload?.adaptation || null);
      setSuccess('Weekly check-in saved. Plan adaptation was evaluated.');
      await loadHistory();
    } catch (submitError: any) {
      console.error('Failed to submit weekly check-in:', submitError);
      setError(submitError?.message || 'Failed to submit weekly check-in');
    } finally {
      setSaving(false);
    }
  };

  const trendPreview = trend.slice(-8);
  const latestPoint = trend.length ? trend[trend.length - 1] : null;

  return (
    <div className="flex-1 flex flex-col pb-24">
      <Header title="Weekly Check-In" onBack={onBack} />

      <div className="space-y-4">
        {error && (
          <div className="rounded-xl border border-red-500/40 bg-red-500/10 p-3 text-sm text-red-300">
            {error}
          </div>
        )}
        {success && (
          <div className="rounded-xl border border-green-500/40 bg-green-500/10 p-3 text-sm text-green-300">
            {success}
          </div>
        )}

        <Card>
          <h3 className="text-sm font-medium text-white mb-4">Recovery Inputs</h3>
          <div className="grid grid-cols-2 gap-3">
            <label className="text-xs text-text-secondary">
              Sleep (hours)
              <input type="number" min={0} max={14} step={0.1} value={hoursSleep} onChange={(e) => setHoursSleep(e.target.value)} className="mt-1 w-full bg-background border border-white/10 rounded-lg px-3 py-2 text-white" />
            </label>
            <label className="text-xs text-text-secondary">
              Stress (1-10)
              <input type="number" min={1} max={10} step={1} value={stressLevel} onChange={(e) => setStressLevel(e.target.value)} className="mt-1 w-full bg-background border border-white/10 rounded-lg px-3 py-2 text-white" />
            </label>
            <label className="text-xs text-text-secondary">
              Daily Steps
              <input type="number" min={0} max={50000} step={100} value={dailySteps} onChange={(e) => setDailySteps(e.target.value)} className="mt-1 w-full bg-background border border-white/10 rounded-lg px-3 py-2 text-white" />
            </label>
            <label className="text-xs text-text-secondary">
              Hydration (L)
              <input type="number" min={0} max={10} step={0.1} value={hydrationLevel} onChange={(e) => setHydrationLevel(e.target.value)} className="mt-1 w-full bg-background border border-white/10 rounded-lg px-3 py-2 text-white" />
            </label>
            <label className="text-xs text-text-secondary">
              Resting HR
              <input type="number" min={30} max={220} step={1} value={restingHeartRate} onChange={(e) => setRestingHeartRate(e.target.value)} className="mt-1 w-full bg-background border border-white/10 rounded-lg px-3 py-2 text-white" />
            </label>
            <label className="text-xs text-text-secondary">
              Pain (0-10)
              <input type="number" min={0} max={10} step={1} value={painLevel} onChange={(e) => setPainLevel(e.target.value)} className="mt-1 w-full bg-background border border-white/10 rounded-lg px-3 py-2 text-white" />
            </label>
            <label className="text-xs text-text-secondary">
              Systolic BP
              <input type="number" min={70} max={240} step={1} value={systolic} onChange={(e) => setSystolic(e.target.value)} className="mt-1 w-full bg-background border border-white/10 rounded-lg px-3 py-2 text-white" />
            </label>
            <label className="text-xs text-text-secondary">
              Diastolic BP
              <input type="number" min={40} max={140} step={1} value={diastolic} onChange={(e) => setDiastolic(e.target.value)} className="mt-1 w-full bg-background border border-white/10 rounded-lg px-3 py-2 text-white" />
            </label>
          </div>

          <div className="mt-3 grid grid-cols-1 sm:grid-cols-2 gap-3">
            <label className="text-xs text-text-secondary">
              Smoking Status
              <select value={smokingStatus} onChange={(e) => setSmokingStatus(e.target.value)} className="mt-1 w-full bg-background border border-white/10 rounded-lg px-3 py-2 text-white">
                <option value="Never">Never</option>
                <option value="Former">Former</option>
                <option value="Current">Current</option>
              </select>
            </label>
            <div className="text-xs text-text-secondary flex flex-wrap gap-4 items-end pb-1">
              <label className="inline-flex items-center gap-2 text-white">
                <input type="checkbox" checked={injuryReported} onChange={(e) => setInjuryReported(e.target.checked)} />
                Injury
              </label>
              <label className="inline-flex items-center gap-2 text-white">
                <input type="checkbox" checked={chestPain} onChange={(e) => setChestPain(e.target.checked)} />
                Chest pain
              </label>
              <label className="inline-flex items-center gap-2 text-white">
                <input type="checkbox" checked={dizziness} onChange={(e) => setDizziness(e.target.checked)} />
                Dizziness
              </label>
            </div>
          </div>

          <div className="mt-4">
            <Button onClick={handleSubmit} isLoading={saving}>
              Save Check-In + Adapt Plan
            </Button>
          </div>
        </Card>

        {(latestInsights || latestPoint) && (
          <Card>
            <h3 className="text-sm font-medium text-white mb-3">Latest Scores</h3>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              <div className="rounded-lg bg-white/5 p-3">
                <div className="text-xs text-text-secondary">Recovery</div>
                <div className="text-lg font-bold text-white">{Math.round(Number(latestInsights?.score ?? latestPoint?.recovery ?? 0))}</div>
              </div>
              <div className="rounded-lg bg-white/5 p-3">
                <div className="text-xs text-text-secondary">Risk</div>
                <div className="text-lg font-bold text-white">{Math.round(Number(latestInsights?.riskScore ?? latestPoint?.risk ?? 0))}</div>
              </div>
              <div className="rounded-lg bg-white/5 p-3">
                <div className="text-xs text-text-secondary">Readiness</div>
                <div className="text-lg font-bold text-white">{Math.round(Number(latestInsights?.readinessScore ?? latestPoint?.readiness ?? 0))}</div>
              </div>
              <div className="rounded-lg bg-white/5 p-3">
                <div className="text-xs text-text-secondary">Confidence</div>
                <div className="text-lg font-bold text-white">{Math.round(Number(latestInsights?.confidenceScore ?? latestPoint?.confidence ?? 0))}</div>
              </div>
            </div>
          </Card>
        )}

        {latestAdaptation && (
          <Card>
            <h3 className="text-sm font-medium text-white mb-2">Latest Adaptation</h3>
            <div className="text-sm text-text-secondary">
              Mode: <span className="text-white font-semibold">{String(latestAdaptation?.mode || 'maintain')}</span>
              {' '}| Adapted: <span className="text-white font-semibold">{String(Boolean(latestAdaptation?.adapted))}</span>
            </div>
          </Card>
        )}

        <Card>
          <h3 className="text-sm font-medium text-white mb-3">8-Point Trend</h3>
          {loadingHistory ? (
            <div className="text-sm text-text-secondary">Loading trend...</div>
          ) : trendPreview.length ? (
            <div className="space-y-2">
              {trendPreview.map((point) => (
                <div key={point.date} className="grid grid-cols-5 gap-2 text-xs">
                  <div className="text-text-secondary">{formatDate(point.date)}</div>
                  <div className="text-white">Rcv {point.recovery == null ? '-' : Math.round(point.recovery)}</div>
                  <div className="text-white">Risk {point.risk == null ? '-' : Math.round(point.risk)}</div>
                  <div className="text-white">Read {point.readiness == null ? '-' : Math.round(point.readiness)}</div>
                  <div className="text-white">Conf {point.confidence == null ? '-' : Math.round(point.confidence)}</div>
                </div>
              ))}
            </div>
          ) : (
            <div className="text-sm text-text-secondary">No trend data yet.</div>
          )}
        </Card>
      </div>
    </div>
  );
}

