import type { BodyGeometry, NutritionBodyMode } from './nutritionBody.types';
import { BODY_BOTTOM, BODY_HEIGHT, BODY_TOP, getFillY } from './nutritionBody.utils';

export function BodyBaseLayer({ geometry, gradientId }: { geometry: BodyGeometry; gradientId: string }) {
  return (
    <>
      <path d={geometry.silhouette} fill={`url(#${gradientId})`} stroke="rgba(125,231,255,0.28)" strokeWidth="2" />
      {geometry.regions.map((region) => (
        <path
          key={region.id}
          d={region.d}
          fill="none"
          stroke="rgba(203,244,255,0.08)"
          strokeWidth="1.4"
          aria-hidden="true"
        />
      ))}
    </>
  );
}

export function HydrationLayer({
  clipId,
  gradientId,
  bubbleGradientId,
  visualProgress,
}: {
  clipId: string;
  gradientId: string;
  bubbleGradientId: string;
  visualProgress: number;
}) {
  const fillY = getFillY(visualProgress);
  const waveY = fillY + 4;
  const wavePath = `M42 ${waveY} C72 ${waveY - 12} 102 ${waveY + 12} 132 ${waveY} C162 ${waveY - 12} 192 ${waveY + 12} 222 ${waveY} C252 ${waveY - 12} 282 ${waveY + 12} 318 ${waveY} L318 ${BODY_BOTTOM + 20} L42 ${BODY_BOTTOM + 20} Z`;
  const bubbles = [
    [132, BODY_BOTTOM - 42, 4],
    [204, BODY_BOTTOM - 78, 3],
    [165, BODY_BOTTOM - 126, 2.8],
    [227, BODY_BOTTOM - 170, 3.6],
    [140, BODY_BOTTOM - 224, 2.8],
    [188, BODY_BOTTOM - 280, 3.2],
  ];

  return (
    <g clipPath={`url(#${clipId})`} aria-hidden="true">
      <rect
        x="34"
        y={fillY}
        width="292"
        height={BODY_BOTTOM - fillY + 30}
        fill={`url(#${gradientId})`}
        opacity="0.82"
        className="transition-[y,height] duration-700 ease-out motion-reduce:transition-none"
      />
      <path
        d={wavePath}
        fill="rgba(166,244,255,0.54)"
        className="nutrition-water-wave transition-[d] duration-700 ease-out motion-reduce:transition-none"
      />
      {bubbles.map(([cx, cy, r], index) => (
        <circle
          key={`${cx}-${cy}`}
          cx={cx}
          cy={Math.max(fillY + 18, cy)}
          r={r}
          fill={`url(#${bubbleGradientId})`}
          opacity={visualProgress <= 0 ? 0 : 0.26 + (index % 2) * 0.14}
          className={`nutrition-bubble nutrition-bubble-${index + 1}`}
        />
      ))}
    </g>
  );
}

export function ProteinLayer({
  geometry,
  clipId,
  gradientId,
  visualProgress,
}: {
  geometry: BodyGeometry;
  clipId: string;
  gradientId: string;
  visualProgress: number;
}) {
  const opacity = 0.08 + visualProgress * 0.74;
  return (
    <g clipPath={`url(#${clipId})`} opacity={opacity} aria-hidden="true">
      {geometry.regions
        .filter((region) => ['torso', 'arm', 'leg', 'core'].includes(region.group))
        .map((region) => (
          <path
            key={region.id}
            d={region.d}
            fill={`url(#${gradientId})`}
            stroke="rgba(210,248,255,0.38)"
            strokeWidth="1.2"
            className="nutrition-protein-pulse"
          />
        ))}
    </g>
  );
}

export function CarbEnergyLayer({
  clipId,
  visualProgress,
}: {
  clipId: string;
  visualProgress: number;
}) {
  const opacity = 0.1 + visualProgress * 0.72;
  const paths = [
    'M143 548 C134 473 153 420 179 371 C206 319 203 257 181 205',
    'M216 548 C224 470 205 417 181 371 C154 318 156 256 180 205',
    'M91 310 C130 300 158 276 180 236 C202 276 230 300 269 310',
    'M121 214 C152 229 208 229 239 214',
  ];
  return (
    <g clipPath={`url(#${clipId})`} opacity={opacity} aria-hidden="true">
      {paths.map((d, index) => (
        <path
          key={d}
          d={d}
          fill="none"
          stroke={index % 2 ? '#fde68a' : '#22d3ee'}
          strokeWidth={index < 2 ? 5 : 3}
          strokeLinecap="round"
          strokeDasharray="18 24"
          className="nutrition-carb-flow"
          style={{ animationDelay: `${index * -0.8}s` }}
        />
      ))}
    </g>
  );
}

export function FatEnergyLayer({
  clipId,
  gradientId,
  visualProgress,
}: {
  clipId: string;
  gradientId: string;
  visualProgress: number;
}) {
  const opacity = 0.08 + visualProgress * 0.58;
  return (
    <g clipPath={`url(#${clipId})`} opacity={opacity} aria-hidden="true">
      <ellipse cx="180" cy="338" rx="94" ry="136" fill={`url(#${gradientId})`} className="nutrition-fat-glow" />
      <ellipse cx="180" cy="455" rx="74" ry="96" fill={`url(#${gradientId})`} opacity="0.58" />
      {[124, 154, 203, 235].map((cx, index) => (
        <circle key={cx} cx={cx} cy={278 + index * 48} r={5 + index % 2} fill="#fed7aa" opacity="0.35" className="nutrition-fat-spark" />
      ))}
    </g>
  );
}

export function OverviewLayer({ clipId }: { clipId: string }) {
  return (
    <g clipPath={`url(#${clipId})`} opacity="0.55" aria-hidden="true">
      <rect x="70" y={BODY_TOP} width="220" height={BODY_HEIGHT} fill="url(#overviewSheen)" className="nutrition-overview-breathe" />
    </g>
  );
}

export function BodyOutlineLayer({ geometry, glowId }: { geometry: BodyGeometry; glowId: string }) {
  return (
    <>
      <path d={geometry.silhouette} fill="none" stroke={`url(#${glowId})`} strokeWidth="4" opacity="0.84" aria-hidden="true" />
      <path d={geometry.silhouette} fill="none" stroke="rgba(255,255,255,0.2)" strokeWidth="1" aria-hidden="true" />
    </>
  );
}

export const getModeDescription = (mode: NutritionBodyMode) => {
  if (mode === 'hydration') return 'Water fill shows progress toward today&apos;s hydration target.';
  if (mode === 'protein') return 'Muscle-style highlights show progress toward today&apos;s protein target.';
  if (mode === 'carbs') return 'Energy lines show progress toward today&apos;s carbohydrate target.';
  if (mode === 'fat') return 'Warm energy glow shows progress toward today&apos;s fat target.';
  return 'Subtle body glow summarizes nutrition progress.';
};
