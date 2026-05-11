/**
 * SettingsPanel — Full-screen settings modal
 *
 * Opens from the hamburger menu. Shows:
 *   - Test (mock) / Live mode switch
 *   - When Live: Stash URL + API key text fields (persisted)
 *   - Save / Close actions
 *
 * Test/Live state is in-memory only (resets to Test on cold load).
 * URL and API key persist to localStorage via the settings store.
 *
 * Keyboard: Backspace / Esc / Tizen Back closes the modal.
 */

import React, { useEffect, useRef, useState } from 'react';
import { useFocusable } from '../hooks/useFocusable.js';
import styles from './SettingsPanel.module.css';
import { useSettings, setSettings, testStashConnection, clearSettings } from '../utils/settings.js';

const TIZEN_BACK = 10009;

// ── A focusable text input ───────────────────────────────
function TextField({ id, label, value, onChange, placeholder, type = 'text', inputRef }) {
  const { ref, focused } = useFocusable({
    id,
    zone: 'settings',
  });

  // Merge the focusable ref with the optional external ref.
  const setRef = (el) => {
    ref.current = el;
    if (typeof inputRef === 'function') inputRef(el);
    else if (inputRef) inputRef.current = el;
  };

  return (
    <label className={styles.field}>
      <span className={styles.fieldLabel}>{label}</span>
      <input
        ref={setRef}
        type={type}
        value={value}
        onChange={e => onChange(e.target.value)}
        placeholder={placeholder}
        className={`${styles.input} ${focused ? styles.focused : ''}`}
        spellCheck={false}
        autoCapitalize="off"
        autoCorrect="off"
      />
    </label>
  );
}

// ── Two-state toggle ─────────────────────────────────────
function ModeToggle({ value, onChange }) {
  const { ref: testRef, focused: testFocused } = useFocusable({
    id: 'settings-mode-test',
    zone: 'settings',
    onEnter: () => onChange(true),
    autoFocus: true,
  });
  const { ref: liveRef, focused: liveFocused } = useFocusable({
    id: 'settings-mode-live',
    zone: 'settings',
    onEnter: () => onChange(false),
  });

  return (
    <div className={styles.toggleRow}>
      <span className={styles.fieldLabel}>Mode</span>
      <div className={styles.toggleGroup} role="radiogroup" aria-label="Data source">
        <button
          ref={testRef}
          className={`${styles.toggle} ${value ? styles.toggleActive : ''} ${testFocused ? styles.focused : ''}`}
          onClick={() => onChange(true)}
          role="radio"
          aria-checked={value}
        >
          Test
        </button>
        <button
          ref={liveRef}
          className={`${styles.toggle} ${!value ? styles.toggleActive : ''} ${liveFocused ? styles.focused : ''}`}
          onClick={() => onChange(false)}
          role="radio"
          aria-checked={!value}
        >
          Live
        </button>
      </div>
    </div>
  );
}

// ── Generic action button ────────────────────────────────
function ActionButton({ id, label, primary, onClick, zone = 'settings' }) {
  const { ref, focused } = useFocusable({
    id,
    zone,
    onEnter: onClick,
  });
  return (
    <button
      ref={ref}
      className={`${styles.actionBtn} ${primary ? styles.actionPrimary : ''} ${focused ? styles.focused : ''}`}
      onClick={onClick}
    >
      {label}
    </button>
  );
}

