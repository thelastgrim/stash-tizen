/**
 * HomePage — Renders either the grid or the carousel based on
 * controls.mode ('classic' | 'coverflow' | 'carousel').
 */

import React from 'react';
import VideoGrid from '../components/VideoGrid.jsx';
import VideoCarousel from '../components/VideoCarousel.jsx';
import VideoCoverflow from '../components/VideoCoverflow.jsx';

export default function HomePage({ controls, objectFilter, searchQuery, onVideoSelect }) {
  if (controls.mode === 'coverflow') {
    return <VideoCoverflow controls={controls} objectFilter={objectFilter} searchQuery={searchQuery} onVideoSelect={onVideoSelect} />;
  }
  if (controls.mode === 'carousel') {
    return <VideoCarousel controls={controls} objectFilter={objectFilter} searchQuery={searchQuery} onVideoSelect={onVideoSelect} />;
  }
  return <VideoGrid controls={controls} objectFilter={objectFilter} searchQuery={searchQuery} onVideoSelect={onVideoSelect} />;
}