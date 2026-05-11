/**
 * MarkerCard — Marker thumbnail with auto-playing stream on focus.
 *
 * On focus, the marker's `stream` URL is loaded into a <video> and
 * starts playing. Activating (Enter) plays the parent scene's full
 * stream from `marker.seconds` (handled in App's onSelect).
 */

import React, { useState, useRef, useEffect } from 'react';
import { useFocusable } from '../hooks/useFocusable.js';
import styles from './MarkerCard.module.css';
import { useSettings } from '../utils/settings.js';

const PREVIEW_DELAY_MS = 800;

function formatTimestamp(seconds) {
  if (!isFinite(seconds) || seconds < 0) return '0:00';
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = Math.floor(seconds % 60);
  const mm = String(m).padStart(2, '0');
  const ss = String(s).padStart(2, '0');
  return h > 0 ? `${h}:${mm}:${ss}` : `${m}:${ss}`;
}

export default function MarkerCard({ marker, index, onSelect }) {
  const [imgError, setImgError] = useState(false);
  const [showStream, setShowStream] = useState(false);
  const videoRef = useRef(null);
  const timerRef = useRef(null);
  const settings = useSettings();
  const muted = settings.previewMuted;

  const { ref, focused } = useFocusable({
    id: `marker-${marker.id}`,
    zone: 'grid',
    onEnter: () => onSelect?.(marker),
    autoFocus: index === 0,
  });

  // Play the marker stream on focus (debounced so rapid scrolling
  // doesn't trigger network requests for every card the cursor passes).
  useEffect(() => {
    if (focused && marker.markerStream) {
      timerRef.current = setTimeout(() => {
        if (document.body.classList.contains('is-navigating')) return;
        setShowStream(true);
      }, PREVIEW_DELAY_MS);
    } else {
      clearTimeout(timerRef.current);
      setShowStream(false);
    }
    return () => clearTimeout(timerRef.current);
  }, [focused, marker.markerStream]);

  return (
    <button
      ref={ref}
      className={`${styles.card} ${focused ? styles.focused : ''}`}
      onClick={() => onSelect?.(marker)}
      aria-label={`${marker.title}, in ${marker.scene.title} at ${formatTimestamp(marker.seconds)}`}
    >
      <div className={styles.thumb}>
        {!imgError && marker.screenshot ? (
          <img
            src={marker.screenshot}
            alt=""
            className={styles.img}
            onError={() => setImgError(true)}
            loading="lazy"
          />
          // <video
          //   src={marker.markerStream}
          //   className={styles.img}
          //   autoPlay
          //   muted
          //   loop
          //   playsInline
          //   preload="metadata"
          //   onError={() => setImgError(true)}
          // />
        ) : (
          <div className={styles.imgFallback}>
            <span>{marker.title?.[0] || '?'}</span>
          </div>
        )}

        {marker.markerStream && showStream && (
          <video
            ref={videoRef}
            className={`${styles.preview} ${showStream ? styles.previewVisible : ''}`}
            src={marker.markerStream}
            muted={muted}
            loop
            autoPlay
            playsInline
            preload="none"
          />
        )}

        <div className={styles.overlay}>
          <div className={styles.playIcon}>▶</div>
        </div>

        <div className={styles.timestamp}>{formatTimestamp(marker.seconds)}</div>
        {marker.primaryTag && (
          <div className={styles.tag}>{marker.primaryTag}</div>
        )}
      </div>

      <div className={styles.info}>
        <p className={styles.title}>{marker.title}</p>
        <p className={styles.scene}>{marker.scene.title}</p>
      </div>
    </button>
  );
}
