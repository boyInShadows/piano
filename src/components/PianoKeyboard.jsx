'use client';

import { useEffect, useRef, useState } from 'react';
import { createKeyLayout, getNoteName, getOctavesForWidth, getShortcutLabel, getShortcutNote } from '../lib/pianoNotes';

const piano = createKeyLayout();
const middleC = piano.keys.find((key) => key.midi === 60).position;
const octaveStarts = piano.keys.filter((key) => key.midi % 12 === 0).map((key) => key.position);

export default function PianoKeyboard({ compact, onCompact, showNotes, showShortcuts, ready, disabled = false, pressedNotes, onPress, onMove, onRelease, onMomentary, onStopAll, onActivate }) {
  const viewport = useRef(null);
  const previousWidth = useRef(null);
  const [pan, setPan] = useState(middleC);
  const [width, setWidth] = useState(0);
  const whiteCount = compact ? 7 : getOctavesForWidth(width) * 7 + 1;
  const fits = width >= whiteCount * 44;
  const keyWidth = width / whiteCount;
  const maximumPan = piano.whiteCount - whiteCount;
  const offset = Math.max(0, Math.min(pan, maximumPan));
  const visibleKeys = piano.keys.filter((key) => {
    const left = key.position - (key.accidental ? 0.32 : 0);
    const right = key.position + (key.accidental ? 0.32 : 1);
    return left >= offset - 0.0001 && right <= offset + whiteCount + 0.0001;
  });
  const start = visibleKeys[0].midi;
  const end = visibleKeys.at(-1).midi;
  const rangeLabel = `${getNoteName(start)}–${getNoteName(end)}`;

  useEffect(() => {
    const observer = new ResizeObserver(([entry]) => {
      if (entry.contentRect.width > 0) {
        const nextWidth = entry.contentRect.width;
        if (nextWidth !== previousWidth.current) onStopAll();
        previousWidth.current = nextWidth;
        setWidth(nextWidth);
      }
    });
    observer.observe(viewport.current);
    return () => observer.disconnect();
  }, [compact, onStopAll]);

  function keyDown(event) {
    if (!fits || event.repeat || event.nativeEvent.isComposing || event.ctrlKey || event.metaKey || event.altKey) return;
    if (event.target.isContentEditable || event.target.closest('input, textarea, select, [role="dialog"]')) return;
    if (event.code === 'Escape') {
      event.preventDefault();
      onStopAll();
      return;
    }
    if (disabled) return;
    if (event.code === 'Space') {
      event.preventDefault();
      if (ready) onMomentary(true);
      return;
    }
    const focused = Number(event.target.closest('[data-midi]')?.dataset.midi ?? start);
    if (event.code === 'ArrowLeft' || event.code === 'ArrowRight') {
      event.preventDefault();
      const next = Math.max(piano.start, Math.min(piano.end, focused + (event.code === 'ArrowLeft' ? -1 : 1)));
      const key = piano.keys[next - piano.start];
      const left = key.position - (key.accidental ? 0.32 : 0);
      const right = key.position + (key.accidental ? 0.32 : 1);
      if (left < offset) setPan(left);
      else if (right > offset + whiteCount) setPan(right - whiteCount);
      viewport.current.querySelector(`[data-midi="${next}"]`)?.focus({ preventScroll: true });
      return;
    }
    const midi = event.code === 'Enter' ? focused : getShortcutNote(event.code, start, end);
    if (midi !== null) { event.preventDefault(); onPress(`key:${event.code}`, midi); }
  }

  function noteAtPoint(event) {
    const bounds = viewport.current.getBoundingClientRect();
    if (event.clientX < bounds.left || event.clientX >= bounds.right || event.clientY < bounds.top || event.clientY >= bounds.bottom) return null;
    const key = document.elementFromPoint(event.clientX, event.clientY)?.closest('.piano-key');
    return key && viewport.current.contains(key) ? Number(key.dataset.midi) : null;
  }

  function pointerDown(event) {
    if (disabled || !fits || event.button !== 0) return;
    const midi = noteAtPoint(event);
    if (midi === null) return;
    event.preventDefault();
    viewport.current.focus({ preventScroll: true });
    viewport.current.setPointerCapture(event.pointerId);
    onPress(`pointer:${event.pointerId}`, midi);
  }

  function pointerEnd(event) {
    onRelease(`pointer:${event.pointerId}`);
    if (event.type === 'pointerup' && event.pointerType !== 'mouse' && !ready && !disabled && fits) void onActivate?.();
    if (viewport.current.hasPointerCapture(event.pointerId)) viewport.current.releasePointerCapture(event.pointerId);
  }

  return (
    <>
      <div className="key-frame">
        <div
          className="key-viewport" ref={viewport} tabIndex={fits ? 0 : -1} role="group" aria-label="Piano keyboard"
          style={{ WebkitTapHighlightColor: 'transparent' }}
          onKeyDown={keyDown} onPointerDown={pointerDown}
          onPointerMove={(event) => { if (!disabled && fits) onMove(`pointer:${event.pointerId}`, noteAtPoint(event)); }}
          onPointerUp={pointerEnd} onPointerCancel={pointerEnd} onLostPointerCapture={(event) => onRelease(`pointer:${event.pointerId}`)}
        >
          {!fits && <div className="keyboard-space-guide"><p>This window is too narrow for this key range.</p>{onCompact ? <button type="button" onClick={onCompact}>Use compact keyboard</button> : <p>Use a wider window or zoom out. Help and Recordings are still available.</p>}</div>}
          <div className="key-surface" hidden={!fits} style={{ width: `${piano.whiteCount * keyWidth}px`, transform: `translateX(${-offset * keyWidth}px)` }}>
            {piano.keys.map((key) => (
              <button
                key={key.midi}
                type="button"
                className={`piano-key piano-key--${key.accidental ? 'black' : 'white'}`}
                data-midi={key.midi}
                aria-label={key.name}
                aria-hidden={!visibleKeys.includes(key)}
                disabled={disabled}
                tabIndex={-1}
                aria-pressed={pressedNotes.has(key.midi)}
                style={{
                  width: `${(key.accidental ? 0.64 : 1) * keyWidth}px`,
                  left: `${(key.position - (key.accidental ? 0.32 : 0)) * keyWidth}px`,
                }}
              >
                <span className="key-labels" aria-hidden="true">
                  {showNotes && <span>{key.name}</span>}
                  {showShortcuts && <span className="shortcut-label">{getShortcutLabel(key.midi, start, end)}</span>}
                </span>
              </button>
            ))}
          </div>
        </div>
      </div>
      <div className="range-bar">
        <button type="button" aria-label="Lower octave" disabled={offset === 0 || !fits} onClick={() => setPan(octaveStarts.findLast((start) => start < offset) ?? 0)}>
          <svg viewBox="0 0 16 16" aria-hidden="true"><path d="m10 3-5 5 5 5" /></svg>
          <span className="visually-hidden">Lower octave</span>
        </button>
        <label className="keyboard-pan">
          <span aria-hidden="true">A0</span>
          <input type="range" aria-label="Pan keyboard" title="Drag to explore A0–C8" min="0" max={maximumPan} step="0.01" value={offset} disabled={!fits}
            aria-valuetext={rangeLabel} onChange={(event) => setPan(Number(event.target.value))} />
          <span aria-hidden="true">C8</span>
        </label>
        <output aria-label="Visible note range">{rangeLabel}</output>
        <button type="button" aria-label="Middle C" title="Back to Middle C" disabled={!fits} onClick={() => setPan(middleC)}>C4</button>
        <button type="button" aria-label="Higher octave" disabled={offset === maximumPan || !fits} onClick={() => setPan(Math.min(maximumPan, octaveStarts.find((start) => start > offset) ?? maximumPan))}>
          <span className="visually-hidden">Higher octave</span>
          <svg viewBox="0 0 16 16" aria-hidden="true"><path d="m6 3 5 5-5 5" /></svg>
        </button>
      </div>
    </>
  );
}
