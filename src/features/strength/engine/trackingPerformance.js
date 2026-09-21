const { STRENGTH_DEFAULTS } = require('../constants');

// Session-local scalar measurements only. Never retain frames or landmarks.
function createTrackingPerformance(options = {}) {
  const config = { ...STRENGTH_DEFAULTS, ...options };
  let startedAt = null;
  let slowSince = null;
  let samples = [];
  let latencyMs = 0;
  let reduced = false;

  function reset() {
    startedAt = null;
    slowSince = null;
    samples = [];
    latencyMs = 0;
  }

  function sample(now, latency) {
    samples.push(now);
    latencyMs = Math.max(0, Number(latency) || 0);
  }

  function evaluate(now) {
    if (startedAt === null) startedAt = now;
    samples = samples.filter(at => at > now - 2000);
    const elapsed = Math.min(2000, now - startedAt);
    const fps = elapsed >= 1000 ? samples.length * 1000 / elapsed : null;
    const slow = latencyMs > config.maxInferenceLatencyMs
      || (fps !== null && fps < config.minimumSampleRate);
    if (slow) {
      if (slowSince === null) slowSince = now;
      if (now - slowSince >= 1000) reduced = true;
    } else slowSince = null;
    return {
      fps, latencyMs, reduced,
      // Keep a little headroom above the minimum so rAF quantization does
      // not itself trigger the fallback at the reduced sampling rate.
      sampleIntervalMs: Math.max(1000 / (reduced ? Math.max(config.minimumSampleRate + 2, 10) : config.sampleRate), latencyMs * 1.5),
      downsampleLongSide: reduced ? 384 : config.downsampleLongSide,
      shouldStop: slowSince !== null && now - slowSince >= config.lowFpsDurationMs,
    };
  }

  return { sample, evaluate, reset };
}

module.exports = { createTrackingPerformance };
