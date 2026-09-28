export const BODY_VIEWBOX = '0 0 360 620';
export const BODY_TOP = 54;
export const BODY_BOTTOM = 590;
export const BODY_HEIGHT = BODY_BOTTOM - BODY_TOP;

export const toFiniteNumber = (value: number | null | undefined) => {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
};

export const getProgressState = (currentRaw: number | null | undefined, targetRaw: number | null | undefined) => {
  const current = Math.max(0, toFiniteNumber(currentRaw));
  const target = Math.max(0, toFiniteNumber(targetRaw));
  const rawProgress = target > 0 ? current / target : 0;
  const visualProgress = Math.max(0, Math.min(1, rawProgress));
  return {
    current,
    target,
    rawProgress,
    visualProgress,
    percent: Math.round(rawProgress * 100),
    visualPercent: Math.round(visualProgress * 100),
    isOverTarget: rawProgress > 1,
  };
};

export const getFillY = (visualProgress: number) =>
  BODY_BOTTOM - (BODY_HEIGHT * Math.max(0, Math.min(1, visualProgress)));
