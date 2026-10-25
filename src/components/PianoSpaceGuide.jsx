import { PIANO_TITLE } from '../lib/pianoConfig';
import styles from './PianoSpaceGuide.module.css';

export default function PianoSpaceGuide({ rotate, onCompact }) {
  return (
    <section className={styles.guide} aria-label="Piano screen guidance">
      <h1>{PIANO_TITLE}</h1>
      <div className={styles.content}>
        {rotate && <svg className={styles.illustration} viewBox="0 0 144 144" aria-hidden="true">
          <path className={styles.turn} d="M112 54a44 44 0 0 1-13 51m0-12v12h12" />
          <g className={styles.phone}>
            <rect x="50" y="31" width="44" height="82" rx="9" />
            <rect className={styles.screen} x="54" y="36" width="36" height="69" rx="5" />
            <path d="M65 38h14M66 108h12" />
          </g>
        </svg>}
        <h2>{rotate ? 'Rotate your phone to play' : 'A little more room to play'}</h2>
        <p className={styles.description}>{rotate
          ? 'Turn sideways for a wider keyboard and more room for both hands.'
          : 'Make the window taller or zoom out to give the piano keys enough room.'}</p>
        {rotate && <p className={styles.help}>Screen staying upright? Turn off your phone’s rotation lock.</p>}
        {onCompact && <button className={styles.compact} type="button" onClick={onCompact}>Use compact keyboard</button>}
        {!rotate && <p className={styles.help}>Settings, Help and Recordings are still available from the gear.</p>}
      </div>
    </section>
  );
}
