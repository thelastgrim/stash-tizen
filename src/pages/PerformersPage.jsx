/**
 * PerformersPage — renders performer grid given controls.
 */

import React from 'react';
import PerformerGrid from '../components/PerformerGrid.jsx';

export default function PerformersPage({ controls, objectFilter, searchQuery, onPerformerSelect }) {
  return <PerformerGrid controls={controls} objectFilter={objectFilter} searchQuery={searchQuery} onPerformerSelect={onPerformerSelect} />;
}