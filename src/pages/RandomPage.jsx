/**
 * RandomPage — TikTok-style vertical video feed
 *
 * Navigation:
 *   ↑ / ↓     → previous / next video (snap scroll)
 *   ← / →     → skim −15s / +15s in current video
 *   Enter/OK  → play/pause toggle
 *   Back      → handled by parent (exits app or returns)
 *
 * Videos are pulled with the same sort/order as Home, so the user gets
 * the same ordering they've set up — just in immersive full-screen mode.
 *
 * Only the active video plays; ±1 neighbour is preloaded to keep the
 * snap to the next clip instant.
 */

import React, { useState, useEffect, useRef, useCallback } from 'react';
import { fetchVideos } from '../utils/videoService.js';
import { useSpriteVtt } from '../hooks/useSpriteVtt.js';
import SkimPreview from '../components/SkimPreview.jsx';
import styles from './RandomPage.module.css';
import { useSettings, setSettings } from '../utils/settings.js';

const PAGE_SIZE = 20;
const SKIP_SECONDS = 15;
const PRELOAD_NEIGHBOURS = 1;        // how many clips to keep preloaded on each side
const LOAD_MORE_THRESHOLD = 5;       // when current index is within N of the end, fetch more
const SKIM_FLASH_MS = 600;
const SKIM_PREVIEW_HIDE_MS = 900;
const HUD_HIDE_MS = 2500;

