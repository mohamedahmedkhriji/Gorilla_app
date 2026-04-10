import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Activity,
  BarChart3,
  CircleHelp,
  Dumbbell,
  Flame,
  Target,
  TrendingUp,
  Trophy,
  X,
} from 'lucide-react';
import { Header } from '../ui/Header';
import { Card } from '../ui/Card';
import { api } from '../../services/api';
import { getBodyPartImage } from '../../services/bodyPartTheme';
import { AppLanguage, getActiveLanguage, getStoredLanguage } from '../../services/language';

interface StrengthScoreScreenProps {
  onBack: () => void;
}

type RangeKey = 'month' | '6months' | 'year' | 'all';

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

type RecoveryMuscleItem = {
  name: string;
  muscle?: string;
  score: number;
};

type StrengthSupportData = {
  workoutStreakDays: number;
  weeklyCompletionRate: number;
  workoutsCompletedThisWeek: number;
  workoutsPlannedThisWeek: number;
  volumeLoadLast30Days: number;
  setsLoggedLast30Days: number;
  totalPoints: number;
  rank: string;
  totalWorkouts: number;
  overallRecovery: number;
  readyMuscles: number;
  almostReadyMuscles: number;
  damagedMuscles: number;
  recovery: RecoveryMuscleItem[];
};

const getMuscleImage = (muscle: string) => getBodyPartImage(muscle);

const rangeOptions: RangeKey[] = ['month', '6months', 'year', 'all'];

const defaultSupportData: StrengthSupportData = {
  workoutStreakDays: 0,
  weeklyCompletionRate: 0,
  workoutsCompletedThisWeek: 0,
  workoutsPlannedThisWeek: 0,
  volumeLoadLast30Days: 0,
  setsLoggedLast30Days: 0,
  totalPoints: 0,
  rank: '--',
  totalWorkouts: 0,
  overallRecovery: 100,
  readyMuscles: 0,
  almostReadyMuscles: 0,
  damagedMuscles: 0,
  recovery: [],
};

const getStoredUserId = () => {
  const localUserId = Number(localStorage.getItem('appUserId') || localStorage.getItem('userId') || 0);
  const user = JSON.parse(localStorage.getItem('appUser') || localStorage.getItem('user') || '{}');
  const parsedUserId = Number(user?.id || 0);
  return localUserId || parsedUserId;
};

const clamp = (value: number, min: number, max: number) => Math.min(max, Math.max(min, value));

const formatMetricNumber = (value: number) => {
  if (!Number.isFinite(value)) return '0';
  return Number.isInteger(value) ? value.toString() : value.toFixed(1);
};

const formatWeight = (value: number) => `${formatMetricNumber(value)} kg`;

const formatTons = (value: number) => {
  const tons = Number(value || 0) / 1000;
  if (!Number.isFinite(tons) || tons <= 0) return '0t';
  return `${formatMetricNumber(Number(tons.toFixed(1)))}t`;
};

const formatSigned = (value: number, suffix = '') => {
  const normalized = Number(value || 0);
  if (!Number.isFinite(normalized)) return `0${suffix}`;
  const sign = normalized > 0 ? '+' : normalized < 0 ? '-' : '';
  return `${sign}${formatMetricNumber(Math.abs(Number(normalized.toFixed(1))))}${suffix}`;
};

const getScoreFillPercent = (score: number) => clamp(((Number(score || 0) - 80) / 240) * 100, 0, 100);

const buildLinePath = (points: Array<{ x: number; y: number }>) => {
  if (!points.length) return '';
  return points
    .map((point, index) => `${index === 0 ? 'M' : 'L'} ${point.x},${point.y}`)
    .join(' ');
};

const buildAreaPath = (points: Array<{ x: number; y: number }>) => {
  if (!points.length) return '';
  const line = buildLinePath(points);
  const firstPoint = points[0];
  const lastPoint = points[points.length - 1];
  return `${line} L ${lastPoint.x},92 L ${firstPoint.x},92 Z`;
};

const getTrendToneClass = (value: number) => {
  if (value > 0) return 'border-emerald-400/30 bg-emerald-400/10 text-emerald-200';
  if (value < 0) return 'border-rose-400/30 bg-rose-400/10 text-rose-200';
  return 'border-white/10 bg-white/5 text-text-secondary';
};

const getRecoveryToneClass = (value: number) => {
  if (value >= 90) return 'border-emerald-400/30 bg-emerald-400/10 text-emerald-200';
  if (value >= 75) return 'border-[#10b981]/30 bg-[#10b981]/10 text-[#E7FF9C]';
  if (value >= 60) return 'border-amber-400/30 bg-amber-400/10 text-amber-200';
  return 'border-rose-400/30 bg-rose-400/10 text-rose-200';
};

