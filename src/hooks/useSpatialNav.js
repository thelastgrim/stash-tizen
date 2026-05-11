/**
 * useSpatialNav — D-pad spatial navigation for TV/Tizen
 *
 * How it works:
 *  - Maintains a registry of focusable elements with their positions.
 *  - On arrow key press, finds the nearest element in that direction.
 *  - Elements register themselves via useFocusable() hook.
 *  - Groups allow scoping (e.g. within a dropdown).
 *
 * Usage:
 *   const { register, unregister, moveFocus } = useSpatialNav();
 */

import { useEffect, useRef, useCallback } from 'react';

// ── Key Codes (Tizen remote + standard keyboards) ─────────
export const KEYS = {
  UP:     [38, 'ArrowUp'],
  DOWN:   [40, 'ArrowDown'],
  LEFT:   [37, 'ArrowLeft'],
  RIGHT:  [39, 'ArrowRight'],
  ENTER:  [13, 'Enter'],
  BACK:   [8, 'Backspace', 10009], // 10009 = Tizen back key
  RED:    [403],
  GREEN:  [404],
  YELLOW: [405],
  BLUE:   [406],
};

export function keyIs(event, keyGroup) {
  return keyGroup.some(k =>
    k === event.keyCode || k === event.key
  );
}

// ── Singleton focus registry ───────────────────────────────
const registry = new Map(); // id → { el, group, onFocus, onBlur }
let currentFocusId = null;

function getRect(el) {
  return el.getBoundingClientRect();
}

function centerOf(rect) {
  return {
    x: rect.left + rect.width / 2,
    y: rect.top + rect.height / 2,
  };
}

/**
 * Find the best candidate element in a given direction
 * from the currently focused element.
 */
function findBestCandidate(direction, currentEl, group = null) {
  const candidates = [];
  const curRect = getRect(currentEl);
  const curCenter = centerOf(curRect);

  registry.forEach(({ el, group: elGroup }, id) => {
    if (el === currentEl || !el.offsetParent) return;
    if (group && elGroup !== group) return;

    const rect = getRect(el);
    const center = centerOf(rect);
    const dx = center.x - curCenter.x;
    const dy = center.y - curCenter.y;

    let valid = false;
    let primary = 0;
    let secondary = 0;

    switch (direction) {
      case 'up':
        valid = dy < -2;
        primary = Math.abs(dy);
        secondary = Math.abs(dx);
        break;
      case 'down':
        valid = dy > 2;
        primary = Math.abs(dy);
        secondary = Math.abs(dx);
        break;
      case 'left':
        valid = dx < -2;
        primary = Math.abs(dx);
        secondary = Math.abs(dy);
        break;
      case 'right':
        valid = dx > 2;
        primary = Math.abs(dx);
        secondary = Math.abs(dy);
        break;
    }

    if (valid) {
      // Weight: penalize off-axis elements
      const score = primary + secondary * 2;
      candidates.push({ id, el, score });
    }
  });

  if (!candidates.length) return null;
  candidates.sort((a, b) => a.score - b.score);
  return candidates[0];
}

// ── The hook ───────────────────────────────────────────────
export function useSpatialNav() {
  const activeGroup = useRef(null);

  // Register an element into the nav system
  const register = useCallback((id, el, group = null, callbacks = {}) => {
    registry.set(id, { el, group, ...callbacks });
  }, []);

  const unregister = useCallback((id) => {
    registry.delete(id);
    if (currentFocusId === id) currentFocusId = null;
  }, []);

  const focusById = useCallback((id) => {
    const entry = registry.get(id);
    if (!entry) return;
    entry.el.focus();
    currentFocusId = id;
  }, []);

  const focusFirst = useCallback((group = null) => {
    for (const [id, { el, group: g }] of registry) {
      if (group && g !== group) continue;
      if (el.offsetParent !== null) {
        el.focus();
        currentFocusId = id;
        return;
      }
    }
  }, []);

  const moveFocus = useCallback((direction) => {
    if (!currentFocusId) {
      focusFirst();
      return;
    }

    const current = registry.get(currentFocusId);
    if (!current) return;

    const best = findBestCandidate(direction, current.el, activeGroup.current);
    if (best) {
      best.el.focus();
      currentFocusId = best.id;
      return true;
    }
    return false;
  }, [focusFirst]);

  return { register, unregister, focusById, focusFirst, moveFocus, activeGroup };
}
