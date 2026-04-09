import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ArrowLeft,
  ChevronRight,
  LoaderCircle,
  Minus,
  Plus,
  Trophy,
} from 'lucide-react';
import challengeHeroImage from '../../../assets/Workout/CHALLENGE.png';
import { api } from '../../services/api';
import {
  compareFriendChallengeValues,
  FriendChallengeDefinition,
  getFriendChallengeByCardId,
  getFriendChallengeByKey,
  isStrengthFriendChallenge,
  toFriendChallengeCardId,
  toFriendChallengeKey,
} from '../../services/friendChallenges';
import {
  getStoredAppUser,
  getStoredUserId,
  persistStoredUser,
} from '../../shared/authStorage';
import {
  AppLanguage,
  getActiveLanguage,
  getStoredLanguage,
  pickLanguage,
} from '../../services/language';
import { useScrollToTopOnChange } from '../../shared/scroll';

interface FriendChallengeScreenProps {
  onBack: () => void;
  onExitHome?: () => void;
  friendName?: string | null;
  friendId?: number | string | null;
  initialView?: ChallengeView;
  directChallengeId?: string | null;
  currentUserPlayer?: PlayerKey;
  challengeSessionId?: number | string | null;
}

type ChallengeView = 'intro' | 'cards' | 'numeric-duel' | 'weight-duel';
type PlayerKey = 'player1' | 'player2';
type RoundStatus = PlayerKey | 'complete';
type RoundWinner = PlayerKey | 'tie';
type StrengthAttemptResult = 'pending' | 'made' | 'missed';
type ChallengeMode = 'numeric' | 'weight';
type MatchSubmissionState = 'idle' | 'submitting' | 'completed' | 'error';
type InviteState = 'idle' | 'sending' | 'sent' | 'error';
type ChallengeAccessStatus = 'idle' | 'pending' | 'accepted' | 'declined' | 'cancelled';
type SessionSyncState = 'idle' | 'loading' | 'saving' | 'error';
type ChallengeResultModalState = {
  didWin: boolean;
  challengeTitle: string;
  pointsAwarded: number;
};

type PushUpRound = {
  number: number;
  player1: number;
  player2: number;
  status: RoundStatus;
};

type StrengthRound = {
  number: number;
  weightKg: number;
  player1Result: StrengthAttemptResult;
  player2Result: StrengthAttemptResult;
  status: RoundStatus;
};

type FriendChallengeSession = {
  id: number;
  challengeKey: string;
  challengeMode: ChallengeMode;
  senderUserId: number;
  receiverUserId: number;
  status: 'pending' | 'active' | 'completed' | 'declined' | 'abandoned';
  currentPlayer: RoundStatus;
  clientMatchId: string;
  winnerUserId: number | null;
  abandonedByUserId?: number | null;
  abandonedByUserName?: string;
  abandonedAt?: string | null;
  rounds: Array<PushUpRound | StrengthRound>;
  totals?: Record<string, unknown>;
};

const CHALLENGE_ROUND_WIN_POINTS = 10;
const CHALLENGE_ROUND_TIE_POINTS = 5;

const PROFILE_CHALLENGE_CARD_KEYS = [
  'push_until_failure',
  'plank_survivor',
  'rep_madness',
  'volume_destroyer',
] as const;

const CHALLENGE_CARDS = PROFILE_CHALLENGE_CARD_KEYS
  .map((key) => getFriendChallengeByKey(key))
  .filter((card): card is FriendChallengeDefinition => Boolean(card));

const createPushUpRound = (number: number): PushUpRound => ({
  number,
  player1: 0,
  player2: 0,
  status: 'player1',
});

const createStrengthRound = (number: number): StrengthRound => ({
  number,
  weightKg: 0,
  player1Result: 'pending',
  player2Result: 'pending',
  status: 'player1',
});

