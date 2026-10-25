import assert from 'node:assert/strict';
import test from 'node:test';
import {
  MAX_RECORDING_DURATION,
  MAX_RECORDING_EVENTS,
  createPerformanceRecorder,
  validateRecording,
} from '../../src/lib/performanceRecording.js';

function setup() {
  let id = 0;
  let createdAt = 0;
  const limited = [];
  const recorder = createPerformanceRecorder({
    bankId: 'test-bank-v1',
    createId: () => `take-${++id}`,
    createTimestamp: () => new Date(++createdAt).toISOString(),
    onLimit: (draft) => limited.push(draft),
  });
  return { recorder, limited };
}

test('records ownership transitions from the first note and closes overlapping notes', () => {
  const { recorder } = setup();
  assert.equal(recorder.start(10), true);
  assert.equal(recorder.record({ kind: 'note-on', note: 60, velocity: 0.72 }, 11), true);
  assert.equal(recorder.record({ kind: 'note-on', note: 64, velocity: 0.72 }, 12), true);
  assert.equal(recorder.record({ kind: 'note-off', note: 64 }, 13), true);
  const draft = recorder.stop(14);

  assert.equal(draft.title, 'Take 1');
  assert.equal(draft.duration, 3);
  assert.deepEqual(draft.events.map(({ time, sequence, kind, note, velocity }) => ({ time, sequence, kind, note, velocity })), [
    { time: 0, sequence: 0, kind: 'note-on', note: 60, velocity: 0.72 },
    { time: 1, sequence: 1, kind: 'note-on', note: 64, velocity: 0.72 },
    { time: 2, sequence: 2, kind: 'note-off', note: 64, velocity: undefined },
    { time: 3, sequence: 3, kind: 'note-off', note: 60, velocity: undefined },
  ]);
  assert.equal(recorder.isRecording(), false);
  assert.equal(validateRecording(draft), true);
});

test('captures sustain before the first note as initial state and ignores duplicate transitions', () => {
  const { recorder } = setup();
  recorder.start(20);
  assert.equal(recorder.record({ kind: 'sustain', value: true }, 21), true);
  assert.equal(recorder.record({ kind: 'sustain', value: true }, 22), false);
  recorder.record({ kind: 'note-on', note: 60, velocity: 0.72 }, 23);
  const draft = recorder.stop(24);

  assert.deepEqual(draft.events.map(({ kind, time, value, note }) => ({ kind, time, value, note })), [
    { kind: 'sustain', time: 0, value: true, note: undefined },
    { kind: 'note-on', time: 0, value: undefined, note: 60 },
    { kind: 'note-off', time: 1, value: undefined, note: 60 },
    { kind: 'sustain', time: 1, value: false, note: undefined },
  ]);
});

test('ignores duplicate note ownership and stale releases without corrupting the draft', () => {
  const { recorder } = setup();
  recorder.start(50);
  assert.equal(recorder.record({ kind: 'note-on', note: 60, velocity: 0.72 }, 51), true);
  assert.equal(recorder.record({ kind: 'note-on', note: 60, velocity: 0.72 }, 52), false);
  assert.equal(recorder.record({ kind: 'note-off', note: 64 }, 53), false);
  assert.equal(recorder.record({ kind: 'note-off', note: 60 }, 54), true);
  const draft = recorder.stop(55);

  assert.deepEqual(draft.events.map(({ kind, note, time }) => ({ kind, note, time })), [
    { kind: 'note-on', note: 60, time: 0 },
    { kind: 'note-off', note: 60, time: 3 },
  ]);
});

test('rejects invalid events and empty takes without producing a draft', () => {
  const { recorder } = setup();
  recorder.start(30);
  assert.throws(() => recorder.record({ kind: 'note-on', note: 20, velocity: 0.5 }, 31), RangeError);
  assert.throws(() => recorder.record({ kind: 'note-on', note: 60, velocity: 2 }, 31), RangeError);
  assert.equal(recorder.stop(31), null);
  assert.equal(recorder.isRecording(), false);
});

test('stops safely at the duration limit and retains the bounded draft', () => {
  const { recorder, limited } = setup();
  recorder.start(40);
  recorder.record({ kind: 'note-on', note: 60, velocity: 0.72 }, 40);
  const result = recorder.record({ kind: 'note-off', note: 60 }, 40 + MAX_RECORDING_DURATION + 1);

  assert.equal(result, false);
  assert.equal(limited.length, 1);
  assert.equal(limited[0].duration, MAX_RECORDING_DURATION);
  assert.equal(recorder.isRecording(), false);
  assert.ok(limited[0].events.length < MAX_RECORDING_EVENTS);
  assert.equal(validateRecording(limited[0]), true);
});
