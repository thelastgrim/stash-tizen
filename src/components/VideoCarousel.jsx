/**
 * VideoCarousel — Horizontal carousel of videos
 *
 * Layout: one focused card in the middle, 2–3 partial cards on each
 * side. Left/Right move the focus through the list and the strip
 * translates to keep the focused card centered.
 *
 * Reuses VideoCard so focus, preview-on-focus, and onSelect behave
 * identically to the grid.
 *
 * Reads `sort` / `order` from `controls` — `cols` and `mode` aren't
 * meaningful here.
 */

import React, { useState, useEffect, useRef, useCallback } from 'react';
import VideoCard from './VideoCard.jsx';
import { fetchVideos } from '../utils/videoService.js';
import {
  registry as focusRegistry,
  getCurrentFocusId,
} from '../hooks/useFocusable.js';
import styles from './VideoCarousel.module.css';

const PAGE_SIZE = 40;
const LOAD_MORE_THRESHOLD = 8; // fetch more when focus is within N of end

export default function VideoCarousel({ controls, objectFilter, searchQuery, onVideoSelect }) {
  const { sort, order } = controls;

  const [videos, setVideos] = useState([]);
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const [focusedIndex, setFocusedIndex] = useState(0);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState(null);

  const requestIdRef = useRef(0);

  // ── Reset on sort/order change ────────────────────────────
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

  // ── Pagination — fetch more when focus approaches end ─────
  const loadMore = useCallback(async () => {
    if (loadingMore || loading) return;
    if (videos.length >= total && total > 0) return;

    const reqId = requestIdRef.current;
    const nextPage = page + 1;

    setLoadingMore(true);
    try {
      const data = await fetchVideos({
        sort,
        order,
        filter: objectFilter,
        q: searchQuery,
        page: nextPage,
        limit: PAGE_SIZE,
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

  // ── Track which card is focused ───────────────────────────
  // VideoCard registers itself with id `video-${id}`, zone `grid`.
  // We poll the focus registry on each navigation event by listening
  // for focus changes via the focus registry — simplest path is to
  // wrap our own focus listener since useFocusable sets currentFocusId.
  useEffect(() => {
    const onFocus = () => {
      const fid = getCurrentFocusId();
      if (!fid || !fid.startsWith('video-')) return;
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

  // Each slot is a fixed width; the strip translates so the focused
  // slot is centered. CSS handles the visual scaling for off-center
  // cards via :not(.focused) selectors and depth indices.
  const focused = videos[focusedIndex] || videos[0];

  return (
    <div className={styles.carouselWrapper}>
      {/* Hero info above the strip — title, meta, position */}
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

      {/* The strip — shifted so the focused slot lands in the middle */}
      <div className={styles.stage} role="region" aria-label="Video carousel">
        <div
          className={styles.track}
          style={{
            // The track is positioned with `left: 50%` in CSS so its
            // origin sits at the centre of the stage. We then shift it
            // left by (focusedIndex + 0.5) slot widths so the focused
            // slot's centre lands on the stage centre.
            transform: `translateX(calc(-1 * ${focusedIndex + 0.5} * var(--slot-w)))`,
          }}
        >
          {videos.map((video, i) => {
            const offset = i - focusedIndex;
            const abs = Math.abs(offset);
            // Cards more than 4 away aren't worth rendering — they're
            // off-screen anyway and would just hold preview videos open
            const visible = abs <= 4;
            return (
              <div
                key={video.id}
                className={styles.slot}
                data-offset={offset}
                style={{
                  // Fade and shrink as we move away from center
                  opacity: visible ? Math.max(0.2, 1 - abs * 0.2) : 0,
                  transform: `scale(${i === focusedIndex ? 2 : 0.82})`,
                  zIndex: 100 - abs,
                }}
                aria-hidden={i !== focusedIndex}
              >
                {visible && (
                  <VideoCard
                    video={video}
                    index={i}
                    onSelect={onVideoSelect}
                  />
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* Subtle loading indicator if pagination is in flight */}
      {loadingMore && (
        <div className={styles.loadingMore}>
          <div className={styles.spinnerSm} />
          <span>Loading more…</span>
        </div>
      )}
    </div>
  );
}
