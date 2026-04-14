import React, { useEffect, useMemo, useState } from 'react';
import { Header } from '../ui/Header';
import { Award, Crown, Medal, Swords, Trophy, UserRound } from 'lucide-react';
import { api } from '../../services/api';
import { offlineCacheKeys, readOfflineCacheValue } from '../../services/offlineCache';
import { rankTopScoreIcon } from '../../services/rankTheme';
import { pickLanguage } from '../../services/language';
import { useAppLanguage } from '../../hooks/useAppLanguage';
import type { GamificationLeaderboardEntry, GamificationRivalry } from '../../types/gamification';

interface LeaderboardScreenProps {
  onBack: () => void;
}

type Period = 'weekly' | 'monthly' | 'alltime';
type LeaderboardUser = GamificationLeaderboardEntry;

const getLevelFromPoints = (points: number) => {
  if (points >= 2200) return 6;
  if (points >= 1400) return 5;
  if (points >= 800) return 4;
  if (points >= 400) return 3;
  if (points >= 150) return 2;
  return 1;
};

const isValidImageDataUrl = (value: string | null | undefined) =>
  typeof value === 'string' && value.startsWith('data:image/') && value.includes(';base64,');

const mapLeaderboardRows = (result: any): LeaderboardUser[] => {
  const rows = Array.isArray(result?.preview)
    ? result.preview
    : Array.isArray(result?.leaderboard)
      ? result.leaderboard
      : [];

  return rows.map((row: any) => {
    const points = Number(row?.points || 0);
    return {
      userId: Number(row?.userId ?? row?.id ?? 0),
      name: String(row?.displayName || row?.name || 'User'),
      points,
      rank: Number(row?.rankPosition ?? row?.rank ?? 0),
      level: Number(row?.levelNumber ?? row?.level ?? getLevelFromPoints(points)),
      profilePicture: isValidImageDataUrl(row?.profilePicture || row?.profile_picture)
        ? (row?.profilePicture || row?.profile_picture)
        : null,
      rankName: row?.rankName || null,
      deltaToNext: row?.deltaToNext == null ? null : Number(row.deltaToNext),
      isCurrentUser: !!row?.isCurrentUser,
    };
  });
};

