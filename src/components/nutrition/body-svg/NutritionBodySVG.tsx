import { useId } from 'react';
import { getBodyGeometry } from './bodyGeometry';
import {
  BodyBaseLayer,
  BodyOutlineLayer,
  CarbEnergyLayer,
  FatEnergyLayer,
  HydrationLayer,
  OverviewLayer,
  ProteinLayer,
} from './BodyLayers';
import type { NutritionBodySVGProps } from './nutritionBody.types';
import { BODY_VIEWBOX, getProgressState } from './nutritionBody.utils';
import './nutrition-body-svg.css';

const formatValue = (value: number) =>
  Number.isInteger(value) ? value.toLocaleString() : value.toFixed(1);

export function NutritionBodySVG({
  bodyType,
  mode,
  current,
  target,
  unit,
  label,
}: NutritionBodySVGProps) {
  const rawId = useId().replace(/:/g, '');
  const geometry = getBodyGeometry(bodyType);
  const progress = getProgressState(current, target);
  const clipId = `${rawId}-body-clip`;
  const baseGradientId = `${rawId}-base-gradient`;
  const outlineGradientId = `${rawId}-outline-gradient`;
  const hydrationGradientId = `${rawId}-hydration-gradient`;
  const bubbleGradientId = `${rawId}-bubble-gradient`;
  const proteinGradientId = `${rawId}-protein-gradient`;
  const fatGradientId = `${rawId}-fat-gradient`;
  const glowFilterId = `${rawId}-glow-filter`;

  const accessibleLabel = `${label} progress: ${formatValue(progress.current)} of ${formatValue(progress.target)} ${unit}, ${Math.max(0, progress.percent)} percent.`;

  return (
    <div className="relative min-h-[360px] overflow-hidden rounded-[1.5rem] border border-white/10 bg-[#071018] shadow-[0_24px_80px_rgba(0,0,0,0.35)]">
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_50%_4%,rgba(34,211,238,0.24),transparent_34%),linear-gradient(180deg,rgba(255,255,255,0.05),transparent_48%)]" />
      <div className="absolute left-4 top-4 z-10">
        <div className="text-[10px] font-bold uppercase tracking-[0.22em] text-cyan-200/80">{label}</div>
        <div className="mt-1 text-xl font-black text-white">{Math.max(0, progress.percent)}%</div>
      </div>
      <div className="absolute bottom-4 left-4 right-4 z-10 rounded-2xl border border-white/10 bg-black/28 px-4 py-3 backdrop-blur">
        <div className="flex items-end justify-between gap-3">
          <div>
            <div className="text-[10px] uppercase tracking-[0.18em] text-white/48">Daily target progress</div>
            <div className="mt-1 text-sm font-semibold text-white">
              {formatValue(progress.current)} / {formatValue(progress.target)} {unit}
            </div>
          </div>
          <div className="text-right text-xs text-cyan-200/70">
            {progress.isOverTarget ? 'Target reached' : 'Tap a nutrient'}
          </div>
        </div>
      </div>

      <svg
        role="img"
        aria-label={accessibleLabel}
        viewBox={BODY_VIEWBOX}
        className="relative z-[1] mx-auto block h-[390px] w-full max-w-[420px] sm:h-[430px]"
      >
        <defs>
          <clipPath id={clipId}>
            <path d={geometry.silhouette} />
          </clipPath>
          <linearGradient id={baseGradientId} x1="0" x2="1" y1="0" y2="1">
            <stop offset="0%" stopColor="#122534" />
            <stop offset="45%" stopColor="#071018" />
            <stop offset="100%" stopColor="#0d1a25" />
          </linearGradient>
          <linearGradient id={outlineGradientId} x1="0" x2="1" y1="0" y2="1">
            <stop offset="0%" stopColor="#67e8f9" stopOpacity="0.24" />
            <stop offset="50%" stopColor="#d7fbff" stopOpacity="0.78" />
            <stop offset="100%" stopColor="#22d3ee" stopOpacity="0.28" />
          </linearGradient>
          <linearGradient id={hydrationGradientId} x1="0" x2="0" y1="0" y2="1">
            <stop offset="0%" stopColor="#a5f3fc" stopOpacity="0.74" />
            <stop offset="45%" stopColor="#22d3ee" stopOpacity="0.84" />
            <stop offset="100%" stopColor="#2563eb" stopOpacity="0.64" />
          </linearGradient>
          <radialGradient id={bubbleGradientId}>
            <stop offset="0%" stopColor="#ffffff" stopOpacity="0.9" />
            <stop offset="100%" stopColor="#67e8f9" stopOpacity="0.12" />
          </radialGradient>
          <linearGradient id={proteinGradientId} x1="0" x2="1" y1="0" y2="1">
            <stop offset="0%" stopColor="#38bdf8" stopOpacity="0.52" />
            <stop offset="60%" stopColor="#e0f2fe" stopOpacity="0.64" />
            <stop offset="100%" stopColor="#0ea5e9" stopOpacity="0.34" />
          </linearGradient>
          <radialGradient id={fatGradientId}>
            <stop offset="0%" stopColor="#fed7aa" stopOpacity="0.82" />
            <stop offset="58%" stopColor="#fb923c" stopOpacity="0.34" />
            <stop offset="100%" stopColor="#f59e0b" stopOpacity="0" />
          </radialGradient>
          <linearGradient id="overviewSheen" x1="0" x2="1" y1="0" y2="1">
            <stop offset="0%" stopColor="#67e8f9" stopOpacity="0.06" />
            <stop offset="50%" stopColor="#ffffff" stopOpacity="0.18" />
            <stop offset="100%" stopColor="#22d3ee" stopOpacity="0.05" />
          </linearGradient>
          <filter id={glowFilterId} x="-30%" y="-30%" width="160%" height="160%">
            <feGaussianBlur stdDeviation="3" result="blur" />
            <feMerge>
              <feMergeNode in="blur" />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>
        </defs>

        <g filter={`url(#${glowFilterId})`}>
          <BodyBaseLayer geometry={geometry} gradientId={baseGradientId} />
          {mode === 'overview' ? <OverviewLayer clipId={clipId} /> : null}
          {mode === 'hydration' ? (
            <HydrationLayer
              clipId={clipId}
              gradientId={hydrationGradientId}
              bubbleGradientId={bubbleGradientId}
              visualProgress={progress.visualProgress}
            />
          ) : null}
          {mode === 'protein' ? (
            <ProteinLayer geometry={geometry} clipId={clipId} gradientId={proteinGradientId} visualProgress={progress.visualProgress} />
          ) : null}
          {mode === 'carbs' ? <CarbEnergyLayer clipId={clipId} visualProgress={progress.visualProgress} /> : null}
          {mode === 'fat' ? <FatEnergyLayer clipId={clipId} gradientId={fatGradientId} visualProgress={progress.visualProgress} /> : null}
          <BodyOutlineLayer geometry={geometry} glowId={outlineGradientId} />
        </g>
      </svg>
    </div>
  );
}
