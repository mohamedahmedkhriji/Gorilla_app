import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { createPortal } from 'react-dom';
import { ArrowLeft, ChevronRight, Info, Trophy } from 'lucide-react';
import { Header } from '../ui/Header';
import { Card } from '../ui/Card';
import { LeaderboardScreen } from './LeaderboardScreen';
import { api } from '../../services/api';
import { normalizeGamificationSummary } from '../../services/gamificationEvents';
import { offlineCacheKeys, readOfflineCacheValue } from '../../services/offlineCache';
import { getRankBadgeImage } from '../../services/rankTheme';
import { LocalizedLanguageRecord, getLanguageLocale, pickLanguage } from '../../services/language';
import { useAppLanguage } from '../../hooks/useAppLanguage';
import type { GamificationSummaryResponse } from '../../types/gamification';
import { RANK_BADGES } from '../../services/missions';
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
  'add a friend': 'engagement',
  'accept a friend invitation': 'engagement',
  'react to 5 posts': 'engagement',
  'first blog post': 'engagement',
  'first 10 blog views': 'engagement',
  'first 10 post reactions': 'engagement',
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
  'add a friend': 'Ajouter un ami',
  'accept a friend invitation': 'Accepter une invitation d ami',
  'react to 5 posts': 'Reagir a 5 posts',
  'first blog post': 'Premier post blog',
  'first 10 blog views': 'Premieres 10 vues du blog',
  'first 10 post reactions': 'Premieres 10 reactions sur un post',
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
  'send your first friend request.': 'Envoie ta premiere demande d ami.',
  'accept your first friend request.': 'Accepte ta premiere demande d ami.',
  'react to 5 community posts.': 'Reagis a 5 publications de la communaute.',
  'publish your first blog post.': 'Publie ton premier article de blog.',
  'reach 10 views across your blog posts.': 'Atteins 10 vues sur tes articles de blog.',
  'reach 10 reactions across your blog posts.': 'Atteins 10 reactions sur tes articles de blog.',
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

const getProgressPercent = (completed: number, total: number) => {
  if (total <= 0) return 0;
  return Math.min(100, Math.max(0, Math.round((completed / total) * 100)));
};

const getCurrentRankMinPoints = (rankName: string) => {
  const match = Object.values(RANK_BADGES).find(
    (rank) => String(rank.name || '').trim().toLowerCase() === String(rankName || '').trim().toLowerCase(),
  );
  return Number(match?.minPoints || 0);
};

