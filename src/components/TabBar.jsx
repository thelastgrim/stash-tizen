/**
 * TabBar — Top navigation tabs + app menu (hamburger)
 * Zone: 'tabs'
 */

import React, { useState, useEffect, useRef } from 'react';
import { useFocusable } from '../hooks/useFocusable.js';
import styles from './TabBar.module.css';

const TABS = [
  { id: 'home',       label: 'Home' },
  { id: 'performers', label: 'Performers' },
  { id: 'markers',    label: 'Markers' },
  { id: 'random',     label: 'Reels' },
];

function Tab({ tab, active, onSelect, autoFocus, registerRef }) {
  const { ref, focused } = useFocusable({
    id: `tab-${tab.id}`,
    zone: 'tabs',
    onEnter: () => onSelect(tab.id),
    autoFocus,
  });

  // Combine the focusable ref with the registration callback so
  // the parent TabBar can measure this tab's position for the
  // sliding indicator.
  const setRef = (el) => {
    ref.current = el;
    registerRef(tab.id, el);
  };

  return (
    <button
      ref={setRef}
      className={`${styles.tab} ${active ? styles.active : ''} ${focused ? styles.focused : ''}`}
      onClick={() => onSelect(tab.id)}
      aria-selected={active}
      role="tab"
    >
      {tab.label}
    </button>
  );
}

// ── App menu item — single entry "Settings" for now ──────
function MenuItem({ label, onClick, autoFocus }) {
  const { ref, focused } = useFocusable({
    id: `appmenu-${label.toLowerCase()}`,
    zone: 'appmenu',
    onEnter: onClick,
    autoFocus,
  });
  return (
    <button
      ref={ref}
      className={`${styles.menuItem} ${focused ? styles.focused : ''}`}
      onClick={onClick}
      role="menuitem"
    >
      {label}
    </button>
  );
}

function HamburgerButton({ open, onToggle }) {
  const { ref, focused } = useFocusable({
    id: 'appmenu-trigger',
    zone: 'tabs',
    onEnter: onToggle,
  });

  return (
    <button
      ref={ref}
      className={`${styles.hamburger} ${focused ? styles.focused : ''} ${open ? styles.hamburgerOpen : ''}`}
      onClick={onToggle}
      aria-label="App menu"
      aria-haspopup="menu"
      aria-expanded={open}
    >
      <svg width="22" height="22" viewBox="0 0 22 22" fill="none" aria-hidden="true">
        <path d="M3 6h16M3 11h16M3 16h16" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
      </svg>
    </button>
  );
}

export default function TabBar({ activeTab, onTabChange, onOpenSettings }) {
  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef(null);

  const tabRefs = useRef({});
  const [indicatorStyle, setIndicatorStyle] = useState({ left: 0, width: 0, opacity: 0 });

  const registerTabRef = (id, el) => {
    if (el) tabRefs.current[id] = el;
  };

  useEffect(() => {
    const el = tabRefs.current[activeTab];
    if (!el) return;
    // The indicator sits inside the tab's padding — pull in 20px on
    // each side so it doesn't span the full button width.
    setIndicatorStyle({
      left: el.offsetLeft + 20,
      width: el.offsetWidth - 40,
      opacity: 1,
    });
  }, [activeTab]);

  useEffect(() => {
    const el = tabRefs.current[activeTab];
    if (!el) return;
    setIndicatorStyle({
      left: el.offsetLeft + 20,
      width: el.offsetWidth - 40,
    });
  }, [activeTab]);

  // Close on click outside
  useEffect(() => {
    if (!menuOpen) return;
    const onDocClick = (e) => {
      if (menuRef.current && !menuRef.current.contains(e.target)) {
        setMenuOpen(false);
      }
    };
    // Defer one tick so the click that opened the menu doesn't immediately close it
    const t = setTimeout(() => document.addEventListener('mousedown', onDocClick), 0);
    return () => {
      clearTimeout(t);
      document.removeEventListener('mousedown', onDocClick);
    };
  }, [menuOpen]);

  // Close menu on Backspace / Tizen Back
  useEffect(() => {
    if (!menuOpen) return;
    const onKey = (e) => {
      if (e.key === 'Backspace' || e.keyCode === 10009 || e.key === 'Escape') {
        e.preventDefault();
        e.stopPropagation();
        setMenuOpen(false);
        // Return focus to the hamburger
        const trigger = document.querySelector('[aria-label="App menu"]');
        if (trigger) trigger.focus();
      }
    };
    window.addEventListener('keydown', onKey, true);
    return () => window.removeEventListener('keydown', onKey, true);
  }, [menuOpen]);

  const handleSettingsClick = () => {
    setMenuOpen(false);
    onOpenSettings?.();
  };

  // Pull focus into the menu whenever it opens. Deferred to next tick
  // so the DOM has actually rendered the menu items before we focus.
  useEffect(() => {
    if (!menuOpen) return;
    const t = setTimeout(() => {
      const firstItem = document.querySelector('[role="menu"] [role="menuitem"]');
      if (firstItem) firstItem.focus();
    }, 0);
    return () => clearTimeout(t);
  }, [menuOpen]);

  return (
    <nav className={styles.tabBar} role="tablist" aria-label="Main navigation">
      {TABS.map((tab, i) => (
        <Tab
          key={tab.id}
          tab={tab}
          active={activeTab === tab.id}
          onSelect={onTabChange}
          autoFocus={i === 0}
          registerRef={registerTabRef}
        />
      ))}
      <span className={styles.slidingIndicator} style={indicatorStyle} />
      <div className={styles.spacer} />

      <div className={styles.menuWrap} ref={menuRef}>
        <HamburgerButton open={menuOpen} onToggle={() => setMenuOpen(o => !o)} />
        {menuOpen && (
          <div className={styles.menu} role="menu">
            <MenuItem label="Settings" onClick={handleSettingsClick} />
          </div>
        )}
      </div>
    </nav>
  );
}
