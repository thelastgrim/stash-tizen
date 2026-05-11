/**
 * MarkersPage — renders marker grid given controls.
 */

import React from 'react';
import MarkerGrid from '../components/MarkerGrid.jsx';

export default function MarkersPage({ controls, objectFilter, searchQuery, onMarkerSelect }) {
  return <MarkerGrid controls={controls} objectFilter={objectFilter} searchQuery={searchQuery} onMarkerSelect={onMarkerSelect} />;
}