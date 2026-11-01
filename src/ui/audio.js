/** Live Web Audio chiptune. No audio files. */

const LEAD = [523, 0, 659, 523, 440, 392, 440, 523, 659, 784, 659, 523, 440, 392, 349, 392];
const BASS = [196, 196, 175, 175, 165, 165, 147, 165];

export function createAudio() {
  let ctx = null;
  let muted = false;
  let volume = 0.8;
  let timer = 0;
  let themeOn = false;
  let unlocked = false;
  let lastDig = 0;

  function context() {
    const AudioCtx = window.AudioContext || window.webkitAudioContext;
    if (!AudioCtx || !unlocked) return null;
    if (!ctx) ctx = new AudioCtx();
    return ctx.state === "running" ? ctx : null;
  }

  function bus() {
    const audio = context();
    if (!audio) return null;
    const gain = audio.createGain();
    gain.gain.value = muted ? 0 : Math.max(0, volume) * 0.28;
    gain.connect(audio.destination);
    return { audio, gain };
  }

  function tone(freq, when, dur, type, amp) {
    const output = bus();
    if (!output || !freq) return;
    const osc = output.audio.createOscillator();
    const gain = output.audio.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(freq, when);
    gain.gain.setValueAtTime(0.0001, when);
    gain.gain.exponentialRampToValueAtTime(Math.max(0.0002, amp), when + 0.015);
    gain.gain.exponentialRampToValueAtTime(0.0001, when + dur);
    osc.connect(gain);
    gain.connect(output.gain);
    osc.start(when);
    osc.stop(when + dur + 0.03);
  }

  function noise(when, dur, amp, freq) {
    const output = bus();
    if (!output) return;
    const length = Math.max(1, Math.floor(output.audio.sampleRate * dur));
    const buffer = output.audio.createBuffer(1, length, output.audio.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < length; i++) data[i] = Math.random() * 2 - 1;
    const source = output.audio.createBufferSource();
    source.buffer = buffer;
    const filter = output.audio.createBiquadFilter();
    filter.type = "lowpass";
    filter.frequency.value = freq;
    const gain = output.audio.createGain();
    gain.gain.setValueAtTime(amp, when);
    gain.gain.exponentialRampToValueAtTime(0.0001, when + dur);
    source.connect(filter);
    filter.connect(gain);
    gain.connect(output.gain);
    source.start(when);
    source.stop(when + dur + 0.02);
  }

  function scheduleTheme() {
    if (!themeOn) return;
    const audio = context();
    if (!audio) {
      timer = window.setTimeout(scheduleTheme, 400);
      return;
    }
    const step = 0.16;
    const start = audio.currentTime + 0.05;
    LEAD.forEach((freq, index) => tone(freq, start + index * step, step * 0.85, "square", 0.045));
    BASS.forEach((freq, index) => tone(freq, start + index * step * 2, step * 1.7, "triangle", 0.06));
    const ms = LEAD.length * step * 1000 - 40;
    timer = window.setTimeout(scheduleTheme, ms);
  }

  function startTheme() {
    if (themeOn) return;
    if (!unlocked) return;
    themeOn = true;
    scheduleTheme();
  }

  function stopTheme() {
    themeOn = false;
    window.clearTimeout(timer);
  }

  function play(events) {
    const audio = context();
    if (!audio || muted || !events) return;
    const now = audio.currentTime;
    for (const event of events) {
      if (event.type === "dig") {
        if (now - lastDig < 0.08) continue;
        lastDig = now;
        noise(now, 0.05, 0.12, 1400);
      } else if (event.type === "break" || event.type === "swing") {
        noise(now, 0.09, 0.2, 900);
        tone(220, now, 0.08, "square", 0.05);
      } else if (event.type === "plant") {
        tone(140, now, 0.16, "sawtooth", 0.06);
      } else if (event.type === "cavein") {
        noise(now, 0.35, 0.45, 500);
        tone(180, now, 0.3, "sawtooth", 0.08);
        tone(70, now + 0.05, 0.4, "sine", 0.1);
      } else if (event.type === "treasure") {
        [523, 659, 784, 1046].forEach((freq, index) => tone(freq, now + index * 0.06, 0.18, "square", 0.06));
      } else if (event.type === "powerup") {
        tone(880, now, 0.1, "square", 0.05);
        tone(1320, now + 0.08, 0.14, "square", 0.05);
      } else if (event.type === "stun") {
        tone(180, now, 0.2, "sawtooth", 0.06);
        tone(110, now + 0.08, 0.2, "square", 0.05);
      } else if (event.type === "elimination") {
        tone(300, now, 0.25, "sawtooth", 0.07);
        tone(140, now + 0.12, 0.35, "triangle", 0.08);
      } else if (event.type === "countdown") {
        tone(event.value === 0 ? 880 : 440, now, event.value === 0 ? 0.2 : 0.12, "square", 0.07);
      } else if (event.type === "roundWin") {
        [523, 659, 784, 1046].forEach((freq, index) => tone(freq, now + index * 0.09, 0.28, "square", 0.07));
      } else if (event.type === "matchWin") {
        [392, 523, 659, 784, 1046].forEach((freq, index) => tone(freq, now + index * 0.11, 0.36, "square", 0.08));
      } else if (event.type === "drop") {
        tone(200, now, 0.1, "triangle", 0.05);
      }
    }
  }

  return {
    unlock() {
      const AudioCtx = window.AudioContext || window.webkitAudioContext;
      if (!AudioCtx) return;
      unlocked = true;
      if (!ctx) ctx = new AudioCtx();
      const start = () => startTheme();
      if (ctx.state === "suspended") ctx.resume().then(start).catch(start);
      else start();
    },
    play,
    startTheme,
    stopTheme,
    setMuted(next) {
      muted = !!next;
      if (muted) stopTheme();
      else startTheme();
    },
    setVolume(next) {
      volume = Math.max(0, Math.min(1, next));
    },
    get muted() {
      return muted;
    },
  };
}
