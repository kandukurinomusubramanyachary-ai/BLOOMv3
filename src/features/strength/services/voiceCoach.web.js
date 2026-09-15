const VOICE_PREFERENCES = ['en-IN', 'en-GB', 'en-US', 'en'];
const MUTE_KEY = '@bloom:strength:voice-muted:v1';

function chooseVoice(voices) {
  for (const language of VOICE_PREFERENCES) {
    const voice = voices.find(item => item.lang?.toLowerCase() === language.toLowerCase())
      || voices.find(item => item.lang?.toLowerCase().startsWith(language.toLowerCase()));
    if (voice) return voice;
  }
  return voices.find(voice => voice.default) || voices[0] || null;
}

// One coach owns one workout's speech. Pose frames never create utterances:
// callers submit stable conditions or session transitions, with explicit priority.
export function createVoiceCoach(options = {}) {
  const env = options.env || (typeof window !== 'undefined' ? window : {});
  const synthesizer = env.speechSynthesis;
  const Utterance = env.SpeechSynthesisUtterance;
  const available = Boolean(synthesizer?.speak && synthesizer?.cancel && Utterance);
  const now = options.now || Date.now;
  let muted = Boolean(options.muted);
  try {
    const saved = env.localStorage?.getItem(MUTE_KEY);
    if (saved !== null && saved !== undefined) muted = saved === 'true';
  } catch { /* Private browsing/storage denial must not block a workout. */ }
  let activated = false;
  let paused = false;
  let listening = false;
  let disposed = false;
  let selectedVoice = null;
  let active = null;
  let pending = [];
  let pumpTimer = null;
  let speechTimer = null;
  let lastStart = -Infinity;
  const lastById = new Map();

  function refreshVoices() {
    try { selectedVoice = chooseVoice(synthesizer?.getVoices?.() || []); } catch { selectedVoice = null; }
  }

  function listen() {
    if (listening || !available) return;
    refreshVoices();
    try { synthesizer.addEventListener?.('voiceschanged', refreshVoices); } catch { /* Default voice still works. */ }
    listening = true;
  }

  function cancel() {
    pending = [];
    active = null; // Invalidate callbacks before cancel dispatches end/error.
    clearTimeout(pumpTimer);
    clearTimeout(speechTimer);
    pumpTimer = null;
    speechTimer = null;
    try { synthesizer?.cancel(); } catch { /* Speech failure leaves visual guidance intact. */ }
  }

  function pump() {
    clearTimeout(pumpTimer);
    pumpTimer = null;
    if (active || muted || !activated || disposed) return;
    const timestamp = now();
    pending = pending.filter(cue => cue.expiresAt > timestamp && (!paused || cue.allowWhilePaused));
    pending.sort((a, b) => b.priority - a.priority);
    const cue = pending[0];
    if (!cue) return;
    const wait = cue.interrupt ? 0 : Math.max(0, (options.minimumGapMs ?? 2500) - (timestamp - lastStart));
    if (wait) { pumpTimer = setTimeout(pump, wait); return; }
    pending.shift();
    try {
      const utterance = new Utterance(cue.text);
      utterance.lang = selectedVoice?.lang || 'en-IN';
      utterance.rate = options.rate || 0.95;
      utterance.pitch = options.pitch || 1;
      if (selectedVoice) utterance.voice = selectedVoice;
      active = { ...cue, utterance };
      lastStart = timestamp;
      lastById.set(cue.id, timestamp);
      const done = () => {
        if (active?.utterance !== utterance) return;
        active = null;
        clearTimeout(speechTimer);
        pump();
      };
      utterance.onend = done;
      utterance.onerror = event => {
        if (active?.utterance !== utterance) return;
        if (event?.error === 'not-allowed') { activated = false; cancel(); return; }
        done();
      };
      // Some mobile engines omit their final callback. Never let that hold
      // stale cues indefinitely; cancel the old utterance before draining.
      speechTimer = setTimeout(() => {
        if (active?.utterance !== utterance) return;
        active = null;
        try { synthesizer.cancel(); } catch { /* Continue silently. */ }
        pump();
      }, Math.max(8000, Math.min(25000, cue.text.length * 100)));
      synthesizer.speak(utterance);
    } catch { cancel(); }
  }

  function speak(text, settings = {}) {
    if (!available || !activated || muted || disposed || !String(text || '').trim()) return false;
    const config = typeof settings === 'boolean' ? { interrupt: settings } : settings;
    if (paused && !config.allowWhilePaused) return false;
    const timestamp = now();
    const id = config.id || String(text);
    if (timestamp - (lastById.get(id) ?? -Infinity) < (config.cooldownMs ?? 6000)) return false;
    if (active?.id === id || pending.some(cue => cue.id === id)) return false;
    const cue = {
      ...config, id, text: String(text), priority: config.priority ?? 50,
      channel: config.channel || 'guidance', expiresAt: timestamp + (config.ttlMs ?? 6000),
    };
    if (cue.interrupt) cancel();
    else if (active && config.dropIfBusy) return false;
    // Keep only the newest cue for a condition/channel. The queue cannot grow
    // with inference rate, and low-priority rep numbers cannot interrupt form.
    pending = pending.filter(item => item.channel !== cue.channel);
    pending.push(cue);
    pending.sort((a, b) => b.priority - a.priority);
    pending = pending.slice(0, 3);
    pump();
    return true;
  }

  function activate(text, settings = {}) {
    if (!available) return false;
    disposed = false;
    activated = true;
    listen();
    refreshVoices();
    try { synthesizer.resume?.(); } catch { /* Optional in older engines. */ }
    // Do not await voiceschanged here: this speak must stay inside the click
    // stack for iOS/Android activation. Use the OS default while voices load.
    return text ? speak(text, { priority: 100, interrupt: true, cooldownMs: 0, ...settings }) : true;
  }

  return {
    available,
    get muted() { return muted; },
    activate,
    speak,
    cancel,
    clearChannel(channel) {
      pending = pending.filter(cue => cue.channel !== channel);
      if (active?.channel !== channel) return;
      active = null;
      clearTimeout(speechTimer);
      try { synthesizer?.cancel(); } catch { /* Visual guidance still updates. */ }
      pump();
    },
    setMuted(value) {
      muted = Boolean(value);
      try { env.localStorage?.setItem(MUTE_KEY, String(muted)); } catch { /* In-memory preference still works. */ }
      if (muted) cancel();
    },
    pause(text) {
      cancel();
      paused = true;
      if (text) speak(text, { id: 'pause', priority: 100, interrupt: true, cooldownMs: 0, allowWhilePaused: true });
    },
    resume(text) { paused = false; return activate(text); },
    dispose() {
      cancel();
      disposed = true;
      activated = false;
      try { if (listening) synthesizer?.removeEventListener?.('voiceschanged', refreshVoices); } catch { /* Already detached. */ }
      listening = false;
    },
  };
}
