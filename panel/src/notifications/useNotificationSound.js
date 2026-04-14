// ============================================================================
// ENAVIA Panel — useNotificationSound (P25-PR5)
//
// Generates a short, discrete notification tone using the Web Audio API.
// No external audio files. No external dependencies. Pure browser API.
//
// Sound types:
//   "block"      — lower, more urgent tone
//   "permission" — medium, attention-grabbing
//   "suggestion" — lighter, friendly
//   "error"      — low, distinct triangle wave
//
// Safety:
//   - AudioContext is created lazily on first use.
//   - All errors are caught silently (browser restrictions, no audio support).
//   - Sound is short (≤ 200ms) and non-repeating — caller must enforce dedup.
//   - Not a React hook (no useEffect) — called as a plain function.
// ============================================================================

// ── AudioContext singleton ────────────────────────────────────────────────────

let _audioCtx = null;

function _getAudioContext() {
  if (_audioCtx) return _audioCtx;
  try {
    const Ctx = (typeof AudioContext !== "undefined" ? AudioContext : null)
      || (typeof window !== "undefined" ? window.webkitAudioContext : null);
    if (!Ctx) return null;
    _audioCtx = new Ctx();
  } catch {
    return null;
  }
  return _audioCtx;
}

// ── Sound configurations ─────────────────────────────────────────────────────

const SOUND_CONFIG = {
  block:      { frequency: 440, duration: 0.15, type: "sine",     gainPeak: 0.18 },
  permission: { frequency: 520, duration: 0.12, type: "sine",     gainPeak: 0.14 },
  suggestion: { frequency: 660, duration: 0.10, type: "sine",     gainPeak: 0.12 },
  error:      { frequency: 330, duration: 0.18, type: "triangle", gainPeak: 0.16 },
};

// ── Public API ────────────────────────────────────────────────────────────────

/**
 * Play a short, discrete notification sound for the given event type.
 * No-op if Web Audio API is unavailable or if an error occurs.
 *
 * @param {"block"|"permission"|"suggestion"|"error"} type
 */
export function playNotificationSound(type) {
  try {
    const ctx = _getAudioContext();
    if (!ctx) return;

    // Resume context if suspended (browser autoplay policy)
    if (ctx.state === "suspended") {
      ctx.resume().catch(() => {/* silent */});
      return; // Don't play on first resume — next call will succeed
    }

    const config = SOUND_CONFIG[type] || SOUND_CONFIG.suggestion;
    const now = ctx.currentTime;

    const osc = ctx.createOscillator();
    const gainNode = ctx.createGain();

    osc.connect(gainNode);
    gainNode.connect(ctx.destination);

    osc.type = config.type;
    osc.frequency.setValueAtTime(config.frequency, now);

    // Fade in quickly, then fade out — avoids clicking artifacts
    gainNode.gain.setValueAtTime(0, now);
    gainNode.gain.linearRampToValueAtTime(config.gainPeak, now + 0.01);
    gainNode.gain.exponentialRampToValueAtTime(0.001, now + config.duration);

    osc.start(now);
    osc.stop(now + config.duration);
  } catch {
    // Audio unavailable, restricted, or failed — silent fail
  }
}
