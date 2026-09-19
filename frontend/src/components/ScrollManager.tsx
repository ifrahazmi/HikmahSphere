import { useLayoutEffect } from 'react';
import { useLocation } from 'react-router-dom';

export const pinWindowToTop = (): void => {
  if (typeof window === 'undefined') {
    return;
  }
  window.scrollTo(0, 0);
  document.documentElement.scrollTop = 0;
  document.body.scrollTop = 0;
};

export const disableBrowserScrollRestoration = (): void => {
  if (typeof window === 'undefined' || !('scrollRestoration' in window.history)) {
    return;
  }
  window.history.scrollRestoration = 'manual';
};

/** Keep refresh and in-app navigation at the top. Hash links are left to the page. */
const ScrollManager: React.FC = () => {
  const { pathname, search, hash } = useLocation();

  useLayoutEffect(() => {
    disableBrowserScrollRestoration();
    if (hash) {
      return;
    }
    pinWindowToTop();
  }, [pathname, search, hash]);

  return null;
};

export default ScrollManager;