// ── Main component ───────────────────────────────────────
export default function SettingsPanel({ onClose }) {
  const settings = useSettings();

  // Local draft state — only commits to the store on Save
  const [useMock, setUseMock] = useState(settings.useMock);
  const [stashUrl, setStashUrl] = useState(settings.stashUrl);
  const [stashKey, setStashKey] = useState(settings.stashKey);

  const [testing, setTesting] = useState(false);
  const [testResult, setTestResult] = useState(null);

  const [confirmingClear, setConfirmingClear] = useState(false);
  // testResult shape: { ok: boolean, message: string } | null

  const handleClear = () => {
    if (!confirmingClear) {
      setConfirmingClear(true);
      return;
    }
    clearSettings();
    // Reset draft state too so the modal reflects the cleared values
    setUseMock(true);
    setStashUrl('');
    setStashKey('');
    setConfirmingClear(false);
    setTestResult(null);
  };

  // Reset confirm state if user backs away from the button
  useEffect(() => {
    if (!confirmingClear) return;
    const t = setTimeout(() => setConfirmingClear(false), 4000);
    return () => clearTimeout(t);
  }, [confirmingClear]);

  const urlFieldRef = useRef(null);

  // When the user flips to Live, jump focus straight into the URL
  // field. Otherwise spatial nav from the toggle drops focus on the
  // nearest element below, which is "Save" — a confusing landing.
  useEffect(() => {
    if (!useMock) {
      // Defer one tick so the field's `pointer-events: none` has lifted
      // and the browser will accept the focus call.
      const t = setTimeout(() => {
        urlFieldRef.current?.focus();
      }, 0);
      return () => clearTimeout(t);
    }
  }, [useMock]);

  // Trap Back / Esc to close — except when the user is typing in
  // a text field, where Backspace should delete a character normally.
  useEffect(() => {
    const handler = (e) => {
      const ae = document.activeElement;
      const isTextInput =
        ae && (
          (ae.tagName === 'INPUT' && !['button', 'submit', 'checkbox', 'radio', 'range'].includes(ae.type)) ||
          ae.tagName === 'TEXTAREA' ||
          ae.isContentEditable
        );

      if (e.key === 'Escape' || e.keyCode === TIZEN_BACK ||
          (e.key === 'Backspace' && !isTextInput)) {
        e.preventDefault();
        e.stopPropagation();
        onClose?.();
      }
    };
    window.addEventListener('keydown', handler, true);
    return () => window.removeEventListener('keydown', handler, true);
  }, [onClose]);

  useEffect(() => { setTestResult(null); }, [stashUrl, stashKey]);

  const [saved, setSaved] = useState(false);

  const handleSave = () => {
    setSettings({ useMock, stashUrl: stashUrl.trim(), stashKey: stashKey.trim() });
    setSaved(true);
    setTimeout(() => onClose?.(), 5600);
  };

  
  const handleTest = async () => {
    setTesting(true);
    setTestResult(null);
    const result = await testStashConnection({
      url: stashUrl.trim(),
      key: stashKey.trim(),
    });
    setTesting(false);
    if (result.ok) {
      setTestResult({ ok: true, message: `Connected — Stash v${result.version}` });
    } else {
      setTestResult({ ok: false, message: result.reason });
    }
  };

  return (
    <div className={styles.overlay} role="dialog" aria-label="Settings" aria-modal="true">
      <div className={styles.panel}>
        <header className={styles.header}>
          <div className={styles.titleRow}>
            <h2 className={styles.title}>Settings</h2>
            <div className={styles.version}>v{__APP_VERSION__}</div>
          </div>
          <p className={styles.subtitle}>Connection &amp; data source</p>
        </header>

        <div className={styles.body}>
          <ModeToggle value={useMock} onChange={setUseMock} />

          {/* Live-mode fields. Always rendered (so values are kept while
              user toggles back and forth) but disabled in Test mode. */}
          <div className={`${styles.liveFields} ${useMock ? styles.disabled : ''}`}>
            <TextField
              id="settings-url"
              label="Stash GraphQL Endpoint"
              value={stashUrl}
              onChange={setStashUrl}
              placeholder="http://localhost:9999"
              inputRef={urlFieldRef}
            />
            <TextField
              id="settings-key"
              label="API Key"
              value={stashKey}
              onChange={setStashKey}
              placeholder="(optional)"
              type="password"
            />
            <div className={styles.testRow}>
              <ActionButton
                id="settings-test"
                label={testing ? 'Testing…' : 'Test connection'}
                onClick={handleTest}
              />
              {testResult && (
                <span className={`${styles.testResult} ${testResult.ok ? styles.testOk : styles.testFail}`}>
                  {testResult.ok ? '✓' : '✗'} {testResult.message}
                </span>
              )}
            </div>
            {useMock && (
              <p className={styles.hint}>
                Switch to <strong>Live</strong> to edit connection settings.
                Values are saved across sessions; mode resets to Test on each launch.
              </p>
            )}
            {!useMock && (
              <p className={styles.hint}>
                Endpoint &amp; key are saved to this device. The mode
                resets to Test on next launch.
              </p>
            )}
          </div>
        </div>

        <footer className={styles.footer}>
          <ActionButton
            id="settings-clear"
            label={confirmingClear ? 'Press again to confirm' : 'Clear saved'}
            onClick={handleClear}
            zone="settings-footer"
          />
          
          <div className={styles.footerSpacer} />
          <ActionButton
            id="settings-cancel"
            label="Cancel"
            onClick={onClose}
            zone="settings-footer"
          />
          <ActionButton
            id="settings-save"
            label="Save"
            onClick={handleSave}
            primary
            zone="settings-footer"
          />
        </footer>
      </div>
      
    </div>
  );
}
