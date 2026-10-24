'use client';

import { useState } from 'react';
import { PIANO_TITLE } from '../lib/pianoConfig';
import PianoKeyboard from './PianoKeyboard';

export default function PianoApp() {
  const [view, setView] = useState('Play');
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [showNotes, setShowNotes] = useState(false);
  const [showShortcuts, setShowShortcuts] = useState(false);

  return (
    <main className="piano-app">
      <header className="app-bar">
        <p className="wordmark">{PIANO_TITLE}</p>
        <nav aria-label="Piano navigation">
          {['Play', 'Recordings', 'Help'].map((label) => (
            <button
              key={label}
              type="button"
              aria-current={view === label ? 'page' : undefined}
              onClick={() => {
                setView(label);
                setSettingsOpen(false);
              }}
            >
              {label}
            </button>
          ))}
        </nav>
        <button
          className="settings-button"
          type="button"
          aria-expanded={settingsOpen}
          aria-controls="piano-settings"
          onClick={() => setSettingsOpen(!settingsOpen)}
        >
          Settings
        </button>
      </header>

      <section id="piano-settings" className="settings-panel" hidden={!settingsOpen} aria-labelledby="settings-title">
        <h2 id="settings-title">Keyboard settings</h2>
        <label>
          <input type="checkbox" checked={showNotes} onChange={(event) => setShowNotes(event.target.checked)} />
          Show note names
        </label>
        <label>
          <input type="checkbox" checked={showShortcuts} onChange={(event) => setShowShortcuts(event.target.checked)} />
          Show keyboard shortcuts
        </label>
        <p>Shortcut labels use US keyboard positions.</p>
      </section>

      <section hidden={view !== 'Play'} aria-label="Piano">
        <div className="piano-cabinet">
          <div className="piano-lid" aria-hidden="true" />
          <div className="fallboard"><h1>{PIANO_TITLE}</h1></div>
          <PianoKeyboard showNotes={showNotes} showShortcuts={showShortcuts} />
          <div className="front-rail" aria-hidden="true" />
        </div>
        <p className="preview-status">Sound and recording are not available in this preview yet.</p>
      </section>

      <section className="content-panel" hidden={view !== 'Recordings'} aria-labelledby="recordings-title">
        <h2 id="recordings-title">Your recordings</h2>
        <p className="empty-state">No recordings yet.</p>
        <p>Recordings will stay in this browser.</p>
        <p>Clearing site data will remove saved recordings. There is no cloud sync.</p>
      </section>

      <section className="content-panel" hidden={view !== 'Help'} aria-labelledby="help-title">
        <h2 id="help-title">Playing {PIANO_TITLE}</h2>
        <p>Use Lower octave and Higher octave to explore the piano from A0 to C8.</p>
        <p>Open Settings to show note names or US-position keyboard shortcuts.</p>
        <p>On a small screen, turn your phone sideways for more room. You can scroll the keyboard in a narrow window.</p>
        <p>Sound and recording are not available in this preview yet.</p>
      </section>
    </main>
  );
}
