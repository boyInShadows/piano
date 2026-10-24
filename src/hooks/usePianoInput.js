'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { createNoteController } from '../lib/pianoInput';

export function usePianoInput(engine) {
  const controller = useRef(null);
  const [state, setState] = useState({ notes: new Set(), latched: false, sustain: false });

  useEffect(() => {
    controller.current = createNoteController({
      attack: (midi) => engine.current?.attack(midi) ?? false,
      release: (midi) => engine.current?.release(midi),
      setSustain: (value) => engine.current?.setSustain(value),
      stopAll: () => engine.current?.stopAll(),
    }, setState);
    const keyUp = (event) => {
      controller.current.release(`key:${event.code}`);
      if (event.code === 'Space') controller.current.setMomentary(false);
    };
    const blur = () => controller.current.stopAll();
    const visibility = () => { if (document.hidden) controller.current.stopAll(); };
    window.addEventListener('keyup', keyUp);
    window.addEventListener('blur', blur);
    document.addEventListener('visibilitychange', visibility);
    return () => {
      window.removeEventListener('keyup', keyUp);
      window.removeEventListener('blur', blur);
      document.removeEventListener('visibilitychange', visibility);
      controller.current.stopAll();
    };
  }, [engine]);

  const press = useCallback((source, midi) => controller.current?.press(source, midi), []);
  const move = useCallback((source, midi) => controller.current?.move(source, midi), []);
  const release = useCallback((source) => controller.current?.release(source), []);
  const stopAll = useCallback(() => controller.current?.stopAll(), []);
  const setLatched = useCallback((value) => controller.current?.setLatched(value), []);
  const setMomentary = useCallback((value) => controller.current?.setMomentary(value), []);
  return { ...state, press, move, release, stopAll, setLatched, setMomentary };
}
