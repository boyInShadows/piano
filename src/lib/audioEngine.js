import soundbank from '../../public/audio/piano/salamander-v1/manifest.json' with { type: 'json' };
import { getNoteName } from './pianoNotes.js';

async function loadToneClasses() {
  // The pinned class entry avoids the main entry's eager default AudioContext.
  const [classes, globals] = await Promise.all([
    import('tone/build/esm/classes.js'),
    import('tone/build/esm/core/Global.js'),
  ]);
  return { ...classes, setContext: globals.setContext };
}

export function createAudioEngine(onState, loadTone = loadToneClasses) {
  let nativeContext;
  let toneContext;
  let tone;
  let master;
  let limiter;
  let pending;
  let controller;
  let disposed = false;
  let status = 'not-enabled';
  let volume = 0.35;
  let muted = false;
  let sustain = false;
  let buffers = new Map();
  const voices = new Map();
  const total = soundbank.samples.length;

  function publish(next, loaded = 0, decodedBytes = 0) {
    if (disposed) return;
    status = next;
    onState({ status, loaded, total, decodedBytes });
  }

  function finish(voice) {
    voice.source.onended = null;
    voice.source.disconnect();
    voice.envelope.disconnect();
    voices.delete(voice.source);
  }

  function releaseVoice(voice, duration = 0.15) {
    voice.held = false;
    voice.releasing = true;
    const now = nativeContext.currentTime;
    voice.envelope.gain.cancelAndHoldAtTime(now);
    voice.envelope.gain.linearRampToValueAtTime(0, now + duration);
    voice.source.stop(now + duration);
  }

  function stopAll() {
    sustain = false;
    for (const voice of voices.values()) {
      if (nativeContext.state === 'running') releaseVoice(voice, 0.005);
      else {
        voice.source.stop(nativeContext.currentTime);
        finish(voice);
      }
    }
  }

  function handleStateChange() {
    if (disposed || !buffers.size || status === 'loading') return;
    if (nativeContext.state !== 'running') {
      stopAll();
      publish('suspended');
    }
  }

  function enable() {
    if (disposed) return Promise.resolve(false);
    if (pending) return pending;
    let resumed;
    try {
      if (!nativeContext) {
        const AudioContext = globalThis.AudioContext || globalThis.webkitAudioContext;
        nativeContext = new AudioContext({ latencyHint: 'interactive', sampleRate: 44100 });
        nativeContext.addEventListener('statechange', handleStateChange);
      }
      // Resume synchronously in the user gesture, before the dynamic imports.
      resumed = nativeContext.resume();
    } catch {
      publish('failed');
      return Promise.resolve(false);
    }
    publish('loading');
    pending = (async () => {
      try {
        await resumed;
        if (!master) {
          tone ??= await loadTone();
          if (disposed) return false;
          toneContext ??= new tone.Context({ context: nativeContext });
          tone.setContext(toneContext);
          master = new tone.Gain({ context: toneContext, gain: muted ? 0 : volume });
          limiter = new tone.Limiter({ context: toneContext, threshold: -1 });
          master.connect(limiter);
          limiter.connect(toneContext.destination);
        }
        if (!buffers.size) {
          const attempt = new AbortController();
          controller = attempt;
          let loaded = 0;
          const entries = await Promise.all(soundbank.samples.map(async (sample) => {
            const response = await fetch(`${soundbank.baseUrl}${sample.file}`, { signal: attempt.signal });
            if (!response.ok) throw new Error(`Piano sample failed: ${response.status}`);
            const buffer = await nativeContext.decodeAudioData(await response.arrayBuffer());
            if (attempt.signal.aborted || disposed) throw new Error('Loading canceled');
            publish('loading', ++loaded);
            return [sample.midi, buffer];
          }));
          if (disposed) return false;
          buffers = new Map(entries);
        }
        if (disposed) return false;
        const decodedBytes = [...buffers.values()].reduce((sum, buffer) => sum + buffer.length * buffer.numberOfChannels * 4, 0);
        publish(nativeContext.state === 'running' ? 'ready' : 'suspended', total, decodedBytes);
        return status === 'ready';
      } catch {
        controller?.abort();
        master?.dispose();
        limiter?.dispose();
        master = null;
        limiter = null;
        publish('failed');
        return false;
      } finally {
        pending = null;
      }
    })();
    return pending;
  }

  function attack(midi) {
    getNoteName(midi);
    if (disposed || status !== 'ready' || nativeContext.state !== 'running') return false;
    for (const voice of voices.values()) {
      if (voice.midi === midi && !voice.releasing) releaseVoice(voice);
    }
    let when = nativeContext.currentTime;
    if (voices.size >= 64) {
      const oldest = [...voices.values()].find((voice) => !voice.held);
      if (!oldest) return false;
      releaseVoice(oldest, 0.005);
      voices.delete(oldest.source);
      when += 0.005;
    }
    const root = [...buffers.keys()].reduce((best, note) => Math.abs(note - midi) <= Math.abs(best - midi) ? note : best);
    const source = nativeContext.createBufferSource();
    const envelope = nativeContext.createGain();
    source.buffer = buffers.get(root);
    source.playbackRate.value = 2 ** ((midi - root) / 12);
    envelope.gain.setValueAtTime(0, when);
    envelope.gain.linearRampToValueAtTime(0.7, when + 0.003);
    source.connect(envelope);
    envelope.connect(master.input);
    const voice = { midi, source, envelope, held: true, releasing: false };
    voices.set(source, voice);
    source.onended = () => finish(voice);
    source.start(when);
    return true;
  }

  function release(midi) {
    for (const voice of voices.values()) {
      if (voice.midi === midi && voice.held) {
        voice.held = false;
        if (!sustain) releaseVoice(voice);
      }
    }
  }

  function setSustain(value) {
    sustain = Boolean(value);
    if (!sustain) {
      for (const voice of voices.values()) {
        if (!voice.held && !voice.releasing) releaseVoice(voice);
      }
    }
  }

  function setVolume(value) {
    if (!Number.isFinite(value) || value < 0 || value > 1) throw new RangeError('Volume must be between 0 and 1.');
    volume = value;
    master?.gain.rampTo(muted ? 0 : volume, 0.02, nativeContext.currentTime);
  }

  function setMuted(value) {
    muted = Boolean(value);
    master?.gain.rampTo(muted ? 0 : volume, 0.02, nativeContext.currentTime);
  }

  function dispose() {
    if (disposed) return;
    disposed = true;
    controller?.abort();
    for (const voice of voices.values()) {
      voice.source.stop(nativeContext.currentTime);
      finish(voice);
    }
    buffers.clear();
    nativeContext?.removeEventListener('statechange', handleStateChange);
    master?.dispose();
    limiter?.dispose();
    if (toneContext) toneContext.dispose();
    else if (nativeContext && nativeContext.state !== 'closed') nativeContext.close().catch(() => {});
  }

  return { enable, attack, release, setSustain, setVolume, setMuted, stopAll, dispose,
    now: () => nativeContext?.currentTime ?? 0 };
}
