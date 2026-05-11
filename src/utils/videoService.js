/**
 * videoService.js — Fetch scenes from a Stash GraphQL endpoint
 *
 * URL, API key, and Test/Live mode are read at request time from
 * the settings store (see ../utils/settings.js) so the user can
 * configure them at runtime via the Settings panel.
 *
 * Sort keys are passed through directly to Stash — UI keys MUST match
 * Stash's GraphQL sort enum values (created_at, title, rating, etc).
 */

import { getSettings } from './settings.js';

// ═══════════════════════════════════════════════════════════
// CONFIG (resolved per-request from settings)
// ═══════════════════════════════════════════════════════════

// ═══════════════════════════════════════════════════════════
// MOCK DATA
// ═══════════════════════════════════════════════════════════
const CATEGORIES = ['Action', 'Drama', 'Comedy', 'Sci-Fi', 'Documentary', 'Thriller'];
const MOCK_TITLES = [
  'Neon Requiem', 'The Last Circuit', 'Pale Blue Signal', 'Iron Meridian',
  'Ghost Protocol Zero', 'Silent Fracture', 'The Outer Rim', 'Chrome & Ash',
  'Vantage Point', 'Undercurrent', 'Solar Wind', 'The Forgotten Atlas',
  'Deep Latitude', 'Cascade Effect', 'Red Sequence', 'Orbit 44',
  'Dusk Protocol', 'Hollow Signal', 'The Long Burn', 'Frost Circuit',
  'Meridian Blue', 'Dark Interval', 'The Breach', 'Static Hours',
];

function generateMockVideos(count = 24) {
  const now = Date.now();
  return Array.from({ length: count }, (_, i) => ({
    id: `vid-${i + 1}`,
    title: MOCK_TITLES[i % MOCK_TITLES.length],
    duration: `${Math.floor(Math.random() * 2) + 1}h ${Math.floor(Math.random() * 50) + 10}m`,
    durationSeconds: Math.floor(Math.random() * 7200) + 600,
    year: 2019 + Math.floor(Math.random() * 6),
    date: 2019 + Math.floor(Math.random() * 6),
    created_at: now - i * 86400000,
    updated_at: now - i * 43200000,
    rating: (Math.random() * 3 + 6).toFixed(1),
    o_counter: Math.floor(Math.random() * 50),
    play_count: Math.floor(Math.random() * 200),
    play_duration: Math.floor(Math.random() * 100000),
    last_played_at: now - i * 3600000,
    filesize: Math.floor(Math.random() * 5e9) + 5e8,
    resolution: 1080,
    bitrate: Math.floor(Math.random() * 8000) + 2000,
    framerate: 30,
    performer_age: Math.floor(Math.random() * 30) + 20,
    category: CATEGORIES[Math.floor(Math.random() * CATEGORIES.length)],
    thumbnail: `https://picsum.photos/seed/${i + 1}/400/225`,
    preview: null,
    stream: null,
    sprite: null,
    vtt: null,
    views: Math.floor(Math.random() * 9000000) + 100000,
  }));
}