const STRENGTH_SCORE_I18N = {
  en: {
    title: 'Strength Score',
    infoAria: 'Strength score info',
    trendPending: 'Trend pending',
    recovery: 'Recovery',
    avgSummary: (avgText: string, samples: number, range: string) =>
      `Avg E1RM ${avgText} from ${samples} weighted exercise-day samples in the selected ${range} range.`,
    noScoreYet: 'No strength score yet. Complete weighted sets and this page will start charting your score, muscle ranking, and trend.',
    rank: 'Rank',
    thisWeek: 'This Week',
    completion: 'completion',
    load30D: '30D Load',
    setsLogged: (sets: number) => `${sets} sets logged`,
    totalPoints: (points: number) => `${points.toLocaleString()} pts`,
    streak: 'Streak',
    workoutDaySingular: 'workout day',
    workoutDayPlural: 'workout days',
    score: 'Score',
    recent: 'recent',
    scoreRange: 'Score range',
    momentum: 'Momentum',
    weightedSamples: 'Weighted Samples',
    rangeStillBuilding: 'Range still building',
    samplesPerBucket: (value: number) => `${value} samples per bucket`,
    muscleAverage: 'Muscle Average',
    rankingPending: 'Ranking pending',
    musclesTracked: (count: number) => `${count} muscles tracked`,
    readiness: 'Readiness',
    readyNeedRest: (ready: number, needRest: number) => `${ready} ready | ${needRest} need rest`,
    strengthHistory: 'Strength History',
    start: 'Start',
    current: 'Current',
    change: 'Change',
    notEnoughWeightedSets: 'Not enough weighted sets yet. Log completed weighted sets to start building your trend.',
    vsPreviousBucket: (delta: string) => `${delta} vs previous bucket`,
    firstTrackedBucket: 'First tracked bucket',
    peakMuscle: 'Peak Muscle',
    developmentLane: 'Development Lane',
    trainingStatus: 'Training Status',
    needMoreStrengthData: 'Need more strength data',
    logMoreWeightedSets: 'Log more weighted sets to rank muscles.',
    opportunity: 'Opportunity',
    highlightsFurthest: 'This card highlights the muscle furthest from your top score.',
    planCompletionWeek: (percent: number) => `${percent}% plan completion this week`,
    musclesRecoverySummary: (ready: number, almost: number, damaged: number) =>
      `${ready} muscles ready, ${almost} almost ready, ${damaged} need more recovery.`,
    strengthPerMuscle: 'Strength per Muscle',
    muscleLeaderboard: 'Muscle leaderboard',
    rankedMuscles: (count: number) => `${count} ranked muscles from tracked exercise output`,
    rankingAppears: 'Ranking will appear once enough weighted sets are logged.',
    scoreBand: 'Score Band',
    outputGap: 'Output Gap',
    recShort: 'Rec',
    na: 'N/A',
    unlockLeaderboard: 'Start logging weighted sets to unlock your muscle leaderboard, strength tiers, and recovery-linked breakdown.',
    aboutTitle: 'About Strength Score',
    aboutSubtitle: (range: string) =>
      `This page combines your logged lifting output with training adherence and recovery data for the current ${range} range.`,
    closeInfo: 'Close strength score info',
    snapshotLine: 'Your main score is a strength snapshot built from completed weighted sets.',
    scoreCalcLine: 'For each exercise on each training day, the app takes your best estimated 1-rep max (E1RM), averages those values, and converts the result into a score from 80 to 320.',
    sectionMeaning: 'What each section means',
    heroMeaning: 'The hero card shows your current score, tier, score range, recent trend, weekly adherence, and 30-day load.',
    historyMeaning: 'Strength History shows how that score changes over time. In `Month` view each point is a day, while `6 months`, `Year`, and `All time` group results by month.',
    leaderboardMeaning: 'Muscle leaderboard ranks the muscle groups you train most strongly and pairs them with recovery readiness when that data is available.',
    rangeCoverage: 'Current range coverage',
    rangeCoverageWithSamples: (samples: number) =>
      `This view is currently based on ${samples} logged exercise-day samples. More completed weighted sets make the score and muscle rankings more stable.`,
    rangeCoverageNoSamples: 'No weighted training samples were found in this range yet. Log completed weighted sets to generate your score, history, and muscle ranking.',
    couldNotLoadScore: 'Could not load strength score.',
    noScoreLabel: 'No score yet',
    waitingForSessions: 'Waiting for your first weighted sessions',
    strengthClimbing: 'Strength is climbing',
    smallUpward: 'Small upward trend',
    offRecentPeak: 'You are off your recent peak',
    slightDip: 'Slight dip in output',
    holdingSteady: 'Holding steady',
    completeSetsForDashboard: 'Complete weighted sets and this screen will turn into a real strength dashboard.',
    rangeTrendText: (delta: string, range: string, deltaPct: string) =>
      `${delta} across the current ${range.toLowerCase()} window, with ${deltaPct} change from your baseline.`,
    rangeWindow: (range: string) => `${range} window`,
    firstPointMessage: 'One tracked point so far. Add more sessions to unlock trend direction.',
    tierAtScore: (tier: string, score: number) => `${tier} at ${score}`,
    avgBestSummary: (avgText: string, bestText: string) => `Avg ${avgText} | Best ${bestText}`,
    bestOpportunitySummary: (bestText: string, gapText: string) => `Best ${bestText} | Opportunity ${gapText}`,
    pointsSuffix: ' pts',
    rangeLabel: {
      month: 'Month',
      '6months': '6 months',
      year: 'Year',
      all: 'All time',
    } as Record<RangeKey, string>,
  },
  ar: {
    title: 'درجة القوة',
    infoAria: 'معلومات درجة القوة',
    trendPending: 'الاتجاه غير متاح بعد',
    recovery: 'الاستشفاء',
    avgSummary: (avgText: string, samples: number, range: string) =>
      `متوسط 1RM خلال نطاق ${range} هو ${avgText} بناءً على ${samples} عينة من أيام التمرين الموزون.`,
    noScoreYet: 'لا توجد درجة قوة بعد. أكمل مجموعات موزونة وسيبدأ هذا القسم بعرض درجتك وترتيب العضلات والاتجاه.',
    rank: 'الرتبة',
    thisWeek: 'هذا الأسبوع',
    completion: 'إنجاز',
    load30D: 'حمل 30 يوم',
    setsLogged: (sets: number) => `${sets} مجموعات مسجلة`,
    totalPoints: (points: number) => `${points.toLocaleString()} نقطة`,
    streak: 'التتابع',
    workoutDaySingular: 'يوم تمرين',
    workoutDayPlural: 'أيام تمرين',
    score: 'الدرجة',
    recent: 'حديثًا',
    scoreRange: 'نطاق الدرجة',
    momentum: 'الزخم',
    weightedSamples: 'العينات الموزونة',
    rangeStillBuilding: 'النطاق ما زال قيد البناء',
    samplesPerBucket: (value: number) => `${value} عينة لكل فترة`,
    muscleAverage: 'متوسط العضلات',
    rankingPending: 'الترتيب قيد الانتظار',
    musclesTracked: (count: number) => `${count} عضلات متتبعة`,
    readiness: 'الجاهزية',
    readyNeedRest: (ready: number, needRest: number) => `${ready} جاهز | ${needRest} يحتاج راحة`,
    strengthHistory: 'سجل القوة',
    start: 'البداية',
    current: 'الحالي',
    change: 'التغيير',
    notEnoughWeightedSets: 'لا توجد مجموعات موزونة كافية بعد. سجّل مجموعات موزونة مكتملة لبدء بناء الاتجاه.',
    vsPreviousBucket: (delta: string) => `${delta} مقارنة بالفترة السابقة`,
    firstTrackedBucket: 'أول فترة متتبعة',
    peakMuscle: 'أقوى عضلة',
    developmentLane: 'مسار التطوير',
    trainingStatus: 'حالة التدريب',
    needMoreStrengthData: 'نحتاج المزيد من بيانات القوة',
    logMoreWeightedSets: 'سجّل مجموعات موزونة أكثر لترتيب العضلات.',
    opportunity: 'فرصة',
    highlightsFurthest: 'تعرض هذه البطاقة العضلة الأبعد عن أعلى نتيجة لديك.',
    planCompletionWeek: (percent: number) => `${percent}% إنجاز الخطة هذا الأسبوع`,
    musclesRecoverySummary: (ready: number, almost: number, damaged: number) =>
      `${ready} عضلات جاهزة، ${almost} شبه جاهزة، ${damaged} تحتاج استشفاء أكثر.`,
    strengthPerMuscle: 'القوة لكل عضلة',
    muscleLeaderboard: 'لوحة ترتيب العضلات',
    rankedMuscles: (count: number) => `${count} عضلات مرتبة من ناتج التمرين المتتبع`,
    rankingAppears: 'سيظهر الترتيب بعد تسجيل مجموعات موزونة كافية.',
    scoreBand: 'نطاق الدرجة',
    outputGap: 'فجوة الأداء',
    recShort: 'استشفاء',
    na: 'غير متاح',
    unlockLeaderboard: 'ابدأ بتسجيل مجموعات موزونة لفتح ترتيب العضلات ومستويات القوة وربطها بالاستشفاء.',
    aboutTitle: 'حول درجة القوة',
    aboutSubtitle: (range: string) =>
      `تجمع هذه الصفحة بين ناتج الرفع المسجل والالتزام التدريبي وبيانات الاستشفاء ضمن نطاق ${range} الحالي.`,
    closeInfo: 'إغلاق معلومات درجة القوة',
    snapshotLine: 'درجتك الرئيسية هي لقطة قوة مبنية على المجموعات الموزونة المكتملة.',
    scoreCalcLine: 'لكل تمرين وفي كل يوم تدريب، يأخذ التطبيق أفضل تقدير 1RM لك، ثم يحسب المتوسط ويحوّله إلى درجة من 80 إلى 320.',
    sectionMeaning: 'ماذا تعني الأقسام',
    heroMeaning: 'تعرض البطاقة الرئيسية درجتك الحالية، المستوى، نطاق الدرجة، الاتجاه الأخير، الالتزام الأسبوعي، وحمل 30 يوم.',
    historyMeaning: 'يعرض سجل القوة تغير الدرجة مع الوقت. في عرض `شهر` تكون كل نقطة يومًا، بينما `6 أشهر` و`سنة` و`كل الوقت` تجمع النتائج شهريًا.',
    leaderboardMeaning: 'يرتب قسم لوحة العضلات المجموعات العضلية الأقوى لديك ويربطها بجاهزية الاستشفاء عند توفر البيانات.',
    rangeCoverage: 'تغطية النطاق الحالي',
    rangeCoverageWithSamples: (samples: number) =>
      `هذا العرض مبني حاليًا على ${samples} عينة أيام تمرين مسجلة. كلما زادت المجموعات الموزونة أصبحت الدرجة والترتيب أكثر ثباتًا.`,
    rangeCoverageNoSamples: 'لا توجد عينات تمرين موزون في هذا النطاق بعد. سجّل مجموعات موزونة لتوليد الدرجة والسجل وترتيب العضلات.',
    couldNotLoadScore: 'تعذر تحميل درجة القوة.',
    noScoreLabel: 'لا توجد درجة بعد',
    waitingForSessions: 'بانتظار أول جلساتك الموزونة',
    strengthClimbing: 'القوة في صعود',
    smallUpward: 'اتجاه صاعد بسيط',
    offRecentPeak: 'أنت بعيد عن قمتك الأخيرة',
    slightDip: 'هبوط طفيف في الأداء',
    holdingSteady: 'ثبات في المستوى',
    completeSetsForDashboard: 'أكمل مجموعات موزونة وسيتحول هذا القسم إلى لوحة قوة فعلية.',
    rangeTrendText: (delta: string, range: string, deltaPct: string) =>
      `${delta} عبر نطاق ${range} الحالي، مع تغير ${deltaPct} عن خط الأساس.`,
    rangeWindow: (range: string) => `نافذة ${range}`,
    firstPointMessage: 'لا توجد سوى نقطة واحدة حتى الآن. أضف جلسات أخرى ليظهر اتجاه واضح.',
    tierAtScore: (tier: string, score: number) => `${tier} عند ${score}`,
    avgBestSummary: (avgText: string, bestText: string) => `المتوسط ${avgText} | الأفضل ${bestText}`,
    bestOpportunitySummary: (bestText: string, gapText: string) => `الأفضل ${bestText} | الفرصة ${gapText}`,
    pointsSuffix: ' نقطة',
    rangeLabel: {
      month: 'شهر',
      '6months': '6 أشهر',
      year: 'سنة',
      all: 'كل الوقت',
    } as Record<RangeKey, string>,
  },
  it: {
    title: 'Punteggio Forza',
    infoAria: 'Informazioni punteggio forza',
    trendPending: 'Trend in attesa',
    recovery: 'Recupero',
    avgSummary: (avgText: string, samples: number, range: string) =>
      `1RM medio ${avgText} da ${samples} campioni giornalieri con carico nella finestra ${range.toLowerCase()} selezionata.`,
    noScoreYet: 'Nessun punteggio forza ancora. Completa serie con carico e questa pagina iniziera a mostrare punteggio, classifica muscolare e trend.',
    rank: 'Livello',
    thisWeek: 'Questa settimana',
    completion: 'completamento',
    load30D: 'Carico 30G',
    setsLogged: (sets: number) => `${sets} serie registrate`,
    totalPoints: (points: number) => `${points.toLocaleString()} pt`,
    streak: 'Serie attiva',
    workoutDaySingular: 'giorno di allenamento',
    workoutDayPlural: 'giorni di allenamento',
    score: 'Punteggio',
    recent: 'recente',
    scoreRange: 'Intervallo punteggio',
    momentum: 'Momentum',
    weightedSamples: 'Campioni con carico',
    rangeStillBuilding: 'Intervallo ancora in costruzione',
    samplesPerBucket: (value: number) => `${value} campioni per intervallo`,
    muscleAverage: 'Media muscolare',
    rankingPending: 'Classifica in attesa',
    musclesTracked: (count: number) => `${count} muscoli tracciati`,
    readiness: 'Prontezza',
    readyNeedRest: (ready: number, needRest: number) => `${ready} pronti | ${needRest} da recuperare`,
    strengthHistory: 'Storico della forza',
    start: 'Inizio',
    current: 'Attuale',
    change: 'Variazione',
    notEnoughWeightedSets: 'Non ci sono ancora abbastanza serie con carico. Registra serie completate con carico per iniziare a costruire il tuo trend.',
    vsPreviousBucket: (delta: string) => `${delta} rispetto all intervallo precedente`,
    firstTrackedBucket: 'Primo intervallo tracciato',
    peakMuscle: 'Muscolo migliore',
    developmentLane: 'Area di sviluppo',
    trainingStatus: 'Stato allenamento',
    needMoreStrengthData: 'Servono piu dati di forza',
    logMoreWeightedSets: 'Registra piu serie con carico per classificare i muscoli.',
    opportunity: 'Opportunita',
    highlightsFurthest: 'Questa scheda evidenzia il muscolo piu lontano dal tuo punteggio migliore.',
    planCompletionWeek: (percent: number) => `${percent}% completamento piano questa settimana`,
    musclesRecoverySummary: (ready: number, almost: number, damaged: number) =>
      `${ready} muscoli pronti, ${almost} quasi pronti, ${damaged} da recuperare di piu.`,
    strengthPerMuscle: 'Forza per muscolo',
    muscleLeaderboard: 'Classifica muscolare',
    rankedMuscles: (count: number) => `${count} muscoli classificati dall output allenante tracciato`,
    rankingAppears: 'La classifica apparira quando saranno registrate abbastanza serie con carico.',
    scoreBand: 'Fascia punteggio',
    outputGap: 'Gap prestazione',
    recShort: 'Rec',
    na: 'N/D',
    unlockLeaderboard: 'Inizia a registrare serie con carico per sbloccare classifica muscolare, livelli di forza e dettaglio collegato al recupero.',
    aboutTitle: 'Info Punteggio Forza',
    aboutSubtitle: (range: string) =>
      `Questa pagina combina i tuoi dati di carico registrati con aderenza al piano e recupero nella finestra ${range.toLowerCase()} corrente.`,
    closeInfo: 'Chiudi informazioni punteggio forza',
    snapshotLine: 'Il tuo punteggio principale e una fotografia della forza costruita sulle serie completate con carico.',
    scoreCalcLine: 'Per ogni esercizio e per ogni giorno di allenamento, l app prende il tuo miglior 1RM stimato, ne calcola la media e converte il risultato in un punteggio da 80 a 320.',
    sectionMeaning: 'Cosa significa ogni sezione',
    heroMeaning: 'La scheda principale mostra punteggio attuale, livello, intervallo punteggio, trend recente, aderenza settimanale e carico degli ultimi 30 giorni.',
    historyMeaning: 'Storico della forza mostra come cambia il punteggio nel tempo. Nella vista `Mese` ogni punto e un giorno, mentre `6 mesi`, `Anno` e `Sempre` raggruppano i risultati per mese.',
    leaderboardMeaning: 'La classifica muscolare ordina i gruppi muscolari allenati con piu forza e li abbina alla prontezza di recupero quando disponibile.',
    rangeCoverage: 'Copertura intervallo corrente',
    rangeCoverageWithSamples: (samples: number) =>
      `Questa vista si basa attualmente su ${samples} campioni giornalieri di allenamento registrati. Piu serie con carico completate rendono punteggio e classifica piu stabili.`,
    rangeCoverageNoSamples: 'Non sono stati trovati campioni di allenamento con carico in questo intervallo. Registra serie completate con carico per generare punteggio, storico e classifica muscolare.',
    couldNotLoadScore: 'Impossibile caricare lo strength score.',
    noScoreLabel: 'Nessun punteggio',
    waitingForSessions: 'In attesa delle tue prime sessioni con carico',
    strengthClimbing: 'La forza sta salendo',
    smallUpward: 'Piccolo trend positivo',
    offRecentPeak: 'Sei sotto al tuo picco recente',
    slightDip: 'Leggero calo di prestazione',
    holdingSteady: 'Stabile',
    completeSetsForDashboard: 'Completa serie con carico e questa schermata diventera una vera dashboard della forza.',
    rangeTrendText: (delta: string, range: string, deltaPct: string) =>
      `${delta} nella finestra ${range.toLowerCase()} corrente, con una variazione del ${deltaPct} rispetto alla base.`,
    rangeWindow: (range: string) => `Finestra ${range.toLowerCase()}`,
    firstPointMessage: 'C e solo un punto tracciato per ora. Aggiungi altre sessioni per sbloccare la direzione del trend.',
    tierAtScore: (tier: string, score: number) => `${tier} a ${score}`,
    avgBestSummary: (avgText: string, bestText: string) => `Media ${avgText} | Migliore ${bestText}`,
    bestOpportunitySummary: (bestText: string, gapText: string) => `Migliore ${bestText} | Opportunita ${gapText}`,
    pointsSuffix: ' pt',
    rangeLabel: {
      month: 'Mese',
      '6months': '6 mesi',
      year: 'Anno',
      all: 'Sempre',
    } as Record<RangeKey, string>,
  },
  fr: {
    title: 'Score de Force',
    infoAria: 'Informations sur le score de force',
    trendPending: 'Tendance en attente',
    recovery: 'Recuperation',
    avgSummary: (avgText: string, samples: number, range: string) =>
      `1RM moyen ${avgText} a partir de ${samples} echantillons de jours d exercice avec charge sur la periode ${range.toLowerCase()} selectionnee.`,
    noScoreYet: 'Pas encore de score de force. Termine des series avec charge et cette page commencera a afficher ton score, ton classement musculaire et ta tendance.',
    rank: 'Rang',
    thisWeek: 'Cette semaine',
    completion: 'de completion',
    load30D: 'Charge 30J',
    setsLogged: (sets: number) => `${sets} series enregistrees`,
    totalPoints: (points: number) => `${points.toLocaleString()} pts`,
    streak: 'Serie',
    workoutDaySingular: 'jour d entrainement',
    workoutDayPlural: 'jours d entrainement',
    score: 'Score',
    recent: 'recent',
    scoreRange: 'Plage du score',
    momentum: 'Momentum',
    weightedSamples: 'Echantillons avec charge',
    rangeStillBuilding: 'Plage encore en construction',
    samplesPerBucket: (value: number) => `${value} echantillons par intervalle`,
    muscleAverage: 'Moyenne musculaire',
    rankingPending: 'Classement en attente',
    musclesTracked: (count: number) => `${count} muscles suivis`,
    readiness: 'Disponibilite',
    readyNeedRest: (ready: number, needRest: number) => `${ready} prets | ${needRest} a reposer`,
    strengthHistory: 'Historique de Force',
    start: 'Depart',
    current: 'Actuel',
    change: 'Variation',
    notEnoughWeightedSets: 'Pas encore assez de series avec charge. Enregistre des series completes avec charge pour commencer a construire ta tendance.',
    vsPreviousBucket: (delta: string) => `${delta} par rapport a l intervalle precedent`,
    firstTrackedBucket: 'Premier intervalle suivi',
    peakMuscle: 'Muscle le plus fort',
    developmentLane: 'Axe de developpement',
    trainingStatus: 'Statut d entrainement',
    needMoreStrengthData: 'Besoin de plus de donnees de force',
    logMoreWeightedSets: 'Enregistre plus de series avec charge pour classer les muscles.',
    opportunity: 'Potentiel',
    highlightsFurthest: 'Cette carte met en avant le muscle le plus eloigne de ton meilleur score.',
    planCompletionWeek: (percent: number) => `${percent}% de completion du plan cette semaine`,
    musclesRecoverySummary: (ready: number, almost: number, damaged: number) =>
      `${ready} muscles prets, ${almost} presque prets, ${damaged} demandent plus de recuperation.`,
    strengthPerMuscle: 'Force par Muscle',
    muscleLeaderboard: 'Classement des muscles',
    rankedMuscles: (count: number) => `${count} muscles classes a partir du travail suivi`,
    rankingAppears: 'Le classement apparaitra une fois assez de series avec charge enregistrees.',
    scoreBand: 'Bande du score',
    outputGap: 'Ecart de performance',
    recShort: 'Rec',
    na: 'N/A',
    unlockLeaderboard: 'Commence a enregistrer des series avec charge pour debloquer ton classement musculaire, tes niveaux de force et le detail lie a la recuperation.',
    aboutTitle: 'A propos du Score de Force',
    aboutSubtitle: (range: string) =>
      `Cette page combine ton travail de charge enregistre avec ton adherence a l entrainement et tes donnees de recuperation sur la periode ${range.toLowerCase()} actuelle.`,
    closeInfo: 'Fermer les informations du score de force',
    snapshotLine: 'Ton score principal est un instantane de force construit a partir des series completes avec charge.',
    scoreCalcLine: 'Pour chaque exercice et chaque jour d entrainement, l application prend ton meilleur 1RM estime, en fait une moyenne et convertit le resultat en un score de 80 a 320.',
    sectionMeaning: 'Ce que signifie chaque section',
    heroMeaning: 'La carte principale montre ton score actuel, ton niveau, la plage du score, la tendance recente, l adherence hebdomadaire et la charge des 30 derniers jours.',
    historyMeaning: 'L Historique de Force montre comment ce score evolue dans le temps. En vue `Mois`, chaque point represente un jour, tandis que `6 mois`, `Annee` et `Depuis toujours` regroupent les resultats par mois.',
    leaderboardMeaning: 'Le classement musculaire ordonne les groupes musculaires que tu entraines le plus fortement et les associe a la disponibilite de recuperation lorsque ces donnees existent.',
    rangeCoverage: 'Couverture de la periode actuelle',
    rangeCoverageWithSamples: (samples: number) =>
      `Cette vue repose actuellement sur ${samples} echantillons de jours d exercice enregistres. Plus tu completes de series avec charge, plus le score et le classement musculaire deviennent stables.`,
    rangeCoverageNoSamples: 'Aucun echantillon d entrainement avec charge n a encore ete trouve sur cette periode. Enregistre des series completes avec charge pour generer ton score, ton historique et ton classement musculaire.',
    couldNotLoadScore: 'Impossible de charger le score de force.',
    noScoreLabel: 'Pas encore de score',
    waitingForSessions: 'En attente de tes premieres seances avec charge',
    strengthClimbing: 'La force progresse',
    smallUpward: 'Legere tendance haussiere',
    offRecentPeak: 'Tu es sous ton pic recent',
    slightDip: 'Legere baisse de performance',
    holdingSteady: 'Reste stable',
    completeSetsForDashboard: 'Complete des series avec charge et cet ecran deviendra un vrai tableau de bord de force.',
    rangeTrendText: (delta: string, range: string, deltaPct: string) =>
      `${delta} sur la fenetre ${range.toLowerCase()} actuelle, avec ${deltaPct} d evolution par rapport a ta base.`,
    rangeWindow: (range: string) => `Fenetre ${range.toLowerCase()}`,
    firstPointMessage: 'Un seul point suivi pour le moment. Ajoute plus de seances pour debloquer une vraie direction de tendance.',
    tierAtScore: (tier: string, score: number) => `${tier} a ${score}`,
    avgBestSummary: (avgText: string, bestText: string) => `Moy ${avgText} | Meilleur ${bestText}`,
    bestOpportunitySummary: (bestText: string, gapText: string) => `Meilleur ${bestText} | Potentiel ${gapText}`,
    pointsSuffix: ' pts',
    rangeLabel: {
      month: 'Mois',
      '6months': '6 mois',
      year: 'Annee',
      all: 'Depuis toujours',
    } as Record<RangeKey, string>,
  },
  de: {
    title: 'Kraftwert',
    infoAria: 'Informationen zum Strength Score',
    trendPending: 'Trend ausstehend',
    recovery: 'Erholung',
    avgSummary: (avgText: string, samples: number, range: string) =>
      `Durchschnittlicher 1RM ${avgText} aus ${samples} gewichteten Trainingsproben im gewahlten ${range}-Zeitraum.`,
    noScoreYet: 'Noch kein Strength Score. Schliesse gewichtete Satze ab und diese Seite zeigt bald deinen Score, dein Muskelranking und deinen Trend.',
    rank: 'Rang',
    thisWeek: 'Diese Woche',
    completion: 'Abschluss',
    load30D: '30T Last',
    setsLogged: (sets: number) => `${sets} protokollierte Satze`,
    totalPoints: (points: number) => `${points.toLocaleString()} Pkt`,
    streak: 'Serie',
    workoutDaySingular: 'Trainingstag',
    workoutDayPlural: 'Trainingstage',
    score: 'Score',
    recent: 'aktuell',
    scoreRange: 'Score-Bereich',
    momentum: 'Momentum',
    weightedSamples: 'Gewichtete Proben',
    rangeStillBuilding: 'Bereich wird noch aufgebaut',
    samplesPerBucket: (value: number) => `${value} Proben pro Abschnitt`,
    muscleAverage: 'Muskelmittelwert',
    rankingPending: 'Ranking ausstehend',
    musclesTracked: (count: number) => `${count} Muskeln verfolgt`,
    readiness: 'Bereitschaft',
    readyNeedRest: (ready: number, needRest: number) => `${ready} bereit | ${needRest} brauchen Pause`,
    strengthHistory: 'Kraftverlauf',
    start: 'Start',
    current: 'Aktuell',
    change: 'Veranderung',
    notEnoughWeightedSets: 'Noch nicht genug gewichtete Satze. Protokolliere abgeschlossene gewichtete Satze, um deinen Trend aufzubauen.',
    vsPreviousBucket: (delta: string) => `${delta} gegenuber dem vorherigen Abschnitt`,
    firstTrackedBucket: 'Erster erfasster Abschnitt',
    peakMuscle: 'Starkster Muskel',
    developmentLane: 'Entwicklungsfeld',
    trainingStatus: 'Trainingsstatus',
    needMoreStrengthData: 'Mehr Kraftdaten erforderlich',
    logMoreWeightedSets: 'Protokolliere mehr gewichtete Satze, um Muskeln zu ranken.',
    opportunity: 'Potenzial',
    highlightsFurthest: 'Diese Karte hebt den Muskel hervor, der am weitesten von deinem Top-Score entfernt ist.',
    planCompletionWeek: (percent: number) => `${percent}% Planabschluss diese Woche`,
    musclesRecoverySummary: (ready: number, almost: number, damaged: number) =>
      `${ready} Muskeln bereit, ${almost} fast bereit, ${damaged} brauchen mehr Erholung.`,
    strengthPerMuscle: 'Kraft pro Muskel',
    muscleLeaderboard: 'Muskel-Rangliste',
    rankedMuscles: (count: number) => `${count} gerankte Muskeln aus erfasstem Trainingsoutput`,
    rankingAppears: 'Die Rangliste erscheint, sobald genug gewichtete Satze erfasst wurden.',
    scoreBand: 'Score-Band',
    outputGap: 'Leistungslucke',
    recShort: 'Erh',
    na: 'k. A.',
    unlockLeaderboard: 'Beginne mit dem Protokollieren gewichteter Satze, um Muskel-Rangliste, Kraftstufen und die erholungsbezogene Aufschlüsselung freizuschalten.',
    aboutTitle: 'Infos zum Kraftwert',
    aboutSubtitle: (range: string) =>
      `Diese Seite kombiniert deinen protokollierten Trainingsoutput mit Trainingskonstanz und Erholungsdaten fur den aktuellen ${range}-Zeitraum.`,
    closeInfo: 'Strength-Score-Info schliessen',
    snapshotLine: 'Dein Hauptscore ist eine Kraftaufnahme auf Basis abgeschlossener gewichteter Satze.',
    scoreCalcLine: 'Fur jede Ubung an jedem Trainingstag nimmt die App dein bestes geschatztes 1RM, bildet daraus einen Durchschnitt und wandelt ihn in einen Score von 80 bis 320 um.',
    sectionMeaning: 'Was die Bereiche bedeuten',
    heroMeaning: 'Die Hauptkarte zeigt deinen aktuellen Score, dein Level, den Score-Bereich, den letzten Trend, die Wochenkonstanz und die 30-Tage-Last.',
    historyMeaning: 'Der Kraftverlauf zeigt, wie sich der Score uber die Zeit verandert. In der Ansicht `Monat` ist jeder Punkt ein Tag, wahrend `6 Monate`, `Jahr` und `Gesamt` die Ergebnisse monatsweise gruppieren.',
    leaderboardMeaning: 'Die Muskel-Rangliste ordnet die Muskelgruppen, die du am starksten trainierst, und kombiniert sie mit der Erholungsbereitschaft, wenn diese Daten verfugbar sind.',
    rangeCoverage: 'Abdeckung des aktuellen Zeitraums',
    rangeCoverageWithSamples: (samples: number) =>
      `Diese Ansicht basiert aktuell auf ${samples} protokollierten Trainingsproben. Mehr abgeschlossene gewichtete Satze machen Score und Muskelranking stabiler.`,
    rangeCoverageNoSamples: 'In diesem Zeitraum wurden noch keine gewichteten Trainingsproben gefunden. Protokolliere abgeschlossene gewichtete Satze, um Score, Verlauf und Muskelranking zu erzeugen.',
    couldNotLoadScore: 'Strength Score konnte nicht geladen werden.',
    noScoreLabel: 'Noch kein Score',
    waitingForSessions: 'Warten auf deine ersten gewichteten Einheiten',
    strengthClimbing: 'Kraft steigt',
    smallUpward: 'Leichter Aufwartstrend',
    offRecentPeak: 'Du liegst unter deinem letzten Hoch',
    slightDip: 'Leichter Leistungsruckgang',
    holdingSteady: 'Bleibt stabil',
    completeSetsForDashboard: 'Schliesse gewichtete Satze ab und dieser Bereich wird zu einem echten Kraft-Dashboard.',
    rangeTrendText: (delta: string, range: string, deltaPct: string) =>
      `${delta} im aktuellen ${range}-Fenster, mit ${deltaPct} Veranderung gegenuber deiner Basis.`,
    rangeWindow: (range: string) => `${range}-Fenster`,
    firstPointMessage: 'Bisher gibt es nur einen erfassten Punkt. Fuge weitere Einheiten hinzu, um eine Trendrichtung zu erhalten.',
    tierAtScore: (tier: string, score: number) => `${tier} bei ${score}`,
    avgBestSummary: (avgText: string, bestText: string) => `Durchschnitt ${avgText} | Bestwert ${bestText}`,
    bestOpportunitySummary: (bestText: string, gapText: string) => `Bestwert ${bestText} | Potenzial ${gapText}`,
    pointsSuffix: ' Pkt',
    rangeLabel: {
      month: 'Monat',
      '6months': '6 Monate',
      year: 'Jahr',
      all: 'Gesamt',
    } as Record<RangeKey, string>,
  },
} as const;

