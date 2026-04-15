import { useEffect, useLayoutEffect, type DependencyList } from 'react';

export type ScrollToTopOptions = {
  root?: ParentNode | null;
  rootSelector?: string;
  container?: HTMLElement | null;
  containerSelector?: string;
  includeWindow?: boolean;
};

const DEFAULT_SCROLL_CONTAINER_SELECTOR = [
  '[data-scroll-container]',
  '[data-scroll-root]',
  '.overflow-y-auto',
  '.overflow-y-scroll',
  '.overflow-auto',
  '.overflow-scroll',
].join(', ');

const resetWindowScroll = () => {
  if (typeof window === 'undefined' || typeof document === 'undefined') return;

  window.scrollTo({ top: 0, left: 0, behavior: 'auto' });
  document.scrollingElement?.scrollTo?.({ top: 0, left: 0, behavior: 'auto' });
  document.documentElement.scrollTop = 0;
  document.body.scrollTop = 0;
};

const resetElementScroll = (element: HTMLElement | null | undefined) => {
  if (!element) return;

  element.scrollTo?.({ top: 0, left: 0, behavior: 'auto' });
  element.scrollTop = 0;
  element.scrollLeft = 0;
};

const isElementVisible = (element: HTMLElement) => {
  const style = window.getComputedStyle(element);
  if (style.display === 'none' || style.visibility === 'hidden') return false;
  return element.getClientRects().length > 0;
};

const isScrollableElement = (element: HTMLElement) => {
  const style = window.getComputedStyle(element);
  const overflowY = style.overflowY || style.overflow;
  return (
    ['auto', 'scroll', 'overlay'].includes(overflowY)
    && element.scrollHeight > element.clientHeight + 1
  );
};

const resolveSearchRoot = (options?: ScrollToTopOptions) => {
  if (typeof document === 'undefined') return null;
  if (options?.root) return options.root;
  if (options?.rootSelector) {
    return document.querySelector(options.rootSelector) || document;
  }
  return document;
};

const collectScrollableCandidates = (root: ParentNode, selector: string) => {
  const candidates = new Set<HTMLElement>();

  if (root instanceof HTMLElement && root.matches(selector)) {
    candidates.add(root);
  }

  if ('querySelectorAll' in root) {
    root.querySelectorAll<HTMLElement>(selector).forEach((element) => {
      candidates.add(element);
    });
  }

  return Array.from(candidates).filter((element) => isElementVisible(element) && isScrollableElement(element));
};

const scoreScrollContainer = (element: HTMLElement) => {
  const rect = element.getBoundingClientRect();
  const hasExplicitMarker = element.hasAttribute('data-scroll-container') || element.hasAttribute('data-scroll-root');
  const visibleHeight = Math.min(element.clientHeight, window.innerHeight || element.clientHeight);
  const topPenalty = Math.abs(rect.top);
  const topBonus = rect.top <= 64 ? 300 : 0;

  return (hasExplicitMarker ? 10_000 : 0) + visibleHeight + topBonus - topPenalty;
};

const findPrimaryScrollContainer = (options?: ScrollToTopOptions) => {
  if (typeof window === 'undefined' || typeof document === 'undefined') return null;

  if (options?.container) return options.container;

  const root = resolveSearchRoot(options);
  if (!root) return null;

  const selector = options?.containerSelector || DEFAULT_SCROLL_CONTAINER_SELECTOR;
  const candidates = collectScrollableCandidates(root, selector);
  if (candidates.length === 0) return null;

  return candidates.sort((left, right) => scoreScrollContainer(right) - scoreScrollContainer(left))[0] || null;
};

const applyScrollTop = (options?: ScrollToTopOptions) => {
  if (options?.includeWindow !== false) {
    resetWindowScroll();
  }

  resetElementScroll(findPrimaryScrollContainer(options));
};

export const scrollPageToTop = (options?: ScrollToTopOptions) => {
  if (typeof window === 'undefined') return undefined;

  applyScrollTop(options);

  const frame = window.requestAnimationFrame(() => {
    applyScrollTop(options);
  });

  return () => window.cancelAnimationFrame(frame);
};

export const useScrollToTopOnChange = (deps: DependencyList, options?: ScrollToTopOptions) => {
  useLayoutEffect(() => {
    const cancelScrollReset = scrollPageToTop(options);
    return () => {
      cancelScrollReset?.();
    };
  }, deps);
};

export const useManualScrollRestoration = () => {
  useEffect(() => {
    if (typeof window === 'undefined' || !('scrollRestoration' in window.history)) return undefined;

    const previousValue = window.history.scrollRestoration;
    window.history.scrollRestoration = 'manual';

    return () => {
      window.history.scrollRestoration = previousValue;
    };
  }, []);
};
