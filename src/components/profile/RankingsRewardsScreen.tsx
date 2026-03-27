import React, { useEffect, useMemo, useState } from 'react';
import { Trophy } from 'lucide-react';
import { Header } from '../ui/Header';
import { Card } from '../ui/Card';
import { LeaderboardScreen } from './LeaderboardScreen';
import { api } from '../../services/api';
import { offlineCacheKeys, readOfflineCacheValue } from '../../services/offlineCache';
import { getRankBadgeImage } from '../../services/rankTheme';
import { AppLanguage, getActiveLanguage, getLanguageLocale, pickLanguage } from '../../services/language';
import {
  emojiChallenges,
  emojiDone,
  emojiMissions,
  emojiNew,
  emojiViewLeaderboard,
} from '../../services/emojiTheme';

interface RankingsRewardsScreenProps {
  onBack: () => void;
}

type MissionItem = {
  id: number;
  title: string;
  description: string;
  points_reward: number;
  progress: number;
  target: number;
  completed: boolean;
  remaining: number;
  status?: 'active' | 'completed' | 'expired';
  completed_at?: string | null;
  assigned_at?: string | null;
  created_at?: string | null;
};

type ChallengeItem = {
  id: number;
  title: string;
  description: string;
  challenge_type: 'daily' | 'weekly';
  points_reward: number;
  progress: number;
  target: number;
  completed: boolean;
  remaining: number;
  status?: 'active' | 'completed' | 'expired';
  completed_at?: string | null;
  created_at?: string | null;
};

type Summary = {
  totalPoints: number;
  rank: string;
  nextRank: { name: string; minPoints: number; pointsNeeded: number } | null;
};

const NEW_ITEM_WINDOW_MS = 24 * 60 * 60 * 1000;

const RANK_NAME_MAP: Record<AppLanguage, Record<string, string>> = {
  en: {
    bronze: 'Bronze',
    silver: 'Silver',
    gold: 'Gold',
    platinum: 'Platinum',
    diamond: 'Diamond',
    elite: 'Elite',
  },
  ar: {
    bronze: 'برونزي',
    silver: 'فضي',
    gold: 'ذهبي',
    platinum: 'بلاتيني',
    diamond: 'ألماسي',
    elite: 'نخبوي',
  },
  it: {
    bronze: 'Bronzo',
    silver: 'Argento',
    gold: 'Oro',
    platinum: 'Platino',
    diamond: 'Diamante',
    elite: 'Elite',
  },
  de: {
    bronze: 'Bronze',
    silver: 'Silber',
    gold: 'Gold',
    platinum: 'Platin',
    diamond: 'Diamant',
    elite: 'Elite',
  },
};

const TITLE_TRANSLATIONS: Record<string, Record<AppLanguage, string>> = {
  'consistency king': { en: 'Consistency King', ar: 'ملك الالتزام', it: 'Re della Costanza', de: 'Koenig der Konstanz' },
  'workout machine': { en: 'Workout Machine', ar: 'آلة التمرين', it: 'Macchina da Allenamento', de: 'Workout-Maschine' },
  'getting started': { en: 'Getting Started', ar: 'البداية', it: 'Per Iniziare', de: 'Erste Schritte' },
  'streak warrior': { en: 'Streak Warrior', ar: 'محارب السلسلة', it: 'Guerriero della Serie', de: 'Serien-Krieger' },
  'recovery master': { en: 'Recovery Master', ar: 'خبير التعافي', it: 'Maestro del Recupero', de: 'Erholungs-Meister' },
  'workout starter': { en: 'Workout Starter', ar: 'بداية التمرين', it: 'Avvio Allenamento', de: 'Workout-Starter' },
  'streak starter': { en: 'Streak Starter', ar: 'بداية السلسلة', it: 'Avvio Serie', de: 'Serien-Starter' },
  'daily iron habit': { en: 'Daily Iron Habit', ar: 'عادة الحديد اليومية', it: 'Abitudine Quotidiana al Ferro', de: 'Taegliche Eisen-Gewohnheit' },
  'daily recovery check': { en: 'Daily Recovery Check', ar: 'فحص التعافي اليومي', it: 'Controllo Recupero Giornaliero', de: 'Taeglicher Recovery-Check' },
  'weekly workout consistency': { en: 'Weekly Workout Consistency', ar: 'انتظام التمرين الأسبوعي', it: 'Costanza Allenamento Settimanale', de: 'Woechentliche Trainings-Konstanz' },
  'weekly recovery discipline': { en: 'Weekly Recovery Discipline', ar: 'انضباط التعافي الأسبوعي', it: 'Disciplina Recupero Settimanale', de: 'Woechentliche Erholungs-Disziplin' },
};

