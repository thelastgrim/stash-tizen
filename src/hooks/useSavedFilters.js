/**
 * useSavedFilters — fetch & expose saved filters for a given Stash mode.
 *
 * Returns { filters, loading, error }. Filters list is empty in mock
 * mode (Stash-only feature). The fetch is cached in filterService, so
 * tab-switches don't re-hit the network.
 *
 * Pass `version` (any value) to force a refetch — used to re-sync
 * after settings change (Test↔Live, URL/key edits).
 */

import { useEffect, useState } from 'react';
import { fetchSavedFilters, clearSavedFiltersCache } from '../utils/filterService.js';

export function useSavedFilters(mode, version = '') {
  const [filters, setFilters] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (!mode) { setFilters([]); return; }

    let cancelled = false;
    setLoading(true);
    setError(null);

    fetchSavedFilters(mode)
      .then(list => {
        if (cancelled) return;
        setFilters(list);
        setLoading(false);
      })
      .catch(e => {
        if (cancelled) return;
        setError(e.message);
        setLoading(false);
      });

    return () => { cancelled = true; };
  }, [mode, version]);

  return { filters, loading, error };
}

// Re-export for callers that want to invalidate the cache directly.
export { clearSavedFiltersCache };