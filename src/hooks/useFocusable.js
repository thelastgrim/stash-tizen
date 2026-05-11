/**
 * useFocusable — attach to any element to make it TV-navigable
 *
 * Zones group elements for D-pad navigation:
 *   - Within a zone, Left/Right/Up/Down move freely.
 *   - Crossing zones happens via Up/Down only (typical TV pattern).
 *   - This prevents Left/Right from "leaking" out of horizontal rows.
 *
 * Usage:
 *   const { ref, focused } = useFocusable({
 *     id: 'my-btn',
 *     zone: 'grid',
 *   });
 */

import { useRef, useState, useEffect, useCallback, useId } from 'react';

const registry = new Map();
let currentFocusId = null;

export { registry };
export function setCurrentFocusId(id) { currentFocusId = id; }
export function getCurrentFocusId() { return currentFocusId; }

export function useFocusable({
  id: propId,
  zone = null,
  group = null,          // legacy alias for `zone`
  onFocus,
  onBlur,
  onEnter,
  disabled = false,
  autoFocus = false,
} = {}) {
  const generatedId = useId();
  const id = propId || generatedId;
  const ref = useRef(null);
  const [focused, setFocused] = useState(false);

  const effectiveZone = zone ?? group;

  const callbacksRef = useRef({ onFocus, onBlur, onEnter });
  useEffect(() => {
    callbacksRef.current = { onFocus, onBlur, onEnter };
  });

  const autoFocusedRef = useRef(false);

  useEffect(() => {
    const el = ref.current;
    if (!el || disabled) return;

    if (!el.getAttribute('tabindex')) {
      el.setAttribute('tabindex', '0');
    }

    const handleFocus = () => {
      setFocused(true);
      currentFocusId = id;
      callbacksRef.current.onFocus?.();
      // Keep the focused card centered in its scroll container. The
      // `block: 'nearest'` mode only scrolls when the element is out of
      // view — feels more natural than constant centering. Combined
      // with `scroll-behavior: smooth` on grid wrappers, this animates.
      if (el.scrollIntoView) {
        el.scrollIntoView({ block: 'nearest', inline: 'nearest' });
      }
    };

    const handleBlur = () => {
      setFocused(false);
      callbacksRef.current.onBlur?.();
    };

    const handleKeyDown = (e) => {
      if (e.key === 'Enter' || e.keyCode === 13) {
        callbacksRef.current.onEnter?.();
        e.preventDefault();
      }
    };

    el.addEventListener('focus', handleFocus);
    el.addEventListener('blur', handleBlur);
    el.addEventListener('keydown', handleKeyDown);

    registry.set(id, { el, zone: effectiveZone });

    if (autoFocus && !autoFocusedRef.current) {
      autoFocusedRef.current = true;
      const t = setTimeout(() => el.focus(), 50);
      return () => {
        clearTimeout(t);
        el.removeEventListener('focus', handleFocus);
        el.removeEventListener('blur', handleBlur);
        el.removeEventListener('keydown', handleKeyDown);
        registry.delete(id);
        if (currentFocusId === id) currentFocusId = null;
      };
    }

    return () => {
      el.removeEventListener('focus', handleFocus);
      el.removeEventListener('blur', handleBlur);
      el.removeEventListener('keydown', handleKeyDown);
      registry.delete(id);
      if (currentFocusId === id) currentFocusId = null;
    };
  }, [id, effectiveZone, disabled, autoFocus]);

  const focus = useCallback(() => {
    ref.current?.focus();
  }, []);

  return { ref, focused, focus, id };
}
