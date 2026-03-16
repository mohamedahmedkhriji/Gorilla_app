import React, { useEffect, useMemo, useState } from 'react';
import { Header } from '../ui/Header';
import { Card } from '../ui/Card';
import { Trophy } from 'lucide-react';
import { LeaderboardScreen } from './LeaderboardScreen';
import { api } from '../../services/api';
import { getRankBadgeImage } from '../../services/rankTheme';
import { getActiveLanguage, getStoredLanguage } from '../../services/language';
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
        <div className="flex items-start justify-between mb-2">
          <div className="h-4 w-40 rounded bg-white/10" />
          <div className="h-5 w-12 rounded bg-white/10" />
        </div>
        <div className="h-3 w-full rounded bg-white/10 mb-1.5" />
        <div className="h-3 w-2/3 rounded bg-white/10 mb-2" />
        <div className="flex items-center gap-2">
          <div className="flex-1 h-1.5 rounded-full bg-white/5 overflow-hidden">
            <div className={`h-full w-1/2 rounded-full ${barTone}`} />
          </div>
          <div className="h-3 w-12 rounded bg-white/10" />
        </div>
      </div>
    </Card>
  );
}

export function RankingsRewardsScreen({ onBack }: RankingsRewardsScreenProps) {
  const isArabic = getActiveLanguage(getStoredLanguage()) === 'ar';
  const copy = {
    title: isArabic ? 'الرتب والمكافآت' : 'Rank & Rewards',
    history: isArabic ? 'السجل' : 'History',
    missionHistory: isArabic ? 'سجل المهام' : 'Mission History',
    challengeHistory: isArabic ? 'سجل التحديات' : 'Challenge History',
    noHistory: isArabic ? 'لا يوجد سجل بعد' : 'No history yet',
    viewLeaderboard: isArabic ? 'عرض لوحة الصدارة' : 'View Leaderboard',
    seeRankings: isArabic ? 'عرض ترتيب النادي' : 'See gym rankings',
    missionChallengeHistory: isArabic ? 'سجل المهام والتحديات' : 'Mission & Challenge History',
    viewCompleted: isArabic ? 'عرض العناصر المكتملة' : 'View completed items',
    activeMissions: isArabic ? 'المهام النشطة' : 'Active Missions',
    activeChallenges: isArabic ? 'التحديات النشطة' : 'Active Challenges',
    completedMissions: isArabic ? 'المهام المكتملة' : 'Completed Missions',
    completedChallenges: isArabic ? 'التحديات المكتملة' : 'Completed Challenges',
    noMissions: isArabic ? 'لا توجد مهام أو تحديات' : 'No missions or challenges found',
    points: (value: number) => (isArabic ? `${value} نقطة` : `${value} points`),
    nextRank: (rank: string, points: number) =>
      isArabic ? `التالي: ${rank} (${points} نقطة)` : `Next: ${rank} (${points} pts)`,
    topRank: isArabic ? 'أعلى رتبة تم الوصول إليها' : 'Top rank achieved',
    completedOn: (date: Date) =>
      isArabic
        ? `اكتملت في ${date.toLocaleDateString('ar-EG')}`
        : `Completed ${date.toLocaleDateString()}`,
    challengeType: (type: string) => {
      if (!isArabic) return type === 'daily' ? 'Daily' : 'Weekly';
      return type === 'daily' ? 'يومي' : 'أسبوعي';
    },
    remaining: (value: number) =>
      isArabic ? `${value} متبقي` : `${value} more to complete`,
    newAlt: isArabic ? 'جديد' : 'new',
    doneAlt: isArabic ? 'مكتمل' : 'done',
    missionsAlt: isArabic ? 'المهام' : 'Missions',
    challengesAlt: isArabic ? 'التحديات' : 'Challenges',
  };
  const rankNameMap: Record<string, string> = {
    bronze: 'برونزي',
    silver: 'فضي',
    gold: 'ذهبي',
    platinum: 'بلاتيني',
    diamond: 'ألماسي',
    elite: 'نخبوي',
  };
  const titleTranslations: Record<string, string> = {
    'workout machine': 'آلة التمرين',
    'getting started': 'البداية',
    'recovery master': 'خبير التعافي',
    'workout starter': 'بداية التمرين',
    'streak starter': 'بداية السلسلة',
    'daily iron habit': 'عادة الحديد اليومية',
    'daily recovery check': 'فحص التعافي اليومي',
    'weekly workout consistency': 'انتظام التمرين الأسبوعي',
    'weekly recovery discipline': 'انضباط التعافي الأسبوعي',
  };
  const descriptionTranslations: Record<string, string> = {
    'complete 20 workouts': 'أكمل 20 تمرينًا',
    'complete 10 workouts': 'أكمل 10 تمارين',
    'log recovery factors 7 days in a row': 'سجّل عوامل التعافي 7 أيام متتالية',
    'complete 5 workouts': 'أكمل 5 تمارين',
    'reach a 3-day recovery streak': 'حقّق سلسلة تعافٍ لمدة 3 أيام',
    'complete at least one workout today': 'أكمل تمرينًا واحدًا على الأقل اليوم',
    'submit your recovery check-in today': 'أرسل حالة التعافي اليوم',
    'train on 4 different days this week': 'تمرّن في 4 أيام مختلفة هذا الأسبوع',
    'log recovery on 5 days this week': 'سجّل التعافي في 5 أيام هذا الأسبوع',
  };
  const translateText = (value: string, map: Record<string, string>) => {
    if (!isArabic) return value;
    const key = value.trim().toLowerCase();
    return map[key] ?? value;
  };
  const translateTitle = (value: string) => translateText(value, titleTranslations);
  const translateDescription = (value: string) => translateText(value, descriptionTranslations);
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
  const rankNameDisplay = isArabic
    ? (rankNameMap[String(summary.rank || '').trim().toLowerCase()] || summary.rank)
    : summary.rank;
  const nextRankName = summary.nextRank
    ? (isArabic ? (rankNameMap[String(summary.nextRank.name || '').trim().toLowerCase()] || summary.nextRank.name) : summary.nextRank.name)
    : '';
  const nextRankText = summary.nextRank
    ? copy.nextRank(nextRankName, summary.nextRank.pointsNeeded)
    : copy.topRank;

  const missionHistoryByPeriod = useMemo(
    () => missionHistory.reduce((acc, item) => {
      const key = String(item.period || 'Unknown');
      if (!acc[key]) acc[key] = [];
      acc[key].push(item);
      return acc;
    }, {} as Record<string, any[]>),
    [missionHistory],
  );

  const challengeHistoryByPeriod = useMemo(
    () => challengeHistory.reduce((acc, item) => {
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
      <div className="flex-1 flex flex-col min-h-screen pb-24 bg-background">
        <div className="px-4 sm:px-6 pt-2">
          <Header title={copy.history} onBack={() => setShowHistory(false)} compact />
        </div>

        <div className="px-4 sm:px-6 space-y-6 mt-4">
          {Object.keys(missionHistoryByPeriod).length > 0 && (
            <div>
              <h3 className="text-xs font-bold text-text-secondary uppercase tracking-wider mb-3">{copy.missionHistory}</h3>
              <div className="space-y-4">
                {Object.entries(missionHistoryByPeriod).map(([period, periodMissions]) => (
                  <div key={`mission-${period}`}>
                    <h4 className="text-xs font-bold text-text-secondary uppercase tracking-wider mb-2">{period}</h4>
                    <div className="space-y-2">
                      {periodMissions.map((mission, idx) => (
                        <Card key={`m-${period}-${idx}`} className="!p-4">
                          <div className="flex justify-between items-start">
                            <div>
                              <h5 className="font-bold text-white">{translateTitle(mission.title)}</h5>
                              <p className="text-xs text-text-secondary mt-1">
                                {copy.completedOn(new Date(mission.completed_at))}
                              </p>
                            </div>
                            <p className="text-xs text-accent font-bold">+{mission.points_reward} {isArabic ? 'نقطة' : 'pts'}</p>
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
              <h3 className="text-xs font-bold text-text-secondary uppercase tracking-wider mb-3">{copy.challengeHistory}</h3>
              <div className="space-y-4">
                {Object.entries(challengeHistoryByPeriod).map(([period, periodChallenges]) => (
                  <div key={`challenge-${period}`}>
                    <h4 className="text-xs font-bold text-text-secondary uppercase tracking-wider mb-2">{period}</h4>
                    <div className="space-y-2">
                      {periodChallenges.map((challenge, idx) => (
                        <Card key={`c-${period}-${idx}`} className="!p-4">
                          <div className="flex justify-between items-start">
                            <div>
                              <h5 className="font-bold text-white">{translateTitle(challenge.title)}</h5>
                              <p className="text-xs text-text-secondary mt-1">
                                {copy.challengeType(challenge.challenge_type)} {isArabic ? 'تحدي' : 'challenge'}
                              </p>
                            </div>
                            <p className="text-xs text-accent font-bold">+{challenge.points_reward} {isArabic ? 'نقطة' : 'pts'}</p>
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
            <p className="text-center text-text-secondary text-sm">{copy.noHistory}</p>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="flex-1 flex flex-col min-h-screen pb-24 bg-background">
      <div className="px-4 sm:px-6 pt-2">
        <Header title={copy.title} onBack={onBack} compact />
      </div>

      <div className="px-4 sm:px-6 space-y-2.5 mt-1">
        <div className="flex flex-col items-center py-1.5">
          <div className="w-20 h-20 rounded-full bg-accent/10 border-2 border-accent/30 flex items-center justify-center mb-2">
            <img src={rankBadgeImage} alt={rankNameDisplay} className="h-12 w-12 object-contain" />
          </div>
          <h2 className="text-lg font-bold text-white">{rankNameDisplay}</h2>
          <p className="mt-0.5 text-sm text-text-secondary">{copy.points(summary.totalPoints)}</p>
          <p className="text-xs text-text-secondary mt-0.5">{nextRankText}</p>
        </div>

        <button
          onClick={() => setShowLeaderboard(true)}
          className="w-full bg-card rounded-lg p-3 border border-white/5 flex items-center justify-between hover:border-accent/20 transition-colors"
        >
          <div className="flex items-center gap-3">
            <img src={emojiViewLeaderboard} alt={copy.viewLeaderboard} className="w-5 h-5 object-contain" />
            <div className="text-left">
              <h4 className="font-semibold text-white text-sm">{copy.viewLeaderboard}</h4>
              <p className="text-xs text-text-secondary">{copy.seeRankings}</p>
            </div>
          </div>
          <span className="text-accent">→</span>
        </button>

        <button
          onClick={() => setShowHistory(true)}
          className="w-full bg-card rounded-lg p-3 border border-white/5 flex items-center justify-between hover:border-accent/20 transition-colors"
        >
          <div className="flex items-center gap-3">
            <img src={emojiChallenges} alt={copy.challengesAlt} className="w-5 h-5 object-contain" />
            <div className="text-left">
              <h4 className="font-semibold text-white text-sm">{copy.missionChallengeHistory}</h4>
              <p className="text-xs text-text-secondary">{copy.viewCompleted}</p>
            </div>
          </div>
          <span className="text-accent">→</span>
        </button>

        {loading ? (
          <div className="space-y-3">
            <div className="space-y-2">
              <div className="flex items-center gap-2">
                <img src={emojiMissions} alt={copy.missionsAlt} className="w-4 h-4 object-contain opacity-70" />
                <h3 className="text-xs font-bold text-text-secondary uppercase tracking-wider">{copy.activeMissions}</h3>
              </div>
              <div className="space-y-2">
                <CardLoadingSkeleton tone="accent" />
                <CardLoadingSkeleton tone="accent" />
              </div>
            </div>

            <div className="space-y-2">
              <div className="flex items-center gap-2">
                <img src={emojiChallenges} alt={copy.challengesAlt} className="w-4 h-4 object-contain opacity-70" />
                <h3 className="text-xs font-bold text-text-secondary uppercase tracking-wider">{copy.activeChallenges}</h3>
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
                  <img src={emojiMissions} alt={copy.missionsAlt} className="w-4 h-4 object-contain" />
                  <h3 className="text-xs font-bold text-text-secondary uppercase tracking-wider">{copy.activeMissions}</h3>
                </div>
                <div className="space-y-2">
                  {activeMissions.map((mission) => (
                    <Card key={mission.id} className="!p-2.5">
                      <div className="flex justify-between items-start mb-2">
                        <div className="flex items-center gap-1.5">
                          <h4 className="font-semibold text-white text-sm">{translateTitle(mission.title)}</h4>
                          {isNewWithin24Hours(mission.assigned_at || mission.created_at) && (
                            <img src={emojiNew} alt={copy.newAlt} className="w-6 h-4 object-contain" />
                          )}
                        </div>
                        <span className="text-xs font-bold text-accent bg-accent/10 px-2 py-0.5 rounded">
                          +{mission.points_reward}
                        </span>
                      </div>
                      <p className="text-xs text-text-secondary mb-1.5">{translateDescription(mission.description)}</p>
                      <div className="space-y-0.5">
                        <div className="flex items-center gap-2">
                          <div className="flex-1 h-1.5 bg-white/5 rounded-full overflow-hidden">
                            <div
                              className="h-full bg-accent rounded-full"
                              style={{ width: `${Math.min((mission.progress / mission.target) * 100, 100)}%` }}
                            />
                          </div>
                          <span className="text-xs text-text-tertiary font-mono">
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
                  <img src={emojiMissions} alt={copy.missionsAlt} className="w-4 h-4 object-contain" />
                  <h3 className="text-xs font-bold text-text-secondary uppercase tracking-wider">{copy.activeChallenges}</h3>
                </div>
                <div className="space-y-2">
                  {[...activeDailyChallenges, ...activeWeeklyChallenges].map((challenge) => (
                    <Card key={`${challenge.challenge_type}-${challenge.id}`} className="!p-2.5">
                      <div className="flex justify-between items-start mb-2">
                        <div>
                          <div className="flex items-center gap-1.5">
                            <h4 className="font-semibold text-white text-sm">{translateTitle(challenge.title)}</h4>
                            {isNewWithin24Hours(challenge.created_at) && (
                              <img src={emojiNew} alt={copy.newAlt} className="w-6 h-4 object-contain" />
                            )}
                          </div>
                          <p className="text-[11px] text-text-secondary mt-0.5 uppercase">{copy.challengeType(challenge.challenge_type)}</p>
                        </div>
                        <span className="text-xs font-bold text-blue-400 bg-blue-400/10 px-2 py-0.5 rounded">
                          +{challenge.points_reward}
                        </span>
                      </div>
                      <p className="text-xs text-text-secondary mb-1.5">
                        {translateDescription(challenge.description)}
                      </p>
                      <div className="space-y-0.5">
                        <div className="flex items-center gap-2">
                          <div className="flex-1 h-1.5 bg-white/5 rounded-full overflow-hidden">
                            <div
                              className="h-full bg-blue-400 rounded-full"
                              style={{ width: `${Math.min((challenge.progress / challenge.target) * 100, 100)}%` }}
                            />
                          </div>
                          <span className="text-xs text-text-tertiary font-mono">
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
                <h3 className="text-xs font-bold text-text-secondary uppercase tracking-wider">{copy.completedMissions}</h3>
              </div>
                {completedMissions.map((mission) => (
                  <Card key={`done-m-${mission.id}`} className="!p-2.5 opacity-60">
                    <div className="flex justify-between items-start">
                      <div>
                        <h4 className="font-semibold text-white text-sm">{translateTitle(mission.title)}</h4>
                        <p className="text-xs text-text-secondary mt-0.5">{translateDescription(mission.description)}</p>
                      </div>
                    <img src={emojiDone} alt={copy.doneAlt} className="w-4 h-4 object-contain" />
                  </div>
                </Card>
              ))}
              </div>
            )}

            {completedChallenges.length > 0 && (
              <div className="space-y-1">
              <div className="flex items-center gap-2">
                <Trophy size={16} className="text-green-500" />
                <h3 className="text-xs font-bold text-text-secondary uppercase tracking-wider">{copy.completedChallenges}</h3>
              </div>
                {completedChallenges.map((challenge) => (
                  <Card key={`done-c-${challenge.challenge_type}-${challenge.id}`} className="!p-2.5 opacity-60">
                    <div className="flex justify-between items-start">
                      <div>
                        <h4 className="font-semibold text-white text-sm">{translateTitle(challenge.title)}</h4>
                        <p className="text-xs text-text-secondary mt-0.5">
                          {translateDescription(challenge.description)}
                        </p>
                      </div>
                    <img src={emojiDone} alt={copy.doneAlt} className="w-4 h-4 object-contain" />
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
              <p className="text-center text-text-secondary text-sm">{copy.noMissions}</p>
            )}
          </>
        )}
      </div>
    </div>
  );
}
