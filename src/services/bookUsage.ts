import { getStoredUserId } from '../shared/authStorage';

export type BookId = 'tank-1' | 't-2' | 't-2-bulk';

type BookUsageRecord = {
  appliedCount: number;
  lastAppliedAt: string | null;
};

export type BookUsageMap = Record<BookId, BookUsageRecord>;

export const BOOK_USAGE_UPDATED_EVENT = 'book-usage-updated';

const STORAGE_KEY_PREFIX = 'bookUsageStats';

const EMPTY_RECORD: BookUsageRecord = {
  appliedCount: 0,
  lastAppliedAt: null,
};

const createEmptyUsage = (): BookUsageMap => ({
  'tank-1': { ...EMPTY_RECORD },
  't-2': { ...EMPTY_RECORD },
  't-2-bulk': { ...EMPTY_RECORD },
});

const hasWindow = () => typeof window !== 'undefined' && typeof window.localStorage !== 'undefined';

const getScope = (userId?: number | null) => {
  const resolvedUserId = Number(userId || getStoredUserId() || 0);
  return resolvedUserId > 0 ? String(resolvedUserId) : 'guest';
};

const getStorageKey = (userId?: number | null) => `${STORAGE_KEY_PREFIX}:${getScope(userId)}`;

const normalizeRecord = (value: unknown): BookUsageRecord => {
  const parsed = value && typeof value === 'object' ? (value as Partial<BookUsageRecord>) : {};
  return {
    appliedCount: Number(parsed.appliedCount || 0),
    lastAppliedAt: typeof parsed.lastAppliedAt === 'string' ? parsed.lastAppliedAt : null,
  };
};

export const readBookUsage = (userId?: number | null): BookUsageMap => {
  if (!hasWindow()) return createEmptyUsage();

  try {
    const raw = window.localStorage.getItem(getStorageKey(userId));
    if (!raw) return createEmptyUsage();

    const parsed = JSON.parse(raw) as Partial<Record<BookId, BookUsageRecord>>;
    return {
      'tank-1': normalizeRecord(parsed?.['tank-1']),
      't-2': normalizeRecord(parsed?.['t-2']),
      't-2-bulk': normalizeRecord(parsed?.['t-2-bulk']),
    };
  } catch {
    return createEmptyUsage();
  }
};

const persistBookUsage = (usage: BookUsageMap, userId?: number | null) => {
  if (!hasWindow()) return;

  const scope = getScope(userId);
  window.localStorage.setItem(getStorageKey(userId), JSON.stringify(usage));
  window.dispatchEvent(new CustomEvent(BOOK_USAGE_UPDATED_EVENT, {
    detail: {
      scope,
      usage,
    },
  }));
};

export const recordBookApplied = (bookId: BookId, userId?: number | null) => {
  const usage = readBookUsage(userId);
  const current = usage[bookId] || EMPTY_RECORD;

  persistBookUsage({
    ...usage,
    [bookId]: {
      appliedCount: Number(current.appliedCount || 0) + 1,
      lastAppliedAt: new Date().toISOString(),
    },
  }, userId);
};
