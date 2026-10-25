import assert from 'node:assert/strict';
import test from 'node:test';
import { createMetronome } from '../../src/lib/metronome.js';

function setup() {
  const previousRequest = globalThis.requestAnimationFrame;
  const previousCancel = globalThis.cancelAnimationFrame;
  const frames = new Map();
  const clicks = [];
  const states = [];
  const clocks = [];
  let frameId = 0;
  globalThis.requestAnimationFrame = (callback) => { frames.set(++frameId, callback); return frameId; };
  globalThis.cancelAnimationFrame = (id) => frames.delete(id);
  const context = {
    currentTime: 10, state: 'running',
    createOscillator() {
      const oscillator = { frequency: { value: 0 }, connect() {}, disconnect() { this.disconnected = true; }, start(time) { this.startTime = time; }, stop(time) { this.stopTime = time; } };
      clicks.push(oscillator);
      return oscillator;
    },
    createGain: () => ({ gain: { setValueAtTime() {}, linearRampToValueAtTime() {} }, connect() {}, disconnect() {} }),
  };
  class Clock {
    constructor({ callback, frequency }) { this.callback = callback; this.frequency = { value: frequency }; this.starts = []; clocks.push(this); }
    start(time, offset) { this.starts.push([time, offset]); }
    stop(time) { this.stopTime = time; }
    dispose() { this.disposed = true; }
  }
  const metronome = createMetronome({ context, toneContext: { now: () => context.currentTime + 0.1 }, Clock, output: {}, onState: (state) => states.push(state) });
  return { context, metronome, clocks, clicks, states, frames,
    render() { const callbacks = [...frames.values()]; frames.clear(); callbacks.forEach((callback) => callback()); },
    cleanup() { metronome.dispose(); globalThis.requestAnimationFrame = previousRequest; globalThis.cancelAnimationFrame = previousCancel; } };
}

test('schedules accented 4/4 clicks at callback times and waits for audio time before showing beats', () => {
  const f = setup();
  try {
    f.metronome.start(90);
    const clock = f.clocks[0];
    assert.equal(clock.frequency.value, 1.5);
    assert.deepEqual(clock.starts, [[10.1, 0]]);
    clock.callback(10.1, 0);
    assert.equal(f.clicks[0].startTime, 10.1);
    assert.equal(f.states.at(-1).beat, 0);
    f.render();
    assert.equal(f.states.at(-1).beat, 0);
    f.context.currentTime = 10.1;
    f.render();
    assert.equal(f.states.at(-1).beat, 1);
    clock.callback(10.2, 1);
    assert.notEqual(f.clicks[0].frequency.value, f.clicks[1].frequency.value);
    clock.callback(10.3, 4);
    assert.equal(f.clicks[0].frequency.value, f.clicks[2].frequency.value);
  } finally { f.cleanup(); }
});

test('tempo edits reuse one clock and stop cancels queued sound, visuals and stale callbacks', () => {
  const f = setup();
  try {
    f.metronome.start(40);
    f.metronome.start(240);
    assert.equal(f.clocks.length, 1);
    assert.equal(f.clocks[0].starts.length, 1);
    assert.equal(f.clocks[0].frequency.value, 4);
    for (const bpm of [39, 241, NaN, Infinity, '90', 90.5]) assert.throws(() => f.metronome.setTempo(bpm), RangeError);
    f.clocks[0].callback(10.1, 0);
    f.metronome.stop();
    f.metronome.stop();
    assert.equal(f.clicks[0].stopTime, 10);
    assert.equal(f.clicks[0].disconnected, true);
    assert.equal(f.frames.size, 0);
    assert.deepEqual(f.states.at(-1), { running: false, beat: 0 });
    f.clocks[0].callback(10.2, 1);
    assert.equal(f.clicks.length, 1);
    f.metronome.start(90);
    assert.deepEqual(f.clocks[0].starts.at(-1), [10.1, 0]);
    f.clocks[0].callback(9, 0);
    assert.equal(f.clicks.length, 1);
    f.metronome.dispose();
    assert.equal(f.clocks[0].disposed, true);
    assert.equal(f.metronome.start(90), false);
  } finally { f.cleanup(); }
});
