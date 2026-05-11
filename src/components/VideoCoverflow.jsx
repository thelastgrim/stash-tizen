/**
 * VideoCoverflow — 3D coverflow layout
 *
 * Cards arranged on a virtual rail. Center card sits flat and forward;
 * neighbours rotate around the Y axis toward the camera. A floor
 * reflection sells the depth. Same focus-tracking pattern as the
 * carousel — listens to focusin and recenters on the focused index.
 *
 * Reuses VideoCard. Reads sort/order from `controls`.
 */

import React, { useState, useEffect, useRef, useCallback } from 'react';
import VideoCard from './VideoCard.jsx';
import { fetchVideos } from '../utils/videoService.js';
import { getCurrentFocusId } from '../hooks/useFocusable.js';
import styles from './VideoCoverflow.module.css';
import { useSettings } from '../utils/settings.js';

const PAGE_SIZE = 40;
const LOAD_MORE_THRESHOLD = 8;

// Layout constants — tweak to taste
const SLOT_W       = 460;   // base card width in px
const X_SPACING    = 320;   // horizontal distance between adjacent card centres
const SIDE_ROT     = 55;    // degrees neighbours rotate around Y
const SIDE_Z_BASE  = -200;  // base Z recede for first neighbour
const RENDER_RANGE = 5    // cards to render on each side of focus

