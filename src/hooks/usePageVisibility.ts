import { useState, useEffect } from 'react';

/**
 * Returns whether the current browser tab is visible.
 * Used to pause polling / unsubscribe from Realtime when the tab is hidden,
 * saving bandwidth, battery, and database resources.
 */
export function usePageVisibility(): boolean {
  const [isVisible, setIsVisible] = useState(() =>
    typeof document !== 'undefined' ? !document.hidden : true
  );

  useEffect(() => {
    const handleChange = () => setIsVisible(!document.hidden);
    document.addEventListener('visibilitychange', handleChange);
    return () => document.removeEventListener('visibilitychange', handleChange);
  }, []);

  return isVisible;
}