const createClientMatchId = (challengeKey = 'push_up_duel') =>
  `${challengeKey}-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;

const toPositiveInteger = (value: unknown) => {
  const parsed = Number(value);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : null;
};

const getRoundWinner = (round: PushUpRound, challengeKey: string): RoundWinner => {
  const comparison = compareFriendChallengeValues(round.player1, round.player2, challengeKey);
  if (comparison === 0) return 'tie';
  return comparison > 0 ? 'player1' : 'player2';
};

const normalizeStrengthAttemptResult = (value: unknown): StrengthAttemptResult => {
  const normalized = String(value || '').trim().toLowerCase();
  if (normalized === 'made') return 'made';
  if (normalized === 'missed') return 'missed';
  return 'pending';
};

const normalizeStrengthRounds = (rawValue: unknown): StrengthRound[] => {
  if (!Array.isArray(rawValue) || !rawValue.length) return [createStrengthRound(1)];

  const normalizedRounds = rawValue.map((round, index) => {
    const roundObject = round && typeof round === 'object' ? round as Record<string, unknown> : {};
    const parsedNumber = Number(roundObject.number);
    return {
      number: Number.isInteger(parsedNumber) && parsedNumber > 0 ? parsedNumber : index + 1,
      weightKg: Math.max(0, Number.parseFloat(String(roundObject.weightKg ?? 0)) || 0),
      player1Result: normalizeStrengthAttemptResult(roundObject.player1Result),
      player2Result: normalizeStrengthAttemptResult(roundObject.player2Result),
      status: normalizeRoundStatus(roundObject.status),
    };
  });

  normalizedRounds.sort((left, right) => left.number - right.number);
  return normalizedRounds;
};

const getStrengthRoundWinner = (round: StrengthRound): RoundWinner => {
  if (round.status !== 'complete') return 'tie';
  if (round.player1Result === 'made' && round.player2Result === 'missed') return 'player1';
  if (round.player2Result === 'made' && round.player1Result === 'missed') return 'player2';
  return 'tie';
};

const getChallengePointsByRole = (
  challengeKey: string,
  rounds: Array<PushUpRound | StrengthRound>,
) => {
  if (isStrengthFriendChallenge(challengeKey)) {
    const strengthRounds = rounds as StrengthRound[];
    const decidingRound = [...strengthRounds]
      .reverse()
      .find((round) => round.status === 'complete' && getStrengthRoundWinner(round) !== 'tie');

    if (!decidingRound) {
      return { player1: 0, player2: 0 };
    }

    const winner = getStrengthRoundWinner(decidingRound);
    const winnerPoints = decidingRound.weightKg > 100 ? 50 : 20;
    const loserPoints = decidingRound.weightKg > 100 ? 20 : 10;
    return winner === 'player1'
      ? { player1: winnerPoints, player2: loserPoints }
      : { player1: loserPoints, player2: winnerPoints };
  }

  return (rounds as PushUpRound[]).reduce(
    (totals, round) => {
      if (round.status !== 'complete') return totals;

      const winner = getRoundWinner(round, challengeKey);
      if (winner === 'player1') {
        totals.player1 += CHALLENGE_ROUND_WIN_POINTS;
        return totals;
      }
      if (winner === 'player2') {
        totals.player2 += CHALLENGE_ROUND_WIN_POINTS;
        return totals;
      }

      totals.player1 += CHALLENGE_ROUND_TIE_POINTS;
      totals.player2 += CHALLENGE_ROUND_TIE_POINTS;
      return totals;
    },
    { player1: 0, player2: 0 },
  );
};

const normalizeRoundStatus = (value: unknown): RoundStatus => {
  const normalized = String(value || '').trim().toLowerCase();
  if (normalized === 'player2') return 'player2';
  if (normalized === 'complete') return 'complete';
  return 'player1';
};

const normalizePushUpRounds = (rawValue: unknown): PushUpRound[] => {
  if (!Array.isArray(rawValue) || !rawValue.length) return [createPushUpRound(1)];

  const normalizedRounds = rawValue.map((round, index) => {
    const roundObject = round && typeof round === 'object' ? round as Record<string, unknown> : {};
    const parsedNumber = Number(roundObject.number);
    return {
      number: Number.isInteger(parsedNumber) && parsedNumber > 0 ? parsedNumber : index + 1,
      player1: Math.max(0, Number.parseInt(String(roundObject.player1 ?? 0), 10) || 0),
      player2: Math.max(0, Number.parseInt(String(roundObject.player2 ?? 0), 10) || 0),
      status: normalizeRoundStatus(roundObject.status),
    };
  });

  normalizedRounds.sort((left, right) => left.number - right.number);
  return normalizedRounds;
};

const normalizeFriendChallengeSession = (rawValue: unknown): FriendChallengeSession | null => {
  if (!rawValue || typeof rawValue !== 'object') return null;
  const sessionObject = rawValue as Record<string, unknown>;
  const parsedId = toPositiveInteger(sessionObject.id);
  if (!parsedId) return null;

  const challengeKey = String(sessionObject.challengeKey || '').trim().toLowerCase();
  const challengeMode: ChallengeMode = sessionObject.challengeMode === 'weight' || isStrengthFriendChallenge(challengeKey)
    ? 'weight'
    : 'numeric';
  const rounds = challengeMode === 'weight'
    ? normalizeStrengthRounds(sessionObject.rounds)
    : normalizePushUpRounds(sessionObject.rounds);
  const currentPlayerValue = String(sessionObject.currentPlayer || '').trim().toLowerCase();

  return {
    id: parsedId,
    challengeKey,
    challengeMode,
    senderUserId: toPositiveInteger(sessionObject.senderUserId) || 0,
    receiverUserId: toPositiveInteger(sessionObject.receiverUserId) || 0,
    status: (String(sessionObject.status || 'active').trim().toLowerCase() as FriendChallengeSession['status']) || 'active',
    currentPlayer: currentPlayerValue === 'player2'
      ? 'player2'
      : currentPlayerValue === 'complete'
        ? 'complete'
        : 'player1',
    clientMatchId: String(sessionObject.clientMatchId || '').trim(),
    winnerUserId: toPositiveInteger(sessionObject.winnerUserId),
    abandonedByUserId: toPositiveInteger(sessionObject.abandonedByUserId),
    abandonedByUserName: String(sessionObject.abandonedByUserName || '').trim(),
    abandonedAt: typeof sessionObject.abandonedAt === 'string' ? sessionObject.abandonedAt : null,
    rounds,
    totals: sessionObject.totals && typeof sessionObject.totals === 'object'
      ? sessionObject.totals as Record<string, unknown>
      : undefined,
  };
};

const getStoredDisplayName = (user: Record<string, unknown> | null) => {
  const options = [
    user?.name,
    user?.full_name,
    user?.fullName,
    user?.display_name,
    user?.displayName,
    user?.username,
    user?.first_name,
    user?.firstName,
  ];

  for (const value of options) {
    const normalized = String(value || '').trim();
    if (normalized) return normalized;
  }

  return 'You';
};

const parseNotificationData = (rawValue: unknown): Record<string, unknown> => {
  if (!rawValue) return {};
  if (typeof rawValue === 'object') return rawValue as Record<string, unknown>;
  if (typeof rawValue !== 'string') return {};
  try {
    const parsed = JSON.parse(rawValue);
    return parsed && typeof parsed === 'object' ? parsed as Record<string, unknown> : {};
  } catch {
    return {};
  }
};

const resolveNotificationType = (notification: { type?: unknown; title?: unknown }, data: Record<string, unknown>) => {
  const normalizedType = String(notification?.type || '').trim().toLowerCase();
  if (normalizedType) return normalizedType;

  const title = String(notification?.title || '').trim();
  if (
    title === 'Challenge Accepted'
    || title === 'Challenge Declined'
    || title === 'Challenge Cancelled'
  ) {
    if (Number(data.receiverNotificationId || 0) > 0 && String(data.challengeKey || '').trim()) {
      return 'friend_challenge_response';
    }
  }

  return normalizedType;
};

export function FriendChallengeScreen({
  onBack,
  onExitHome,
  friendName,
  friendId,
  initialView = 'intro',
  directChallengeId = null,
  currentUserPlayer = 'player1',
  challengeSessionId = null,
}: FriendChallengeScreenProps) {
  const [language, setLanguage] = useState<AppLanguage>(() => getActiveLanguage());
  const [view, setView] = useState<ChallengeView>(initialView);
  const [introTargetChallengeId, setIntroTargetChallengeId] = useState<string | null>(directChallengeId);
  const [pushUpRounds, setPushUpRounds] = useState<PushUpRound[]>(() => [createPushUpRound(1)]);
  const [strengthRounds, setStrengthRounds] = useState<StrengthRound[]>(() => [createStrengthRound(1)]);
  const [submissionState, setSubmissionState] = useState<MatchSubmissionState>('idle');
  const [submissionMessage, setSubmissionMessage] = useState('');
  const [inviteState, setInviteState] = useState<InviteState>('idle');
  const [inviteMessage, setInviteMessage] = useState('');
  const [activeInviteNotificationId, setActiveInviteNotificationId] = useState<number | null>(null);
  const [activeInviteChallengeKey, setActiveInviteChallengeKey] = useState('');
  const [challengeAccessStatus, setChallengeAccessStatus] = useState<ChallengeAccessStatus>('idle');
  const [clientMatchId, setClientMatchId] = useState(() => createClientMatchId());
  const [activeChallengeSessionId, setActiveChallengeSessionId] = useState<number | null>(() => toPositiveInteger(challengeSessionId));
  const [challengeSession, setChallengeSession] = useState<FriendChallengeSession | null>(null);
  const [sessionSyncState, setSessionSyncState] = useState<SessionSyncState>('idle');
  const [sessionMessage, setSessionMessage] = useState('');
  const [turnDraftCount, setTurnDraftCount] = useState(0);
  const [turnDraftWeightKg, setTurnDraftWeightKg] = useState(20);
  const [turnDraftOutcome, setTurnDraftOutcome] = useState<'made' | 'missed'>('made');
  const [resultModal, setResultModal] = useState<ChallengeResultModalState | null>(null);
  const [sessionNoticeModal, setSessionNoticeModal] = useState<{ title: string; body: string } | null>(null);
  const shownResultSessionsRef = useRef<Set<string>>(new Set());
  const localLeaveInFlightRef = useRef(false);
  const pushUpDraftSyncKeyRef = useRef('');
  const strengthDraftSyncKeyRef = useRef('');

  useScrollToTopOnChange([view, activeChallengeSessionId]);

  useEffect(() => {
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

  useEffect(() => {
    const parsedSessionId = toPositiveInteger(challengeSessionId);
    if (!parsedSessionId) return;
    setActiveChallengeSessionId(parsedSessionId);
  }, [challengeSessionId]);

  useEffect(() => {
    if (view !== 'intro') return undefined;

    const timer = window.setTimeout(() => {
      const challengeDefinition = getFriendChallengeByCardId(introTargetChallengeId);
      if (challengeDefinition?.sessionType === 'weight') {
        setView('weight-duel');
        return;
      }
      if (challengeDefinition) {
        setView('numeric-duel');
        return;
      }
      setView('cards');
    }, 1800);

    return () => window.clearTimeout(timer);
  }, [introTargetChallengeId, view]);

  const copy = useMemo(
    () => pickLanguage(language, {
      en: {
        back: 'Back',
        introEyebrow: 'Challenge',
        introTitle: 'Get ready',
        introBody: 'Setting up the challenge arena...',
        title: 'Choose a challenge',
        subtitle: (name: string) => `Pick how you want to compete with ${name}.`,
        badge: 'Live challenge',
        openChallenge: 'Open challenge',
        lockedChallenge: 'More battles coming next',
        imageAlt: 'Challenge',
        pushUpTitle: 'Push-Up Duel',
        pushUpSubtitle: 'Player 1 starts first. Each player counts only their own push-ups, then pass the turn.',
        currentRound: 'Current Round',
        totalReps: 'Total reps',
        roundsWon: 'Rounds won',
        yourTurn: (player: string) => `${player} turn`,
        repsCounted: 'reps counted',
        undo: 'Undo',
        addRep: '+1 rep',
        finishPlayer: (player: string) => `${player} done`,
        finishRound: 'Finish round',
        addRound: 'Add New Round',
        finishChallenge: 'Finish Challenge',
        player1: 'Player 1',
        player2: 'Player 2',
        currentUser: 'Current user',
        friend: 'Friend',
        you: 'You',
        active: 'Counting now',
        waiting: 'Waiting',
        complete: 'Done',
        roundWinner: (winner: string) => `${winner} wins this round`,
        tie: 'It is a tie',
        roundResults: 'Round Results',
        roundLabel: (round: number) => `Round ${round}`,
        finalScore: (left: number, right: number) => `Final score: ${left} - ${right}`,
        rewardBadge: `Round win +${CHALLENGE_ROUND_WIN_POINTS}. Tie round +${CHALLENGE_ROUND_TIE_POINTS} each.`,
        matchLeader: (winner: string) => `${winner} is leading the challenge`,
        needAnotherRound: 'The match is tied. Add one more round to decide the winner.',
        challengeLocked: 'Finish the current round to lock the winner.',
        saving: 'Saving result...',
        saveSuccessYou: (points: number, name: string, friendPoints: number) => `You earned +${points}. ${name} earned +${friendPoints}.`,
        saveSuccessFriend: (name: string, points: number) => `${name} earned +${points} leaderboard points.`,
        alreadySaved: () => 'This challenge was already scored.',
        saveErrorFallback: 'Could not finish the challenge right now.',
        senderControls: (name: string) => `${name} can add a new round or end the challenge.`,
      },
      ar: {
        back: 'رجوع',
        introEyebrow: 'التحدي',
        introTitle: 'استعد',
        introBody: 'نجهز لك ساحة التحدي الآن...',
        title: 'اختر التحدي',
        subtitle: (name: string) => `اختر كيف تريد التنافس مع ${name}.`,
        badge: 'تحدي مباشر',
        openChallenge: 'افتح التحدي',
        lockedChallenge: 'تحديات اخرى قريبًا',
        imageAlt: 'التحدي',
        pushUpTitle: 'تحدي الضغط',
        pushUpSubtitle: 'اللاعب 1 يبدأ اولًا. انهِ الدور ثم انتقل الى اللاعب 2.',
        currentRound: 'الجولة الحالية',
        totalReps: 'اجمالي العد',
        roundsWon: 'الجولات الفائزة',
        yourTurn: (player: string) => `دور ${player}`,
        repsCounted: 'عدة محسوبة',
        undo: 'تراجع',
        addRep: '+1 عدة',
        finishPlayer: (player: string) => `انهاء دور ${player}`,
        finishRound: 'انهاء الجولة',
        addRound: 'اضف جولة جديدة',
        player1: 'اللاعب 1',
        player2: 'اللاعب 2',
        active: 'يعد الآن',
        waiting: 'بانتظار الدور',
        complete: 'تم',
        roundWinner: (winner: string) => `${winner} فاز بهذه الجولة`,
        tie: 'تعادل',
        roundResults: 'نتائج الجولات',
        roundLabel: (round: number) => `الجولة ${round}`,
        finalScore: (left: number, right: number) => `النتيجة النهائية: ${left} - ${right}`,
      },
      it: {
        back: 'Indietro',
        introEyebrow: 'Sfida',
        introTitle: 'Preparati',
        introBody: 'Stiamo preparando l\'arena della sfida...',
        title: 'Scegli una sfida',
        subtitle: (name: string) => `Scegli come vuoi competere con ${name}.`,
        badge: 'Sfida live',
        openChallenge: 'Apri sfida',
        lockedChallenge: 'Altre sfide in arrivo',
        imageAlt: 'Sfida',
        pushUpTitle: 'Duello di Push-Up',
        pushUpSubtitle: 'Il Giocatore 1 conta per primo. Poi passa il turno al Giocatore 2.',
        currentRound: 'Round attuale',
        totalReps: 'Ripetizioni totali',
        roundsWon: 'Round vinti',
        yourTurn: (player: string) => `Turno di ${player}`,
        repsCounted: 'ripetizioni contate',
        undo: 'Annulla',
        addRep: '+1 rip',
        finishPlayer: (player: string) => `${player} ha finito`,
        finishRound: 'Chiudi round',
        addRound: 'Aggiungi nuovo round',
        player1: 'Giocatore 1',
        player2: 'Giocatore 2',
        active: 'Sta contando',
        waiting: 'In attesa',
        complete: 'Fatto',
        roundWinner: (winner: string) => `${winner} vince questo round`,
        tie: 'Pareggio',
        roundResults: 'Risultati dei round',
        roundLabel: (round: number) => `Round ${round}`,
        finalScore: (left: number, right: number) => `Punteggio finale: ${left} - ${right}`,
      },
      de: {
        back: 'Zuruck',
        introEyebrow: 'Challenge',
        introTitle: 'Mach dich bereit',
        introBody: 'Die Challenge-Arena wird vorbereitet...',
        title: 'Wahle eine Challenge',
        subtitle: (name: string) => `Wahle, wie du gegen ${name} antreten willst.`,
        badge: 'Live-Challenge',
        openChallenge: 'Challenge offnen',
        lockedChallenge: 'Mehr Duelle folgen',
        imageAlt: 'Challenge',
        pushUpTitle: 'Push-Up Duel',
        pushUpSubtitle: 'Spieler 1 zahlt zuerst. Danach wechselt der Zug zu Spieler 2.',
        currentRound: 'Aktuelle Runde',
        totalReps: 'Gesamte Wiederholungen',
        roundsWon: 'Gewonnene Runden',
        yourTurn: (player: string) => `${player} ist dran`,
        repsCounted: 'Wiederholungen gezahlt',
        undo: 'Zuruck',
        addRep: '+1 Wiederholung',
        finishPlayer: (player: string) => `${player} ist fertig`,
        finishRound: 'Runde beenden',
        addRound: 'Neue Runde',
        player1: 'Spieler 1',
        player2: 'Spieler 2',
        active: 'Zahlt jetzt',
        waiting: 'Wartet',
        complete: 'Fertig',
        roundWinner: (winner: string) => `${winner} gewinnt diese Runde`,
        tie: 'Unentschieden',
        roundResults: 'Rundenergebnisse',
        roundLabel: (round: number) => `Runde ${round}`,
        finalScore: (left: number, right: number) => `Endstand: ${left} - ${right}`,
      },
    }),
    [language],
  );

  const resolvedFriendName = String(friendName || '').trim()
    || pickLanguage(language, {
      en: 'your friend',
      ar: 'صديقك',
      it: 'il tuo amico',
      de: 'deinen Freund',
    });

  const copyWithFallbacks = copy as typeof copy & {
    finishChallenge?: string;
    currentUser?: string;
    friend?: string;
    you?: string;
    sendingInvite?: string;
    inviteSent?: (name: string, challenge: string) => string;
    inviteAlreadyPending?: (name: string, challenge: string) => string;
    inviteWaiting?: (name: string, challenge: string) => string;
    inviteAccepted?: (name: string) => string;
    inviteDeclined?: (name: string) => string;
    inviteCancelled?: (name: string) => string;
    inviteErrorFallback?: string;
    rewardBadge?: string;
    matchLeader?: (winner: string) => string;
    needAnotherRound?: string;
    challengeLocked?: string;
    saving?: string;
    saveSuccessYou?: (points: number, friendName: string, friendPoints: number) => string;
    saveSuccessFriend?: (name: string, points: number) => string;
    alreadySaved?: (winner?: string) => string;
    saveErrorFallback?: string;
    senderControls?: (name: string) => string;
    syncingChallenge?: string;
    failedChallengeSync?: string;
    turnLocked?: string;
    waitForOtherPlayer?: (name: string) => string;
    submitOwnTurn?: string;
    yourCountLocked?: string;
    senderCanManage?: (name: string) => string;
    challengeFinished?: string;
    youCanCountNow?: string;
    roundReady?: string;
    currentRoundReps?: string;
    noSessionYet?: string;
    strengthRewardBadge?: string;
    setWeightPrompt?: string;
    weightLabel?: string;
    bestWeightLabel?: string;
    strengthMade?: string;
    strengthMissed?: string;
    markLiftResult?: string;
    waitingForLift?: (name: string) => string;
    targetWeightReady?: string;
    noStrengthWinnerYet?: string;
    decidingWeightLabel?: string;
    resultMade?: string;
    resultMissed?: string;
    leavingChallenge?: string;
    challengeLeftTitle?: string;
    challengeLeftBody?: (name: string) => string;
    challengeLeftNoPoints?: string;
    leaveChallengeError?: string;
    returnHome?: string;
  };
  const localizedDefaults = useMemo(
    () => pickLanguage(language, {
      en: {
        finishChallenge: 'Finish Challenge',
        you: 'You',
        sendingInvite: 'Sending invite...',
        inviteSent: (name: string, challenge: string) => `${name} received your ${challenge} invite.`,
        inviteAlreadyPending: (name: string, challenge: string) => `${name} already has a pending ${challenge} invite.`,
        inviteWaiting: (name: string, challenge: string) => `Waiting for ${name} to accept your ${challenge} invite.`,
        inviteAccepted: (name: string) => `${name} accepted. You can start the challenge now.`,
        inviteDeclined: (name: string) => `${name} declined the challenge invite.`,
        inviteCancelled: (name: string) => `${name} did not accept in time. The challenge was cancelled.`,
        inviteErrorFallback: 'Could not send the challenge invite right now.',
        rewardBadge: `Round win +${CHALLENGE_ROUND_WIN_POINTS}. Tie round +${CHALLENGE_ROUND_TIE_POINTS} each.`,
        matchLeader: (winner: string) => `${winner} is leading the challenge`,
        needAnotherRound: 'The match is tied. Add one more round to decide the winner.',
        challengeLocked: 'Finish the current round to lock the winner.',
        saving: 'Saving result...',
        saveSuccessYou: (points: number, name: string, friendPoints: number) => `You earned +${points}. ${name} earned +${friendPoints}.`,
        saveSuccessFriend: (name: string, points: number) => `${name} earned +${points} leaderboard points.`,
        alreadySaved: () => 'This challenge was already scored.',
        saveErrorFallback: 'Could not finish the challenge right now.',
        senderControls: (name: string) => `${name} can add a new round or end the challenge.`,
        syncingChallenge: 'Syncing challenge...',
        failedChallengeSync: 'Could not sync this challenge right now.',
        turnLocked: 'Each player can only submit their own push-up count.',
        waitForOtherPlayer: (name: string) => `Waiting for ${name} to finish their turn.`,
        submitOwnTurn: 'Save my reps',
        yourCountLocked: 'Your counter unlocks only on your turn.',
        senderCanManage: (name: string) => `${name} decides when to add a round or end the challenge.`,
        challengeFinished: 'Challenge finished',
        youCanCountNow: 'Count your reps, then lock your turn.',
        roundReady: 'Round ready',
        currentRoundReps: 'Current round',
        noSessionYet: 'This challenge is still waiting for the other player to accept.',
        strengthRewardBadge: 'Last weight > 100kg: winner +50, other +20. Otherwise winner +20, other +10.',
        setWeightPrompt: 'Set the target weight for this 1-rep round.',
        weightLabel: 'Weight',
        bestWeightLabel: 'Best made',
        strengthMade: 'Made',
        strengthMissed: 'Missed',
        markLiftResult: 'Mark if the lift was made or missed.',
        waitingForLift: (name: string) => `Waiting for ${name} to attempt the lift.`,
        targetWeightReady: 'Target weight ready',
        noStrengthWinnerYet: 'Both players are still alive. Add a heavier round.',
        decidingWeightLabel: 'Deciding weight',
        resultMade: 'Made',
        resultMissed: 'Missed',
        resultWinTitle: 'Congratulations',
        resultLoseTitle: 'Good job',
        resultWinBody: 'You won this challenge. Keep building on this momentum.',
        resultLoseBody: 'You can do better next time. Keep pushing and come back stronger.',
        resultContinue: 'Continue',
        resultPoints: (points: number) => `+${points} leaderboard points`,
        waitingForAcceptance: (name: string) => `Waiting for ${name}`,
        startChallenge: 'Start challenge',
        inviteExpired: 'Invite expired',
        rewardTitle: 'Reward',
        lockWeightAndResult: 'Lock weight and result',
        saveMyResult: 'Save my result',
        leavingChallenge: 'Leaving challenge...',
        challengeLeftTitle: 'Challenge ended',
        challengeLeftBody: (name: string) => `${name} left the challenge, so no points were awarded.`,
        challengeLeftNoPoints: 'No leaderboard points were given for this challenge.',
        leaveChallengeError: 'Could not leave the challenge cleanly right now.',
        returnHome: 'Back to Home',
      },
      ar: {
        finishChallenge: 'إنهاء التحدي',
        you: 'أنت',
        sendingInvite: 'جارٍ إرسال الدعوة...',
        inviteSent: (name: string, challenge: string) => `تم إرسال دعوة ${challenge} إلى ${name}.`,
        inviteAlreadyPending: (name: string, challenge: string) => `لدى ${name} دعوة ${challenge} معلقة بالفعل.`,
        inviteWaiting: (name: string, challenge: string) => `بانتظار قبول ${name} لدعوة ${challenge}.`,
        inviteAccepted: (name: string) => `وافق ${name}. يمكنك بدء التحدي الآن.`,
        inviteDeclined: (name: string) => `رفض ${name} دعوة التحدي.`,
        inviteCancelled: (name: string) => `لم يقبل ${name} في الوقت المحدد. أُلغي التحدي.`,
        inviteErrorFallback: 'تعذر إرسال دعوة التحدي الآن.',
        rewardBadge: `الفوز بالجولة +${CHALLENGE_ROUND_WIN_POINTS}. التعادل +${CHALLENGE_ROUND_TIE_POINTS} لكل لاعب.`,
        matchLeader: (winner: string) => `${winner} يتقدم في التحدي`,
        needAnotherRound: 'التحدي متعادل. أضف جولة أخرى للحسم.',
        challengeLocked: 'أنهِ الجولة الحالية لتثبيت الفائز.',
        saving: 'جارٍ حفظ النتيجة...',
        saveSuccessYou: (points: number, name: string, friendPoints: number) => `حصلت على +${points}. وحصل ${name} على +${friendPoints}.`,
        saveSuccessFriend: (name: string, points: number) => `حصل ${name} على +${points} نقطة في لوحة الصدارة.`,
        alreadySaved: () => 'تم احتساب هذا التحدي بالفعل.',
        saveErrorFallback: 'تعذر إنهاء التحدي الآن.',
        senderControls: (name: string) => `${name} يمكنه إضافة جولة جديدة أو إنهاء التحدي.`,
        syncingChallenge: 'جارٍ مزامنة التحدي...',
        failedChallengeSync: 'تعذر مزامنة هذا التحدي الآن.',
        turnLocked: 'كل لاعب يمكنه تسجيل عدّه الخاص فقط.',
        waitForOtherPlayer: (name: string) => `بانتظار أن ينهي ${name} دوره.`,
        submitOwnTurn: 'حفظ عدّي',
        yourCountLocked: 'عدادك يُفتح فقط في دورك.',
        senderCanManage: (name: string) => `${name} يحدد متى يضيف جولة أو ينهي التحدي.`,
        challengeFinished: 'انتهى التحدي',
        youCanCountNow: 'سجّل عدّك ثم ثبّت دورك.',
        roundReady: 'الجولة جاهزة',
        currentRoundReps: 'الجولة الحالية',
        noSessionYet: 'هذا التحدي ما زال بانتظار قبول اللاعب الآخر.',
        strengthRewardBadge: 'إذا كان الوزن الحاسم أكبر من 100 كغ: الفائز +50 والآخر +20. وإلا فالفائز +20 والآخر +10.',
        setWeightPrompt: 'حدد وزن هذه الجولة ذات التكرار الواحد.',
        weightLabel: 'الوزن',
        bestWeightLabel: 'أفضل وزن ناجح',
        strengthMade: 'نجح',
        strengthMissed: 'أخفق',
        markLiftResult: 'حدد هل تم الرفع أم لا.',
        waitingForLift: (name: string) => `بانتظار محاولة ${name} للوزن.`,
        targetWeightReady: 'الوزن جاهز',
        noStrengthWinnerYet: 'ما زال اللاعبان في التحدي. أضف جولة أثقل.',
        decidingWeightLabel: 'الوزن الحاسم',
        resultMade: 'نجح',
        resultMissed: 'أخفق',
        resultWinTitle: 'مبروك',
        resultLoseTitle: 'عمل رائع',
        resultWinBody: 'فزت بهذا التحدي. واصل هذا الزخم.',
        resultLoseBody: 'يمكنك أن تقدم أفضل في المرة القادمة. استمر وارجع أقوى.',
        resultContinue: 'متابعة',
        resultPoints: (points: number) => `+${points} نقطة في لوحة الصدارة`,
        waitingForAcceptance: (name: string) => `بانتظار ${name}`,
        startChallenge: 'ابدأ التحدي',
        inviteExpired: 'انتهت الدعوة',
        rewardTitle: 'المكافأة',
        lockWeightAndResult: 'تثبيت الوزن والنتيجة',
        saveMyResult: 'حفظ نتيجتي',
        leavingChallenge: 'جارٍ مغادرة التحدي...',
        challengeLeftTitle: 'انتهى التحدي',
        challengeLeftBody: (name: string) => `${name} غادر التحدي، لذلك لم يحصل أحد على نقاط.`,
        challengeLeftNoPoints: 'لم يتم منح أي نقاط في لوحة الصدارة لهذا التحدي.',
        leaveChallengeError: 'تعذر الخروج من التحدي بشكل صحيح الآن.',
        returnHome: 'العودة إلى الرئيسية',
      },
      it: {
        finishChallenge: 'Termina sfida',
        you: 'Tu',
        sendingInvite: 'Invio invito...',
        inviteSent: (name: string, challenge: string) => `${name} ha ricevuto il tuo invito a ${challenge}.`,
        inviteAlreadyPending: (name: string, challenge: string) => `${name} ha gia un invito a ${challenge} in attesa.`,
        inviteWaiting: (name: string, challenge: string) => `In attesa che ${name} accetti il tuo invito a ${challenge}.`,
        inviteAccepted: (name: string) => `${name} ha accettato. Ora puoi iniziare la sfida.`,
        inviteDeclined: (name: string) => `${name} ha rifiutato l'invito alla sfida.`,
        inviteCancelled: (name: string) => `${name} non ha accettato in tempo. La sfida e stata annullata.`,
        inviteErrorFallback: 'Impossibile inviare l invito alla sfida ora.',
        rewardBadge: `Vittoria round +${CHALLENGE_ROUND_WIN_POINTS}. Pareggio +${CHALLENGE_ROUND_TIE_POINTS} ciascuno.`,
        matchLeader: (winner: string) => `${winner} e in vantaggio nella sfida`,
        needAnotherRound: 'La sfida e in parita. Aggiungi un altro round per decidere il vincitore.',
        challengeLocked: 'Completa il round corrente per confermare il vincitore.',
        saving: 'Salvataggio risultato...',
        saveSuccessYou: (points: number, name: string, friendPoints: number) => `Hai guadagnato +${points}. ${name} ha guadagnato +${friendPoints}.`,
        saveSuccessFriend: (name: string, points: number) => `${name} ha guadagnato +${points} punti classifica.`,
        alreadySaved: () => 'Questa sfida e gia stata conteggiata.',
        saveErrorFallback: 'Impossibile terminare la sfida ora.',
        senderControls: (name: string) => `${name} puo aggiungere un nuovo round o terminare la sfida.`,
        syncingChallenge: 'Sincronizzazione sfida...',
        failedChallengeSync: 'Impossibile sincronizzare questa sfida ora.',
        turnLocked: 'Ogni giocatore puo inviare solo il proprio conteggio di push-up.',
        waitForOtherPlayer: (name: string) => `In attesa che ${name} finisca il suo turno.`,
        submitOwnTurn: 'Salva le mie reps',
        yourCountLocked: 'Il tuo contatore si sblocca solo nel tuo turno.',
        senderCanManage: (name: string) => `${name} decide quando aggiungere un round o terminare la sfida.`,
        challengeFinished: 'Sfida terminata',
        youCanCountNow: 'Conta le tue reps e poi blocca il tuo turno.',
        roundReady: 'Round pronto',
        currentRoundReps: 'Round attuale',
        noSessionYet: 'Questa sfida aspetta ancora che l altro giocatore accetti.',
        strengthRewardBadge: 'Se il peso decisivo supera 100kg: vincitore +50, altro +20. Altrimenti vincitore +20, altro +10.',
        setWeightPrompt: 'Imposta il peso target per questo round da 1 rep.',
        weightLabel: 'Peso',
        bestWeightLabel: 'Miglior alzata',
        strengthMade: 'Fatta',
        strengthMissed: 'Mancata',
        markLiftResult: 'Segna se l alzata e riuscita o mancata.',
        waitingForLift: (name: string) => `In attesa che ${name} provi l alzata.`,
        targetWeightReady: 'Peso pronto',
        noStrengthWinnerYet: 'Entrambi sono ancora in gara. Aggiungi un round piu pesante.',
        decidingWeightLabel: 'Peso decisivo',
        resultMade: 'Fatta',
        resultMissed: 'Mancata',
        resultWinTitle: 'Congratulazioni',
        resultLoseTitle: 'Bel lavoro',
        resultWinBody: 'Hai vinto questa sfida. Continua cosi.',
        resultLoseBody: 'Puoi fare meglio la prossima volta. Continua a spingere e torna piu forte.',
        resultContinue: 'Continua',
        resultPoints: (points: number) => `+${points} punti classifica`,
        waitingForAcceptance: (name: string) => `In attesa di ${name}`,
        startChallenge: 'Inizia sfida',
        inviteExpired: 'Invito scaduto',
        rewardTitle: 'Ricompensa',
        lockWeightAndResult: 'Blocca peso e risultato',
        saveMyResult: 'Salva il mio risultato',
        leavingChallenge: 'Uscita dalla sfida...',
        challengeLeftTitle: 'Sfida terminata',
        challengeLeftBody: (name: string) => `${name} ha lasciato la sfida, quindi nessuno riceve punti.`,
        challengeLeftNoPoints: 'Nessun punto classifica e stato assegnato per questa sfida.',
        leaveChallengeError: 'Impossibile uscire correttamente dalla sfida ora.',
        returnHome: 'Torna alla Home',
      },
      de: {
        finishChallenge: 'Challenge beenden',
        you: 'Du',
        sendingInvite: 'Einladung wird gesendet...',
        inviteSent: (name: string, challenge: string) => `${name} hat deine Einladung zu ${challenge} erhalten.`,
        inviteAlreadyPending: (name: string, challenge: string) => `${name} hat bereits eine offene Einladung zu ${challenge}.`,
        inviteWaiting: (name: string, challenge: string) => `Warte darauf, dass ${name} deine Einladung zu ${challenge} annimmt.`,
        inviteAccepted: (name: string) => `${name} hat angenommen. Du kannst die Challenge jetzt starten.`,
        inviteDeclined: (name: string) => `${name} hat die Challenge-Einladung abgelehnt.`,
        inviteCancelled: (name: string) => `${name} hat nicht rechtzeitig angenommen. Die Challenge wurde abgebrochen.`,
        inviteErrorFallback: 'Die Challenge-Einladung konnte gerade nicht gesendet werden.',
        rewardBadge: `Rundensieg +${CHALLENGE_ROUND_WIN_POINTS}. Unentschieden +${CHALLENGE_ROUND_TIE_POINTS} fur beide.`,
        matchLeader: (winner: string) => `${winner} fuhrt die Challenge an`,
        needAnotherRound: 'Die Challenge ist unentschieden. Fuge eine weitere Runde hinzu, um den Sieger zu bestimmen.',
        challengeLocked: 'Beende die aktuelle Runde, um den Sieger festzulegen.',
        saving: 'Ergebnis wird gespeichert...',
        saveSuccessYou: (points: number, name: string, friendPoints: number) => `Du hast +${points} bekommen. ${name} hat +${friendPoints} bekommen.`,
        saveSuccessFriend: (name: string, points: number) => `${name} hat +${points} Ranglistenpunkte erhalten.`,
        alreadySaved: () => 'Diese Challenge wurde bereits gewertet.',
        saveErrorFallback: 'Die Challenge konnte gerade nicht beendet werden.',
        senderControls: (name: string) => `${name} kann eine neue Runde hinzufugen oder die Challenge beenden.`,
        syncingChallenge: 'Challenge wird synchronisiert...',
        failedChallengeSync: 'Diese Challenge konnte gerade nicht synchronisiert werden.',
        turnLocked: 'Jeder Spieler kann nur seine eigenen Push-up-Zahlen senden.',
        waitForOtherPlayer: (name: string) => `Warte darauf, dass ${name} den Zug beendet.`,
        submitOwnTurn: 'Meine Wiederholungen speichern',
        yourCountLocked: 'Dein Zahler wird nur in deinem Zug freigeschaltet.',
        senderCanManage: (name: string) => `${name} entscheidet, wann eine Runde hinzugefugt oder die Challenge beendet wird.`,
        challengeFinished: 'Challenge beendet',
        youCanCountNow: 'Zahle deine Wiederholungen und sperre dann deinen Zug.',
        roundReady: 'Runde bereit',
        currentRoundReps: 'Aktuelle Runde',
        noSessionYet: 'Diese Challenge wartet noch darauf, dass der andere Spieler annimmt.',
        strengthRewardBadge: 'Wenn das entscheidende Gewicht uber 100kg liegt: Sieger +50, anderer +20. Sonst Sieger +20, anderer +10.',
        setWeightPrompt: 'Lege das Zielgewicht fur diese 1-Wiederholungs-Runde fest.',
        weightLabel: 'Gewicht',
        bestWeightLabel: 'Bestes geschafft',
        strengthMade: 'Geschafft',
        strengthMissed: 'Nicht geschafft',
        markLiftResult: 'Markiere, ob der Lift geschafft oder verpasst wurde.',
        waitingForLift: (name: string) => `Warte darauf, dass ${name} den Lift versucht.`,
        targetWeightReady: 'Zielgewicht bereit',
        noStrengthWinnerYet: 'Beide sind noch im Rennen. Fuge eine schwerere Runde hinzu.',
        decidingWeightLabel: 'Entscheidendes Gewicht',
        resultMade: 'Geschafft',
        resultMissed: 'Nicht geschafft',
        resultWinTitle: 'Gluckwunsch',
        resultLoseTitle: 'Gute Arbeit',
        resultWinBody: 'Du hast diese Challenge gewonnen. Mach so weiter.',
        resultLoseBody: 'Du kannst es beim nachsten Mal besser machen. Bleib dran und komm starker zuruck.',
        resultContinue: 'Weiter',
        resultPoints: (points: number) => `+${points} Ranglistenpunkte`,
        waitingForAcceptance: (name: string) => `Warte auf ${name}`,
        startChallenge: 'Challenge starten',
        inviteExpired: 'Einladung abgelaufen',
        rewardTitle: 'Belohnung',
        lockWeightAndResult: 'Gewicht und Ergebnis sperren',
        saveMyResult: 'Mein Ergebnis speichern',
        leavingChallenge: 'Challenge wird verlassen...',
        challengeLeftTitle: 'Challenge beendet',
        challengeLeftBody: (name: string) => `${name} hat die Challenge verlassen, daher bekommt niemand Punkte.`,
        challengeLeftNoPoints: 'Fuer diese Challenge wurden keine Leaderboard-Punkte vergeben.',
        leaveChallengeError: 'Die Challenge konnte gerade nicht sauber verlassen werden.',
        returnHome: 'Zur Startseite',
      },
    }),
    [language],
  );
  const finishChallengeLabel = copyWithFallbacks.finishChallenge || localizedDefaults.finishChallenge;
  const youLabel = copyWithFallbacks.you || localizedDefaults.you;
  const sendingInviteLabel = copyWithFallbacks.sendingInvite || localizedDefaults.sendingInvite;
  const inviteSentLabel =
    copyWithFallbacks.inviteSent
    || localizedDefaults.inviteSent;
  const inviteAlreadyPendingLabel =
    copyWithFallbacks.inviteAlreadyPending
    || localizedDefaults.inviteAlreadyPending;
  const inviteWaitingLabel =
    copyWithFallbacks.inviteWaiting
    || localizedDefaults.inviteWaiting;
  const inviteAcceptedLabel =
    copyWithFallbacks.inviteAccepted
    || localizedDefaults.inviteAccepted;
  const inviteDeclinedLabel =
    copyWithFallbacks.inviteDeclined
    || localizedDefaults.inviteDeclined;
  const inviteCancelledLabel =
    copyWithFallbacks.inviteCancelled
    || localizedDefaults.inviteCancelled;
  const inviteErrorFallbackLabel =
    copyWithFallbacks.inviteErrorFallback || localizedDefaults.inviteErrorFallback;
  const rewardBadgeLabel =
    copyWithFallbacks.rewardBadge
    || localizedDefaults.rewardBadge;
  const matchLeaderLabel =
    copyWithFallbacks.matchLeader
    || localizedDefaults.matchLeader;
  const needAnotherRoundLabel =
    copyWithFallbacks.needAnotherRound
    || localizedDefaults.needAnotherRound;
  const challengeLockedLabel =
    copyWithFallbacks.challengeLocked || localizedDefaults.challengeLocked;
  const savingLabel = copyWithFallbacks.saving || localizedDefaults.saving;
  const saveSuccessYouLabel =
    copyWithFallbacks.saveSuccessYou
    || localizedDefaults.saveSuccessYou;
  const saveSuccessFriendLabel =
    copyWithFallbacks.saveSuccessFriend
    || localizedDefaults.saveSuccessFriend;
  const alreadySavedLabel =
    copyWithFallbacks.alreadySaved
    || localizedDefaults.alreadySaved;
  const saveErrorFallbackLabel =
    copyWithFallbacks.saveErrorFallback || localizedDefaults.saveErrorFallback;
  const senderControlsLabel =
    copyWithFallbacks.senderControls
    || localizedDefaults.senderControls;
  const syncingChallengeLabel = copyWithFallbacks.syncingChallenge || localizedDefaults.syncingChallenge;
  const failedChallengeSyncLabel =
    copyWithFallbacks.failedChallengeSync || localizedDefaults.failedChallengeSync;
  const turnLockedLabel =
    copyWithFallbacks.turnLocked || localizedDefaults.turnLocked;
  const waitForOtherPlayerLabel =
    copyWithFallbacks.waitForOtherPlayer || localizedDefaults.waitForOtherPlayer;
  const submitOwnTurnLabel = copyWithFallbacks.submitOwnTurn || localizedDefaults.submitOwnTurn;
  const yourCountLockedLabel = copyWithFallbacks.yourCountLocked || localizedDefaults.yourCountLocked;
  const senderCanManageLabel =
    copyWithFallbacks.senderCanManage || localizedDefaults.senderCanManage;
  const challengeFinishedLabel = copyWithFallbacks.challengeFinished || localizedDefaults.challengeFinished;
  const youCanCountNowLabel = copyWithFallbacks.youCanCountNow || localizedDefaults.youCanCountNow;
  const roundReadyLabel = copyWithFallbacks.roundReady || localizedDefaults.roundReady;
  const currentRoundRepsLabel = copyWithFallbacks.currentRoundReps || localizedDefaults.currentRoundReps;
  const noSessionYetLabel = copyWithFallbacks.noSessionYet || localizedDefaults.noSessionYet;
  const strengthRewardBadgeLabel =
    copyWithFallbacks.strengthRewardBadge || localizedDefaults.strengthRewardBadge;
  const setWeightPromptLabel = copyWithFallbacks.setWeightPrompt || localizedDefaults.setWeightPrompt;
  const weightLabel = copyWithFallbacks.weightLabel || localizedDefaults.weightLabel;
  const bestWeightLabel = copyWithFallbacks.bestWeightLabel || localizedDefaults.bestWeightLabel;
  const strengthMadeLabel = copyWithFallbacks.strengthMade || localizedDefaults.strengthMade;
  const strengthMissedLabel = copyWithFallbacks.strengthMissed || localizedDefaults.strengthMissed;
  const markLiftResultLabel = copyWithFallbacks.markLiftResult || localizedDefaults.markLiftResult;
  const waitingForLiftLabel =
    copyWithFallbacks.waitingForLift || localizedDefaults.waitingForLift;
  const targetWeightReadyLabel = copyWithFallbacks.targetWeightReady || localizedDefaults.targetWeightReady;
  const noStrengthWinnerYetLabel = copyWithFallbacks.noStrengthWinnerYet || localizedDefaults.noStrengthWinnerYet;
  const decidingWeightLabel = copyWithFallbacks.decidingWeightLabel || localizedDefaults.decidingWeightLabel;
  const resultMadeLabel = copyWithFallbacks.resultMade || localizedDefaults.resultMade;
  const resultMissedLabel = copyWithFallbacks.resultMissed || localizedDefaults.resultMissed;
  const resultWinTitle = localizedDefaults.resultWinTitle;
  const resultLoseTitle = localizedDefaults.resultLoseTitle;
  const resultWinBody = localizedDefaults.resultWinBody;
  const resultLoseBody = localizedDefaults.resultLoseBody;
  const resultContinueLabel = localizedDefaults.resultContinue;
  const resultPointsLabel = localizedDefaults.resultPoints;
  const leavingChallengeLabel = localizedDefaults.leavingChallenge;
  const challengeLeftTitleLabel = localizedDefaults.challengeLeftTitle;
  const challengeLeftBodyLabel = localizedDefaults.challengeLeftBody;
  const challengeLeftNoPointsLabel = localizedDefaults.challengeLeftNoPoints;
  const leaveChallengeErrorLabel = localizedDefaults.leaveChallengeError;
  const returnHomeLabel = localizedDefaults.returnHome;
  const waitingForAcceptanceLabel = localizedDefaults.waitingForAcceptance;
  const startChallengeLabel = localizedDefaults.startChallenge;
  const inviteExpiredLabel = localizedDefaults.inviteExpired;
  const rewardTitleLabel = localizedDefaults.rewardTitle;
  const lockWeightAndResultLabel = localizedDefaults.lockWeightAndResult;
  const saveMyResultLabel = localizedDefaults.saveMyResult;
  const storedUser = getStoredAppUser();
  const currentUserId = toPositiveInteger(getStoredUserId());
  const resolvedFriendId = toPositiveInteger(friendId);
  const currentUserName = getStoredDisplayName(storedUser);
  const currentUserDisplayName = currentUserName || youLabel;
  const currentPlayer = useMemo<PlayerKey>(() => {
    if (challengeSession && currentUserId) {
      if (challengeSession.senderUserId === currentUserId) return 'player1';
      if (challengeSession.receiverUserId === currentUserId) return 'player2';
    }
    return currentUserPlayer === 'player2' ? 'player2' : 'player1';
  }, [challengeSession, currentUserId, currentUserPlayer]);
  const canManageChallenge = currentPlayer === 'player1';
  const player1DisplayName = currentPlayer === 'player1' ? currentUserDisplayName : resolvedFriendName;
  const player2DisplayName = currentPlayer === 'player2' ? currentUserDisplayName : resolvedFriendName;
  const player1UserId = currentPlayer === 'player1' ? currentUserId : resolvedFriendId;
  const player2UserId = currentPlayer === 'player2' ? currentUserId : resolvedFriendId;
  const getPlayerDisplayName = useCallback((player: PlayerKey, useYouLabel = false) => {
    const isCurrentUser = player === currentPlayer;
    if (isCurrentUser && useYouLabel) return youLabel;
    return player === 'player1' ? player1DisplayName : player2DisplayName;
  }, [currentPlayer, player1DisplayName, player2DisplayName, youLabel]);

  const currentChallengeKey = challengeSession?.challengeKey
    || activeInviteChallengeKey
    || toFriendChallengeKey(introTargetChallengeId || directChallengeId || 'push-until-failure')
    || 'push_until_failure';
  const isStrengthChallenge = isStrengthFriendChallenge(currentChallengeKey);
  const currentChallengeCard = getFriendChallengeByKey(currentChallengeKey) || CHALLENGE_CARDS[0];
  const currentChallengeTitle = currentChallengeCard?.title || 'Challenge';
  const currentChallengeSubtitle = currentChallengeCard?.heroSubtitle || turnLockedLabel;
  const currentChallengeValueLabel = currentChallengeCard?.valueLabel || 'Score';
  const currentChallengeTotalLabel = currentChallengeCard?.totalLabel || copy.totalReps;
  const currentChallengeEntryLabel = currentChallengeCard?.entryLabel || currentRoundRepsLabel;
  const currentChallengeStep = currentChallengeCard?.step || 1;
  const currentChallengeMin = currentChallengeCard?.min || 0;
  const resetPushUpDuel = useCallback((challengeKey = 'push_up_duel') => {
    localLeaveInFlightRef.current = false;
    setPushUpRounds([createPushUpRound(1)]);
    setStrengthRounds([createStrengthRound(1)]);
    pushUpDraftSyncKeyRef.current = '';
    strengthDraftSyncKeyRef.current = '';
    setChallengeSession(null);
    setTurnDraftCount(0);
    setTurnDraftWeightKg(20);
    setTurnDraftOutcome('made');
    setSessionSyncState('idle');
    setSessionMessage('');
    setSessionNoticeModal(null);
    setSubmissionState('idle');
    setSubmissionMessage('');
    setClientMatchId(createClientMatchId(challengeKey));
  }, []);

  const exitChallengeToHome = useCallback(() => {
    resetPushUpDuel(currentChallengeKey);
    setActiveChallengeSessionId(null);
    setSessionNoticeModal(null);
    setResultModal(null);
    onExitHome?.();
    if (!onExitHome) {
      onBack();
    }
  }, [currentChallengeKey, onBack, onExitHome, resetPushUpDuel]);

  const applyChallengeSession = (rawSession: unknown) => {
    const normalizedSession = normalizeFriendChallengeSession(rawSession);
    if (!normalizedSession) return null;

    setChallengeSession(normalizedSession);
    if (normalizedSession.challengeMode === 'weight') {
      setStrengthRounds(normalizedSession.rounds as StrengthRound[]);
    } else {
      setPushUpRounds(normalizedSession.rounds as PushUpRound[]);
    }
    if (normalizedSession.clientMatchId) {
      setClientMatchId(normalizedSession.clientMatchId);
    }
    return normalizedSession;
  };

  useEffect(() => {
    if (!currentUserId || !activeInviteNotificationId || !activeInviteChallengeKey) return undefined;
    if (challengeAccessStatus !== 'pending') return undefined;

    let cancelled = false;
    const syncChallengeResponse = async () => {
      try {
        const notifications = await api.getNotifications(currentUserId);
        if (cancelled || !Array.isArray(notifications)) return;

        const matchingNotification = notifications.find((notification: any) => {
          const data = parseNotificationData(notification?.data);
          if (resolveNotificationType(notification, data) !== 'friend_challenge_response') return false;
          return Number(data.receiverNotificationId || 0) === activeInviteNotificationId
            && (toFriendChallengeKey(String(data.challengeKey || '')) || String(data.challengeKey || '').trim().toLowerCase()) === activeInviteChallengeKey;
        });

        if (!matchingNotification) return;

        const responseData = parseNotificationData(matchingNotification.data);
        const responseStatus = String(responseData.responseStatus || '').trim().toLowerCase();
        if (responseStatus === 'accepted') {
          const nextSessionId = toPositiveInteger(responseData.sessionId);
          const nextChallengeCardId = toFriendChallengeCardId(activeInviteChallengeKey);
          setChallengeAccessStatus('accepted');
          setInviteMessage(inviteAcceptedLabel(resolvedFriendName));
          if (nextSessionId) {
            setActiveChallengeSessionId(nextSessionId);
          }
          setChallengeSession(null);
          setSessionMessage('');
          setSessionSyncState('idle');
          resetPushUpDuel(activeInviteChallengeKey);
          setIntroTargetChallengeId(nextChallengeCardId);
          setView('intro');
          return;
        }
        if (responseStatus === 'declined') {
          setChallengeAccessStatus('declined');
          setInviteMessage(inviteDeclinedLabel(resolvedFriendName));
          return;
        }
        if (responseStatus === 'cancelled') {
          setChallengeAccessStatus('cancelled');
          setInviteMessage(inviteCancelledLabel(resolvedFriendName));
        }
      } catch (error) {
        if (cancelled) return;

        const message = error instanceof Error ? error.message.trim() : '';
        if (!message) return;
        if (/backend is offline|failed to fetch|connection refused/i.test(message)) return;
      }
    };

    void syncChallengeResponse();
    const interval = window.setInterval(() => {
      void syncChallengeResponse();
    }, 5000);

    return () => {
      cancelled = true;
      window.clearInterval(interval);
    };
  }, [
    activeInviteChallengeKey,
    activeInviteNotificationId,
    challengeAccessStatus,
    currentUserId,
    inviteAcceptedLabel,
    inviteCancelledLabel,
    inviteDeclinedLabel,
    resolvedFriendName,
  ]);

  useEffect(() => {
    if (!currentUserId || !activeChallengeSessionId) return undefined;
    if (view !== 'intro' && view !== 'numeric-duel' && view !== 'weight-duel') return undefined;

    let cancelled = false;
    const syncSession = async (silent = false) => {
      if (!silent) {
        setSessionSyncState('loading');
        setSessionMessage(syncingChallengeLabel);
      }

      try {
        const response = await api.getFriendChallengeSession(currentUserId, activeChallengeSessionId);
        if (cancelled) return;

        const normalizedSession = applyChallengeSession(response?.session || response);
        if (!normalizedSession) {
          throw new Error(failedChallengeSyncLabel);
        }

        if (normalizedSession.status === 'abandoned') {
          setSessionSyncState('idle');
          setSessionMessage('');

          if (localLeaveInFlightRef.current || normalizedSession.abandonedByUserId === currentUserId) {
            localLeaveInFlightRef.current = false;
            exitChallengeToHome();
            return;
          }

          setSessionNoticeModal({
            title: challengeLeftTitleLabel,
            body: `${challengeLeftBodyLabel(
              normalizedSession.abandonedByUserName
                || getPlayerDisplayName(
                  normalizedSession.abandonedByUserId === normalizedSession.senderUserId ? 'player1' : 'player2',
                  false,
                ),
            )} ${challengeLeftNoPointsLabel}`,
          });
          return;
        }

        setSessionSyncState('idle');
        setSessionMessage('');
      } catch (error) {
        if (cancelled) return;
        setSessionSyncState('error');
        setSessionMessage(
          error instanceof Error && error.message.trim()
            ? error.message
            : failedChallengeSyncLabel,
        );
      }
    };

    void syncSession(false);
    const interval = window.setInterval(() => {
      void syncSession(true);
    }, 3000);

    return () => {
      cancelled = true;
      window.clearInterval(interval);
    };
  }, [
    activeChallengeSessionId,
    challengeLeftBodyLabel,
    challengeLeftNoPointsLabel,
    challengeLeftTitleLabel,
    currentUserId,
    exitChallengeToHome,
    failedChallengeSyncLabel,
    getPlayerDisplayName,
    syncingChallengeLabel,
    view,
  ]);

  const activeRound = pushUpRounds[pushUpRounds.length - 1] || createPushUpRound(1);
  const activePlayer = activeRound.status === 'complete' ? null : activeRound.status;
  const activeRoundWinner = getRoundWinner(activeRound, currentChallengeKey);
  const activeRoundWinnerLabel =
    activeRoundWinner === 'tie'
      ? copy.tie
      : activeRoundWinner === 'player1'
        ? getPlayerDisplayName('player1', true)
        : getPlayerDisplayName('player2', true);

  const totals = useMemo(() => {
    const completedRounds = pushUpRounds.filter((round) => round.status === 'complete');

    return {
      completedRounds,
      player1Reps: pushUpRounds.reduce((sum, round) => sum + round.player1, 0),
      player2Reps: pushUpRounds.reduce((sum, round) => sum + round.player2, 0),
      player1Wins: completedRounds.filter((round) => getRoundWinner(round, currentChallengeKey) === 'player1').length,
      player2Wins: completedRounds.filter((round) => getRoundWinner(round, currentChallengeKey) === 'player2').length,
    };
  }, [currentChallengeKey, pushUpRounds]);

  const matchWinner = useMemo<PlayerKey | null>(() => {
    if (!totals.completedRounds.length) return null;
    if (totals.player1Wins > totals.player2Wins) return 'player1';
    if (totals.player2Wins > totals.player1Wins) return 'player2';
    if (totals.player1Reps > totals.player2Reps) return 'player1';
    if (totals.player2Reps > totals.player1Reps) return 'player2';
    return null;
  }, [totals]);

  const strengthActiveRound = strengthRounds[strengthRounds.length - 1] || createStrengthRound(1);
  const strengthActivePlayer = strengthActiveRound.status === 'complete' ? null : strengthActiveRound.status;
  const strengthRoundWinner = getStrengthRoundWinner(strengthActiveRound);
  const strengthCompletedRounds = useMemo(
    () => strengthRounds.filter((round) => round.status === 'complete'),
    [strengthRounds],
  );
  const strengthMatchWinner = useMemo<PlayerKey | null>(() => {
    const decidingRound = [...strengthCompletedRounds]
      .reverse()
      .find((round) => getStrengthRoundWinner(round) !== 'tie');
    return decidingRound ? getStrengthRoundWinner(decidingRound) : null;
  }, [strengthCompletedRounds]);
  const strengthMatchWinnerDisplayName =
    strengthMatchWinner === 'player1'
      ? getPlayerDisplayName('player1', true)
      : strengthMatchWinner === 'player2'
        ? getPlayerDisplayName('player2', true)
        : '';
  const strengthMatchWinnerUserId =
    strengthMatchWinner === 'player1'
      ? player1UserId
      : strengthMatchWinner === 'player2'
        ? player2UserId
        : null;
  const strengthBestWeights = useMemo(() => ({
    player1: strengthRounds.reduce(
      (max, round) => (round.player1Result === 'made' ? Math.max(max, round.weightKg) : max),
      0,
    ),
    player2: strengthRounds.reduce(
      (max, round) => (round.player2Result === 'made' ? Math.max(max, round.weightKg) : max),
      0,
    ),
  }), [strengthRounds]);
  const strengthMadeCounts = useMemo(() => ({
    player1: strengthRounds.filter((round) => round.player1Result === 'made').length,
    player2: strengthRounds.filter((round) => round.player2Result === 'made').length,
  }), [strengthRounds]);
  const strengthDecidingWeightKg = Number(
    [...strengthCompletedRounds]
      .reverse()
      .find((round) => getStrengthRoundWinner(round) !== 'tie')?.weightKg || 0,
  );

  const activeSessionPlayer = isStrengthChallenge ? strengthActivePlayer : activePlayer;
  const matchWinnerForSession = isStrengthChallenge ? strengthMatchWinner : matchWinner;
  const matchWinnerDisplayNameForSession = isStrengthChallenge ? strengthMatchWinnerDisplayName : (
    matchWinner === 'player1'
      ? getPlayerDisplayName('player1', true)
      : matchWinner === 'player2'
        ? getPlayerDisplayName('player2', true)
        : ''
  );
  const matchWinnerUserIdForSession = isStrengthChallenge ? strengthMatchWinnerUserId : (
    matchWinner === 'player1'
      ? player1UserId
      : matchWinner === 'player2'
        ? player2UserId
        : null
  );
  const challengeFinished = challengeSession?.status === 'completed' || challengeSession?.status === 'abandoned';
  const pointsByRoleForSession = useMemo(
    () => getChallengePointsByRole(
      currentChallengeKey,
      isStrengthChallenge ? strengthRounds : pushUpRounds,
    ),
    [currentChallengeKey, isStrengthChallenge, pushUpRounds, strengthRounds],
  );
  const canCountOwnTurn =
    Boolean(currentUserId)
    && Boolean(activeChallengeSessionId)
    && Boolean(activeSessionPlayer)
    && activeSessionPlayer === currentPlayer
    && !challengeFinished
    && submissionState !== 'submitting'
    && submissionState !== 'completed'
    && sessionSyncState !== 'saving';
  const displayedRoundCount = activePlayer && activePlayer === currentPlayer ? turnDraftCount : 0;
  const canFinishChallenge =
    Boolean(currentUserId)
    && Boolean(resolvedFriendId)
    && Boolean(activeChallengeSessionId)
    && canManageChallenge
    && !challengeFinished
    && submissionState !== 'submitting'
    && submissionState !== 'completed'
    && (
      isStrengthChallenge
        ? strengthActiveRound.status === 'complete' && Boolean(strengthMatchWinner)
        : activeRound.status === 'complete' && Boolean(matchWinner)
    );

  useEffect(() => {
    if (!activePlayer || activePlayer !== currentPlayer || isStrengthChallenge) {
      pushUpDraftSyncKeyRef.current = '';
      setTurnDraftCount(0);
      return;
    }

    const draftKey = `${currentPlayer}:${activeRound.number}:${activeRound.status}`;
    if (pushUpDraftSyncKeyRef.current === draftKey) {
      return;
    }
    pushUpDraftSyncKeyRef.current = draftKey;
    setTurnDraftCount(activeRound[activePlayer]);
  }, [activePlayer, activeRound, currentPlayer, isStrengthChallenge]);

  useEffect(() => {
    if (!isStrengthChallenge) return;
    if (!strengthActivePlayer || strengthActivePlayer !== currentPlayer) {
      strengthDraftSyncKeyRef.current = '';
      setTurnDraftOutcome('made');
      if (currentPlayer === 'player1') {
        const previousWeight = strengthRounds[strengthRounds.length - 2]?.weightKg || 20;
        setTurnDraftWeightKg(Math.max(20, previousWeight + (strengthRounds.length > 1 ? currentChallengeStep : 0)));
      }
      return;
    }

    const draftKey = `${currentPlayer}:${strengthActiveRound.number}:${strengthActiveRound.status}`;
    if (strengthDraftSyncKeyRef.current === draftKey) {
      return;
    }
    strengthDraftSyncKeyRef.current = draftKey;

    const existingOutcome = currentPlayer === 'player1'
      ? strengthActiveRound.player1Result
      : strengthActiveRound.player2Result;
    setTurnDraftOutcome(existingOutcome === 'missed' ? 'missed' : 'made');

    if (currentPlayer === 'player1') {
      const previousWeight = strengthRounds[strengthRounds.length - 2]?.weightKg || 20;
      setTurnDraftWeightKg(
        Number(strengthActiveRound.weightKg || 0) > 0
          ? Number(strengthActiveRound.weightKg || 0)
          : Math.max(20, previousWeight + (strengthRounds.length > 1 ? currentChallengeStep : 0)),
      );
    }
  }, [currentChallengeStep, currentPlayer, isStrengthChallenge, strengthActivePlayer, strengthActiveRound, strengthRounds]);

  useEffect(() => {
    if (!challengeSession || !currentUserId) return;
    if (challengeSession.status !== 'completed' || !challengeSession.winnerUserId) return;

    const sessionKey = `${challengeSession.id}:${challengeSession.winnerUserId}`;
    if (shownResultSessionsRef.current.has(sessionKey)) return;
    shownResultSessionsRef.current.add(sessionKey);

    const didWin = Number(challengeSession.winnerUserId) === currentUserId;
    const pointsAwarded = currentPlayer === 'player1'
      ? pointsByRoleForSession.player1
      : pointsByRoleForSession.player2;

    setResultModal({
      didWin,
      challengeTitle: currentChallengeTitle,
      pointsAwarded,
    });
  }, [
    challengeSession,
    currentChallengeTitle,
    currentPlayer,
    currentUserId,
    pointsByRoleForSession.player1,
    pointsByRoleForSession.player2,
  ]);

  useEffect(() => {
    if (!sessionNoticeModal) return undefined;

    const timer = window.setTimeout(() => {
      exitChallengeToHome();
    }, 1800);

    return () => {
      window.clearTimeout(timer);
    };
  }, [exitChallengeToHome, sessionNoticeModal]);

  const handleLeaveChallenge = async () => {
    if (!currentUserId || !activeChallengeSessionId) {
      exitChallengeToHome();
      return;
    }

    localLeaveInFlightRef.current = true;
    setSessionSyncState('saving');
    setSessionMessage(leavingChallengeLabel);

    try {
      const response = await api.leaveFriendChallengeSession({
        userId: currentUserId,
        sessionId: activeChallengeSessionId,
      });
      applyChallengeSession(response?.session || response);
      exitChallengeToHome();
    } catch (error) {
      localLeaveInFlightRef.current = false;
      setSessionSyncState('error');
      setSessionMessage(
        error instanceof Error && error.message.trim()
          ? error.message
          : leaveChallengeErrorLabel,
      );
    }
  };

  const handleBack = () => {
    if (view === 'numeric-duel' || view === 'weight-duel') {
      if (activeChallengeSessionId && !challengeFinished) {
        void handleLeaveChallenge();
        return;
      }
      if (getFriendChallengeByCardId(directChallengeId)) {
        resetPushUpDuel(toFriendChallengeKey(directChallengeId) || currentChallengeKey);
        exitChallengeToHome();
        return;
      }
      setView('cards');
      resetPushUpDuel();
      return;
    }
    onBack();
  };

  const handleSelectChallenge = async (card: FriendChallengeDefinition) => {
    if (!card.available || inviteState === 'sending') return;

    const challengeKey = card.key;
    const waitingForCurrentInvite =
      activeInviteChallengeKey === challengeKey
      && activeInviteNotificationId
      && challengeAccessStatus === 'pending';
    const currentInviteAccepted =
      activeInviteChallengeKey === challengeKey
      && challengeAccessStatus === 'accepted';

    if (waitingForCurrentInvite) {
      setInviteMessage(inviteWaitingLabel(resolvedFriendName, card.title));
      return;
    }

    if (currentInviteAccepted) {
      if (!activeChallengeSessionId) {
        setInviteState('error');
        setInviteMessage(noSessionYetLabel);
        return;
      }
      resetPushUpDuel(challengeKey);
      setIntroTargetChallengeId(card.id);
      setView('intro');
      return;
    }

    if (!currentUserId || !resolvedFriendId) {
      setInviteState('error');
      setInviteMessage(inviteErrorFallbackLabel);
      return;
    }

    setInviteState('sending');
    setInviteMessage(sendingInviteLabel);

    try {
      const response = await api.sendFriendChallengeInvite({
        userId: currentUserId,
        friendId: resolvedFriendId,
        challengeKey,
        challengeTitle: card.title,
      });

      setInviteState('sent');
      setActiveChallengeSessionId(null);
      setActiveInviteNotificationId(toPositiveInteger(response?.notificationId));
      setActiveInviteChallengeKey(challengeKey);
      setChallengeAccessStatus('pending');
      setInviteMessage(
        response?.alreadyPending
          ? inviteAlreadyPendingLabel(resolvedFriendName, card.title)
          : inviteWaitingLabel(resolvedFriendName, card.title),
      );
    } catch (error) {
      setInviteState('error');
      setInviteMessage(
        error instanceof Error && error.message.trim()
          ? error.message
          : inviteErrorFallbackLabel,
      );
    }
  };

  const changeRepCount = (delta: number) => {
    if (!canCountOwnTurn) return;
    setTurnDraftCount((current) => Math.max(currentChallengeMin, current + delta));
  };

  const changeWeightKg = (delta: number) => {
    if (!canCountOwnTurn || currentPlayer !== 'player1' || !isStrengthChallenge) return;
    setTurnDraftWeightKg((current) => Math.max(0, Number((current + delta).toFixed(1))));
  };

  const handleAdvanceTurn = async (outcomeOverride?: 'made' | 'missed') => {
    if (!currentUserId) {
      setSessionSyncState('error');
      setSessionMessage(failedChallengeSyncLabel);
      return;
    }
    if (!activeChallengeSessionId) {
      setSessionSyncState('error');
      setSessionMessage(noSessionYetLabel);
      return;
    }
    if (!canCountOwnTurn) {
      setSessionSyncState('error');
      setSessionMessage(
        challengeFinished
          ? challengeFinishedLabel
          : activeSessionPlayer
            ? waitForOtherPlayerLabel(getPlayerDisplayName(activeSessionPlayer, true))
            : yourCountLockedLabel,
      );
      return;
    }

    const submittedOutcome = outcomeOverride || turnDraftOutcome;
    if (isStrengthChallenge && outcomeOverride) {
      setTurnDraftOutcome(outcomeOverride);
    }

    setSessionSyncState('saving');
    setSessionMessage(syncingChallengeLabel);

    try {
      const response = await api.submitFriendChallengeTurn(
        isStrengthChallenge
          ? {
            userId: currentUserId,
            sessionId: activeChallengeSessionId,
            weightKg: currentPlayer === 'player1' ? turnDraftWeightKg : undefined,
            outcome: submittedOutcome,
          }
          : {
            userId: currentUserId,
            sessionId: activeChallengeSessionId,
            value: turnDraftCount,
          },
      );
      const normalizedSession = applyChallengeSession(response?.session || response);
      if (!normalizedSession) {
        throw new Error(failedChallengeSyncLabel);
      }
      setSessionSyncState('idle');
      setSessionMessage('');
    } catch (error) {
      setSessionSyncState('error');
      setSessionMessage(
        error instanceof Error && error.message.trim()
          ? error.message
          : failedChallengeSyncLabel,
      );
    }
  };

  const handleAddRound = async () => {
    if (!currentUserId || !activeChallengeSessionId || submissionState === 'completed') return;

    setSubmissionState('idle');
    setSubmissionMessage('');
    setSessionSyncState('saving');
    setSessionMessage(syncingChallengeLabel);

    try {
      const response = await api.addFriendChallengeRound({
        userId: currentUserId,
        sessionId: activeChallengeSessionId,
      });
      const normalizedSession = applyChallengeSession(response?.session || response);
      if (!normalizedSession) {
        throw new Error(failedChallengeSyncLabel);
      }
      setSessionSyncState('idle');
      setSessionMessage('');
    } catch (error) {
      setSessionSyncState('error');
      setSessionMessage(
        error instanceof Error && error.message.trim()
          ? error.message
          : failedChallengeSyncLabel,
      );
    }
  };

  const handleFinishChallenge = async () => {
    if (!currentUserId || !resolvedFriendId || !matchWinnerUserIdForSession || !activeChallengeSessionId) {
      setSubmissionState('error');
      setSubmissionMessage(saveErrorFallbackLabel);
      return;
    }

    setSubmissionState('submitting');
    setSubmissionMessage(savingLabel);

    try {
      const response = await api.completeFriendChallenge({
        userId: currentUserId,
        friendId: resolvedFriendId,
        winnerUserId: matchWinnerUserIdForSession,
        challengeKey: currentChallengeKey,
        sessionId: activeChallengeSessionId,
        clientMatchId,
        rounds: isStrengthChallenge
          ? strengthRounds.map((round) => ({
            number: round.number,
            weightKg: round.weightKg,
            player1Result: round.player1Result,
            player2Result: round.player2Result,
            status: round.status,
          }))
          : pushUpRounds.map((round) => ({
            number: round.number,
            player1: round.player1,
            player2: round.player2,
            status: round.status,
          })),
      });

      const responseParticipants =
        response?.participants && typeof response.participants === 'object'
          ? response.participants as Record<string, any>
          : {};
      const currentUserParticipant = responseParticipants[String(currentUserId)] || null;
      const friendParticipant = responseParticipants[String(resolvedFriendId)] || null;
      const currentUserPointsAwarded = Number(
        currentUserParticipant?.pointsAwarded
          ?? response?.participantPoints?.[String(currentUserId)]
          ?? response?.participantPoints?.[currentUserId]
          ?? 0,
      );
      const friendPointsAwarded = Number(
        friendParticipant?.pointsAwarded
          ?? response?.participantPoints?.[String(resolvedFriendId)]
          ?? response?.participantPoints?.[resolvedFriendId]
          ?? 0,
      );

      if (currentUserParticipant && toPositiveInteger(currentUserParticipant.userId) === currentUserId) {
        persistStoredUser({
          ...(storedUser || {}),
          id: currentUserId,
          name: currentUserName,
          total_points: Number(currentUserParticipant.totalPoints || 0),
          rank: String(currentUserParticipant.rank || 'Bronze'),
        });
      }

      setSubmissionState('completed');
      setSubmissionMessage(
        response?.alreadyRecorded
          ? alreadySavedLabel()
          : currentUserPointsAwarded > 0
            ? saveSuccessYouLabel(currentUserPointsAwarded, resolvedFriendName, friendPointsAwarded)
            : saveSuccessFriendLabel(resolvedFriendName, friendPointsAwarded),
      );
      if (activeChallengeSessionId && matchWinnerUserIdForSession) {
        shownResultSessionsRef.current.add(`${activeChallengeSessionId}:${matchWinnerUserIdForSession}`);
      }
      setResultModal({
        didWin: matchWinnerUserIdForSession === currentUserId,
        challengeTitle: currentChallengeTitle,
        pointsAwarded: currentUserPointsAwarded,
      });
      setActiveChallengeSessionId(null);
      resetPushUpDuel(currentChallengeKey);
      setView('cards');
    } catch (error) {
      setSubmissionState('error');
      setSubmissionMessage(
        error instanceof Error && error.message.trim()
          ? error.message
          : saveErrorFallbackLabel,
      );
    }
  };

  const renderPushUpDuelScreen = () => (
    <div className="min-h-screen bg-background pb-20">
      <div className="px-4 pb-6 pt-4 sm:px-6">
        <button
          type="button"
          onClick={handleBack}
          className="inline-flex items-center gap-2 rounded-xl border border-white/12 bg-white/5 px-3 py-2 text-sm text-white transition-colors hover:bg-white/10"
        >
          <ArrowLeft size={16} />
          {copy.back}
        </button>

        <div className="mt-4 overflow-hidden rounded-[1.5rem] border border-white/12 bg-[radial-gradient(circle_at_top_right,rgba(187,255,92,0.12),transparent_22%),linear-gradient(160deg,rgba(18,23,31,0.98),rgba(11,15,22,0.98))] p-4 shadow-[0_20px_60px_rgba(0,0,0,0.24)] sm:p-5">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="inline-flex items-center gap-2 rounded-full border border-accent/20 bg-accent/10 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.16em] text-accent">
              <Trophy size={12} className="relative animate-bounce" />
              {copy.roundLabel(activeRound.number)}
            </div>
            <div className="rounded-full border border-white/12 bg-white/5 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.16em] text-white">
              {rewardBadgeLabel}
            </div>
          </div>

          <div className="mt-4 flex items-start justify-between gap-3">
            <div className="min-w-0">
              <h1 className="text-[1.8rem] font-black uppercase leading-[0.95] tracking-[0.04em] text-white sm:text-[2rem]">
                {currentChallengeTitle}
              </h1>
              <p className="mt-2 max-w-xl text-sm leading-relaxed text-text-secondary">
                {currentChallengeSubtitle}
              </p>
            </div>
            <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-[1rem] border border-white/12 bg-white/5 text-white">
              <Trophy size={32} className="relative animate-bounce" />
            </div>
          </div>

          {!activeChallengeSessionId ? (
            <div className="mt-4 rounded-[1.15rem] border border-white/10 bg-white/5 px-4 py-3 text-sm text-text-secondary">
              {noSessionYetLabel}
            </div>
          ) : null}

          {sessionMessage ? (
            <div className={`mt-4 rounded-[1.15rem] border px-4 py-3 text-sm ${
              sessionSyncState === 'error'
                ? 'border-red-400/25 bg-red-500/10 text-red-100'
                : 'border-white/10 bg-white/5 text-text-secondary'
            }`}>
              {sessionMessage}
            </div>
          ) : null}

          <div className="mt-4 grid grid-cols-2 gap-2.5">
            {([
              {
                key: 'player1' as const,
                label: copy.player1,
                name: player1DisplayName,
                total: totals.player1Reps,
                wins: totals.player1Wins,
                roundCount: activeRound.player1,
                isActive: activePlayer === 'player1',
                isWinner: challengeFinished && matchWinner === 'player1',
              },
              {
                key: 'player2' as const,
                label: copy.player2,
                name: player2DisplayName,
                total: totals.player2Reps,
                wins: totals.player2Wins,
                roundCount: activeRound.player2,
                isActive: activePlayer === 'player2',
                isWinner: challengeFinished && matchWinner === 'player2',
              },
            ]).map((player) => (
              <div
                key={player.key}
                className={`rounded-[1.05rem] border p-3 ${
                  player.isActive
                    ? 'border-accent/35 bg-accent/10'
                    : player.isWinner
                      ? 'border-accent/25 bg-accent/8'
                      : 'border-white/10 bg-white/[0.04]'
                }`}
              >
                <div className="min-w-0">
                  <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-text-secondary">{player.label}</p>
                  <p className="mt-1 truncate text-base font-black text-white">{player.name}</p>
                </div>
                <div className="mt-3 flex items-end justify-between gap-2">
                  <div>
                    <p className="text-[1.65rem] font-black leading-none text-white">{player.total}</p>
                    <p className="mt-1 text-xs text-text-secondary">{currentChallengeTotalLabel}</p>
                  </div>
                  <div className="text-right">
                    <p className="text-base font-black leading-none text-white">{player.roundCount}</p>
                    <p className="mt-1 text-xs text-text-secondary">{currentChallengeEntryLabel}</p>
                  </div>
                </div>
                <p className="mt-2.5 text-[10px] font-semibold uppercase tracking-[0.14em] text-accent">
                  {player.wins} {copy.roundsWon}
                </p>
              </div>
            ))}
          </div>

          <div className="mt-4 rounded-[1.35rem] border border-white/10 bg-black/20 p-4 sm:p-5">
            {activePlayer ? (
              canCountOwnTurn ? (
                <>
                  <div>
                    <div>
                      <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-accent">{roundReadyLabel}</p>
                      <h2 className="mt-2 text-xl font-black text-white">{copy.yourTurn(youLabel)}</h2>
                      <p className="mt-1 text-sm text-text-secondary">{youCanCountNowLabel}</p>
                    </div>
                  </div>

                  <div className="mt-4 grid grid-cols-[52px_1fr_52px] items-center gap-2.5">
                    <button
                      type="button"
                      onClick={() => changeRepCount(-currentChallengeStep)}
                      className="flex h-12 w-12 items-center justify-center rounded-[1rem] border border-white/12 bg-white/5 text-white transition-colors hover:bg-white/10 disabled:cursor-not-allowed disabled:opacity-60"
                      aria-label={copy.undo}
                      disabled={!canCountOwnTurn}
                    >
                      <Minus size={18} />
                    </button>

                    <div className="rounded-[1.2rem] border border-white/12 bg-white/5 px-4 py-4 text-center">
                      <div className="text-4xl font-black text-white">{displayedRoundCount}</div>
                      <div className="mt-1 text-xs uppercase tracking-[0.12em] text-text-secondary">{currentChallengeValueLabel}</div>
                    </div>

                    <button
                      type="button"
                      onClick={() => changeRepCount(currentChallengeStep)}
                      className="flex h-12 w-12 items-center justify-center rounded-[1rem] border border-accent/30 bg-accent text-black transition-colors hover:bg-accent/90 disabled:cursor-not-allowed disabled:opacity-60"
                      aria-label={copy.addRep}
                      disabled={!canCountOwnTurn}
                    >
                      <Plus size={18} />
                    </button>
                  </div>

                  <button
                    type="button"
                    onClick={() => void handleAdvanceTurn()}
                    className="mt-4 inline-flex w-full items-center justify-center gap-2 rounded-xl bg-white px-4 py-3.5 text-sm font-bold text-black transition-colors hover:bg-white/90 disabled:cursor-not-allowed disabled:opacity-60"
                    disabled={!canCountOwnTurn}
                  >
                    {sessionSyncState === 'saving' ? <LoaderCircle size={16} className="animate-spin" /> : null}
                    {saveMyResultLabel}
                  </button>
                </>
              ) : (
                <>
                  <div className="flex items-center justify-between gap-3">
                    <div>
                      <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-text-secondary">{copy.waiting}</p>
                      <h2 className="mt-2 text-xl font-black text-white">{waitForOtherPlayerLabel(getPlayerDisplayName(activePlayer, true))}</h2>
                    </div>
                    <div className="rounded-full border border-white/12 bg-white/5 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.15em] text-white">
                      {copy.active}
                    </div>
                  </div>
                  <p className="mt-2 text-sm text-text-secondary">{yourCountLockedLabel}</p>
                  <div className="mt-4 rounded-[1.1rem] border border-white/10 bg-white/[0.04] px-4 py-3">
                    <div className="text-xs uppercase tracking-[0.12em] text-text-secondary">{currentChallengeEntryLabel}</div>
                    <div className="mt-2 text-3xl font-black text-white">
                      {currentPlayer === 'player1' ? activeRound.player1 : activeRound.player2}
                    </div>
                  </div>
                </>
              )
            ) : (
              <>
                <div className="inline-flex items-center gap-2 rounded-full border border-accent/20 bg-accent/10 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.16em] text-accent">
                  <Trophy size={12} />
                  {challengeFinished ? challengeFinishedLabel : copy.complete}
                </div>
                <h2 className="mt-3 text-xl font-black text-white">{copy.roundWinner(activeRoundWinnerLabel)}</h2>
                <p className="mt-2 text-sm text-text-secondary">{copy.finalScore(activeRound.player1, activeRound.player2)}</p>

                <div className="mt-4 rounded-[1.1rem] border border-white/10 bg-white/[0.04] px-4 py-3">
                  <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-text-secondary">
                    {matchWinner ? rewardBadgeLabel : copy.tie}
                  </p>
                  <p className="mt-2 text-lg font-black text-white">
                    {matchWinner ? matchLeaderLabel(matchWinnerDisplayNameForSession) : needAnotherRoundLabel}
                  </p>
                  <p className="mt-2 text-sm text-text-secondary">
                    {matchWinner
                      ? `${copy.player1}: ${totals.player1Wins} | ${copy.player2}: ${totals.player2Wins}`
                      : challengeLockedLabel}
                  </p>
                  {!canManageChallenge ? (
                    <p className="mt-2 text-sm text-text-secondary">
                      {challengeFinished
                        ? senderCanManageLabel(player1DisplayName)
                        : senderControlsLabel(player1DisplayName)}
                    </p>
                  ) : null}
                </div>

                {submissionMessage ? (
                  <div className={`mt-4 rounded-[1.15rem] border px-4 py-3 text-sm ${
                    submissionState === 'error'
                      ? 'border-red-400/25 bg-red-500/10 text-red-100'
                      : submissionState === 'completed'
                        ? 'border-accent/20 bg-accent/10 text-white'
                        : 'border-white/10 bg-white/5 text-text-secondary'
                  }`}>
                    {submissionMessage}
                  </div>
                ) : null}

                <div className="mt-4 grid gap-3">
                  {submissionState !== 'completed' && canManageChallenge ? (
                    <button
                      type="button"
                      onClick={() => void handleAddRound()}
                      className="inline-flex w-full items-center justify-center gap-2 rounded-xl border border-accent/30 bg-accent px-4 py-3.5 text-sm font-bold text-black transition-colors hover:bg-accent/90 disabled:cursor-not-allowed disabled:opacity-60"
                      disabled={sessionSyncState === 'saving' || challengeFinished}
                    >
                      {sessionSyncState === 'saving' ? <LoaderCircle size={16} className="animate-spin" /> : null}
                      {copy.addRound}
                    </button>
                  ) : null}

                  {canFinishChallenge ? (
                    <button
                      type="button"
                      onClick={() => void handleFinishChallenge()}
                      className="inline-flex w-full items-center justify-center gap-2 rounded-xl bg-white px-4 py-3.5 text-sm font-bold text-black transition-colors hover:bg-white/90 disabled:cursor-not-allowed disabled:opacity-60"
                      disabled={submissionState === 'submitting'}
                    >
                      {submissionState === 'submitting' ? <LoaderCircle size={16} className="animate-spin" /> : null}
                      {finishChallengeLabel}
                    </button>
                  ) : null}
                </div>
              </>
            )}
          </div>
        </div>

        <div className="mt-4 rounded-[1.5rem] border border-white/10 bg-[linear-gradient(160deg,rgba(20,24,31,0.96),rgba(11,15,22,0.96))] p-4 sm:p-5">
          <h3 className="text-sm font-bold uppercase tracking-[0.16em] text-text-secondary">{copy.roundResults}</h3>

          <div className="mt-4 space-y-2.5">
            {pushUpRounds.map((round) => {
              const winner = getRoundWinner(round, currentChallengeKey);
              const winnerLabel =
                round.status !== 'complete'
                  ? round.status === 'player1'
                    ? copy.yourTurn(copy.player1)
                    : copy.yourTurn(copy.player2)
                  : winner === 'tie'
                    ? copy.tie
                    : winner === 'player1'
                      ? getPlayerDisplayName('player1', true)
                      : getPlayerDisplayName('player2', true);

              return (
                <div
                  key={round.number}
                  className="flex items-center justify-between gap-3 rounded-[1.15rem] border border-white/10 bg-white/[0.04] px-4 py-3"
                >
                  <div className="min-w-0">
                    <p className="text-sm font-bold text-white">{copy.roundLabel(round.number)}</p>
                    <p className="mt-1 text-xs text-text-secondary">
                      {round.status === 'complete' ? copy.roundWinner(winnerLabel) : winnerLabel}
                    </p>
                  </div>
                  <div className="text-sm font-semibold text-accent">
                    {round.player1} - {round.player2}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );

  const renderResultModal = () => {
    if (!resultModal) return null;

    return (
      <div className="fixed inset-0 z-[80] flex items-center justify-center bg-[rgba(3,6,10,0.74)] px-4 backdrop-blur-md">
        <div className="relative w-full max-w-sm overflow-hidden rounded-[1.9rem] border border-white/12 bg-[radial-gradient(circle_at_top,rgba(187,255,92,0.22),transparent_34%),linear-gradient(160deg,rgba(17,24,32,0.98),rgba(9,13,19,0.98))] p-6 text-center shadow-[0_28px_90px_rgba(0,0,0,0.42)]">
          <div className="pointer-events-none absolute inset-0 overflow-hidden">
            <span className={`absolute left-8 top-10 h-3 w-3 rounded-full ${resultModal.didWin ? 'bg-accent/80 animate-ping' : 'bg-sky-300/50 animate-pulse'}`} />
            <span className={`absolute right-10 top-16 h-2.5 w-2.5 rounded-full ${resultModal.didWin ? 'bg-yellow-300/70 animate-ping' : 'bg-white/25 animate-pulse'}`} />
            <span className={`absolute bottom-16 left-12 h-2 w-2 rounded-full ${resultModal.didWin ? 'bg-white/70 animate-pulse' : 'bg-accent/45 animate-pulse'}`} />
            <span className={`absolute bottom-12 right-12 h-4 w-4 rounded-full ${resultModal.didWin ? 'bg-accent/25 animate-pulse' : 'bg-sky-400/20 animate-pulse'}`} />
          </div>

          <div className={`relative mx-auto flex h-20 w-20 items-center justify-center rounded-full border ${
            resultModal.didWin
              ? 'border-accent/35 bg-accent/15 text-accent'
              : 'border-white/12 bg-white/8 text-sky-200'
          }`}>
            <div className={`absolute inset-0 rounded-full ${
              resultModal.didWin ? 'bg-accent/18 animate-ping' : 'bg-sky-300/10 animate-pulse'
            }`} />
            <Trophy size={32} className={`relative ${resultModal.didWin ? 'animate-bounce' : ''}`} />
          </div>

          <p className="mt-5 text-[11px] font-semibold uppercase tracking-[0.22em] text-text-secondary">
            {resultModal.challengeTitle}
          </p>
          <h2 className="mt-3 text-[2rem] font-black uppercase leading-none text-white">
            {resultModal.didWin ? resultWinTitle : resultLoseTitle}
          </h2>
          <p className="mt-3 text-sm leading-relaxed text-text-secondary">
            {resultModal.didWin ? resultWinBody : resultLoseBody}
          </p>

          <div className={`mt-5 rounded-[1.2rem] border px-4 py-3 ${
            resultModal.didWin
              ? 'border-accent/25 bg-accent/10 text-accent'
              : 'border-white/10 bg-white/5 text-white'
          }`}>
            <div className="text-[11px] font-semibold uppercase tracking-[0.18em] text-text-secondary">
              {rewardTitleLabel}
            </div>
            <div className="mt-1 text-xl font-black">
              {resultPointsLabel(resultModal.pointsAwarded)}
            </div>
          </div>

          <button
            type="button"
            onClick={() => setResultModal(null)}
            className="mt-6 inline-flex w-full items-center justify-center rounded-xl bg-white px-4 py-3.5 text-sm font-bold text-black transition-colors hover:bg-white/90"
          >
            {resultContinueLabel}
          </button>
        </div>
      </div>
    );
  };

  const renderSessionNoticeModal = () => {
    if (!sessionNoticeModal) return null;

    return (
      <div className="fixed inset-0 z-[85] flex items-center justify-center bg-[rgba(3,6,10,0.74)] px-4 backdrop-blur-md">
        <div className="relative w-full max-w-sm overflow-hidden rounded-[1.9rem] border border-white/12 bg-[radial-gradient(circle_at_top,rgba(248,113,113,0.18),transparent_34%),linear-gradient(160deg,rgba(17,24,32,0.98),rgba(9,13,19,0.98))] p-6 text-center shadow-[0_28px_90px_rgba(0,0,0,0.42)]">
          <div className="pointer-events-none absolute inset-0 overflow-hidden">
            <span className="absolute left-8 top-10 h-3 w-3 rounded-full bg-red-300/40 animate-pulse" />
            <span className="absolute right-10 top-16 h-2.5 w-2.5 rounded-full bg-white/20 animate-pulse" />
            <span className="absolute bottom-16 left-12 h-2 w-2 rounded-full bg-accent/35 animate-pulse" />
          </div>

          <div className="relative mx-auto flex h-20 w-20 items-center justify-center rounded-full border border-red-300/20 bg-red-400/10 text-red-100">
            <ArrowLeft size={28} />
          </div>

          <h2 className="mt-5 text-[1.8rem] font-black uppercase leading-none text-white">
            {sessionNoticeModal.title}
          </h2>
          <p className="mt-3 text-sm leading-relaxed text-text-secondary">
            {sessionNoticeModal.body}
          </p>

          <button
            type="button"
            onClick={exitChallengeToHome}
            className="mt-6 inline-flex w-full items-center justify-center rounded-xl bg-white px-4 py-3.5 text-sm font-bold text-black transition-colors hover:bg-white/90"
          >
            {returnHomeLabel}
          </button>
        </div>
      </div>
    );
  };

  const renderStrengthDuelScreen = () => {
    const strengthRoundWinnerLabel =
      strengthRoundWinner === 'tie'
        ? copy.tie
        : strengthRoundWinner === 'player1'
          ? getPlayerDisplayName('player1', true)
          : getPlayerDisplayName('player2', true);
    const displayedWeightKg = strengthActivePlayer === 'player1' && currentPlayer === 'player1'
      ? turnDraftWeightKg
      : Number(strengthActiveRound.weightKg || 0);
    const canAddStrengthRound =
      canManageChallenge
      && strengthActiveRound.status === 'complete'
      && !strengthMatchWinner
      && Boolean(activeChallengeSessionId)
      && !challengeFinished
      && submissionState !== 'submitting'
      && submissionState !== 'completed'
      && sessionSyncState !== 'saving';

    return (
      <div className="min-h-screen bg-background pb-20">
        <div className="px-4 pb-6 pt-4 sm:px-6">
          <button
            type="button"
            onClick={handleBack}
            className="inline-flex items-center gap-2 rounded-xl border border-white/12 bg-white/5 px-3 py-2 text-sm text-white transition-colors hover:bg-white/10"
          >
            <ArrowLeft size={16} />
            {copy.back}
          </button>

          <div className="mt-4 overflow-hidden rounded-[1.5rem] border border-white/12 bg-[radial-gradient(circle_at_top_right,rgba(34,211,238,0.15),transparent_24%),radial-gradient(circle_at_bottom_left,rgba(248,113,113,0.14),transparent_28%),linear-gradient(160deg,rgba(18,23,31,0.98),rgba(11,15,22,0.98))] p-4 shadow-[0_20px_60px_rgba(0,0,0,0.24)] sm:p-5">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="inline-flex items-center gap-2 rounded-full border border-accent/20 bg-accent/10 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.16em] text-accent">
                <Trophy size={12} className="relative animate-bounce" />
                {copy.roundLabel(strengthActiveRound.number)}
              </div>
              <div className="rounded-full border border-white/12 bg-white/5 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.16em] text-white">
                {strengthRewardBadgeLabel}
              </div>
            </div>

            <div className="mt-4 flex items-start justify-between gap-3">
              <div className="min-w-0">
                <h1 className="text-[1.8rem] font-black uppercase leading-[0.95] tracking-[0.04em] text-white sm:text-[2rem]">
                  {currentChallengeTitle}
                </h1>
                <p className="mt-2 max-w-xl text-sm leading-relaxed text-text-secondary">
                  {currentPlayer === 'player1'
                    ? 'Set the weight, attempt one rep, then pass the lift to your friend.'
                    : 'Your friend sets the weight. You only mark if you made the one rep or missed it.'}
                </p>
              </div>
              <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-[1rem] border border-white/12 bg-white/5 text-white">
                <Trophy size={32} className="relative animate-bounce" />
              </div>
            </div>

            {!activeChallengeSessionId ? (
              <div className="mt-4 rounded-[1.15rem] border border-white/10 bg-white/5 px-4 py-3 text-sm text-text-secondary">
                {noSessionYetLabel}
              </div>
            ) : null}

            {sessionMessage ? (
              <div className={`mt-4 rounded-[1.15rem] border px-4 py-3 text-sm ${
                sessionSyncState === 'error'
                  ? 'border-red-400/25 bg-red-500/10 text-red-100'
                  : 'border-white/10 bg-white/5 text-text-secondary'
              }`}>
                {sessionMessage}
              </div>
            ) : null}

            <div className="mt-4 grid grid-cols-2 gap-2.5">
              {([
                {
                  key: 'player1' as const,
                  label: copy.player1,
                  name: player1DisplayName,
                  bestWeight: strengthBestWeights.player1,
                  madeCount: strengthMadeCounts.player1,
                  result: strengthActiveRound.player1Result,
                  isActive: strengthActivePlayer === 'player1',
                  isWinner: challengeFinished && strengthMatchWinner === 'player1',
                },
                {
                  key: 'player2' as const,
                  label: copy.player2,
                  name: player2DisplayName,
                  bestWeight: strengthBestWeights.player2,
                  madeCount: strengthMadeCounts.player2,
                  result: strengthActiveRound.player2Result,
                  isActive: strengthActivePlayer === 'player2',
                  isWinner: challengeFinished && strengthMatchWinner === 'player2',
                },
              ]).map((player) => (
                <div
                  key={player.key}
                  className={`rounded-[1.05rem] border p-3 ${
                    player.isActive
                      ? 'border-accent/35 bg-accent/10'
                      : player.isWinner
                        ? 'border-accent/25 bg-accent/8'
                        : 'border-white/10 bg-white/[0.04]'
                  }`}
                >
                  <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-text-secondary">{player.label}</p>
                  <p className="mt-1 truncate text-base font-black text-white">{player.name}</p>
                  <div className="mt-3 flex items-end justify-between gap-2">
                    <div>
                      <p className="text-[1.5rem] font-black leading-none text-white">{player.bestWeight > 0 ? `${player.bestWeight}kg` : '0kg'}</p>
                      <p className="mt-1 text-xs text-text-secondary">{bestWeightLabel}</p>
                    </div>
                    <div className="text-right">
                      <p className="text-base font-black leading-none text-white">{player.madeCount}</p>
                      <p className="mt-1 text-xs text-text-secondary">{strengthMadeLabel}</p>
                    </div>
                  </div>
                  <p className="mt-2.5 text-[10px] font-semibold uppercase tracking-[0.14em] text-accent">
                    {player.result === 'made' ? resultMadeLabel : player.result === 'missed' ? resultMissedLabel : copy.waiting}
                  </p>
                </div>
              ))}
            </div>

            <div className="mt-4 rounded-[1.35rem] border border-white/10 bg-black/20 p-4 sm:p-5">
              {strengthActivePlayer ? (
                canCountOwnTurn ? (
                  <>
                    <div>
                      <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-accent">{targetWeightReadyLabel}</p>
                      <h2 className="mt-2 text-xl font-black text-white">{copy.yourTurn(youLabel)}</h2>
                      <p className="mt-1 text-sm text-text-secondary">
                        {currentPlayer === 'player1' ? setWeightPromptLabel : markLiftResultLabel}
                      </p>
                    </div>

                    <div className="mt-4 rounded-[1.2rem] border border-white/10 bg-white/[0.04] p-4">
                      <div className="flex items-center justify-between gap-3">
                        <div>
                          <div className="text-[11px] font-semibold uppercase tracking-[0.16em] text-text-secondary">{weightLabel}</div>
                          <div className="mt-2 text-4xl font-black text-white">{displayedWeightKg > 0 ? `${displayedWeightKg} kg` : '--'}</div>
                        </div>
                        {currentPlayer === 'player1' ? (
                          <div className="grid grid-cols-[46px_1fr_46px] items-center gap-2">
                            <button
                              type="button"
                              onClick={() => changeWeightKg(-currentChallengeStep)}
                              className="flex h-11 w-11 items-center justify-center rounded-[1rem] border border-white/12 bg-white/5 text-white transition-colors hover:bg-white/10"
                            >
                              <Minus size={18} />
                            </button>
                            <input
                              type="number"
                              min="0"
                              step={currentChallengeStep}
                              value={turnDraftWeightKg}
                              onChange={(event) => setTurnDraftWeightKg(Math.max(0, Number.parseFloat(event.target.value) || 0))}
                              className="w-full rounded-[1rem] border border-white/12 bg-black/20 px-3 py-3 text-center text-lg font-black text-white outline-none focus:border-accent/40"
                            />
                            <button
                              type="button"
                              onClick={() => changeWeightKg(currentChallengeStep)}
                              className="flex h-11 w-11 items-center justify-center rounded-[1rem] border border-accent/30 bg-accent text-black transition-colors hover:bg-accent/90"
                            >
                              <Plus size={18} />
                            </button>
                          </div>
                        ) : (
                          <div className="rounded-full border border-white/12 bg-white/5 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.15em] text-white">
                            {currentChallengeTitle}
                          </div>
                        )}
                      </div>
                    </div>

                    <div className="mt-4 grid grid-cols-2 gap-2">
                      <button
                        type="button"
                        onClick={() => void handleAdvanceTurn('made')}
                        disabled={!canCountOwnTurn || sessionSyncState === 'saving'}
                        className={`rounded-xl px-4 py-3 text-sm font-bold transition-colors ${
                          turnDraftOutcome === 'made'
                            ? 'bg-accent text-black'
                            : 'border border-white/12 bg-white/5 text-white hover:bg-white/10'
                        }`}
                      >
                        {strengthMadeLabel}
                      </button>
                      <button
                        type="button"
                        onClick={() => void handleAdvanceTurn('missed')}
                        disabled={!canCountOwnTurn || sessionSyncState === 'saving'}
                        className={`rounded-xl px-4 py-3 text-sm font-bold transition-colors ${
                          turnDraftOutcome === 'missed'
                            ? 'bg-red-400 text-black'
                            : 'border border-white/12 bg-white/5 text-white hover:bg-white/10'
                        }`}
                      >
                        {strengthMissedLabel}
                      </button>
                    </div>

                    <button
                      type="button"
                      onClick={() => void handleAdvanceTurn()}
                      className="mt-4 inline-flex w-full items-center justify-center gap-2 rounded-xl bg-white px-4 py-3.5 text-sm font-bold text-black transition-colors hover:bg-white/90 disabled:cursor-not-allowed disabled:opacity-60"
                      disabled={!canCountOwnTurn}
                    >
                      {sessionSyncState === 'saving' ? <LoaderCircle size={16} className="animate-spin" /> : null}
                      {currentPlayer === 'player1' ? lockWeightAndResultLabel : saveMyResultLabel}
                    </button>
                  </>
                ) : (
                  <>
                    <div className="flex items-center justify-between gap-3">
                      <div>
                        <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-text-secondary">{copy.waiting}</p>
                        <h2 className="mt-2 text-xl font-black text-white">{waitingForLiftLabel(getPlayerDisplayName(strengthActivePlayer, true))}</h2>
                      </div>
                      <div className="rounded-full border border-white/12 bg-white/5 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.15em] text-white">
                        {displayedWeightKg > 0 ? `${displayedWeightKg} kg` : '--'}
                      </div>
                    </div>
                    <p className="mt-2 text-sm text-text-secondary">{yourCountLockedLabel}</p>
                  </>
                )
              ) : (
                <>
                  <div className="inline-flex items-center gap-2 rounded-full border border-accent/20 bg-accent/10 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.16em] text-accent">
                    <Trophy size={12} />
                    {challengeFinished ? challengeFinishedLabel : copy.complete}
                  </div>
                  <h2 className="mt-3 text-xl font-black text-white">
                    {strengthMatchWinner ? `${strengthRoundWinnerLabel} owns this weight` : noStrengthWinnerYetLabel}
                  </h2>
                  <p className="mt-2 text-sm text-text-secondary">
                    {displayedWeightKg > 0 ? `${decidingWeightLabel}: ${displayedWeightKg} kg` : currentChallengeTitle}
                  </p>

                  <div className="mt-4 rounded-[1.1rem] border border-white/10 bg-white/[0.04] px-4 py-3">
                    <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-text-secondary">
                      {strengthMatchWinner ? strengthRewardBadgeLabel : copy.tie}
                    </p>
                    <p className="mt-2 text-lg font-black text-white">
                      {strengthMatchWinner ? matchLeaderLabel(matchWinnerDisplayNameForSession) : noStrengthWinnerYetLabel}
                    </p>
                    <p className="mt-2 text-sm text-text-secondary">
                      {strengthDecidingWeightKg > 0 ? `${decidingWeightLabel}: ${strengthDecidingWeightKg} kg` : challengeLockedLabel}
                    </p>
                    {!canManageChallenge ? (
                      <p className="mt-2 text-sm text-text-secondary">{senderControlsLabel(player1DisplayName)}</p>
                    ) : null}
                  </div>

                  {submissionMessage ? (
                    <div className={`mt-4 rounded-[1.15rem] border px-4 py-3 text-sm ${
                      submissionState === 'error'
                        ? 'border-red-400/25 bg-red-500/10 text-red-100'
                        : submissionState === 'completed'
                          ? 'border-accent/20 bg-accent/10 text-white'
                          : 'border-white/10 bg-white/5 text-text-secondary'
                    }`}>
                      {submissionMessage}
                    </div>
                  ) : null}

                  <div className="mt-4 grid gap-3">
                    {canAddStrengthRound ? (
                      <button
                        type="button"
                        onClick={() => void handleAddRound()}
                        className="inline-flex w-full items-center justify-center gap-2 rounded-xl border border-accent/30 bg-accent px-4 py-3.5 text-sm font-bold text-black transition-colors hover:bg-accent/90 disabled:cursor-not-allowed disabled:opacity-60"
                      >
                        {sessionSyncState === 'saving' ? <LoaderCircle size={16} className="animate-spin" /> : null}
                        {copy.addRound}
                      </button>
                    ) : null}

                    {canFinishChallenge ? (
                      <button
                        type="button"
                        onClick={() => void handleFinishChallenge()}
                        className="inline-flex w-full items-center justify-center gap-2 rounded-xl bg-white px-4 py-3.5 text-sm font-bold text-black transition-colors hover:bg-white/90 disabled:cursor-not-allowed disabled:opacity-60"
                        disabled={submissionState === 'submitting'}
                      >
                        {submissionState === 'submitting' ? <LoaderCircle size={16} className="animate-spin" /> : null}
                        {finishChallengeLabel}
                      </button>
                    ) : null}
                  </div>
                </>
              )}
            </div>
          </div>

          <div className="mt-4 rounded-[1.5rem] border border-white/10 bg-[linear-gradient(160deg,rgba(20,24,31,0.96),rgba(11,15,22,0.96))] p-4 sm:p-5">
            <h3 className="text-sm font-bold uppercase tracking-[0.16em] text-text-secondary">{copy.roundResults}</h3>

            <div className="mt-4 space-y-2.5">
              {strengthRounds.map((round) => {
                const winner = getStrengthRoundWinner(round);
                const winnerLabel =
                  round.status !== 'complete'
                    ? round.status === 'player1'
                      ? copy.yourTurn(copy.player1)
                      : copy.yourTurn(copy.player2)
                    : winner === 'tie'
                      ? copy.tie
                      : winner === 'player1'
                        ? getPlayerDisplayName('player1', true)
                        : getPlayerDisplayName('player2', true);

                return (
                  <div
                    key={round.number}
                    className="rounded-[1.15rem] border border-white/10 bg-white/[0.04] px-4 py-3"
                  >
                    <div className="flex items-center justify-between gap-3">
                      <div>
                        <p className="text-sm font-bold text-white">{copy.roundLabel(round.number)}</p>
                        <p className="mt-1 text-xs text-text-secondary">{winnerLabel}</p>
                      </div>
                      <div className="text-sm font-semibold text-accent">
                        {round.weightKg > 0 ? `${round.weightKg} kg` : '--'}
                      </div>
                    </div>
                    <div className="mt-3 grid grid-cols-2 gap-2 text-xs">
                      <div
                        className={`rounded-xl border px-3 py-2 ${
                          round.player1Result === 'made'
                            ? 'border-emerald-400/25 bg-emerald-500/10 text-emerald-100'
                            : round.player1Result === 'missed'
                              ? 'border-red-400/25 bg-red-500/10 text-red-100'
                              : 'border-white/8 bg-black/20 text-text-secondary'
                        }`}
                      >
                        <span className="block font-semibold text-white">{copy.player1}</span>
                        <span>{round.player1Result === 'made' ? resultMadeLabel : round.player1Result === 'missed' ? resultMissedLabel : copy.waiting}</span>
                      </div>
                      <div
                        className={`rounded-xl border px-3 py-2 ${
                          round.player2Result === 'made'
                            ? 'border-emerald-400/25 bg-emerald-500/10 text-emerald-100'
                            : round.player2Result === 'missed'
                              ? 'border-red-400/25 bg-red-500/10 text-red-100'
                              : 'border-white/8 bg-black/20 text-text-secondary'
                        }`}
                      >
                        <span className="block font-semibold text-white">{copy.player2}</span>
                        <span>{round.player2Result === 'made' ? resultMadeLabel : round.player2Result === 'missed' ? resultMissedLabel : copy.waiting}</span>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      </div>
    );
  };

  if (view === 'intro') {
    return (
      <>
        <div className="relative min-h-screen overflow-hidden bg-black">
          <img
            src={challengeHeroImage}
            alt={copy.imageAlt}
            className="absolute inset-0 h-full w-full object-cover"
          />
          <div className="absolute inset-0 bg-[linear-gradient(180deg,rgba(3,4,8,0.45)_0%,rgba(3,4,8,0.18)_30%,rgba(3,4,8,0.78)_100%)]" />

          <div className="relative flex min-h-screen flex-col px-4 pb-10 pt-6 sm:px-6">
            <button
              type="button"
              onClick={handleBack}
              className="inline-flex w-fit items-center gap-2 rounded-xl border border-white/15 bg-black/35 px-3 py-2 text-sm font-medium text-white backdrop-blur-sm transition-colors hover:bg-black/50"
            >
              <ArrowLeft size={16} />
              {copy.back}
            </button>

            <div className="mt-auto max-w-sm rounded-[1.75rem] border border-white/12 bg-black/35 p-5 backdrop-blur-md">
              <div className="inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/10 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.18em] text-white">
                <Trophy size={12} className="relative animate-bounce" />
                {copy.introEyebrow}
              </div>
              <h1 className="mt-4 text-3xl font-black uppercase tracking-[0.08em] text-white">
                {copy.introTitle}
              </h1>
              <p className="mt-2 text-sm leading-relaxed text-white/75">
                {copy.introBody}
              </p>
            </div>
          </div>
        </div>
        {renderResultModal()}
        {renderSessionNoticeModal()}
      </>
    );
  }

  if (view === 'numeric-duel') {
    return (
      <>
        {renderPushUpDuelScreen()}
        {renderResultModal()}
        {renderSessionNoticeModal()}
      </>
    );
  }
  if (view === 'weight-duel') {
    return (
      <>
        {renderStrengthDuelScreen()}
        {renderResultModal()}
        {renderSessionNoticeModal()}
      </>
    );
  }

  return (
    <>
      <div className="min-h-screen bg-background pb-24">
        <div className="px-4 pb-6 pt-4 sm:px-6">
          <button
            type="button"
            onClick={handleBack}
            className="inline-flex items-center gap-2 rounded-xl border border-white/12 bg-white/5 px-3 py-2 text-sm text-white transition-colors hover:bg-white/10"
          >
            <ArrowLeft size={16} />
            {copy.back}
          </button>

          <div className="mt-6 overflow-hidden rounded-[2rem] border border-white/12 bg-[radial-gradient(circle_at_top_right,rgba(187,255,92,0.14),transparent_26%),radial-gradient(circle_at_bottom_left,rgba(34,211,238,0.14),transparent_30%),linear-gradient(160deg,rgba(19,25,33,0.98),rgba(11,15,22,0.98))] p-5 shadow-[0_24px_80px_rgba(0,0,0,0.24)] sm:p-6">
            <div className="inline-flex items-center gap-2 rounded-full border border-accent/20 bg-accent/10 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.18em] text-accent">
              <Trophy size={12} className="relative animate-bounce" />
              {copy.badge}
            </div>

            <h1 className="mt-4 text-3xl font-black uppercase tracking-[0.06em] text-white">
              {copy.title}
            </h1>
            <p className="mt-2 max-w-xl text-sm leading-relaxed text-text-secondary">
              {copy.subtitle(resolvedFriendName)}
            </p>

            {inviteMessage ? (
              <div className={`mt-4 rounded-[1.3rem] border px-4 py-3 text-sm ${
                inviteState === 'error'
                  ? 'border-red-400/25 bg-red-500/10 text-red-100'
                  : inviteState === 'sending'
                    ? 'border-white/10 bg-white/5 text-text-secondary'
                    : 'border-accent/20 bg-accent/10 text-white'
              }`}>
                {inviteMessage}
              </div>
            ) : null}

            <div className="mt-6 grid gap-3">
              {CHALLENGE_CARDS.map((card) => (
                (() => {
                  const challengeKey = card.key;
                  const isCurrentInvite = activeInviteChallengeKey === challengeKey;
                  const isWaiting = isCurrentInvite && challengeAccessStatus === 'pending';
                  const isAccepted = isCurrentInvite && challengeAccessStatus === 'accepted';
                  const isCancelled = isCurrentInvite && challengeAccessStatus === 'cancelled';
                  const cardDisabled = !card.available || inviteState === 'sending' || isWaiting;
                  const cardSubtitle = !card.available
                    ? copy.lockedChallenge
                    : isWaiting
                    ? waitingForAcceptanceLabel(resolvedFriendName)
                    : isAccepted
                      ? startChallengeLabel
                      : isCancelled
                        ? inviteExpiredLabel
                      : copy.openChallenge;

                  return (
                    <button
                      key={card.id}
                      type="button"
                      onClick={() => handleSelectChallenge(card)}
                      disabled={cardDisabled}
                      className={`group relative min-h-[154px] overflow-hidden rounded-[1.5rem] border border-white/12 bg-white/[0.04] p-4 text-left transition-all duration-200 ${
                        !cardDisabled
                          ? 'hover:-translate-y-0.5 hover:border-white/20 hover:bg-white/[0.06]'
                          : 'cursor-default opacity-85'
                      }`}
                    >
                      <img
                        src={card.image}
                        alt={card.title}
                        className="pointer-events-none absolute inset-0 h-full w-full object-cover transition-transform duration-300 group-hover:scale-105"
                      />
                      <div className="pointer-events-none absolute inset-0 bg-[linear-gradient(135deg,rgba(4,6,10,0.22),rgba(4,6,10,0.6)_48%,rgba(4,6,10,0.88)_100%)]" />
                      <div className={`pointer-events-none absolute inset-0 bg-gradient-to-br ${card.accentClassName}`} />
                      <div className="relative flex min-h-[122px] items-end justify-between gap-4">
                        <div>
                          <p className="text-lg font-bold text-white drop-shadow-[0_6px_20px_rgba(0,0,0,0.65)]">{card.title}</p>
                          <p className="mt-1 text-sm text-white/75">
                            {cardSubtitle}
                          </p>
                        </div>
                        <div className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl border border-white/12 text-white backdrop-blur-sm transition-transform duration-200 ${
                          !cardDisabled ? 'bg-black/35 group-hover:translate-x-0.5' : 'bg-black/20'
                        }`}>
                          {inviteState === 'sending' && isCurrentInvite
                            ? <LoaderCircle size={18} className="animate-spin" />
                            : isWaiting
                              ? <LoaderCircle size={18} className="animate-spin" />
                              : <ChevronRight size={18} />}
                        </div>
                      </div>
                    </button>
                  );
                })()
              ))}
            </div>
          </div>
        </div>
      </div>
      {renderResultModal()}
      {renderSessionNoticeModal()}
    </>
  );
}
