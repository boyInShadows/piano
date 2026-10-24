export const PREFERENCES_KEY = 'piano.preferences.v1';
export const DEFAULT_PREFERENCES = Object.freeze({ volume: 35, showNotes: false, showShortcuts: false, bpm: 90 });
const INITIAL = Object.freeze({ preferences: DEFAULT_PREFERENCES, error: '' });

function validate(value) {
  return Object.freeze({
    volume: Number.isFinite(value.volume) && value.volume >= 0 && value.volume <= 100 ? value.volume : 35,
    showNotes: typeof value.showNotes === 'boolean' ? value.showNotes : false,
    showShortcuts: typeof value.showShortcuts === 'boolean' ? value.showShortcuts : false,
    bpm: Number.isInteger(value.bpm) && value.bpm >= 40 && value.bpm <= 240 ? value.bpm : 90,
  });
}

export function createPreferenceStore(getStorage = () => window.localStorage) {
  let snapshot = INITIAL;
  let restored = false;
  const listeners = new Set();

  function subscribe(listener) {
    listeners.add(listener);
    if (!restored) {
      restored = true;
      try {
        const raw = getStorage().getItem(PREFERENCES_KEY);
        if (raw !== null) {
          const value = JSON.parse(raw);
          if (!value || Array.isArray(value) || value.version !== 1) throw new Error('Unsupported preferences');
          snapshot = { preferences: validate(value), error: '' };
        }
      } catch {
        snapshot = { preferences: DEFAULT_PREFERENCES, error: 'Saved settings could not be read. Defaults are in use.' };
      }
      listener();
    }
    return () => listeners.delete(listener);
  }

  function update(changes) {
    const preferences = validate({ ...snapshot.preferences, ...changes });
    let error = '';
    try { getStorage().setItem(PREFERENCES_KEY, JSON.stringify({ version: 1, ...preferences })); }
    catch { error = 'Settings could not be saved in this browser. Changes last until you reload.'; }
    snapshot = { preferences, error };
    listeners.forEach((listener) => listener());
  }

  return { subscribe, update, getSnapshot: () => snapshot, getServerSnapshot: () => INITIAL };
}
