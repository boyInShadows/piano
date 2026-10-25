import { PIANO_TITLE } from '../lib/pianoConfig';

export default function PianoSpaceGuide({ rotate, onCompact }) {
  return (
    <div className="space-guide">
      <h1>{PIANO_TITLE}</h1>
      {rotate && <svg className="rotation-icon" viewBox="0 0 64 48" aria-hidden="true"><rect x="22" y="3" width="22" height="39" rx="3" /><path d="M13 10a23 23 0 0 0 0 28m-7-1 7 2 3-7M52 38a23 23 0 0 0 0-28m7 1-7-2-3 7" /></svg>}
      <h2>{rotate ? 'Rotate your phone to play' : 'A little more room to play'}</h2>
      <p>{rotate
        ? "Turn your phone sideways for larger piano keys. If the screen does not rotate, check your device’s rotation lock."
        : 'There is not enough room for usable piano keys. Close Settings, zoom out, or use a larger window. Help and Recordings are still available.'}</p>
      {onCompact && <button type="button" onClick={onCompact}>Use compact keyboard</button>}
    </div>
  );
}
