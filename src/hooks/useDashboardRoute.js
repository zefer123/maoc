import { useCallback, useEffect, useState } from 'react';
import { dashboardRouteHash, parseDashboardRoute } from '../lib/dashboardRoute.js';

export default function useDashboardRoute() {
  const [route, setRoute] = useState(() => parseDashboardRoute(window.location.hash));
  useEffect(() => {
    const sync = () => setRoute(parseDashboardRoute(window.location.hash));
    window.addEventListener('popstate', sync);
    window.addEventListener('hashchange', sync);
    return () => { window.removeEventListener('popstate', sync); window.removeEventListener('hashchange', sync); };
  }, []);
  const visit = useCallback((next) => {
    const hash = dashboardRouteHash(next);
    if (window.location.hash !== hash) window.history.pushState(null, '', hash);
    setRoute(parseDashboardRoute(hash));
  }, []);
  return [route, visit];
}