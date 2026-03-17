import React, { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { createPortal } from 'react-dom';

export type CoachmarkPlacement = 'top' | 'bottom' | 'auto';
export type CoachmarkShape = 'rounded' | 'pill' | 'circle';

export interface CoachmarkStep {
  id: string;
  targetId: string;
  title: string;
  body: string;
  placement?: CoachmarkPlacement;
  shape?: CoachmarkShape;
  padding?: number;
  cornerRadius?: number;
  targetActionLabel?: string;
}

interface CoachmarkOverlayProps {
  isOpen: boolean;
  step: CoachmarkStep | null;
  stepIndex: number;
  totalSteps: number;
  nextLabel: string;
  finishLabel: string;
  skipLabel: string;
  onNext: () => void;
  onFinish: () => void;
  onSkip: () => void;
  onTargetAction?: (() => void) | null;
}

type MeasuredRect = {
  top: number;
  left: number;
  width: number;
  height: number;
  radius: number;
};

type TooltipPosition = {
  top?: number;
  bottom?: number;
  left: number;
  width: number;
};

type TooltipStyle = {
  top: number | 'auto';
  bottom: number | 'auto';
  left: number;
  width: number;
  maxHeight: string;
};

const DEFAULT_TOOLTIP_HEIGHT = 176;
const TOOLTIP_WIDTH = 320;
const VIEWPORT_MARGIN = 16;
const TARGET_GAP = 14;
const TOP_SAFE_SPACE = 18;
const BOTTOM_SAFE_SPACE = 96;

const clamp = (value: number, min: number, max: number) => Math.min(Math.max(value, min), max);

const getTargetSelector = (targetId: string) => `[data-coachmark-target="${targetId}"]`;

const queryTarget = (targetId: string) => document.querySelector<HTMLElement>(getTargetSelector(targetId));

const getScrollContainer = () => {
  const root = document.getElementById('root');
  if (root && root.scrollHeight > root.clientHeight) return root;
  return null;
};

const isFixedLikeElement = (element: HTMLElement) => {
  const position = window.getComputedStyle(element).position;
  return position === 'fixed' || position === 'sticky';
};

const scrollTargetIntoView = (target: HTMLElement) => {
  if (typeof window === 'undefined' || isFixedLikeElement(target)) return;

  const rect = target.getBoundingClientRect();
  const visibleTop = TOP_SAFE_SPACE + 12;
  const visibleBottom = window.innerHeight - BOTTOM_SAFE_SPACE - 12;
  const isFullyVisible = rect.top >= visibleTop && rect.bottom <= visibleBottom;

  if (isFullyVisible) return;

  const desiredCenter = (visibleTop + visibleBottom) / 2;
  const targetCenter = rect.top + rect.height / 2;
  const delta = targetCenter - desiredCenter;
  const scrollContainer = getScrollContainer();

  if (scrollContainer) {
    scrollContainer.scrollTo({
      top: Math.max(0, scrollContainer.scrollTop + delta),
      behavior: 'smooth',
    });
    return;
  }

  window.scrollTo({
    top: Math.max(0, window.scrollY + delta),
    behavior: 'smooth',
  });
};

const computeRadius = (step: CoachmarkStep, width: number, height: number) => {
  if (typeof step.cornerRadius === 'number') return step.cornerRadius;
  if (step.shape === 'circle') return Math.max(width, height) / 2;
  if (step.shape === 'pill') return 999;
  return 24;
};

const measureTarget = (step: CoachmarkStep | null): MeasuredRect | null => {
  if (!step || typeof window === 'undefined') return null;

  const target = queryTarget(step.targetId);
  if (!target) return null;

  const rect = target.getBoundingClientRect();
  const padding = Math.max(0, Number(step.padding || 0));

  const top = Math.max(VIEWPORT_MARGIN, rect.top - padding);
  const left = Math.max(VIEWPORT_MARGIN, rect.left - padding);
  const right = Math.min(window.innerWidth - VIEWPORT_MARGIN, rect.right + padding);
  const bottom = Math.min(window.innerHeight - VIEWPORT_MARGIN, rect.bottom + padding);
  const width = Math.max(0, right - left);
  const height = Math.max(0, bottom - top);

  return {
    top,
    left,
    width,
    height,
    radius: computeRadius(step, width, height),
  };
};

const resolveTooltipPosition = (
  rect: MeasuredRect,
  step: CoachmarkStep,
  tooltipHeight: number,
) => {
  const viewportWidth = window.innerWidth;
  const viewportHeight = window.innerHeight;
  const width = Math.min(TOOLTIP_WIDTH, viewportWidth - VIEWPORT_MARGIN * 2);
  const centeredLeft = rect.left + rect.width / 2 - width / 2;
  const left = clamp(centeredLeft, VIEWPORT_MARGIN, viewportWidth - width - VIEWPORT_MARGIN);
  const fitsBelow = rect.top + rect.height + TARGET_GAP + tooltipHeight <= viewportHeight - BOTTOM_SAFE_SPACE;
  const fitsAbove = rect.top - TARGET_GAP - tooltipHeight >= TOP_SAFE_SPACE;
  const preferredPlacement = step.placement || 'auto';

  const shouldUseBottomSheet = viewportWidth <= 380 || (!fitsBelow && !fitsAbove);
  if (shouldUseBottomSheet) {
    return {
      left: VIEWPORT_MARGIN,
      width: viewportWidth - VIEWPORT_MARGIN * 2,
      bottom: BOTTOM_SAFE_SPACE,
    } satisfies TooltipPosition;
  }

  let placeBelow = rect.top < viewportHeight * 0.42;
  if (preferredPlacement === 'bottom') placeBelow = fitsBelow || !fitsAbove;
  if (preferredPlacement === 'top') placeBelow = !(fitsAbove || !fitsBelow);
  if (preferredPlacement === 'auto' && !fitsBelow && fitsAbove) placeBelow = false;

  if (placeBelow) {
    return {
      top: rect.top + rect.height + TARGET_GAP,
      left,
      width,
    } satisfies TooltipPosition;
  }

  return {
    top: Math.max(TOP_SAFE_SPACE, rect.top - TARGET_GAP - tooltipHeight),
    left,
    width,
  } satisfies TooltipPosition;
};

export function CoachmarkOverlay({
  isOpen,
  step,
  stepIndex,
  totalSteps,
  nextLabel,
  finishLabel,
  skipLabel,
  onNext,
  onFinish,
  onSkip,
  onTargetAction,
}: CoachmarkOverlayProps) {
  const tooltipRef = useRef<HTMLDivElement | null>(null);
  const [targetRect, setTargetRect] = useState<MeasuredRect | null>(null);
  const [tooltipHeight, setTooltipHeight] = useState(DEFAULT_TOOLTIP_HEIGHT);

  useEffect(() => {
    if (!isOpen || !step) {
      setTargetRect(null);
      return;
    }

    const updateRect = () => {
      setTargetRect(measureTarget(step));
    };

    updateRect();
    const animationFrame = window.requestAnimationFrame(updateRect);
    window.addEventListener('resize', updateRect);
    window.addEventListener('scroll', updateRect, true);

    return () => {
      window.cancelAnimationFrame(animationFrame);
      window.removeEventListener('resize', updateRect);
      window.removeEventListener('scroll', updateRect, true);
    };
  }, [isOpen, step]);

  useEffect(() => {
    if (!isOpen || !step) return;

    const target = queryTarget(step.targetId);
    if (!target) return;

    const timer = window.setTimeout(() => {
      scrollTargetIntoView(target);
    }, 40);

    return () => window.clearTimeout(timer);
  }, [isOpen, step]);

  useLayoutEffect(() => {
    if (!isOpen || !tooltipRef.current) return;
    const nextHeight = tooltipRef.current.getBoundingClientRect().height;
    if (nextHeight > 0) {
      setTooltipHeight(nextHeight);
    }
  }, [isOpen, step?.id, stepIndex, totalSteps]);

  const tooltipPosition = useMemo(() => {
    if (!isOpen || !targetRect || !step) return null;
    return resolveTooltipPosition(targetRect, step, tooltipHeight || DEFAULT_TOOLTIP_HEIGHT);
  }, [isOpen, step, targetRect, tooltipHeight]);

  const tooltipStyle = useMemo<TooltipStyle | null>(() => {
    if (!tooltipPosition) return null;

    return {
      top: typeof tooltipPosition.top === 'number' ? tooltipPosition.top : 'auto',
      bottom: typeof tooltipPosition.bottom === 'number' ? tooltipPosition.bottom : 'auto',
      left: tooltipPosition.left,
      width: tooltipPosition.width,
      maxHeight: `calc(100vh - ${TOP_SAFE_SPACE + BOTTOM_SAFE_SPACE + 24}px)`,
    };
  }, [tooltipPosition]);

  if (!isOpen || !step || !targetRect || !tooltipPosition || !tooltipStyle || typeof document === 'undefined') {
    return null;
  }

  const isLastStep = stepIndex >= totalSteps - 1;

  return createPortal(
    <AnimatePresence>
      <motion.div
        className="fixed inset-0 z-[140]"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        transition={{ duration: 0.2 }}
        aria-hidden={false}
      >
        <motion.div
          className="pointer-events-none absolute border border-white/10 bg-transparent"
          initial={{ opacity: 0, scale: 0.96 }}
          animate={{
            opacity: 1,
            scale: 1,
            top: targetRect.top,
            left: targetRect.left,
            width: targetRect.width,
            height: targetRect.height,
          }}
          exit={{ opacity: 0, scale: 0.98 }}
          transition={{ duration: 0.24 }}
          style={{
            borderRadius: targetRect.radius,
            boxShadow: '0 0 0 9999px rgba(5, 9, 18, 0.68)',
          }}
        />

        <motion.div
          className="pointer-events-none absolute border border-[rgba(187,255,92,0.82)]"
          initial={{ opacity: 0, scale: 0.96 }}
          animate={{
            opacity: 1,
            scale: 1,
            top: targetRect.top,
            left: targetRect.left,
            width: targetRect.width,
            height: targetRect.height,
          }}
          exit={{ opacity: 0, scale: 0.98 }}
          transition={{ duration: 0.28 }}
          style={{
            borderRadius: targetRect.radius,
            boxShadow: '0 0 0 1px rgba(187,255,92,0.22), 0 0 24px rgba(187,255,92,0.18), inset 0 0 0 1px rgba(255,255,255,0.08)',
          }}
        />

        {onTargetAction && (
          <button
            type="button"
            onClick={onTargetAction}
            aria-label={step.targetActionLabel || step.title}
            className="absolute bg-transparent"
            style={{
              top: targetRect.top,
              left: targetRect.left,
              width: targetRect.width,
              height: targetRect.height,
              borderRadius: targetRect.radius,
            }}
          />
        )}

        <motion.div
          ref={tooltipRef}
          role="dialog"
          aria-modal="true"
          aria-labelledby={`coachmark-title-${step.id}`}
          aria-describedby={`coachmark-body-${step.id}`}
          className="absolute overflow-y-auto rounded-[20px] border border-white/12 bg-[linear-gradient(180deg,rgba(18,28,42,0.96)_0%,rgba(10,16,27,0.98)_100%)] p-4 text-left shadow-[0_24px_72px_rgba(0,0,0,0.42)]"
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: 4 }}
          transition={{ duration: 0.24, delay: 0.04 }}
          style={tooltipStyle}
        >
          <div className="flex items-start justify-between gap-3">
            <div className="text-[11px] uppercase tracking-[0.22em] text-text-tertiary">
              {stepIndex + 1} of {totalSteps}
            </div>
            <button
              type="button"
              onClick={onSkip}
              className="text-sm font-medium text-text-secondary transition-colors hover:text-text-primary"
            >
              {skipLabel}
            </button>
          </div>

          <h3
            id={`coachmark-title-${step.id}`}
            className="mt-3 text-lg font-semibold text-text-primary"
          >
            {step.title}
          </h3>
          <p
            id={`coachmark-body-${step.id}`}
            className="mt-2 text-sm leading-6 text-text-secondary"
          >
            {step.body}
          </p>

          <div className="mt-4 flex items-center justify-between gap-4">
            <div className="flex items-center gap-2" aria-hidden="true">
              {Array.from({ length: totalSteps }).map((_, index) => (
                <span
                  key={`coachmark-dot-${index}`}
                  className={`h-1.5 rounded-full transition-all duration-200 ${
                    index === stepIndex ? 'w-5 bg-accent' : 'w-1.5 bg-white/16'
                  }`}
                />
              ))}
            </div>

            <button
              type="button"
              onClick={isLastStep ? onFinish : onNext}
              className="inline-flex min-h-[44px] items-center justify-center rounded-2xl bg-accent px-5 text-sm font-semibold text-black transition-transform duration-200 hover:scale-[1.01]"
            >
              {isLastStep ? finishLabel : nextLabel}
            </button>
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>,
    document.body,
  );
}