export default function VideoCoverflow({ controls, objectFilter, searchQuery, onVideoSelect }) {
  
  const { sort, order } = controls;

  const [videos, setVideos] = useState([]);
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const [focusedIndex, setFocusedIndex] = useState(0);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState(null);
  const [showPreview, setShowPreview] = useState(false);

  const requestIdRef = useRef(0);
  const muted = useSettings().previewMuted;

  // ── Reset on sort/order/filter change ─────────────────────
  useEffect(() => {
    const reqId = ++requestIdRef.current;
    let cancelled = false;

    setLoading(true);
    setError(null);
    setVideos([]);
    setPage(1);
    setTotal(0);
    setFocusedIndex(0);

    fetchVideos({ sort, order, filter: objectFilter, q: searchQuery, page: 1, limit: PAGE_SIZE })
      .then(data => {
        if (cancelled || reqId !== requestIdRef.current) return;
        setVideos(data.videos);
        setTotal(data.total);
        setLoading(false);
      })
      .catch(e => {
        if (cancelled || reqId !== requestIdRef.current) return;
        setError(e.message);
        setLoading(false);
      });

    return () => { cancelled = true; };
  }, [sort, order, objectFilter, searchQuery]);

  // ── Pagination ────────────────────────────────────────────
  const loadMore = useCallback(async () => {
    if (loadingMore || loading) return;
    if (videos.length >= total && total > 0) return;

    const reqId = requestIdRef.current;
    const nextPage = page + 1;

    setLoadingMore(true);
    try {
      const data = await fetchVideos({
        sort, order, filter: objectFilter, q: searchQuery,
        page: nextPage, limit: PAGE_SIZE,
      });
      if (reqId !== requestIdRef.current) return;
      setVideos(prev => {
        const seen = new Set(prev.map(v => v.id));
        const fresh = data.videos.filter(v => !seen.has(v.id));
        return [...prev, ...fresh];
      });
      setPage(nextPage);
      if (data.total) setTotal(data.total);
    } catch (e) {
      if (reqId === requestIdRef.current) setError(e.message);
    } finally {
      if (reqId === requestIdRef.current) setLoadingMore(false);
    }
  }, [loadingMore, loading, videos.length, total, page, sort, order, objectFilter, searchQuery]);

  useEffect(() => {
    if (videos.length === 0) return;
    if (videos.length - focusedIndex <= LOAD_MORE_THRESHOLD) loadMore();
  }, [focusedIndex, videos.length, loadMore]);

  const [isFocusInGrid, setIsFocusInGrid] = useState(false);

  // ── Track which card is focused ───────────────────────────
  useEffect(() => {
    const onFocus = () => {
      const fid = getCurrentFocusId();
      const inGrid = !!fid && fid.startsWith('video-');
      setIsFocusInGrid(inGrid);
      if (!inGrid) return;
      const id = fid.slice('video-'.length);
      const idx = videos.findIndex(v => String(v.id) === String(id));
      if (idx >= 0 && idx !== focusedIndex) setFocusedIndex(idx);
    };
    document.addEventListener('focusin', onFocus);
    return () => document.removeEventListener('focusin', onFocus);
  }, [videos, focusedIndex]);
  

  // ── Render ────────────────────────────────────────────────
  if (loading) return (
    <div className={styles.state}>
      <div className={styles.spinner} aria-label="Loading videos" />
      <p className={styles.stateText}>Loading videos…</p>
    </div>
  );

  if (error && !videos.length) return (
    <div className={styles.state}>
      <p className={styles.stateText} style={{ color: 'var(--red)' }}>Error: {error}</p>
    </div>
  );

  if (!videos.length) return (
    <div className={styles.state}>
      <p className={styles.stateText}>No videos found.</p>
    </div>
  );

  const focused = videos[focusedIndex] || videos[0];
  const focusedHasPreview = !!focused?.preview;

  return (
    <div className={styles.wrapper}>
      {/* Hero info above the stage */}
      <div className={styles.hero}>
        <h2 className={styles.heroTitle}>{focused.title}</h2>
        <div className={styles.heroMeta}>
          {focused.year && <span>{focused.year}</span>}
          {focused.duration && <span>{focused.duration}</span>}
          {focused.category && <span className={styles.heroTag}>{focused.category}</span>}
          {focused.rating && <span className={styles.heroRating}>★ {focused.rating}</span>}
        </div>
        <div className={styles.heroCounter}>
          <span className={styles.heroCounterCur}>{focusedIndex + 1}</span>
          <span className={styles.heroCounterSep}>/</span>
          <span className={styles.heroCounterTotal}>{total || videos.length}</span>
        </div>
      </div>

      <div className={styles.stage}>
        <div className={styles.scene}>
          {videos.map((video, i) => {
            const offset = i - focusedIndex;
            const abs = Math.abs(offset);
            if (abs > RENDER_RANGE) return null;

            const sign = Math.sign(offset);
            // Rotation: 0 at center, ±SIDE_ROT for first neighbours,
            // increasing slightly further out (capped near 70°).
            const rotY = sign * Math.min(70, SIDE_ROT + Math.max(0, abs - 1) * 4);
            // Z depth: focused card is closest, neighbours recede.
            const z = abs === 0 ? 0 : SIDE_Z_BASE * (0.6 + abs * 0.4);
            const x = offset * X_SPACING;
            const cardScale = abs === 0 && isFocusInGrid ? 1.05 : 1;
            const opacity   = abs === 0 ? 1 : Math.max(0.4, 1 - abs * 0.15);

            // The slot is anchored at top:50% with translateY(-50%) in
            // CSS (vertical centring). The inline transform handles
            // X position, Z depth, Y rotation, and uniform scale —
            // all relative to the slot's centred anchor.
            const transform =
              abs === 0
                ? `translateY(-50%) translate3d(${x}px, 0, ${z}px) scale(${cardScale})`
                : `translateY(-50%) translate3d(${x}px, 0, ${z}px) rotateY(${-rotY}deg) scale(${cardScale})`;

            return (
              <div
                key={video.id}
                className={`${styles.slot} ${abs === 0 ? styles.slotFocused : ''}`}
                style={{
                  width: `${SLOT_W}px`,
                  transform,
                  opacity,
                  zIndex: 100 - abs,
                }}
                aria-hidden={abs !== 0}
              >
                <VideoCard
                  video={video}
                  index={i}
                  onSelect={onVideoSelect}
                  disablePreview //breaks in 3d
                />
                {/* Reflection — flipped clone of the thumbnail fades
                    into the floor. Only the central few cards get one;
                    far-side cards aren't large enough on screen to
                    benefit. */}
                {abs <= 2 && video.thumbnail && (
                  <div
                    className={styles.reflection}
                    style={{ backgroundImage: `url("${video.thumbnail}")` }}
                    aria-hidden="true"
                  />
                )}
              </div>
            );
          })}
        </div>

        {/* {focusedHasPreview && isFocusInGrid &&(
          <video
            key={focused.id}
            className={styles.heroPreview}
            src={focused.preview}
            muted={muted}
            autoPlay
            loop
            playsInline
            preload="auto"
          />
        )} */}
        
        {/* Floor gradient */}
        <div className={styles.floor} aria-hidden="true" />
      </div>

      {loadingMore && (
        <div className={styles.loadingMore}>
          <div className={styles.spinnerSm} />
          <span>Loading more…</span>
        </div>
      )}
    </div>
  );
}