/**
 * VideoPlayer — Full-screen video player overlay
 *
 * New: accepts `startSeconds` to begin playback at a specific time
 * (used when activating a marker).
 */

import React, { useEffect, useRef, useState, useCallback } from 'react';
import styles from './VideoPlayer.module.css';
import SkimPreview from './SkimPreview.jsx';
import { useSpriteVtt } from '../hooks/useSpriteVtt.js';
import { saveSceneActivity, fetchSceneState } from '../utils/videoService.js';


const SKIP_SECONDS = 15;
const CONTROLS_HIDE_DELAY = 3000;
const SKIM_PREVIEW_HIDE_DELAY = 900;

const RESUME_SAVE_INTERVAL_MS = 30_000; // periodic save during playback
const RESUME_SKIP_THRESHOLD_S = 10;     // ignore resume if less than this
const RESUME_END_THRESHOLD_S  = 30;     // ignore resume if within this of end

function formatTime(seconds) {
  if (!isFinite(seconds) || seconds < 0) return '00:00';
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = Math.floor(seconds % 60);
  const mm = String(m).padStart(2, '0');
  const ss = String(s).padStart(2, '0');
  return h > 0 ? `${h}:${mm}:${ss}` : `${mm}:${ss}`;
}

export default function VideoPlayer({ video, startSeconds = 0, onClose }) {
  const videoRef = useRef(null);
  const containerRef = useRef(null);
  const hideTimerRef = useRef(null);
  const startSeekedRef = useRef(false); // ensure we only auto-seek once
  const [liveResumeTime, setLiveResumeTime] = useState(null);

  // Resolve effective start time. Marker activation (startSeconds prop)
  // always wins. Otherwise, if Stash has a saved resume_time that's
  // neither too close to the start (just-started) nor too close to the
  // end (almost-finished), use it.
  // Prefer the freshly-fetched value over whatever the grid had cached.
  // Falls back to the prop value while the fetch is in flight.
  const resumeTime = liveResumeTime != null ? liveResumeTime : (video?.resume_time || 0);
  const duration_s = video?.durationSeconds || 0;
  const isUsefulResume =
    resumeTime > RESUME_SKIP_THRESHOLD_S &&
    (!duration_s || resumeTime < duration_s - RESUME_END_THRESHOLD_S);

  const effectiveStart = startSeconds > 0
    ? startSeconds
    : (isUsefulResume ? resumeTime : 0);

  const [playing, setPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(startSeconds);
  const [duration, setDuration] = useState(0);
  const [buffering, setBuffering] = useState(true);
  const [controlsVisible, setControlsVisible] = useState(true);
  const [skimFlash, setSkimFlash] = useState(null);
  const [skimPreviewVisible, setSkimPreviewVisible] = useState(false);
  const skimPreviewTimerRef = useRef(null);
  const [error, setError] = useState(null);

  const { getCue } = useSpriteVtt(video?.vtt);

  const showControls = useCallback(() => {
    setControlsVisible(true);
    clearTimeout(hideTimerRef.current);
    hideTimerRef.current = setTimeout(() => setControlsVisible(false), CONTROLS_HIDE_DELAY);
  }, []);

  const togglePlay = useCallback(() => {
    const v = videoRef.current;
    if (!v) return;
    if (v.paused) v.play().catch(e => setError(e.message));
    else v.pause();
    showControls();
  }, [showControls]);

  const skim = useCallback((delta) => {
    const v = videoRef.current;
    if (!v) return;
    const target = Math.max(0, Math.min((v.duration || 0), v.currentTime + delta));
    v.currentTime = target;
    setCurrentTime(target);
    setSkimFlash(delta > 0 ? 'forward' : 'backward');
    clearTimeout(skim._timer);
    skim._timer = setTimeout(() => setSkimFlash(null), 600);

    // Skim-preview lifecycle: show on first skim, keep alive while
    // user keeps pressing, hide after SKIM_PREVIEW_HIDE_DELAY of inactivity.
    setSkimPreviewVisible(true);
    clearTimeout(skimPreviewTimerRef.current);
    skimPreviewTimerRef.current = setTimeout(
      () => setSkimPreviewVisible(false),
      SKIM_PREVIEW_HIDE_DELAY
    );

    showControls();
  }, [showControls]);

  // Keyboard handling — capture phase, blocks spatial nav while open
  useEffect(() => {
    const handleKey = (e) => {
      const key = e.key;
      const code = e.keyCode;
      e.stopPropagation();

      if (key === 'Escape' || key === 'Backspace' || code === 10009) {
        e.preventDefault();
        onClose?.();
        return;
      }

      if (key === 'Enter' || key === ' ' || code === 13 || code === 32 ||
          code === 415 || code === 19 || code === 10252) {
        e.preventDefault();
        togglePlay();
        return;
      }

      if (key === 'ArrowLeft' || code === 37 || code === 412) {
        e.preventDefault();
        skim(-SKIP_SECONDS);
        return;
      }

      if (key === 'ArrowRight' || code === 39 || code === 417) {
        e.preventDefault();
        skim(SKIP_SECONDS);
        return;
      }

      if (key === 'ArrowUp' || key === 'ArrowDown' || code === 38 || code === 40) {
        e.preventDefault();
        showControls();
        return;
      }

      if (code === 413) {
        e.preventDefault();
        onClose?.();
      }
    };

    window.addEventListener('keydown', handleKey, true);
    return () => window.removeEventListener('keydown', handleKey, true);
  }, [onClose, togglePlay, skim, showControls]);

  // Refresh resume_time from Stash. The cached grid data may be stale
  // (position was saved on a previous close, but the grid wasn't
  // refetched). One small query per player open is well worth it.
  useEffect(() => {
    if (!video?.id) return;
    let cancelled = false;
    fetchSceneState(video.id).then(state => {
      if (cancelled || !state) return;
      setLiveResumeTime(state.resume_time);
    });
    return () => { cancelled = true; };
  }, [video?.id]);

  // Wire up <video> events
  useEffect(() => {
    const v = videoRef.current;
    if (!v) return;

    const onPlay      = () => { setPlaying(true);  setBuffering(false); };
    const onPause     = () => setPlaying(false);
    const onWaiting   = () => setBuffering(true);
    const onPlaying   = () => setBuffering(false);
    const onTimeUpd   = () => setCurrentTime(v.currentTime);
    const onLoadedMd  = () => {
      setDuration(v.duration || 0);
      if (effectiveStart > 0 && !startSeekedRef.current) {
        startSeekedRef.current = true;
        try { v.currentTime = effectiveStart; } catch (e) {}
      }
    };
    const onError     = () => setError('Failed to load video');
    const onEnded     = () => setPlaying(false);

    v.addEventListener('play',     onPlay);
    v.addEventListener('pause',    onPause);
    v.addEventListener('waiting',  onWaiting);
    v.addEventListener('playing',  onPlaying);
    v.addEventListener('timeupdate',     onTimeUpd);
    v.addEventListener('loadedmetadata', onLoadedMd);
    v.addEventListener('error',    onError);
    v.addEventListener('ended',    onEnded);

    v.play().catch(() => {});
    showControls();

    return () => {
      v.removeEventListener('play',     onPlay);
      v.removeEventListener('pause',    onPause);
      v.removeEventListener('waiting',  onWaiting);
      v.removeEventListener('playing',  onPlaying);
      v.removeEventListener('timeupdate',     onTimeUpd);
      v.removeEventListener('loadedmetadata', onLoadedMd);
      v.removeEventListener('error',    onError);
      v.removeEventListener('ended',    onEnded);
      clearTimeout(hideTimerRef.current);
    };
  }, [showControls, effectiveStart]);

  // If the live resume value arrives after metadata has already loaded
  // at a different (cached) value, seek again to the correct position.
  useEffect(() => {
    if (liveResumeTime == null) return;
    const v = videoRef.current;
    if (!v) return;
    // Don't override an explicit marker activation
    if (startSeconds > 0) return;
    // If the seek already happened with the right value, no-op
    if (startSeekedRef.current && Math.abs(v.currentTime - liveResumeTime) < 1) return;
    if (liveResumeTime > RESUME_SKIP_THRESHOLD_S) {
      try { v.currentTime = liveResumeTime; } catch (e) {}
      startSeekedRef.current = true;
    }
  }, [liveResumeTime, startSeconds]);

  useEffect(() => () => {
    clearTimeout(hideTimerRef.current);
    clearTimeout(skimPreviewTimerRef.current);
  }, []);

  // Periodic and event-driven save of resume_time back to Stash.
  // Runs every RESUME_SAVE_INTERVAL_MS while playing, plus on pause
  // and on close (component unmount).
  useEffect(() => {
    const v = videoRef.current;
    if (!v || !video?.id) return;

    let saveTimer = null;
    let lastSaved = 0;

    const save = () => {
      const t = v.currentTime;
      // Don't bother saving if nothing meaningful changed (< 2s drift)
      if (Math.abs(t - lastSaved) < 2) return;
      lastSaved = t;
      saveSceneActivity({ id: video.id, resumeTime: t });
    };

    const onPause = () => save();

    v.addEventListener('pause', onPause);

    saveTimer = setInterval(() => {
      if (!v.paused) save();
    }, RESUME_SAVE_INTERVAL_MS);

    return () => {
      v.removeEventListener('pause', onPause);
      clearInterval(saveTimer);
      // Final save on unmount (covers Back-to-close)
      save();
    };
  }, [video?.id]);

  if (!video) return null;

  const progressPct = duration > 0 ? (currentTime / duration) * 100 : 0;

  return (
    <div
      ref={containerRef}
      className={styles.overlay}
      role="dialog"
      aria-label={`Now playing: ${video.title}`}
      onMouseMove={showControls}
    >
      <video
        ref={videoRef}
        className={styles.video}
        src={video.stream}
        poster={video.thumbnail}
        autoPlay
        playsInline
      />

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

      {buffering && !error && (
        <div className={styles.buffering}>
          <div className={styles.spinner} />
        </div>
      )}

      {error && (
        <div className={styles.errorState}>
          <p>{error}</p>
          <p className={styles.errorHint}>Press Back to close</p>
        </div>
      )}

      <div className={`${styles.controls} ${controlsVisible ? styles.controlsVisible : ''}`}>
        <div className={styles.topBar}>
          <button className={styles.iconBtn} onClick={onClose} aria-label="Close player">
            <svg width="28" height="28" viewBox="0 0 28 28" fill="none">
              <path d="M18 8L8 18M8 8l10 10" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
            </svg>
          </button>
          <div className={styles.titleBlock}>
            <h2 className={styles.title}>{video.title}</h2>
            {video.studio && <p className={styles.subtitle}>{video.studio}</p>}
          </div>
        </div>

        <div className={styles.centerIndicator}>
          {!playing && !buffering && !error && <div className={styles.bigPlay}>▶</div>}
        </div>

        <div className={styles.bottomBar}>
          <div className={styles.progressTrack}>
            <div className={styles.progressFill} style={{ width: `${progressPct}%` }} />
            <div className={styles.progressDot} style={{ left: `${progressPct}%` }} />
            <SkimPreview
              cue={getCue(currentTime)}
              time={currentTime}
              progressPct={progressPct}
              visible={skimPreviewVisible}
            />
          </div>
          <div className={styles.timeRow}>
            <span className={styles.time}>{formatTime(currentTime)}</span>
            <div className={styles.hint}>
              <kbd>←</kbd> −15s &nbsp; <kbd>OK</kbd> Play/Pause &nbsp; <kbd>→</kbd> +15s &nbsp; <kbd>Back</kbd> Exit
            </div>
            <span className={styles.time}>{formatTime(duration)}</span>
          </div>
        </div>
      </div>
    </div>
  );
}
