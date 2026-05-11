/**
 * PerformerDetailPage — Hero header + filtered video grid
 *
 * Shown when a performer is selected from the Performers grid.
 * Owns its own controls state (independent of the app-level Home
 * controls). Filters videos to scenes featuring this performer
 * via Stash's standard scene filter shape.
 *
 * Backspace / Tizen Back returns to the performer grid.
 */

import React, { useEffect, useState, useMemo } from 'react';
import VideoGrid from '../components/VideoGrid.jsx';
import ControlsPanel from '../components/ControlsPanel.jsx';
import { useFocusable } from '../hooks/useFocusable.js';
import styles from './PerformerDetailPage.module.css';

const TIZEN_BACK = 10009;

// Scene sort groups for the inner video grid — same set as Home, but
// kept local so we don't have to thread them down from App.
const SCENE_SORT_GROUPS = [
  {
    group: 'General',
    options: [
      { value: 'created_at',     label: 'Date Added' },
      { value: 'updated_at',     label: 'Date Updated' },
      { value: 'title',          label: 'Title' },
      { value: 'random',         label: 'Random' },
    ],
  },
  {
    group: 'Engagement',
    options: [
      { value: 'rating',         label: 'Rating' },
      { value: 'o_counter',      label: 'Likes' },
      { value: 'play_count',     label: 'Play Count' },
      { value: 'play_duration',  label: 'Play Duration' },
      { value: 'last_played_at', label: 'Last Played' },
    ],
  },
  {
    group: 'File',
    options: [
      { value: 'duration',       label: 'Duration' },
      { value: 'filesize',       label: 'File Size' },
      { value: 'resolution',     label: 'Resolution' },
      { value: 'bitrate',        label: 'Bitrate' },
      { value: 'framerate',      label: 'Frame Rate' },
    ],
  },
];

const DEFAULT_DETAIL_CONTROLS = {
  sort:  'created_at',
  order: 'desc',
  cols:  4,
  search: '',
};

// Compute an age string from an ISO birthdate
function ageFromBirthdate(iso) {
  if (!iso) return null;
  const d = new Date(iso);
  if (isNaN(d.getTime())) return null;
  const now = new Date();
  let age = now.getFullYear() - d.getFullYear();
  const m = now.getMonth() - d.getMonth();
  if (m < 0 || (m === 0 && now.getDate() < d.getDate())) age--;
  return age;
}

function formatHeight(cm) {
  if (!cm) return null;
  const totalInches = cm / 2.54;
  const ft = Math.floor(totalInches / 12);
  const inches = Math.round(totalInches - ft * 12);
  return `${cm} cm · ${ft}′${inches}″`;
}

// ── Back button — focusable so mouse/click users have a path ─
function BackButton({ onClick }) {
  const { ref, focused } = useFocusable({
    id: 'detail-back',
    zone: 'detail-header',
    onEnter: onClick,
    autoFocus: true,
  });
  return (
    <button
      ref={ref}
      className={`${styles.backBtn} ${focused ? styles.focused : ''}`}
      onClick={onClick}
      aria-label="Back to performers"
    >
      <svg width="20" height="20" viewBox="0 0 20 20" fill="none" aria-hidden="true">
        <path d="M12 5l-5 5 5 5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
      </svg>
      <span>Back</span>
    </button>
  );
}

// ── Main component ──────────────────────────────────────
export default function PerformerDetailPage({ performer, onBack, onVideoSelect, previewMuted, onMuteToggle }) {
  const [controls, setControls] = useState(DEFAULT_DETAIL_CONTROLS);

  // Filter scenes to those including this performer. Memoised so we
  // don't trigger downstream re-fetches when other state changes.
  const objectFilter = useMemo(() => ({
    performers: { value: [String(performer.id)], modifier: 'INCLUDES' },
  }), [performer.id]);

  const updateControls = (patch) => {
    setControls(prev => ({ ...prev, ...patch }));
  };

  // Page-level Back handler — capture phase so the global Back
  // doesn't fire its tab-switching behaviour first.
  useEffect(() => {
    const onKey = (e) => {
      const ae = document.activeElement;
      const inText =
        ae && (
          (ae.tagName === 'INPUT' && !['button','submit','checkbox','radio','range'].includes(ae.type)) ||
          ae.tagName === 'TEXTAREA' ||
          ae.isContentEditable
        );
      if (inText) return;

      if (e.key === 'Escape' || e.key === 'Backspace' || e.keyCode === TIZEN_BACK) {
        e.preventDefault();
        e.stopPropagation();
        onBack?.();
      }
    };
    window.addEventListener('keydown', onKey, true);
    return () => window.removeEventListener('keydown', onKey, true);
  }, [onBack]);

  const age = ageFromBirthdate(performer.birthdate);
  const height = formatHeight(performer.height_cm);

  return (
    <div className={styles.page}>
      {/* ── Hero header ─────────────────────────────────── */}
      <header className={styles.hero}>
        <div className={styles.heroLeft}>
          <BackButton onClick={onBack} />
          {performer.image_path ? (
            <img
              src={performer.image_path}
              alt=""
              className={styles.image}
              loading="lazy"
            />
          ) : (
            <div className={styles.imageFallback}>
              <span>{performer.name?.[0] || '?'}</span>
            </div>
          )}
        </div>

        <div className={styles.heroRight}>
          <h1 className={styles.name}>
            {performer.name}
            {performer.favorite && <span className={styles.favorite} aria-label="Favorite">★</span>}
          </h1>

          {performer.disambiguation && (
            <p className={styles.disambiguation}>{performer.disambiguation}</p>
          )}

          <div className={styles.metaRow}>
            <span className={styles.sceneCount}>
              <strong>{performer.scene_count}</strong> {performer.scene_count === 1 ? 'scene' : 'scenes'}
            </span>
            {performer.rating && (
              <span className={styles.rating}>★ {performer.rating}</span>
            )}
            {performer.country && <span>{performer.country}</span>}
            {age != null && <span>Age {age}</span>}
            {height && <span>{height}</span>}
          </div>

          {performer.details && (
            <p className={styles.bio}>{performer.details}</p>
          )}
        </div>
      </header>

      {/* ── Controls panel for the inner grid ───────────── */}
      <ControlsPanel
        controls={controls}
        onChange={updateControls}
        modeOptions={null}
        sortGroups={SCENE_SORT_GROUPS}
        showOrder={true}
        showGridSize={true}
        filterOptions={null}
        showSearch={true}
        previewMuted={previewMuted}
        onMuteToggle={onMuteToggle}
      />

      {/* ── Video grid filtered to this performer ───────── */}
      <VideoGrid
        controls={controls}
        objectFilter={objectFilter}
        searchQuery={controls.search || ''}
        onVideoSelect={onVideoSelect}
      />
    </div>
  );
}
