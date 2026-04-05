import React, { useEffect, useMemo, useState } from 'react';
import { Header } from '../ui/Header';
import { Card } from '../ui/Card';
import { Button } from '../ui/Button';
import { api } from '../../services/api';
import { AppLanguage, getActiveLanguage, getLanguageLocale, pickLanguage } from '../../services/language';

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

const formatDate = (isoDate: string, language: AppLanguage) => {
  const date = new Date(isoDate);
  if (Number.isNaN(date.getTime())) return isoDate;
  return date.toLocaleDateString(getLanguageLocale(language), { month: 'short', day: 'numeric' });
};

const getCopy = (language: AppLanguage) =>
  pickLanguage(language, {
    en: {
      title: 'Weekly Check-In',
      recoveryInputs: 'Recovery Inputs',
      sleepHours: 'Sleep (hours)',
      stress: 'Stress (1-10)',
      dailySteps: 'Daily Steps',
      hydration: 'Hydration (L)',
      restingHr: 'Resting HR',
      pain: 'Pain (0-10)',
      systolic: 'Systolic BP',
      diastolic: 'Diastolic BP',
      smokingStatus: 'Smoking Status',
      smokingNever: 'Never',
      smokingFormer: 'Former',
      smokingCurrent: 'Current',
      injury: 'Injury',
      chestPain: 'Chest pain',
      dizziness: 'Dizziness',
      save: 'Save Check-In + Adapt Plan',
      latestScores: 'Latest Scores',
      recovery: 'Recovery',
      risk: 'Risk',
      readiness: 'Readiness',
      confidence: 'Confidence',
      latestAdaptation: 'Latest Adaptation',
      mode: 'Mode',
      adapted: 'Adapted',
      yes: 'Yes',
      no: 'No',
      trendTitle: '8-Point Trend',
      loadingTrend: 'Loading trend...',
      noTrend: 'No trend data yet.',
      successSaved: 'Weekly check-in saved. Plan adaptation was evaluated.',
      noSession: 'No active user session found.',
      failedLoad: 'Failed to load insight history',
      failedSubmit: 'Failed to submit weekly check-in',
      recoveryShort: 'Rcv',
      riskShort: 'Risk',
      readinessShort: 'Read',
      confidenceShort: 'Conf',
    },
    ar: {
      title: 'تسجيل أسبوعي',
      recoveryInputs: 'مدخلات التعافي',
      sleepHours: 'النوم (ساعات)',
      stress: 'التوتر (1-10)',
      dailySteps: 'الخطوات اليومية',
      hydration: 'الترطيب (لتر)',
      restingHr: 'نبض الراحة',
      pain: 'الألم (0-10)',
      systolic: 'الضغط الانقباضي',
      diastolic: 'الضغط الانبساطي',
      smokingStatus: 'حالة التدخين',
      smokingNever: 'أبدًا',
      smokingFormer: 'سابقًا',
      smokingCurrent: 'حاليًا',
      injury: 'إصابة',
      chestPain: 'ألم في الصدر',
      dizziness: 'دوخة',
      save: 'حفظ التسجيل وتكييف الخطة',
      latestScores: 'أحدث الدرجات',
      recovery: 'التعافي',
      risk: 'المخاطر',
      readiness: 'الجاهزية',
      confidence: 'الثقة',
      latestAdaptation: 'آخر تكييف',
      mode: 'الوضع',
      adapted: 'تم التكييف',
      yes: 'نعم',
      no: 'لا',
      trendTitle: 'اتجاه آخر 8 نقاط',
      loadingTrend: 'جارٍ تحميل الاتجاه...',
      noTrend: 'لا توجد بيانات اتجاه بعد.',
      successSaved: 'تم حفظ التسجيل الأسبوعي وتم تقييم تكييف الخطة.',
      noSession: 'لا توجد جلسة مستخدم نشطة.',
      failedLoad: 'تعذر تحميل سجل التحليلات',
      failedSubmit: 'تعذر إرسال التسجيل الأسبوعي',
      recoveryShort: 'تعافٍ',
      riskShort: 'مخاطر',
      readinessShort: 'جاهزية',
      confidenceShort: 'ثقة',
    },
    it: {
      title: 'Check-in settimanale',
      recoveryInputs: 'Dati di recupero',
      sleepHours: 'Sonno (ore)',
      stress: 'Stress (1-10)',
      dailySteps: 'Passi giornalieri',
      hydration: 'Idratazione (L)',
      restingHr: 'FC a riposo',
      pain: 'Dolore (0-10)',
      systolic: 'Pressione sistolica',
      diastolic: 'Pressione diastolica',
      smokingStatus: 'Stato fumo',
      smokingNever: 'Mai',
      smokingFormer: 'Ex fumatore',
      smokingCurrent: 'Attuale',
      injury: 'Infortunio',
      chestPain: 'Dolore al petto',
      dizziness: 'Vertigini',
      save: 'Salva check-in + adatta piano',
      latestScores: 'Punteggi piu recenti',
      recovery: 'Recupero',
      risk: 'Rischio',
      readiness: 'Prontezza',
      confidence: 'Fiducia',
      latestAdaptation: 'Ultimo adattamento',
      mode: 'Modalita',
      adapted: 'Adattato',
      yes: 'Si',
      no: 'No',
      trendTitle: 'Trend a 8 punti',
      loadingTrend: 'Caricamento trend...',
      noTrend: 'Nessun dato trend ancora.',
      successSaved: 'Check-in settimanale salvato. L adattamento del piano e stato valutato.',
      noSession: 'Nessuna sessione utente attiva trovata.',
      failedLoad: 'Impossibile caricare la cronologia degli insight',
      failedSubmit: 'Impossibile inviare il check-in settimanale',
      recoveryShort: 'Rec',
      riskShort: 'Rischio',
      readinessShort: 'Pront',
      confidenceShort: 'Fid',
    },
    de: {
      title: 'Wochen-Check-in',
      recoveryInputs: 'Erholungsdaten',
      sleepHours: 'Schlaf (Stunden)',
      stress: 'Stress (1-10)',
      dailySteps: 'Taegliche Schritte',
      hydration: 'Hydration (L)',
      restingHr: 'Ruhepuls',
      pain: 'Schmerz (0-10)',
      systolic: 'Systolischer Blutdruck',
      diastolic: 'Diastolischer Blutdruck',
      smokingStatus: 'Rauchstatus',
      smokingNever: 'Nie',
      smokingFormer: 'Frueher',
      smokingCurrent: 'Aktuell',
      injury: 'Verletzung',
      chestPain: 'Brustschmerz',
      dizziness: 'Schwindel',
      save: 'Check-in speichern + Plan anpassen',
      latestScores: 'Neueste Werte',
      recovery: 'Erholung',
      risk: 'Risiko',
      readiness: 'Bereitschaft',
      confidence: 'Vertrauen',
      latestAdaptation: 'Letzte Anpassung',
      mode: 'Modus',
      adapted: 'Angepasst',
      yes: 'Ja',
      no: 'Nein',
      trendTitle: '8-Punkte-Trend',
      loadingTrend: 'Trend wird geladen...',
      noTrend: 'Noch keine Trenddaten vorhanden.',
      successSaved: 'Wochen-Check-in gespeichert. Die Plananpassung wurde ausgewertet.',
      noSession: 'Keine aktive Benutzersitzung gefunden.',
      failedLoad: 'Einblick-Verlauf konnte nicht geladen werden',
      failedSubmit: 'Wochen-Check-in konnte nicht gesendet werden',
      recoveryShort: 'Erhol',
      riskShort: 'Risiko',
      readinessShort: 'Bereit',
      confidenceShort: 'Vertr',
    },
  });

