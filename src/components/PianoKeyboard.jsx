'use client';

import { useEffect, useRef, useState } from 'react';
import { createKeyLayout, getNoteName, getOctavesForWidth, getShortcutLabel, getShortcutNote } from '../lib/pianoNotes';

export default function PianoKeyboard({ showNotes, showShortcuts, ready, pressedNotes, onPress, onMove, onRelease, onMomentary, onStopAll }) {
  const viewport = useRef(null);
  const [octaves, setOctaves] = useState(2);
  const [rangeStart, setRangeStart] = useState(60);
  const layout = createKeyLayout(rangeStart, octaves);

  useEffect(() => {
    const observer = new ResizeObserver(([entry]) => {
      if (entry.contentRect.width > 0) {
        const next = getOctavesForWidth(entry.contentRect.width);
        if (next !== octaves) { onStopAll(); setOctaves(next); }
      }
    });
    observer.observe(viewport.current);
    return () => observer.disconnect();
  }, [octaves, onStopAll]);

  function keyDown(event) {
    if (!ready || event.repeat || event.nativeEvent.isComposing || event.ctrlKey || event.metaKey || event.altKey) return;
    if (event.target.isContentEditable || event.target.closest('input, textarea, select, [role="dialog"]')) return;
    if (event.code === 'Space') {
      event.preventDefault();
      onMomentary(true);
      return;
    }
    if (event.code === 'Escape') {
      event.preventDefault();
      onStopAll();
      return;
    }
    const focused = Number(event.target.closest('[data-midi]')?.dataset.midi ?? layout.start);
    if (event.code === 'ArrowLeft' || event.code === 'ArrowRight') {
      event.preventDefault();
      const next = Math.max(layout.start, Math.min(layout.end, focused + (event.code === 'ArrowLeft' ? -1 : 1)));
      viewport.current.querySelector(`[data-midi="${next}"]`)?.focus();
      return;
    }
    const midi = event.code === 'Enter' ? focused : getShortcutNote(event.code, layout.start, layout.end);
    if (midi !== null) { event.preventDefault(); onPress(`key:${event.code}`, midi); }
  }

  function noteAtPoint(event) {
    const bounds = viewport.current.getBoundingClientRect();
    if (event.clientX < bounds.left || event.clientX >= bounds.right || event.clientY < bounds.top || event.clientY >= bounds.bottom) return null;
    const key = document.elementFromPoint(event.clientX, event.clientY)?.closest('.piano-key');
    return key && viewport.current.contains(key) ? Number(key.dataset.midi) : null;
  }

  function pointerDown(event) {
    if (!ready || event.button !== 0) return;
    const midi = noteAtPoint(event);
    if (midi === null) return;
    event.preventDefault();
    viewport.current.focus({ preventScroll: true });
    viewport.current.setPointerCapture(event.pointerId);
    onPress(`pointer:${event.pointerId}`, midi);
  }

  function pointerEnd(event) {
    onRelease(`pointer:${event.pointerId}`);
    if (viewport.current.hasPointerCapture(event.pointerId)) viewport.current.releasePointerCapture(event.pointerId);
  }

  function changeRange(next) {
    onStopAll();
    setRangeStart(next);
  }

  return (
    <>
      <div className="key-frame">
        <div
          className="key-viewport" ref={viewport} tabIndex={0} role="group" aria-label="Piano keyboard"
          onKeyDown={keyDown} onPointerDown={pointerDown}
          onPointerMove={(event) => { if (ready) onMove(`pointer:${event.pointerId}`, noteAtPoint(event)); }}
          onPointerUp={pointerEnd} onPointerCancel={pointerEnd} onLostPointerCapture={(event) => onRelease(`pointer:${event.pointerId}`)}
        >
          <div className="key-surface" style={{ minWidth: `${layout.whiteCount * 44}px` }}>
            {layout.keys.map((key) => (
              <button
                key={key.midi}
                type="button"
                className={`piano-key piano-key--${key.accidental ? 'black' : 'white'}`}
                data-midi={key.midi}
                aria-label={key.name}
                disabled={!ready}
                tabIndex={-1}
                aria-pressed={pressedNotes.has(key.midi)}
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
        <button type="button" aria-label="Lower octave" disabled={layout.start === 21} onClick={() => changeRange(layout.start - 12)}>
          <svg viewBox="0 0 16 16" aria-hidden="true"><path d="m10 3-5 5 5 5" /></svg>
          Lower octave
        </button>
        <output aria-label="Visible note range" aria-live="polite">{getNoteName(layout.start)}–{getNoteName(layout.end)}</output>
        <button type="button" aria-label="Higher octave" disabled={layout.end === 108} onClick={() => changeRange(layout.start + 12)}>
          Higher octave
          <svg viewBox="0 0 16 16" aria-hidden="true"><path d="m6 3 5 5-5 5" /></svg>
        </button>
      </div>
    </>
  );
}
