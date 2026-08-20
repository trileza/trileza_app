/**
 * Call Audio Ringer — Web Audio API Synthesizer
 * ───────────────────────────────────────────────
 * Generates realistic incoming ringtones and outgoing ringback tones
 * using Web Audio API oscillators. No external audio assets required.
 */

let audioCtx: AudioContext | null = null;
let activeInterval: ReturnType<typeof setInterval> | null = null;
let isRinging = false;

function getAudioContext(): AudioContext {
  if (!audioCtx) {
    const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
    audioCtx = new AudioContextClass();
  }
  if (audioCtx.state === 'suspended') {
    audioCtx.resume().catch(() => {});
  }
  return audioCtx;
}

export const callAudioRinger = {
  /**
   * Play Incoming Call Ringtone ("Ring-Ring... Ring-Ring...")
   */
  playIncomingRingtone() {
    this.stopAll();
    isRinging = true;

    try {
      const ctx = getAudioContext();

      const playBurst = () => {
        if (!isRinging) return;
        const now = ctx.currentTime;

        // Dual frequency US/Europe ring tone (440Hz + 480Hz)
        const osc1 = ctx.createOscillator();
        const osc2 = ctx.createOscillator();
        const gain = ctx.createGain();

        osc1.type = 'sine';
        osc2.type = 'sine';
        osc1.frequency.setValueAtTime(440, now);
        osc2.frequency.setValueAtTime(480, now);

        // Envelopes for 2 quick pulses
        gain.gain.setValueAtTime(0, now);
        gain.gain.linearRampToValueAtTime(0.15, now + 0.05);
        gain.gain.setValueAtTime(0.15, now + 0.8);
        gain.gain.linearRampToValueAtTime(0, now + 0.9);

        gain.gain.setValueAtTime(0, now + 1.1);
        gain.gain.linearRampToValueAtTime(0.15, now + 1.15);
        gain.gain.setValueAtTime(0.15, now + 1.9);
        gain.gain.linearRampToValueAtTime(0, now + 2.0);

        osc1.connect(gain);
        osc2.connect(gain);
        gain.connect(ctx.destination);

        osc1.start(now);
        osc2.start(now);
        osc1.stop(now + 2.0);
        osc2.stop(now + 2.0);
      };

      playBurst();
      activeInterval = setInterval(playBurst, 3500);
    } catch (err) {
      console.warn('[Ringer] Audio synth error:', err);
    }
  },

  /**
   * Play Outgoing Ringback Tone ("Tuuuk... Tuuuk...")
   */
  playOutgoingRingback() {
    this.stopAll();
    isRinging = true;

    try {
      const ctx = getAudioContext();

      const playBurst = () => {
        if (!isRinging) return;
        const now = ctx.currentTime;

        const osc = ctx.createOscillator();
        const gain = ctx.createGain();

        osc.type = 'sine';
        osc.frequency.setValueAtTime(440, now);

        gain.gain.setValueAtTime(0, now);
        gain.gain.linearRampToValueAtTime(0.1, now + 0.05);
        gain.gain.setValueAtTime(0.1, now + 1.2);
        gain.gain.linearRampToValueAtTime(0, now + 1.3);

        osc.connect(gain);
        gain.connect(ctx.destination);

        osc.start(now);
        osc.stop(now + 1.3);
      };

      playBurst();
      activeInterval = setInterval(playBurst, 3000);
    } catch (err) {
      console.warn('[Ringer] Ringback synth error:', err);
    }
  },

  /**
   * Stop all active ringtones & tones immediately
   */
  stopAll() {
    isRinging = false;
    if (activeInterval) {
      clearInterval(activeInterval);
      activeInterval = null;
    }
  },
};
