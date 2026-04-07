import { useEffect, useLayoutEffect, type DependencyList } from 'react';

const applyScrollTop = () => {
  if (typeof window === 'undefined') return;

  window.scrollTo({ top: 0, left: 0, behavior: 'auto' });

  if (typeof document !== 'undefined') {
    document.scrollingElement?.scrollTo?.({ top: 0, left: 0, behavior: 'auto' });
    document.documentElement.scrollTop = 0;
    document.body.scrollTop = 0;
  }
};

export const scrollPageToTop = () => {
  if (typeof window === 'undefined') return undefined;

  applyScrollTop();

  const frame = window.requestAnimationFrame(() => {
    applyScrollTop();
  });

  return () => window.cancelAnimationFrame(frame);
};

export const useScrollToTopOnChange = (deps: DependencyList) => {
  useLayoutEffect(() => {
    const cancelScrollReset = scrollPageToTop();
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
