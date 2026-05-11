/**
 * useKeyHandler — global D-pad key handler with zone-aware spatial nav
 *
 * Performance: rects are cached per-element and invalidated only on
 * scroll/resize. Without caching, each arrow press would call
 * getBoundingClientRect() 40+ times — a known cause of D-pad lag on
 * weak TV CPUs (Tizen).
 *
 * Held-key navigation is throttled to MIN_REPEAT_MS so spatial nav
 * doesn't get spammed by 30Hz key-repeat from the remote.
 *
 * While navigating, document.body gets the `is-navigating` class — CSS
 * uses this to dial down expensive transitions during rapid input.
 */

import { useEffect } from 'react';
import { registry, getCurrentFocusId } from './useFocusable.js';

const TIZEN_BACK = 10009;
const CROSS_ZONE_PENALTY = 100000;
const MIN_REPEAT_MS = 90;          // throttle held arrows to ~11 Hz
const NAV_CLASS_RELEASE_MS = 180;  // when keys idle this long, drop is-navigating

// ── Rect cache ───────────────────────────────────────────
// Cleared on scroll/resize. Within a single keypress burst the rects
// are stable, so we read each element's geometry at most once per burst.
const rectCache = new WeakMap();

function getRect(el) {
  let r = rectCache.get(el);
  if (!r) {
    r = el.getBoundingClientRect();
    rectCache.set(el, r);
  }
  return r;
}

function clearRectCache() {
  // WeakMap doesn't have .clear() in older engines, so swap in a new one.
  // Since we only reach this path on scroll/resize (rare), the GC of the
  // old map is fine.
  rectCacheRef.current = new WeakMap();
}

// Indirection so clearRectCache can replace the underlying map.
const rectCacheRef = { current: rectCache };
function getCachedRect(el) {
  let r = rectCacheRef.current.get(el);
  if (!r) {
    r = el.getBoundingClientRect();
    rectCacheRef.current.set(el, r);
  }
  return r;
}

function centerOf(rect) {
  return { x: rect.left + rect.width / 2, y: rect.top + rect.height / 2 };
}

function modalScopeOf(el) {
  let n = el;
  while (n && n !== document.body) {
    if (n.getAttribute && n.getAttribute('role') === 'dialog') return n;
    n = n.parentElement;
  }
  return null;
}

function findBestCandidate(direction, currentEl, currentZone) {
  const isHorizontal = direction === 'left' || direction === 'right';
  const curRect = getCachedRect(currentEl);
  const curCx = curRect.left + curRect.width / 2;
  const curCy = curRect.top + curRect.height / 2;

  // Active modal scope — when set, candidates outside it are excluded.
  // Falls back to any open dialog in the DOM if the user is currently
  // focused on something outside the modal (e.g. body) but a modal is
  // visible. This handles the moment a modal opens before its first
  // autoFocus has fired.
  let scope = modalScopeOf(currentEl);
  if (!scope) {
    scope = document.querySelector('[role="dialog"]');
  }

  let bestEl = null;
  let bestScore = Infinity;

  registry.forEach(({ el, zone }) => {
    if (el === currentEl || !el.offsetParent) return;
    if (isHorizontal && zone !== currentZone) return;
    if (scope && !scope.contains(el)) return;

    const rect = getCachedRect(el);
    const dx = (rect.left + rect.width / 2) - curCx;
    const dy = (rect.top + rect.height / 2) - curCy;

    let primary, secondary;
    switch (direction) {
      case 'up':    if (dy >= -4) return; primary = -dy; secondary = dx < 0 ? -dx : dx; break;
      case 'down':  if (dy <=  4) return; primary =  dy; secondary = dx < 0 ? -dx : dx; break;
      case 'left':  if (dx >= -4) return; primary = -dx; secondary = dy < 0 ? -dy : dy; break;
      case 'right': if (dx <=  4) return; primary =  dx; secondary = dy < 0 ? -dy : dy; break;
      default: return;
    }

    let score = primary + secondary * 1.5;
    if (!isHorizontal && zone !== currentZone) score += CROSS_ZONE_PENALTY;

    if (score < bestScore) { bestScore = score; bestEl = el; }
  });

  return bestEl;
}

