import assert from 'node:assert/strict';
import test from 'node:test';
import {
  createRecordingStore,
  MAX_SAVED_RECORDINGS,
  RecordingLimitError,
  RecordingStorageError,
} from '../../src/lib/recordingStorage.js';

function recording(id, createdAt) {
  return {
    schemaVersion: 1,
    id,
    createdAt,
    title: id,
    duration: 0,
    bankId: 'salamander-v1',
    events: [],
  };
}

function setup(initial = [], options = {}) {
  const records = new Map(initial.map((item) => [item.id, item]));
  const database = {
    list: async () => [...records.values()],
    get: async (id) => records.get(id),
    count: async () => records.size,
    put: async (item) => records.set(item.id, item),
    delete: async (id) => records.delete(id),
    getDraft: async () => database.draft ? { recording: database.draft } : undefined,
    putDraft: async (item) => { database.draft = item; },
    clearDraft: async () => { database.draft = undefined; },
    close: () => { database.closed = true; },
  };
  return { database, store: createRecordingStore({ openDatabase: async () => database, ...options }) };
}

test('lists only valid records in newest-first order and deletes by id', async () => {
  const newest = recording('newest', '2026-10-25T02:00:00.000Z');
  const oldest = recording('oldest', '2026-10-25T01:00:00.000Z');
  const fixture = setup([oldest, { ...newest, duration: -1 }, newest]);
  assert.deepEqual((await fixture.store.list()).map(({ id }) => id), ['newest', 'oldest']);
  await fixture.store.delete('oldest');
  assert.deepEqual((await fixture.store.list()).map(({ id }) => id), ['newest']);
});

test('saves valid records, rejects invalid records, and enforces the library limit', async () => {
  const fixture = setup([], { maxRecordings: 2 });
  await fixture.store.save(recording('one', '2026-10-25T01:00:00.000Z'));
  await fixture.store.save(recording('two', '2026-10-25T02:00:00.000Z'));
  await assert.rejects(() => fixture.store.save(recording('three', '2026-10-25T03:00:00.000Z')), RecordingLimitError);
  await assert.rejects(() => fixture.store.save({}), RecordingStorageError);
  assert.equal((await fixture.store.list()).length, 2);
  assert.equal(MAX_SAVED_RECORDINGS, 20);
});

test('keeps existing records when a new save transaction fails', async () => {
  const first = recording('first', '2026-10-25T01:00:00.000Z');
  const fixture = setup([first]);
  fixture.database.put = async () => { throw new Error('quota'); };

  await assert.rejects(() => fixture.store.save(recording('second', '2026-10-25T02:00:00.000Z')), RecordingStorageError);
  assert.deepEqual((await fixture.store.list()).map(({ id }) => id), ['first']);
});

test('retains storage failures as rejected operations and closes an opened adapter', async () => {
  let opened;
  const store = createRecordingStore({ openDatabase: async () => {
    opened = { list: async () => { throw new Error('blocked'); }, close: () => { opened.closed = true; } };
    return opened;
  } });
  await assert.rejects(() => store.list(), RecordingStorageError);
  store.close();
  await Promise.resolve();
  assert.equal(opened.closed, true);
});

test('persists, validates and clears the current draft separately from saved takes', async () => {
  const fixture = setup();
  const draft = recording('draft', '2026-10-25T04:00:00.000Z');
  await fixture.store.saveDraft(draft);
  assert.deepEqual(await fixture.store.loadDraft(), draft);
  fixture.database.draft = { schemaVersion: 1 };
  assert.equal(await fixture.store.loadDraft(), null);
  await fixture.store.saveDraft(draft);
  await fixture.store.clearDraft();
  assert.equal(await fixture.store.loadDraft(), null);
});
