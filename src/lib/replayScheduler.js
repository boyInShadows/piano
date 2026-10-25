export const REPLAY_RELEASE_TAIL = 0.2;

const REPLAY_CLOCK_FREQUENCY = 120;

function state(running, notes, sustain) {
  return { running, notes: [...notes].sort((a, b) => a - b), sustain };
}

export function createReplayScheduler({ context, toneContext, Clock, onAttack, onRelease, onSustain, onState = () => {} }) {
  let clock;
  let running = false;
  let startTime = 0;
  let duration = 0;
  let events = [];
  let index = 0;
  let heldNotes = new Set();
  let sustain = false;

  function publish() {
    onState(state(running, heldNotes, sustain));
  }

  function disposeClock(at) {
    clock?.stop(at);
    clock?.dispose();
    clock = undefined;
  }

  function finish(time) {
    if (!running) return;
    for (const note of heldNotes) onRelease(note, time);
    if (sustain) onSustain(false, time);
    heldNotes = new Set();
    sustain = false;
    running = false;
    disposeClock(time);
    events = [];
    index = 0;
    publish();
  }

  function tick(time) {
    if (!running || context.state !== 'running') return;
    const elapsed = time - startTime;
    if (elapsed < -0.05) return;
    while (index < events.length && events[index].time <= elapsed + 0.001) {
      const event = events[index++];
      if (event.kind === 'note-on') {
        onAttack(event.note, time);
        heldNotes.add(event.note);
      } else if (event.kind === 'note-off') {
        onRelease(event.note, time);
        heldNotes.delete(event.note);
      } else {
        sustain = event.value;
        onSustain(event.value, time);
      }
      publish();
    }
    if (index >= events.length && elapsed + 0.001 >= duration + REPLAY_RELEASE_TAIL) finish(time);
  }

  function start(recording) {
    stop();
    events = recording.events.map((event) => ({ ...event }));
    duration = recording.duration;
    index = 0;
    heldNotes = new Set();
    sustain = false;
    startTime = toneContext.now();
    running = true;
    clock = new Clock({ context: toneContext, frequency: REPLAY_CLOCK_FREQUENCY, callback: tick });
    publish();
    clock.start(startTime, 0);
    return true;
  }

  function stop() {
    if (!running && !clock) return false;
    disposeClock(context.currentTime);
    running = false;
    heldNotes = new Set();
    sustain = false;
    events = [];
    index = 0;
    publish();
    return true;
  }

  return { start, stop, isRunning: () => running };
}
