import assert from 'node:assert/strict';
import test from 'node:test';
import { createReplayScheduler, REPLAY_RELEASE_TAIL } from '../../src/lib/replayScheduler.js';

function setup() {
  const calls = [];
  const states = [];
  const context = { state: 'running', currentTime: 10 };
  const toneContext = { now: () => 10 };
  const clocks = [];
  class Clock {
    constructor(options) { Object.assign(this, options); clocks.push(this); }
    start(...args) { this.startArgs = args; }
    stop(at) { this.stopAt = at; }
    dispose() { this.disposed = true; }
  }
  const scheduler = createReplayScheduler({
    context,
    toneContext,
    Clock,
    onAttack: (note, time) => calls.push(['note-on', note, time]),
    onRelease: (note, time) => calls.push(['note-off', note, time]),
    onSustain: (value, time) => calls.push(['sustain', value, time]),
    onState: (next) => states.push(next),
  });
  return { scheduler, clocks, calls, states, context };
}

const recording = {
  duration: 2.5,
  events: [
    { time: 0, sequence: 0, kind: 'note-on', note: 60, velocity: 0.72 },
    { time: 0, sequence: 1, kind: 'note-on', note: 64, velocity: 0.72 },
    { time: 0.5, sequence: 2, kind: 'note-off', note: 64 },
    { time: 1, sequence: 3, kind: 'sustain', value: true },
    { time: 1.5, sequence: 4, kind: 'note-off', note: 60 },
    { time: 2.5, sequence: 5, kind: 'sustain', value: false },
  ],
};

test('replays stable event order with scheduler-provided audio times and release tail', () => {
  const fixture = setup();
  fixture.scheduler.start(recording);
  const clock = fixture.clocks[0];
  assert.deepEqual(clock.startArgs, [10, 0]);
  clock.callback(10);
  clock.callback(10.5);
  clock.callback(11);
  clock.callback(11.5);
  clock.callback(12.5);
  assert.deepEqual(fixture.calls, [
    ['note-on', 60, 10], ['note-on', 64, 10], ['note-off', 64, 10.5],
    ['sustain', true, 11], ['note-off', 60, 11.5], ['sustain', false, 12.5],
  ]);
  assert.equal(fixture.states.at(-1).running, true);
  clock.callback(12.5 + REPLAY_RELEASE_TAIL);
  assert.equal(fixture.scheduler.isRunning(), false);
  assert.equal(clock.disposed, true);
  assert.deepEqual(fixture.states.at(-1), { running: false, notes: [], sustain: false });
});

test('stop cancels old callbacks and clears replay state', () => {
  const fixture = setup();
  fixture.scheduler.start({ duration: 4, events: [{ time: 0, sequence: 0, kind: 'note-on', note: 60, velocity: 0.72 }] });
  const clock = fixture.clocks[0];
  clock.callback(10);
  assert.equal(fixture.scheduler.stop(), true);
  clock.callback(20);
  assert.deepEqual(fixture.calls, [['note-on', 60, 10]]);
  assert.equal(clock.stopAt, 10);
  assert.deepEqual(fixture.states.at(-1), { running: false, notes: [], sustain: false });
});
