'use client';

import { useEffect, useRef, useState } from 'react';
import { PIANO_TITLE } from '../lib/pianoConfig';
import { createAudioEngine } from '../lib/audioEngine';
import soundbank from '../../public/audio/piano/salamander-v1/manifest.json';
import PianoKeyboard from './PianoKeyboard';

export default function PianoApp() {
  const [view, setView] = useState('Play');
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [showNotes, setShowNotes] = useState(false);
  const [showShortcuts, setShowShortcuts] = useState(false);
  const [audio, setAudio] = useState({ status: 'not-enabled', loaded: 0 });
  const [volume, setVolume] = useState(35);
  const [muted, setMuted] = useState(false);
  const engine = useRef(null);

  useEffect(() => () => {
    engine.current?.dispose();
    engine.current = null;
  }, []);

  function enableSound() {
    if (!engine.current) {
      engine.current = createAudioEngine(setAudio);
      engine.current.setVolume(volume / 100);
      engine.current.setMuted(muted);
    }
    void engine.current.enable();
  }

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
        <div className="audio-controls">
          {audio.status !== 'ready' && (
            <button type="button" onClick={enableSound} disabled={audio.status === 'loading'}>
              {{ 'not-enabled': 'Enable sound', loading: 'Loading piano…', failed: 'Retry sound', suspended: 'Resume sound' }[audio.status]}
            </button>
          )}
          <p role="status">
            {{ 'not-enabled': 'Enable sound to load the grand piano.', loading: 'Loading piano', ready: 'Sound ready', failed: 'Sound could not load. Retry, or use a browser with Web Audio support.', suspended: 'Sound interrupted. Resume when you are ready.' }[audio.status]}
          </p>
          {audio.status === 'loading' && <progress aria-label="Piano samples loaded" value={audio.loaded} max={soundbank.samples.length} />}
          <label>Volume
            <input type="range" min="0" max="100" value={volume} onChange={(event) => {
              const value = Number(event.target.value);
              setVolume(value);
              engine.current?.setVolume(value / 100);
            }} />
          </label>
          <button type="button" aria-pressed={muted} onClick={() => {
            setMuted(!muted);
            engine.current?.setMuted(!muted);
          }}>{muted ? 'Unmute' : 'Mute'}</button>
          <button type="button" onClick={() => engine.current?.stopAll()}>Stop all</button>
        </div>
        <p className="preview-status">Keyboard input and recording are being prepared.</p>
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
        <p>Enable sound to load the grand piano. Recording is being prepared.</p>
        <p>Sound: <a href={soundbank.sourceUrl}>{soundbank.title}</a> by {soundbank.author}, licensed under <a href={soundbank.licenseUrl}>{soundbank.license}</a>. The web bank selects 16 samples and caps long tails at 12 seconds with a short fade.</p>
      </section>
    </main>
  );
}
