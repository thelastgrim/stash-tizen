/**
 * VideoGrid — NxM grid of VideoCard with infinite scroll
 *
 * Watches `controls.sort`, `controls.order` —
 * any change resets the grid and refetches from page 1.
 */

import React, { useState, useEffect, useRef, useCallback } from 'react';
import VideoCard from './VideoCard.jsx';
import { fetchVideos } from '../utils/videoService.js';
import styles from './VideoGrid.module.css';

const PAGE_SIZE = 40;

export default function VideoGrid({ controls, objectFilter, searchQuery, onVideoSelect }) {
  const { sort, order, cols } = controls;

  const [videos, setVideos] = useState([]);
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState(null);

  const scrollRef = useRef(null);
  const sentinelRef = useRef(null);
  const requestIdRef = useRef(0);

  // ── Reset and fetch first page when sort/order change ────
  useEffect(() => {
    const reqId = ++requestIdRef.current;
    let cancelled = false;

    setLoading(true);
    setError(null);
    setVideos([]);
    setPage(1);
    setTotal(0);

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
  }, [sort, order, objectFilter, searchQuery]);   // ← critical: sort and order MUST be here

  // ── Load next page ────────────────────────────────────────
  const loadMore = useCallback(async () => {
    if (loadingMore || loading) return;
    if (videos.length >= total && total > 0) return;

    const reqId = requestIdRef.current;
    const nextPage = page + 1;

    setLoadingMore(true);
    try {
      const data = await fetchVideos({
        sort, order,
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

  // ── IntersectionObserver ─────────────────────────────────
  useEffect(() => {
    const sentinel = sentinelRef.current;
    const root = scrollRef.current;
    if (!sentinel || !root) return;

    const observer = new IntersectionObserver(
      entries => { if (entries[0].isIntersecting) loadMore(); },
      { root, rootMargin: '400px 0px', threshold: 0 }
    );

    observer.observe(sentinel);
    return () => observer.disconnect();
  }, [loadMore]);

  // ── Render ───────────────────────────────────────────────
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

  const reachedEnd = total > 0 && videos.length >= total;

  return (
    <div className={styles.gridWrapper} ref={scrollRef}>
      <div
        className={styles.grid}
        style={{ gridTemplateColumns: `repeat(${cols}, 1fr)` }}
        role="grid"
        aria-label={`Video grid, ${cols} columns`}
      >
        {videos.map((video, i) => (
          <VideoCard
            key={video.id}
            video={video}
            index={i}
            onSelect={onVideoSelect}
          />
        ))}
      </div>

      {!reachedEnd && (
        <div ref={sentinelRef} className={styles.sentinel}>
          {loadingMore && (
            <>
              <div className={styles.spinnerSm} />
              <span className={styles.loadingMoreText}>Loading more…</span>
            </>
          )}
        </div>
      )}

      {reachedEnd && (
        <div className={styles.endMarker}>
          <span>{total} videos loaded</span>
        </div>
      )}
    </div>
  );
}
