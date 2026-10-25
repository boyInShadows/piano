export const MAX_RECORDING_DURATION = 300;
export const MAX_RECORDING_EVENTS = 20000;

const MIN_MIDI = 21;
const MAX_MIDI = 108;
const MAX_OPEN_EVENTS = MAX_MIDI - MIN_MIDI + 2;
const DEFAULT_VELOCITY = 0.72;

function defaultId() {
  return globalThis.crypto?.randomUUID?.() ?? `take-${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

function readTime(value, now) {
  const time = value === undefined ? now() : value;
  if (!Number.isFinite(time)) throw new RangeError('Recording time must be finite.');
  return time;
}

function validateEvent(event) {
  if (!event || typeof event.kind !== 'string') throw new TypeError('Recording events need a kind.');
  if (!['note-on', 'note-off', 'sustain'].includes(event.kind)) throw new RangeError('Unsupported recording event.');
  if (event.kind === 'sustain') {
    if (typeof event.value !== 'boolean') throw new TypeError('Sustain events need a boolean value.');
    return;
  }
  if (!Number.isInteger(event.note) || event.note < MIN_MIDI || event.note > MAX_MIDI) throw new RangeError('Recording notes must use MIDI 21 through 108.');
  if (event.kind === 'note-on' && (!Number.isFinite(event.velocity ?? DEFAULT_VELOCITY) || event.velocity < 0 || event.velocity > 1)) {
    throw new RangeError('Recording velocity must be between 0 and 1.');
  }
}

function copyEvent(event, time, sequence) {
  return event.kind === 'sustain'
    ? { time, sequence, kind: event.kind, value: event.value }
    : event.kind === 'note-on'
      ? { time, sequence, kind: event.kind, note: event.note, velocity: event.velocity ?? DEFAULT_VELOCITY }
      : { time, sequence, kind: event.kind, note: event.note };
}

function isValidRecording(recording) {
  if (!recording || recording.schemaVersion !== 1 || typeof recording.id !== 'string' || !recording.id) return false;
  if (typeof recording.createdAt !== 'string' || Number.isNaN(Date.parse(recording.createdAt))) return false;
  if (typeof recording.title !== 'string' || !recording.title || typeof recording.bankId !== 'string' || !recording.bankId) return false;
  if (!Number.isFinite(recording.duration) || recording.duration < 0 || recording.duration > MAX_RECORDING_DURATION) return false;
  if (!Array.isArray(recording.events) || recording.events.length > MAX_RECORDING_EVENTS) return false;
  if (recording.events.length && recording.events[0].sequence !== 0) return false;
  let previousTime = 0;
  let previousSequence = -1;
  for (const event of recording.events) {
    if (!Number.isFinite(event.time) || event.time < 0 || event.time > recording.duration || !Number.isInteger(event.sequence) || event.sequence <= previousSequence) return false;
    try { validateEvent(event); } catch { return false; }
    if (event.time < previousTime) return false;
    previousTime = event.time;
    previousSequence = event.sequence;
  }
  return true;
}

export function validateRecording(recording) {
  return isValidRecording(recording);
}

export function createPerformanceRecorder({
  bankId = 'unknown-bank',
  title = 'Take 1',
  now = () => 0,
  createId = defaultId,
  createTimestamp = () => new Date().toISOString(),
  onLimit = () => {},
} = {}) {
  let recording = false;
  let startedAt = null;
  let sequence = 0;
  let events = [];
  let activeNotes = new Set();
  let sustain = false;
  let initialSustain = false;
  let nextTitle = title;

  function reset() {
    recording = false;
    startedAt = null;
    sequence = 0;
    events = [];
    activeNotes = new Set();
    sustain = false;
    initialSustain = false;
  }

  function append(event, at) {
    if (startedAt === null) {
      startedAt = at;
      if (initialSustain) {
        events.push(copyEvent({ kind: 'sustain', value: true }, 0, sequence++));
        sustain = true;
      }
    }
    const time = Math.max(0, Math.min(MAX_RECORDING_DURATION, at - startedAt));
    events.push(copyEvent(event, time, sequence++));
  }

  function draft(at) {
    const duration = Math.max(0, Math.min(MAX_RECORDING_DURATION, at - startedAt));
    const result = {
      schemaVersion: 1,
      id: createId(),
      createdAt: createTimestamp(),
      title: nextTitle,
      duration,
      bankId,
      events: events.map((event) => ({ ...event })),
    };
    if (!isValidRecording(result)) throw new Error('Recorder produced an invalid draft.');
    return result;
  }

  function stop(at = now()) {
    if (!recording) return null;
    const finishAt = Math.max(startedAt ?? at, Math.min(at, (startedAt ?? at) + MAX_RECORDING_DURATION));
    if (startedAt === null) {
      reset();
      return null;
    }
    for (const note of [...activeNotes].sort((a, b) => a - b)) append({ kind: 'note-off', note }, finishAt);
    if (sustain) append({ kind: 'sustain', value: false }, finishAt);
    const result = draft(finishAt);
    reset();
    return result;
  }

  function stopForLimit(at) {
    const result = stop(at);
    if (result) onLimit(result);
    return result;
  }

  function start(at = now(), sustainAtStart = false, recordingTitle = title) {
    readTime(at, now);
    if (recording) return false;
    recording = true;
    startedAt = null;
    sequence = 0;
    events = [];
    activeNotes = new Set();
    sustain = false;
    initialSustain = Boolean(sustainAtStart);
    nextTitle = recordingTitle;
    return true;
  }

  function record(event, at = now()) {
    if (!recording) return false;
    validateEvent(event);
    const time = readTime(at, now);
    if (startedAt !== null && time - startedAt > MAX_RECORDING_DURATION) {
      stopForLimit(startedAt + MAX_RECORDING_DURATION);
      return false;
    }
    if (event.kind === 'sustain') {
      const next = event.value;
      if (startedAt === null) {
        if (initialSustain === next) return false;
        initialSustain = next;
        return true;
      }
      if (sustain === next) return false;
      append(event, time);
      sustain = next;
    } else if (event.kind === 'note-on') {
      if (activeNotes.has(event.note)) return false;
      if (events.length >= MAX_RECORDING_EVENTS - MAX_OPEN_EVENTS) {
        stopForLimit(time);
        return false;
      }
      append(event, time);
      activeNotes.add(event.note);
    } else {
      if (!activeNotes.has(event.note)) return false;
      append(event, time);
      activeNotes.delete(event.note);
    }
    if (events.length >= MAX_RECORDING_EVENTS - MAX_OPEN_EVENTS) stopForLimit(time);
    return true;
  }

  return {
    start,
    record,
    stop,
    isRecording: () => recording,
    discard: reset,
  };
}
