/**
 * performerService.js — Fetch performers from Stash GraphQL endpoint
 *
 * Mirrors videoService.js — uses the runtime settings store for URL/key/mode.
 */

import { getSettings } from './settings.js';

// ── Mock generator ────────────────────────────────────────
const FIRST = ['Ava','Mia','Luna','Iris','Nova','Zoe','Maya','Eva','Lila','Aria','Stella','Nina'];
const LAST  = ['Kane','Wells','Cross','North','Vale','Reyes','Quinn','Hart','Stone','Frost','Lane','Park'];

const BIOS = [
  'Originally from a small coastal town, started acting after a chance audition and never looked back.',
  'A former dancer who brought a love of movement and physical storytelling to the screen.',
  'Known for layered, understated performances and a knack for sharp comic timing.',
  'Got into the industry through theatre work and still considers stage their first love.',
  null, null,  // some performers have no bio
];

function generateMockPerformers(count = 24) {
  const now = Date.now();
  return Array.from({ length: count }, (_, i) => ({
    id: `perf-${i + 1}`,
    name: `${FIRST[i % FIRST.length]} ${LAST[(i * 3) % LAST.length]}`,
    image_path: `https://picsum.photos/seed/perf-${i + 1}/300/450`,
    scene_count: Math.floor(Math.random() * 80) + 1,
    favorite: Math.random() > 0.85,
    rating: Math.random() > 0.4 ? (Math.random() * 4 + 6).toFixed(1) : null,
    country: ['US','UK','DE','FR','BR','JP'][Math.floor(Math.random() * 6)],
    birthdate: `19${75 + (i % 20)}-${String((i % 12) + 1).padStart(2, '0')}-${String((i % 28) + 1).padStart(2, '0')}`,
    height_cm: 155 + (i * 7) % 35,
    details: BIOS[i % BIOS.length],
    created_at: now - i * 86400000,
  }));
}

// ── GraphQL query ─────────────────────────────────────────
const FIND_PERFORMERS_QUERY = `
  query FindPerformers($filter: FindFilterType, $performer_filter: PerformerFilterType) {
    findPerformers(filter: $filter, performer_filter: $performer_filter) {
      count
      performers {
        id
        name
        disambiguation
        gender
        favorite
        image_path
        scene_count
        rating100
        country
        birthdate
        details
        height_cm
      }
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

function normalizePerformer(p) {
  return {
    id: p.id,
    name: p.name,
    disambiguation: p.disambiguation,
    image_path: p.image_path || null,
    scene_count: p.scene_count || 0,
    favorite: !!p.favorite,
    rating: p.rating100 != null ? (p.rating100 / 10).toFixed(1) : null,
    country: p.country,
    gender: p.gender,
    birthdate: p.birthdate,
    details: p.details || null,
    height_cm: p.height_cm || null,
  };
}

// ═══════════════════════════════════════════════════════════
// PUBLIC API
// ═══════════════════════════════════════════════════════════
export async function fetchPerformers({
  sort = 'created_at',
  order = 'desc',
  filter = null,
  q = '',
  page = 1,
  limit = 40,
} = {}) {
  if (getSettings().useMock) {
    await new Promise(r => setTimeout(r, 400));
    let performers = generateMockPerformers(60);

    performers.sort((a, b) => {
      let aVal = a[sort], bVal = b[sort];
      if (aVal == null) aVal = '';
      if (bVal == null) bVal = '';
      if (typeof aVal === 'string') aVal = aVal.toLowerCase();
      if (typeof bVal === 'string') bVal = bVal.toLowerCase();
      if (aVal < bVal) return order === 'asc' ? -1 : 1;
      if (aVal > bVal) return order === 'asc' ? 1 : -1;
      return 0;
    });

    // Paginate
    const start = (page - 1) * limit;
    const slice = performers.slice(start, start + limit);

    return { performers: slice, total: performers.length, page };
  }

  const variables = {
    filter: {
      q,
      page,
      per_page: limit,
      sort,
      direction: order === 'asc' ? 'ASC' : 'DESC',
    },
    performer_filter: filter || {},
  };

  const data = await graphqlRequest(FIND_PERFORMERS_QUERY, variables);
  const performers = data?.findPerformers?.performers || [];

  return {
    performers: performers.map(normalizePerformer),
    total: data?.findPerformers?.count || 0,
    page,
  };
}
