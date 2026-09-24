import { memo, useEffect, useState } from 'react';
import { useBodyPaths, type BodyPathView } from '../BodyMap';
import {
  BODY_MAP_INERT,
  BODY_MAP_MUSCLES,
  type BodyMapMuscle,
  recoveryMuscleToBodyMapSlugs,
} from '../../lib/muscle-map';
import {
  BODY_MAP_BODY_PREFERENCE_CHANGED_EVENT,
  resolveBodyMapBody,
  resolvePreferredBodyMapBody,
  type BodyMapBody,
} from '../../lib/body-map-body';
import { getStoredAppUser, STORED_USER_CHANGED_EVENT } from '../../shared/authStorage';

export type MuscleThumbnail = {
  label: string;
  sourceName: string;
};

type MuscleSvgBadgeAlign = 'left' | 'center' | 'right';

const getLabelAlignClass = (align: MuscleSvgBadgeAlign) => {
  if (align === 'center') return 'text-center';
  if (align === 'right') return 'text-right';
  return 'text-left';
};

const countMusclePaths = (view: BodyPathView, slugs: BodyMapMuscle[]) =>
  slugs.reduce((total, slug) => total + (view.p[slug] || []).length, 0);

const getStoredBodyMapBody = () => resolvePreferredBodyMapBody(getStoredAppUser()?.gender);

const getMuscleBadgeViewBox = (view: BodyPathView, slugs: BodyMapMuscle[]) => {
  const [baseX, baseY, baseWidth] = view.vb.split(/\s+/).map(Number);
  const x = Number.isFinite(baseX) ? baseX : 0;
  const y = Number.isFinite(baseY) ? baseY : 95;
  const width = Number.isFinite(baseWidth) ? baseWidth : 727;
  const isLowerBody = slugs.some((slug) => [
    'gluteal',
    'quadriceps',
    'hamstring',
    'adductors',
    'hip-flexors',
    'calves',
    'tibialis',
  ].includes(slug));
  const cropX = x + width * 0.13;
  const cropWidth = width * 0.74;
  const cropY = isLowerBody ? y + 430 : y + 42;
  const cropHeight = isLowerBody ? 670 : 520;
  return `${cropX} ${cropY} ${cropWidth} ${cropHeight}`;
};

export const MuscleSvgBadge = memo(function MuscleSvgBadge({
  muscle,
  align = 'left',
  className = 'w-[88px]',
  figureClassName = 'h-[72px]',
  showLabel = true,
  body,
  variant = 'card',
  themeVariant = 'default',
}: {
  muscle: MuscleThumbnail;
  align?: MuscleSvgBadgeAlign;
  className?: string;
  figureClassName?: string;
  showLabel?: boolean;
  body?: BodyMapBody | string;
  variant?: 'card' | 'bare';
  themeVariant?: 'default' | 'girls';
}) {
  const paths = useBodyPaths();
  const [storedBody, setStoredBody] = useState<BodyMapBody>(() => getStoredBodyMapBody());
  const slugs = recoveryMuscleToBodyMapSlugs(muscle.sourceName);
  const resolvedBody = body ? resolveBodyMapBody(body) : storedBody;
  const geometry = paths?.[resolvedBody] || paths?.male;

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

  const isGirlsTheme = themeVariant === 'girls';
  const shellClassName = variant === 'bare'
    ? `${className} overflow-hidden`
    : `${className} overflow-hidden rounded-2xl border p-2 ${
      isGirlsTheme
        ? 'border-[#E2B4BD]/45 bg-white/[0.70] shadow-[0_12px_28px_rgba(226,180,189,0.12)]'
        : 'border-white/10 bg-white/[0.035]'
    }`;
  const figureShellClassName = variant === 'bare'
    ? `h-full w-full overflow-hidden ${isGirlsTheme ? 'bg-white/55' : 'bg-background/70'}`
    : `overflow-hidden rounded-xl border ${isGirlsTheme ? 'border-[#E2B4BD]/35 bg-white/55' : 'border-white/10 bg-background/70'}`;
  const labelClassName = isGirlsTheme ? 'text-[#795E67]' : 'text-text-secondary';

  if (!geometry || slugs.length === 0) {
    return (
      <div
        className={shellClassName}
        title={muscle.label}
        aria-label={muscle.label}
      >
        <div className={`${figureClassName} flex items-center justify-center rounded-xl ${isGirlsTheme ? 'bg-white/55 text-[#795E67]' : 'bg-background/70 text-text-secondary'} text-[11px] font-semibold uppercase`}>
          {muscle.label.slice(0, 2)}
        </div>
        {showLabel && (
          <div className={`mt-2 truncate text-xs font-semibold ${labelClassName} ${getLabelAlignClass(align)}`}>{muscle.label}</div>
        )}
      </div>
    );
  }

  const view = countMusclePaths(geometry.back, slugs) > countMusclePaths(geometry.front, slugs)
    ? geometry.back
    : geometry.front;
  const selected = new Set<BodyMapMuscle>(slugs);

  return (
    <div
      className={shellClassName}
      title={muscle.label}
      aria-label={muscle.label}
      role="img"
    >
      <div className={figureShellClassName}>
        <svg className={`${figureClassName} w-full`} viewBox={getMuscleBadgeViewBox(view, slugs)} aria-hidden="true" focusable="false">
          {BODY_MAP_INERT.map((slug) => (view.p[slug] || []).map((d, index) => (
            <path
              key={`${slug}-${index}`}
              className="bm-sil"
              d={d}
              style={{ stroke: 'rgb(var(--color-card))', strokeWidth: 2.5, strokeLinejoin: 'round' }}
            />
          )))}
          {BODY_MAP_MUSCLES.map((slug) => (view.p[slug] || []).map((d, index) => (
            <path
              key={`${slug}-${index}`}
              className={`bm-m l${selected.has(slug) ? 4 : 0}`}
              d={d}
              style={{ stroke: 'rgb(var(--color-card))', strokeWidth: selected.has(slug) ? 4 : 2.5, strokeLinejoin: 'round' }}
            />
          )))}
        </svg>
      </div>
      {showLabel && (
        <div className={`mt-2 truncate text-xs font-semibold ${labelClassName} ${getLabelAlignClass(align)}`}>{muscle.label}</div>
      )}
    </div>
  );
});