const AR_TIER_LABELS: Record<string, string> = {
  beginner: 'مبتدئ',
  intermediate: 'متوسط',
  advanced: 'متقدم',
  elite: 'نخبة',
  athlete: 'رياضي',
  bronze: 'برونزي',
  silver: 'فضي',
  gold: 'ذهبي',
  platinum: 'بلاتيني',
  diamond: 'ماسي',
};

const AR_MUSCLE_LABELS: Record<string, string> = {
  chest: 'الصدر',
  back: 'الظهر',
  shoulder: 'الكتف',
  shoulders: 'الأكتاف',
  tricep: 'الترايسبس',
  triceps: 'الترايسبس',
  bicep: 'البايسبس',
  biceps: 'البايسبس',
  abs: 'البطن',
  quadriceps: 'الرباعية',
  hamstrings: 'الخلفية',
  calves: 'السمانة',
  forearms: 'الساعد',
};

const IT_TIER_LABELS: Record<string, string> = {
  beginner: 'Principiante',
  intermediate: 'Intermedio',
  advanced: 'Avanzato',
  elite: 'Elite',
  athlete: 'Atleta',
  bronze: 'Bronzo',
  silver: 'Argento',
  gold: 'Oro',
  platinum: 'Platino',
  diamond: 'Diamante',
};

