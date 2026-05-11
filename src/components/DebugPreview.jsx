/**
 * DebugPreview — Temporary diagnostic component.
 *
 * Renders a fixed-position <video> in the bottom-right corner that
 * plays the preview URL of whatever video card is currently focused.
 * Zero styling, no transforms, no z-index dance, no overlays — just
 * a vanilla <video> element to test whether previews work at all on
 * this TV when isolated from the card's layout.
 *
 * Delete or hide this once we've figured out the bug.
 */

import React, { useEffect, useRef, useState } from 'react';
import { registry, getCurrentFocusId } from '../hooks/useFocusable.js';

export default function DebugPreview() {
  const [src, setSrc] = useState(null);
  const [info, setInfo] = useState('');
  const videoRef = useRef(null);

  // Watch for focus changes and find the focused card's preview URL.
  // VideoCard and MarkerCard both store their video data on the
  // element via... actually they don't. We need to read it differently.
  // Use the focus id to look up the video in a side-channel.
  // Simplest path: just walk the focused element, find the <video>
  // inside its subtree, copy its src.
  useEffect(() => {
    const onFocus = () => {
      const fid = getCurrentFocusId();
      if (!fid) return;
      const entry = registry.get(fid);
      if (!entry) return;
      // Find a <video> inside the focused card's DOM
      const v = entry.el.querySelector('video');
      if (!v) {
        setSrc(null);
        setInfo(`focused: ${fid}, no <video> inside`);
        return;
      }
      const url = v.src || v.currentSrc;
      setSrc(url || null);
      setInfo(`focused: ${fid}\nsrc: ${url || '(empty)'}`);
    };

    document.addEventListener('focusin', onFocus);
    return () => document.removeEventListener('focusin', onFocus);
  }, []);

  // Log video element state to console as it loads
  useEffect(() => {
    const v = videoRef.current;
    if (!v) return;
    const logState = () => {
      console.log('[DebugPreview]',
        'readyState:', v.readyState,
        'videoSize:', v.videoWidth, 'x', v.videoHeight,
        'paused:', v.paused,
        'error:', v.error?.code,
        'networkState:', v.networkState
      );
    };
    v.addEventListener('loadedmetadata', logState);
    v.addEventListener('canplay', logState);
    v.addEventListener('playing', logState);
    v.addEventListener('error', logState);
    return () => {
      v.removeEventListener('loadedmetadata', logState);
      v.removeEventListener('canplay', logState);
      v.removeEventListener('playing', logState);
      v.removeEventListener('error', logState);
    };
  }, [src]);

  return (
    <div style={{
      position: 'fixed',
      bottom: 20,
      right: 20,
      width: 320,
      background: '#000',
      border: '2px solid red',
      zIndex: 99999,
      padding: 4,
      fontSize: 11,
      color: 'white',
      fontFamily: 'monospace',
    }}>
      <div style={{ whiteSpace: 'pre-wrap', wordBreak: 'break-all', marginBottom: 4 }}>
        {info || 'focus a card to test'}
      </div>
      {src && (
        <video
          ref={videoRef}
          src={src}
          autoPlay
          muted
          loop
          playsInline
          style={{ width: '100%', display: 'block' }}
        />
      )}
    </div>
  );
}