export function WeeklyCheckInScreen({ onBack }: WeeklyCheckInScreenProps) {
  const [language, setLanguage] = useState<AppLanguage>(() => getActiveLanguage());
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
  const copy = getCopy(language);
  const isArabic = language === 'ar';

  useEffect(() => {
    setLanguage(getActiveLanguage());

    const handleLanguageChanged = () => {
      setLanguage(getActiveLanguage());
    };

    window.addEventListener('app-language-changed', handleLanguageChanged);
    window.addEventListener('storage', handleLanguageChanged);

    return () => {
      window.removeEventListener('app-language-changed', handleLanguageChanged);
      window.removeEventListener('storage', handleLanguageChanged);
    };
  }, []);

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
      setError(historyError?.message || copy.failedLoad);
    } finally {
      setLoadingHistory(false);
    }
  };

  useEffect(() => {
    void loadHistory();
  }, [userId]);

  const handleSubmit = async () => {
    if (!userId) {
      setError(copy.noSession);
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
      setSuccess(copy.successSaved);
      await loadHistory();
    } catch (submitError: any) {
      console.error('Failed to submit weekly check-in:', submitError);
      setError(submitError?.message || copy.failedSubmit);
    } finally {
      setSaving(false);
    }
  };

  const trendPreview = trend.slice(-8);
  const latestPoint = trend.length ? trend[trend.length - 1] : null;

  return (
    <div className={`flex-1 flex flex-col pb-24 ${isArabic ? 'text-right' : 'text-left'}`} dir={isArabic ? 'rtl' : 'ltr'}>
      <Header title={copy.title} onBack={onBack} titleClassName={isArabic ? 'text-right' : ''} />

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
          <h3 className="text-sm font-medium text-white mb-4">{copy.recoveryInputs}</h3>
          <div className="grid grid-cols-2 gap-3">
            <label className="text-xs text-text-secondary">
              {copy.sleepHours}
              <input type="number" min={0} max={14} step={0.1} value={hoursSleep} onChange={(e) => setHoursSleep(e.target.value)} className="mt-1 w-full bg-background border border-white/10 rounded-lg px-3 py-2 text-white" />
            </label>
            <label className="text-xs text-text-secondary">
              {copy.stress}
              <input type="number" min={1} max={10} step={1} value={stressLevel} onChange={(e) => setStressLevel(e.target.value)} className="mt-1 w-full bg-background border border-white/10 rounded-lg px-3 py-2 text-white" />
            </label>
            <label className="text-xs text-text-secondary">
              {copy.dailySteps}
              <input type="number" min={0} max={50000} step={100} value={dailySteps} onChange={(e) => setDailySteps(e.target.value)} className="mt-1 w-full bg-background border border-white/10 rounded-lg px-3 py-2 text-white" />
            </label>
            <label className="text-xs text-text-secondary">
              {copy.hydration}
              <input type="number" min={0} max={10} step={0.1} value={hydrationLevel} onChange={(e) => setHydrationLevel(e.target.value)} className="mt-1 w-full bg-background border border-white/10 rounded-lg px-3 py-2 text-white" />
            </label>
            <label className="text-xs text-text-secondary">
              {copy.restingHr}
              <input type="number" min={30} max={220} step={1} value={restingHeartRate} onChange={(e) => setRestingHeartRate(e.target.value)} className="mt-1 w-full bg-background border border-white/10 rounded-lg px-3 py-2 text-white" />
            </label>
            <label className="text-xs text-text-secondary">
              {copy.pain}
              <input type="number" min={0} max={10} step={1} value={painLevel} onChange={(e) => setPainLevel(e.target.value)} className="mt-1 w-full bg-background border border-white/10 rounded-lg px-3 py-2 text-white" />
            </label>
            <label className="text-xs text-text-secondary">
              {copy.systolic}
              <input type="number" min={70} max={240} step={1} value={systolic} onChange={(e) => setSystolic(e.target.value)} className="mt-1 w-full bg-background border border-white/10 rounded-lg px-3 py-2 text-white" />
            </label>
            <label className="text-xs text-text-secondary">
              {copy.diastolic}
              <input type="number" min={40} max={140} step={1} value={diastolic} onChange={(e) => setDiastolic(e.target.value)} className="mt-1 w-full bg-background border border-white/10 rounded-lg px-3 py-2 text-white" />
            </label>
          </div>

          <div className="mt-3 grid grid-cols-1 sm:grid-cols-2 gap-3">
            <label className="text-xs text-text-secondary">
              {copy.smokingStatus}
              <select value={smokingStatus} onChange={(e) => setSmokingStatus(e.target.value)} className="mt-1 w-full bg-background border border-white/10 rounded-lg px-3 py-2 text-white">
                <option value="Never">{copy.smokingNever}</option>
                <option value="Former">{copy.smokingFormer}</option>
                <option value="Current">{copy.smokingCurrent}</option>
              </select>
            </label>
            <div className="text-xs text-text-secondary flex flex-wrap gap-4 items-end pb-1">
              <label className="inline-flex items-center gap-2 text-white">
                <input type="checkbox" checked={injuryReported} onChange={(e) => setInjuryReported(e.target.checked)} />
                {copy.injury}
              </label>
              <label className="inline-flex items-center gap-2 text-white">
                <input type="checkbox" checked={chestPain} onChange={(e) => setChestPain(e.target.checked)} />
                {copy.chestPain}
              </label>
              <label className="inline-flex items-center gap-2 text-white">
                <input type="checkbox" checked={dizziness} onChange={(e) => setDizziness(e.target.checked)} />
                {copy.dizziness}
              </label>
            </div>
          </div>

          <div className="mt-4">
            <Button onClick={handleSubmit} isLoading={saving}>
              {copy.save}
            </Button>
          </div>
        </Card>

        {(latestInsights || latestPoint) && (
          <Card>
            <h3 className="text-sm font-medium text-white mb-3">{copy.latestScores}</h3>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              <div className="rounded-lg bg-white/5 p-3">
                <div className="text-xs text-text-secondary">{copy.recovery}</div>
                <div className="text-lg font-bold text-white">{Math.round(Number(latestInsights?.score ?? latestPoint?.recovery ?? 0))}</div>
              </div>
              <div className="rounded-lg bg-white/5 p-3">
                <div className="text-xs text-text-secondary">{copy.risk}</div>
                <div className="text-lg font-bold text-white">{Math.round(Number(latestInsights?.riskScore ?? latestPoint?.risk ?? 0))}</div>
              </div>
              <div className="rounded-lg bg-white/5 p-3">
                <div className="text-xs text-text-secondary">{copy.readiness}</div>
                <div className="text-lg font-bold text-white">{Math.round(Number(latestInsights?.readinessScore ?? latestPoint?.readiness ?? 0))}</div>
              </div>
              <div className="rounded-lg bg-white/5 p-3">
                <div className="text-xs text-text-secondary">{copy.confidence}</div>
                <div className="text-lg font-bold text-white">{Math.round(Number(latestInsights?.confidenceScore ?? latestPoint?.confidence ?? 0))}</div>
              </div>
            </div>
          </Card>
        )}

        {latestAdaptation && (
          <Card>
            <h3 className="text-sm font-medium text-white mb-2">{copy.latestAdaptation}</h3>
            <div className="text-sm text-text-secondary">
              {copy.mode}: <span className="text-white font-semibold">{String(latestAdaptation?.mode || 'maintain')}</span>
              {' '}| {copy.adapted}: <span className="text-white font-semibold">{Boolean(latestAdaptation?.adapted) ? copy.yes : copy.no}</span>
            </div>
          </Card>
        )}

        <Card>
          <h3 className="text-sm font-medium text-white mb-3">{copy.trendTitle}</h3>
          {loadingHistory ? (
            <div className="text-sm text-text-secondary">{copy.loadingTrend}</div>
          ) : trendPreview.length ? (
            <div className="space-y-2">
              {trendPreview.map((point) => (
                <div key={point.date} className="grid grid-cols-5 gap-2 text-xs">
                  <div className="text-text-secondary">{formatDate(point.date, language)}</div>
                  <div className="text-white">{copy.recoveryShort} {point.recovery == null ? '-' : Math.round(point.recovery)}</div>
                  <div className="text-white">{copy.riskShort} {point.risk == null ? '-' : Math.round(point.risk)}</div>
                  <div className="text-white">{copy.readinessShort} {point.readiness == null ? '-' : Math.round(point.readiness)}</div>
                  <div className="text-white">{copy.confidenceShort} {point.confidence == null ? '-' : Math.round(point.confidence)}</div>
                </div>
              ))}
            </div>
          ) : (
            <div className="text-sm text-text-secondary">{copy.noTrend}</div>
          )}
        </Card>
      </div>
    </div>
  );
}
