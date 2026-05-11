/**
 * settings.js — Runtime configuration store
 *
 * Persists Stash endpoint URL and API key to localStorage so users
 * can configure their connection without rebuilding. The Test/Live
 * mode itself is NOT persisted — every cold start defaults to Test
 * (mock data), per product spec.
 *
 * Components subscribe via the useSettings() hook to re-render when
 * settings change (e.g. user flips Test→Live → grids should refetch).
 *
 * Reads from import.meta.env as the initial fallback so a power user
 * can still preconfigure with a .env file.
 */

import { useEffect, useState } from 'react';

const LS_KEY = 'tvapp.settings.v1';

// ── Defaults from build-time env ─────────────────────────
const ENV_URL  = (typeof import.meta !== 'undefined' && import.meta.env?.VITE_STASH_URL)
  || 'http://localhost:9999';
const ENV_KEY  = (typeof import.meta !== 'undefined' && import.meta.env?.VITE_STASH_API_KEY)
  || '';
const ENV_MOCK  = (typeof import.meta !== 'undefined' && import.meta.env?.VITE_USE_MOCK === 'true')

// ── In-memory state ──────────────────────────────────────
let state = loadFromStorage();

function loadFromStorage() {
  let saved = {};
  try {
    const raw = localStorage.getItem(LS_KEY);
    if (raw) saved = JSON.parse(raw) || {};
  } catch (e) {
    // Corrupt or unavailable storage — ignore, fall back to env
  }
  return {
    stashUrl: saved.stashUrl || ENV_URL,
    stashKey: saved.stashKey || ENV_KEY,
    // Preview mute is per-device user preference; persists.
    previewMuted: saved.previewMuted !== undefined ? !!saved.previewMuted : true,
    useMock: ENV_MOCK,
  };
}

function persistToStorage() {
  try {
    localStorage.setItem(LS_KEY, JSON.stringify({
      stashUrl: state.stashUrl,
      stashKey: state.stashKey,
      previewMuted: state.previewMuted,
    }));
  } catch (e) {
    // Storage full / disabled — fail silently, runtime state still works
  }
}

// ── Subscribers ──────────────────────────────────────────
const listeners = new Set();
function notify() {
  listeners.forEach(fn => fn(state));
}

// ── Public API ───────────────────────────────────────────
export function getSettings() {
  return state;
}

export function setSettings(patch) {
  state = { ...state, ...patch };
  // Persist URL/key/previewMuted — `useMock` stays in-memory by design.
  if ('stashUrl' in patch || 'stashKey' in patch || 'previewMuted' in patch) {
    persistToStorage();
  }
  notify();
}

export function subscribeSettings(fn) {
  listeners.add(fn);
  return () => listeners.delete(fn);
}

/**
 * React hook — returns the current settings and re-renders on change.
 */
export function useSettings() {
  const [snapshot, setSnapshot] = useState(state);
  useEffect(() => subscribeSettings(setSnapshot), []);
  return snapshot;
}

/**
 * Test a Stash connection without committing the values to the store.
 * Returns { ok: true, version } on success, { ok: false, reason } on failure.
 * Used by the Settings panel's "Test connection" button.
 */
export async function testStashConnection({ url, key }) {
  if (!url) return { ok: false, reason: 'Endpoint URL is required.' };

  const headers = { 'Content-Type': 'application/json' };
  if (key) headers['ApiKey'] = key;

  let res;
  try {
    res = await fetch(`${url.replace(/\/$/, '')}/graphql`, {
      method: 'POST',
      headers,
      body: JSON.stringify({ query: '{ version { version } }' }),
    });
  } catch (e) {
    return { ok: false, reason: 'Cannot reach server. Check the URL.' };
  }

  if (res.status === 401 || res.status === 403) {
    return { ok: false, reason: 'Authentication failed. Check the API key.' };
  }
  if (!res.ok) {
    return { ok: false, reason: `Server returned HTTP ${res.status}.` };
  }

  let json;
  try { json = await res.json(); }
  catch { return { ok: false, reason: 'Server returned invalid JSON.' }; }

  if (json.errors) {
    return { ok: false, reason: json.errors[0]?.message || 'GraphQL error.' };
  }

  const v = json.data?.version?.version;
  if (!v) return { ok: false, reason: 'Unexpected response from server.' };

  return { ok: true, version: v };
}

/**
 * Wipe persisted settings, reset in-memory state to defaults, and
 * notify subscribers. The data tree will remount via the dataKey
 * change in App.jsx.
 */
export function clearSettings() {
  try { localStorage.removeItem(LS_KEY); } catch (e) { /* ignore */ }
  state = {
    stashUrl: ENV_URL,
    stashKey: ENV_KEY,
    previewMuted: true,
    useMock: true,
  };
  notify();
}