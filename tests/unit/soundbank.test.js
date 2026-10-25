import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import soundbank from '../../public/audio/piano/salamander-v1/manifest.json' with { type: 'json' };

test('the licensed bank matches its manifest and stays within transfer/decoded budgets', () => {
  const directory = new URL('../../public/audio/piano/salamander-v1/', import.meta.url);
  assert.match(readFileSync(new URL('UPSTREAM-NOTICE.txt', directory), 'utf8'), /Author: Alexander Holm/);
  assert.match(readFileSync(new URL('LICENSE.txt', directory), 'utf8'), /Attribution 3.0 Unported/);
  let bytes = 0;
  let decoded = 0;
  for (const sample of soundbank.samples) {
    const content = readFileSync(new URL(sample.file, directory));
    assert.equal(content.length, sample.bytes);
    assert.equal(createHash('sha256').update(content).digest('hex'), sample.sha256);
    bytes += content.length;
    decoded += sample.decodedBytesEstimate;
  }
  assert.equal(bytes, soundbank.transferBytes);
  assert.equal(decoded, soundbank.decodedBytesEstimate);
  assert.ok(bytes < 8 * 1024 ** 2);
  assert.ok(decoded < 64 * 1024 ** 2);
  for (let midi = 21; midi <= 108; midi += 1) {
    assert.ok(soundbank.samples.some((sample) => Math.abs(sample.midi - midi) <= 3), `No nearby sample for MIDI ${midi}`);
  }
});
