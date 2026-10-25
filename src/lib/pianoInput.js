import { getNoteName } from './pianoNotes.js';

export function createNoteController(audio, onChange, onEvent = () => {}) {
  const sources = new Map();
  const owners = new Map();
  let latched = false;
  let momentary = false;

  function publish() {
    onChange({ notes: new Set(owners.keys()), latched, sustain: latched || momentary });
  }

  function releasePitch(source) {
    const midi = sources.get(source);
    if (midi == null) return;
    const held = owners.get(midi);
    held.delete(source);
    if (!held.size) {
      owners.delete(midi);
      audio.release(midi);
      onEvent({ kind: 'note-off', note: midi });
    }
  }

  function move(source, midi) {
    if (!sources.has(source)) return false;
    if (midi !== null) getNoteName(midi);
    if (sources.get(source) === midi) return true;
    releasePitch(source);
    sources.set(source, null);
    if (midi !== null) {
      const firstOwner = !owners.has(midi);
      if (firstOwner && audio.attack(midi) === false) { publish(); return false; }
      sources.set(source, midi);
      if (!owners.has(midi)) owners.set(midi, new Set());
      owners.get(midi).add(source);
      if (firstOwner) onEvent({ kind: 'note-on', note: midi, velocity: 0.72 });
    }
    publish();
    return true;
  }

  function press(source, midi) {
    getNoteName(midi);
    if (!sources.has(source)) sources.set(source, null);
    return move(source, midi);
  }

  function release(source) {
    if (!sources.has(source)) return;
    releasePitch(source);
    sources.delete(source);
    publish();
  }

  function setPedal(kind, value) {
    if ((kind === 'latch' ? latched : momentary) === Boolean(value)) return;
    const before = latched || momentary;
    if (kind === 'latch') latched = Boolean(value);
    else momentary = Boolean(value);
    if (before !== (latched || momentary)) {
      audio.setSustain(latched || momentary);
      onEvent({ kind: 'sustain', value: latched || momentary });
    }
    publish();
  }

  function stopAll() {
    sources.clear();
    owners.clear();
    latched = false;
    momentary = false;
    audio.stopAll();
    publish();
  }

  return { press, move, release, stopAll,
    setLatched: (value) => setPedal('latch', value),
    setMomentary: (value) => setPedal('momentary', value) };
}
