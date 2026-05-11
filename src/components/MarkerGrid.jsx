/**
 * MarkerGrid — Infinite-scroll grid of marker cards
 * Reads sort/order/cols from `controls` prop.
 */

import React, { useState, useEffect, useRef, useCallback } from 'react';
import MarkerCard from './MarkerCard.jsx';
import { fetchMarkers } from '../utils/markerService.js';
import styles from './VideoGrid.module.css'; // reuse VideoGrid styles for grid layout

const PAGE_SIZE = 40;

export default function MarkerGrid({ controls, onMarkerSelect, objectFilter, searchQuery }) {
  const { sort, order, cols } = controls;

  const [markers, setMarkers] = useState([]);
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState(null);

  const scrollRef = useRef(null);
  const sentinelRef = useRef(null);
  const requestIdRef = useRef(0);

  useEffect(() => {
    const reqId = ++requestIdRef.current;
    let cancelled = false;

    setLoading(true);
    setError(null);
    setMarkers([]);
    setPage(1);
    setTotal(0);

    fetchMarkers({ sort, order, filter: objectFilter, q: searchQuery, page: 1, limit: PAGE_SIZE })
      .then(data => {
        if (cancelled || reqId !== requestIdRef.current) return;
        setMarkers(data.markers);
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

  const loadMore = useCallback(async () => {
    if (loadingMore || loading) return;
    if (markers.length >= total && total > 0) return;

    const reqId = requestIdRef.current;
    const nextPage = page + 1;

    setLoadingMore(true);
    try {
      const data = await fetchMarkers({ 
        sort,
        order,
        filter: objectFilter,
        q: searchQuery,
        page: nextPage,
        limit: PAGE_SIZE
      });
      if (reqId !== requestIdRef.current) return;

      setMarkers(prev => {
        const seen = new Set(prev.map(m => m.id));
        const fresh = data.markers.filter(m => !seen.has(m.id));
        return [...prev, ...fresh];
      });
      setPage(nextPage);
      if (data.total) setTotal(data.total);
    } catch (e) {
      if (reqId === requestIdRef.current) setError(e.message);
    } finally {
      if (reqId === requestIdRef.current) setLoadingMore(false);
    }
  }, [loadingMore, loading, markers.length, total, page, sort, order, objectFilter, searchQuery]);

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

  if (loading) return (
    <div className={styles.state}>
      <div className={styles.spinner} />
      <p className={styles.stateText}>Loading markers…</p>
    </div>
  );

  if (error && !markers.length) return (
    <div className={styles.state}>
      <p className={styles.stateText} style={{ color: 'var(--red)' }}>Error: {error}</p>
    </div>
  );

  if (!markers.length) return (
    <div className={styles.state}>
      <p className={styles.stateText}>No markers found.</p>
    </div>
  );

  const reachedEnd = total > 0 && markers.length >= total;

  return (
    <div className={styles.gridWrapper} ref={scrollRef}>
      <div
        className={styles.grid}
        style={{ gridTemplateColumns: `repeat(${cols}, 1fr)` }}
        role="grid"
        aria-label="Marker grid"
      >
        {markers.map((m, i) => (
          <MarkerCard key={m.id} marker={m} index={i} onSelect={onMarkerSelect} />
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
          <span>{total} markers loaded</span>
        </div>
      )}
    </div>
  );
}