const FR_TIER_LABELS: Record<string, string> = {
  beginner: 'Debutant',
  intermediate: 'Intermediaire',
  advanced: 'Avance',
  elite: 'Elite',
  athlete: 'Athlete',
  bronze: 'Bronze',
  silver: 'Argent',
  gold: 'Or',
  platinum: 'Platine',
  diamond: 'Diamant',
};

const DE_TIER_LABELS: Record<string, string> = {
  beginner: 'Anfanger',
  intermediate: 'Fortgeschritten',
  advanced: 'Erfahren',
  elite: 'Elite',
  athlete: 'Athlet',
  bronze: 'Bronze',
  silver: 'Silber',
  gold: 'Gold',
  platinum: 'Platin',
  diamond: 'Diamant',
};

const IT_MUSCLE_LABELS: Record<string, string> = {
  chest: 'Petto',
  back: 'Schiena',
  shoulder: 'Spalla',
  shoulders: 'Spalle',
  tricep: 'Tricipite',
  triceps: 'Tricipiti',
  bicep: 'Bicipite',
  biceps: 'Bicipiti',
  abs: 'Addome',
  quadriceps: 'Quadricipiti',
  hamstrings: 'Femorali',
  calves: 'Polpacci',
  forearms: 'Avambracci',
};

const FR_MUSCLE_LABELS: Record<string, string> = {
  chest: 'Poitrine',
  back: 'Dos',
  shoulder: 'Epaule',
  shoulders: 'Epaules',
  tricep: 'Triceps',
  triceps: 'Triceps',
  bicep: 'Biceps',
  biceps: 'Biceps',
  abs: 'Abdos',
  quadriceps: 'Quadriceps',
  hamstrings: 'Ischio-jambiers',
  calves: 'Mollets',
  forearms: 'Avant-bras',
};

