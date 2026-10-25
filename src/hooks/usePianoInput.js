'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { createNoteController } from '../lib/pianoInput';

export function usePianoInput(engine, onEvent = () => {}, onInterruption = () => {}, { ready = true, activate } = {}) {
  const controller = useRef(null);
  const pending = useRef(new Map());
  const [state, setState] = useState({ notes: new Set(), latched: false, sustain: false });
  const release = useCallback((source) => {
    pending.current.delete(source);
    controller.current?.release(source);
  }, []);
  const stopAll = useCallback(() => {
    pending.current.clear();
    controller.current?.stopAll();
  }, []);
  const playPending = useCallback((source, note) => {
    if (pending.current.get(source) !== note || !note.ready || note.midi === null) return;
    pending.current.delete(source);
    controller.current?.press(source, note.midi);
  }, []);

  useEffect(() => {
    controller.current = createNoteController({
      attack: (midi) => engine.current?.attack(midi) ?? false,
      release: (midi) => engine.current?.release(midi),
      setSustain: (value) => engine.current?.setSustain(value),
      stopAll: () => engine.current?.stopAll(),
    }, setState, onEvent);
    const keyUp = (event) => {
      release(`key:${event.code}`);
      if (event.code === 'Space') controller.current.setMomentary(false);
    };
    const blur = () => { onInterruption(); stopAll(); };
    const visibility = () => { if (document.hidden) { onInterruption(); stopAll(); } };
    window.addEventListener('keyup', keyUp);
    window.addEventListener('blur', blur);
    document.addEventListener('visibilitychange', visibility);
    return () => {
      window.removeEventListener('keyup', keyUp);
      window.removeEventListener('blur', blur);
      document.removeEventListener('visibilitychange', visibility);
      stopAll();
    };
  }, [engine, onEvent, onInterruption, release, stopAll]);

  const press = useCallback((source, midi) => {
    if (ready) return controller.current?.press(source, midi);
    if (!activate) return false;
    const note = { midi, ready: false };
    pending.current.set(source, note);
    void activate().then((enabled) => {
      if (!enabled) {
        if (pending.current.get(source) === note) pending.current.delete(source);
        return;
      }
      note.ready = true;
      playPending(source, note);
    });
  }, [ready, activate, playPending]);
  const move = useCallback((source, midi) => {
    const note = pending.current.get(source);
    if (!note) return controller.current?.move(source, midi);
    note.midi = midi;
    playPending(source, note);
  }, [playPending]);
  const releaseHeld = useCallback(() => {
    pending.current.clear();
    controller.current?.releaseHeld();
  }, []);
  const setLatched = useCallback((value) => controller.current?.setLatched(value), []);
  const setMomentary = useCallback((value) => controller.current?.setMomentary(value), []);
  return { ...state, press, move, release, stopAll, releaseHeld, setLatched, setMomentary };
}
