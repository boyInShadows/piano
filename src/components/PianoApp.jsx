'use client';

import { useEffect, useRef, useState, useSyncExternalStore } from 'react';
import { PIANO_TITLE } from '../lib/pianoConfig';
import { createAudioEngine } from '../lib/audioEngine';
import { createPreferenceStore } from '../lib/pianoPreferences';
import { usePianoInput } from '../hooks/usePianoInput';
import { usePianoViewport } from '../hooks/usePianoViewport';
import soundbank from '../../public/audio/piano/salamander-v1/manifest.json';
import PianoKeyboard from './PianoKeyboard';
import PianoSpaceGuide from './PianoSpaceGuide';
import MetronomeControl from './MetronomeControl';

export default function PianoApp() {
  const [view, setView] = useState('Play');
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [preferenceStore] = useState(createPreferenceStore);
  const { preferences, error: preferenceError } = useSyncExternalStore(preferenceStore.subscribe, preferenceStore.getSnapshot, preferenceStore.getServerSnapshot);
  const { volume, showNotes, showShortcuts, bpm } = preferences;
  const [audio, setAudio] = useState({ status: 'not-enabled', loaded: 0 });
  const [muted, setMuted] = useState(false);
  const metronome = audio.metronome ?? { running: false, beat: 0 };
  const engine = useRef(null);
  const input = usePianoInput(engine);
  const playArea = useRef(null);
  const viewport = usePianoViewport(playArea, input.stopAll);
  const [compactChoice, setCompactChoice] = useState(false);
  const compact = compactChoice && viewport.portrait && viewport.width < 600;
  // Reserve the minimum key surface plus the cabinet and controls at each layout.
  let minimumHeight = viewport.width <= 700 ? 552 : 512;
  if (compact) minimumHeight = 396;
  if (viewport.short) minimumHeight = 244;
  const gated = (viewport.rotate && !compact) || viewport.availableHeight < minimumHeight;

  function chooseCompact() {
    input.stopAll();
    setCompactChoice(true);
  }

  useEffect(() => () => {
    engine.current?.dispose();
    engine.current = null;
  }, []);

  function enableSound() {
    if (!engine.current) {
      engine.current = createAudioEngine((next) => {
        if (next.status === 'failed' || next.status === 'suspended') input.stopAll();
        setAudio(next);
      });
      engine.current.setVolume(volume / 100);
      engine.current.setMuted(muted);
    }
    void engine.current.enable();
  }

  return (
    <main className={`piano-app${compact ? ' is-compact' : ''}`}>
      <header className="app-bar">
        <p className="wordmark">{PIANO_TITLE}</p>
        <nav aria-label="Piano navigation">
          {['Play', 'Recordings', 'Help'].map((label) => (
            <button
              key={label}
              type="button"
              aria-current={view === label ? 'page' : undefined}
              onClick={() => {
                input.stopAll();
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
          onClick={() => { input.stopAll(); setSettingsOpen(!settingsOpen); }}
        >
          Settings
        </button>
      </header>

      <section id="piano-settings" className="settings-panel" hidden={!settingsOpen} aria-labelledby="settings-title">
        <h2 id="settings-title">Keyboard settings</h2>
        <label>
          <input type="checkbox" checked={showNotes} onChange={(event) => preferenceStore.update({ showNotes: event.target.checked })} />
          Show note names
        </label>
        <label>
          <input type="checkbox" checked={showShortcuts} onChange={(event) => preferenceStore.update({ showShortcuts: event.target.checked })} />
          Show keyboard shortcuts
        </label>
        <label>Volume
          <input type="range" min="0" max="100" value={volume} onChange={(event) => {
            const value = Number(event.target.value);
            preferenceStore.update({ volume: value });
            engine.current?.setVolume(value / 100);
          }} />
        </label>
        <button type="button" aria-pressed={muted} onClick={() => {
          setMuted(!muted);
          engine.current?.setMuted(!muted);
        }}>{muted ? 'Unmute' : 'Mute'}</button>
        {compactChoice && <button type="button" onClick={() => { input.stopAll(); setCompactChoice(false); }}>Use landscape-first layout</button>}
        <p>Shortcut labels use US keyboard positions.</p>
        {preferenceError && <p role="status">{preferenceError}</p>}
      </section>

      <section hidden={view !== 'Play'} aria-label="Piano">
        <div className={`play-layout${gated ? ' is-gated' : ''}`} ref={playArea} style={{ '--play-height': `${viewport.availableHeight}px` }}>
          {gated ? <PianoSpaceGuide rotate={viewport.rotate && !compact} onCompact={viewport.rotate && !compact ? chooseCompact : undefined} /> : <>
            <div className="piano-cabinet">
              <div className="piano-lid" aria-hidden="true" />
              <div className="fallboard"><h1>{PIANO_TITLE}</h1></div>
              <PianoKeyboard
                compact={compact} onCompact={!compact && viewport.portrait && viewport.width < 600 ? chooseCompact : undefined}
                showNotes={showNotes} showShortcuts={showShortcuts}
                ready={audio.status === 'ready'} pressedNotes={input.notes}
                onPress={input.press} onMove={input.move} onRelease={input.release}
                onMomentary={input.setMomentary} onStopAll={input.stopAll}
              />
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
              {audio.status === 'ready' && <MetronomeControl running={metronome.running} beat={metronome.beat} bpm={bpm}
                onToggle={() => {
                  if (metronome.running) engine.current.stopMetronome();
                  else engine.current.startMetronome(bpm);
                }}
                onTempo={(value) => { preferenceStore.update({ bpm: value }); engine.current.setTempo(value); }} />}
              {audio.status === 'ready' && <button type="button" aria-label="Latch sustain" aria-pressed={input.latched} onClick={() => input.setLatched(!input.latched)}>{input.sustain ? 'Sustain on' : 'Sustain off'}</button>}
              <span className="pedal-status">{input.sustain ? 'Pedal on' : 'Pedal off'}</span>
              <button type="button" onClick={input.stopAll}>Stop all</button>
            </div>
          </>}
        </div>
        {!gated && <p className="preview-status">Click the keys or focus the piano and use A W S E D F T G Y H U J K. Hold Space for sustain. Escape stops all notes.</p>}
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
        <p>Enable sound, then click or touch keys. Drag across the keyboard to slide between notes. Focus the piano to use physical US-position shortcuts, or use the arrow keys and hold Enter to audition a note.</p>
        <p>Space is a momentary pedal while the piano has focus. Latch sustain keeps the pedal down until switched off. Stop all or Escape clears notes and both pedal states. Leaving the page, changing range, or losing focus also releases notes.</p>
        <p>After enabling sound, switch Metronome on and adjust Tempo from 40 to 240 BPM. The four numbers mark the beat; beat one has a higher click. Mute silences the piano and click while the beat keeps running. Stop all, navigation, Settings or an interruption stops the metronome; it does not restart automatically.</p>
        <p>Volume, note names, shortcut hints and tempo are saved in this browser when storage is available. Sound activation, mute, sustain and running transport reset on reload. Compact mode lasts only until reload.</p>
        <p>On a small screen, turn your phone sideways for larger keys. If rotation is locked, choose Use compact keyboard on the Play screen. This choice lasts until you reload; landscape automatically restores the larger range. If keys cannot fit, close Settings, zoom out or use a wider window.</p>
        <p>Enable sound to load the grand piano. Recording is being prepared.</p>
        <p>Sound: <a href={soundbank.sourceUrl}>{soundbank.title}</a> by {soundbank.author}, licensed under <a href={soundbank.licenseUrl}>{soundbank.license}</a>. The web bank selects 16 samples and caps long tails at 12 seconds with a short fade.</p>
      </section>
    </main>
  );
}
