import assert from 'node:assert/strict';
import test from 'node:test';
import { createAudioEngine } from '../../src/lib/audioEngine.js';

function setup() {
  const previousContext = globalThis.AudioContext;
  const previousFetch = globalThis.fetch;
  const previousRequest = globalThis.requestAnimationFrame;
  const previousCancel = globalThis.cancelAnimationFrame;
  globalThis.requestAnimationFrame = () => 1;
  globalThis.cancelAnimationFrame = () => {};
  const contexts = [];
  const sources = [];
  const requests = [];
  const states = [];
  const ramps = [];
  const clocks = [];
  class NativeContext extends EventTarget {
    constructor() { super(); this.state = 'suspended'; this.currentTime = 10; contexts.push(this); }
    async resume() { this.state = 'running'; }
    async close() { this.state = 'closed'; }
    async decodeAudioData() { return { length: 4410, numberOfChannels: 2, duration: 0.1 }; }
    createBufferSource() { return new Voice(); }
    createOscillator() { return new Voice(); }
    createGain() { return new Node(); }
  }
  class Context {
    constructor({ context }) { this.raw = context; this.destination = {}; }
    immediate() { return this.raw.currentTime; }
    now() { return this.raw.currentTime + 0.1; }
    dispose() { this.raw.close(); }
  }
  class Node {
    constructor() { this.input = {}; this.gain = { rampTo: (...args) => ramps.push(args), cancelAndHoldAtTime() {}, setValueAtTime() {}, linearRampToValueAtTime() {} }; }
    connect() { return this; }
    dispose() { this.disposed = true; }
    disconnect() { this.disposed = true; }
  }
  class Voice extends Node {
    constructor() { super(); this.playbackRate = { value: 1 }; this.frequency = { value: 0 }; sources.push(this); }
    start(...args) { this.startArgs = args; }
    stop(time) { this.stopTime = time; }
  }
  class Clock {
    constructor(options) { this.callback = options.callback; this.frequency = { value: options.frequency }; clocks.push(this); }
    start() { this.running = true; }
    stop() { this.running = false; }
    dispose() { this.disposed = true; }
  }
  globalThis.AudioContext = NativeContext;
  globalThis.fetch = async (url, { signal }) => {
    requests.push({ url, signal });
    return { ok: true, arrayBuffer: async () => new ArrayBuffer(4) };
  };
  const loadTone = async () => ({ Context, Clock, Gain: Node, Limiter: Node, ToneBufferSource: Voice, setContext() {} });
  const engine = createAudioEngine((state) => states.push(state), loadTone);
  return { engine, contexts, sources, requests, states, ramps, clocks, loadTone,
    cleanup() { engine.dispose(); globalThis.AudioContext = previousContext; globalThis.fetch = previousFetch; globalThis.requestAnimationFrame = previousRequest; globalThis.cancelAnimationFrame = previousCancel; } };
}

test('metronome shares the ready engine and is stopped by global cleanup, suspension and disposal', async () => {
  const f = setup();
  try {
    assert.equal(f.engine.startMetronome(90), false);
    await f.engine.enable();
    assert.equal(f.engine.startMetronome(90), true);
    f.engine.setTempo(240);
    assert.equal(f.clocks[0].frequency.value, 4);
    f.clocks[0].callback(10.1, 0);
    f.engine.stopAll();
    assert.equal(f.sources[0].stopTime, 10);
    assert.equal(f.states.at(-1).metronome.running, false);
    f.engine.startMetronome(40);
    f.contexts[0].state = 'suspended';
    f.contexts[0].dispatchEvent(new Event('statechange'));
    assert.equal(f.clocks[0].running, false);
    assert.equal(f.states.at(-1).status, 'suspended');
    await f.engine.enable();
    assert.equal(f.states.at(-1).metronome.running, false);
    f.engine.startMetronome(90);
    assert.equal(f.clocks.length, 1);
    assert.equal(f.contexts.length, 1);
    f.engine.dispose();
    assert.equal(f.clocks[0].disposed, true);
    assert.equal(f.engine.startMetronome(90), false);
  } finally { f.cleanup(); }
});

test('a failed audio resume retires the old metronome output before retry', async () => {
  const f = setup();
  try {
    await f.engine.enable();
    f.engine.startMetronome(90);
    const context = f.contexts[0];
    context.state = 'suspended';
    context.dispatchEvent(new Event('statechange'));
    const resume = context.resume.bind(context);
    context.resume = async () => { throw new Error('Resume failed'); };
    assert.equal(await f.engine.enable(), false);
    assert.equal(f.clocks[0].disposed, true);
    context.resume = resume;
    assert.equal(await f.engine.enable(), true);
    f.engine.startMetronome(90);
    assert.equal(f.clocks.length, 2);
    assert.equal(f.contexts.length, 1);
    assert.equal(f.states.at(-1).metronome.running, true);
  } finally { f.cleanup(); }
});