function RankRewardProgressBar({
  value,
  label,
  className = 'bg-accent',
}: {
  value: number;
  label: string;
  className?: string;
}) {
  const safeValue = Math.min(100, Math.max(0, Math.round(Number(value) || 0)));
  return (
    <div
      role="progressbar"
      aria-label={label}
      aria-valuemin={0}
      aria-valuemax={100}
      aria-valuenow={safeValue}
      className="h-1.5 overflow-hidden rounded-full bg-white/10"
    >
      <div
        className={`h-full rounded-full transition-[width] duration-500 motion-reduce:transition-none ${className}`}
        style={{ width: `${safeValue}%` }}
      />
    </div>
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
  const { language, isArabic } = useAppLanguage();
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
  const experienceCopy = pickLanguage(language, {
    en: {
      heroLabel: 'Current rank',
      rankProgress: (current: number, target: number, rank: string) => `${current} / ${target} pts to ${rank}`,
      nextStepLabel: 'Your next step',
      nextStepStarter: 'Complete 1 mission to start climbing the ranks.',
      nextStepMomentum: (category: string) => `Complete 1 ${category.toLowerCase()} mission to keep progressing.`,
      nextStepFallback: 'Open a dashboard card to review active missions and recent wins.',
      nextStepHint: 'Rewards move faster when you stack consistent actions.',
      sectionHint: 'Track where you are winning and where to push next.',
      progressSummary: (completed: number, total: number) => `${completed} / ${total} completed`,
      emptyProgress: 'No tracked items yet',
      cardStatus: (active: number, completed: number) => {
        if (active > 0) return `${active} active now`;
        if (completed > 0) return 'Completed items are holding your momentum';
        return 'No active items yet';
      },
    },
    ar: {
      heroLabel: 'رتبتك الحالية',
      rankProgress: (current: number, target: number, rank: string) => `${current} / ${target} نقطة للوصول إلى ${rank}`,
      nextStepLabel: 'خطوتك التالية',
      nextStepStarter: 'أكمل مهمة واحدة لتبدأ الصعود.',
      nextStepMomentum: (category: string) => `أكمل مهمة واحدة في ${category} لتواصل التقدم.`,
      nextStepFallback: 'افتح بطاقة من لوحة الأداء لمراجعة المهام النشطة وآخر الإنجازات.',
      nextStepHint: 'المكافآت تتحرك أسرع عندما تحافظ على الاستمرارية.',
      sectionHint: 'تابع أين تتقدم وأين يجب أن تضغط أكثر.',
      progressSummary: (completed: number, total: number) => `${completed} / ${total} مكتمل`,
      emptyProgress: 'لا توجد عناصر متتبعة بعد',
      cardStatus: (active: number, completed: number) => {
        if (active > 0) return `${active} نشط الآن`;
        if (completed > 0) return 'العناصر المكتملة تحافظ على زخمك';
        return 'لا توجد عناصر نشطة بعد';
      },
    },
    it: {
      heroLabel: 'Rango attuale',
      rankProgress: (current: number, target: number, rank: string) => `${current} / ${target} pt per ${rank}`,
      nextStepLabel: 'Il tuo prossimo passo',
      nextStepStarter: 'Completa 1 missione per iniziare a salire di rango.',
      nextStepMomentum: (category: string) => `Completa 1 missione di ${category.toLowerCase()} per continuare a progredire.`,
      nextStepFallback: 'Apri una card della dashboard per rivedere missioni attive e vittorie recenti.',
      nextStepHint: 'Le ricompense arrivano piu in fretta con costanza.',
      sectionHint: 'Controlla dove stai vincendo e dove spingere di piu.',
      progressSummary: (completed: number, total: number) => `${completed} / ${total} completate`,
      emptyProgress: 'Nessun elemento monitorato',
      cardStatus: (active: number, completed: number) => {
        if (active > 0) return `${active} attive ora`;
        if (completed > 0) return 'Gli elementi completati sostengono il tuo slancio';
        return 'Nessun elemento attivo';
      },
    },
    de: {
      heroLabel: 'Aktueller Rang',
      rankProgress: (current: number, target: number, rank: string) => `${current} / ${target} Pkt bis ${rank}`,
      nextStepLabel: 'Dein naechster Schritt',
      nextStepStarter: 'Schliesse 1 Mission ab, um mit dem Aufstieg zu starten.',
      nextStepMomentum: (category: string) => `Schliesse 1 ${category.toLowerCase()}-Mission ab, um weiterzukommen.`,
      nextStepFallback: 'Oeffne eine Dashboard-Karte, um aktive Missionen und letzte Erfolge zu sehen.',
      nextStepHint: 'Belohnungen kommen schneller, wenn du konstant bleibst.',
      sectionHint: 'Sieh sofort, wo du gewinnst und wo du als Naechstes pushen solltest.',
      progressSummary: (completed: number, total: number) => `${completed} / ${total} abgeschlossen`,
      emptyProgress: 'Noch keine getrackten Eintraege',
      cardStatus: (active: number, completed: number) => {
        if (active > 0) return `${active} gerade aktiv`;
        if (completed > 0) return 'Abgeschlossene Aufgaben tragen dein Momentum';
        return 'Noch keine aktiven Eintraege';
      },
    },
    fr: {
      heroLabel: 'Rang actuel',
      rankProgress: (current: number, target: number, rank: string) => `${current} / ${target} pts pour ${rank}`,
      nextStepLabel: 'Ta prochaine etape',
      nextStepStarter: 'Termine 1 mission pour commencer a grimper.',
      nextStepMomentum: (category: string) => `Termine 1 mission de ${category.toLowerCase()} pour continuer a progresser.`,
      nextStepFallback: 'Ouvre une carte du tableau pour voir tes missions actives et tes dernieres victoires.',
      nextStepHint: 'Les recompenses arrivent plus vite avec de la regularite.',
      sectionHint: 'Vois tout de suite ou tu progresses et ou pousser ensuite.',
      progressSummary: (completed: number, total: number) => `${completed} / ${total} termines`,
      emptyProgress: 'Aucun element suivi pour le moment',
      cardStatus: (active: number, completed: number) => {
        if (active > 0) return `${active} actifs maintenant`;
        if (completed > 0) return 'Les elements termines entretiennent ton elan';
        return 'Aucun element actif';
      },
    },
  });

  const translateText = useCallback((value: string, map: Record<string, LocalizedLanguageRecord<string>>) => {
    const key = value.trim().toLowerCase();
    if (language === 'fr') {
      const frOverride = map === TITLE_TRANSLATIONS
        ? TITLE_TRANSLATION_FR_OVERRIDES[key]
        : DESCRIPTION_TRANSLATION_FR_OVERRIDES[key];
      if (frOverride) return frOverride;
    }
    return map[key]?.[language] || value;
  }, [language]);

  const translateTitle = useCallback((value: string) => translateText(value, TITLE_TRANSLATIONS), [translateText]);
  const translateDescription = useCallback((value: string) => translateText(value, DESCRIPTION_TRANSLATIONS), [translateText]);

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
  const [gamificationSummary, setGamificationSummary] = useState<GamificationSummaryResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [selectedCategory, setSelectedCategory] = useState<DashboardCategory>('consistency');
  const [showCategoryDetail, setShowCategoryDetail] = useState(false);
  const [categoryDetailLoading, setCategoryDetailLoading] = useState(false);
  const [showInfo, setShowInfo] = useState(false);

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
        const normalizedSummary = normalizeGamificationSummary(cachedSummary);
        setSummary({
          totalPoints: Number(cachedSummary.totalPoints || 0),
          rank: String(cachedSummary.rank || 'Bronze'),
          nextRank: cachedSummary.nextRank || null,
        });
        setGamificationSummary(normalizedSummary);
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
          const normalizedSummary = normalizeGamificationSummary(summaryData);
          setSummary({
            totalPoints: Number(summaryData.totalPoints || 0),
            rank: String(summaryData.rank || 'Bronze'),
            nextRank: summaryData.nextRank || null,
          });
          setGamificationSummary(normalizedSummary);
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

  const activeMissions = useMemo(() => missions.filter((m) => m.status === 'active'), [missions]);
  const activeDailyChallenges = useMemo(() => dailyChallenges.filter((c) => c.status === 'active'), [dailyChallenges]);
  const activeWeeklyChallenges = useMemo(() => weeklyChallenges.filter((c) => c.status === 'active'), [weeklyChallenges]);
  const activeChallenges = useMemo(
    () => [...activeDailyChallenges, ...activeWeeklyChallenges],
    [activeDailyChallenges, activeWeeklyChallenges],
  );

  const rankBadgeImage = getRankBadgeImage(summary.rank);
  const rankNames = pickLanguage(language, RANK_NAME_MAP);
  const rankKey = String(summary.rank || '').trim().toLowerCase();
  const rankNameDisplay = rankNames[rankKey] || RANK_NAME_MAP.en?.[rankKey] || summary.rank;
  const nextRankKey = String(summary.nextRank?.name || '').trim().toLowerCase();
  const nextRankName = summary.nextRank ? (rankNames[nextRankKey] || RANK_NAME_MAP.en?.[nextRankKey] || summary.nextRank.name) : '';
  const nextRankRequirement = summary.nextRank?.minPoints ?? summary.totalPoints;
  const currentRankMinPoints = getCurrentRankMinPoints(summary.rank);
  const remainingPoints = summary.nextRank
    ? Math.max(0, nextRankRequirement - summary.totalPoints)
    : 0;
  const rankProgressPercent = summary.nextRank
    ? getProgressPercent(summary.totalPoints - currentRankMinPoints, Math.max(1, nextRankRequirement - currentRankMinPoints))
    : 100;
  const rivalry = gamificationSummary?.progress?.rivalry || null;
  const passPlayerLabel = (points: number, name: string) =>
    pickLanguage(language, {
      en: `${points} ${copy.pointsShort} to pass ${name}`,
      ar: `${points} ${copy.pointsShort} لتتجاوز ${name}`,
      it: `${points} ${copy.pointsShort} per superare ${name}`,
      de: `${points} ${copy.pointsShort} bis vor ${name}`,
      fr: `${points} ${copy.pointsShort} pour depasser ${name}`,
    });
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
      progressBarClassName: 'bg-gradient-to-r from-emerald-300 via-emerald-400 to-lime-300',
      hoverClassName: 'hover:border-emerald-300/40 hover:bg-emerald-500/[0.11] hover:shadow-[0_18px_38px_rgba(16,185,129,0.16)]',
      glowClassName: 'bg-emerald-400/20',
    },
    strength: {
      iconSrc: emojiStrength,
      iconWrapClassName: 'bg-rose-500/10 border-rose-400/25',
      cardClassName: 'border-rose-400/20 bg-rose-500/[0.05]',
      selectedClassName: 'border-rose-400/45 bg-rose-500/[0.10]',
      accentClassName: 'text-rose-300',
      progressBarClassName: 'bg-gradient-to-r from-rose-300 via-rose-400 to-orange-300',
      hoverClassName: 'hover:border-rose-300/40 hover:bg-rose-500/[0.11] hover:shadow-[0_18px_38px_rgba(244,63,94,0.16)]',
      glowClassName: 'bg-rose-400/20',
    },
    recovery: {
      iconSrc: emojiRecovery,
      iconWrapClassName: 'bg-sky-500/10 border-sky-400/25',
      cardClassName: 'border-sky-400/20 bg-sky-500/[0.05]',
      selectedClassName: 'border-sky-400/45 bg-sky-500/[0.10]',
      accentClassName: 'text-sky-300',
      progressBarClassName: 'bg-gradient-to-r from-sky-300 via-cyan-300 to-blue-300',
      hoverClassName: 'hover:border-sky-300/40 hover:bg-sky-500/[0.11] hover:shadow-[0_18px_38px_rgba(56,189,248,0.16)]',
      glowClassName: 'bg-sky-400/20',
    },
    engagement: {
      iconSrc: emojiEngagement,
      iconWrapClassName: 'bg-violet-500/10 border-violet-400/25',
      cardClassName: 'border-violet-400/20 bg-violet-500/[0.05]',
      selectedClassName: 'border-violet-400/45 bg-violet-500/[0.10]',
      accentClassName: 'text-violet-300',
      progressBarClassName: 'bg-gradient-to-r from-violet-300 via-fuchsia-300 to-pink-300',
      hoverClassName: 'hover:border-violet-300/40 hover:bg-violet-500/[0.11] hover:shadow-[0_18px_38px_rgba(168,85,247,0.16)]',
      glowClassName: 'bg-violet-400/20',
    },
  } satisfies Record<
    DashboardCategory,
    {
      iconSrc: string;
      iconWrapClassName: string;
      cardClassName: string;
      selectedClassName: string;
      accentClassName: string;
      progressBarClassName: string;
      hoverClassName: string;
      glowClassName: string;
    }
  >;

  const categoryStats = useMemo(
    () =>
      CATEGORY_ORDER.reduce((acc, category) => {
        const missionItems = categorizedActiveMissions[category];
        const challengeItems = categorizedActiveChallenges[category];
        const historyItems = categorizedHistory[category];
        const progressItems = [...missionItems, ...challengeItems];
        const activeCompleted = progressItems.reduce((sum, item) => sum + Math.max(0, Math.round(Number(item.progress || 0))), 0);
        const activeTotal = progressItems.reduce((sum, item) => sum + Math.max(0, Math.round(Number(item.target || 0))), 0);
        const completedCount = historyItems.length + activeCompleted;
        const trackedCount = historyItems.length + activeTotal;
        const completionPercent = getProgressPercent(completedCount, trackedCount);

        acc[category] = {
          activeCount: missionItems.length + challengeItems.length,
          completedCount,
          completionPercent,
          trackedCount,
        };
        return acc;
      }, {} as Record<DashboardCategory, { activeCount: number; completedCount: number; completionPercent: number; trackedCount: number }>),
    [categorizedActiveChallenges, categorizedActiveMissions, categorizedHistory],
  );

  const nextMission = useMemo(() => {
    const missionOptions = activeMissions
      .filter((mission) => !mission.completed)
      .map((mission) => ({
        kind: 'mission' as const,
        title: translateTitle(mission.title),
        category: inferDashboardCategory(mission.title, mission.description),
        completed: Math.max(0, Math.round(Number(mission.progress || 0))),
        total: Math.max(0, Math.round(Number(mission.target || 0))),
        rewardPoints: Math.max(0, Math.round(Number(mission.points_reward || 0))),
      }));

    const challengeOptions = activeChallenges
      .filter((challenge) => !challenge.completed)
      .map((challenge) => ({
        kind: 'challenge' as const,
        title: translateTitle(challenge.title),
        category: inferDashboardCategory(challenge.title, challenge.description),
        completed: Math.max(0, Math.round(Number(challenge.progress || 0))),
        total: Math.max(0, Math.round(Number(challenge.target || 0))),
        rewardPoints: Math.max(0, Math.round(Number(challenge.points_reward || 0))),
      }));

    return [...missionOptions, ...challengeOptions]
      .sort((left, right) => {
        const leftPercent = getProgressPercent(left.completed, left.total);
        const rightPercent = getProgressPercent(right.completed, right.total);
        if (rightPercent !== leftPercent) return rightPercent - leftPercent;
        return right.rewardPoints - left.rewardPoints;
      })[0] || null;
  }, [activeChallenges, activeMissions, translateTitle]);

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
      <div dir={isArabic ? 'rtl' : 'ltr'} className={`flex-1 flex min-h-screen flex-col bg-background pb-24 ${isArabic ? 'text-right' : 'text-left'}`}>
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
      <div dir={isArabic ? 'rtl' : 'ltr'} className={`flex-1 flex min-h-screen flex-col bg-background pb-24 ${isArabic ? 'text-right' : 'text-left'}`}>
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
    <main dir={isArabic ? 'rtl' : 'ltr'} className={`flex-1 min-h-[100dvh] bg-background text-text-primary ${isArabic ? 'text-right' : 'text-left'}`}>
      <div className="mx-auto w-full max-w-md px-4 pb-[calc(env(safe-area-inset-bottom,0px)+6rem)] pt-[calc(env(safe-area-inset-top,0px)+1rem)]">
        <header className="flex items-center justify-between gap-3">
          <button
            type="button"
            onClick={onBack}
            aria-label="Go back"
            className="surface-glass flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl border border-white/10 text-white transition active:scale-95 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
          >
            <ArrowLeft size={20} aria-hidden="true" />
          </button>

          <h1 className="min-w-0 flex-1 truncate text-center text-2xl font-bold tracking-[-0.02em] text-white">
            {copy.title}
          </h1>

          <button
            type="button"
            onClick={() => setShowInfo(true)}
            aria-label="How ranks and rewards work"
            className="surface-glass flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl border border-white/10 text-text-secondary transition hover:text-white active:scale-95 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
          >
            <Info size={20} aria-hidden="true" />
          </button>
        </header>

        <section className="mt-6 overflow-hidden rounded-[1.75rem] border border-white/10 bg-card/80 p-5 shadow-[0_18px_44px_rgba(0,0,0,0.22)]" aria-labelledby="rank-rewards-current-rank">
          <div className="flex items-center gap-4">
            <div className="relative flex h-24 w-24 shrink-0 items-center justify-center rounded-[1.5rem] border border-amber-300/25 bg-amber-400/10">
              <div className="absolute inset-3 rounded-full bg-amber-300/15 blur-xl" aria-hidden="true" />
              <img src={rankBadgeImage} alt={rankNameDisplay} className="relative h-16 w-16 object-contain" />
            </div>

            <div className="min-w-0">
              <p className="text-[11px] font-bold uppercase tracking-[0.18em] text-amber-300">{experienceCopy.heroLabel}</p>
              <h2 id="rank-rewards-current-rank" className="mt-1 text-4xl font-bold tracking-[-0.03em] text-white">
                {rankNameDisplay}
              </h2>
              <p className="mt-1 text-base font-semibold text-white">{copy.points(summary.totalPoints)}</p>
            </div>
          </div>

          <div className="mt-5">
            <div className="mb-2 flex items-center justify-between gap-3 text-[11px] font-bold uppercase tracking-[0.16em] text-text-tertiary">
              <span className="text-amber-300">{rankNameDisplay}</span>
              <span>{summary.nextRank ? nextRankName : copy.topRank}</span>
            </div>
            <RankRewardProgressBar
              value={rankProgressPercent}
              label={`${rankProgressPercent}% progress from ${rankNameDisplay} to ${summary.nextRank ? nextRankName : copy.topRank}`}
            />
            <div className="mt-3 flex items-center justify-between gap-3 text-sm">
              <span className="min-w-0 text-text-secondary">
                {summary.nextRank ? `${remainingPoints} ${copy.pointsShort} to ${nextRankName}` : copy.topRank}
              </span>
              <span className="shrink-0 font-bold text-white">{rankProgressPercent}%</span>
            </div>
            {summary.nextRank && (
              <div className="mt-5 inline-flex min-h-11 max-w-full items-center rounded-full border border-white/10 bg-white/[0.04] px-4 text-sm text-text-secondary">
                <img src={getRankBadgeImage(summary.nextRank.name)} alt="" aria-hidden="true" className="mr-2 h-6 w-6 shrink-0 object-contain" />
                <span className="min-w-0 truncate">Next reward: <strong className="text-white">{nextRankName} badge</strong></span>
              </div>
            )}
          </div>
        </section>

        <section className="mt-4 rounded-[1.75rem] border border-accent/70 bg-accent/[0.055] p-5 shadow-[0_18px_44px_rgba(0,0,0,0.2)]" aria-labelledby="rank-rewards-next-mission">
          {nextMission ? (
            <>
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="text-[11px] font-bold uppercase tracking-[0.18em] text-accent">{experienceCopy.nextStepLabel}</p>
                  <h2 id="rank-rewards-next-mission" className="mt-2 text-2xl font-bold leading-tight text-white">
                    {nextMission.title}
                  </h2>
                  <p className="mt-1 text-sm text-text-secondary">
                    {nextMission.completed} of {nextMission.total} completed
                  </p>
                </div>
                {nextMission.rewardPoints > 0 && (
                  <span className="shrink-0 rounded-full border border-accent/35 bg-accent/10 px-3 py-1.5 text-sm font-bold text-accent">
                    +{nextMission.rewardPoints} {copy.pointsShort}
                  </span>
                )}
              </div>

              <div className="mt-4">
                <RankRewardProgressBar
                  value={getProgressPercent(nextMission.completed, nextMission.total)}
                  label={`${nextMission.title}: ${getProgressPercent(nextMission.completed, nextMission.total)}% completed`}
                />
              </div>

              <button
                type="button"
                onClick={() => handleCategorySelect(nextMission.category)}
                className="mt-4 flex min-h-12 w-full items-center justify-center rounded-2xl bg-accent px-5 text-sm font-bold text-black transition hover:brightness-95 active:scale-[0.985] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2 focus-visible:ring-offset-background"
              >
                Continue
              </button>
            </>
          ) : (
            <div className="flex flex-col gap-4">
              <div>
                <p className="text-[11px] font-bold uppercase tracking-[0.18em] text-accent">{experienceCopy.nextStepLabel}</p>
                <h2 id="rank-rewards-next-mission" className="mt-2 text-xl font-bold text-white">{experienceCopy.nextStepFallback}</h2>
                <p className="mt-1 text-sm text-text-secondary">{experienceCopy.nextStepHint}</p>
              </div>
              <button
                type="button"
                onClick={() => handleCategorySelect(selectedCategory)}
                className="min-h-12 rounded-2xl bg-accent px-5 text-sm font-bold text-black transition active:scale-[0.985] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2 focus-visible:ring-offset-background"
              >
                View missions
              </button>
            </div>
          )}
        </section>

        <section className="mt-7" aria-labelledby="rank-rewards-week-title">
          <h2 id="rank-rewards-week-title" className="text-xl font-bold text-white">This week</h2>

          <div className="mt-3 overflow-hidden rounded-[1.5rem] border border-white/10 bg-card/75">
            {loading ? (
              <CategoryGridSkeleton />
            ) : CATEGORY_ORDER.map((category, index) => {
              const meta = categoryMeta[category];
              const stats = categoryStats[category];
              const progressValue = getProgressPercent(stats.completedCount, stats.trackedCount);
              const completionText = stats.trackedCount > 0
                ? `${stats.completedCount} of ${stats.trackedCount} completed`
                : experienceCopy.emptyProgress;

              return (
                <button
                  key={category}
                  type="button"
                  onClick={() => handleCategorySelect(category)}
                  aria-label={`${categoryName(category)}, ${completionText}, ${stats.activeCount} active, ${progressValue}%`}
                  className={`group flex min-h-[92px] w-full items-center gap-3 px-4 py-3 text-left transition hover:bg-white/[0.035] active:scale-[0.995] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-accent motion-reduce:transition-none ${index > 0 ? 'border-t border-white/10' : ''} ${isArabic ? 'text-right' : 'text-left'}`}
                >
                  <span className={`flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl border ${meta.iconWrapClassName}`}>
                    <img src={meta.iconSrc} alt="" aria-hidden="true" className="h-8 w-8 object-contain" />
                  </span>

                  <span className="min-w-0 flex-1">
                    <span className="flex items-baseline justify-between gap-3">
                      <span className="truncate text-base font-bold text-white">{categoryName(category)}</span>
                      <span className={`shrink-0 text-base font-bold ${progressValue > 0 ? meta.accentClassName : 'text-text-secondary'}`}>
                        {progressValue}%
                      </span>
                    </span>
                    <span className="mt-0.5 flex items-center justify-between gap-3 text-sm text-text-secondary">
                      <span className="min-w-0 truncate">{completionText}</span>
                      <span className="shrink-0">{stats.activeCount} active</span>
                    </span>
                    <span className="mt-2 block">
                      <RankRewardProgressBar
                        value={progressValue}
                        className={meta.progressBarClassName}
                        label={`${categoryName(category)} progress: ${progressValue}%`}
                      />
                    </span>
                  </span>

                  <ChevronRight
                    size={20}
                    aria-hidden="true"
                    className={`shrink-0 text-text-tertiary transition-transform group-hover:translate-x-0.5 ${isArabic ? 'rotate-180 group-hover:-translate-x-0.5' : ''}`}
                  />
                </button>
              );
            })}
          </div>
        </section>

        <section className="mt-4 grid grid-cols-2 gap-3" aria-label="Rank navigation">
          <button
            type="button"
            onClick={() => setShowLeaderboard(true)}
            className="group relative min-h-[112px] rounded-[1.4rem] border border-white/10 bg-card/75 p-4 pr-9 text-left transition hover:border-accent/30 hover:bg-white/[0.04] active:scale-[0.985] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
          >
            <span className="block min-w-0">
              <span className="flex min-w-0 items-center gap-2">
                <img src={emojiViewLeaderboard} alt="" aria-hidden="true" className="h-9 w-9 shrink-0 object-contain" />
                <span className="min-w-0 text-[15px] font-bold leading-tight text-white">Leaderboard</span>
              </span>
              <span className="mt-3 block text-sm leading-snug text-text-secondary">
                {rivalry?.nextPlayerName
                  ? passPlayerLabel(Math.max(0, Number(rivalry.deltaToNextPlayer || 0)), rivalry.nextPlayerName)
                  : 'Gym rankings'}
              </span>
            </span>
            <ChevronRight size={20} aria-hidden="true" className="absolute right-3 top-1/2 -translate-y-1/2 text-text-secondary transition-transform group-hover:translate-x-0.5" />
          </button>

          <button
            type="button"
            onClick={() => setShowHistory(true)}
            className="group relative min-h-[112px] rounded-[1.4rem] border border-white/10 bg-card/75 p-4 pr-9 text-left transition hover:border-accent/30 hover:bg-white/[0.04] active:scale-[0.985] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
          >
            <span className="block min-w-0">
              <span className="flex min-w-0 items-center gap-2">
                <img src={emojiChallenges} alt="" aria-hidden="true" className="h-9 w-9 shrink-0 object-contain" />
                <span className="min-w-0 text-[15px] font-bold leading-tight text-white">Mission History</span>
              </span>
              <span className="mt-3 block text-sm leading-snug text-text-secondary">Completed rewards</span>
            </span>
            <ChevronRight size={20} aria-hidden="true" className="absolute right-3 top-1/2 -translate-y-1/2 text-text-secondary transition-transform group-hover:translate-x-0.5" />
          </button>
        </section>
      </div>

      {showInfo && typeof document !== 'undefined' && createPortal(
        <div
          className="fixed inset-0 z-[160] flex items-end justify-center bg-black/60 px-4 pb-4 pt-[calc(env(safe-area-inset-top,0px)+1rem)] sm:items-center"
          onClick={() => setShowInfo(false)}
          role="presentation"
        >
          <div
            className="w-full max-w-md rounded-[1.5rem] border border-white/10 bg-card p-5 text-left shadow-[0_24px_60px_rgba(0,0,0,0.45)]"
            role="dialog"
            aria-modal="true"
            aria-labelledby="rank-rewards-info-title"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="flex items-center justify-between gap-3">
              <h2 id="rank-rewards-info-title" className="text-lg font-bold text-white">How points work</h2>
              <button
                type="button"
                onClick={() => setShowInfo(false)}
                className="flex h-10 w-10 items-center justify-center rounded-xl border border-white/10 text-text-secondary transition hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
                aria-label="Close rank information"
              >
                <Info size={18} aria-hidden="true" />
              </button>
            </div>
            <div className="mt-4 space-y-3 text-sm leading-relaxed text-text-secondary">
              <p>Earn points by completing missions, challenges, workouts, recovery check-ins, and community actions.</p>
              <p>Your rank is calculated from total points. Progress bars show real completion, so zero progress stays at 0%.</p>
              {summary.nextRank && <p>{remainingPoints} {copy.pointsShort} remain before {nextRankName}.</p>}
            </div>
          </div>
        </div>,
        document.body,
      )}
    </main>
  );
}
