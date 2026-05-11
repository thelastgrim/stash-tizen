/**
 * VideoCard — Individual video thumbnail card in the grid
 * Shows screenshot as cover; plays preview video on focus.
 */

import React, { useState, useRef, useEffect } from 'react';
import { useFocusable } from '../hooks/useFocusable.js';
import styles from './VideoCard.module.css';
import { useSettings } from '../utils/settings.js';

// Delay before starting preview playback to avoid loading
// previews during rapid focus changes (e.g. holding arrow key).
const PREVIEW_DELAY_MS = 800;

export default function VideoCard({ video, index, onSelect, disablePreview = false }) {
  const [imgError, setImgError] = useState(false);
  const [showPreview, setShowPreview] = useState(false);
  const videoRef = useRef(null);
  const previewTimerRef = useRef(null);
  const settings = useSettings();
  const muted = settings.previewMuted;

  const { ref, focused } = useFocusable({
    id: `video-${video.id}`,
    group: 'grid',
    onEnter: () => onSelect?.(video),
    autoFocus: index === 0,
  });

  // ── Preview playback control on focus change ──────────────
  useEffect(() => {
    if (disablePreview) {
      clearTimeout(previewTimerRef.current);
      setShowPreview(false);
      return;
    }
    if (focused && video.preview) {
      previewTimerRef.current = setTimeout(() => {
        if (document.body.classList.contains('is-navigating')) return;
        setShowPreview(true);
      }, PREVIEW_DELAY_MS);
    } else {
      clearTimeout(previewTimerRef.current);
      setShowPreview(false);
    }
    return () => clearTimeout(previewTimerRef.current);
  }, [focused, video.preview]);

  return (
    <button
      ref={ref}
      className={`${styles.card} ${focused ? styles.focused : ''}`}
      style={{ '--card-index': Math.min(index, 12) }}
      onClick={() => onSelect?.(video)}
      aria-label={`${video.title}${video.year ? `, ${video.year}` : ''}${video.rating ? `, rated ${video.rating}` : ''}`}
    >
      <div className={styles.thumb}>
        {/* Cover screenshot — always rendered */}
        {!imgError && video.thumbnail ? (
          <img
            src={video.thumbnail}
            alt=""
            className={`${styles.img} ${showPreview ? styles.imgHidden : ''}`}
            onError={() => setImgError(true)}
            loading="lazy"
            decoding="async" //CHECK  
          />
        ) : (
          <div className={styles.imgFallback}>
            <span>{video.title?.[0] || '?'}</span>
          </div>
        )}

        {/* Preview video — fades in on focus */}
        {video.preview && showPreview && !disablePreview && (
          <video
            ref={videoRef}
            className={`${styles.preview} ${showPreview ? styles.previewVisible : ''}`}
            src={video.preview}
            muted={muted}
            autoPlay
            loop
            playsInline
            preload="none"
          />
        )}

        <div className={styles.overlay}>
          <div className={styles.playIcon}>▶</div>
        </div>
        
        {video.duration && <div className={styles.duration}>{video.duration}</div>}
        {video.rating && <div className={styles.rating}>★ {video.rating}</div>}
      </div>
        {video.resume_time > 10 && video.durationSeconds > 0 && (
          <div className={styles.resumeBar} aria-hidden="true">
            <div
              className={styles.resumeFill}
              style={{ width: `${Math.min(100, (video.resume_time / video.durationSeconds) * 100)}%` }}
            />
          </div>
        )}

      <div className={styles.info}>
        <p className={styles.title}>{video.title}</p>
        <div className={styles.meta}>
          {video.year && <span className={styles.year}>{video.year}</span>}
          {video.category && <span className={styles.category}>{video.category}</span>}
        </div>
      </div>
    </button>
  );
}
