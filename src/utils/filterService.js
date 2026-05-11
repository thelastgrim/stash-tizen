/**
 * filterService.js — Fetch user-saved filters from Stash.
 *
 * Stash exposes `findSavedFilters(mode)` returning a list of filters
 * the user has saved in the Stash UI. Each saved filter holds:
 *   - find_filter   (q/sort/direction/per_page — pagination & sort)
 *   - object_filter (the typed filter that goes into scene_filter
 *                    / performer_filter / scene_marker_filter)
 *
 * We use only `object_filter` here — sort & paging come from our
 * own ControlsPanel. The `object_filter` field comes back as a JSON
 * string from Stash; we parse it once on load.
 *
 * Results are cached by mode in module scope. Switching tabs
 * doesn't re-fetch unless the cache is cleared (e.g. on settings
 * change, the App's `dataKey`-based remount nukes everything).
 */

import { getSettings } from './settings.js';

// SavedFilter modes — must match Stash's FilterMode enum exactly.
export const FILTER_MODE = {
  scenes:     'SCENES',
  markers:    'SCENE_MARKERS',
  performers: 'PERFORMERS',
};

const FIND_SAVED_FILTERS_QUERY = `
  query FindSavedFilters($mode: FilterMode) {
    findSavedFilters(mode: $mode) {
      id
      mode
      name
      find_filter { q page per_page sort direction }
      object_filter
    }
  }
`;

async function graphqlRequest(query, variables) {
  const { stashUrl, stashKey } = getSettings();
  const headers = { 'Content-Type': 'application/json' };
  if (stashKey) headers['ApiKey'] = stashKey;

  const res = await fetch(`${stashUrl}/graphql`, {
    method: 'POST',
    headers,
    body: JSON.stringify({ query, variables }),
  });
  if (!res.ok) throw new Error(`GraphQL HTTP ${res.status}`);
  const json = await res.json();
  if (json.errors) throw new Error(json.errors[0]?.message || 'GraphQL error');
  return json.data;
}

// `object_filter` may come back as a JSON string OR as an already-parsed
// object depending on Stash version / scalar handling. Normalise both.
function parseObjectFilter(raw) {
  if (raw == null) return {};
  if (typeof raw === 'string') {
    try { return JSON.parse(raw); } catch { return {}; }
  }
  return raw;
}

// ── Cache ────────────────────────────────────────────────
const cache = new Map();   // mode → [{ id, name, objectFilter }]
const inflight = new Map();// mode → Promise

export async function fetchSavedFilters(mode) {
  if (!mode) return [];
  if (getSettings().useMock) return [];   // no saved filters in mock mode

  if (cache.has(mode)) return cache.get(mode);
  if (inflight.has(mode)) return inflight.get(mode);

  const p = graphqlRequest(FIND_SAVED_FILTERS_QUERY, { mode })
    .then(data => {
      const list = (data?.findSavedFilters || []).map(f => ({
        id: f.id,
        name: f.name,
        objectFilter: parseObjectFilter(f.object_filter),
        // find_filter holds q/sort/direction/per_page — many saved filters
        // do their actual work via `q` (search) rather than typed criteria.
        findFilter: f.find_filter || null,
      }));
      cache.set(mode, list);
      inflight.delete(mode);
      return list;
    })
    .catch(err => {
      inflight.delete(mode);
      throw err;
    });

  inflight.set(mode, p);
  return p;
}

export function getCachedSavedFilters(mode) {
  return cache.get(mode) || null;
}

export function clearSavedFiltersCache() {
  cache.clear();
  inflight.clear();
}