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
  const layout = createKeyLayout(60, 1);
  assert.equal(layout.whiteCount, 8);
  assert.deepEqual(layout.keys.filter((key) => key.accidental).map((key) => [key.name, key.position]), [
    ['C#4', 1], ['D#4', 2], ['F#4', 4], ['G#4', 5], ['A#4', 6],
  ]);
  assert.deepEqual(layout.keys.filter((key) => !key.accidental).map((key) => key.name), [
    'C4', 'D4', 'E4', 'F4', 'G4', 'A4', 'B4', 'C5',
  ]);
});

test('clamps navigation at both ends and reaches every piano note', () => {
  for (const octaves of [1, 2, 3]) {
    assert.equal(createKeyLayout(-100, octaves).start, 21);
    assert.equal(createKeyLayout(500, octaves).end, 108);
    const reached = new Set();
    let start = 21;
    while (true) {
      const layout = createKeyLayout(start, octaves);
      layout.keys.forEach((key) => reached.add(key.midi));
      if (layout.end === 108) break;
      start = layout.start + 12;
    }
    assert.deepEqual([...reached].sort((a, b) => a - b), Array.from({ length: 88 }, (_, index) => index + 21));
  }
  assert.throws(() => createKeyLayout(60, 0), RangeError);
  assert.throws(() => createKeyLayout(NaN, 1), RangeError);
});

test('reduces visible octaves before reducing key widths', () => {
  assert.equal(getOctavesForWidth(22 * 44), 3);
  assert.equal(getOctavesForWidth(15 * 44), 2);
  assert.equal(getOctavesForWidth(15 * 44 - 1), 1);
  assert.equal(getOctavesForWidth(320), 1);
});

test('compact windows fit seven white targets and still reach all 88 notes', () => {
  const middle = createKeyLayout(60, 1, true);
  assert.equal(middle.end, 71);
  assert.equal(middle.whiteCount, 7);
  const reached = new Set();
  let start = 21;
  for (let window = 0; window < 10; window += 1) {
    const layout = createKeyLayout(start, 1, true);
    assert.ok(layout.whiteCount <= 7);
    assert.equal(layout.keys[0].accidental, false);
    assert.equal(layout.keys.at(-1).accidental, false);
    layout.keys.forEach((key) => reached.add(key.midi));
    if (layout.end === 108) break;
    start = Math.floor(layout.start / 12) * 12 + 12;
  }
  assert.equal(createKeyLayout(-100, 1, true).start, 21);
  assert.equal(createKeyLayout(500, 1, true).end, 108);
  assert.deepEqual([...reached].sort((a, b) => a - b), Array.from({ length: 88 }, (_, index) => index + 21));
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
