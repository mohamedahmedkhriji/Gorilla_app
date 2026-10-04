import React, { useEffect, useRef, useState } from 'react';
import { api } from '../../services/api';
import { getMissionBadgeImage } from '../../services/badgeTheme';
import { playBadgeCelebrationSound } from '../../services/appSounds';
import { getStoredUserId } from '../../shared/authStorage';

type BadgeCelebrationItem = {
  key: string;
  title: string;
  description: string;
  kind: 'mission' | 'challenge';
  points: number;
  badgeImage: string;
};

type CompletionSourceItem = {
  id?: unknown;
  mission_id?: unknown;
  challenge_template_id?: unknown;
  title?: unknown;
  description?: unknown;
  metric_key?: unknown;
  mission_type?: unknown;
  challenge_type?: unknown;
  category?: unknown;
  target?: unknown;
  target_value?: unknown;
  points_reward?: unknown;
  completed?: unknown;
  status?: unknown;
};

const CELEBRATION_DURATION_MS = 4600;
const CONFETTI_COUNT = 28;

const normalizeText = (value: unknown) => String(value || '').trim();

const getCompletionId = (kind: 'mission' | 'challenge', item: CompletionSourceItem) => {
  const id = normalizeText(item.id || item.mission_id || item.challenge_template_id);
  const title = normalizeText(item.title).toLowerCase();
  return `${kind}:${id || title || Date.now()}`;
};

const isCompleted = (item: CompletionSourceItem) =>
  item.completed === true || normalizeText(item.status).toLowerCase() === 'completed';

const toItemList = (value: unknown): CompletionSourceItem[] => {
  if (Array.isArray(value)) return value as CompletionSourceItem[];
  if (!value || typeof value !== 'object') return [];

  const entry = value as Record<string, unknown>;
  return [
    ...(Array.isArray(entry.daily) ? entry.daily : []),
    ...(Array.isArray(entry.weekly) ? entry.weekly : []),
    ...(Array.isArray(entry.items) ? entry.items : []),
  ] as CompletionSourceItem[];
};

const toCelebrationItem = (kind: 'mission' | 'challenge', item: CompletionSourceItem): BadgeCelebrationItem | null => {
  const title = normalizeText(item.title) || (kind === 'mission' ? 'Mission completed' : 'Challenge completed');
  const description = normalizeText(item.description);
  const target = Number(item.target || item.target_value || 0);
  const key = getCompletionId(kind, item);

  return {
    key,
    title,
    description,
    kind,
    points: Number(item.points_reward || 0),
    badgeImage: getMissionBadgeImage({
      title,
      description,
      metricKey: item.metric_key,
      target,
      completed: true,
      type: kind === 'mission' ? item.mission_type : item.challenge_type,
      category: item.category,
    }),
  };
};

const readSeenKeys = (userId: number) => {
  try {
    const raw = localStorage.getItem(`badgeCelebrationsSeen:${userId}`);
    const parsed = raw ? JSON.parse(raw) : [];
    return new Set(Array.isArray(parsed) ? parsed.map((item) => String(item)) : []);
  } catch {
    return new Set<string>();
  }
};

const writeSeenKeys = (userId: number, keys: Set<string>) => {
  try {
    localStorage.setItem(`badgeCelebrationsSeen:${userId}`, JSON.stringify(Array.from(keys).slice(-300)));
  } catch {
    // Ignore storage failures; the celebration should still run.
  }
};