export default function RandomPage({ controls, objectFilter, searchQuery }) {
  const sort  = controls?.sort  || 'created_at';
  const order = controls?.order || 'desc';

  const [videos, setVideos] = useState([]);
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const [index, setIndex] = useState(0);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState(null);

  const [playing, setPlaying] = useState(true);
  const settings = useSettings();
  const muted = settings.previewMuted;
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [buffering, setBuffering] = useState(false);
  const [skimFlash, setSkimFlash] = useState(null);
  const [skimPreviewVisible, setSkimPreviewVisible] = useState(false);
  const [hudVisible, setHudVisible] = useState(true);

  const videoRefs = useRef([]);
  const requestIdRef = useRef(0);
  const hudTimerRef = useRef(null);
  const skimTimerRef = useRef(null);
  const skimPreviewTimerRef = useRef(null);

  // VTT for the currently focused video — the hook handles the empty case.
  const { getCue } = useSpriteVtt(videos[index]?.vtt);

  // ── Reset & fetch when sort/order changes ─────────────────
  useEffect(() => {
    const reqId = ++requestIdRef.current;
    let cancelled = false;

    setLoading(true);
    setError(null);
    setVideos([]);
    setIndex(0);
    setPage(1);
    setTotal(0);

    fetchVideos({ 
      sort,
      order,
      filter: objectFilter,
      q: searchQuery,
      page: 1,
      limit: PAGE_SIZE })
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

  // ── Pagination — fetch more when getting close to the end ─
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
        limit: PAGE_SIZE 
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
    if (videos.length - index <= LOAD_MORE_THRESHOLD) {
      loadMore();
    }
  }, [index, videos.length, loadMore]);

  // ── HUD auto-hide ─────────────────────────────────────────
  const showHud = useCallback(() => {
    setHudVisible(true);
    clearTimeout(hudTimerRef.current);
    hudTimerRef.current = setTimeout(() => setHudVisible(false), HUD_HIDE_MS);
  }, []);

  useEffect(() => {
    showHud();
    return () => clearTimeout(hudTimerRef.current);
  }, [index, showHud]);

  // Final cleanup of any pending timers when the page unmounts.
  useEffect(() => () => {
    clearTimeout(hudTimerRef.current);
    clearTimeout(skimTimerRef.current);
    clearTimeout(skimPreviewTimerRef.current);
  }, []);

  // ── Active video play/pause control ───────────────────────
  useEffect(() => {
    // Cancel any in-flight skim preview when switching videos
    setSkimPreviewVisible(false);
    clearTimeout(skimPreviewTimerRef.current);

    videoRefs.current.forEach((v, i) => {
      if (!v) return;
      if (i === index) {
        v.currentTime = 0;
        if (playing) {
          v.play().catch(() => {});
        }
      } else {
        v.pause();
        try { v.currentTime = 0; } catch (e) {}
      }
    });
  }, [index, videos.length]);

  // Apply play/pause changes to active video
  useEffect(() => {
    const v = videoRefs.current[index];
    if (!v) return;
    if (playing) v.play().catch(() => {});
    else v.pause();
  }, [playing, index]);

  // Apply mute changes
  useEffect(() => {
    videoRefs.current.forEach(v => { if (v) v.muted = muted; });
  }, [muted]);

  // ── Navigation handlers ───────────────────────────────────
  const goNext = useCallback(() => {
    setIndex(i => Math.min(videos.length - 1, i + 1));
    setPlaying(true);
  }, [videos.length]);

  const goPrev = useCallback(() => {
    setIndex(i => Math.max(0, i - 1));
    setPlaying(true);
  }, []);

  const skim = useCallback((delta) => {
    const v = videoRefs.current[index];
    if (!v) return;
    const target = Math.max(0, Math.min((v.duration || 0), v.currentTime + delta));
    v.currentTime = target;
    setCurrentTime(target);
    setSkimFlash(delta > 0 ? 'forward' : 'backward');
    clearTimeout(skimTimerRef.current);
    skimTimerRef.current = setTimeout(() => setSkimFlash(null), SKIM_FLASH_MS);

    // Skim preview: show on first ←/→, keep alive while skimming,
    // hide after a short idle window.
    setSkimPreviewVisible(true);
    clearTimeout(skimPreviewTimerRef.current);
    skimPreviewTimerRef.current = setTimeout(
      () => setSkimPreviewVisible(false),
      SKIM_PREVIEW_HIDE_MS
    );

    showHud();
  }, [index, showHud]);

  const togglePlay = useCallback(() => {
    setPlaying(p => !p);
    showHud();
  }, [showHud]);

  // ── Key handling — capture phase, blocks spatial nav ──────
  useEffect(() => {
    if (loading || error || !videos.length) return;

    const handleKey = (e) => {
      const key = e.key;
      const code = e.keyCode;

      // Up / Down — switch video
      if (key === 'ArrowUp' || code === 38) {
        e.preventDefault();
        e.stopPropagation();
        goPrev();
        return;
      }
      if (key === 'ArrowDown' || code === 40) {
        e.preventDefault();
        e.stopPropagation();
        goNext();
        return;
      }

      // Left / Right — skim
      if (key === 'ArrowLeft' || code === 37 || code === 412) {
        e.preventDefault();
        e.stopPropagation();
        skim(-SKIP_SECONDS);
        return;
      }
      if (key === 'ArrowRight' || code === 39 || code === 417) {
        e.preventDefault();
        e.stopPropagation();
        skim(SKIP_SECONDS);
        return;
      }

      // Enter / OK / Space / MediaPlayPause — play/pause
      if (key === 'Enter' || key === ' ' || code === 13 || code === 32 ||
          code === 415 || code === 19 || code === 10252) {
        e.preventDefault();
        e.stopPropagation();
        togglePlay();
        return;
      }

      // 'm' — toggle mute
      if (key === 'm' || key === 'M') {
        e.preventDefault();
        setSettings({ previewMuted: !muted });
        showHud();
      }
    };

    window.addEventListener('keydown', handleKey, true);
    return () => window.removeEventListener('keydown', handleKey, true);
  }, [loading, error, videos.length, goNext, goPrev, skim, togglePlay, showHud]);

  // ── Wire video element events for the active video ───────
  useEffect(() => {
    const v = videoRefs.current[index];
    if (!v) return;

    const onPlay     = () => { setPlaying(true);  setBuffering(false); };
    const onPause    = () => setPlaying(false);
    const onWaiting  = () => setBuffering(true);
    const onPlaying  = () => setBuffering(false);
    const onTime     = () => setCurrentTime(v.currentTime);
    const onMeta     = () => setDuration(v.duration || 0);
    const onEnded    = () => goNext();

    v.addEventListener('play',           onPlay);
    v.addEventListener('pause',          onPause);
    v.addEventListener('waiting',        onWaiting);
    v.addEventListener('playing',        onPlaying);
    v.addEventListener('timeupdate',     onTime);
    v.addEventListener('loadedmetadata', onMeta);
    v.addEventListener('ended',          onEnded);

    setCurrentTime(v.currentTime || 0);
    setDuration(v.duration || 0);

    return () => {
      v.removeEventListener('play',           onPlay);
      v.removeEventListener('pause',          onPause);
      v.removeEventListener('waiting',        onWaiting);
      v.removeEventListener('playing',        onPlaying);
      v.removeEventListener('timeupdate',     onTime);
      v.removeEventListener('loadedmetadata', onMeta);
      v.removeEventListener('ended',          onEnded);
    };
  }, [index, videos.length, goNext]);

  // ── Touch / wheel support (nice for browser dev) ──────────
  const wheelLockRef = useRef(false);
  const onWheel = (e) => {
    if (wheelLockRef.current) return;
    if (Math.abs(e.deltaY) < 30) return;
    wheelLockRef.current = true;
    setTimeout(() => { wheelLockRef.current = false; }, 600);
    if (e.deltaY > 0) goNext(); else goPrev();
  };

  // ── Render ────────────────────────────────────────────────
  if (loading) {
    return (
      <div className={styles.feed}>
        <div className={styles.state}>
          <div className={styles.spinner} />
          <p>Loading feed…</p>
        </div>
      </div>
    );
  }

  if (error && !videos.length) {
    return (
      <div className={styles.feed}>
        <div className={styles.state}>
          <p style={{ color: 'var(--red)' }}>Error: {error}</p>
        </div>
      </div>
    );
  }

  if (!videos.length) {
    return (
      <div className={styles.feed}>
        <div className={styles.state}>
          <p>No videos.</p>
        </div>
      </div>
    );
  }

  const current = videos[index];
  const progressPct = duration > 0 ? (currentTime / duration) * 100 : 0;

  return (
    <div className={styles.feed} onWheel={onWheel}>
      {/* Stack of all videos; only the active one is visible & playing */}
      <div
        className={styles.stack}
        style={{ transform: `translateY(-${index * 100}%)` }}
      >
        {videos.map((video, i) => {
          const inWindow = Math.abs(i - index) <= PRELOAD_NEIGHBOURS;
          return (
            <div key={video.id} className={styles.slide}>
              {inWindow && (
                <video
                  ref={el => { videoRefs.current[i] = el; }}
                  className={styles.video}
                  src={video.stream || video.preview || undefined}
                  poster={video.thumbnail}
                  loop
                  playsInline
                  muted={muted}
                  preload={i === index ? 'auto' : 'metadata'}
                />
              )}
              {!inWindow && video.thumbnail && (
                <img src={video.thumbnail} alt="" className={styles.posterFallback} />
              )}
            </div>
          );
        })}
      </div>

      {/* Skim flash indicators */}
      {skimFlash === 'backward' && (
        <div className={`${styles.skimFlash} ${styles.skimLeft}`}>
          <span className={styles.skimIcon}>⏪</span>
          <span className={styles.skimAmount}>−{SKIP_SECONDS}s</span>
        </div>
      )}
      {skimFlash === 'forward' && (
        <div className={`${styles.skimFlash} ${styles.skimRight}`}>
          <span className={styles.skimIcon}>⏩</span>
          <span className={styles.skimAmount}>+{SKIP_SECONDS}s</span>
        </div>
      )}

      {/* Buffering spinner */}
      {buffering && (
        <div className={styles.buffering}>
          <div className={styles.spinner} />
        </div>
      )}

      {/* Center play/pause overlay (shown briefly when paused) */}
      {!playing && !buffering && (
        <div className={styles.bigPlay} aria-hidden="true">▶</div>
      )}

      {/* HUD — title, meta, progress, key hints */}
      <div className={`${styles.hud} ${hudVisible ? styles.hudVisible : ''}`}>
        <div className={styles.topRight}>
          <div className={styles.counter}>
            <span className={styles.counterCur}>{index + 1}</span>
            <span className={styles.counterSep}>/</span>
            <span className={styles.counterTotal}>{total || videos.length}</span>
          </div>
          {muted && (
            <div className={styles.mutedBadge} title="Muted (M to unmute)">
              <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
                <path d="M3 6v4h2.5L9 13V3L5.5 6H3z" fill="currentColor"/>
                <path d="M11 5l4 6M15 5l-4 6" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
              </svg>
              <span>MUTED</span>
            </div>
          )}
        </div>

        <div className={styles.bottom}>
          <div className={styles.info}>
            <h2 className={styles.title}>{current.title}</h2>
            <div className={styles.meta}>
              {current.year && <span>{current.year}</span>}
              {current.duration && <span>{current.duration}</span>}
              {current.category && <span className={styles.tag}>{current.category}</span>}
              {current.rating && <span className={styles.rating}>★ {current.rating}</span>}
            </div>
          </div>

          <div className={styles.progressTrack}>
            <div className={styles.progressFill} style={{ width: `${progressPct}%` }} />
            <SkimPreview
              cue={getCue(currentTime)}
              time={currentTime}
              progressPct={progressPct}
              visible={skimPreviewVisible}
            />
          </div>

          <div className={styles.hints}>
            <span><kbd>↑</kbd><kbd>↓</kbd> next</span>
            <span><kbd>←</kbd><kbd>→</kbd> ±{SKIP_SECONDS}s</span>
            <span><kbd>OK</kbd> play/pause</span>
            <span><kbd>M</kbd> {muted ? 'unmute' : 'mute'}</span>
          </div>
        </div>
      </div>

      {/* Dot indicator on the right */}
      <div className={styles.dots} aria-hidden="true">
        {videos.slice(Math.max(0, index - 2), index + 3).map((_, i, arr) => {
          const realIdx = Math.max(0, index - 2) + i;
          return (
            <div
              key={realIdx}
              className={`${styles.dot} ${realIdx === index ? styles.dotActive : ''}`}
            />
          );
        })}
      </div>
    </div>
  );
}
