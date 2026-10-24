import assert from 'node:assert/strict';
import test from 'node:test';
import { createPreferenceStore, DEFAULT_PREFERENCES, PREFERENCES_KEY } from '../../src/lib/pianoPreferences.js';

test('server/default snapshots never access storage and client restoration is stable', () => {
  let reads = 0;
  const store = createPreferenceStore(() => ({ getItem: () => { reads += 1; return JSON.stringify({ version: 1, volume: 60, showNotes: true, showShortcuts: false, bpm: 120 }); } }));
  assert.deepEqual(store.getServerSnapshot().preferences, DEFAULT_PREFERENCES);
  assert.equal(store.getSnapshot(), store.getServerSnapshot());
  assert.equal(reads, 0);
  const unsubscribe = store.subscribe(() => {});
  assert.equal(reads, 1);
  const restored = store.getSnapshot();
  assert.equal(restored.preferences.volume, 60);
  assert.equal(restored.preferences.bpm, 120);
  assert.equal(restored, store.getSnapshot());
  unsubscribe();
  store.subscribe(() => {})();
  assert.equal(reads, 1);
});

test('writes only validated preferences and not transport, sustain, mute or owner identity', () => {
  let saved;
  let key;
  const store = createPreferenceStore(() => ({ getItem: () => null, setItem: (name, value) => { key = name; saved = JSON.parse(value); } }));
  store.subscribe(() => {});
  store.update({ volume: 75, showNotes: true, showShortcuts: true, bpm: 240, running: true, sustain: true, muted: true, owner: 'anything' });
  assert.equal(key, PREFERENCES_KEY);
  assert.deepEqual(saved, { version: 1, volume: 75, showNotes: true, showShortcuts: true, bpm: 240 });
  store.update({ volume: NaN, showNotes: 'yes', showShortcuts: null, bpm: 241 });
  assert.deepEqual(store.getSnapshot().preferences, DEFAULT_PREFERENCES);
});

test('malformed/incompatible records fall back and valid fields survive independently', () => {
  for (const raw of ['{broken', 'null', '[]', '{"version":2,"volume":99}']) {
    const store = createPreferenceStore(() => ({ getItem: () => raw }));
    store.subscribe(() => {});
    assert.deepEqual(store.getSnapshot().preferences, DEFAULT_PREFERENCES);
    assert.ok(store.getSnapshot().error);
  }
  const store = createPreferenceStore(() => ({ getItem: () => JSON.stringify({ version: 1, volume: -5, bpm: 40, showNotes: true, showShortcuts: 1, running: true }) }));
  store.subscribe(() => {});
  assert.deepEqual(store.getSnapshot().preferences, { ...DEFAULT_PREFERENCES, bpm: 40, showNotes: true });
});

test('blocked reads/writes keep session changes and can recover without leaking subscriptions', () => {
  let blocked = true;
  let notifications = 0;
  let saved;
  const store = createPreferenceStore(() => {
    if (blocked) throw new Error('Storage blocked');
    return { setItem: (key, value) => { saved = JSON.parse(value); } };
  });
  const unsubscribe = store.subscribe(() => { notifications += 1; });
  assert.ok(store.getSnapshot().error);
  store.update({ volume: 70, bpm: 110 });
  assert.equal(store.getSnapshot().preferences.volume, 70);
  assert.match(store.getSnapshot().error, /could not be saved/);
  blocked = false;
  store.update({ volume: 65 });
  assert.equal(saved.bpm, 110);
  assert.equal(store.getSnapshot().error, '');
  unsubscribe();
  const before = notifications;
  store.update({ bpm: 100 });
  assert.equal(notifications, before);
});
