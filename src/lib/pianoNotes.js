const NOTE_NAMES = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];
const SHORTCUTS = [
  ['KeyA', 'A'], ['KeyW', 'W'], ['KeyS', 'S'], ['KeyE', 'E'], ['KeyD', 'D'],
  ['KeyF', 'F'], ['KeyT', 'T'], ['KeyG', 'G'], ['KeyY', 'Y'], ['KeyH', 'H'],
  ['KeyU', 'U'], ['KeyJ', 'J'], ['KeyK', 'K'], ['KeyO', 'O'], ['KeyL', 'L'],
  ['KeyP', 'P'], ['Semicolon', ';'],
];

export function getNoteName(midi) {
  if (!Number.isInteger(midi) || midi < 21 || midi > 108) {
    throw new RangeError('Piano notes must be integer MIDI values from 21 to 108.');
  }
  return `${NOTE_NAMES[midi % 12]}${Math.floor(midi / 12) - 1}`;
}

export function getOctavesForWidth(width) {
  if (width >= 22 * 44) return 3;
  if (width >= 15 * 44) return 2;
  return 1;
}

export function createKeyLayout(requestedStart, octaves) {
  if (!Number.isInteger(requestedStart) || ![1, 2, 3].includes(octaves)) {
    throw new RangeError('Use an integer range start and one to three octaves.');
  }
  let start = Math.max(21, Math.min(requestedStart, 108 - octaves * 12));
  if (NOTE_NAMES[start % 12].includes('#')) start -= 1;
  const end = start + octaves * 12;
  const keys = [];
  let whiteCount = 0;
  for (let midi = start; midi <= end; midi += 1) {
    const name = getNoteName(midi);
    const accidental = name.includes('#');
    keys.push({ midi, name, accidental, position: whiteCount });
    if (!accidental) whiteCount += 1;
  }
  return { start, end, keys, whiteCount };
}

export function getShortcutNote(code, start, end) {
  const offset = SHORTCUTS.findIndex(([physicalCode]) => physicalCode === code);
  const midi = Math.ceil(start / 12) * 12 + offset;
  return offset >= 0 && midi >= start && midi <= end ? midi : null;
}

export function getShortcutLabel(midi, start, end) {
  if (midi < start || midi > end) return '';
  return SHORTCUTS[midi - Math.ceil(start / 12) * 12]?.[1] ?? '';
}
