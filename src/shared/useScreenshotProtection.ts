import { useEffect } from 'react';
import {
  disableScreenshotProtection,
  enableScreenshotProtection,
} from '../services/screenshotSecurity';

export const useScreenshotProtection = (enabled = true) => {
  useEffect(() => {
    if (!enabled) return undefined;

    void enableScreenshotProtection();

    return () => {
      void disableScreenshotProtection();
    };
  }, [enabled]);
};
