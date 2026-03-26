import React, { useMemo, useState, useEffect, useCallback } from 'react';
import { Button } from '../ui/Button';
import { Card } from '../ui/Card';
import {
  CalendarDays,
  Dumbbell,
  Share2,
  NotebookPen,
  CheckCircle2,
  X,
} from 'lucide-react';
import { AppLanguage, getActiveLanguage, getStoredLanguage } from '../../services/language';
import { stripExercisePrefix } from '../../services/exerciseName';

export type WorkoutSummarySet = {
  set: number;
  reps: number;
  weight: number;
};

export type WorkoutSummaryExercise = {
  name: string;
  sets: WorkoutSummarySet[];
  totalSets: number;
  totalReps: number;
  topWeight: number;
  volume: number;
  targetMuscles: string[];
};

export type WorkoutSummaryMuscle = {
  name: string;
  score: number;
};

export type WorkoutDaySummaryData = {
  id?: number;
  summaryDate: string | null;
  workoutName: string;
  durationSeconds: number;
  estimatedCalories: number;
  totalVolume: number;
  recordsCount: number;
  muscles: WorkoutSummaryMuscle[];
  exercises: WorkoutSummaryExercise[];
  summaryText?: string;
};

interface PostWorkoutSummaryProps {
  onClose: () => void;
  summary: WorkoutDaySummaryData | null;
  loading?: boolean;
  error?: string | null;
  onShare?: (summary: WorkoutDaySummaryData) => Promise<void> | void;
  onPostToBlog?: (summary: WorkoutDaySummaryData) => Promise<void> | void;
  blogPosted?: boolean;
  topContent?: React.ReactNode;
}

