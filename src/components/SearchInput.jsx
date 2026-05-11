/**
 * SearchInput — Debounced text input for the controls panel.
 *
 * The input value reflects what the user is typing (snappy feedback),
 * but onChange fires only after a debounce window so we don't refetch
 * on every keystroke.
 *
 * Arrow keys inside the input are NOT intercepted by the spatial nav
 * (useKeyHandler skips text inputs), so the user can move the caret
 * normally. Up/Down to leave the input still works because focus
 * shifts to a sibling control.
 */

import React, { useState, useEffect, useRef } from 'react';
import { useFocusable } from '../hooks/useFocusable.js';
import styles from './SearchInput.module.css';

const DEBOUNCE_MS = 300;

export default function SearchInput({ value, onChange, placeholder = 'Search…' }) {
  const [draft, setDraft] = useState(value || '');
  const debounceRef = useRef(null);

  // External value resets (e.g. tab change) should reset the draft.
  useEffect(() => { setDraft(value || ''); }, [value]);

  const { ref, focused } = useFocusable({
    id: 'ctrl-search',
    zone: 'controls',
  });

  const handleChange = (e) => {
    const next = e.target.value;
    setDraft(next);
    clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => onChange(next), DEBOUNCE_MS);
  };

  // Commit immediately on Enter so the user feels in control.
  const handleKeyDown = (e) => {
    if (e.key === 'Enter') {
      clearTimeout(debounceRef.current);
      onChange(draft);
      // Don't blur — user may want to refine further.
    }
  };

  useEffect(() => () => clearTimeout(debounceRef.current), []);

  const showClear = draft.length > 0;

  return (
    <div className={styles.control}>
      <span className={styles.controlLabel}>Search</span>
      <div className={`${styles.inputWrap} ${focused ? styles.focused : ''}`}>
        <svg className={styles.icon} width="14" height="14" viewBox="0 0 14 14" fill="none" aria-hidden="true">
          <circle cx="6" cy="6" r="4.5" stroke="currentColor" strokeWidth="1.5"/>
          <path d="M9.5 9.5L13 13" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
        </svg>
        <input
          ref={ref}
          type="text"
          value={draft}
          onChange={handleChange}
          onKeyDown={handleKeyDown}
          placeholder={placeholder}
          className={styles.input}
          spellCheck={false}
          autoCapitalize="off"
          autoCorrect="off"
        />
        {showClear && (
          <button
            className={styles.clearBtn}
            onClick={() => { setDraft(''); onChange(''); }}
            aria-label="Clear search"
            tabIndex={-1}
          >×</button>
        )}
      </div>
    </div>
  );
}
