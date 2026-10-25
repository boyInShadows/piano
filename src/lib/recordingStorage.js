import { validateRecording } from './performanceRecording.js';

export const RECORDING_DATABASE_NAME = 'qazals-piano.recordings.v1';
export const RECORDING_DATABASE_VERSION = 2;
export const RECORDING_STORE_NAME = 'recordings';
export const RECORDING_DRAFT_STORE_NAME = 'drafts';
export const MAX_SAVED_RECORDINGS = 20;
const CURRENT_DRAFT_KEY = 'current';

export class RecordingStorageError extends Error {
  constructor(message, cause) {
    super(message, { cause });
    this.name = 'RecordingStorageError';
  }
}

export class RecordingLimitError extends RecordingStorageError {
  constructor() {
    super(`The recording library is limited to ${MAX_SAVED_RECORDINGS} takes.`);
    this.name = 'RecordingLimitError';
  }
}

function requestResult(request) {
  return new Promise((resolve, reject) => {
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(new RecordingStorageError('The recording request failed.', request.error));
  });
}

function openIndexedDatabase(indexedDBApi = globalThis.indexedDB) {
  if (!indexedDBApi?.open) return Promise.reject(new RecordingStorageError('IndexedDB is unavailable in this browser.'));
  return new Promise((resolve, reject) => {
    let request;
    try {
      request = indexedDBApi.open(RECORDING_DATABASE_NAME, RECORDING_DATABASE_VERSION);
      request.onupgradeneeded = () => {
        if (!request.result.objectStoreNames.contains(RECORDING_STORE_NAME)) {
          request.result.createObjectStore(RECORDING_STORE_NAME, { keyPath: 'id' });
        }
        if (!request.result.objectStoreNames.contains(RECORDING_DRAFT_STORE_NAME)) {
          request.result.createObjectStore(RECORDING_DRAFT_STORE_NAME, { keyPath: 'key' });
        }
      };
      request.onsuccess = () => resolve(createIndexedDatabaseAdapter(request.result));
      request.onerror = () => reject(new RecordingStorageError('The recording database could not be opened.', request.error));
      request.onblocked = () => reject(new RecordingStorageError('The recording database is blocked by another browser tab.'));
    } catch (error) {
      reject(new RecordingStorageError('The recording database could not be opened.', error));
    }
  });
}

function createIndexedDatabaseAdapter(database) {
  function run(storeName, mode, action) {
    return new Promise((resolve, reject) => {
      let result;
      let settled = false;
      let transaction;
      const fail = (error) => {
        if (!settled) {
          settled = true;
          reject(error instanceof RecordingStorageError ? error : new RecordingStorageError('The recording transaction failed.', error));
        }
      };
      try {
        transaction = database.transaction(storeName, mode);
        transaction.oncomplete = () => {
          if (!settled) {
            settled = true;
            resolve(result);
          }
        };
        transaction.onerror = () => fail(transaction.error);
        transaction.onabort = () => fail(transaction.error ?? new Error('Transaction aborted.'));
        const request = action(transaction.objectStore(storeName));
        if (request) {
          request.onsuccess = () => { result = request.result; };
          request.onerror = () => fail(request.error);
        }
      } catch (error) {
        fail(error);
        transaction?.abort();
      }
    });
  }

  return {
    list: () => run(RECORDING_STORE_NAME, 'readonly', (store) => store.getAll()),
    get: (id) => run(RECORDING_STORE_NAME, 'readonly', (store) => store.get(id)),
    count: () => run(RECORDING_STORE_NAME, 'readonly', (store) => store.count()),
    put: (recording) => run(RECORDING_STORE_NAME, 'readwrite', (store) => store.put(recording)),
    delete: (id) => run(RECORDING_STORE_NAME, 'readwrite', (store) => store.delete(id)),
    getDraft: () => run(RECORDING_DRAFT_STORE_NAME, 'readonly', (store) => store.get(CURRENT_DRAFT_KEY)),
    putDraft: (recording) => run(RECORDING_DRAFT_STORE_NAME, 'readwrite', (store) => store.put({ key: CURRENT_DRAFT_KEY, recording })),
    clearDraft: () => run(RECORDING_DRAFT_STORE_NAME, 'readwrite', (store) => store.delete(CURRENT_DRAFT_KEY)),
    close: () => database.close(),
  };
}

function sortRecordings(recordings) {
  return recordings
    .filter(validateRecording)
    .sort((left, right) => Date.parse(right.createdAt) - Date.parse(left.createdAt) || right.id.localeCompare(left.id));
}

function storageFailure(error, message) {
  return error instanceof RecordingStorageError ? error : new RecordingStorageError(message, error);
}

export function createRecordingStore({ openDatabase = () => openIndexedDatabase(), maxRecordings = MAX_SAVED_RECORDINGS } = {}) {
  let databasePromise;
  const getDatabase = () => {
    if (!databasePromise) {
      databasePromise = Promise.resolve().then(openDatabase).catch((error) => {
        databasePromise = undefined;
        throw error;
      });
    }
    return databasePromise;
  };

  return {
    async list() {
      try {
        return sortRecordings(await (await getDatabase()).list());
      } catch (error) {
        throw storageFailure(error, 'Saved recordings could not be loaded.');
      }
    },
    async save(recording) {
      if (!validateRecording(recording)) throw new RecordingStorageError('Only valid recordings can be saved.');
      try {
        const database = await getDatabase();
        if (!await database.get(recording.id) && await database.count() >= maxRecordings) throw new RecordingLimitError();
        await database.put(recording);
        return recording;
      } catch (error) {
        throw storageFailure(error, 'The recording could not be saved.');
      }
    },
    async delete(id) {
      if (typeof id !== 'string' || !id) throw new RecordingStorageError('A recording id is required.');
      try {
        await (await getDatabase()).delete(id);
      } catch (error) {
        throw storageFailure(error, 'The recording could not be deleted.');
      }
    },
    async loadDraft() {
      try {
        const stored = await (await getDatabase()).getDraft();
        return stored?.recording && validateRecording(stored.recording) ? stored.recording : null;
      } catch (error) {
        throw storageFailure(error, 'The current recording draft could not be loaded.');
      }
    },
    async saveDraft(recording) {
      if (!validateRecording(recording)) throw new RecordingStorageError('Only valid recordings can be drafted.');
      try {
        await (await getDatabase()).putDraft(recording);
      } catch (error) {
        throw storageFailure(error, 'The current recording draft could not be stored.');
      }
    },
    async clearDraft() {
      try {
        await (await getDatabase()).clearDraft();
      } catch (error) {
        throw storageFailure(error, 'The current recording draft could not be cleared.');
      }
    },
    close() {
      databasePromise?.then((database) => database.close()).catch(() => {});
    },
  };
}