const formatDuration = (seconds: number) => {
  const normalized = Math.max(0, Math.round(Number(seconds || 0)));
  const h = Math.floor(normalized / 3600);
  const m = Math.floor((normalized % 3600) / 60);
  const s = normalized % 60;
  if (h > 0) return `${h}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
  return `${m}:${String(s).padStart(2, '0')}`;
};


const AR_MUSCLE_LABELS: Record<string, string> = {
  chest: 'الصدر',
  back: 'الظهر',
  shoulders: 'الأكتاف',
  'front shoulders': 'الأكتاف الأمامية',
  'side shoulders': 'الأكتاف الجانبية',
  'rear shoulders': 'الأكتاف الخلفية',
  triceps: 'الترايسبس',
  biceps: 'البايسبس',
  abs: 'البطن',
  quadriceps: 'الرباعية',
  hamstrings: 'الخلفية',
  calves: 'السمانة',
  forearms: 'الساعد',
  glutes: 'الألوية',
  adductors: 'المقربات',
  general: 'عام',
};

const POST_SUMMARY_I18N = {
  en: {
    today: 'Today',
    summaryTitle: 'Workout Summary',
    loading: 'Loading workout summary...',
    noSummary: 'No summary saved yet for this workout day.',
    back: 'Back',
    closeSummary: 'Close summary',
    duration: 'Duration',
    energy: 'Energy',
    volume: 'Volume',
    records: 'Records',
    muscles: 'Muscles',
    exercises: 'Exercises',
    setsLabel: 'sets',
    repsLabel: 'reps',
    topLabel: 'Top',
    kgLabel: 'kg',
    kcalLabel: 'Kcal',
    done: 'Done',
    share: 'Share',
    sharing: 'Sharing...',
    posting: 'Posting...',
    postToBlog: 'Post to Blog',
    postedToBlog: 'Posted to Blog',
    sharedFeedback: 'Workout summary shared.',
    shareError: 'Could not share this workout summary.',
    postedFeedback: 'Workout summary posted to your blog.',
    postError: 'Could not post workout summary to blog.',
    confirmBlogTitle: 'Post workout recap to Blogs?',
    confirmBlogBody: (workoutName: string) =>
      `This will create a new Training post in your Blogs feed for ${workoutName}.`,
    trainingLabel: 'Training',
    summaryLine: (duration: string, count: number) => `${duration} - ${count} exercises`,
    cancel: 'Cancel',
    confirmPost: 'Confirm Post',
  },
  ar: {
    today: 'اليوم',
    summaryTitle: 'ملخص التمرين',
    loading: 'جارٍ تحميل ملخص التمرين...',
    noSummary: 'لا يوجد ملخص محفوظ لهذا اليوم بعد.',
    back: 'رجوع',
    closeSummary: 'إغلاق الملخص',
    duration: 'المدة',
    energy: 'الطاقة',
    volume: 'الحجم',
    records: 'الأرقام',
    muscles: 'العضلات',
    exercises: 'التمارين',
    setsLabel: 'مجموعات',
    repsLabel: 'تكرارات',
    topLabel: 'الأعلى',
    kgLabel: 'كجم',
    kcalLabel: 'سعرة',
    done: 'تم',
    share: 'مشاركة',
    sharing: 'جارٍ المشاركة...',
    posting: 'جارٍ النشر...',
    postToBlog: 'نشر في المدونة',
    postedToBlog: 'تم النشر في المدونة',
    sharedFeedback: 'تمت مشاركة ملخص التمرين.',
    shareError: 'تعذر مشاركة ملخص التمرين.',
    postedFeedback: 'تم نشر ملخص التمرين في مدونتك.',
    postError: 'تعذر نشر ملخص التمرين في المدونة.',
    confirmBlogTitle: 'نشر ملخص التمرين في المدونة؟',
    confirmBlogBody: (workoutName: string) =>
      `سيتم إنشاء منشور تدريب جديد في المدونة لتمرين ${workoutName}.`,
    trainingLabel: 'التدريب',
    summaryLine: (duration: string, count: number) => `${duration} - ${count} تمارين`,
    cancel: 'إلغاء',
    confirmPost: 'تأكيد النشر',
  },
} as const;

type SummaryCopy = typeof POST_SUMMARY_I18N.en;

const AR_DAY_REPLACEMENTS: Array<{ pattern: RegExp; value: string }> = [
  { pattern: /\bMonday\b/gi, value: 'الاثنين' },
  { pattern: /\bMon\b/gi, value: 'الاثنين' },
  { pattern: /\bTuesday\b/gi, value: 'الثلاثاء' },
  { pattern: /\bTue\b/gi, value: 'الثلاثاء' },
  { pattern: /\bTues\b/gi, value: 'الثلاثاء' },
  { pattern: /\bWednesday\b/gi, value: 'الأربعاء' },
  { pattern: /\bWed\b/gi, value: 'الأربعاء' },
  { pattern: /\bThursday\b/gi, value: 'الخميس' },
  { pattern: /\bThu\b/gi, value: 'الخميس' },
  { pattern: /\bThur\b/gi, value: 'الخميس' },
  { pattern: /\bThurs\b/gi, value: 'الخميس' },
  { pattern: /\bFriday\b/gi, value: 'الجمعة' },
  { pattern: /\bFri\b/gi, value: 'الجمعة' },
  { pattern: /\bSaturday\b/gi, value: 'السبت' },
  { pattern: /\bSat\b/gi, value: 'السبت' },
  { pattern: /\bSunday\b/gi, value: 'الأحد' },
  { pattern: /\bSun\b/gi, value: 'الأحد' },
];

const formatSummaryDate = (isoDate: string | null, copy: SummaryCopy, locale?: string) => {
  if (!isoDate) return copy.today;
  const parsed = new Date(isoDate);
  if (Number.isNaN(parsed.getTime())) return copy.today;
  return parsed.toLocaleDateString(locale, {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  });
};

const formatWeight = (weight: number, unitLabel: string) => {
  const normalized = Number(weight || 0);
  if (!Number.isFinite(normalized) || normalized <= 0) return '-';
  return `${Number(normalized.toFixed(1)).toString().replace(/\.0$/, '')} ${unitLabel}`;
};

const getMuscleBadgeLabel = (muscle: WorkoutSummaryMuscle, toLocalizedMuscle: (value: string) => string) => {
  const score = Math.max(0, Math.min(100, Math.round(Number(muscle.score || 0))));
  return `${toLocalizedMuscle(muscle.name)} ${score}%`;
};

export function PostWorkoutSummary({
  onClose,
  summary,
  loading = false,
  error = null,
  onShare,
  onPostToBlog,
  blogPosted = false,
  topContent = null,
}: PostWorkoutSummaryProps) {
  const [language, setLanguage] = useState<AppLanguage>('en');
  const [sharePending, setSharePending] = useState(false);
  const [blogPending, setBlogPending] = useState(false);
  const [confirmBlogPostOpen, setConfirmBlogPostOpen] = useState(false);
  const [feedback, setFeedback] = useState<string | null>(null);
  const copy = POST_SUMMARY_I18N[language] || POST_SUMMARY_I18N.en;
  const isArabic = language === 'ar';

  const toLocalizedMuscle = useCallback(
    (value: string) => (language === 'ar' ? (AR_MUSCLE_LABELS[value.trim().toLowerCase()] || value) : value),
    [language],
  );
  const localizeWorkoutName = useCallback(
    (value: string) => {
      if (language !== 'ar') return value;
      let next = value;
      AR_DAY_REPLACEMENTS.forEach(({ pattern, value: replacement }) => {
        next = next.replace(pattern, replacement);
      });
      next = next.replace(/\bWorkout\b/gi, 'تمرين').replace(/\bWeek\b/gi, 'الأسبوع');
      return next;
    },
    [language],
  );

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

  const topMuscles = useMemo(() => {
    if (!summary?.muscles?.length) return [];
    return [...summary.muscles]
      .sort((left, right) => Number(right.score || 0) - Number(left.score || 0))
      .slice(0, 4);
  }, [summary?.muscles]);

  const handleShare = async () => {
    if (!summary || !onShare || sharePending) return;
    setSharePending(true);
    setFeedback(null);
    try {
      await onShare(summary);
      setFeedback(copy.sharedFeedback);
    } catch (err) {
      const message = err instanceof Error ? err.message : copy.shareError;
      setFeedback(message);
    } finally {
      setSharePending(false);
    }
  };

  const handleConfirmPostToBlog = async () => {
    if (!summary || !onPostToBlog || blogPending) return;
    setBlogPending(true);
    setFeedback(null);
    try {
      await onPostToBlog(summary);
      setConfirmBlogPostOpen(false);
      setFeedback(copy.postedFeedback);
    } catch (err) {
      const message = err instanceof Error ? err.message : copy.postError;
      setFeedback(message);
    } finally {
      setBlogPending(false);
    }
  };

  if (loading) {
    return (
      <div className="flex-1 flex items-center justify-center px-6 py-10">
        <div className="text-sm text-text-secondary">{copy.loading}</div>
      </div>
    );
  }

  if (!summary) {
    return (
      <div className="flex-1 flex flex-col px-6 py-8 max-w-md mx-auto w-full">
        <h1 className="text-2xl font-semibold text-white">{copy.summaryTitle}</h1>
        <Card className="mt-4">
          <p className="text-sm text-text-secondary">
            {error || copy.noSummary}
          </p>
        </Card>
        <div className="mt-6">
          <Button onClick={onClose}>{copy.back}</Button>
        </div>
      </div>
    );
  }

  return (
    <div className={`flex-1 flex flex-col h-full bg-background pb-24 ${isArabic ? 'text-right' : 'text-left'}`} dir={isArabic ? 'rtl' : 'ltr'}>
      <div className="px-4 sm:px-6 pt-4">
        <div className="mx-auto w-full max-w-xl rounded-2xl border border-white/10 bg-card/80 p-4">
          <div className={`flex items-start justify-between gap-3 ${isArabic ? 'flex-row-reverse' : ''}`}>
            <div className="flex items-center gap-2 text-text-secondary text-sm">
              <CalendarDays size={15} />
              <span>{formatSummaryDate(summary.summaryDate, copy, isArabic ? 'ar' : undefined)}</span>
            </div>
            <button
              type="button"
              onClick={onClose}
              className="flex h-8 w-8 items-center justify-center rounded-full border border-white/10 bg-white/5 text-text-secondary transition-colors hover:border-white/20 hover:bg-white/10 hover:text-white"
              aria-label={copy.closeSummary}
            >
              <X size={14} />
            </button>
          </div>
          <h1 className="mt-2 text-2xl font-semibold text-white">{localizeWorkoutName(summary.workoutName)}</h1>
          <div className="mt-4 grid grid-cols-2 gap-3">
            <div className="rounded-xl border border-white/8 bg-background/60 p-3">
              <div className="text-xs uppercase tracking-wider text-text-secondary">{copy.duration}</div>
              <div className="mt-1 text-2xl font-semibold text-white">{formatDuration(summary.durationSeconds)}</div>
            </div>
            <div className="rounded-xl border border-white/8 bg-background/60 p-3">
              <div className="text-xs uppercase tracking-wider text-text-secondary">{copy.energy}</div>
              <div className="mt-1 text-2xl font-semibold text-[#ff6070]">{summary.estimatedCalories.toLocaleString()} {copy.kcalLabel}</div>
            </div>
            <div className="rounded-xl border border-white/8 bg-background/60 p-3">
              <div className="text-xs uppercase tracking-wider text-text-secondary">{copy.volume}</div>
              <div className="mt-1 text-2xl font-semibold text-[#42b9ff]">{Math.round(summary.totalVolume).toLocaleString()} {copy.kgLabel}</div>
            </div>
            <div className="rounded-xl border border-white/8 bg-background/60 p-3">
              <div className="text-xs uppercase tracking-wider text-text-secondary">{copy.records}</div>
              <div className="mt-1 text-2xl font-semibold text-[#b7ff3f]">{summary.recordsCount}</div>
            </div>
          </div>

          {!!topMuscles.length && (
            <div className="mt-3 rounded-xl border border-white/8 bg-background/60 p-3">
              <div className="text-xs uppercase tracking-wider text-text-secondary">{copy.muscles}</div>
              <div className="mt-2 flex flex-wrap gap-2">
                {topMuscles.map((muscle) => (
                  <span
                    key={`${muscle.name}-${muscle.score}`}
                    className="inline-flex rounded-full border border-white/10 bg-white/5 px-2.5 py-1 text-xs text-white"
                  >
                    {getMuscleBadgeLabel(muscle, toLocalizedMuscle)}
                  </span>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>

      <div className="px-4 sm:px-6 mt-4 flex-1 overflow-y-auto">
        <div className="mx-auto w-full max-w-xl">
          {topContent && (
            <div className="mb-4">
              {topContent}
            </div>
          )}
          <div className={`mb-3 flex items-center justify-between ${isArabic ? 'flex-row-reverse' : ''}`}>
            <h2 className="text-2xl font-semibold text-white">{copy.exercises}</h2>
            <span className="text-sm text-text-secondary">{summary.exercises.length}</span>
          </div>

          <div className="space-y-3 pb-5">
            {summary.exercises.map((exercise) => (
              <Card key={exercise.name} className="!p-4">
                <div className={`flex items-start justify-between gap-2 ${isArabic ? 'flex-row-reverse' : ''}`}>
                  <div className="min-w-0">
                    <h3 className="truncate text-base font-semibold text-white">{stripExercisePrefix(exercise.name)}</h3>
                    <p className="mt-1 text-xs text-text-secondary">
                      {exercise.totalSets} {copy.setsLabel} - {exercise.totalReps} {copy.repsLabel} - {copy.topLabel} {formatWeight(exercise.topWeight, copy.kgLabel)}
                    </p>
                  </div>
                  <div className="inline-flex items-center gap-1 rounded-full bg-emerald-500/10 px-2 py-1 text-xs text-emerald-400">
                    <CheckCircle2 size={13} />
                    {copy.done}
                  </div>
                </div>

                {!!exercise.sets?.length && (
                  <div className="mt-3 space-y-1 text-sm text-text-secondary">
                    {exercise.sets.map((setRow) => (
                      <div key={`${exercise.name}-${setRow.set}`}>
                        {setRow.reps} x {formatWeight(setRow.weight, copy.kgLabel)}
                      </div>
                    ))}
                  </div>
                )}
              </Card>
            ))}
          </div>
        </div>
      </div>

      <div className="px-4 sm:px-6 pb-6 pt-2">
        <div className="mx-auto w-full max-w-xl space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <button
              type="button"
              onClick={() => { void handleShare(); }}
              disabled={sharePending || !onShare}
              className="inline-flex items-center justify-center gap-2 rounded-xl border border-white/10 bg-card px-4 py-3 text-sm font-semibold text-white transition-colors hover:border-accent/35 hover:bg-accent/10 disabled:cursor-not-allowed disabled:opacity-60"
            >
              <Share2 size={16} />
              {sharePending ? copy.sharing : copy.share}
            </button>
            <button
              type="button"
              onClick={() => {
                setFeedback(null);
                setConfirmBlogPostOpen(true);
              }}
              disabled={blogPending || !onPostToBlog || blogPosted}
              className="inline-flex items-center justify-center gap-2 rounded-xl border border-white/10 bg-card px-4 py-3 text-sm font-semibold text-white transition-colors hover:border-accent/35 hover:bg-accent/10 disabled:cursor-not-allowed disabled:opacity-60"
            >
              <NotebookPen size={16} />
              {blogPending ? copy.posting : blogPosted ? copy.postedToBlog : copy.postToBlog}
            </button>
          </div>

          {feedback && (
            <div className="rounded-xl border border-accent/25 bg-accent/10 px-3 py-2 text-xs text-accent">
              {feedback}
            </div>
          )}

          <Button onClick={onClose} className="gap-2">
            <Dumbbell size={16} />
            {copy.done}
          </Button>
        </div>
      </div>

      {confirmBlogPostOpen && summary && (
        <div
          className="fixed inset-0 z-50 bg-black/70 px-4 py-6 flex items-end sm:items-center justify-center"
          onClick={() => {
            if (!blogPending) setConfirmBlogPostOpen(false);
          }}
        >
          <div
            className={`w-full max-w-md rounded-2xl border border-white/10 bg-card p-4 shadow-2xl ${isArabic ? 'text-right' : 'text-left'}`}
            dir={isArabic ? 'rtl' : 'ltr'}
            onClick={(event) => event.stopPropagation()}
          >
            <div className="text-lg font-semibold text-white">{copy.confirmBlogTitle}</div>
            <p className="mt-2 text-sm leading-6 text-text-secondary">
              {copy.confirmBlogBody(localizeWorkoutName(summary.workoutName))}
            </p>
            <div className="mt-4 rounded-xl border border-white/8 bg-background/60 p-3 text-sm text-text-secondary">
              <div>{formatSummaryDate(summary.summaryDate, copy, isArabic ? 'ar' : undefined)}</div>
              <div className="mt-1">
                {copy.summaryLine(formatDuration(summary.durationSeconds), summary.exercises.length)}
              </div>
            </div>
            <div className={`mt-4 flex items-center gap-3 ${isArabic ? 'flex-row-reverse' : ''}`}>
              <button
                type="button"
                onClick={() => setConfirmBlogPostOpen(false)}
                disabled={blogPending}
                className="flex-1 rounded-xl border border-white/10 bg-white/5 px-4 py-3 text-sm font-semibold text-white transition-colors hover:bg-white/10 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {copy.cancel}
              </button>
              <button
                type="button"
                onClick={() => { void handleConfirmPostToBlog(); }}
                disabled={blogPending}
                className="flex-1 rounded-xl bg-accent px-4 py-3 text-sm font-semibold text-black transition-opacity hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {blogPending ? copy.posting : copy.confirmPost}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