export function useKeyHandler({ onBack } = {}) {
  useEffect(() => {
    let lastNavAt = 0;
    let navClassTimer = null;

    const setNavigating = () => {
      document.body.classList.add('is-navigating');
      clearTimeout(navClassTimer);
      navClassTimer = setTimeout(
        () => document.body.classList.remove('is-navigating'),
        NAV_CLASS_RELEASE_MS,
      );
    };

    const handleKeyDown = (e) => {
      const key = e.key;
      let direction = null;
      if (key === 'ArrowUp'    || e.keyCode === 38) direction = 'up';
      if (key === 'ArrowDown'  || e.keyCode === 40) direction = 'down';
      if (key === 'ArrowLeft'  || e.keyCode === 37) direction = 'left';
      if (key === 'ArrowRight' || e.keyCode === 39) direction = 'right';

      if (direction) {
        // When focus is in a text field, Left/Right belong to the caret
        // (move within the value). Up/Down don't position the caret in a
        // single-line input — the browser's default is "jump to start/
        // end of value", which traps the user. So we still run spatial
        // nav for Up/Down on inputs, just not for Left/Right.
        const ae = document.activeElement;
        const isTextInput =
          ae && (
            (ae.tagName === 'INPUT' && !['button', 'submit', 'checkbox', 'radio', 'range'].includes(ae.type)) ||
            ae.tagName === 'TEXTAREA' ||
            ae.isContentEditable
          );
        const isHorizontal = direction === 'left' || direction === 'right';
        if (isTextInput && isHorizontal) return;

        // For TEXTAREA specifically, Up/Down do move the caret between
        // lines, so respect those too. Single-line INPUT doesn't have rows.
        if (isTextInput && ae.tagName === 'TEXTAREA') return;

        e.preventDefault();

        // Throttle held-key repeats — TV remotes spam keydown ~30 Hz.
        const now = performance.now();
        if (now - lastNavAt < MIN_REPEAT_MS) return;
        lastNavAt = now;
        setNavigating();

        // Invalidate cached rects on every keypress. The cache helps for
        // multiple lookups within a single keypress, but between keypresses
        // CSS transitions and layout-affecting re-renders can change positions
        // without triggering scroll/resize events. Clearing per-press costs
        // very little (one Map allocation) and prevents stale-rect bugs.
        rectCacheRef.current = new WeakMap();

        const currentId = getCurrentFocusId();
        const currentEntry = currentId ? registry.get(currentId) : null;
        const currentEl = currentEntry?.el || document.activeElement;
        const currentZone = currentEntry?.zone || null;

        if (currentEl && registry.size > 0) {
          const best = findBestCandidate(direction, currentEl, currentZone);
          if (best) best.focus();
        } else {
          for (const { el } of registry.values()) {
            if (el.offsetParent) { el.focus(); break; }
          }
        }
        return;
      }

      if (key === 'Backspace' || e.keyCode === TIZEN_BACK) {
        // The on-screen keyboard's delete button sends Backspace. Don't
        // interpret that as the global Back action while a text field
        // has focus — let the browser delete the character normally.
        // Tizen Back (10009) still triggers onBack regardless, since it's
        // a hardware key with no text-editing meaning.
        const ae = document.activeElement;
        const inText =
          ae && (
            (ae.tagName === 'INPUT' && !['button','submit','checkbox','radio','range'].includes(ae.type)) ||
            ae.tagName === 'TEXTAREA' ||
            ae.isContentEditable
          );
        if (inText && key === 'Backspace') return;
        onBack?.();
      }
    };

    // Geometry changes — drop cached rects.
    const invalidate = () => { rectCacheRef.current = new WeakMap(); };

    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('resize', invalidate);
    window.addEventListener('scroll', invalidate, true); // capture: catches scroll on inner containers too

    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('resize', invalidate);
      window.removeEventListener('scroll', invalidate, true);
      clearTimeout(navClassTimer);
      document.body.classList.remove('is-navigating');
    };
  }, [onBack]);
}