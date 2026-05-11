/**
 * ControlsPanel — Configurable controls bar
 *
 * Sort dropdown supports BOTH legacy flat sortOptions AND new grouped
 * sortGroups. If sortGroups is provided, it takes precedence.
 *
 * sortGroups shape: [{ group: 'Title', options: [{ value, label }] }]
 */

import React, { useState } from 'react';
import { useFocusable } from '../hooks/useFocusable.js';
import styles from './ControlsPanel.module.css';
import SearchInput from './SearchInput.jsx';
import MuteToggle from './MuteToggle.jsx';

// Flatten groups for value → label lookup
function flattenGroups(groups) {
  return groups.flatMap(g => g.options);
}

// ── Generic Mode dropdown (still flat, only a few options) ─
function SelectControl({ id, label, options, value, onChange }) {
  const [open, setOpen] = useState(false);
  const { ref: triggerRef, focused } = useFocusable({
    id,
    zone: 'controls',
    onEnter: () => setOpen(o => !o),
  });

  const currentLabel = options.find(o => o.value === value)?.label || value;

  return (
    <div className={styles.control}>
      <span className={styles.controlLabel}>{label}</span>
      <div className={styles.selectWrapper}>
        <button
          ref={triggerRef}
          className={`${styles.selectBtn} ${focused ? styles.focused : ''} ${open ? styles.open : ''}`}
          onClick={() => setOpen(o => !o)}
          aria-haspopup="listbox"
          aria-expanded={open}
        >
          <span>{currentLabel}</span>
          <svg width="14" height="14" viewBox="0 0 14 14" fill="none" aria-hidden="true"
            style={{ transform: open ? 'rotate(180deg)' : 'none', transition: 'transform 0.2s' }}>
            <path d="M2 5l5 5 5-5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
          </svg>
        </button>

        {open && (
          <div className={styles.dropdown} role="listbox">
            {options.map(opt => (
              <DropdownOption
                key={opt.value}
                opt={opt}
                selected={value === opt.value}
                onSelect={(v) => { onChange(v); setOpen(false); }}
                parentId={id}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

// ── Grouped Sort dropdown ─────────────────────────────────
function SortGroupedControl({ id, label, groups, value, onChange }) {
  const [open, setOpen] = useState(false);
  const { ref: triggerRef, focused } = useFocusable({
    id,
    zone: 'controls',
    onEnter: () => setOpen(o => !o),
  });

  const flat = flattenGroups(groups);
  const currentLabel = flat.find(o => o.value === value)?.label || value;

  return (
    <div className={styles.control}>
      <span className={styles.controlLabel}>{label}</span>
      <div className={styles.selectWrapper}>
        <button
          ref={triggerRef}
          className={`${styles.selectBtn} ${focused ? styles.focused : ''} ${open ? styles.open : ''}`}
          onClick={() => setOpen(o => !o)}
          aria-haspopup="listbox"
          aria-expanded={open}
        >
          <span>{currentLabel}</span>
          <svg width="14" height="14" viewBox="0 0 14 14" fill="none" aria-hidden="true"
            style={{ transform: open ? 'rotate(180deg)' : 'none', transition: 'transform 0.2s' }}>
            <path d="M2 5l5 5 5-5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
          </svg>
        </button>

        {open && (
          <div className={`${styles.dropdown} ${styles.dropdownScrollable}`} role="listbox">
            {groups.map((group, gi) => (
              <div key={group.group} className={styles.dropdownGroup}>
                <div className={styles.dropdownGroupHeader}>{group.group}</div>
                {group.options.map(opt => (
                  <DropdownOption
                    key={opt.value}
                    opt={opt}
                    selected={value === opt.value}
                    onSelect={(v) => { onChange(v); setOpen(false); }}
                    parentId={id}
                  />
                ))}
                {gi < groups.length - 1 && <div className={styles.dropdownGroupDivider} />}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function DropdownOption({ opt, selected, onSelect, parentId }) {
  const { ref, focused } = useFocusable({
    id: `${parentId}-opt-${opt.value}`,
    zone: `dropdown-${parentId}`,
    onEnter: () => onSelect(opt.value),
  });

  return (
    <button
      ref={ref}
      className={`${styles.dropdownItem} ${selected ? styles.selected : ''} ${focused ? styles.focused : ''}`}
      onClick={() => onSelect(opt.value)}
      role="option"
      aria-selected={selected}
    >
      {opt.label}
      {selected && <span className={styles.check}>✓</span>}
    </button>
  );
}

// ── Toggle ─────────────────────────────────────────────────
function ToggleBtn({ id, label, active, onClick }) {
  const { ref, focused } = useFocusable({
    id,
    zone: 'controls',
    onEnter: onClick,
  });

  return (
    <button
      ref={ref}
      className={`${styles.toggleBtn} ${active ? styles.active : ''} ${focused ? styles.focused : ''}`}
      onClick={onClick}
      aria-pressed={active}
    >
      {label}
    </button>
  );
}

// ── Stepper ────────────────────────────────────────────────
function NumberStepper({ id, value, min, max, onChange }) {
  const { ref: decRef, focused: decFocused } = useFocusable({
    id: `${id}-dec`,
    zone: 'controls',
    onEnter: () => onChange(Math.max(min, value - 1)),
  });
  const { ref: incRef, focused: incFocused } = useFocusable({
    id: `${id}-inc`,
    zone: 'controls',
    onEnter: () => onChange(Math.min(max, value + 1)),
  });

  return (
    <div className={styles.stepper}>
      <button
        ref={decRef}
        className={`${styles.stepperBtn} ${decFocused ? styles.focused : ''}`}
        onClick={() => onChange(Math.max(min, value - 1))}
        disabled={value <= min}
        aria-label={`Decrease ${id}`}
      >−</button>
      <span className={styles.stepperVal}>{value}</span>
      <button
        ref={incRef}
        className={`${styles.stepperBtn} ${incFocused ? styles.focused : ''}`}
        onClick={() => onChange(Math.min(max, value + 1))}
        disabled={value >= max}
        aria-label={`Increase ${id}`}
      >+</button>
    </div>
  );
}

// ── Main ───────────────────────────────────────────────────
export default function ControlsPanel({
  controls,
  onChange,
  modeOptions = null,
  sortOptions = [],       // legacy flat list (still supported)
  sortGroups = null,      // new grouped sort option
  showOrder = true,
  showGridSize = true,
  filterOptions = null,    // [{ value, label }] or null to hide
  showSearch = false,
  previewMuted = true,
  onMuteToggle = null,
}) {
  const { mode, sort, order, cols } = controls;
  const showDivider = (a, b) => a && b;

  // Use grouped if provided, else fall back to flat
  const hasSort = (sortGroups && sortGroups.length) || sortOptions.length;

  return (
    <div className={styles.panel} role="toolbar" aria-label="Controls">
      {showSearch && (
        <>
          <SearchInput
            value={controls.search || ''}
            onChange={v => onChange({ search: v })}
          />
          {(modeOptions || sortGroups || sortOptions.length > 0 || showOrder || filterOptions || showGridSize) && (
            <div className={styles.divider} />
          )}
        </>
      )}
      {modeOptions && (
        <SelectControl
          id="ctrl-mode"
          label="Mode"
          options={modeOptions}
          value={mode}
          onChange={v => onChange({ mode: v })}
        />
      )}

      {showDivider(modeOptions, hasSort) && <div className={styles.divider} />}

      {sortGroups && sortGroups.length > 0 && (
        <SortGroupedControl
          id="ctrl-sort"
          label="Sort"
          groups={sortGroups}
          value={sort}
          onChange={v => onChange({ sort: v })}
        />
      )}

      {!sortGroups && sortOptions.length > 0 && (
        <SelectControl
          id="ctrl-sort"
          label="Sort"
          options={sortOptions}
          value={sort}
          onChange={v => onChange({ sort: v })}
        />
      )}

      {showOrder && (
        <div className={styles.orderGroup}>
          <ToggleBtn
            id="ctrl-asc"
            label="ASC ↑"
            active={order === 'asc'}
            onClick={() => onChange({ order: 'asc' })}
          />
          <ToggleBtn
            id="ctrl-desc"
            label="DESC ↓"
            active={order === 'desc'}
            onClick={() => onChange({ order: 'desc' })}
          />
        </div>
      )}

      {filterOptions && (
        <>
          {showDivider(hasSort || showOrder, true) && <div className={styles.divider} />}
          <SelectControl
            id="ctrl-filter"
            label="Filter"
            options={filterOptions}
            value={controls.filterId || ''}
            onChange={v => onChange({ filterId: v || null })}
          />
        </>
      )}

      {showGridSize && showDivider(hasSort || showOrder || filterOptions, true) && (
        <div className={styles.divider} />
      )}
      
      {showGridSize && (
        <div className={styles.control}>
          <span className={styles.controlLabel}>Columns</span>
          <NumberStepper
            id="grid-cols"
            value={cols}
            min={1}
            max={8}
            onChange={v => onChange({ cols: v })}
          />
        </div>
      )}
      {onMuteToggle && (
        <>
          {showGridSize && <div className={styles.divider} />}
          <MuteToggle muted={previewMuted} onToggle={onMuteToggle} />
        </>
      )}
    </div>
  );
}
