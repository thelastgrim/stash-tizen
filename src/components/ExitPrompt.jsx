/**
 * ExitPrompt — Modal asking the user to confirm app exit.
 *
 * Shown when the user presses Back at a top-level tab (Home, Markers,
 * Performers grid). On confirm, attempts to exit via tizen.application;
 * silently no-ops in browsers where exit isn't permitted.
 *
 * Spatial nav is trapped inside via the standard role="dialog" check
 * in useKeyHandler.
 */

import React, { useEffect } from 'react';
import { useFocusable } from '../hooks/useFocusable.js';
import styles from './ExitPrompt.module.css';

const TIZEN_BACK = 10009;

function ActionButton({ id, label, primary, onClick, autoFocus }) {
  const { ref, focused } = useFocusable({
    id,
    zone: 'exit-prompt',
    onEnter: onClick,
    autoFocus,
  });
  return (
    <button
      ref={ref}
      className={`${styles.actionBtn} ${primary ? styles.actionPrimary : ''} ${focused ? styles.focused : ''}`}
      onClick={onClick}
    >
      {label}
    </button>
  );
}

export default function ExitPrompt({ onCancel }) {
  // Capture-phase handler — Back/Esc cancels the prompt itself so
  // the user doesn't immediately re-trigger it.
  useEffect(() => {
    const handler = (e) => {
      if (e.key === 'Escape' || e.key === 'Backspace' || e.keyCode === TIZEN_BACK) {
        e.preventDefault();
        e.stopPropagation();
        onCancel?.();
      }
    };
    window.addEventListener('keydown', handler, true);
    return () => window.removeEventListener('keydown', handler, true);
  }, [onCancel]);

  const handleExit = () => {
    // Tizen: real exit. Browser: no-op (browsers won't let pages close
    // themselves except those they opened). The user can press the
    // hardware Exit button or close the tab manually.
    try {
      if (typeof window !== 'undefined' && window.tizen?.application) {
        window.tizen.application.getCurrentApplication().exit();
        return;
      }
    } catch (e) {
      // Fall through
    }
    // Best-effort fallback for browser dev
    window.close();
  };

  return (
    <div className={styles.overlay} role="dialog" aria-label="Exit confirmation" aria-modal="true">
      <div className={styles.panel}>
        <header className={styles.header}>
          <h2 className={styles.title}>Exit app?</h2>
          <p className={styles.subtitle}>You'll return to the home screen.</p>
        </header>
        <footer className={styles.footer}>
          <ActionButton id="exit-cancel" label="Cancel" onClick={onCancel} autoFocus />
          <ActionButton id="exit-confirm" label="Exit" onClick={handleExit} primary />
        </footer>
      </div>
    </div>
  );
}