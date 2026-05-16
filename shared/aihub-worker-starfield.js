// AIHubWorkerStarfield — main-thread bridge for the OffscreenCanvas worker.
// The visible canvas stays a normal 2D canvas so bloom/refraction can still
// sample it, and fallback to the classic renderer remains possible.

class AIHubWorkerStarfield {
  constructor(canvas, options = {}) {
    this.canvas = canvas;
    this.settings = { ...(options.settings || {}) };
    this.mode = options.mode === "warp" ? "warp" : "static";
    this.workerUrl = options.workerUrl || "shared/aihub-starfield-worker.js";
    this.onUnsupported = typeof options.onUnsupported === "function" ? options.onUnsupported : null;
    this.onReady = typeof options.onReady === "function" ? options.onReady : null;
    this.supported = false;
    this.ready = false;
    this.disposed = false;
    this.framePending = false;
    this.lastMouseAt = 0;
    this.mouseX = window.innerWidth / 2;
    this.mouseY = window.innerHeight / 2;
    this.dpr = this._devicePixelRatio();
    this.blobUrl = null;

    this.ctx = (typeof aiHubGet2dContext === "function")
      ? aiHubGet2dContext(canvas, this.settings.hdr)
      : canvas.getContext("2d");
    if (this.canvas && this.canvas.dataset) {
      this.canvas.dataset.workerStarfield = "initializing";
      this.canvas.dataset.workerStarfieldReason = "";
    }
    this.worker = null;

    this._resize = this._resize.bind(this);
    this._pumpAudio = this._pumpAudio.bind(this);

    if (!this._canRun()) {
      this._fail("unsupported");
      return;
    }

    try {
      this.worker = this._createWorker(this.workerUrl);
    } catch (error) {
      this._fail(error && error.message ? error.message : "worker-create-failed");
      return;
    }

    this.supported = true;
    this.worker.onmessage = event => this._handleMessage(event.data || {});
    this.worker.onerror = event => {
      const message = event && event.message ? event.message : "worker-error";
      this._fail(message);
    };

    window.addEventListener("resize", this._resize);
    this._resize();
    this._post("init", {
      settings: this._plainSettings(this.settings),
      mode: this.mode,
      reducedMotion: this._reducedMotion()
    });
    this._post("mouse", { x: this.mouseX, y: this.mouseY });
    this.audioTimer = window.setInterval(this._pumpAudio, 66);
  }

  _canRun() {
    return Boolean(
      this.canvas &&
      this.ctx &&
      typeof Worker !== "undefined" &&
      typeof OffscreenCanvas !== "undefined" &&
      typeof ImageBitmap !== "undefined"
    );
  }

  _devicePixelRatio() {
    const reduced = this._reducedMotion();
    return Math.min(window.devicePixelRatio || 1, reduced ? 1 : 1.6);
  }

  _reducedMotion() {
    return Boolean(window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches);
  }

  _createWorker(url) {
    if (location.protocol === "file:" && typeof window.AIHUB_STARFIELD_WORKER_SOURCE === "string") {
      return this._createBlobWorker(window.AIHUB_STARFIELD_WORKER_SOURCE);
    }
    if (
      location.protocol === "file:" &&
      typeof XMLHttpRequest !== "undefined" &&
      typeof Blob !== "undefined" &&
      window.URL &&
      typeof window.URL.createObjectURL === "function"
    ) {
      const xhr = new XMLHttpRequest();
      xhr.open("GET", url, false);
      xhr.send(null);
      if ((xhr.status === 0 || (xhr.status >= 200 && xhr.status < 300)) && xhr.responseText) {
        return this._createBlobWorker(xhr.responseText);
      }
    }
    return new Worker(url);
  }

  _createBlobWorker(source) {
    if (typeof Blob === "undefined" || !window.URL || typeof window.URL.createObjectURL !== "function") {
      throw new Error("blob-worker-unavailable");
    }
    const blob = new Blob([source], { type: "text/javascript" });
    this.blobUrl = window.URL.createObjectURL(blob);
    return new Worker(this.blobUrl);
  }

  _plainSettings(settings) {
    const out = {};
    for (const [key, value] of Object.entries(settings || {})) {
      if (value === null || ["boolean", "number", "string"].includes(typeof value)) out[key] = value;
    }
    out.hdr = settings && settings.hdr !== false;
    out.starGlow = typeof aiHubNormalizeStarGlow === "function"
      ? aiHubNormalizeStarGlow(settings && settings.starGlow)
      : Math.min(4, Math.max(0.8, Number(settings && settings.starGlow) || 1.7));
    return out;
  }

