export function createMetronome({ context, toneContext, Clock, output, onState }) {
  let running = false;
  let disposed = false;
  let frame;
  const clicks = new Set();
  const beats = [];
  const clock = new Clock({ context: toneContext, frequency: 1.5, callback: click });

  function click(time, tick) {
    // Skip expired ticks after a stalled main thread instead of bursting old clicks.
    if (!running || context.state !== 'running' || time < context.currentTime - 0.05) return;
    const oscillator = context.createOscillator();
    const envelope = context.createGain();
    oscillator.frequency.value = tick % 4 === 0 ? 1320 : 880;
    envelope.gain.setValueAtTime(0, time);
    envelope.gain.linearRampToValueAtTime(0.15, time + 0.002);
    envelope.gain.linearRampToValueAtTime(0, time + 0.035);
    oscillator.connect(envelope);
    envelope.connect(output);
    const voice = { oscillator, envelope };
    oscillator.onended = () => { oscillator.disconnect(); envelope.disconnect(); clicks.delete(voice); };
    clicks.add(voice);
    oscillator.start(time);
    oscillator.stop(time + 0.04);
    beats.push({ time, beat: tick % 4 + 1 });
  }

  function render() {
    if (!running) return;
    let current;
    while (beats.length && beats[0].time <= context.currentTime) current = beats.shift();
    if (current) onState({ running, beat: current.beat });
    frame = requestAnimationFrame(render);
  }

  function setTempo(bpm) {
    if (!Number.isInteger(bpm) || bpm < 40 || bpm > 240) throw new RangeError('Tempo must be an integer from 40 to 240 BPM.');
    clock.frequency.value = bpm / 60;
  }

  function start(bpm) {
    if (disposed) return false;
    setTempo(bpm);
    if (running) return true;
    running = true;
    onState({ running, beat: 0 });
    clock.start(toneContext.now(), 0);
    frame = requestAnimationFrame(render);
    return true;
  }

  function stop() {
    if (!running) return;
    running = false;
    clock.stop(context.currentTime);
    cancelAnimationFrame(frame);
    beats.length = 0;
    for (const { oscillator, envelope } of clicks) {
      oscillator.onended = null;
      oscillator.stop(context.currentTime);
      oscillator.disconnect();
      envelope.disconnect();
    }
    clicks.clear();
    onState({ running, beat: 0 });
  }

  function dispose() {
    if (disposed) return;
    stop();
    clock.dispose();
    disposed = true;
  }

  return { start, stop, setTempo, dispose };
}
