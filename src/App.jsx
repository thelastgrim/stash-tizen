/**
 * App.jsx — Root component
 *
 * Sort options are grouped for readability. Each group is a section
 * in the dropdown with a small header label.
 *
 * Shape: array of { group: string, options: [{ value, label }] }
 */

import React, { useState, useRef, useEffect } from 'react';
import TabBar from './components/TabBar.jsx';
import ControlsPanel from './components/ControlsPanel.jsx';
import SettingsPanel from './components/SettingsPanel.jsx';
import HomePage from './pages/HomePage.jsx';
import PerformersPage from './pages/PerformersPage.jsx';
import MarkersPage from './pages/MarkersPage.jsx';
import RandomPage from './pages/RandomPage.jsx';
import VideoPlayer from './components/VideoPlayer.jsx';
import { useKeyHandler } from './hooks/useKeyHandler.js';
import styles from './App.module.css';
import { useSavedFilters, clearSavedFiltersCache } from './hooks/useSavedFilters.js';
import { FILTER_MODE } from './utils/filterService.js';
import PerformerDetailPage from './pages/PerformerDetailPage.jsx';
import { useSettings, setSettings } from './utils/settings.js';
import ExitPrompt from './components/ExitPrompt.jsx';

import DebugPreview from './components/DebugPreview.jsx';

const DEFAULT_CONTROLS = {
  mode:  'classic',
  sort:  'created_at',
  order: 'desc',
  cols:  4,
  filterId: null,
  search: '',
};

const HOME_MODE_OPTIONS = [
  { value: 'classic',   label: 'Classic' },
  { value: 'coverflow', label: 'Coverflow' },
  { value: 'carousel',  label: 'Carousel' },
];

// ── Grouped sort options ─────────────────────────────────
const SCENE_SORT_GROUPS = [
  {
    group: 'General',
    options: [
      { value: 'created_at',     label: 'Date Added' },
      { value: 'updated_at',     label: 'Date Updated' },
      { value: 'title',          label: 'Title' },
      { value: 'random',         label: 'Random' },
    ],
  },
  {
    group: 'Engagement',
    options: [
      { value: 'rating',         label: 'Rating' },
      { value: 'o_counter',      label: 'Likes' },
      { value: 'play_count',     label: 'Play Count' },
      { value: 'play_duration',  label: 'Play Duration' },
      { value: 'last_played_at', label: 'Last Played' },
    ],
  },
  {
    group: 'File',
    options: [
      { value: 'duration',       label: 'Duration' },
      { value: 'filesize',       label: 'File Size' },
      { value: 'resolution',     label: 'Resolution' },
      { value: 'bitrate',        label: 'Bitrate' },
      { value: 'framerate',      label: 'Frame Rate' },
    ],
  },
  {
    group: 'Cast',
    options: [
      { value: 'performer_age',  label: 'Performer Age' },
    ],
  },
];

const PERFORMER_SORT_GROUPS = [
  {
    group: 'General',
    options: [
      { value: 'created_at',     label: 'Date Added' },
      { value: 'name',           label: 'Name' },
      { value: 'rating',         label: 'Rating' },
    ],
  },
  {
    group: 'Engagement',
    options: [
      { value: 'o_counter',      label: 'Likes' },
      { value: 'play_count',     label: 'Play Count' },
      { value: 'last_played_at', label: 'Last Played' },
    ],
  },
  {
    group: 'Career',
    options: [
      { value: 'birthdate',      label: 'Birthdate' },
      { value: 'career_start',   label: 'Career Start' },
      { value: 'career_end',     label: 'Career End' },
      { value: 'height',         label: 'Height' },
    ],
  },
  {
    group: 'Scenes',
    options: [
      { value: 'scenes_count',   label: 'Scene Count' },
      { value: 'scenes_size',    label: 'Scenes Size' },
      { value: 'latest_scene',   label: 'Latest Scene' },
    ],
  },
];

const MARKER_SORT_GROUPS = [
  {
    group: 'General',
    options: [
      { value: 'title',      label: 'Title' },
      { value: 'created_at', label: 'Date Added' },
      { value: 'random',     label: 'Random' },
    ],
  },
  {
    group: 'Position',
    options: [
      { value: 'seconds',    label: 'Timestamp' },
      { value: 'duration',   label: 'Duration' },
    ],
  },
];

const TAB_CONTROL_CONFIG = {
  home: {
    modeOptions: HOME_MODE_OPTIONS,
    sortGroups: SCENE_SORT_GROUPS,
    showOrder: true,
    showGridSize: true,
    defaultSort: 'created_at',
    filterMode: FILTER_MODE.scenes,
    showSearch: true
  },
  performers: {
    modeOptions: null,
    sortGroups: PERFORMER_SORT_GROUPS,
    showOrder: true,
    showGridSize: true,
    defaultSort: 'created_at',
    filterMode: FILTER_MODE.performers,
    showSearch: true
  },
  markers: {
    modeOptions: null,
    sortGroups: MARKER_SORT_GROUPS,
    showOrder: true,
    showGridSize: true,
    defaultSort: 'title',
    filterMode: FILTER_MODE.markers,
    showSearch: true
  },
  random: {
    modeOptions: null,
    sortGroups: [],
    showOrder: false,
    showGridSize: false,
    defaultSort: null,
    filterMode: null,   // Reels uses homeControls' filter
  },
};

