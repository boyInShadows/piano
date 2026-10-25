import assert from 'node:assert/strict';
import test from 'node:test';
import { createNoteController } from '../../src/lib/pianoInput.js';

function setup(onEvent = () => {}) {
  const events = [];
  const states = [];
  const audio = {
    attack: (midi) => { events.push(['on', midi]); return true; },
    release: (midi) => events.push(['off', midi]),
    setSustain: (value) => events.push(['sustain', value]),
    stopAll: () => events.push(['stop']),
  };
  return { events, states, audio, input: createNoteController(audio, (state) => states.push(state), onEvent) };
}

test('two owners share one attack and only the final release stops it, in either order', () => {
  for (const order of [['key:KeyA', 'pointer:2'], ['pointer:2', 'key:KeyA']]) {
    const { input, events } = setup();
    input.press('key:KeyA', 60);
    input.press('pointer:2', 60);
    input.release(order[0]);
    assert.deepEqual(events, [['on', 60]]);
    input.release(order[1]);
    input.release(order[1]);
    assert.deepEqual(events, [['on', 60], ['off', 60]]);
  }
});

test('a moving pointer releases its old pitch before acquiring the next and can leave/reenter', () => {
  const { input, events } = setup();
  input.press('pointer:1', 60);
  input.move('pointer:1', 64);
  input.move('pointer:1', 64);
  input.move('pointer:1', null);
  input.move('pointer:1', 67);
  input.release('pointer:1');
  assert.deepEqual(events, [['on', 60], ['off', 60], ['on', 64], ['off', 64], ['on', 67], ['off', 67]]);
});

test('stop-all is safe twice and movement cannot reacquire a stopped pointer without a new press', () => {
  const { input, events, states } = setup();
  input.press('pointer:1', 60);
  input.setLatched(true);
  input.setMomentary(true);
  input.stopAll();
  input.stopAll();
  const afterStop = events.length;
  input.move('pointer:1', 64);
  input.release('pointer:1');
  assert.equal(events.length, afterStop);
  assert.equal(states.at(-1).notes.size, 0);
  assert.equal(states.at(-1).sustain, false);
  input.press('pointer:1', 64);
  assert.deepEqual(events.at(-1), ['on', 64]);
});

test('latch and momentary pedal combine without pedal-up releasing the latch', () => {
  const { input, events } = setup();
  input.setMomentary(true);
  input.setLatched(true);
  input.setMomentary(false);
  assert.deepEqual(events, [['sustain', true]]);
  input.setLatched(false);
  assert.deepEqual(events, [['sustain', true], ['sustain', false]]);
});

test('a rejected attack never acquires a false owner or emits a later release', () => {
  const { input, events, audio } = setup();
  audio.attack = () => false;
  assert.equal(input.press('key:KeyA', 60), false);
  input.release('key:KeyA');
  assert.deepEqual(events, []);
});

test('emits one recording event per audible ownership and effective sustain transition', () => {
  const recorded = [];
  const { input } = setup((event) => recorded.push(event));
  input.press('key:KeyA', 60);
  input.press('pointer:2', 60);
  input.setLatched(true);
  input.release('key:KeyA');
  input.release('pointer:2');
  input.setLatched(false);

  assert.deepEqual(recorded, [
    { kind: 'note-on', note: 60, velocity: 0.72 },
    { kind: 'sustain', value: true },
    { kind: 'note-off', note: 60 },
    { kind: 'sustain', value: false },
  ]);
});