export function BadgeCelebrationOverlay() {
  const [activeItem, setActiveItem] = useState<BadgeCelebrationItem | null>(null);
  const [queue, setQueue] = useState<BadgeCelebrationItem[]>([]);
  const seenKeysRef = useRef<Set<string>>(new Set());
  const baselineReadyRef = useRef(false);
  const userIdRef = useRef(0);

  useEffect(() => {
    const userId = getStoredUserId();
    userIdRef.current = userId;
    seenKeysRef.current = userId ? readSeenKeys(userId) : new Set();

    if (!userId) {
      baselineReadyRef.current = true;
      return undefined;
    }

    let cancelled = false;

    const seedCompletedItems = async () => {
      try {
        const [missions, challenges] = await Promise.all([
          api.getUserMissions(userId),
          api.getUserChallenges(userId),
        ]);
        if (cancelled) return;

        const nextSeen = new Set(seenKeysRef.current);
        toItemList(missions)
          .filter(isCompleted)
          .forEach((mission) => nextSeen.add(getCompletionId('mission', mission)));
        toItemList(challenges)
          .filter(isCompleted)
          .forEach((challenge) => nextSeen.add(getCompletionId('challenge', challenge)));

        seenKeysRef.current = nextSeen;
        writeSeenKeys(userId, nextSeen);
      } catch {
        // If the baseline fetch fails, future explicit completion deltas can still celebrate.
      } finally {
        if (!cancelled) baselineReadyRef.current = true;
      }
    };

    void seedCompletedItems();

    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (activeItem || queue.length === 0) return undefined;

    const [nextItem, ...remaining] = queue;
    setQueue(remaining);
    setActiveItem(nextItem);
    playBadgeCelebrationSound();

    const timer = window.setTimeout(() => {
      setActiveItem(null);
    }, CELEBRATION_DURATION_MS);

    return () => window.clearTimeout(timer);
  }, [activeItem, queue]);

  useEffect(() => {
    const enqueueItems = (items: BadgeCelebrationItem[]) => {
      const userId = userIdRef.current || getStoredUserId();
      if (!userId || items.length === 0) return;

      const seen = new Set(seenKeysRef.current);
      const fresh = items.filter((item) => {
        if (seen.has(item.key)) return false;
        seen.add(item.key);
        return true;
      });

      if (fresh.length === 0) return;
      seenKeysRef.current = seen;
      writeSeenKeys(userId, seen);
      setQueue((current) => [...current, ...fresh]);
    };

    const enqueueFromDelta = (delta: Record<string, unknown> | null | undefined) => {
      if (!delta) return false;
      const completedMissions = Array.isArray(delta.completedMissions) ? delta.completedMissions : [];
      const completedChallenges = Array.isArray(delta.completedChallenges) ? delta.completedChallenges : [];
      const items = [
        ...completedMissions.map((mission) => toCelebrationItem('mission', mission as CompletionSourceItem)),
        ...completedChallenges.map((challenge) => toCelebrationItem('challenge', challenge as CompletionSourceItem)),
      ].filter((item): item is BadgeCelebrationItem => Boolean(item));

      enqueueItems(items);
      return items.length > 0;
    };

    const fetchAndCompare = async () => {
      const userId = userIdRef.current || getStoredUserId();
      if (!userId || !baselineReadyRef.current) return;

      try {
        const [missions, challenges] = await Promise.all([
          api.getUserMissions(userId),
          api.getUserChallenges(userId),
        ]);
        const items = [
          ...toItemList(missions)
            .filter(isCompleted)
            .map((mission) => toCelebrationItem('mission', mission)),
          ...toItemList(challenges)
            .filter(isCompleted)
            .map((challenge) => toCelebrationItem('challenge', challenge)),
        ].filter((item): item is BadgeCelebrationItem => Boolean(item));

        enqueueItems(items);
      } catch (error) {
        console.error('Failed to check badge celebrations:', error);
      }
    };

    const handleGamificationUpdated = (event: Event) => {
      const detail = (event as CustomEvent<{ delta?: Record<string, unknown> | null }>).detail;
      const usedDelta = enqueueFromDelta(detail?.delta || null);
      if (!usedDelta) void fetchAndCompare();
    };

    window.addEventListener('gamification-updated', handleGamificationUpdated);
    window.addEventListener('focus', fetchAndCompare);
    return () => {
      window.removeEventListener('gamification-updated', handleGamificationUpdated);
      window.removeEventListener('focus', fetchAndCompare);
    };
  }, []);

  if (!activeItem) return null;

  return (
    <div className="badge-celebration-overlay" role="status" aria-live="polite">
      <div className="badge-celebration-burst" aria-hidden="true">
        {Array.from({ length: CONFETTI_COUNT }).map((_, index) => (
          <span key={index} className="badge-celebration-confetti" />
        ))}
      </div>

      <div className="badge-celebration-card">
        <div className="badge-celebration-glow" aria-hidden="true" />
        <div className="badge-celebration-stage" aria-hidden="true">
          <img src={activeItem.badgeImage} alt="" className="badge-celebration-badge" />
        </div>
        <p className="badge-celebration-kicker">
          {activeItem.kind === 'mission' ? 'Mission Complete' : 'Challenge Complete'}
        </p>
        <h2 className="badge-celebration-title">{activeItem.title}</h2>
        {activeItem.description ? <p className="badge-celebration-description">{activeItem.description}</p> : null}
        {activeItem.points > 0 ? <p className="badge-celebration-points">+{activeItem.points} points</p> : null}
      </div>
    </div>
  );
}
