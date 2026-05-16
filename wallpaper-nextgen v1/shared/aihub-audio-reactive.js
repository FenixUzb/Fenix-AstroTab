// AIHubAudio — singleton wrapper around AudioContext + AnalyserNode.
// Pulls audio from microphone (getUserMedia) or system / tab share (getDisplayMedia + audio).
// Each rAF computes smoothed bass/mid/high levels and a quick beat trigger.
// Consumers read window.aiHubAudio.{bass, mid, high, beat, level} (all 0..1).
// Permission denials are surfaced via a string status; nothing throws upstream.

class AIHubAudio {
  constructor() {
    this.kind = "off";                               // "off" | "mic" | "system"
    this.status = "idle";                            // "idle" | "starting" | "active" | "error" | "denied"
    this.statusMessage = "";
    this.bass = 0;
    this.mid = 0;
    this.high = 0;
    this.level = 0;
    this.beat = 0;                                   // decays each frame
    this._bassAvg = 0;
    this._audioContext = null;
    this._analyser = null;
    this._source = null;
    this._stream = null;
    this._buffer = null;
    this._rafId = 0;
    this._listeners = new Set();
    this._tick = this._tick.bind(this);
  }

  onChange(fn) {
    this._listeners.add(fn);
    return () => this._listeners.delete(fn);
  }

  _emit() {
    for (const fn of this._listeners) {
      try { fn({ status: this.status, kind: this.kind, statusMessage: this.statusMessage }); } catch {}
    }
  }

  async start(kind) {
    if (kind === this.kind && this.status === "active") return true;
    await this.stop();
    if (kind !== "mic" && kind !== "system") {
      this.kind = "off";
      this.status = "idle";
      this._emit();
      return false;
    }
    this.kind = kind;
    this.status = "starting";
    this.statusMessage = "";
    this._emit();
    try {
      if (!navigator.mediaDevices) throw new Error("media_devices_unavailable");
      const AudioCtx = window.AudioContext || window.webkitAudioContext;
      if (!AudioCtx) throw new Error("audio_context_unavailable");
      if (kind === "mic" && !navigator.mediaDevices.getUserMedia) throw new Error("get_user_media_unavailable");
      if (kind === "system" && !navigator.mediaDevices.getDisplayMedia) throw new Error("get_display_media_unavailable");

      const stream = kind === "mic"
        ? await navigator.mediaDevices.getUserMedia({ audio: true, video: false })
        : await navigator.mediaDevices.getDisplayMedia({ audio: true, video: true });
      const audioTrack = stream.getAudioTracks()[0];
      if (!audioTrack) {
        for (const t of stream.getTracks()) t.stop();
        throw new Error("no_audio_track");
      }
      // Keep display video tracks alive for Chromium screen/tab capture sessions.
      // They are not connected to the analyser and are stopped together with the stream.
      const audioOnly = new MediaStream([audioTrack]);
      audioTrack.addEventListener("ended", () => { void this.stop(); }, { once: true });

      const ctx = new AudioCtx();
      // Chromium autoplay-policy may leave the context "suspended" until a user
      // gesture resumes it. start() is itself called from a click handler, so
      // resume() succeeds — without it _tick reads zero levels silently.
      if (ctx.state === "suspended") {
        try { await ctx.resume(); } catch (_) {}
      }
      const source = ctx.createMediaStreamSource(audioOnly);
      const analyser = ctx.createAnalyser();
      analyser.fftSize = 512;
      analyser.smoothingTimeConstant = 0.6;
      source.connect(analyser);

      this._stream = stream;
      this._audioContext = ctx;
      this._analyser = analyser;
      this._source = source;
      this._buffer = new Uint8Array(analyser.frequencyBinCount);
      this.status = "active";
      this.statusMessage = "";
      this._emit();
      this._rafId = requestAnimationFrame(this._tick);
      return true;
    } catch (error) {
      const denied = error && (error.name === "NotAllowedError" || error.name === "SecurityError");
      this.status = denied ? "denied" : "error";
      this.statusMessage = error && error.message ? String(error.message) : String(error);
      this.kind = "off";
      this._emit();
      return false;
    }
  }

  async stop() {
    if (this._rafId) { cancelAnimationFrame(this._rafId); this._rafId = 0; }
    if (this._source) { try { this._source.disconnect(); } catch {} this._source = null; }
    if (this._analyser) { try { this._analyser.disconnect(); } catch {} this._analyser = null; }
    if (this._audioContext) {
      try { await this._audioContext.close(); } catch {}
      this._audioContext = null;
    }
    if (this._stream) {
      for (const t of this._stream.getTracks()) { try { t.stop(); } catch {} }
      this._stream = null;
    }
    this._buffer = null;
    this.bass = 0; this.mid = 0; this.high = 0; this.level = 0; this.beat = 0;
    this._bassAvg = 0;
    if (this.status === "active") {
      this.status = "idle";
      this._emit();
    }
  }

  _tick() {
    if (!this._analyser) return;
    this._rafId = requestAnimationFrame(this._tick);
    this._analyser.getByteFrequencyData(this._buffer);
    const buf = this._buffer;
    // Aggregate 3 bands. fftSize=512 → frequencyBinCount=256.
    // bass: 0..15, mid: 16..63, high: 64..255 — covers ~0-100Hz / ~100-700Hz / ~700Hz+ at 48kHz.
    let bSum = 0, mSum = 0, hSum = 0;
    for (let i = 0; i < 16; i++) bSum += buf[i];
    for (let i = 16; i < 64; i++) mSum += buf[i];
    for (let i = 64; i < buf.length; i++) hSum += buf[i];
    const bassNow = bSum / (16 * 255);
    const midNow = mSum / (48 * 255);
    const highNow = hSum / ((buf.length - 64) * 255);
    const levelNow = (bassNow + midNow + highNow) / 3;

    // Smoothing.
    this.bass  = this.bass  * 0.7 + bassNow  * 0.3;
    this.mid   = this.mid   * 0.7 + midNow   * 0.3;
    this.high  = this.high  * 0.6 + highNow  * 0.4;
    this.level = this.level * 0.7 + levelNow * 0.3;

    // Beat: bass spike above slow average, decays each frame.
    this._bassAvg = this._bassAvg * 0.97 + bassNow * 0.03;
    if (bassNow > this._bassAvg * 1.4 && bassNow > 0.18) {
      this.beat = Math.min(1, Math.max(this.beat, bassNow));
    } else {
      this.beat *= 0.92;
    }
  }

  levels() {
    return this.status === "active"
      ? { bass: this.bass, mid: this.mid, high: this.high, level: this.level, beat: this.beat }
      : { bass: 0, mid: 0, high: 0, level: 0, beat: 0 };
  }
}

window.aiHubAudio = new AIHubAudio();
window.AIHubAudio = AIHubAudio;
window.aiHubAudioLevels = function aiHubAudioLevels() {
  return window.aiHubAudio ? window.aiHubAudio.levels() : { bass: 0, mid: 0, high: 0, level: 0, beat: 0 };
};