// Flatten groups → flat list of {value, label}, useful for validation
function flattenGroups(groups) {
  return groups.flatMap(g => g.options);
}

export default function App() {
  const [activeTab, setActiveTab] = useState('home');
  const [controls, setControls] = useState(DEFAULT_CONTROLS); 
  const [exitPromptOpen, setExitPromptOpen] = useState(false);

  // Snapshot of controls at the moment we last visited Home — Random
  // pulls its sort/order from this so it stays consistent even if the
  // user fiddles with controls on other tabs (those tabs share the same
  // controls state, but when entering Random we want the home view).
  const [homeControls, setHomeControls] = useState(DEFAULT_CONTROLS);

  const [playingVideo, setPlayingVideo] = useState(null);
  const [startSeconds, setStartSeconds] = useState(0);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [selectedPerformer, setSelectedPerformer] = useState(null);
  const lastFocusedRef = useRef(null);
  const lastPerformerCardRef = useRef(null);

  // Subscribe to runtime settings — used to remount the data tree on
  // Test/Live switch (and on URL/key change in Live mode) so any
  // in-flight fetches and cached state from the previous source are
  // discarded cleanly.
  const settings = useSettings();
  const dataKey = settings.useMock
    ? 'mock'
    : `live:${settings.stashUrl}:${settings.stashKey ? 'k' : 'nk'}`;

  const previewMuted = settings.previewMuted;
  const togglePreviewMuted = () => {
    setSettings({ previewMuted: !previewMuted });
  };
  
  // Saved filters for the active tab. Reels reuses Home's filter mode
  // since it pulls from the same data source.
  const config = TAB_CONTROL_CONFIG[activeTab];
  const filterMode = activeTab === 'random'
    ? FILTER_MODE.scenes
    : config?.filterMode || null;

  const { filters: savedFilters } = useSavedFilters(filterMode, dataKey);

  // Resolve filterId → objectFilter (the JSON that goes into the
  // GraphQL filter argument). Null when no filter selected or list
  // hasn't loaded yet.
  const activeFilterId = activeTab === 'random'
    ? homeControls.filterId
    : controls.filterId;

  const activeFilter = activeFilterId
    ? savedFilters.find(f => String(f.id) === String(activeFilterId))
    : null;
  const activeObjectFilter = activeFilter?.objectFilter || null;
  // `find_filter.q` carries the saved filter's search string — many
  // "filters" in Stash are just a search query.
  // User-typed search overrides any saved filter's bundled `q`.
  const userSearch = activeTab === 'random'
    ? (homeControls.search || '')
    : (controls.search || '');
  const activeSearchQuery = userSearch || activeFilter?.findFilter?.q || '';

  // Always show the filter dropdown on tabs that support filters, so
  // the UI doesn't shift around when entries arrive (or in Test mode
  // where there'll never be any). "All" is always present; saved
  // filters appear underneath when available.
  const filterOptions = filterMode
    ? [{ value: '', label: 'All' }, ...savedFilters.map(f => ({ value: String(f.id), label: f.name }))]
    : null;

  useKeyHandler({
    onBack: () => {
      // Reels: Back returns to Home (no exit prompt — Reels is mid-app).
      if (activeTab === 'random') {
        setActiveTab('home');
        return;
      }
      // Performer detail: handled by the page's own Back handler.
      if (activeTab === 'performers' && selectedPerformer) return;
      // Top-level tab: confirm before exit.
      setExitPromptOpen(true);
    },
  });

  // Keep homeControls in sync whenever Home is the active tab.
  useEffect(() => {
    if (activeTab === 'home') {
      setHomeControls(controls);
    }
  }, [activeTab, controls]);

  // When switching tabs, coerce sort key to one valid for the new tab
  useEffect(() => {
    const config = TAB_CONTROL_CONFIG[activeTab];
    const flat = flattenGroups(config?.sortGroups || []);

    setControls(prev => {
      const patch = {};
      if (flat.length) {
        const validValues = flat.map(o => o.value);
        if (!validValues.includes(prev.sort) && config.defaultSort) {
          patch.sort = config.defaultSort;
        }
      }
      // Filter ids belong to a specific saved-filter mode. Switching
      // tabs (and thus mode) invalidates whatever was selected.
      if (prev.filterId) patch.filterId = null;
      return Object.keys(patch).length ? { ...prev, ...patch } : prev;
    });
  }, [activeTab]);

  // Leaving the Performers tab clears any open detail page so the
  // user doesn't pop back into someone they forgot they'd selected.
  useEffect(() => {
    if (activeTab !== 'performers' && selectedPerformer) {
      setSelectedPerformer(null);
    }
  }, [activeTab, selectedPerformer]);

  const updateControls = (patch) => {
    setControls(prev => {
      // Picking a saved filter: also adopt its sort/direction so the
      // visible Sort/Order controls reflect what's actually applied.
      // The user can still override afterwards.
      if (patch.filterId && patch.filterId !== prev.filterId) {
        const f = savedFilters.find(x => String(x.id) === String(patch.filterId));
        if (f?.findFilter?.sort) patch.sort = f.findFilter.sort;
        if (f?.findFilter?.direction) {
          patch.order = f.findFilter.direction.toLowerCase() === 'asc' ? 'asc' : 'desc';
        }
      }
      return { ...prev, ...patch };
    });
  };

  // ── Selection handlers ─────────────────────────────────────
  const handleVideoSelect = (video) => {
    lastFocusedRef.current = document.activeElement;
    setStartSeconds(0);
    setPlayingVideo(video);
  };

  const handleMarkerSelect = (marker) => {
    lastFocusedRef.current = document.activeElement;
    setStartSeconds(marker.seconds || 0);
    setPlayingVideo({
      id: marker.scene.id,
      title: `${marker.scene.title} — ${marker.title}`,
      stream: marker.scene.stream,
      thumbnail: marker.screenshot || marker.scene.screenshot,
      // Forward the parent scene's sprite/vtt so the player's skim
      // preview works exactly as it does for full-scene playback.
      sprite: marker.scene.sprite,
      vtt: marker.scene.vtt,
      studio: null,
    });
  };

  const handlePerformerSelect = (performer) => {
    lastPerformerCardRef.current = document.activeElement;
    setSelectedPerformer(performer);
  };

  const handlePerformerBack = () => {
    setSelectedPerformer(null);
    // Restore focus to the originating card after the grid remounts.
    setTimeout(() => {
      const el = lastPerformerCardRef.current;
      if (el && document.contains(el)) el.focus();
    }, 50);
  };

  const handlePlayerClose = () => {
    setPlayingVideo(null);
    setStartSeconds(0);
    setTimeout(() => {
      const el = lastFocusedRef.current;
      if (el && document.contains(el)) el.focus();
    }, 50);
  };

  const showControlsBar = activeTab !== 'random';

  return (
    <div className={styles.app}>
      <h1 className="sr-only">TV App</h1>

      {activeTab !== 'random' && (
        <TabBar
          activeTab={activeTab}
          onTabChange={setActiveTab}
          onOpenSettings={() => {
            lastFocusedRef.current = document.activeElement;
            setSettingsOpen(true);
          }}
        />
      )}

      {/* Hide the app-level ControlsPanel while on a performer detail
      page — that page renders its own scoped ControlsPanel. */}
      {showControlsBar && !(activeTab === 'performers' && selectedPerformer) && (
        <ControlsPanel
          controls={controls}
          onChange={updateControls}
          modeOptions={config.modeOptions}
          sortGroups={config.sortGroups}
          showOrder={config.showOrder}
          showGridSize={config.showGridSize && controls.mode !== 'carousel' && controls.mode !== 'coverflow'}
          filterOptions={filterOptions}
          showSearch={config.showSearch}
          previewMuted={previewMuted}
          onMuteToggle={togglePreviewMuted}
        />
      )}

      {/* Keying main on dataKey forces a clean remount of the active
          page when the data source changes (Test↔Live, or endpoint/
          key change). All in-flight fetches and cached lists are
          dropped — no stale data leaks between sources. */}
      <main key={dataKey} className={styles.main} role="main">
        {activeTab === 'home'       && <HomePage       controls={controls} objectFilter={activeObjectFilter} searchQuery={activeSearchQuery} onVideoSelect={handleVideoSelect} />}
        {activeTab === 'performers' && (
          selectedPerformer
            ? <PerformerDetailPage
                performer={selectedPerformer}
                onBack={handlePerformerBack}
                onVideoSelect={handleVideoSelect}
                previewMuted={previewMuted}
                onMuteToggle={togglePreviewMuted}
              />
            : <PerformersPage controls={controls} objectFilter={activeObjectFilter} searchQuery={activeSearchQuery} onPerformerSelect={handlePerformerSelect} />
        )}
        {activeTab === 'markers'    && <MarkersPage    controls={controls} objectFilter={activeObjectFilter} searchQuery={activeSearchQuery} onMarkerSelect={handleMarkerSelect} />}
        {activeTab === 'random'     && <RandomPage     controls={homeControls} objectFilter={activeObjectFilter} searchQuery={activeSearchQuery} />}
      </main>

      {playingVideo && (
        <VideoPlayer
          video={playingVideo}
          startSeconds={startSeconds}
          onClose={handlePlayerClose}
        />
      )}

      {settingsOpen && (
        <SettingsPanel onClose={() => {
          setSettingsOpen(false);
          // Restore focus to whatever opened the panel (the hamburger,
          // typically). Defer one tick so the panel's DOM is gone first.
          setTimeout(() => {
            const el = lastFocusedRef.current;
            if (el && document.contains(el)) el.focus();
          }, 50);
        }} />
      )}

      {exitPromptOpen && (
        <ExitPrompt onCancel={() => setExitPromptOpen(false)} />
      )}

    {/*<DebugPreview />*/}
    </div>
  );
}
