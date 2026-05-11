/**
 * markerService.js — Fetch scene markers from Stash GraphQL endpoint
 *
 * A marker holds:
 *   - id, title, seconds (timestamp into the parent scene)
 *   - stream  : marker-specific stream URL — used for the focused preview
 *   - scene   : parent scene { id, title, ... } — used when activated for playback
 *
 * Activating a marker plays the parent scene's full stream, seeking
 * to `marker.seconds`. The marker stream is only used for the
 * preview-on-focus video on the card.
 */

import { getSettings } from './settings.js';

// ── Mock generator ────────────────────────────────────────
const TAG_POOL = ['Highlight', 'Intro', 'Action', 'Dialogue', 'Climax', 'Outro', 'B-Roll', 'Stunt'];
const TITLES = [
  'barrel', 'opening', 'reveal', 'twist', 'quiet', 'chase',
  'showdown', 'meeting', 'argument', 'reunion', 'climax', 'resolution',
];

function generateMockMarkers(count = 24) {
  const now = Date.now();
  return Array.from({ length: count }, (_, i) => {
    const sceneId = `mockscene-${(i % 12) + 1}`;
    return {
      id: `marker-${i + 1}`,
      title: TITLES[i % TITLES.length],
      seconds: Math.floor(Math.random() * 3600) + 60,
      end_seconds: null,
      screenshot: `https://picsum.photos/seed/marker-${i + 1}/400/225`,
      preview: null,                 // not used in mock
      stream: null,                  // mock doesn't have streams
      primary_tag: { id: `tag-${i % 8}`, name: TAG_POOL[i % TAG_POOL.length] },
      tags: [],
      scene: {
        id: sceneId,
        title: `Scene ${(i % 12) + 1}`,
        performers: [],
      },
    };
  });
}

// ── GraphQL query ─────────────────────────────────────────
const FIND_MARKERS_QUERY = `
  query FindSceneMarkers($filter: FindFilterType, $scene_marker_filter: SceneMarkerFilterType) {
    findSceneMarkers(filter: $filter, scene_marker_filter: $scene_marker_filter) {
      count
      scene_markers {
        id
        title
        seconds
        end_seconds
        stream
        preview
        screenshot
        scene {
          id
          title
          files { width height path }
          paths { stream screenshot sprite vtt }
          performers { id name image_path }
        }
        primary_tag { id name }
        tags { id name }
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

function normalizeMarker(m) {
  return {
    id: m.id,
    title: m.title || m.primary_tag?.name || 'Untitled marker',
    seconds: m.seconds || 0,
    endSeconds: m.end_seconds || null,
    screenshot: m.screenshot || m.scene?.paths?.screenshot || null,
    markerStream: m.stream || null,                    // ← used as on-focus preview
    primaryTag: m.primary_tag?.name || null,
    tags: m.tags?.map(t => t.name) || [],
    scene: {
      id: m.scene?.id,
      title: m.scene?.title || `Scene ${m.scene?.id}`,
      stream: m.scene?.paths?.stream || null,          // ← used for full playback
      screenshot: m.scene?.paths?.screenshot || null,
      sprite: m.scene?.paths?.sprite || null,          // ← skim preview sheet
      vtt: m.scene?.paths?.vtt || null,                // ← skim preview cue map
      performers: m.scene?.performers?.map(p => p.name) || [],
    },
  };
}

// ═══════════════════════════════════════════════════════════
// PUBLIC API
// ═══════════════════════════════════════════════════════════
export async function fetchMarkers({
  sort = 'title',
  order = 'asc',
  q = '',
  page = 1,
  limit = 40,
  filter = null,
} = {}) {
  if (getSettings().useMock) {
    await new Promise(r => setTimeout(r, 400));
    let markers = generateMockMarkers(60);

    markers.sort((a, b) => {
      let aVal = a[sort], bVal = b[sort];
      if (aVal == null) aVal = '';
      if (bVal == null) bVal = '';
      if (typeof aVal === 'string') aVal = aVal.toLowerCase();
      if (typeof bVal === 'string') bVal = bVal.toLowerCase();
      if (aVal < bVal) return order === 'asc' ? -1 : 1;
      if (aVal > bVal) return order === 'asc' ? 1 : -1;
      return 0;
    });

    const start = (page - 1) * limit;
    const slice = markers.slice(start, start + limit).map(normalizeMarker);
    return { markers: slice, total: markers.length, page };
  }

  const variables = {
    filter: {
      q,
      page,
      per_page: limit,
      sort,
      direction: order === 'asc' ? 'ASC' : 'DESC',
    },
    scene_marker_filter: filter || {},
  };

  const data = await graphqlRequest(FIND_MARKERS_QUERY, variables);
  const markers = data?.findSceneMarkers?.scene_markers || [];

  return {
    markers: markers.map(normalizeMarker),
    total: data?.findSceneMarkers?.count || 0,
    page,
  };
}
