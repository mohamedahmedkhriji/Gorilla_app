import React, { useEffect, useMemo, useState } from 'react';
import { createPortal } from 'react-dom';
import { ArrowLeft, ChevronRight, Crown, Info, Medal, Swords, UserRound } from 'lucide-react';
import { api } from '../../services/api';
import { offlineCacheKeys, readOfflineCacheValue } from '../../services/offlineCache';
import { pickLanguage } from '../../services/language';
import { useAppLanguage } from '../../hooks/useAppLanguage';
import type { GamificationLeaderboardEntry, GamificationRivalry } from '../../types/gamification';

interface LeaderboardScreenProps {
  onBack: () => void;
}

type Period = 'monthly' | 'alltime';
type LeaderboardUser = GamificationLeaderboardEntry;
type LeaderboardPayload = {
  leaderboard?: unknown[];
  preview?: unknown[];
  rivalry?: GamificationRivalry | null;
  currentUser?: unknown;
} | null;

const getLevelFromPoints = (points: number) => {
  if (points >= 2200) return 6;
  if (points >= 1400) return 5;
  if (points >= 800) return 4;
  if (points >= 400) return 3;
  if (points >= 150) return 2;
  return 1;
};

const isSafeProfileImage = (value: string | null | undefined) => {
  if (typeof value !== 'string') return false;
  const src = value.trim();
  return src.startsWith('data:image/')
    || src.startsWith('/')
    || src.startsWith('https://')
    || src.startsWith('http://');
};

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
      profilePicture: isSafeProfileImage(row?.profilePicture || row?.profile_picture)
        ? (row?.profilePicture || row?.profile_picture)
        : null,
      rankName: row?.rankName || null,
      deltaToNext: row?.deltaToNext == null ? null : Number(row.deltaToNext),
      isCurrentUser: !!row?.isCurrentUser,
    };
  });
};

const mapCurrentUserPreview = (result: LeaderboardPayload) =>
  result?.currentUser ? mapLeaderboardRows({ preview: [result.currentUser] })[0] || null : null;

const readCachedLeaderboardBundle = (userId: number, period: Period): LeaderboardPayload => {
  if (!userId) return null;
  return readOfflineCacheValue<LeaderboardPayload>(offlineCacheKeys.leaderboard(userId, period));
};

const clampPercent = (value: number) => Math.min(100, Math.max(0, Math.round(Number(value) || 0)));

function LeaderboardAvatar({ user, isCurrentUser }: { user: LeaderboardUser; isCurrentUser?: boolean }) {
  return (
    <div
      className={`flex h-12 w-12 shrink-0 items-center justify-center overflow-hidden rounded-full bg-white/[0.06] ${
        user.rank === 1 ? 'ring-1 ring-yellow-400/60' : isCurrentUser ? 'ring-1 ring-accent/60' : 'ring-1 ring-white/10'
      }`}
    >
      {user.profilePicture ? (
        <img src={user.profilePicture} alt={`${user.name}'s avatar`} className="h-full w-full object-cover" />
      ) : (
        <UserRound size={23} className="text-text-tertiary" aria-hidden="true" />
      )}
    </div>
  );
}

