'use client';

import { useState } from 'react';
import { PIANO_TITLE } from '../lib/pianoConfig';

export default function PianoApp() {
  const [aboutOpen, setAboutOpen] = useState(false);

  return (
    <main>
      <header>
        <h1>{PIANO_TITLE}</h1>
      </header>
      <section aria-labelledby="instrument-status">
        <h2 id="instrument-status">The piano is being prepared.</h2>
        <p>Free play, sustain, a metronome, and local recordings are on the way.</p>
        <button
          type="button"
          aria-expanded={aboutOpen}
          aria-controls="about-piano"
          onClick={() => setAboutOpen(!aboutOpen)}
        >
          About this piano
        </button>
        <div id="about-piano" hidden={!aboutOpen}>
          <p>Recordings will stay in this browser.</p>
          <p>Clearing site data will remove saved recordings. There is no cloud sync.</p>
        </div>
      </section>
    </main>
  );
}