test('activation is lazy, coalesces clicks and dispatches at the immediate audio time', async () => {
  const fixture = setup();
  try {
    assert.equal(fixture.contexts.length, 0);
    assert.equal(fixture.engine.attack(60), false);
    await Promise.all([fixture.engine.enable(), fixture.engine.enable()]);
    assert.equal(fixture.contexts.length, 1);
    assert.equal(fixture.requests.length, 16);
    assert.equal(fixture.states.at(-1).status, 'ready');
    assert.equal(fixture.engine.attack(60), true);
    assert.equal(fixture.sources[0].startArgs[0], 10);
    assert.equal(fixture.sources[0].playbackRate.value, 2 ** (-3 / 12));
    fixture.engine.release(60);
    assert.equal(fixture.sources[0].stopTime, 10.15);
  } finally { fixture.cleanup(); }
});

test('failed loads abort remaining requests and retry using the same context', async () => {
  const fixture = setup();
  try {
    const signals = [];
    globalThis.fetch = async (url, { signal }) => { signals.push(signal); return { ok: false, status: 503 }; };
    assert.equal(await fixture.engine.enable(), false);
    assert.equal(fixture.states.at(-1).status, 'failed');
    assert.ok(signals.length > 0 && signals.every((signal) => signal.aborted));
    globalThis.fetch = async () => ({ ok: true, arrayBuffer: async () => new ArrayBuffer(4) });
    assert.equal(await fixture.engine.enable(), true);
    assert.equal(fixture.contexts.length, 1);
    assert.equal(fixture.states.at(-1).status, 'ready');
  } finally { fixture.cleanup(); }
});

test('volume and mute ramp at the immediate clock time and preserve the chosen level', async () => {
  const fixture = setup();
  try {
    await fixture.engine.enable();
    fixture.engine.setVolume(0.6);
    fixture.engine.setMuted(true);
    fixture.engine.setVolume(0.4);
    fixture.engine.setMuted(false);
    assert.deepEqual(fixture.ramps, [[0.6, 0.02, 10], [0, 0.02, 10], [0, 0.02, 10], [0.4, 0.02, 10]]);
    for (const value of [-1, 1.1, NaN, Infinity]) assert.throws(() => fixture.engine.setVolume(value), RangeError);
  } finally { fixture.cleanup(); }
});

test('disposed pending loads cannot publish ready state or create voices', async () => {
  const fixture = setup();
  try {
    let resolveTone;
    const engine = createAudioEngine((state) => fixture.states.push(state), () => new Promise((resolve) => { resolveTone = resolve; }));
    const pending = engine.enable();
    await Promise.resolve();
    engine.dispose();
    resolveTone(await fixture.loadTone());
    await pending;
    assert.equal(fixture.states.some((state) => state.status === 'ready'), false);
    assert.equal(engine.attack(60), false);
  } finally { fixture.cleanup(); }
});

test('sustain preserves held voices and reattacks retire old sustained voices', async () => {
  const fixture = setup();
  try {
    await fixture.engine.enable();
    fixture.engine.setSustain(true);
    fixture.engine.attack(60);
    fixture.engine.attack(64);
    fixture.engine.release(60);
    assert.equal(fixture.sources[0].stopTime, undefined);
    fixture.engine.attack(60);
    assert.equal(fixture.sources[0].stopTime, 10.15);
    fixture.engine.release(60);
    fixture.engine.setSustain(false);
    assert.equal(fixture.sources[2].stopTime, 10.15);
    assert.equal(fixture.sources[1].stopTime, undefined);
    fixture.engine.stopAll();
    assert.ok(fixture.sources.every((source) => source.stopTime === 10.005));
  } finally { fixture.cleanup(); }
});

test('caps voices at 64, protects held notes, and evicts the oldest unheld voice', async () => {
  const fixture = setup();
  try {
    await fixture.engine.enable();
    for (let midi = 21; midi < 85; midi += 1) assert.equal(fixture.engine.attack(midi), true);
    assert.equal(fixture.engine.attack(85), false);
    fixture.engine.setSustain(true);
    fixture.engine.release(21);
    assert.equal(fixture.engine.attack(85), true);
    assert.equal(fixture.sources[0].stopTime, 10.005);
    assert.equal(fixture.sources.at(-1).startArgs[0], 10.005);
  } finally { fixture.cleanup(); }
});

test('suspension disconnects voices immediately so resume cannot revive an old held note', async () => {
  const fixture = setup();
  try {
    await fixture.engine.enable();
    fixture.engine.attack(60);
    fixture.contexts[0].state = 'suspended';
    fixture.contexts[0].dispatchEvent(new Event('statechange'));
    assert.equal(fixture.sources[0].stopTime, 10);
    assert.equal(fixture.sources[0].disposed, true);
    assert.equal(fixture.states.at(-1).status, 'suspended');
    await fixture.engine.enable();
    assert.equal(fixture.sources.length, 1);
    assert.equal(fixture.contexts.length, 1);
  } finally { fixture.cleanup(); }
});