const DESCRIPTION_TRANSLATIONS: Record<string, Record<AppLanguage, string>> = {
  'train for 30 days': { en: 'Train for 30 days', ar: 'تمرّن لمدة 30 يومًا', it: 'Allenati per 30 giorni', de: 'Trainiere 30 Tage lang' },
  'complete 20 workouts': { en: 'Complete 20 workouts', ar: 'أكمل 20 تمرينًا', it: 'Completa 20 allenamenti', de: 'Schliesse 20 Workouts ab' },
  'complete 10 workouts': { en: 'Complete 10 workouts', ar: 'أكمل 10 تمارين', it: 'Completa 10 allenamenti', de: 'Schliesse 10 Workouts ab' },
  'log recovery factors 7 days in a row': { en: 'Log recovery factors 7 days in a row', ar: 'سجّل عوامل التعافي 7 أيام متتالية', it: 'Registra i fattori di recupero per 7 giorni di fila', de: 'Erfasse 7 Tage in Folge deine Erholungsfaktoren' },
  'complete 5 workouts': { en: 'Complete 5 workouts', ar: 'أكمل 5 تمارين', it: 'Completa 5 allenamenti', de: 'Schliesse 5 Workouts ab' },
  'reach a 3-day recovery streak': { en: 'Reach a 3-day recovery streak', ar: 'حقّق سلسلة تعافٍ لمدة 3 أيام', it: 'Raggiungi una serie di recupero di 3 giorni', de: 'Erreiche eine 3-Tage-Erholungsserie' },
  'reach a 7-day recovery streak': { en: 'Reach a 7-day recovery streak', ar: 'حقّق سلسلة تعافٍ لمدة 7 أيام', it: 'Raggiungi una serie di recupero di 7 giorni', de: 'Erreiche eine 7-Tage-Erholungsserie' },
  'complete at least one workout today': { en: 'Complete at least one workout today', ar: 'أكمل تمرينًا واحدًا على الأقل اليوم', it: 'Completa almeno un allenamento oggi', de: 'Schliesse heute mindestens ein Workout ab' },
  'submit your recovery check-in today': { en: 'Submit your recovery check-in today', ar: 'أرسل حالة التعافي اليوم', it: 'Invia oggi il tuo check-in di recupero', de: 'Reiche heute deinen Recovery-Check-in ein' },
  'train on 4 different days this week': { en: 'Train on 4 different days this week', ar: 'تمرّن في 4 أيام مختلفة هذا الأسبوع', it: 'Allenati in 4 giorni diversi questa settimana', de: 'Trainiere diese Woche an 4 verschiedenen Tagen' },
  'log recovery on 5 days this week': { en: 'Log recovery on 5 days this week', ar: 'سجّل التعافي في 5 أيام هذا الأسبوع', it: 'Registra il recupero in 5 giorni questa settimana', de: 'Erfasse diese Woche an 5 Tagen deine Erholung' },
};

const isNewWithin24Hours = (dateValue?: string | null) => {
  if (!dateValue) return false;
  const timestamp = new Date(dateValue).getTime();
  if (!Number.isFinite(timestamp)) return false;
  return Date.now() - timestamp <= NEW_ITEM_WINDOW_MS;
};

