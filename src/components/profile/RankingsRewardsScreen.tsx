import React, { useEffect, useMemo, useState } from 'react';
import { ChevronRight, Trophy } from 'lucide-react';
import { Header } from '../ui/Header';
import { Card } from '../ui/Card';
import { LeaderboardScreen } from './LeaderboardScreen';
import { api } from '../../services/api';
import { offlineCacheKeys, readOfflineCacheValue } from '../../services/offlineCache';
import { getRankBadgeImage } from '../../services/rankTheme';
import { AppLanguage, LocalizedLanguageRecord, getActiveLanguage, getLanguageLocale, pickLanguage } from '../../services/language';
import {
  emojiChallenges,
  emojiDone,
  emojiMissions,
  emojiNew,
  emojiViewLeaderboard,
} from '../../services/emojiTheme';
import emojiConsistency from '../../../assets/emoji/Consistency.png';
import emojiStrength from '../../../assets/emoji/Strengths.png';
import emojiRecovery from '../../../assets/emoji/Recovery.png';
import emojiEngagement from '../../../assets/emoji/Engagement.png';

interface RankingsRewardsScreenProps {
  onBack: () => void;
}

type MissionItem = {
  id: number;
  title: string;
  description: string;
  points_reward: number;
  mission_type?: 'daily' | 'weekly' | 'monthly' | 'achievement' | 'special';
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

type DashboardCategory = 'consistency' | 'strength' | 'recovery' | 'engagement';

type CategoryHistoryItem = {
  id: string;
  title: string;
  description: string;
  points_reward: number;
  completed_at?: string | null;
  type: 'mission' | 'challenge';
  cadence?: 'daily' | 'weekly' | 'monthly';
  category: DashboardCategory;
};

const CATEGORY_ORDER: DashboardCategory[] = ['consistency', 'strength', 'recovery', 'engagement'];

const CATEGORY_TITLE_MAP: Record<string, DashboardCategory> = {
  'coach check-in': 'consistency',
  'first lift logged': 'consistency',
  'weekly workout consistency': 'consistency',
  'daily iron habit': 'consistency',
  'weekly upgrade': 'consistency',
  'no regression': 'consistency',
  'perfect progression': 'consistency',
  '+10kg club': 'strength',
  'heavy step forward': 'strength',
  'progressive beast': 'strength',
  'no comfort zone': 'strength',
  'strength builder': 'strength',
  'volume king': 'strength',
  'extra set warrior': 'strength',
  'rep breaker': 'strength',
  'endurance push': 'strength',
  'high volume week': 'strength',
  'last rep fighter': 'strength',
  'controlled power': 'strength',
  'no easy sets': 'strength',
  'intensity master': 'strength',
  'double progress': 'strength',
  'bench press king': 'strength',
  'deadlift monster': 'strength',
  'squat titan': 'strength',
  'push until failure': 'strength',
  'plank survivor': 'strength',
  'rep madness': 'strength',
  'volume destroyer': 'strength',
  'upper body war': 'strength',
  'fast grinder': 'strength',
  'perfect athlete': 'strength',
  'recovery check': 'recovery',
  'daily recovery check': 'recovery',
  'weekly recovery discipline': 'recovery',
  'recovery-based overload': 'recovery',
  'ai approved progress': 'recovery',
  'feed scout': 'engagement',
  'show some love': 'engagement',
  'start a conversation': 'engagement',
  'send a challenge': 'engagement',
  'accept the challenge': 'engagement',
};

const normalizeCategoryKey = (value: string) => String(value || '').trim().toLowerCase();

const inferDashboardCategory = (title: string, description = ''): DashboardCategory => {
  const normalizedTitle = normalizeCategoryKey(title);
  if (CATEGORY_TITLE_MAP[normalizedTitle]) return CATEGORY_TITLE_MAP[normalizedTitle];

  const haystack = `${normalizedTitle} ${normalizeCategoryKey(description)}`;
  if (haystack.includes('recovery') || haystack.includes('coach')) return 'recovery';
  if (haystack.includes('comment') || haystack.includes('feed') || haystack.includes('post') || haystack.includes('challenge')) return 'engagement';
  if (
    haystack.includes('weight')
    || haystack.includes('bench')
    || haystack.includes('deadlift')
    || haystack.includes('squat')
    || haystack.includes('intensity')
    || haystack.includes('volume')
    || haystack.includes('rep')
    || haystack.includes('pr')
  ) {
    return 'strength';
  }
  return 'consistency';
};

const NEW_ITEM_WINDOW_MS = 24 * 60 * 60 * 1000;

const RANK_NAME_MAP: LocalizedLanguageRecord<Record<string, string>> = {
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
  fr: {
    bronze: 'Bronze',
    silver: 'Argent',
    gold: 'Or',
    platinum: 'Platine',
    diamond: 'Diamant',
    elite: 'Elite',
  },
};

const TITLE_TRANSLATIONS: Record<string, LocalizedLanguageRecord<string>> = {
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

const DESCRIPTION_TRANSLATIONS: Record<string, LocalizedLanguageRecord<string>> = {
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

const TITLE_TRANSLATION_FR_OVERRIDES: Record<string, string> = {
  'daily iron habit': 'Habitude fonte du jour',
  'daily recovery check': 'Check recuperation du jour',
  'weekly workout consistency': 'Regularite entrainement hebdo',
  'weekly recovery discipline': 'Discipline recuperation hebdo',
  'coach check-in': 'Check-in coach',
  'first lift logged': 'Premier exercice enregistre',
  'start a conversation': 'Commencer une conversation',
  'send a challenge': 'Envoyer un defi',
  'recovery check': 'Check recuperation',
  'show some love': 'Montrer du soutien',
  'feed scout': 'Explorer le feed',
  'accept the challenge': 'Accepter le defi',
  'bench press king': 'Roi du developpe couche',
  'deadlift monster': 'Monstre du souleve de terre',
  'squat titan': 'Titan du squat',
  'push until failure': 'Pompes jusqu a l echec',
  'plank survivor': 'Survivant du gainage',
  'rep madness': 'Folie des repetitions',
  'volume destroyer': 'Destructeur de volume',
  'upper body war': 'Guerre du haut du corps',
  'fast grinder': 'Grinder rapide',
  'perfect athlete': 'Athlete parfait',
};

const DESCRIPTION_TRANSLATION_FR_OVERRIDES: Record<string, string> = {
  'complete at least one workout today': 'Termine au moins un entrainement aujourd hui',
  'submit your recovery check-in today': 'Envoie ton check de recuperation aujourd hui',
  'train on 4 different days this week': 'Entraine-toi 4 jours differents cette semaine',
  'log recovery on 5 days this week': 'Enregistre ta recuperation 5 jours cette semaine',
  'log at least 1 exercise today.': 'Enregistre au moins 1 exercice aujourd hui.',
  'comment on 1 post in the community feed today.': 'Commente 1 publication du feed aujourd hui.',
  'send one real message to your coach today.': 'Envoie un vrai message a ton coach aujourd hui.',
  'send 1 friend challenge today.': 'Envoie 1 defi a un ami aujourd hui.',
  "log today's recovery status to keep your plan adaptive.": 'Enregistre ton etat de recuperation du jour pour garder ton plan adaptatif.',
  'hit an 80kg or better bench press 1rm estimate this week.': 'Atteins un 1RM estime de 80 kg ou plus au developpe couche cette semaine.',
  'hit a 120kg or better deadlift 1rm estimate this week.': 'Atteins un 1RM estime de 120 kg ou plus au souleve de terre cette semaine.',
  'hit a 100kg or better squat this week.': 'Atteins un squat de 100 kg ou plus cette semaine.',
  'reach 30 push-ups in one set this week.': 'Atteins 30 pompes en une seule serie cette semaine.',
  'hold a plank for 90 seconds or longer this week.': 'Tiens une planche 90 secondes ou plus cette semaine.',
  'reach 60 reps on a single exercise inside one workout this week.': 'Atteins 60 repetitions sur un seul exercice dans une seance cette semaine.',
  'log 5,000kg of weekly training volume.': 'Enregistre 5 000 kg de volume d entrainement cette semaine.',
  'log 150 upper-body reps across chest, shoulders, and arms this week.': 'Enregistre 150 repetitions du haut du corps cette semaine.',
  'finish a valid workout in 45 minutes or less this week.': 'Termine une seance valide en 45 minutes ou moins cette semaine.',
  'reach a weekly athlete score of 75 by combining strength, volume, recovery, and consistency.': 'Atteins un score athletique hebdo de 75 en combinant force, volume, recuperation et regularite.',
};

const isNewWithin24Hours = (dateValue?: string | null) => {
  if (!dateValue) return false;
  const timestamp = new Date(dateValue).getTime();
  if (!Number.isFinite(timestamp)) return false;
  return Date.now() - timestamp <= NEW_ITEM_WINDOW_MS;
};

const CATEGORY_PROGRESS_SEGMENT_COLORS = [
  'rgb(233, 233, 12)',
  'rgb(208, 233, 12)',
  'rgb(184, 233, 12)',
  'rgb(159, 233, 12)',
  'rgb(135, 233, 12)',
  'rgb(110, 233, 12)',
  'rgb(86, 233, 12)',
  'rgb(61, 233, 12)',
  'rgb(37, 233, 12)',
  'rgb(12, 233, 12)',
];

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

function CategoryGridSkeleton() {
  return (
    <div className="grid grid-cols-2 gap-3">
      {Array.from({ length: 4 }).map((_, index) => (
        <Card key={`category-skeleton-${index}`} className="!p-4">
          <div className="animate-pulse space-y-3">
            <div className="flex items-center justify-between">
              <div className="h-8 w-8 rounded-xl bg-white/10" />
              <div className="h-4 w-4 rounded bg-white/10" />
            </div>
            <div className="h-4 w-24 rounded bg-white/10" />
            <div className="space-y-1.5">
              <div className="h-3 w-20 rounded bg-white/10" />
              <div className="h-3 w-24 rounded bg-white/10" />
              <div className="h-3 w-16 rounded bg-white/10" />
            </div>
          </div>
        </Card>
      ))}
    </div>
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
    fr: {
      title: 'Rang et Recompenses',
      history: 'Historique',
      missionHistory: 'Historique des missions',
      challengeHistory: 'Historique des defis',
      noHistory: 'Aucun historique pour le moment',
      viewLeaderboard: 'Voir le classement',
      seeRankings: 'Voir le classement de la salle',
      missionChallengeHistory: 'Historique des missions et defis',
      viewCompleted: 'Voir les elements termines',
      activeMissions: 'Missions actives',
      activeChallenges: 'Defis actifs',
      completedMissions: 'Missions terminees',
      completedChallenges: 'Defis termines',
      noMissions: 'Aucune mission ou aucun defi trouve',
      points: (value: number) => `${value} points`,
      pointsShort: 'pts',
      nextRank: (rank: string, points: number) => `Suivant : ${rank} (${points} pts)`,
      topRank: 'Rang maximum atteint',
      completedOn: (date: Date) => `Termine le ${date.toLocaleDateString(getLanguageLocale(language))}`,
      challengeType: (type: string) => (type === 'daily' ? 'Quotidien' : 'Hebdomadaire'),
      challengeWord: 'defi',
      remaining: (value: number) => `${value} restants`,
      newAlt: 'nouveau',
      doneAlt: 'termine',
      missionsAlt: 'Missions',
      challengesAlt: 'Defis',
    },
  });
  const dashboardCopy = pickLanguage(language, {
    en: {
      dashboard: 'Performance Dashboard',
      categoryStats: 'Category Stats',
      categoryHistory: 'Completed',
      categoryEmpty: 'No items in this category yet.',
      activeLabel: 'Active',
      progressLabel: 'Left to finish',
      completedLabel: 'Completed',
      missionLabel: 'Mission',
      categoryConsistency: 'Consistency',
      categoryStrength: 'Strength',
      categoryRecovery: 'Recovery',
      categoryEngagement: 'Engagement',
    },
    ar: {
      dashboard: 'Performance Dashboard',
      categoryStats: 'Category Stats',
      categoryHistory: 'Completed',
      categoryEmpty: 'No items in this category yet.',
      activeLabel: 'Active',
      progressLabel: 'Left to finish',
      completedLabel: 'Completed',
      missionLabel: 'Mission',
      categoryConsistency: 'Consistency',
      categoryStrength: 'Strength',
      categoryRecovery: 'Recovery',
      categoryEngagement: 'Engagement',
    },
    it: {
      dashboard: 'Dashboard Prestazioni',
      categoryStats: 'Statistiche Categoria',
      categoryHistory: 'Completate',
      categoryEmpty: 'Nessun elemento in questa categoria.',
      activeLabel: 'Attive',
      progressLabel: 'Da completare',
      completedLabel: 'Completate',
      missionLabel: 'Missione',
      categoryConsistency: 'Costanza',
      categoryStrength: 'Forza',
      categoryRecovery: 'Recupero',
      categoryEngagement: 'Coinvolgimento',
    },
    de: {
      dashboard: 'Performance-Dashboard',
      categoryStats: 'Kategorie-Statistiken',
      categoryHistory: 'Abgeschlossen',
      categoryEmpty: 'Noch keine Eintraege in dieser Kategorie.',
      activeLabel: 'Aktiv',
      progressLabel: 'Ø Fortschritt',
      completedLabel: 'Abgeschlossen',
      missionLabel: 'Mission',
      categoryConsistency: 'Konstanz',
      categoryStrength: 'Staerke',
      categoryRecovery: 'Erholung',
      categoryEngagement: 'Engagement',
    },
    fr: {
      dashboard: 'Tableau de Performance',
      categoryStats: 'Stats de la Categorie',
      categoryHistory: 'Termine',
      categoryEmpty: 'Aucun element dans cette categorie pour le moment.',
      activeLabel: 'Actif',
      progressLabel: 'Reste a faire',
      completedLabel: 'Termine',
      missionLabel: 'Mission',
      categoryConsistency: 'Regularite',
      categoryStrength: 'Force',
      categoryRecovery: 'Recuperation',
      categoryEngagement: 'Engagement',
    },
  });

  const translateText = (value: string, map: Record<string, LocalizedLanguageRecord<string>>) => {
    const key = value.trim().toLowerCase();
    if (language === 'fr') {
      const frOverride = map === TITLE_TRANSLATIONS
        ? TITLE_TRANSLATION_FR_OVERRIDES[key]
        : DESCRIPTION_TRANSLATION_FR_OVERRIDES[key];
      if (frOverride) return frOverride;
    }
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
  const [selectedCategory, setSelectedCategory] = useState<DashboardCategory>('consistency');
  const [showCategoryDetail, setShowCategoryDetail] = useState(false);
  const [categoryDetailLoading, setCategoryDetailLoading] = useState(false);

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

  const activeMissions = missions.filter((m) => m.status === 'active');
  const activeDailyChallenges = dailyChallenges.filter((c) => c.status === 'active');
  const activeWeeklyChallenges = weeklyChallenges.filter((c) => c.status === 'active');
  const activeChallenges = [...activeDailyChallenges, ...activeWeeklyChallenges];

  const rankBadgeImage = getRankBadgeImage(summary.rank);
  const rankKey = String(summary.rank || '').trim().toLowerCase();
  const rankNameDisplay = RANK_NAME_MAP[language]?.[rankKey] || RANK_NAME_MAP.en?.[rankKey] || summary.rank;
  const nextRankKey = String(summary.nextRank?.name || '').trim().toLowerCase();
  const nextRankName = summary.nextRank ? (RANK_NAME_MAP[language]?.[nextRankKey] || RANK_NAME_MAP.en?.[nextRankKey] || summary.nextRank.name) : '';
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

  const categoryName = (category: DashboardCategory) => {
    if (category === 'consistency') return dashboardCopy.categoryConsistency;
    if (category === 'strength') return dashboardCopy.categoryStrength;
    if (category === 'recovery') return dashboardCopy.categoryRecovery;
    return dashboardCopy.categoryEngagement;
  };

  const categorizedActiveMissions = useMemo(
    () =>
      activeMissions.reduce((acc, mission) => {
        const category = inferDashboardCategory(mission.title, mission.description);
        acc[category].push(mission);
        return acc;
      }, {
        consistency: [],
        strength: [],
        recovery: [],
        engagement: [],
      } as Record<DashboardCategory, MissionItem[]>),
    [activeMissions],
  );

  const categorizedActiveChallenges = useMemo(
    () =>
      activeChallenges.reduce((acc, challenge) => {
        const category = inferDashboardCategory(challenge.title, challenge.description);
        acc[category].push(challenge);
        return acc;
      }, {
        consistency: [],
        strength: [],
        recovery: [],
        engagement: [],
      } as Record<DashboardCategory, ChallengeItem[]>),
    [activeChallenges],
  );

  const categorizedHistory = useMemo(() => {
    const missionEntries: CategoryHistoryItem[] = missionHistory.map((mission: any, index: number) => ({
      id: `mission-${index}-${mission.title}`,
      title: String(mission.title || ''),
      description: String(mission.description || ''),
      points_reward: Number(mission.points_reward || 0),
      completed_at: mission.completed_at || null,
      type: 'mission',
      cadence: undefined,
      category: inferDashboardCategory(String(mission.title || ''), String(mission.description || '')),
    }));

    const challengeEntries: CategoryHistoryItem[] = challengeHistory.map((challenge: any, index: number) => ({
      id: `challenge-${index}-${challenge.title}`,
      title: String(challenge.title || ''),
      description: String(challenge.description || ''),
      points_reward: Number(challenge.points_reward || 0),
      completed_at: challenge.completed_at || null,
      type: 'challenge',
      cadence: challenge.challenge_type === 'daily' ? 'daily' : 'weekly',
      category: inferDashboardCategory(String(challenge.title || ''), String(challenge.description || '')),
    }));

    return [...missionEntries, ...challengeEntries]
      .sort((a, b) => new Date(b.completed_at || 0).getTime() - new Date(a.completed_at || 0).getTime())
      .reduce((acc, entry) => {
        acc[entry.category].push(entry);
        return acc;
      }, {
        consistency: [],
        strength: [],
        recovery: [],
        engagement: [],
      } as Record<DashboardCategory, CategoryHistoryItem[]>);
  }, [challengeHistory, missionHistory]);

  const categoryMeta = {
    consistency: {
      iconSrc: emojiConsistency,
      iconWrapClassName: 'bg-emerald-500/10 border-emerald-400/25',
      cardClassName: 'border-emerald-400/20 bg-emerald-500/[0.05]',
      selectedClassName: 'border-emerald-400/45 bg-emerald-500/[0.10]',
      accentClassName: 'text-emerald-300',
    },
    strength: {
      iconSrc: emojiStrength,
      iconWrapClassName: 'bg-rose-500/10 border-rose-400/25',
      cardClassName: 'border-rose-400/20 bg-rose-500/[0.05]',
      selectedClassName: 'border-rose-400/45 bg-rose-500/[0.10]',
      accentClassName: 'text-rose-300',
    },
    recovery: {
      iconSrc: emojiRecovery,
      iconWrapClassName: 'bg-sky-500/10 border-sky-400/25',
      cardClassName: 'border-sky-400/20 bg-sky-500/[0.05]',
      selectedClassName: 'border-sky-400/45 bg-sky-500/[0.10]',
      accentClassName: 'text-sky-300',
    },
    engagement: {
      iconSrc: emojiEngagement,
      iconWrapClassName: 'bg-violet-500/10 border-violet-400/25',
      cardClassName: 'border-violet-400/20 bg-violet-500/[0.05]',
      selectedClassName: 'border-violet-400/45 bg-violet-500/[0.10]',
      accentClassName: 'text-violet-300',
    },
  } satisfies Record<
    DashboardCategory,
    {
      iconSrc: string;
      iconWrapClassName: string;
      cardClassName: string;
      selectedClassName: string;
      accentClassName: string;
    }
  >;

  const categoryStats = useMemo(
    () =>
      CATEGORY_ORDER.reduce((acc, category) => {
        const missionItems = categorizedActiveMissions[category];
        const challengeItems = categorizedActiveChallenges[category];
        const historyItems = categorizedHistory[category];
        const progressItems = [...missionItems, ...challengeItems];
        const averageProgress = progressItems.length
          ? Math.round(
            progressItems.reduce((sum, item) => {
              const target = Math.max(1, Number(item.target || 1));
              return sum + Math.min(Number(item.progress || 0) / target, 1);
            }, 0) / progressItems.length * 100,
          )
          : 0;

        acc[category] = {
          activeCount: missionItems.length + challengeItems.length,
          completedCount: historyItems.length,
          averageProgress,
          remainingPercent: progressItems.length ? Math.max(0, 100 - averageProgress) : 0,
        };
        return acc;
      }, {} as Record<DashboardCategory, { activeCount: number; completedCount: number; averageProgress: number; remainingPercent: number }>),
    [categorizedActiveChallenges, categorizedActiveMissions, categorizedHistory],
  );

  const selectedMissionItems = categorizedActiveMissions[selectedCategory];
  const selectedChallengeItems = categorizedActiveChallenges[selectedCategory];
  const selectedHistoryItems = categorizedHistory[selectedCategory].slice(0, 8);

  const handleCategorySelect = (category: DashboardCategory) => {
    setSelectedCategory(category);
    setCategoryDetailLoading(true);
    setShowCategoryDetail(true);
  };

  useEffect(() => {
    if (!showCategoryDetail || !categoryDetailLoading) return undefined;

    const timer = window.setTimeout(() => {
      setCategoryDetailLoading(false);
    }, 450);

    return () => window.clearTimeout(timer);
  }, [categoryDetailLoading, showCategoryDetail, selectedCategory]);

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

  if (showCategoryDetail) {
    return (
      <div className="flex-1 flex min-h-screen flex-col bg-background pb-24">
        <div className="px-4 pt-2 sm:px-6">
          <Header
            title={categoryName(selectedCategory)}
            onBack={() => {
              setCategoryDetailLoading(false);
              setShowCategoryDetail(false);
            }}
            compact
          />
        </div>

        <div className="mt-4 space-y-4 px-4 sm:px-6">
          {categoryDetailLoading ? (
            <div className="flex min-h-[40vh] flex-col items-center justify-center">
              <div className="rounded-[28px] bg-white/[0.03] p-5 shadow-[0_12px_30px_rgba(0,0,0,0.18)]">
                <div
                  className="h-16 w-16 animate-spin rounded-full border-[6px] border-[#d7dbff] border-b-transparent border-l-transparent border-r-[#5b61ff] border-t-[#8d93ff]"
                  aria-label="Loading category"
                />
              </div>
            </div>
          ) : (
            <>
          {selectedMissionItems.length > 0 && (
            <div className="space-y-2">
              <div className="flex items-center gap-2">
                <img src={emojiMissions} alt={copy.missionsAlt} className="h-4 w-4 object-contain" />
                <h3 className="text-xs font-bold uppercase tracking-wider text-text-secondary">{copy.activeMissions}</h3>
              </div>
              <div className="space-y-2">
                {selectedMissionItems.map((mission) => (
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
                            style={{ width: `${Math.min((mission.progress / Math.max(1, mission.target)) * 100, 100)}%` }}
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

          {selectedChallengeItems.length > 0 && (
            <div className="space-y-2">
              <div className="flex items-center gap-2">
                <img src={emojiChallenges} alt={copy.challengesAlt} className="h-4 w-4 object-contain" />
                <h3 className="text-xs font-bold uppercase tracking-wider text-text-secondary">{copy.activeChallenges}</h3>
              </div>
              <div className="space-y-2">
                {selectedChallengeItems.map((challenge) => (
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
                            style={{ width: `${Math.min((challenge.progress / Math.max(1, challenge.target)) * 100, 100)}%` }}
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

          {selectedHistoryItems.length > 0 && (
            <div className="space-y-2">
              <div className="flex items-center gap-2">
                <Trophy size={16} className="text-green-500" />
                <h3 className="text-xs font-bold uppercase tracking-wider text-text-secondary">{dashboardCopy.categoryHistory}</h3>
              </div>
              <div className="space-y-2">
                {selectedHistoryItems.map((item) => (
                  <Card key={item.id} className="!p-2.5 opacity-75">
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <div className="flex items-center gap-2">
                          <h4 className="text-sm font-semibold text-white">{translateTitle(item.title)}</h4>
                          <span className="rounded-full border border-white/10 bg-white/[0.03] px-2 py-0.5 text-[10px] uppercase tracking-[0.12em] text-text-secondary">
                            {item.type === 'mission' ? dashboardCopy.missionLabel : copy.challengeWord}
                          </span>
                        </div>
                        <p className="mt-1 text-xs text-text-secondary">{translateDescription(item.description)}</p>
                        {item.completed_at && (
                          <p className="mt-1 text-[11px] text-text-tertiary">{copy.completedOn(new Date(item.completed_at))}</p>
                        )}
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="rounded bg-white/5 px-2 py-0.5 text-xs font-bold text-white">+{item.points_reward}</span>
                        <img src={emojiDone} alt={copy.doneAlt} className="h-4 w-4 object-contain" />
                      </div>
                    </div>
                  </Card>
                ))}
              </div>
            </div>
          )}

          {selectedMissionItems.length === 0 && selectedChallengeItems.length === 0 && selectedHistoryItems.length === 0 && (
            <p className="text-center text-sm text-text-secondary">{copy.noMissions}</p>
          )}
            </>
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

        <div className="space-y-2">
          <div className="flex items-center gap-2">
            <img src={emojiMissions} alt={copy.missionsAlt} className="h-4 w-4 object-contain" />
            <h3 className="text-xs font-bold uppercase tracking-wider text-text-secondary">{dashboardCopy.dashboard}</h3>
          </div>

          {loading ? (
            <div className="space-y-3">
              <CategoryGridSkeleton />
              <div className="space-y-2">
                <CardLoadingSkeleton tone="accent" />
                <CardLoadingSkeleton tone="blue" />
              </div>
            </div>
          ) : (
            <>
              <div className="grid grid-cols-2 gap-3">
                {CATEGORY_ORDER.map((category) => {
                  const meta = categoryMeta[category];
                  const stats = categoryStats[category];
                  const isSelected = selectedCategory === category;

                  return (
                    <button
                      key={category}
                      type="button"
                      onClick={() => handleCategorySelect(category)}
                      className={`rounded-2xl border p-4 text-left transition-all ${
                        isSelected ? meta.selectedClassName : meta.cardClassName
                      }`}
                      >
                      <div className="flex items-center justify-between gap-3">
                        <div className={`flex h-10 w-10 items-center justify-center rounded-2xl border ${meta.iconWrapClassName}`}>
                          <img src={meta.iconSrc} alt={categoryName(category)} className="h-6 w-6 object-contain" />
                        </div>
                        <ChevronRight size={16} className={`${meta.accentClassName} ${isSelected ? 'opacity-100' : 'opacity-60'}`} />
                      </div>

                      <div className="mt-3">
                        <h4 className="text-sm font-semibold text-white">{categoryName(category)}</h4>
                      </div>

                      <div className="mt-3 space-y-1.5 text-xs text-text-secondary">
                        <p>
                          <span className={meta.accentClassName}>{dashboardCopy.activeLabel}:</span>{' '}
                          {stats.activeCount}
                        </p>
                        <div className="pt-0.5">
                          <p className={meta.accentClassName}>{dashboardCopy.progressLabel}</p>
                          <div className="mt-1 rounded-md border border-white/10 bg-white/[0.02] p-1">
                            <div className="flex h-2 items-center gap-1">
                              {CATEGORY_PROGRESS_SEGMENT_COLORS.map((color, index) => {
                                const threshold = ((index + 1) / CATEGORY_PROGRESS_SEGMENT_COLORS.length) * 100;
                                const isFilled = stats.remainingPercent >= threshold;
                                return (
                                  <div
                                    key={`${category}-progress-${color}`}
                                    className="h-full flex-1 rounded-[2px] transition-colors duration-300"
                                    style={{
                                      backgroundColor: isFilled ? color : 'rgba(255,255,255,0.08)',
                                    }}
                                  />
                                );
                              })}
                            </div>
                          </div>
                        </div>
                      </div>
                    </button>
                  );
                })}
              </div>

            </>
          )}
        </div>
      </div>
    </div>
  );
}
