import { useEffect, type DependencyList } from 'react';

export const scrollPageToTop = () => {
  if (typeof window === 'undefined') return;

  window.scrollTo({ top: 0, left: 0, behavior: 'auto' });

  if (typeof document !== 'undefined') {
    document.documentElement.scrollTop = 0;
    document.body.scrollTop = 0;
  }
};

export const useScrollToTopOnChange = (deps: DependencyList) => {
  useEffect(() => {
    scrollPageToTop();
  }, deps);
};

