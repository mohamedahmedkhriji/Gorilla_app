import { getStoredAppUser } from '../shared/authStorage';

export const HOME_COACHMARK_TOUR_ID = 'home_onboarding';
export const HOME_COACHMARK_VERSION = 1;
export const PROGRESS_COACHMARK_TOUR_ID = 'progress_onboarding';
export const PROGRESS_COACHMARK_VERSION = 1;
export const PROFILE_COACHMARK_TOUR_ID = 'profile_onboarding';
export const PROFILE_COACHMARK_VERSION = 1;
export const WORKOUT_PLAN_COACHMARK_TOUR_ID = 'workout_plan_onboarding';
export const WORKOUT_PLAN_COACHMARK_VERSION = 2;
export const WORKOUT_TRACKER_COACHMARK_TOUR_ID = 'workout_tracker_onboarding';
export const WORKOUT_TRACKER_COACHMARK_VERSION = 2;

type CoachmarkUser = Record<string, unknown> & {
  id?: number | string;
  email?: string;
  phone?: string;
  name?: string;
};

export interface CoachmarkProgress {
  tourId: string;
  version: number;
  completed: boolean;
  dismissed: boolean;
  currentStep: number;
  seenSteps: Record<string, boolean>;
  visitCount: number;
  updatedAt: string | null;
}

interface CoachmarkStorageOptions {
  tourId: string;
  version: number;
  userScope?: string;
  defaultSeenSteps?: Record<string, boolean>;
}

const STORAGE_PREFIX = 'coachmarks';

const toScopePart = (value: unknown) =>
  String(value || '')
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9._-]+/g, '_');

export const getCoachmarkUserScope = (user: CoachmarkUser | null = getStoredAppUser()) => {
  const userId = Number(user?.id || 0);
  if (Number.isInteger(userId) && userId > 0) return `id_${userId}`;

  const email = toScopePart(user?.email);
  if (email) return `email_${email}`;

  const phone = toScopePart(user?.phone);
  if (phone) return `phone_${phone}`;

  const name = toScopePart(user?.name);
  if (name) return `name_${name}`;

  return 'guest';
};

const getStorageKey = ({ tourId, userScope = getCoachmarkUserScope() }: Pick<CoachmarkStorageOptions, 'tourId' | 'userScope'>) =>
  `${STORAGE_PREFIX}:${tourId}:${userScope}`;

const createBaseProgress = ({
  tourId,
  version,
  defaultSeenSteps = {},
}: Pick<CoachmarkStorageOptions, 'tourId' | 'version' | 'defaultSeenSteps'>): CoachmarkProgress => ({
  tourId,
  version,
  completed: false,
  dismissed: false,
  currentStep: 0,
  seenSteps: { ...defaultSeenSteps },
  visitCount: 0,
  updatedAt: null,
});

const sanitizeSeenSteps = (
  seenSteps: unknown,
  defaultSeenSteps: Record<string, boolean>,
) => {
  const next = { ...defaultSeenSteps };
  if (!seenSteps || typeof seenSteps !== 'object') return next;

  Object.entries(seenSteps as Record<string, unknown>).forEach(([key, value]) => {
    next[key] = Boolean(value);
  });

  return next;
};

export const readCoachmarkProgress = ({
  tourId,
  version,
  userScope,
  defaultSeenSteps = {},
}: CoachmarkStorageOptions): CoachmarkProgress => {
  if (typeof window === 'undefined') {
    return createBaseProgress({ tourId, version, defaultSeenSteps });
  }

  const fallback = createBaseProgress({ tourId, version, defaultSeenSteps });

  try {
    const raw = window.localStorage.getItem(getStorageKey({ tourId, userScope }));
    if (!raw) return fallback;

    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== 'object') return fallback;

    const storedVersion = Number((parsed as Record<string, unknown>).version || 0);
    if (storedVersion !== version) return fallback;

    return {
      tourId,
      version,
      completed: Boolean((parsed as Record<string, unknown>).completed),
      dismissed: Boolean((parsed as Record<string, unknown>).dismissed),
      currentStep: Math.max(0, Number((parsed as Record<string, unknown>).currentStep || 0)),
      seenSteps: sanitizeSeenSteps((parsed as Record<string, unknown>).seenSteps, defaultSeenSteps),
      visitCount: Math.max(0, Number((parsed as Record<string, unknown>).visitCount || 0)),
      updatedAt: typeof (parsed as Record<string, unknown>).updatedAt === 'string'
        ? String((parsed as Record<string, unknown>).updatedAt)
        : null,
    };
  } catch {
    return fallback;
  }
};

export const writeCoachmarkProgress = (
  options: CoachmarkStorageOptions,
  nextProgress: CoachmarkProgress,
) => {
  if (typeof window === 'undefined') return nextProgress;

  const normalized: CoachmarkProgress = {
    ...nextProgress,
    tourId: options.tourId,
    version: options.version,
    currentStep: Math.max(0, Number(nextProgress.currentStep || 0)),
    seenSteps: sanitizeSeenSteps(nextProgress.seenSteps, options.defaultSeenSteps || {}),
    visitCount: Math.max(0, Number(nextProgress.visitCount || 0)),
    updatedAt: new Date().toISOString(),
  };

  window.localStorage.setItem(
    getStorageKey({ tourId: options.tourId, userScope: options.userScope }),
    JSON.stringify(normalized),
  );

  return normalized;
};

export const patchCoachmarkProgress = (
  options: CoachmarkStorageOptions,
  patch: Partial<CoachmarkProgress> | ((current: CoachmarkProgress) => Partial<CoachmarkProgress>),
) => {
  const current = readCoachmarkProgress(options);
  const partial = typeof patch === 'function' ? patch(current) : patch;
  return writeCoachmarkProgress(options, { ...current, ...partial });
};

export const incrementCoachmarkVisitCount = (options: CoachmarkStorageOptions) =>
  patchCoachmarkProgress(options, (current) => ({
    visitCount: current.visitCount + 1,
  }));

export const resetCoachmarkProgress = (options: CoachmarkStorageOptions) =>
  writeCoachmarkProgress(
    options,
    createBaseProgress({
      tourId: options.tourId,
      version: options.version,
      defaultSeenSteps: options.defaultSeenSteps,
    }),
  );
