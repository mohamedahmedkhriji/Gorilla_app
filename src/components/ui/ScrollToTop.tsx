import { type DependencyList, type RefObject } from 'react';
import { useScrollToTopOnChange } from '../../shared/scroll';

interface ScrollToTopProps {
  navigationKey?: string | number | null;
  watch?: DependencyList;
  containerRef?: RefObject<HTMLElement | null>;
  rootSelector?: string;
  containerSelector?: string;
  includeWindow?: boolean;
}

export function ScrollToTop({
  navigationKey,
  watch,
  containerRef,
  rootSelector,
  containerSelector,
  includeWindow = true,
}: ScrollToTopProps) {
  const deps = navigationKey !== undefined ? [navigationKey] : (watch || []);

  useScrollToTopOnChange(deps, {
    root: containerRef?.current || null,
    rootSelector,
    containerSelector,
    includeWindow,
  });

  return null;
}