// ═══════════════════════════════════════════════════════════
// GRAPHQL
// ═══════════════════════════════════════════════════════════
const FIND_SCENES_QUERY = `
  query FindScenes($filter: FindFilterType, $scene_filter: SceneFilterType) {
    findScenes(filter: $filter, scene_filter: $scene_filter) {
      count
      duration
      scenes {
        id
        title
        date
        rating100
        details
        play_count
        files {
          duration
          width
          height
        }
        resume_time
        paths {
          screenshot
          preview
          stream
          webp
          sprite
          vtt
        }
        studio {
          id
          name
        }
        tags {
          id
          name
        }
        performers {
          id
          name
        }
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

function formatDuration(seconds) {
  if (!seconds) return '—';
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  return h > 0 ? `${h}h ${m}m` : `${m}m`;
}

function normalizeScene(scene) {
  const file = scene.files?.[0];
  const duration = file?.duration || 0;
  const year = scene.date ? new Date(scene.date).getFullYear() : null;

  return {
    id: scene.id,
    title: scene.title || `Scene ${scene.id}`,
    duration: formatDuration(duration),
    durationSeconds: duration,
    year,
    rating: scene.rating100 != null ? (scene.rating100 / 10).toFixed(1) : null,
    category: scene.studio?.name || scene.tags?.[0]?.name || 'Untagged',
    thumbnail: scene.paths?.screenshot || null,
    preview: scene.paths?.preview || null,
    stream: scene.paths?.stream || null,
    sprite: scene.paths?.sprite || null,
    vtt: scene.paths?.vtt || null,
    play_count: scene.play_count || 0,
    studio: scene.studio?.name,
    performers: scene.performers?.map(p => p.name) || [],
    tags: scene.tags?.map(t => t.name) || [],
    width: file?.width,
    height: file?.height,
    resume_time: scene.resume_time || 0,
  };
}

// ═══════════════════════════════════════════════════════════
// PUBLIC API
// ═══════════════════════════════════════════════════════════
export async function fetchVideos({
  mode = 'all',
  sort = 'created_at',
  order = 'desc',
  filter = null,
  q = '',
  page = 1,
  limit = 40,
} = {}) {

  // ── Mock branch ──────────────────────────────────────────
  if (getSettings().useMock) {
    await new Promise(r => setTimeout(r, 400));
    let videos = generateMockVideos(48);

    if (mode !== 'all') {
      videos = videos.filter(v => v.category.toLowerCase() === mode.toLowerCase());
    }

    videos.sort((a, b) => {
      let aVal = a[sort], bVal = b[sort];
      if (aVal == null) aVal = '';
      if (bVal == null) bVal = '';
      if (typeof aVal === 'string') aVal = aVal.toLowerCase();
      if (typeof bVal === 'string') bVal = bVal.toLowerCase();
      if (aVal < bVal) return order === 'asc' ? -1 : 1;
      if (aVal > bVal) return order === 'asc' ? 1 : -1;
      return 0;
    });

    return { videos, total: videos.length, page };
  }

  // ── GraphQL branch ───────────────────────────────────────
  const variables = {
    filter: {
      q,
      page,
      per_page: limit,
      sort,                                          // ← straight pass-through
      direction: order === 'asc' ? 'ASC' : 'DESC',
    },
    scene_filter: filter || {},
  };

  const data = await graphqlRequest(FIND_SCENES_QUERY, variables);
  const scenes = data?.findScenes?.scenes || [];

  return {
    videos: scenes.map(normalizeScene),
    total: data?.findScenes?.count || 0,
    page,
  };
}

/**
 * Fetch the live state of a single scene — used when reopening a
 * scene to pick up the latest resume_time, since the grid's cached
 * scene object may be stale (the position was saved to Stash but
 * the grid wasn't refetched).
 */
export async function fetchSceneState(id) {
  if (getSettings().useMock) return null;
  if (!id) return null;
  try {
    const data = await graphqlRequest(FIND_SCENE_QUERY, { id: String(id) });
    const s = data?.findScene;
    if (!s) return null;
    return {
      id: s.id,
      resume_time: s.resume_time || 0,
      play_count:  s.play_count || 0,
      play_duration: s.play_duration || 0,
      durationSeconds: s.files?.[0]?.duration || 0,
    };
  } catch (e) {
    console.warn('[fetchSceneState] failed:', e.message);
    return null;
  }
}

export async function fetchRandomVideos({ limit = 12 } = {}) {
  if (getSettings().useMock) {
    await new Promise(r => setTimeout(r, 300));
    const all = generateMockVideos(48);
    return {
      videos: all.sort(() => Math.random() - 0.5).slice(0, limit),
      total: limit,
    };
  }

  const variables = {
    filter: {
      q,
      page: 1,
      per_page: limit,
      sort: 'random',
      direction: 'DESC',
    },
    scene_filter: {},
  };

  const data = await graphqlRequest(FIND_SCENES_QUERY, variables);
  const scenes = data?.findScenes?.scenes || [];
  return { videos: scenes.map(normalizeScene), total: limit };
}

// ═══════════════════════════════════════════════════════════
// MUTATIONS
// ═══════════════════════════════════════════════════════════

const SCENE_SAVE_ACTIVITY_MUTATION = `
  mutation SceneSaveActivity($id: ID!, $resume_time: Float, $playDuration: Float) {
    sceneSaveActivity(id: $id, resume_time: $resume_time, playDuration: $playDuration)
  }
`;

const FIND_SCENE_QUERY = `
  query FindScene($id: ID!) {
    findScene(id: $id) {
      id
      resume_time
      play_count
      play_duration
      files { duration }
    }
  }
`;

/**
 * Save the current playback position (and optionally a play_duration
 * delta) back to Stash. Fire-and-forget — playback continues even if
 * the save fails. No-op in mock mode.
 */
export async function saveSceneActivity({ id, resumeTime, playDuration = 0 }) {
  if (getSettings().useMock) return;
  if (!id) return;
  try {
    await graphqlRequest(SCENE_SAVE_ACTIVITY_MUTATION, {
      id: String(id),
      resume_time: resumeTime,
      playDuration,
    });
  } catch (e) {
    // Silently ignore — playback shouldn't be disrupted by a save failure
    console.warn('[saveSceneActivity] failed:', e.message);
  }
}

