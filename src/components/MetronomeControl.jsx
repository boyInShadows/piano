'use client';

export default function MetronomeControl({ running, beat, bpm, onToggle, onTempo }) {
  return (
    <div className="metronome-control">
      <button type="button" className="metronome-button" aria-label="Metronome" aria-pressed={running}
        aria-describedby="metronome-beat-description" onClick={onToggle}>
        <span>Metronome {running ? 'on' : 'off'}</span>
        <span className="metronome-beats" aria-hidden="true">
          {[1, 2, 3, 4].map((number) => <span key={number} className={running && beat === number ? 'is-current' : ''}>{number}</span>)}
        </span>
      </button>
      <span id="metronome-beat-description" className="visually-hidden">{running ? `Beat ${beat || 'waiting'} of 4 at ${bpm} BPM` : 'Metronome stopped; four beats per bar'}</span>
      <label className="tempo-control">{bpm} BPM
        <input aria-label="Tempo" type="range" min="40" max="240" step="1" value={bpm} onChange={(event) => onTempo(Number(event.target.value))} />
      </label>
    </div>
  );
}
