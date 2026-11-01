import assert from 'node:assert/strict';
import test from 'node:test';
import {
  createKeyLayout,
  getNoteName,
  getOctavesForWidth,
  getShortcutNote,
  getShortcutLabel,
} from '../../src/lib/pianoNotes.js';

test('uses the full A0–C8 range and rejects invalid notes', () => {
  assert.equal(getNoteName(21), 'A0');
  assert.equal(getNoteName(60), 'C4');
  assert.equal(getNoteName(108), 'C8');
  for (const note of [20, 109, 60.5, NaN, Infinity, '60']) {
    assert.throws(() => getNoteName(note), RangeError);
  }
});

test('positions the two/three accidental groups at white-key boundaries', () => {
  const layout = createKeyLayout();
  const middle = layout.keys.filter((key) => key.midi >= 60 && key.midi <= 72);
  assert.deepEqual(middle.filter((key) => key.accidental).map((key) => [key.name, key.position - 23]), [
    ['C#4', 1], ['D#4', 2], ['F#4', 4], ['G#4', 5], ['A#4', 6],
  ]);
  assert.deepEqual(middle.filter((key) => !key.accidental).map((key) => key.name), [
    'C4', 'D4', 'E4', 'F4', 'G4', 'A4', 'B4', 'C5',
  ]);
});

test('one continuous strip contains every piano pitch exactly once', () => {
  const layout = createKeyLayout();
  assert.equal(layout.start, 21);
  assert.equal(layout.end, 108);
  assert.deepEqual(layout.keys.map((key) => key.midi), Array.from({ length: 88 }, (_, index) => index + 21));
});

test('reduces visible octaves before reducing key widths', () => {
  assert.equal(getOctavesForWidth(22 * 44), 3);
  assert.equal(getOctavesForWidth(15 * 44), 2);
  assert.equal(getOctavesForWidth(15 * 44 - 1), 1);
  assert.equal(getOctavesForWidth(320), 1);
});

test('the strip has 52 consecutive natural keys with accidentals at interior boundaries', () => {
  const layout = createKeyLayout();
  assert.equal(layout.whiteCount, 52);
  assert.deepEqual(layout.keys.filter((key) => !key.accidental).map((key) => key.position), Array.from({ length: 52 }, (_, index) => index));
  assert.equal(layout.keys.find((key) => key.midi === 60).position, 23);
  for (const key of layout.keys.filter((key) => key.accidental)) {
    assert.ok(key.position > 0 && key.position < layout.whiteCount);
    assert.ok(!layout.keys.find((other) => other.midi === key.midi - 1).accidental);
    assert.ok(!layout.keys.find((other) => other.midi === key.midi + 1).accidental);
  }
});

test('maps physical codes to visible notes and keeps the low partial octave honest', () => {
  assert.equal(getShortcutNote('KeyA', 60, 72), 60);
  assert.equal(getShortcutNote('KeyW', 60, 72), 61);
  assert.equal(getShortcutNote('KeyK', 60, 72), 72);
  assert.equal(getShortcutNote('KeyO', 60, 72), null);
  assert.equal(getShortcutNote('Space', 60, 72), null);
  assert.equal(getShortcutNote('KeyA', 21, 33), 24);
  assert.equal(getShortcutLabel(21, 21, 33), '');
  assert.equal(getShortcutLabel(60, 60, 72), 'A');
  assert.equal(getShortcutLabel(72, 60, 72), 'K');
  assert.equal(getShortcutLabel(73, 60, 72), '');
});