  _post(type, payload = {}, transfer = []) {
    if (!this.worker || this.disposed) return;
    try {
      this.worker.postMessage({ type, ...payload }, transfer);
    } catch (error) {
      this._fail(error && error.message ? error.message : "worker-post-failed");
    }
  }

  _handleMessage(message) {
    if (this.disposed) return;
    if (message.type === "ready") {
      this.ready = true;
      if (this.canvas && this.canvas.dataset) this.canvas.dataset.workerStarfield = "on";
      if (this.onReady) this.onReady(this);
      return;
    }
    if (message.type === "frame" && message.bitmap) {
      this._drawBitmap(message.bitmap);
      this._post("ack");
      return;
    }
    if (message.type === "unsupported" || message.type === "error") {
      this._fail(message.reason || message.error || message.type);
    }
  }

  _drawBitmap(bitmap) {
    if (!this.ctx || !bitmap) return;
    try {
      this.ctx.globalCompositeOperation = "copy";
      this.ctx.globalAlpha = 1;
      this.ctx.drawImage(bitmap, 0, 0, this.canvas.width, this.canvas.height);
      this.ctx.globalCompositeOperation = "source-over";
    } catch (error) {
      this._fail(error && error.message ? error.message : "bitmap-draw-failed");
    } finally {
      if (bitmap && typeof bitmap.close === "function") bitmap.close();
    }
  }

  _resize() {
    if (!this.canvas || this.disposed) return;
    this.dpr = this._devicePixelRatio();
    const width = Math.max(1, Math.round(window.innerWidth * this.dpr));
    const height = Math.max(1, Math.round(window.innerHeight * this.dpr));
    if (this.canvas.width !== width) this.canvas.width = width;
    if (this.canvas.height !== height) this.canvas.height = height;
    this.canvas.style.width = "100%";
    this.canvas.style.height = "100%";
    this._post("resize", {
      width,
      height,
      cssWidth: window.innerWidth,
      cssHeight: window.innerHeight,
      dpr: this.dpr,
      reducedMotion: this._reducedMotion()
    });
  }

  _pumpAudio() {
    if (!this.worker || this.disposed) return;
    const levels = this.settings.audioReactive && window.aiHubAudioLevels
      ? window.aiHubAudioLevels()
      : { bass: 0, mid: 0, high: 0, level: 0, beat: 0 };
    this._post("audio", { levels });
  }

  _fail(reason) {
    if (this.disposed) return;
    const callback = this.onUnsupported;
    this.stop();
    if (this.canvas && this.canvas.dataset) {
      this.canvas.dataset.workerStarfield = "fallback";
      this.canvas.dataset.workerStarfieldReason = String(reason || "unknown").slice(0, 180);
    }
    if (callback) callback(reason);
  }

  updateSettings(settings = {}) {
    this.settings = { ...this.settings, ...settings };
    this._post("settings", { settings: this._plainSettings(this.settings) });
    this._pumpAudio();
  }

  updateHdr(enabled) {
    this.settings.hdr = enabled !== false;
    this.updateSettings(this.settings);
  }

  setMode(mode) {
    this.mode = mode === "warp" ? "warp" : "static";
    this._post("mode", { mode: this.mode });
  }

  setMouse(x, y) {
    this.mouseX = Number.isFinite(x) ? x : this.mouseX;
    this.mouseY = Number.isFinite(y) ? y : this.mouseY;
    const now = performance.now();
    if (now - this.lastMouseAt < 16) return;
    this.lastMouseAt = now;
    this._post("mouse", { x: this.mouseX, y: this.mouseY });
  }

  stop() {
    if (this.disposed) return;
    this.disposed = true;
    window.removeEventListener("resize", this._resize);
    if (this.audioTimer) window.clearInterval(this.audioTimer);
    this.audioTimer = null;
    if (this.worker) {
      try { this.worker.postMessage({ type: "stop" }); } catch {}
      this.worker.terminate();
    }
    if (this.blobUrl && window.URL && typeof window.URL.revokeObjectURL === "function") {
      window.URL.revokeObjectURL(this.blobUrl);
    }
    this.blobUrl = null;
    if (this.canvas && this.canvas.dataset) this.canvas.dataset.workerStarfield = "off";
    this.worker = null;
    this.supported = false;
    this.ready = false;
  }
}

window.AIHubWorkerStarfield = AIHubWorkerStarfield;
