import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App.jsx';
import './index.css';

// Register Tizen TV remote keys (no-op in browser dev)
if (typeof window !== 'undefined' && window.tizen?.tvinputdevice) {
  try {
    const keys = [
      'MediaPlay', 'MediaPause', 'MediaPlayPause',
      'MediaStop', 'MediaRewind', 'MediaFastForward',
      'ColorF0Red', 'ColorF1Green', 'ColorF2Yellow', 'ColorF3Blue',
    ];
    keys.forEach(k => {
      try { window.tizen.tvinputdevice.registerKey(k); } catch(e) {}
    });
  } catch (e) {
    console.warn('Tizen key registration failed:', e);
  }
}

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
