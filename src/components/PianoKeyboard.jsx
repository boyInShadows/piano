'use client';

import { useEffect, useRef, useState } from 'react';
import { createKeyLayout, getNoteName, getOctavesForWidth, getShortcutLabel } from '../lib/pianoNotes';

export default function PianoKeyboard({ showNotes, showShortcuts }) {
  const viewport = useRef(null);
  const [octaves, setOctaves] = useState(2);
  const [rangeStart, setRangeStart] = useState(60);
  const layout = createKeyLayout(rangeStart, octaves);

  useEffect(() => {
    const observer = new ResizeObserver(([entry]) => {
      if (entry.contentRect.width > 0) setOctaves(getOctavesForWidth(entry.contentRect.width));
    });
    observer.observe(viewport.current);
    return () => observer.disconnect();
  }, []);

  return (
    <>
      <div className="key-frame">
        <div className="key-viewport" ref={viewport} tabIndex={0} role="group" aria-label="Piano keyboard preview">
          <div className="key-surface" style={{ minWidth: `${layout.whiteCount * 44}px` }}>
            {layout.keys.map((key) => (
              <button
                key={key.midi}
                type="button"
                className={`piano-key piano-key--${key.accidental ? 'black' : 'white'}`}
                data-midi={key.midi}
                aria-label={key.name}
                disabled
                style={{
                  width: `${(key.accidental ? 0.64 : 1) / layout.whiteCount * 100}%`,
                  left: `${(key.position - (key.accidental ? 0.32 : 0)) / layout.whiteCount * 100}%`,
                }}
              >
                <span className="key-labels" aria-hidden="true">
                  {showNotes && <span>{key.name}</span>}
                  {showShortcuts && <span className="shortcut-label">{getShortcutLabel(key.midi, layout.start, layout.end)}</span>}
                </span>
              </button>
            ))}
          </div>
        </div>
      </div>
      <div className="range-bar">
        <button type="button" aria-label="Lower octave" disabled={layout.start === 21} onClick={() => setRangeStart(layout.start - 12)}>
          <svg viewBox="0 0 16 16" aria-hidden="true"><path d="m10 3-5 5 5 5" /></svg>
          Lower octave
        </button>
        <output aria-label="Visible note range" aria-live="polite">{getNoteName(layout.start)}–{getNoteName(layout.end)}</output>
        <button type="button" aria-label="Higher octave" disabled={layout.end === 108} onClick={() => setRangeStart(layout.start + 12)}>
          Higher octave
          <svg viewBox="0 0 16 16" aria-hidden="true"><path d="m6 3 5 5-5 5" /></svg>
        </button>
      </div>
    </>
  );
}
