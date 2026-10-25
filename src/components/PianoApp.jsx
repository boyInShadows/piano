'use client';

import { useCallback, useEffect, useRef, useState, useSyncExternalStore } from 'react';
import { PIANO_TITLE } from '../lib/pianoConfig';
import { createAudioEngine } from '../lib/audioEngine';
import { createPreferenceStore } from '../lib/pianoPreferences';
import { createPerformanceRecorder } from '../lib/performanceRecording';
import { createRecordingStore, RecordingLimitError } from '../lib/recordingStorage';
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
  const [recording, setRecording] = useState(false);
  const [draft, setDraft] = useState(null);
  const [savedRecordings, setSavedRecordings] = useState([]);
  const [storageStatus, setStorageStatus] = useState('loading');
  const [storageMessage, setStorageMessage] = useState('');
  const [storageBusy, setStorageBusy] = useState(false);
  const metronome = audio.metronome ?? { running: false, beat: 0 };
  const replaying = audio.replay?.running ?? false;
  const engine = useRef(null);
  const takeNumber = useRef(1);
  const recorder = useRef(null);
  const storage = useRef(null);
  const settingsButton = useRef(null);
  const settingsPanel = useRef(null);
  const settingsTitle = useRef(null);
  const settingsWasOpen = useRef(false);
  const recordingsTitle = useRef(null);
  const helpTitle = useRef(null);
  function persistFinalizedDraft(nextDraft) {
    if (!storage.current) return;
    void storage.current.saveDraft(nextDraft).catch((error) => {
      setStorageStatus('failed');
      setStorageMessage(`Draft not stored — ${error.message}`);
    });
  }
  recorder.current ??= createPerformanceRecorder({
    bankId: soundbank.id,
    onLimit: (limitedDraft) => { setDraft(limitedDraft); setRecording(false); persistFinalizedDraft(limitedDraft); },
  });
  const recordEvent = useCallback((event) => {
    recorder.current?.record(event, engine.current?.now() ?? 0);
  }, []);
  const finishRecording = useCallback(() => {
    if (!recorder.current?.isRecording()) return null;
    const nextDraft = recorder.current.stop(engine.current?.now() ?? 0);
    setRecording(false);
    if (nextDraft) {
      setDraft(nextDraft);
      persistFinalizedDraft(nextDraft);
    }
    return nextDraft;
  }, []);
  const { stopAll: releaseInputs, ...input } = usePianoInput(engine, recordEvent, finishRecording);
  const pressedNotes = new Set(input.notes);
  for (const note of audio.replay?.notes ?? []) pressedNotes.add(note);
  const stopAll = useCallback(() => {
    finishRecording();
    releaseInputs();
  }, [finishRecording, releaseInputs]);
  const playArea = useRef(null);
  const viewport = usePianoViewport(playArea, stopAll);
  const loadRecordings = useCallback(async () => {
    if (!storage.current) throw new Error('Saved recordings are still loading.');
    const next = await storage.current.list();
    setSavedRecordings(next);
    return next;
  }, []);
  useEffect(() => {
    const store = createRecordingStore();
    let active = true;
    storage.current = store;
    Promise.all([loadRecordings(), store.loadDraft()]).then(([, storedDraft]) => {
      if (active) {
        if (storedDraft) setDraft(storedDraft);
        setStorageStatus('ready');
      }
    }).catch((error) => {
      if (active) {
        setStorageStatus('failed');
        setStorageMessage(error.message);
      }
    });
    return () => {
      active = false;
      store.close();
      storage.current = null;
    };
  }, [loadRecordings]);
  useEffect(() => {
    if (settingsOpen) {
      settingsPanel.current?.showPopover();
      settingsTitle.current?.focus();
    } else {
      if (settingsPanel.current?.matches(':popover-open')) settingsPanel.current.hidePopover();
      if (settingsWasOpen.current) settingsButton.current?.focus();
    }
    settingsWasOpen.current = settingsOpen;
  }, [settingsOpen]);
  useEffect(() => {
    if (view === 'Recordings') recordingsTitle.current?.focus();
    if (view === 'Help') helpTitle.current?.focus();
  }, [view]);
  const [compactChoice, setCompactChoice] = useState(false);
  const compact = compactChoice && viewport.portrait && viewport.width < 600;
  const gated = (viewport.rotate && !compact) || viewport.availableHeight < viewport.minimumHeight;

  function chooseCompact() {
    stopAll();
    setCompactChoice(true);
  }

  useEffect(() => () => {
    finishRecording();
    engine.current?.dispose();
    engine.current = null;
  }, [finishRecording]);

  function enableSound() {
    if (!engine.current) {
      engine.current = createAudioEngine((next) => {
        if (next.status === 'failed' || next.status === 'suspended') stopAll();
        setAudio(next);
      });
      engine.current.setVolume(volume / 100);
      engine.current.setMuted(muted);
    }
    void engine.current.enable();
  }

  function startRecording() {
    if (audio.status !== 'ready' || replaying || draft || recorder.current?.isRecording()) return;
    releaseInputs();
    if (recorder.current.start(engine.current?.now() ?? 0, false, `Take ${takeNumber.current++}`)) setRecording(true);
  }

  function replayDraft() {
    replayRecording(draft);
  }

  function replayRecording(recordingToPlay) {
    if (!recordingToPlay || recording || replaying) return;
    stopAll();
    if (engine.current?.startReplay(recordingToPlay)) setView('Play');
  }

  async function saveDraft() {
    if (!draft || storageBusy || !storage.current) return;
    setStorageBusy(true);
    setStorageStatus('saving');
    setStorageMessage('');
    try {
      await storage.current.save(draft);
      let message = 'Saved on this device.';
      try { await storage.current.clearDraft(); } catch (error) { message = `Saved on this device, but draft cleanup failed — ${error.message}`; }
      recorder.current.discard();
      setDraft(null);
      setStorageStatus('ready');
      setStorageMessage(message);
      try { await loadRecordings(); } catch { setStorageMessage('Saved on this device. Reopen Recordings to refresh the list.'); }
    } catch (error) {
      setStorageStatus('failed');
      setStorageMessage(error instanceof RecordingLimitError
        ? 'The recording library is full. Delete a take before saving this draft.'
        : `Recording not saved — ${error.message}`);
    } finally {
      setStorageBusy(false);
    }
  }

  async function deleteRecording(recordingToDelete) {
    if (storageBusy || !storage.current || !window.confirm(`Delete ${recordingToDelete.title}?`)) return;
    setStorageBusy(true);
    setStorageStatus('deleting');
    setStorageMessage('');
    try {
      await storage.current.delete(recordingToDelete.id);
      await loadRecordings();
      setStorageStatus('ready');
      setStorageMessage(`${recordingToDelete.title} deleted.`);
    } catch (error) {
      setStorageStatus('failed');
      setStorageMessage(`Recording not deleted — ${error.message}`);
    } finally {
      setStorageBusy(false);
    }
  }

  function discardDraft() {
    recorder.current.discard();
    setDraft(null);
    void storage.current?.clearDraft().catch((error) => {
      setStorageStatus('failed');
      setStorageMessage(`Draft not cleared — ${error.message}`);
    });
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
                stopAll();
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
          ref={settingsButton}
          type="button"
          aria-label="Settings"
          aria-expanded={settingsOpen}
          aria-controls="piano-settings"
          onClick={() => { if (!replaying) stopAll(); setSettingsOpen(!settingsOpen); }}
        >
          <svg viewBox="0 0 24 24" aria-hidden="true"><path d="m9 3-.6 2.3-2 .9L4.3 5.5 2 9.5l1.8 1.6v1.8L2 14.5l2.3 4 2.1-.7 2 .9L9 21h6l.6-2.3 2-.9 2.1.7 2.3-4-1.8-1.6v-1.8L22 9.5l-2.3-4-2.1.7-2-.9L15 3Z" /><circle cx="12" cy="12" r="3" /></svg>
        </button>
      </header>

      <section id="piano-settings" className="settings-panel" popover="auto" ref={settingsPanel}
        onToggle={(event) => setSettingsOpen(event.newState === 'open')} aria-labelledby="settings-title">
        <h2 id="settings-title" ref={settingsTitle} tabIndex={-1}>Keyboard settings</h2>
        <button className="close-settings" type="button" aria-label="Close settings" onClick={() => setSettingsOpen(false)}>
          <svg viewBox="0 0 24 24" aria-hidden="true"><path d="m6 6 12 12M6 18 18 6" /></svg>
        </button>
        <label className="hint-setting">
          <input type="checkbox" checked={showNotes} onChange={(event) => preferenceStore.update({ showNotes: event.target.checked })} />
          <span>Show note names</span>
        </label>
        <label className="hint-setting">
          <input type="checkbox" checked={showShortcuts} onChange={(event) => preferenceStore.update({ showShortcuts: event.target.checked })} />
          <span>Show keyboard shortcuts</span>
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
        {compactChoice && <button type="button" onClick={() => { stopAll(); setCompactChoice(false); }}>Use landscape-first layout</button>}
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
                ready={audio.status === 'ready'} disabled={replaying} pressedNotes={pressedNotes}
                onPress={input.press} onMove={input.move} onRelease={input.release}
                onMomentary={input.setMomentary} onStopAll={stopAll}
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
              {audio.status === 'ready' && <button type="button" aria-label="Latch sustain" aria-pressed={input.latched} disabled={replaying} onClick={() => input.setLatched(!input.latched)}>{input.sustain ? 'Sustain on' : 'Sustain off'}</button>}
              {audio.status === 'ready' && <button className="record-button" type="button" aria-pressed={recording} disabled={replaying || (Boolean(draft) && !recording)} onClick={recording ? stopAll : startRecording}>{recording ? 'Stop recording' : 'Record'}</button>}
              {recording && <span className="recording-status" role="status">Recording<span className="visually-hidden"> musical events</span></span>}
              {replaying && <span className="recording-status" role="status">Replaying<span className="visually-hidden"> recording</span></span>}
              <span className="pedal-status">{input.sustain ? 'Pedal on' : 'Pedal off'}</span>
              <button className="stop-all-button" type="button" onClick={stopAll}>Stop all</button>
            </div>
          </>}
        </div>
        {!gated && <p className="preview-status">Click the keys or focus the piano and use A W S E D F T G Y H U J K. Hold Space for sustain. Escape stops all notes.</p>}
      </section>

      <section className="content-panel" hidden={view !== 'Recordings'} aria-labelledby="recordings-title">
        <h2 id="recordings-title" ref={recordingsTitle} tabIndex={-1}>Your recordings</h2>
        {recording && <p role="status">Recording in progress. Return to Play and choose Stop recording when finished.</p>}
        {replaying && <p role="status">Replaying recording. Live piano input is disabled until playback ends.</p>}
        {storageMessage && <p role="status">{storageMessage}</p>}
        {storageStatus === 'loading' && <p role="status">Loading saved recordings…</p>}
        {draft ? <div className="recording-draft" data-event-count={draft.events.length}>
          <h3>Unsaved draft: {draft.title}</h3>
          <p>{draft.events.length} musical events, {draft.duration.toFixed(2)} seconds.</p>
          <button type="button" disabled={replaying} onClick={replayDraft}>Replay</button>
          <button type="button" disabled={storageBusy || storageStatus === 'loading'} onClick={saveDraft}>{storageStatus === 'saving' ? 'Saving…' : storageStatus === 'failed' ? 'Retry save' : 'Save'}</button>
          <button type="button" onClick={discardDraft}>Discard draft</button>
          {replaying && <button type="button" onClick={stopAll}>Stop playback</button>}
        </div> : savedRecordings.length === 0 && storageStatus !== 'loading' ? <p className="empty-state">No saved recordings yet.</p> : null}
        {savedRecordings.length > 0 && <ul className="recording-list">
          {savedRecordings.map((saved) => (
            <li key={saved.id} className="recording-item">
              <div><h3>{saved.title}</h3><p>{new Date(saved.createdAt).toLocaleString()} · {saved.duration.toFixed(2)} seconds</p></div>
              <div className="recording-actions">
                <button type="button" disabled={recording || replaying} onClick={() => replayRecording(saved)}>Replay</button>
                <button type="button" disabled={storageBusy || replaying} onClick={() => deleteRecording(saved)}>Delete</button>
              </div>
            </li>
          ))}
        </ul>}
        <p>Recordings will stay in this browser.</p>
        <p>Clearing site data will remove saved recordings. There is no cloud sync.</p>
      </section>

      <section className="content-panel" hidden={view !== 'Help'} aria-labelledby="help-title">
        <h2 id="help-title" ref={helpTitle} tabIndex={-1}>Playing {PIANO_TITLE}</h2>
        <p>Use Lower octave and Higher octave to explore the piano from A0 to C8.</p>
        <p>Open Settings to show note names or US-position keyboard shortcuts.</p>
        <p>Enable sound, then click or touch keys. Drag across the keyboard to slide between notes. Focus the piano to use physical US-position shortcuts, or use the arrow keys and hold Enter to audition a note.</p>
        <p>Space is a momentary pedal while the piano has focus. Latch sustain keeps the pedal down until switched off. Stop all or Escape clears notes and both pedal states. Leaving the page, changing range, or losing focus also releases notes.</p>
        <p>After enabling sound, switch Metronome on and adjust Tempo from 40 to 240 BPM. The four numbers mark the beat; beat one has a higher click. Mute silences the piano and click while the beat keeps running. Stop all, navigation, Settings or an interruption stops the metronome; it does not restart automatically.</p>
        <p>Volume, note names, shortcut hints and tempo are saved in this browser when storage is available. Sound activation, mute, sustain and running transport reset on reload. Compact mode lasts only until reload.</p>
        <p>On a small screen, turn your phone sideways for larger keys. If rotation is locked, choose Use compact keyboard on the Play screen. This choice lasts until you reload; landscape automatically restores the larger range. If keys cannot fit, close Settings, zoom out or use a wider window.</p>
        <p>Enable sound to load the grand piano. Record captures note ownership and sustain events, then keeps an unsaved draft until you save or discard it.</p>
        <p>Replay follows the recorded audio-clock timing, disables live keys, and can be cancelled with Stop all. Tempo does not change replay speed.</p>
        <p>Sound: <a href={soundbank.sourceUrl}>{soundbank.title}</a> by {soundbank.author}, licensed under <a href={soundbank.licenseUrl}>{soundbank.license}</a>. The web bank selects 16 samples and caps long tails at 12 seconds with a short fade.</p>
      </section>
    </main>
  );
}
