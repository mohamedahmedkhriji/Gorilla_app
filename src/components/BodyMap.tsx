import { useEffect, useState } from 'react';
import {
  BODY_MAP_INERT,
  BODY_MAP_MUSCLE_NAME,
  BODY_MAP_MUSCLES,
  type BodyMapLevels,
  type BodyMapMuscle,
} from '../lib/muscle-map';
import {
  BODY_MAP_BODY_PREFERENCE_CHANGED_EVENT,
  resolveBodyMapBody,
  resolvePreferredBodyMapBody,
} from '../lib/body-map-body';
import { getStoredAppUser, STORED_USER_CHANGED_EVENT } from '../shared/authStorage';

export type BodyPathView = {
  vb: string;
  p: Record<string, string[]>;
};

export type BodyPaths = Record<string, Record<'front' | 'back', BodyPathView>>;

type BodyMapProps = {
  body?: string;
  className?: string;
  levels?: BodyMapLevels;
  onMuscle?: (muscle: BodyMapMuscle) => void;
  selected?: BodyMapMuscle | null;
};

const getStoredBodyMapBody = () => resolvePreferredBodyMapBody(getStoredAppUser()?.gender);

let cache: BodyPaths | null = null;
let pending: Promise<BodyPaths> | null = null;

export function useBodyPaths() {
  const [paths, setPaths] = useState<BodyPaths | null>(cache);

  useEffect(() => {
    if (cache) return undefined;

    let alive = true;
    pending = pending || import('../lib/body-paths.js').then((module) => {
      cache = module.default as BodyPaths;
      return cache;
    });

    pending.then((nextPaths) => {
      if (alive) setPaths(nextPaths);
    }).catch(() => undefined);

    return () => {
      alive = false;
    };
  }, []);

  return paths;
}

function BodyMapView({
  view,
  levels,
  onMuscle,
  selected,
}: {
  view: BodyPathView;
  levels: BodyMapLevels;
  onMuscle?: (muscle: BodyMapMuscle) => void;
  selected?: BodyMapMuscle | null;
}) {
  return (
    <svg className="bm-v" viewBox={view.vb} role="img" aria-hidden={!onMuscle}>
      {BODY_MAP_INERT.map((slug) => (view.p[slug] || []).map((d, index) => (
        <path key={`${slug}-${index}`} className="bm-sil" d={d} />
      )))}
      {BODY_MAP_MUSCLES.map((slug) => (view.p[slug] || []).map((d, index) => (
        <path
          key={`${slug}-${index}`}
          className={`bm-m l${levels[slug] || 0}${selected === slug ? ' sel' : ''}`}
          d={d}
          onClick={onMuscle ? () => onMuscle(slug) : undefined}
        >
          <title>{BODY_MAP_MUSCLE_NAME[slug]}</title>
        </path>
      )))}
    </svg>
  );
}

export default function BodyMap({
  body,
  className = '',
  levels = {},
  onMuscle,
  selected = null,
}: BodyMapProps) {
  const paths = useBodyPaths();
  const [storedBody, setStoredBody] = useState(() => getStoredBodyMapBody());
  const resolvedBody = body ? resolveBodyMapBody(body) : storedBody;
  const geometry = paths && (paths[resolvedBody] || paths.male);
  const tappableClass = onMuscle ? ' tappable' : '';

  useEffect(() => {
    if (body) return undefined;

    const syncStoredBody = () => {
      setStoredBody(getStoredBodyMapBody());
    };

    syncStoredBody();
    window.addEventListener('storage', syncStoredBody);
    window.addEventListener(STORED_USER_CHANGED_EVENT, syncStoredBody);
    window.addEventListener(BODY_MAP_BODY_PREFERENCE_CHANGED_EVENT, syncStoredBody);

    return () => {
      window.removeEventListener('storage', syncStoredBody);
      window.removeEventListener(STORED_USER_CHANGED_EVENT, syncStoredBody);
      window.removeEventListener(BODY_MAP_BODY_PREFERENCE_CHANGED_EVENT, syncStoredBody);
    };
  }, [body]);

  return (
    <div className={`bodymap${tappableClass} ${className}`}>
      {geometry ? (
        <>
          <div className="bm-panel">
            <BodyMapView view={geometry.front} levels={levels} onMuscle={onMuscle} selected={selected} />
            <span className="bm-label">Front</span>
          </div>
          <div className="bm-panel">
            <BodyMapView view={geometry.back} levels={levels} onMuscle={onMuscle} selected={selected} />
            <span className="bm-label">Back</span>
          </div>
        </>
      ) : (
        <div className="bm-ph" aria-hidden="true" />
      )}
    </div>
  );
}
