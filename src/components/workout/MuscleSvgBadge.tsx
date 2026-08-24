import { useBodyPaths, type BodyPathView } from '../BodyMap';
import {
  BODY_MAP_INERT,
  BODY_MAP_MUSCLES,
  type BodyMapMuscle,
  recoveryMuscleToBodyMapSlugs,
} from '../../lib/muscle-map';
import { resolveBodyMapBody, type BodyMapBody } from '../../lib/body-map-body';
import { getStoredAppUser } from '../../shared/authStorage';

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

export function MuscleSvgBadge({
  muscle,
  align = 'left',
  className = 'w-[88px]',
  figureClassName = 'h-[72px]',
  showLabel = true,
  body,
}: {
  muscle: MuscleThumbnail;
  align?: MuscleSvgBadgeAlign;
  className?: string;
  figureClassName?: string;
  showLabel?: boolean;
  body?: BodyMapBody | string;
}) {
  const paths = useBodyPaths();
  const slugs = recoveryMuscleToBodyMapSlugs(muscle.sourceName);
  const resolvedBody = body ? resolveBodyMapBody(body) : resolveBodyMapBody(getStoredAppUser()?.gender);
  const geometry = paths?.[resolvedBody] || paths?.male;

  if (!geometry || slugs.length === 0) {
    return (
      <div
        className={`${className} overflow-hidden rounded-2xl border border-white/10 bg-white/[0.035] p-2`}
        title={muscle.label}
        aria-label={muscle.label}
      >
        <div className={`${figureClassName} flex items-center justify-center rounded-xl bg-background/70 text-[11px] font-semibold uppercase text-text-secondary`}>
          {muscle.label.slice(0, 2)}
        </div>
        {showLabel && (
          <div className={`mt-2 truncate text-xs font-semibold text-text-secondary ${getLabelAlignClass(align)}`}>{muscle.label}</div>
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
      className={`${className} overflow-hidden rounded-2xl border border-white/10 bg-white/[0.035] p-2`}
      title={muscle.label}
      aria-label={muscle.label}
      role="img"
    >
      <div className="overflow-hidden rounded-xl border border-white/10 bg-background/70">
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
        <div className={`mt-2 truncate text-xs font-semibold text-text-secondary ${getLabelAlignClass(align)}`}>{muscle.label}</div>
      )}
    </div>
  );
}