export function LeaderboardScreen({ onBack }: LeaderboardScreenProps) {
  const { language, isArabic } = useAppLanguage();
  const copy = pickLanguage(language, {
    en: {
      title: 'Leaderboard',
      weekly: 'Weekly',
      monthly: 'Monthly',
      allTime: 'All Time',
      loading: 'Loading leaderboard...',
      loadError: 'Failed to load leaderboard',
      empty: 'No leaderboard data found.',
      level: 'Level',
      pts: 'pts',
      profileAlt: 'Profile',
      topScoreAlt: 'Top score',
      fallbackUser: 'User',
      chasing: 'Chasing',
      yourPosition: 'Your spot',
      closeRace: 'Close race',
      podiumLabel: 'Top performers',
      deltaLabel: 'pts to next',
    },
    ar: {
      title: 'لوحة الصدارة',
      weekly: 'أسبوعي',
      monthly: 'شهري',
      allTime: 'كل الوقت',
      loading: 'جارٍ تحميل لوحة الصدارة...',
      loadError: 'تعذر تحميل لوحة الصدارة',
      empty: 'لا توجد بيانات للوحة الصدارة.',
      level: 'المستوى',
      pts: 'نقطة',
      profileAlt: 'الملف الشخصي',
      topScoreAlt: 'أعلى نتيجة',
      fallbackUser: 'مستخدم',
      chasing: 'ملاحقة',
      yourPosition: 'مركزك',
      closeRace: 'منافسة قريبة',
      podiumLabel: 'أفضل الأداء',
      deltaLabel: 'نقطة للتقدم',
    },
    it: {
      title: 'Classifica',
      weekly: 'Settimanale',
      monthly: 'Mensile',
      allTime: 'Storico',
      loading: 'Caricamento classifica...',
      loadError: 'Impossibile caricare la classifica',
      empty: 'Nessun dato classifica trovato.',
      level: 'Livello',
      pts: 'pt',
      profileAlt: 'Profilo',
      topScoreAlt: 'Punteggio massimo',
      fallbackUser: 'Utente',
      chasing: 'Inseguendo',
      yourPosition: 'La tua posizione',
      closeRace: 'Sfida ravvicinata',
      podiumLabel: 'Migliori',
      deltaLabel: 'pt al prossimo',
    },
    fr: {
      title: 'Classement',
      weekly: 'Hebdo',
      monthly: 'Mensuel',
      allTime: 'Global',
      loading: 'Chargement du classement...',
      loadError: 'Impossible de charger le classement',
      empty: 'Aucune donnee de classement trouvee.',
      level: 'Niveau',
      pts: 'pts',
      profileAlt: 'Profil',
      topScoreAlt: 'Meilleur score',
      fallbackUser: 'Utilisateur',
      chasing: 'Poursuite',
      yourPosition: 'Ta place',
      closeRace: 'Course serree',
      podiumLabel: 'Top performance',
      deltaLabel: 'pts vers le suivant',
    },
    de: {
      title: 'Bestenliste',
      weekly: 'Woche',
      monthly: 'Monatlich',
      allTime: 'Gesamt',
      loading: 'Bestenliste wird geladen...',
      loadError: 'Bestenliste konnte nicht geladen werden',
      empty: 'Keine Bestenlisten-Daten gefunden.',
      level: 'Level',
      pts: 'Pkt',
      profileAlt: 'Profil',
      topScoreAlt: 'Top-Wert',
      fallbackUser: 'Nutzer',
      chasing: 'Jagd',
      yourPosition: 'Dein Platz',
      closeRace: 'Enges Rennen',
      podiumLabel: 'Top-Athleten',
      deltaLabel: 'Pkt zum Naechsten',
    },
  });
  const [tab, setTab] = useState<Period>('weekly');
  const [leaderboard, setLeaderboard] = useState<LeaderboardUser[]>([]);
  const [rivalry, setRivalry] = useState<GamificationRivalry | null>(null);
  const [currentUserPreview, setCurrentUserPreview] = useState<LeaderboardUser | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const currentUser = JSON.parse(localStorage.getItem('appUser') || localStorage.getItem('user') || '{}');
  const currentUserId = Number(currentUser?.id || 0);

  useEffect(() => {
    if (currentUserId) {
      const cachedLeaderboard = readOfflineCacheValue<any>(
        offlineCacheKeys.leaderboard(currentUserId, tab),
      );
      if (cachedLeaderboard) {
        setLeaderboard(mapLeaderboardRows(cachedLeaderboard));
        setRivalry(cachedLeaderboard?.rivalry || null);
        setCurrentUserPreview(cachedLeaderboard?.currentUser ? mapLeaderboardRows({ preview: [cachedLeaderboard.currentUser] })[0] || null : null);
      }
    }

    const fetchLeaderboard = async () => {
      if (!currentUserId) {
        setLeaderboard([]);
        setRivalry(null);
        setCurrentUserPreview(null);
        return;
      }

      setLoading(true);
      setError(null);
      try {
        const result = await api.getLeaderboard(currentUserId, tab);
        setLeaderboard(mapLeaderboardRows(result));
        setRivalry(result?.rivalry || null);
        setCurrentUserPreview(result?.currentUser ? mapLeaderboardRows({ preview: [result.currentUser] })[0] || null : null);
      } catch (err) {
        console.error('Failed to load leaderboard:', err);
        setError(copy.loadError);
        setLeaderboard([]);
        setRivalry(null);
        setCurrentUserPreview(null);
      } finally {
        setLoading(false);
      }
    };

    void fetchLeaderboard();
  }, [copy.loadError, currentUserId, tab]);

  const maxPoints = useMemo(
    () => (leaderboard.length ? Math.max(...leaderboard.map((u) => u.points)) : 0),
    [leaderboard],
  );

  const getBarWidth = (points: number) => (maxPoints > 0 ? (points / maxPoints) * 100 : 0);

  const getBarColor = (rank: number) => {
    if (rank === 1) return 'from-red-500 to-orange-500';
    if (rank === 2) return 'from-orange-500 to-yellow-500';
    if (rank === 3) return 'from-yellow-500 to-yellow-400';
    return 'from-white/40 to-white/10';
  };

  const podium = leaderboard.slice(0, 3);

  return (
    <div dir={isArabic ? 'rtl' : 'ltr'} className="flex-1 flex flex-col min-h-screen bg-background pb-24">
      <div className="px-4 sm:px-6 pt-2">
        <Header title={copy.title} onBack={onBack} />
      </div>

      <div className="space-y-5 px-4 pt-4 sm:px-6">
        <div className="flex gap-2 rounded-xl border border-white/5 bg-card p-1">
          {(['weekly', 'monthly', 'alltime'] as Period[]).map((period) => (
            <button
              key={period}
              onClick={() => setTab(period)}
              className={`flex-1 rounded-lg py-2 text-sm font-bold transition-colors ${
                tab === period ? 'bg-accent text-black' : 'text-text-secondary'
              }`}
            >
              {period === 'weekly' ? copy.weekly : period === 'monthly' ? copy.monthly : copy.allTime}
            </button>
          ))}
        </div>

        {(rivalry?.nextPlayerName || currentUserPreview) && (
          <div className="relative overflow-hidden rounded-[1.7rem] border border-white/10 bg-card/75 p-4 shadow-[0_18px_38px_rgba(0,0,0,0.24)]">
            <div className="relative z-10 grid gap-3 sm:grid-cols-2">
              <div>
                <div className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/[0.04] px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.16em] text-text-tertiary">
                  <Swords size={12} className="text-accent" />
                  <span>{copy.closeRace}</span>
                </div>
                <h3 className="mt-3 text-base font-semibold text-white">
                  {rivalry?.nextPlayerName
                    ? `${copy.chasing} ${rivalry.nextPlayerName}`
                    : copy.podiumLabel}
                </h3>
                <p className="mt-1 text-sm text-text-secondary">
                  {rivalry?.nextPlayerName
                    ? `${Math.max(0, Number(rivalry.deltaToNextPlayer || 0))} ${copy.deltaLabel}`
                    : copy.loading}
                </p>
              </div>
              {currentUserPreview && (
                <div className="rounded-2xl border border-white/10 bg-white/[0.04] px-4 py-3">
                  <div className="text-[10px] uppercase tracking-[0.14em] text-text-tertiary">{copy.yourPosition}</div>
                  <div className="mt-2 flex items-end justify-between gap-3">
                    <div>
                      <div className="text-xl font-electrolize text-white">#{currentUserPreview.rank || '-'}</div>
                      <div className="mt-1 text-xs text-text-secondary">{currentUserPreview.points} {copy.pts}</div>
                    </div>
                    <div className={`${isArabic ? 'text-left' : 'text-right'} text-xs text-text-secondary`}>
                      <div>{copy.level} {currentUserPreview.level}</div>
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>
        )}

        {podium.length > 0 && (
          <div className="grid grid-cols-3 gap-3">
            {podium.map((user, index) => (
              <div
                key={`podium-${user.userId}`}
                className={`rounded-[1.4rem] border p-3 text-center ${
                  index === 0
                    ? 'border-yellow-400/30 bg-yellow-500/10'
                    : index === 1
                      ? 'border-white/15 bg-white/[0.05]'
                      : 'border-orange-400/25 bg-orange-500/10'
                }`}
              >
                <div className="flex justify-center">
                  {index === 0 ? <Crown className="text-yellow-300" size={20} /> : index === 1 ? <Medal className="text-white/80" size={20} /> : <Award className="text-orange-300" size={20} />}
                </div>
                <div className="mt-2 text-sm font-semibold text-white">{user.name}</div>
                <div className="mt-1 text-xs text-text-secondary">{user.points} {copy.pts}</div>
              </div>
            ))}
          </div>
        )}

        {loading && <p className="text-sm text-text-secondary">{copy.loading}</p>}
        {!loading && error && <p className="text-sm text-red-400">{error}</p>}
        {!loading && !error && leaderboard.length === 0 && (
          <p className="text-sm text-text-secondary">{copy.empty}</p>
        )}

        {!loading && !error && leaderboard.length > 0 && (
          <div className="space-y-3">
            {leaderboard.map((user) => (
              <div
                key={user.userId}
                className={`rounded-[1.5rem] border p-4 ${
                  user.isCurrentUser || user.userId === currentUserId
                    ? 'border-accent/45 bg-accent/10 shadow-[0_16px_34px_rgba(191,255,0,0.08)]'
                    : 'border-white/8 bg-card/75'
                }`}
              >
                <div className="mb-3 flex items-center gap-3">
                  <div className="w-8 shrink-0 text-center">
                    {user.rank === 1 && <Trophy className="mx-auto text-yellow-500" size={18} />}
                    {user.rank === 2 && <Medal className="mx-auto text-gray-300" size={18} />}
                    {user.rank === 3 && <Award className="mx-auto text-orange-500" size={18} />}
                    {user.rank > 3 && <span className="text-sm font-semibold text-text-secondary">#{user.rank}</span>}
                  </div>

                  <div
                    className={`relative flex h-10 w-10 shrink-0 items-center justify-center overflow-hidden rounded-full ${
                      user.rank === 1
                        ? 'bg-gradient-to-br from-yellow-400/25 via-orange-500/20 to-red-500/20 ring-2 ring-yellow-400/60'
                        : 'bg-white/10'
                    }`}
                  >
                    {user.profilePicture ? (
                      <img src={user.profilePicture} alt={copy.profileAlt} className="h-full w-full object-cover" />
                    ) : (
                      <UserRound size={20} className="text-text-tertiary" />
                    )}

                    {user.rank === 1 && (
                      <img
                        src={rankTopScoreIcon}
                        alt={copy.topScoreAlt}
                        className="absolute -right-1 -top-1 h-5 w-5 object-contain"
                      />
                    )}
                  </div>

                  <div className="min-w-0 flex-1">
                    <div className={`truncate text-sm font-semibold ${user.isCurrentUser || user.userId === currentUserId ? 'text-accent' : 'text-white'}`}>
                      {user.name || copy.fallbackUser}
                    </div>
                    <div className="mt-1 text-xs text-text-secondary">
                      {copy.level} {user.level}
                    </div>
                  </div>

                  <div className={isArabic ? 'text-left' : 'text-right'}>
                    <div className="text-lg font-bold text-white">{user.points}</div>
                    <div className="text-[11px] text-text-secondary">{copy.pts}</div>
                  </div>
                </div>

                <div className="h-2 overflow-hidden rounded-full bg-white/5">
                  <div
                    className={`h-full rounded-full bg-gradient-to-r ${getBarColor(user.rank)} transition-all duration-500`}
                    style={{ width: `${getBarWidth(user.points)}%` }}
                  />
                </div>

                {(user.deltaToNext != null || (rivalry?.nextPlayerName && (user.isCurrentUser || user.userId === currentUserId))) && (
                  <div className="mt-2 text-[11px] text-text-secondary">
                    {user.deltaToNext != null
                      ? `${user.deltaToNext} ${copy.deltaLabel}`
                      : `${Math.max(0, Number(rivalry?.deltaToNextPlayer || 0))} ${copy.deltaLabel}`}
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