function RankMarker({ user, isCurrentUser }: { user: LeaderboardUser; isCurrentUser?: boolean }) {
  if (user.rank === 1) {
    return (
      <div className="flex w-10 shrink-0 flex-col items-center text-yellow-300">
        <Crown size={21} aria-hidden="true" />
        <span className="mt-1 text-sm font-bold">#1</span>
      </div>
    );
  }

  return (
    <div
      className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-full border text-sm font-bold ${
        isCurrentUser ? 'border-accent/70 text-accent' : 'border-white/15 text-text-secondary'
      }`}
    >
      #{user.rank || '-'}
    </div>
  );
}

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
      you: 'You',
      noRankingTitle: 'No ranking yet',
      noRankingBody: 'Earn points to appear on the leaderboard.',
      topMembers: 'Top members',
      monthlyRanking: 'Monthly ranking',
      allTimeRanking: 'All-time ranking',
      leading: 'You are leading this ranking',
      takeFirst: (points: number) => `${points} points to take #1`,
      chasingLeader: (name: string) => `Chasing ${name}`,
      updateHint: 'Rankings update when points are earned.',
      infoTitle: 'How the leaderboard works',
      infoLine1: 'Leaderboard position is based on points earned from workouts, missions, challenges, recovery, and community actions.',
      infoLine2: 'Monthly ranking resets by period. All Time keeps your lifetime points.',
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
      you: 'أنت',
      noRankingTitle: 'لا يوجد ترتيب بعد',
      noRankingBody: 'اكسب النقاط لتظهر في لوحة الصدارة.',
      topMembers: 'أفضل الأعضاء',
      monthlyRanking: 'ترتيب الشهر',
      allTimeRanking: 'ترتيب كل الوقت',
      leading: 'أنت تتصدر هذا الترتيب',
      takeFirst: (points: number) => `${points} نقطة للوصول إلى المركز الأول`,
      chasingLeader: (name: string) => `تلاحق ${name}`,
      updateHint: 'يتم تحديث الترتيب عند اكتساب النقاط.',
      infoTitle: 'كيف تعمل لوحة الصدارة',
      infoLine1: 'يعتمد ترتيب لوحة الصدارة على النقاط المكتسبة من التمارين والمهام والتحديات والتعافي والمجتمع.',
      infoLine2: 'الترتيب الشهري يتجدد حسب الفترة. كل الوقت يحتفظ بنقاطك الكاملة.',
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
      you: 'Tu',
      noRankingTitle: 'Nessuna classifica',
      noRankingBody: 'Guadagna punti per apparire in classifica.',
      topMembers: 'Migliori membri',
      monthlyRanking: 'Classifica mensile',
      allTimeRanking: 'Classifica totale',
      leading: 'Stai guidando questa classifica',
      takeFirst: (points: number) => `${points} punti per arrivare #1`,
      chasingLeader: (name: string) => `Inseguendo ${name}`,
      updateHint: 'La classifica si aggiorna quando guadagni punti.',
      infoTitle: 'Come funziona la classifica',
      infoLine1: 'La posizione dipende dai punti ottenuti con allenamenti, missioni, sfide, recupero e community.',
      infoLine2: 'La classifica mensile segue il periodo. Lo storico conserva i punti totali.',
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
      you: 'Toi',
      noRankingTitle: 'Aucun classement',
      noRankingBody: 'Gagne des points pour apparaitre dans le classement.',
      topMembers: 'Top membres',
      monthlyRanking: 'Classement mensuel',
      allTimeRanking: 'Classement global',
      leading: 'Tu menes ce classement',
      takeFirst: (points: number) => `${points} points pour prendre la 1re place`,
      chasingLeader: (name: string) => `Poursuite de ${name}`,
      updateHint: 'Le classement se met a jour quand des points sont gagnes.',
      infoTitle: 'Comment fonctionne le classement',
      infoLine1: 'La position depend des points gagnes avec les entrainements, missions, defis, recuperation et communaute.',
      infoLine2: 'Le classement mensuel suit la periode. Le global garde tous tes points.',
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
      you: 'Du',
      noRankingTitle: 'Noch kein Ranking',
      noRankingBody: 'Sammle Punkte, um in der Bestenliste zu erscheinen.',
      topMembers: 'Top-Mitglieder',
      monthlyRanking: 'Monatsranking',
      allTimeRanking: 'Gesamtranking',
      leading: 'Du fuehrst dieses Ranking an',
      takeFirst: (points: number) => `${points} Punkte bis Platz #1`,
      chasingLeader: (name: string) => `Jagd auf ${name}`,
      updateHint: 'Rankings aktualisieren sich, wenn Punkte verdient werden.',
      infoTitle: 'So funktioniert die Bestenliste',
      infoLine1: 'Die Position basiert auf Punkten aus Workouts, Missionen, Challenges, Recovery und Community-Aktionen.',
      infoLine2: 'Das Monatsranking folgt dem Zeitraum. Gesamt behaelt deine Lifetime-Punkte.',
    },
  });
  const currentUser = JSON.parse(localStorage.getItem('appUser') || localStorage.getItem('user') || '{}');
  const currentUserId = Number(currentUser?.id || 0);
  const initialTab: Period = 'monthly';
  const initialCachedLeaderboard = readCachedLeaderboardBundle(currentUserId, initialTab);

  const [tab, setTab] = useState<Period>(initialTab);
  const [leaderboard, setLeaderboard] = useState<LeaderboardUser[]>(() => mapLeaderboardRows(initialCachedLeaderboard));
  const [rivalry, setRivalry] = useState<GamificationRivalry | null>(() => initialCachedLeaderboard?.rivalry || null);
  const [currentUserPreview, setCurrentUserPreview] = useState<LeaderboardUser | null>(() => mapCurrentUserPreview(initialCachedLeaderboard));
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showInfo, setShowInfo] = useState(false);

  useEffect(() => {
    const cachedLeaderboard = readCachedLeaderboardBundle(currentUserId, tab);
    if (currentUserId) {
      if (cachedLeaderboard) {
        setLeaderboard(mapLeaderboardRows(cachedLeaderboard));
        setRivalry(cachedLeaderboard?.rivalry || null);
        setCurrentUserPreview(mapCurrentUserPreview(cachedLeaderboard));
      }
    }

    const fetchLeaderboard = async () => {
      if (!currentUserId) {
        setLeaderboard([]);
        setRivalry(null);
        setCurrentUserPreview(null);
        return;
      }

      setLoading(!cachedLeaderboard);
      setError(null);
      try {
        const result = await api.getLeaderboard(currentUserId, tab);
        setLeaderboard(mapLeaderboardRows(result));
        setRivalry(result?.rivalry || null);
        setCurrentUserPreview(mapCurrentUserPreview(result));
      } catch (err) {
        console.error('Failed to load leaderboard:', err);
        setError(copy.loadError);
        if (!cachedLeaderboard) {
          setLeaderboard([]);
          setRivalry(null);
          setCurrentUserPreview(null);
        }
      } finally {
        setLoading(false);
      }
    };

    void fetchLeaderboard();
  }, [copy.loadError, currentUserId, tab]);

  const sortedLeaderboard = useMemo(
    () => leaderboard.slice().sort((left, right) => Number(left.rank || 0) - Number(right.rank || 0)),
    [leaderboard],
  );
  const currentLeaderboardUser = currentUserPreview
    || sortedLeaderboard.find((user) => user.userId === currentUserId || user.isCurrentUser)
    || null;
  const leader = sortedLeaderboard[0] || null;
  const userIsLeader = !!currentLeaderboardUser && Number(currentLeaderboardUser.rank || 0) === 1;
  const pointsToFirst = currentLeaderboardUser && leader && !userIsLeader
    ? Math.max(0, Number(leader.points || 0) - Number(currentLeaderboardUser.points || 0) + 1)
    : 0;
  const comparisonPercent = currentLeaderboardUser && leader
    ? clampPercent((Number(currentLeaderboardUser.points || 0) / Math.max(1, Number(leader.points || 0) + 1)) * 100)
    : 0;
  const hasVisibleContent = leaderboard.length > 0 || !!currentUserPreview || !!rivalry;

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
            aria-label="How the leaderboard works"
            className="surface-glass flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl border border-white/10 text-text-secondary transition hover:text-white active:scale-95 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
          >
            <Info size={20} aria-hidden="true" />
          </button>
        </header>

        <div role="tablist" aria-label="Leaderboard period" className="mt-5 flex gap-1 rounded-2xl border border-white/10 bg-card p-1">
          {(['monthly', 'alltime'] as Period[]).map((period) => {
            const selected = tab === period;
            return (
              <button
                key={period}
                type="button"
                role="tab"
                aria-selected={selected}
                onClick={() => setTab(period)}
                className={`min-h-11 flex-1 rounded-xl px-4 text-sm font-bold transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent ${
                  selected ? 'bg-accent text-black shadow-[0_8px_24px_rgba(191,255,92,0.14)]' : 'text-text-secondary hover:bg-white/[0.04] hover:text-white'
                }`}
              >
                {period === 'monthly' ? copy.monthly : copy.allTime}
              </button>
            );
          })}
        </div>

        {currentLeaderboardUser && leader ? (
          <section className="mt-5 rounded-[1.75rem] border border-white/10 bg-card/80 p-5 shadow-[0_18px_44px_rgba(0,0,0,0.22)]" aria-labelledby="leaderboard-position-title">
            <div className="flex items-start justify-between gap-4">
              <div className="min-w-0">
                <p className="text-sm font-medium text-text-secondary">{copy.yourPosition}</p>
                <h2 id="leaderboard-position-title" className="mt-2 text-5xl font-bold tracking-tight text-white">
                  #{currentLeaderboardUser.rank || '-'}
                </h2>
                <div className="mt-2 flex flex-wrap items-center gap-2">
                  <span className="text-lg font-semibold text-white">{currentLeaderboardUser.points} {copy.pts}</span>
                  <span className="rounded-full border border-white/10 bg-white/[0.05] px-3 py-1 text-xs text-text-secondary">
                    {copy.level} {currentLeaderboardUser.level}
                  </span>
                </div>
              </div>
              <div className="rounded-full border border-accent/55 p-1">
                <LeaderboardAvatar user={currentLeaderboardUser} isCurrentUser />
              </div>
            </div>

            <div className="mt-5">
              <div className="flex items-center justify-between gap-3 text-sm">
                <span className="text-text-secondary">{userIsLeader ? copy.leading : copy.takeFirst(pointsToFirst)}</span>
                <span className="font-semibold text-white">{userIsLeader ? 100 : comparisonPercent}%</span>
              </div>
              <div
                role="progressbar"
                aria-label="Progress toward first place"
                aria-valuemin={0}
                aria-valuemax={100}
                aria-valuenow={userIsLeader ? 100 : comparisonPercent}
                className="mt-2 h-2 overflow-hidden rounded-full bg-white/10"
              >
                <div
                  className="h-full rounded-full bg-accent transition-[width] duration-500 motion-reduce:transition-none"
                  style={{ width: `${userIsLeader ? 100 : comparisonPercent}%` }}
                />
              </div>

              {!userIsLeader && leader.name && (
                <div className="mt-4 flex items-center gap-2 text-sm text-white">
                  <Swords size={17} className="text-accent" aria-hidden="true" />
                  <span>{copy.chasingLeader(leader.name)}</span>
                </div>
              )}
            </div>
          </section>
        ) : (
          <section className="mt-5 rounded-[1.75rem] border border-white/10 bg-card/80 p-5 text-center">
            <Medal className="mx-auto text-text-tertiary" aria-hidden="true" />
            <h2 className="mt-3 font-semibold text-white">{copy.noRankingTitle}</h2>
            <p className="mt-1 text-sm text-text-secondary">{copy.noRankingBody}</p>
          </section>
        )}

        {loading && !hasVisibleContent && <p className="text-sm text-text-secondary">{copy.loading}</p>}
        {!loading && error && <p className="text-sm text-red-400">{error}</p>}

        <section className="mt-7" aria-labelledby="leaderboard-members-title">
          <h2 id="leaderboard-members-title" className="text-xl font-semibold text-white">{copy.topMembers}</h2>
          <p className="mt-1 text-sm text-text-secondary">{tab === 'monthly' ? copy.monthlyRanking : copy.allTimeRanking}</p>

          <div className="mt-3 overflow-hidden rounded-[1.75rem] border border-white/10 bg-card/75">
            {!loading && !error && sortedLeaderboard.length === 0 ? (
              <div className="px-5 py-8 text-center">
                <p className="font-medium text-white">{copy.empty}</p>
                <p className="mt-1 text-sm text-text-secondary">{copy.noRankingBody}</p>
              </div>
            ) : (
              sortedLeaderboard.map((user, index) => {
                const isCurrentUser = user.isCurrentUser || user.userId === currentUserId;
                return (
                  <button
                    key={user.userId}
                    type="button"
                    className={`group flex min-h-[84px] w-full items-center gap-3 px-4 py-3 text-left transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-accent ${
                      index > 0 ? 'border-t border-white/10' : ''
                    } ${
                      isCurrentUser
                        ? 'bg-accent/[0.075]'
                        : user.rank === 1
                          ? 'bg-yellow-400/[0.035]'
                          : 'hover:bg-white/[0.035]'
                    }`}
                  >
                    <RankMarker user={user} isCurrentUser={isCurrentUser} />
                    <LeaderboardAvatar user={user} isCurrentUser={isCurrentUser} />

                    <span className="min-w-0 flex-1">
                      <span className="flex min-w-0 items-center gap-2">
                        <span className={`truncate text-base font-semibold ${isCurrentUser ? 'text-accent' : 'text-white'}`}>
                          {user.name || copy.fallbackUser}
                        </span>
                        {isCurrentUser && (
                          <span className="shrink-0 rounded-full bg-accent px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-black">
                            {copy.you}
                          </span>
                        )}
                      </span>
                      <span className="mt-0.5 block text-sm text-text-secondary">{copy.level} {user.level}</span>
                    </span>

                    <span className={`shrink-0 ${isArabic ? 'text-left' : 'text-right'}`}>
                      <span className="block text-lg font-bold text-white">{user.points}</span>
                      <span className="block text-[11px] text-text-secondary">{copy.pts}</span>
                    </span>

                    <ChevronRight
                      size={18}
                      aria-hidden="true"
                      className={`shrink-0 text-text-tertiary transition-transform ${isArabic ? 'rotate-180 group-hover:-translate-x-0.5' : 'group-hover:translate-x-0.5'}`}
                    />
                  </button>
                );
              })
            )}
          </div>
        </section>

        <p className="mt-5 text-center text-xs text-text-tertiary">{copy.updateHint}</p>
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
            aria-labelledby="leaderboard-info-title"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="flex items-center justify-between gap-3">
              <h2 id="leaderboard-info-title" className="text-lg font-bold text-white">{copy.infoTitle}</h2>
              <button
                type="button"
                onClick={() => setShowInfo(false)}
                className="flex h-10 w-10 items-center justify-center rounded-xl border border-white/10 text-text-secondary transition hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
                aria-label="Close leaderboard information"
              >
                <Info size={18} aria-hidden="true" />
              </button>
            </div>
            <div className="mt-4 space-y-3 text-sm leading-relaxed text-text-secondary">
              <p>{copy.infoLine1}</p>
              <p>{copy.infoLine2}</p>
              {rivalry?.nextPlayerName && (
                <p>{Math.max(0, Number(rivalry.deltaToNextPlayer || 0))} {copy.deltaLabel}: {copy.chasingLeader(rivalry.nextPlayerName)}</p>
              )}
            </div>
          </div>
        </div>,
        document.body,
      )}
    </main>
  );
}
