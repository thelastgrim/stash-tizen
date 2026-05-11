/**
 * SkimPreview — Floating sprite-tile preview that follows the seek point
 *
 * Renders the sprite tile for `time` seconds, positioned horizontally
 * along a track at `progressPct` (0..100). Caller is responsible for
 * showing/hiding it (e.g. only while the user is actively skimming).
 *
 * Rendering trick: we keep an off-screen <img> for each unique sprite
 * sheet just to learn its natural dimensions. Once known, we use
 * background-image + background-size + background-position to crop a
 * scaled tile out of it. This avoids transform-based scaling pitfalls
 * (subpixel cracks, bleed) and works consistently across browsers.
 */

import React, { useEffect, useRef, useState } from 'react';
import styles from './SkimPreview.module.css';

const TILE_DISPLAY_WIDTH = 200; // px on screen — tweak to taste

// Module-level cache of natural dimensions per sprite URL
const sheetSizeCache = new Map(); // src → { w, h }

function formatTime(seconds) {
  if (!isFinite(seconds) || seconds < 0) return '0:00';
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = Math.floor(seconds % 60);
  const mm = String(m).padStart(2, '0');
  const ss = String(s).padStart(2, '0');
  return h > 0 ? `${h}:${mm}:${ss}` : `${m}:${ss}`;
}

function useSheetSize(src) {
  const [size, setSize] = useState(() => sheetSizeCache.get(src) || null);

  useEffect(() => {
    if (!src) { setSize(null); return; }
    const cached = sheetSizeCache.get(src);
    if (cached) { setSize(cached); return; }

    let cancelled = false;
    const img = new Image();
    img.onload = () => {
      if (cancelled) return;
      const dims = { w: img.naturalWidth, h: img.naturalHeight };
      sheetSizeCache.set(src, dims);
      setSize(dims);
    };
    img.onerror = () => { if (!cancelled) setSize(null); };
    img.src = src;

    return () => { cancelled = true; };
  }, [src]);

  return size;
}

export default function SkimPreview({ cue, time, progressPct, visible }) {
  const sheetSize = useSheetSize(cue?.src);

  if (!cue || !visible) return null;

  const scale = TILE_DISPLAY_WIDTH / cue.w;
  const displayHeight = cue.h * scale;

  // Background-size scales the whole sheet; background-position
  // shifts it so the desired tile lines up with the (0,0) of our box.
  const tileStyle = sheetSize
    ? {
        width:  `${TILE_DISPLAY_WIDTH}px`,
        height: `${displayHeight}px`,
        backgroundImage:    `url("${cue.src}")`,
        backgroundSize:     `${sheetSize.w * scale}px ${sheetSize.h * scale}px`,
        backgroundPosition: `-${cue.x * scale}px -${cue.y * scale}px`,
        backgroundRepeat:   'no-repeat',
      }
    : {
        // Fallback while the sheet's natural size loads — show a
        // placeholder box so layout doesn't jump
        width:  `${TILE_DISPLAY_WIDTH}px`,
        height: `${(TILE_DISPLAY_WIDTH * 9) / 16}px`,
        background: 'rgba(255,255,255,0.05)',
      };

  // Clamp horizontally so the bubble can't run off-screen.
  // 6 / 94 leaves a tiny margin — refine if your bubble width is huge.
  const left = Math.max(6, Math.min(94, progressPct));

  return (
    <div
      className={styles.bubble}
      style={{ left: `${left}%` }}
      aria-hidden="true"
    >
      <div className={styles.tile} style={tileStyle} />
      <div className={styles.time}>{formatTime(time)}</div>
    </div>
  );
}
