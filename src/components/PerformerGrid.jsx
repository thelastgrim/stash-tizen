/**
 * PerformerGrid — Infinite-scroll grid, reactive to controls.
 */

import React, { useState, useEffect, useRef, useCallback } from 'react';
import PerformerCard from './PerformerCard.jsx';
import { fetchPerformers } from '../utils/performerService.js';
import styles from './PerformerGrid.module.css';

const PAGE_SIZE = 40;

export default function PerformerGrid({ controls, onPerformerSelect, objectFilter, searchQuery, onVideoSelect }) {
  const { sort, order, cols } = controls;

  const [performers, setPerformers] = useState([]);
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
    setPerformers([]);
    setPage(1);
    setTotal(0);

    fetchPerformers({ 
      sort,
      order,
      filter: objectFilter,
      q: searchQuery,
      page: 1,
      limit: PAGE_SIZE })
      .then(data => {
        if (cancelled || reqId !== requestIdRef.current) return;
        setPerformers(data.performers);
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
    if (performers.length >= total && total > 0) return;

    const reqId = requestIdRef.current;
    const nextPage = page + 1;

    setLoadingMore(true);
    try {
      const data = await fetchPerformers({
        sort,
        order,
        filter: objectFilter,
        q: searchQuery,
        page: nextPage,
        limit: PAGE_SIZE });
      if (reqId !== requestIdRef.current) return;

      setPerformers(prev => {
        const seen = new Set(prev.map(p => p.id));
        const fresh = data.performers.filter(p => !seen.has(p.id));
        return [...prev, ...fresh];
      });
      setPage(nextPage);
      if (data.total) setTotal(data.total);
    } catch (e) {
      if (reqId === requestIdRef.current) setError(e.message);
    } finally {
      if (reqId === requestIdRef.current) setLoadingMore(false);
    }
  }, [loadingMore, loading, performers.length, total, page, sort, order, objectFilter, searchQuery]);

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
      <p className={styles.stateText}>Loading performers…</p>
    </div>
  );

  if (error && !performers.length) return (
    <div className={styles.state}>
      <p className={styles.stateText} style={{ color: 'var(--red)' }}>Error: {error}</p>
    </div>
  );

  if (!performers.length) return (
    <div className={styles.state}>
      <p className={styles.stateText}>No performers found.</p>
    </div>
  );

  const reachedEnd = total > 0 && performers.length >= total;

  return (
    <div className={styles.gridWrapper} ref={scrollRef}>
      <div
        className={styles.grid}
        style={{ gridTemplateColumns: `repeat(${cols}, 1fr)` }}
        role="grid"
        aria-label="Performer grid"
      >
        {performers.map((p, i) => (
          <PerformerCard key={p.id} performer={p} index={i} onSelect={onPerformerSelect} />
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
          <span>{total} performers loaded</span>
        </div>
      )}
    </div>
  );
}
