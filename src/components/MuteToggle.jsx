/**
 * MuteToggle — Speaker icon that toggles preview audio app-wide.
 *
 * When unmuted, focused video cards play their previews with sound.
 * When muted (default), previews stay silent. The setting is
 * persisted across sessions via the settings store.
 *
 * Lives in the ControlsPanel; uses the controls focus zone so D-pad
 * navigation reaches it naturally.
 */

import React from 'react';
import { useFocusable } from '../hooks/useFocusable.js';
import styles from './MuteToggle.module.css';

export default function MuteToggle({ muted, onToggle }) {
  const { ref, focused } = useFocusable({
    id: 'ctrl-mute',
    zone: 'controls',
    onEnter: onToggle,
  });

  return (
    <button
      ref={ref}
      className={`${styles.btn} ${focused ? styles.focused : ''} ${muted ? styles.muted : styles.unmuted}`}
      onClick={onToggle}
      aria-label={muted ? 'Unmute previews' : 'Mute previews'}
      aria-pressed={!muted}
      title={muted ? 'Previews muted' : 'Previews unmuted'}
    >
      {muted ? (
        // Speaker with slash
        <svg width="20" height="20" viewBox="0 0 20 20" fill="none" aria-hidden="true">
          <path d="M3 7v6h3l4 3V4L6 7H3z" fill="currentColor"/>
          <path d="M14 6l5 8M19 6l-5 8" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round"/>
        </svg>
      ) : (
        // Speaker with sound waves
        <svg width="20" height="20" viewBox="0 0 20 20" fill="none" aria-hidden="true">
          <path d="M3 7v6h3l4 3V4L6 7H3z" fill="currentColor"/>
          <path d="M13 7c1.2 1 1.2 5 0 6" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round"/>
          <path d="M16 5c2.5 1.8 2.5 8.2 0 10" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round"/>
        </svg>
      )}
    </button>
  );
}