const DE_MUSCLE_LABELS: Record<string, string> = {
  chest: 'Brust',
  back: 'Rucken',
  shoulder: 'Schulter',
  shoulders: 'Schultern',
  tricep: 'Trizeps',
  triceps: 'Trizeps',
  bicep: 'Bizeps',
  biceps: 'Bizeps',
  abs: 'Bauch',
  quadriceps: 'Quadrizeps',
  hamstrings: 'Beinbeuger',
  calves: 'Waden',
  forearms: 'Unterarme',
};

const TIER_LABELS_BY_LANGUAGE: Partial<Record<AppLanguage, Record<string, string>>> = {
  ar: AR_TIER_LABELS,
  it: IT_TIER_LABELS,
  fr: FR_TIER_LABELS,
  de: DE_TIER_LABELS,
};

const MUSCLE_LABELS_BY_LANGUAGE: Partial<Record<AppLanguage, Record<string, string>>> = {
  ar: AR_MUSCLE_LABELS,
  it: IT_MUSCLE_LABELS,
  fr: FR_MUSCLE_LABELS,
  de: DE_MUSCLE_LABELS,
};

export function StrengthScoreScreen({ onBack }: StrengthScoreScreenProps) {
  const [activeRange, setActiveRange] = useState<RangeKey>('6months');
  const [language, setLanguage] = useState<AppLanguage>('en');
  const [loading, setLoading] = useState(true);
  const [supportLoading, setSupportLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [data, setData] = useState<StrengthScorePayload | null>(null);
  const [support, setSupport] = useState<StrengthSupportData>(defaultSupportData);
  const [showInfo, setShowInfo] = useState(false);
  const copy = STRENGTH_SCORE_I18N[language as keyof typeof STRENGTH_SCORE_I18N] || STRENGTH_SCORE_I18N.en;
  const toLocalizedTier = useCallback((value: string) => {
    const labels = TIER_LABELS_BY_LANGUAGE[language];
    return labels?.[value.trim().toLowerCase()] || value;
  }, [language]);
  const toLocalizedMuscle = useCallback((value: string) => {
    const labels = MUSCLE_LABELS_BY_LANGUAGE[language];
    return labels?.[value.trim().toLowerCase()] || value;
  }, [language]);

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
      const message = loadError instanceof Error ? loadError.message : copy.couldNotLoadScore;
      setError(message);
      setData(null);
    } finally {
      setLoading(false);
    }
  }, [copy.couldNotLoadScore]);

  const loadSupportingContext = useCallback(async () => {
    const userId = getStoredUserId();
    if (!userId) {
      setSupport(defaultSupportData);
      setSupportLoading(false);
      return;
    }

    setSupportLoading(true);
    const [progressResult, recoveryResult] = await Promise.allSettled([
      api.getProgramProgress(userId),
      api.getRecoveryStatus(userId),
    ]);

    setSupport((current) => {
      const next = { ...current };

      if (progressResult.status === 'fulfilled') {
        const summary = progressResult.value?.summary || {};
        next.workoutStreakDays = Number(summary?.workoutStreakDays || 0);
        next.weeklyCompletionRate = clamp(Number(summary?.weeklyCompletionRate || 0), 0, 100);
        next.workoutsCompletedThisWeek = Number(summary?.workoutsCompletedThisWeek || 0);
        next.workoutsPlannedThisWeek = Number(summary?.workoutsPlannedThisWeek || 0);
        next.volumeLoadLast30Days = Number(summary?.volumeLoadLast30Days || 0);
        next.setsLoggedLast30Days = Number(summary?.setsLoggedLast30Days || 0);
        next.totalPoints = Number(summary?.totalPoints || 0);
        next.rank = String(summary?.rank || '--');
        next.totalWorkouts = Number(summary?.totalWorkouts || summary?.completedWorkouts || 0);
      }

      if (recoveryResult.status === 'fulfilled') {
        const recoveryData = recoveryResult.value || {};
        const recoverySummary = recoveryData?.summary || {};
        next.overallRecovery = clamp(Number(recoveryData?.overallRecovery ?? 100), 0, 100);
        next.readyMuscles = Number(recoverySummary?.readyMuscles || 0);
        next.almostReadyMuscles = Number(recoverySummary?.almostReadyMuscles || 0);
        next.damagedMuscles = Number(recoverySummary?.damagedMuscles || 0);
        next.recovery = Array.isArray(recoveryData?.recovery)
          ? recoveryData.recovery.map((item: any) => ({
              name: String(item?.name || item?.muscle || ''),
              muscle: item?.muscle ? String(item.muscle) : undefined,
              score: clamp(Number(item?.score || 0), 0, 100),
            }))
          : [];
      }

      return next;
    });

    setSupportLoading(false);
  }, []);

  useEffect(() => {
    void loadScore(activeRange);
  }, [activeRange, loadScore]);

  useEffect(() => {
    void loadSupportingContext();
  }, [loadSupportingContext]);

  useEffect(() => {
    const handleRefresh = () => {
      void loadScore(activeRange);
      void loadSupportingContext();
    };
    window.addEventListener('gamification-updated', handleRefresh);
    window.addEventListener('recovery-updated', handleRefresh);

    return () => {
      window.removeEventListener('gamification-updated', handleRefresh);
      window.removeEventListener('recovery-updated', handleRefresh);
    };
  }, [activeRange, loadScore, loadSupportingContext]);

  useEffect(() => {
    if (!showInfo) return undefined;

    const handleEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setShowInfo(false);
      }
    };

    window.addEventListener('keydown', handleEscape);
    return () => window.removeEventListener('keydown', handleEscape);
  }, [showInfo]);

  const chart = useMemo(() => {
    const history = Array.isArray(data?.history) ? data.history : [];
    if (!history.length) {
      return {
        linePath: '',
        areaPath: '',
        points: [] as Array<{ x: number; y: number; label: string }>,
        minScore: 0,
        maxScore: 0,
        midScore: 0,
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
      areaPath: buildAreaPath(points),
      points,
      minScore,
      maxScore,
      midScore: Math.round((minScore + maxScore) / 2),
    };
  }, [data?.history]);

  const summary = data?.summary;
  const history = Array.isArray(data?.history) ? data.history : [];
  const muscles = Array.isArray(data?.muscles) ? data.muscles : [];
  const hasStrengthData = Boolean(Number(summary?.samples || 0) > 0 || history.length > 0 || muscles.length > 0);
  const overallScore = Number(summary?.overallScore || 0);
  const minScale = hasStrengthData ? Number(summary?.minScale || 80) : 80;
  const maxScale = hasStrengthData ? Number(summary?.maxScale || 320) : 320;
  const progressPercent = maxScale > minScale
    ? Math.max(0, Math.min(100, ((overallScore - minScale) / (maxScale - minScale)) * 100))
    : 0;
  const activeRangeLabel = copy.rangeLabel[activeRange] || copy.rangeLabel['6months'];
  const firstHistoryPoint = history[0] || null;
  const lastHistoryPoint = history.length ? history[history.length - 1] : null;
  const previousHistoryPoint = history.length > 1 ? history[history.length - 2] : null;
  const rangeDelta = firstHistoryPoint && lastHistoryPoint ? Number((lastHistoryPoint.score - firstHistoryPoint.score).toFixed(1)) : 0;
  const recentDelta = previousHistoryPoint && lastHistoryPoint ? Number((lastHistoryPoint.score - previousHistoryPoint.score).toFixed(1)) : 0;
  const rangeDeltaPct = firstHistoryPoint && firstHistoryPoint.score > 0 && lastHistoryPoint
    ? Number((((lastHistoryPoint.score - firstHistoryPoint.score) / firstHistoryPoint.score) * 100).toFixed(1))
    : 0;
  const sampleCount = Number(summary?.samples || 0);
  const averageMuscleScore = muscles.length
    ? Math.round(muscles.reduce((sum, muscle) => sum + Number(muscle.score || 0), 0) / muscles.length)
    : 0;
  const trainingDensity = history.length
    ? Number((sampleCount / history.length).toFixed(1))
    : 0;
  const strongestMuscle = muscles[0] || null;
  const weakestMuscle = muscles.length ? muscles[muscles.length - 1] : null;
  const displayLevel = hasStrengthData
    ? toLocalizedTier(String(summary?.level || 'Beginner'))
    : copy.noScoreLabel;
  const scoreRingPercent = hasStrengthData ? progressPercent : 0;
  const recoveryByName = useMemo(
    () => new Map(support.recovery.map((item) => [item.name.trim().toLowerCase(), item])),
    [support.recovery],
  );
  const strongestRecovery = strongestMuscle ? recoveryByName.get(strongestMuscle.name.trim().toLowerCase()) : null;
  const weakestRecovery = weakestMuscle ? recoveryByName.get(weakestMuscle.name.trim().toLowerCase()) : null;
  const momentumTitle = !hasStrengthData
    ? copy.waitingForSessions
    : rangeDelta > 6
      ? copy.strengthClimbing
      : rangeDelta > 0
        ? copy.smallUpward
        : rangeDelta < -6
          ? copy.offRecentPeak
          : rangeDelta < 0
            ? copy.slightDip
            : copy.holdingSteady;
  const momentumDescription = !hasStrengthData
    ? copy.completeSetsForDashboard
    : history.length > 1
      ? copy.rangeTrendText(
          formatSigned(rangeDelta, copy.pointsSuffix),
          activeRangeLabel.toLowerCase(),
          formatSigned(rangeDeltaPct, '%'),
        )
      : copy.firstPointMessage;

  return (
    <div className="min-h-screen bg-background pb-24">
      <div className="px-4 sm:px-6 pt-2">
        <Header
          title={copy.title}
          onBack={onBack}
          rightElement={(
            <button
              type="button"
              onClick={() => setShowInfo(true)}
              className="flex h-9 w-9 items-center justify-center rounded-full border border-white/10 bg-card/70 text-text-secondary transition-colors hover:border-accent/30 hover:text-text-primary"
              aria-label={copy.infoAria}
            >
              <CircleHelp size={16} />
            </button>
          )}
        />
        <div className="space-y-5">
          <Card className="relative overflow-hidden border border-white/10 bg-[radial-gradient(circle_at_top_left,rgba(244,63,94,0.24),transparent_40%),radial-gradient(circle_at_bottom_right,rgba(59,130,246,0.18),transparent_38%)]">
            <div className="pointer-events-none absolute inset-0 bg-[linear-gradient(135deg,rgba(255,255,255,0.02),transparent_55%)]" />
            <div className="relative">
              <div className="flex flex-col gap-6 lg:flex-row lg:items-center lg:justify-between">
                <div className="min-w-0 space-y-4">
                  <div className="flex flex-wrap gap-2">
                    <div className="rounded-full border border-white/10 bg-black/20 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.18em] text-text-primary">
                      {displayLevel}
                    </div>
                    <div className={`rounded-full border px-3 py-1 text-xs font-semibold ${getTrendToneClass(rangeDelta)}`}>
                      {history.length > 1 ? `${formatSigned(rangeDelta, copy.pointsSuffix)} ${copy.recent}` : copy.trendPending}
                    </div>
                    <div className={`rounded-full border px-3 py-1 text-xs font-semibold ${getRecoveryToneClass(support.overallRecovery)}`}>
                      {copy.recovery} {supportLoading ? '--' : `${Math.round(support.overallRecovery)}%`}
                    </div>
                  </div>

                  <div>
                    <div className="font-electrolize text-[42px] leading-none text-white sm:text-[54px]">
                      {loading ? '--' : hasStrengthData ? overallScore : '--'}
                    </div>
                    <div className="mt-3 max-w-xl text-sm text-text-secondary">
                      {hasStrengthData
                        ? copy.avgSummary(formatWeight(Number(summary?.overallAvgE1RM || 0)), sampleCount, activeRangeLabel)
                        : copy.noScoreYet}
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                    <div className="rounded-2xl border border-white/10 bg-black/20 p-3">
                      <div className="text-[11px] uppercase tracking-[0.18em] text-text-tertiary">{copy.rank}</div>
                      <div className="mt-2 text-lg font-semibold text-white">{supportLoading ? '--' : toLocalizedTier(support.rank)}</div>
                      <div className="text-xs text-text-secondary">{supportLoading ? '--' : copy.totalPoints(support.totalPoints)}</div>
                    </div>
                    <div className="rounded-2xl border border-white/10 bg-black/20 p-3">
                      <div className="text-[11px] uppercase tracking-[0.18em] text-text-tertiary">{copy.thisWeek}</div>
                      <div className="mt-2 text-lg font-semibold text-white">
                        {supportLoading ? '--' : `${support.workoutsCompletedThisWeek}/${support.workoutsPlannedThisWeek || 0}`}
                      </div>
                      <div className="text-xs text-text-secondary">
                        {supportLoading ? '--' : `${support.weeklyCompletionRate}% ${copy.completion}`}
                      </div>
                    </div>
                    <div className="rounded-2xl border border-white/10 bg-black/20 p-3">
                      <div className="text-[11px] uppercase tracking-[0.18em] text-text-tertiary">{copy.load30D}</div>
                      <div className="mt-2 text-lg font-semibold text-white">
                        {supportLoading ? '--' : formatTons(support.volumeLoadLast30Days)}
                      </div>
                      <div className="text-xs text-text-secondary">
                        {supportLoading ? '--' : copy.setsLogged(support.setsLoggedLast30Days)}
                      </div>
                    </div>
                    <div className="rounded-2xl border border-white/10 bg-black/20 p-3">
                      <div className="text-[11px] uppercase tracking-[0.18em] text-text-tertiary">{copy.streak}</div>
                      <div className="mt-2 text-lg font-semibold text-white">
                        {supportLoading ? '--' : support.workoutStreakDays}
                      </div>
                      <div className="text-xs text-text-secondary">
                        {supportLoading ? '--' : support.workoutStreakDays === 1 ? copy.workoutDaySingular : copy.workoutDayPlural}
                      </div>
                    </div>
                  </div>
                </div>

                <div className="mx-auto flex w-full max-w-[220px] shrink-0 flex-col items-center lg:mx-0">
                  <div
                    className="relative flex h-32 w-32 items-center justify-center rounded-full border border-white/10 shadow-[0_0_50px_rgba(244,63,94,0.12)] sm:h-40 sm:w-40"
                    style={{
                      background: `conic-gradient(#fb7185 0 ${scoreRingPercent}%, rgba(255,255,255,0.08) ${scoreRingPercent}% 100%)`,
                    }}
                  >
                    <div className="flex h-[106px] w-[106px] flex-col items-center justify-center rounded-full border border-white/10 bg-background/95 px-3 text-center sm:h-[134px] sm:w-[134px]">
                      <div className="text-[11px] uppercase tracking-[0.18em] text-text-tertiary">{copy.score}</div>
                      <div className="mt-1 font-electrolize text-3xl text-white sm:text-4xl">
                        {loading ? '--' : hasStrengthData ? overallScore : '--'}
                      </div>
                      <div className="mt-1 max-w-full break-words text-[11px] leading-4 text-text-secondary sm:text-xs">
                        {history.length > 1 ? `${formatSigned(recentDelta, copy.pointsSuffix)} ${copy.recent}` : activeRangeLabel}
                      </div>
                    </div>
                  </div>

                  <div className="mt-4 w-full max-w-[220px]">
                    <div className="mb-1 flex items-center justify-between text-xs text-text-tertiary">
                      <span className="truncate">{copy.scoreRange}</span>
                      <span className="shrink-0">{minScale} - {maxScale}</span>
                    </div>
                    <div className="h-2 overflow-hidden rounded-full bg-white/10">
                      <div
                        className="h-full rounded-full bg-gradient-to-r from-rose-500 via-orange-400 to-[#10b981]"
                        style={{ width: `${scoreRingPercent}%` }}
                      />
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </Card>

          <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
            <Card className="border border-white/10 p-4">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <div className="text-xs uppercase tracking-[0.18em] text-text-tertiary">{copy.momentum}</div>
                  <div className="mt-2 text-2xl font-electrolize text-white">
                    {history.length > 1 ? formatSigned(rangeDelta) : '--'}
                  </div>
                  <div className="mt-1 text-xs text-text-secondary">
                    {history.length > 1 ? copy.rangeWindow(activeRangeLabel) : copy.rangeStillBuilding}
                  </div>
                </div>
                <TrendingUp size={18} className="text-emerald-300" />
              </div>
            </Card>

            <Card className="border border-white/10 p-4">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <div className="text-xs uppercase tracking-[0.18em] text-text-tertiary">{copy.weightedSamples}</div>
                  <div className="mt-2 text-2xl font-electrolize text-white">{loading ? '--' : sampleCount}</div>
                  <div className="mt-1 text-xs text-text-secondary">
                    {loading || !history.length ? copy.rangeStillBuilding : copy.samplesPerBucket(trainingDensity)}
                  </div>
                </div>
                <BarChart3 size={18} className="text-sky-300" />
              </div>
            </Card>

            <Card className="border border-white/10 p-4">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <div className="text-xs uppercase tracking-[0.18em] text-text-tertiary">{copy.muscleAverage}</div>
                  <div className="mt-2 text-2xl font-electrolize text-white">{loading ? '--' : averageMuscleScore || '--'}</div>
                  <div className="mt-1 text-xs text-text-secondary">
                    {loading || !strongestMuscle ? copy.rankingPending : copy.musclesTracked(muscles.length)}
                  </div>
                </div>
                <Dumbbell size={18} className="text-violet-300" />
              </div>
            </Card>

            <Card className="border border-white/10 p-4">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <div className="text-xs uppercase tracking-[0.18em] text-text-tertiary">{copy.readiness}</div>
                  <div className="mt-2 text-2xl font-electrolize text-white">
                    {supportLoading ? '--' : `${Math.round(support.overallRecovery)}%`}
                  </div>
                  <div className="mt-1 text-xs text-text-secondary">
                    {supportLoading ? '--' : copy.readyNeedRest(support.readyMuscles, support.damagedMuscles)}
                  </div>
                </div>
                <Activity size={18} className="text-emerald-600" />
              </div>
            </Card>
          </div>

          <Card className="border border-white/10 p-5">
            <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
              <div className="min-w-0">
                <div className="text-[11px] uppercase tracking-[0.18em] text-text-tertiary">{copy.strengthHistory}</div>
                <h3 className="mt-2 break-words text-2xl font-semibold text-white sm:text-3xl">{momentumTitle}</h3>
                <p className="mt-2 max-w-2xl text-sm text-text-secondary">{momentumDescription}</p>
              </div>
              <div className="grid grid-cols-1 gap-2 text-center text-xs sm:grid-cols-3 lg:min-w-[260px]">
                <div className="rounded-2xl border border-white/10 bg-white/5 px-3 py-3">
                  <div className="text-text-tertiary">{copy.start}</div>
                  <div className="mt-1 font-electrolize text-lg text-white">
                    {firstHistoryPoint ? firstHistoryPoint.score : '--'}
                  </div>
                </div>
                <div className="rounded-2xl border border-white/10 bg-white/5 px-3 py-3">
                  <div className="text-text-tertiary">{copy.current}</div>
                  <div className="mt-1 font-electrolize text-lg text-white">
                    {lastHistoryPoint ? lastHistoryPoint.score : '--'}
                  </div>
                </div>
                <div className={`rounded-2xl border px-3 py-3 ${getTrendToneClass(rangeDelta)}`}>
                  <div className="text-current/70">{copy.change}</div>
                  <div className="mt-1 font-electrolize text-lg">
                    {history.length > 1 ? formatSigned(rangeDelta) : '--'}
                  </div>
                </div>
              </div>
            </div>

              <div className="mt-3 grid grid-cols-2 rounded-xl border border-white/10 bg-card/70 p-1 sm:grid-cols-4">
                {rangeOptions.map((option) => (
                  <button
                    key={option}
                    type="button"
                    onClick={() => setActiveRange(option)}
                    className={`rounded-lg px-2 py-1.5 text-xs font-semibold transition-colors ${
                      activeRange === option
                        ? 'bg-white/12 text-white'
                        : 'text-text-secondary hover:text-text-primary'
                    }`}
                  >
                    {copy.rangeLabel[option]}
                  </button>
                ))}
              </div>

              <div className="relative mt-4 h-72 overflow-hidden rounded-3xl border border-white/10 bg-card/70 p-3">
                {loading ? (
                  <div className="h-full animate-pulse rounded-2xl bg-white/5" />
                ) : error ? (
                  <div className="flex h-full items-center justify-center text-sm text-rose-300">{error}</div>
                ) : !chart.points.length ? (
                  <div className="flex h-full items-center justify-center text-center text-sm text-text-secondary">
                    {copy.notEnoughWeightedSets}
                  </div>
                ) : (
                  <>
                    <div className="pointer-events-none absolute inset-y-3 right-3 flex flex-col justify-between text-[10px] text-text-tertiary">
                      <span>{chart.maxScore}</span>
                      <span>{chart.midScore}</span>
                      <span>{chart.minScore}</span>
                    </div>
                    <svg className="h-full w-full" viewBox="0 0 100 100" preserveAspectRatio="none">
                      <defs>
                        <linearGradient id="strength-line-gradient" x1="0%" y1="0%" x2="100%" y2="0%">
                          <stop offset="0%" stopColor="#FB7185" />
                          <stop offset="55%" stopColor="#F59E0B" />
                          <stop offset="100%" stopColor="#10b981" />
                        </linearGradient>
                        <linearGradient id="strength-fill-gradient" x1="0%" y1="0%" x2="0%" y2="100%">
                          <stop offset="0%" stopColor="rgba(251,113,133,0.32)" />
                          <stop offset="100%" stopColor="rgba(251,113,133,0.02)" />
                        </linearGradient>
                      </defs>
                      <line x1="0" y1="15" x2="100" y2="15" stroke="rgba(255,255,255,0.08)" strokeWidth="0.7" />
                      <line x1="0" y1="50" x2="100" y2="50" stroke="rgba(255,255,255,0.08)" strokeWidth="0.7" />
                      <line x1="0" y1="92" x2="100" y2="92" stroke="rgba(255,255,255,0.08)" strokeWidth="0.7" />
                      <path d={chart.areaPath} fill="url(#strength-fill-gradient)" />
                      <path d={chart.linePath} fill="none" stroke="url(#strength-line-gradient)" strokeWidth="2.2" strokeLinecap="round" />
                      {chart.points.map((point, index) => (
                        <circle
                          key={`${point.x}-${point.y}`}
                          cx={point.x}
                          cy={point.y}
                          r={index === chart.points.length - 1 ? '1.8' : '1.25'}
                          fill={index === chart.points.length - 1 ? '#10b981' : '#F8FAFC'}
                        />
                      ))}
                    </svg>
                  </>
                )}
              </div>

              {!!chart.points.length && (
                <div className="mt-3 flex flex-col gap-1 text-xs text-text-tertiary sm:flex-row sm:items-center sm:justify-between">
                  <span>{chart.points[0]?.label || '-'}</span>
                  <span className="text-center">
                    {history.length > 1 ? copy.vsPreviousBucket(formatSigned(recentDelta, copy.pointsSuffix)) : copy.firstTrackedBucket}
                  </span>
                  <span className="text-right">{chart.points[chart.points.length - 1]?.label || '-'}</span>
                </div>
              )}
          </Card>

          <div className="grid grid-cols-1 gap-3 xl:grid-cols-3">
            <Card className="border border-white/10 p-4">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <div className="text-xs uppercase tracking-[0.18em] text-text-tertiary">{copy.peakMuscle}</div>
                  <div className="mt-2 break-words text-2xl font-semibold text-white">{strongestMuscle ? toLocalizedMuscle(strongestMuscle.name) : '--'}</div>
                  <div className="mt-1 text-sm text-text-secondary">
                    {strongestMuscle ? copy.tierAtScore(toLocalizedTier(strongestMuscle.tier), strongestMuscle.score) : copy.needMoreStrengthData}
                  </div>
                  <div className="mt-3 break-words text-xs text-text-tertiary">
                    {strongestMuscle ? copy.avgBestSummary(formatWeight(strongestMuscle.avgE1RM), formatWeight(strongestMuscle.bestE1RM)) : copy.logMoreWeightedSets}
                  </div>
                </div>
                <Trophy size={18} className="text-amber-300" />
              </div>
              {strongestRecovery && (
                <div className={`mt-4 inline-flex rounded-full border px-3 py-1 text-xs font-semibold ${getRecoveryToneClass(strongestRecovery.score)}`}>
                  {copy.recovery} {Math.round(strongestRecovery.score)}%
                </div>
              )}
            </Card>

            <Card className="border border-white/10 p-4">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <div className="text-xs uppercase tracking-[0.18em] text-text-tertiary">{copy.developmentLane}</div>
                  <div className="mt-2 break-words text-2xl font-semibold text-white">{weakestMuscle ? toLocalizedMuscle(weakestMuscle.name) : '--'}</div>
                  <div className="mt-1 text-sm text-text-secondary">
                    {weakestMuscle ? copy.tierAtScore(toLocalizedTier(weakestMuscle.tier), weakestMuscle.score) : copy.needMoreStrengthData}
                  </div>
                  <div className="mt-3 break-words text-xs text-text-tertiary">
                    {weakestMuscle
                      ? copy.bestOpportunitySummary(
                          formatWeight(weakestMuscle.bestE1RM),
                          formatSigned(strongestMuscle ? strongestMuscle.score - weakestMuscle.score : 0, copy.pointsSuffix),
                        )
                      : copy.highlightsFurthest}
                  </div>
                </div>
                <Target size={18} className="text-sky-300" />
              </div>
              {weakestRecovery && (
                <div className={`mt-4 inline-flex rounded-full border px-3 py-1 text-xs font-semibold ${getRecoveryToneClass(weakestRecovery.score)}`}>
                  {copy.recovery} {Math.round(weakestRecovery.score)}%
                </div>
              )}
            </Card>

            <Card className="border border-white/10 p-4">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <div className="text-xs uppercase tracking-[0.18em] text-text-tertiary">{copy.trainingStatus}</div>
                  <div className="mt-2 text-2xl font-semibold text-white">
                    {supportLoading ? '--' : `${support.workoutsCompletedThisWeek}/${support.workoutsPlannedThisWeek || 0}`}
                  </div>
                  <div className="mt-1 text-sm text-text-secondary">
                    {supportLoading ? '--' : copy.planCompletionWeek(support.weeklyCompletionRate)}
                  </div>
                  <div className="mt-3 break-words text-xs text-text-tertiary">
                    {supportLoading
                      ? '--'
                      : copy.musclesRecoverySummary(support.readyMuscles, support.almostReadyMuscles, support.damagedMuscles)}
                  </div>
                </div>
                <Flame size={18} className="text-rose-300" />
              </div>
            </Card>
          </div>

          <Card className="border border-white/10 p-5">
            <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
              <div>
                <div className="text-[11px] uppercase tracking-[0.18em] text-text-tertiary">{copy.strengthPerMuscle}</div>
                <h3 className="mt-2 text-2xl font-semibold text-white sm:text-3xl">{copy.muscleLeaderboard}</h3>
              </div>
              <div className="max-w-full text-sm text-text-secondary sm:max-w-[300px] sm:text-right">
                {muscles.length ? copy.rankedMuscles(muscles.length) : copy.rankingAppears}
              </div>
            </div>

            <div className="mt-4 space-y-3">
              {muscles.map((muscle, index) => {
                const recovery = recoveryByName.get(muscle.name.trim().toLowerCase());
                const scoreFill = getScoreFillPercent(muscle.score);

                return (
                  <div
                    key={muscle.name}
                    className="rounded-3xl border border-white/10 bg-card/80 p-4"
                  >
                    <div className="flex gap-3 sm:gap-4">
                      <div className="relative h-14 w-14 shrink-0 overflow-hidden rounded-2xl border border-white/10 bg-white/5">
                        <img src={getMuscleImage(muscle.name)} alt={toLocalizedMuscle(muscle.name)} className="h-full w-full object-cover" />
                        <div className="absolute left-1 top-1 rounded-full bg-black/70 px-1.5 py-0.5 text-[10px] font-semibold text-white">
                          #{index + 1}
                        </div>
                      </div>

                      <div className="min-w-0 flex-1">
                        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                          <div className="min-w-0">
                            <div className="flex flex-wrap items-center gap-2">
                              <div className="max-w-full break-words text-base font-semibold text-white">{toLocalizedMuscle(muscle.name)}</div>
                              <div className="rounded-full border border-white/10 bg-white/5 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-[0.14em] text-text-secondary">
                                {toLocalizedTier(muscle.tier)}
                              </div>
                            </div>
                            <div className="mt-1 break-words text-xs text-text-secondary">
                              {copy.avgBestSummary(formatWeight(muscle.avgE1RM), formatWeight(muscle.bestE1RM))}
                            </div>
                          </div>

                          <div className="flex flex-wrap items-center gap-2 sm:justify-end">
                            {recovery && (
                              <div className={`rounded-full border px-2.5 py-1 text-xs font-semibold ${getRecoveryToneClass(recovery.score)}`}>
                                {copy.recShort} {Math.round(recovery.score)}%
                              </div>
                            )}
                            <div className="rounded-full border border-rose-500/70 bg-rose-500/10 px-3 py-1 text-sm font-electrolize text-white">
                              {muscle.score}
                            </div>
                          </div>
                        </div>

                        <div className="mt-3 h-2 overflow-hidden rounded-full bg-white/10">
                          <div
                            className="h-full rounded-full bg-gradient-to-r from-rose-500 via-orange-400 to-[#10b981]"
                            style={{ width: `${scoreFill}%` }}
                          />
                        </div>

                        <div className="mt-3 grid grid-cols-1 gap-2 text-xs text-text-secondary sm:grid-cols-3">
                          <div className="rounded-2xl bg-white/5 px-3 py-2">
                            <div className="text-text-tertiary">{copy.scoreBand}</div>
                            <div className="mt-1 font-semibold text-white">{Math.round(scoreFill)}%</div>
                          </div>
                          <div className="rounded-2xl bg-white/5 px-3 py-2">
                            <div className="text-text-tertiary">{copy.outputGap}</div>
                            <div className="mt-1 font-semibold text-white">
                              {strongestMuscle ? formatSigned(strongestMuscle.score - muscle.score, copy.pointsSuffix) : '--'}
                            </div>
                          </div>
                          <div className="rounded-2xl bg-white/5 px-3 py-2">
                            <div className="text-text-tertiary">{copy.readiness}</div>
                            <div className="mt-1 font-semibold text-white">
                              {recovery ? `${Math.round(recovery.score)}%` : copy.na}
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })}
              {!loading && !error && muscles.length === 0 && (
                <div className="rounded-3xl border border-white/10 bg-card/80 p-5 text-sm text-text-secondary">
                  {copy.unlockLeaderboard}
                </div>
              )}
            </div>
          </Card>
        </div>
      </div>

      {showInfo && (
        <div
          className="fixed inset-0 z-50 flex items-end justify-center bg-black/70 p-4 sm:items-center"
          onClick={() => setShowInfo(false)}
        >
          <div
            className="flex max-h-[85vh] w-full max-w-lg flex-col rounded-3xl border border-white/10 bg-card p-5 shadow-2xl"
            onClick={(event) => event.stopPropagation()}
            role="dialog"
            aria-modal="true"
            aria-labelledby="strength-score-info-title"
          >
            <div className="flex items-start justify-between gap-4">
              <div>
                <h3 id="strength-score-info-title" className="text-xl font-semibold text-white">
                  {copy.aboutTitle}
                </h3>
                <p className="mt-1 text-sm text-text-secondary">
                  {copy.aboutSubtitle(activeRangeLabel.toLowerCase())}
                </p>
              </div>
              <button
                type="button"
                onClick={() => setShowInfo(false)}
                className="flex h-9 w-9 items-center justify-center rounded-full bg-white/5 text-text-secondary transition-colors hover:bg-white/10 hover:text-white"
                aria-label={copy.closeInfo}
              >
                <X size={18} />
              </button>
            </div>

            <div className="mt-4 space-y-4 overflow-y-auto pr-1 text-sm leading-6 text-text-secondary">
              <div className="rounded-2xl border border-white/8 bg-background/60 p-4">
                <p className="text-white">
                  {copy.snapshotLine}
                </p>
                <p className="mt-2">
                  {copy.scoreCalcLine}
                </p>
              </div>

              <div>
                <p className="font-semibold text-white">{copy.sectionMeaning}</p>
                <p className="mt-2">
                  {copy.heroMeaning}
                </p>
                <p>
                  {copy.historyMeaning}
                </p>
                <p>
                  {copy.leaderboardMeaning}
                </p>
              </div>

              <div className="rounded-2xl border border-rose-500/20 bg-rose-500/10 p-4">
                <p className="font-semibold text-white">{copy.rangeCoverage}</p>
                <p className="mt-1">
                  {sampleCount
                    ? copy.rangeCoverageWithSamples(sampleCount)
                    : copy.rangeCoverageNoSamples}
                </p>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