function CardLoadingSkeleton({ tone = 'accent' }: { tone?: 'accent' | 'blue' }) {
  const barTone = tone === 'blue' ? 'bg-blue-400/45' : 'bg-accent/45';
  return (
    <Card className="!p-2.5">
      <div className="animate-pulse">
        <div className="mb-2 flex items-start justify-between">
          <div className="h-4 w-40 rounded bg-white/10" />
          <div className="h-5 w-12 rounded bg-white/10" />
        </div>
        <div className="mb-1.5 h-3 w-full rounded bg-white/10" />
        <div className="mb-2 h-3 w-2/3 rounded bg-white/10" />
        <div className="flex items-center gap-2">
          <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-white/5">
            <div className={`h-full w-1/2 rounded-full ${barTone}`} />
          </div>
          <div className="h-3 w-12 rounded bg-white/10" />
        </div>
      </div>
    </Card>
  );
}

export function RankingsRewardsScreen({ onBack }: RankingsRewardsScreenProps) {
  const language = getActiveLanguage();
  const copy = pickLanguage(language, {
    en: {
      title: 'Rank & Rewards',
      history: 'History',
      missionHistory: 'Mission History',
      challengeHistory: 'Challenge History',
      noHistory: 'No history yet',
      viewLeaderboard: 'View Leaderboard',
      seeRankings: 'See gym rankings',
      missionChallengeHistory: 'Mission & Challenge History',
      viewCompleted: 'View completed items',
      activeMissions: 'Active Missions',
      activeChallenges: 'Active Challenges',
      completedMissions: 'Completed Missions',
      completedChallenges: 'Completed Challenges',
      noMissions: 'No missions or challenges found',
      points: (value: number) => `${value} points`,
      pointsShort: 'pts',
      nextRank: (rank: string, points: number) => `Next: ${rank} (${points} pts)`,
      topRank: 'Top rank achieved',
      completedOn: (date: Date) => `Completed ${date.toLocaleDateString(getLanguageLocale(language))}`,
      challengeType: (type: string) => (type === 'daily' ? 'Daily' : 'Weekly'),
      challengeWord: 'challenge',
      remaining: (value: number) => `${value} more to complete`,
      newAlt: 'new',
      doneAlt: 'done',
      missionsAlt: 'Missions',
      challengesAlt: 'Challenges',
    },
    ar: {
      title: 'الرتب والمكافآت',
      history: 'السجل',
      missionHistory: 'سجل المهام',
      challengeHistory: 'سجل التحديات',
      noHistory: 'لا يوجد سجل بعد',
      viewLeaderboard: 'عرض لوحة الصدارة',
      seeRankings: 'عرض ترتيب النادي',
      missionChallengeHistory: 'سجل المهام والتحديات',
      viewCompleted: 'عرض العناصر المكتملة',
      activeMissions: 'المهام النشطة',
      activeChallenges: 'التحديات النشطة',
      completedMissions: 'المهام المكتملة',
      completedChallenges: 'التحديات المكتملة',
      noMissions: 'لا توجد مهام أو تحديات',
      points: (value: number) => `${value} نقطة`,
      pointsShort: 'نقطة',
      nextRank: (rank: string, points: number) => `التالي: ${rank} (${points} نقطة)`,
      topRank: 'أعلى رتبة تم الوصول إليها',
      completedOn: (date: Date) => `اكتملت في ${date.toLocaleDateString(getLanguageLocale(language))}`,
      challengeType: (type: string) => (type === 'daily' ? 'يومي' : 'أسبوعي'),
      challengeWord: 'تحدي',
      remaining: (value: number) => `${value} متبقي`,
      newAlt: 'جديد',
      doneAlt: 'مكتمل',
      missionsAlt: 'المهام',
      challengesAlt: 'التحديات',
    },
    it: {
      title: 'Grado e Ricompense',
      history: 'Cronologia',
      missionHistory: 'Cronologia Missioni',
      challengeHistory: 'Cronologia Sfide',
      noHistory: 'Nessuna cronologia ancora',
      viewLeaderboard: 'Apri Classifica',
      seeRankings: 'Vedi la classifica della palestra',
      missionChallengeHistory: 'Cronologia Missioni e Sfide',
      viewCompleted: 'Visualizza gli elementi completati',
      activeMissions: 'Missioni Attive',
      activeChallenges: 'Sfide Attive',
      completedMissions: 'Missioni Completate',
      completedChallenges: 'Sfide Completate',
      noMissions: 'Nessuna missione o sfida trovata',
      points: (value: number) => `${value} punti`,
      pointsShort: 'pt',
      nextRank: (rank: string, points: number) => `Prossimo: ${rank} (${points} pt)`,
      topRank: 'Rango massimo raggiunto',
      completedOn: (date: Date) => `Completato il ${date.toLocaleDateString(getLanguageLocale(language))}`,
      challengeType: (type: string) => (type === 'daily' ? 'Giornaliera' : 'Settimanale'),
      challengeWord: 'sfida',
      remaining: (value: number) => `${value} ancora per completare`,
      newAlt: 'nuovo',
      doneAlt: 'completato',
      missionsAlt: 'Missioni',
      challengesAlt: 'Sfide',
    },
    de: {
      title: 'Rang & Belohnungen',
      history: 'Verlauf',
      missionHistory: 'Missionsverlauf',
      challengeHistory: 'Challenge-Verlauf',
      noHistory: 'Noch kein Verlauf',
      viewLeaderboard: 'Bestenliste Anzeigen',
      seeRankings: 'Studio-Rangliste ansehen',
      missionChallengeHistory: 'Missions- & Challenge-Verlauf',
      viewCompleted: 'Abgeschlossene Eintraege ansehen',
      activeMissions: 'Aktive Missionen',
      activeChallenges: 'Aktive Challenges',
      completedMissions: 'Abgeschlossene Missionen',
      completedChallenges: 'Abgeschlossene Challenges',
      noMissions: 'Keine Missionen oder Challenges gefunden',
      points: (value: number) => `${value} Punkte`,
      pointsShort: 'Pkt',
      nextRank: (rank: string, points: number) => `Naechster Rang: ${rank} (${points} Pkt)`,
      topRank: 'Hoechster Rang erreicht',
      completedOn: (date: Date) => `Abgeschlossen am ${date.toLocaleDateString(getLanguageLocale(language))}`,
      challengeType: (type: string) => (type === 'daily' ? 'Taeglich' : 'Woechentlich'),
      challengeWord: 'Challenge',
      remaining: (value: number) => `${value} bis zum Abschluss`,
      newAlt: 'neu',
      doneAlt: 'fertig',
      missionsAlt: 'Missionen',
      challengesAlt: 'Challenges',
    },
  });

  const translateText = (value: string, map: Record<string, Record<AppLanguage, string>>) => {
    const key = value.trim().toLowerCase();
    return map[key]?.[language] || value;
  };

  const translateTitle = (value: string) => translateText(value, TITLE_TRANSLATIONS);
  const translateDescription = (value: string) => translateText(value, DESCRIPTION_TRANSLATIONS);

  const [showLeaderboard, setShowLeaderboard] = useState(false);
  const [showHistory, setShowHistory] = useState(false);
  const [missions, setMissions] = useState<MissionItem[]>([]);
  const [missionHistory, setMissionHistory] = useState<any[]>([]);
  const [dailyChallenges, setDailyChallenges] = useState<ChallengeItem[]>([]);
  const [weeklyChallenges, setWeeklyChallenges] = useState<ChallengeItem[]>([]);
  const [challengeHistory, setChallengeHistory] = useState<any[]>([]);
  const [summary, setSummary] = useState<Summary>({
    totalPoints: 0,
    rank: 'Bronze',
    nextRank: null,
  });
  const [loading, setLoading] = useState(true);

  const appUser = JSON.parse(localStorage.getItem('appUser') || localStorage.getItem('user') || '{}');
  const userId = parseInt(String(appUser?.id || localStorage.getItem('appUserId') || localStorage.getItem('userId') || '0'), 10);

  useEffect(() => {
    if (userId > 0) {
      const cachedMissions = readOfflineCacheValue<MissionItem[]>(offlineCacheKeys.userMissions(userId));
      const cachedMissionHistory = readOfflineCacheValue<any[]>(offlineCacheKeys.missionHistory(userId));
      const cachedChallenges = readOfflineCacheValue<any>(offlineCacheKeys.userChallenges(userId));
      const cachedChallengeHistory = readOfflineCacheValue<any[]>(offlineCacheKeys.challengeHistory(userId));
      const cachedSummary = readOfflineCacheValue<any>(offlineCacheKeys.gamificationSummary(userId));

      if (Array.isArray(cachedMissions)) setMissions(cachedMissions);
      if (Array.isArray(cachedMissionHistory)) setMissionHistory(cachedMissionHistory);
      if (cachedChallenges && Array.isArray(cachedChallenges.daily)) setDailyChallenges(cachedChallenges.daily);
      if (cachedChallenges && Array.isArray(cachedChallenges.weekly)) setWeeklyChallenges(cachedChallenges.weekly);
      if (Array.isArray(cachedChallengeHistory)) setChallengeHistory(cachedChallengeHistory);
      if (cachedSummary && !cachedSummary.error) {
        setSummary({
          totalPoints: Number(cachedSummary.totalPoints || 0),
          rank: String(cachedSummary.rank || 'Bronze'),
          nextRank: cachedSummary.nextRank || null,
        });
      }
      if (cachedMissions || cachedMissionHistory || cachedChallenges || cachedChallengeHistory || cachedSummary) {
        setLoading(false);
      }
    }

    const fetchGamification = async () => {
      if (!userId || userId <= 0) {
        setLoading(false);
        return;
      }

      try {
        const [missionsData, missionHistoryData, challengesData, challengeHistoryData, summaryData] = await Promise.all([
          api.getUserMissions(userId),
          api.getMissionHistory(userId),
          api.getUserChallenges(userId),
          api.getChallengeHistory(userId),
          api.getGamificationSummary(userId),
        ]);

        if (Array.isArray(missionsData)) setMissions(missionsData);
        if (Array.isArray(missionHistoryData)) setMissionHistory(missionHistoryData);
        if (Array.isArray(challengeHistoryData)) setChallengeHistory(challengeHistoryData);

        if (challengesData && Array.isArray(challengesData.daily)) setDailyChallenges(challengesData.daily);
        if (challengesData && Array.isArray(challengesData.weekly)) setWeeklyChallenges(challengesData.weekly);

        if (summaryData && !summaryData.error) {
          setSummary({
            totalPoints: Number(summaryData.totalPoints || 0),
            rank: String(summaryData.rank || 'Bronze'),
            nextRank: summaryData.nextRank || null,
          });
        }
      } catch (error) {
        console.error('Error fetching gamification:', error);
      } finally {
        setLoading(false);
      }
    };

    const handleGamificationUpdated = () => {
      void fetchGamification();
    };

    void fetchGamification();
    window.addEventListener('gamification-updated', handleGamificationUpdated);
    window.addEventListener('focus', handleGamificationUpdated);

    return () => {
      window.removeEventListener('gamification-updated', handleGamificationUpdated);
      window.removeEventListener('focus', handleGamificationUpdated);
    };
  }, [userId]);

  const activeMissions = missions.filter((m) => m.status === 'active').slice(0, 5);
  const completedMissions = missions.filter((m) => m.completed);
  const activeDailyChallenges = dailyChallenges.filter((c) => c.status === 'active');
  const activeWeeklyChallenges = weeklyChallenges.filter((c) => c.status === 'active');
  const completedChallenges = [...dailyChallenges, ...weeklyChallenges].filter((c) => c.completed);

  const rankBadgeImage = getRankBadgeImage(summary.rank);
  const rankKey = String(summary.rank || '').trim().toLowerCase();
  const rankNameDisplay = RANK_NAME_MAP[language][rankKey] || summary.rank;
  const nextRankKey = String(summary.nextRank?.name || '').trim().toLowerCase();
  const nextRankName = summary.nextRank ? (RANK_NAME_MAP[language][nextRankKey] || summary.nextRank.name) : '';
  const nextRankText = summary.nextRank ? copy.nextRank(nextRankName, summary.nextRank.pointsNeeded) : copy.topRank;

  const missionHistoryByPeriod = useMemo(
    () =>
      missionHistory.reduce((acc, item) => {
        const key = String(item.period || 'Unknown');
        if (!acc[key]) acc[key] = [];
        acc[key].push(item);
        return acc;
      }, {} as Record<string, any[]>),
    [missionHistory],
  );

  const challengeHistoryByPeriod = useMemo(
    () =>
      challengeHistory.reduce((acc, item) => {
        const key = String(item.period || 'Unknown');
        if (!acc[key]) acc[key] = [];
        acc[key].push(item);
        return acc;
      }, {} as Record<string, any[]>),
    [challengeHistory],
  );

  if (showLeaderboard) {
    return <LeaderboardScreen onBack={() => setShowLeaderboard(false)} />;
  }

  if (showHistory) {
    return (
      <div className="flex-1 flex min-h-screen flex-col bg-background pb-24">
        <div className="px-4 pt-2 sm:px-6">
          <Header title={copy.history} onBack={() => setShowHistory(false)} compact />
        </div>

        <div className="mt-4 space-y-6 px-4 sm:px-6">
          {Object.keys(missionHistoryByPeriod).length > 0 && (
            <div>
              <h3 className="mb-3 text-xs font-bold uppercase tracking-wider text-text-secondary">{copy.missionHistory}</h3>
              <div className="space-y-4">
                {Object.entries(missionHistoryByPeriod).map(([period, periodMissions]) => (
                  <div key={`mission-${period}`}>
                    <h4 className="mb-2 text-xs font-bold uppercase tracking-wider text-text-secondary">{period}</h4>
                    <div className="space-y-2">
                      {periodMissions.map((mission, idx) => (
                        <Card key={`m-${period}-${idx}`} className="!p-4">
                          <div className="flex items-start justify-between">
                            <div>
                              <h5 className="font-bold text-white">{translateTitle(mission.title)}</h5>
                              <p className="mt-1 text-xs text-text-secondary">{copy.completedOn(new Date(mission.completed_at))}</p>
                            </div>
                            <p className="text-xs font-bold text-accent">+{mission.points_reward} {copy.pointsShort}</p>
                          </div>
                        </Card>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {Object.keys(challengeHistoryByPeriod).length > 0 && (
            <div>
              <h3 className="mb-3 text-xs font-bold uppercase tracking-wider text-text-secondary">{copy.challengeHistory}</h3>
              <div className="space-y-4">
                {Object.entries(challengeHistoryByPeriod).map(([period, periodChallenges]) => (
                  <div key={`challenge-${period}`}>
                    <h4 className="mb-2 text-xs font-bold uppercase tracking-wider text-text-secondary">{period}</h4>
                    <div className="space-y-2">
                      {periodChallenges.map((challenge, idx) => (
                        <Card key={`c-${period}-${idx}`} className="!p-4">
                          <div className="flex items-start justify-between">
                            <div>
                              <h5 className="font-bold text-white">{translateTitle(challenge.title)}</h5>
                              <p className="mt-1 text-xs text-text-secondary">
                                {copy.challengeType(challenge.challenge_type)} {copy.challengeWord}
                              </p>
                            </div>
                            <p className="text-xs font-bold text-accent">+{challenge.points_reward} {copy.pointsShort}</p>
                          </div>
                        </Card>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {Object.keys(missionHistoryByPeriod).length === 0 && Object.keys(challengeHistoryByPeriod).length === 0 && (
            <p className="text-center text-sm text-text-secondary">{copy.noHistory}</p>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="flex-1 flex min-h-screen flex-col bg-background pb-24">
      <div className="px-4 pt-2 sm:px-6">
        <Header title={copy.title} onBack={onBack} compact />
      </div>

      <div className="mt-1 space-y-2.5 px-4 sm:px-6">
        <div className="flex flex-col items-center py-1.5">
          <div className="mb-2 flex h-20 w-20 items-center justify-center rounded-full border-2 border-accent/30 bg-accent/10">
            <img src={rankBadgeImage} alt={rankNameDisplay} className="h-12 w-12 object-contain" />
          </div>
          <h2 className="text-lg font-bold text-white">{rankNameDisplay}</h2>
          <p className="mt-0.5 text-sm text-text-secondary">{copy.points(summary.totalPoints)}</p>
          <p className="mt-0.5 text-xs text-text-secondary">{nextRankText}</p>
        </div>

        <button
          onClick={() => setShowLeaderboard(true)}
          className="flex w-full items-center justify-between rounded-lg border border-white/5 bg-card p-3 transition-colors hover:border-accent/20"
        >
          <div className="flex items-center gap-3">
            <img src={emojiViewLeaderboard} alt={copy.viewLeaderboard} className="h-5 w-5 object-contain" />
            <div className="text-left">
              <h4 className="text-sm font-semibold text-white">{copy.viewLeaderboard}</h4>
              <p className="text-xs text-text-secondary">{copy.seeRankings}</p>
            </div>
          </div>
          <span className="text-accent">&rarr;</span>
        </button>

        <button
          onClick={() => setShowHistory(true)}
          className="flex w-full items-center justify-between rounded-lg border border-white/5 bg-card p-3 transition-colors hover:border-accent/20"
        >
          <div className="flex items-center gap-3">
            <img src={emojiChallenges} alt={copy.challengesAlt} className="h-5 w-5 object-contain" />
            <div className="text-left">
              <h4 className="text-sm font-semibold text-white">{copy.missionChallengeHistory}</h4>
              <p className="text-xs text-text-secondary">{copy.viewCompleted}</p>
            </div>
          </div>
          <span className="text-accent">&rarr;</span>
        </button>

        {loading ? (
          <div className="space-y-3">
            <div className="space-y-2">
              <div className="flex items-center gap-2">
                <img src={emojiMissions} alt={copy.missionsAlt} className="h-4 w-4 object-contain opacity-70" />
                <h3 className="text-xs font-bold uppercase tracking-wider text-text-secondary">{copy.activeMissions}</h3>
              </div>
              <div className="space-y-2">
                <CardLoadingSkeleton tone="accent" />
                <CardLoadingSkeleton tone="accent" />
              </div>
            </div>

            <div className="space-y-2">
              <div className="flex items-center gap-2">
                <img src={emojiChallenges} alt={copy.challengesAlt} className="h-4 w-4 object-contain opacity-70" />
                <h3 className="text-xs font-bold uppercase tracking-wider text-text-secondary">{copy.activeChallenges}</h3>
              </div>
              <div className="space-y-2">
                <CardLoadingSkeleton tone="blue" />
                <CardLoadingSkeleton tone="blue" />
              </div>
            </div>
          </div>
        ) : (
          <>
            {activeMissions.length > 0 && (
              <div className="space-y-2">
                <div className="flex items-center gap-2">
                  <img src={emojiMissions} alt={copy.missionsAlt} className="h-4 w-4 object-contain" />
                  <h3 className="text-xs font-bold uppercase tracking-wider text-text-secondary">{copy.activeMissions}</h3>
                </div>
                <div className="space-y-2">
                  {activeMissions.map((mission) => (
                    <Card key={mission.id} className="!p-2.5">
                      <div className="mb-2 flex items-start justify-between">
                        <div className="flex items-center gap-1.5">
                          <h4 className="text-sm font-semibold text-white">{translateTitle(mission.title)}</h4>
                          {isNewWithin24Hours(mission.assigned_at || mission.created_at) && (
                            <img src={emojiNew} alt={copy.newAlt} className="h-4 w-6 object-contain" />
                          )}
                        </div>
                        <span className="rounded bg-accent/10 px-2 py-0.5 text-xs font-bold text-accent">+{mission.points_reward}</span>
                      </div>
                      <p className="mb-1.5 text-xs text-text-secondary">{translateDescription(mission.description)}</p>
                      <div className="space-y-0.5">
                        <div className="flex items-center gap-2">
                          <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-white/5">
                            <div
                              className="h-full rounded-full bg-accent"
                              style={{ width: `${Math.min((mission.progress / mission.target) * 100, 100)}%` }}
                            />
                          </div>
                          <span className="font-mono text-xs text-text-tertiary">
                            {mission.progress}/{mission.target}
                          </span>
                        </div>
                        <p className="text-xs text-text-tertiary">{copy.remaining(mission.remaining)}</p>
                      </div>
                    </Card>
                  ))}
                </div>
              </div>
            )}

            {(activeDailyChallenges.length > 0 || activeWeeklyChallenges.length > 0) && (
              <div className="space-y-2">
                <div className="flex items-center gap-2">
                  <img src={emojiMissions} alt={copy.missionsAlt} className="h-4 w-4 object-contain" />
                  <h3 className="text-xs font-bold uppercase tracking-wider text-text-secondary">{copy.activeChallenges}</h3>
                </div>
                <div className="space-y-2">
                  {[...activeDailyChallenges, ...activeWeeklyChallenges].map((challenge) => (
                    <Card key={`${challenge.challenge_type}-${challenge.id}`} className="!p-2.5">
                      <div className="mb-2 flex items-start justify-between">
                        <div>
                          <div className="flex items-center gap-1.5">
                            <h4 className="text-sm font-semibold text-white">{translateTitle(challenge.title)}</h4>
                            {isNewWithin24Hours(challenge.created_at) && (
                              <img src={emojiNew} alt={copy.newAlt} className="h-4 w-6 object-contain" />
                            )}
                          </div>
                          <p className="mt-0.5 text-[11px] uppercase text-text-secondary">{copy.challengeType(challenge.challenge_type)}</p>
                        </div>
                        <span className="rounded bg-blue-400/10 px-2 py-0.5 text-xs font-bold text-blue-400">+{challenge.points_reward}</span>
                      </div>
                      <p className="mb-1.5 text-xs text-text-secondary">{translateDescription(challenge.description)}</p>
                      <div className="space-y-0.5">
                        <div className="flex items-center gap-2">
                          <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-white/5">
                            <div
                              className="h-full rounded-full bg-blue-400"
                              style={{ width: `${Math.min((challenge.progress / challenge.target) * 100, 100)}%` }}
                            />
                          </div>
                          <span className="font-mono text-xs text-text-tertiary">
                            {challenge.progress}/{challenge.target}
                          </span>
                        </div>
                        <p className="text-xs text-text-tertiary">{copy.remaining(challenge.remaining)}</p>
                      </div>
                    </Card>
                  ))}
                </div>
              </div>
            )}

            {completedMissions.length > 0 && (
              <div className="space-y-1">
                <div className="flex items-center gap-2">
                  <Trophy size={16} className="text-green-500" />
                  <h3 className="text-xs font-bold uppercase tracking-wider text-text-secondary">{copy.completedMissions}</h3>
                </div>
                {completedMissions.map((mission) => (
                  <Card key={`done-m-${mission.id}`} className="!p-2.5 opacity-60">
                    <div className="flex items-start justify-between">
                      <div>
                        <h4 className="text-sm font-semibold text-white">{translateTitle(mission.title)}</h4>
                        <p className="mt-0.5 text-xs text-text-secondary">{translateDescription(mission.description)}</p>
                      </div>
                      <img src={emojiDone} alt={copy.doneAlt} className="h-4 w-4 object-contain" />
                    </div>
                  </Card>
                ))}
              </div>
            )}

            {completedChallenges.length > 0 && (
              <div className="space-y-1">
                <div className="flex items-center gap-2">
                  <Trophy size={16} className="text-green-500" />
                  <h3 className="text-xs font-bold uppercase tracking-wider text-text-secondary">{copy.completedChallenges}</h3>
                </div>
                {completedChallenges.map((challenge) => (
                  <Card key={`done-c-${challenge.challenge_type}-${challenge.id}`} className="!p-2.5 opacity-60">
                    <div className="flex items-start justify-between">
                      <div>
                        <h4 className="text-sm font-semibold text-white">{translateTitle(challenge.title)}</h4>
                        <p className="mt-0.5 text-xs text-text-secondary">{translateDescription(challenge.description)}</p>
                      </div>
                      <img src={emojiDone} alt={copy.doneAlt} className="h-4 w-4 object-contain" />
                    </div>
                  </Card>
                ))}
              </div>
            )}

            {activeMissions.length === 0
              && activeDailyChallenges.length === 0
              && activeWeeklyChallenges.length === 0
              && completedMissions.length === 0
              && completedChallenges.length === 0 && (
              <p className="text-center text-sm text-text-secondary">{copy.noMissions}</p>
            )}
          </>
        )}
      </div>
    </div>
  );
}
