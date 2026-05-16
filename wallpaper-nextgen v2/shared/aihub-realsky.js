// RealStarfield — renders the Yale Bright Star Catalog onto a canvas overlay
// using the observer's latitude/longitude and the current sidereal time.

class AIHubRealStarfield {
  constructor(canvas, options = {}) {
    this.canvas = canvas;
    this.hdrEnabled = options.hdr !== false;
    this.ctx = aiHubGet2dContext(canvas, this.hdrEnabled);
    this.enabled = options.enabled === true;
    this.lat = Number.isFinite(options.lat) ? options.lat : 41.31;
    this.lon = Number.isFinite(options.lon) ? options.lon : 69.24;
    this.catalogUrl = options.catalogUrl || "shared/yale-bsc.json";
    this.starGlow = aiHubNormalizeStarGlow(options.starGlow);
    this.reducedMotion = window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    this.dpr = Math.min(window.devicePixelRatio || 1, this.reducedMotion ? 1 : 1.6);
    this.catalog = null;
    this.alts = null;
    this.azs = null;
    this.lastEphemerisAt = 0;
    this.ephemerisIntervalMs = 10000;
    this.frameId = 0;

    this._onResize = () => this._resize();
    window.addEventListener("resize", this._onResize);
    this._resize();
    this._tick = this._tick.bind(this);
    this._loadCatalog();
    this.frameId = requestAnimationFrame(this._tick);
  }

  async _loadCatalog() {
    try {
      const data = await this._fetchCatalogJson();
      const total = Number(data.count) || (Array.isArray(data.ra) ? data.ra.length : 0);
      const MAG_LIMIT = 5.7;
      const keep = [];
      for (let i = 0; i < total; i++) {
        if (data.v[i] <= MAG_LIMIT) keep.push(i);
      }
      const count = keep.length;
      const ra = new Float64Array(count);
      const dec = new Float64Array(count);
      const v = new Float32Array(count);
      const k = new Int32Array(count);
      const phase = new Float32Array(count);
      const twinkleSpeed = new Float32Array(count);
      const colors = new Array(count);
      for (let i = 0; i < count; i++) {
        const src = keep[i];
        ra[i] = data.ra[src];
        dec[i] = data.dec[src];
        v[i] = data.v[src];
        k[i] = data.k[src];
        colors[i] = aiHubKelvinToRGB(k[i] || 5500);
        phase[i] = Math.random() * Math.PI * 2;
        twinkleSpeed[i] = 0.4 + Math.random() * 1.6;
      }
      this.alts = new Float32Array(count);
      this.azs = new Float32Array(count);
      this.catalog = { count, ra, dec, v, k, colors, phase, twinkleSpeed };
      this.lastEphemerisAt = 0;
    } catch (error) {
      console.warn("RealStarfield catalog load failed:", error);
      this.catalog = null;
    }
  }

  async _fetchCatalogJson() {
    try {
      const res = await fetch(this.catalogUrl);
      if (!res.ok) throw new Error(`status ${res.status}`);
      return await res.json();
    } catch (fetchError) {
      if (typeof XMLHttpRequest === "undefined") throw fetchError;
      return await new Promise((resolve, reject) => {
        try {
          const xhr = new XMLHttpRequest();
          xhr.open("GET", this.catalogUrl, true);
          xhr.overrideMimeType && xhr.overrideMimeType("application/json");
          xhr.onload = () => {
            if (xhr.status && xhr.status >= 400) {
              reject(new Error(`status ${xhr.status}`));
              return;
            }
            try { resolve(JSON.parse(xhr.responseText)); }
            catch (error) { reject(error); }
          };
          xhr.onerror = () => reject(fetchError);
          xhr.send();
        } catch (error) {
          reject(error);
        }
      });
    }
  }

  _resize() {
    if (!this.canvas) return;
    const w = window.innerWidth;
    const h = window.innerHeight;
    this.dpr = Math.min(window.devicePixelRatio || 1, this.reducedMotion ? 1 : 1.6);
    this.canvas.width = Math.round(w * this.dpr);
    this.canvas.height = Math.round(h * this.dpr);
    this.canvas.style.width = w + "px";
    this.canvas.style.height = h + "px";
    if (this.ctx) this.ctx.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);
  }

  _updateEphemeris(now) {
    if (!this.catalog) return;
    if (now - this.lastEphemerisAt < this.ephemerisIntervalMs && this.lastEphemerisAt > 0) return;
    this.lastEphemerisAt = now;
    const jd = aiHubJulianDay(now);
    const gmst = aiHubGMST(jd);
    const lst = aiHubLST(gmst, this.lon * Math.PI / 180);
    const lat = this.lat * Math.PI / 180;
    const n = this.catalog.count;
    const ra = this.catalog.ra;
    const dec = this.catalog.dec;
    for (let i = 0; i < n; i++) {
      const horizontal = aiHubEqToAltAz(ra[i], dec[i], lat, lst);
      this.alts[i] = horizontal.alt;
      this.azs[i] = horizontal.az;
    }
  }

  _tick() {
    this.frameId = requestAnimationFrame(this._tick);
    if (!this.enabled || !this.catalog || !this.ctx) return;

    const now = Date.now();
    this._updateEphemeris(now);

    const w = window.innerWidth;
    const h = window.innerHeight;
    const ctx = this.ctx;
    ctx.clearRect(0, 0, w, h);

    const FOV_H = 135 * Math.PI / 180;       // 135° azimuth window
    const ALT_MIN = -5 * Math.PI / 180;
    const ALT_MAX = 88 * Math.PI / 180;
    const ALT_SPAN = ALT_MAX - ALT_MIN;
    const CENTER_AZ = Math.PI;               // looking south
    const TWO_PI = Math.PI * 2;
    const PI = Math.PI;

    const n = this.catalog.count;
    const colors = this.catalog.colors;
    const v = this.catalog.v;
    const phases = this.catalog.phase;
    const twinkleSpeed = this.catalog.twinkleSpeed;
    const alts = this.alts;
    const azs = this.azs;
    const hdr = this.hdrEnabled;
    const glow = aiHubNormalizeStarGlow(this.starGlow);
    const lift = Math.max(0, glow - 1);
    const tSec = now / 1000;
    const audio = window.aiHubAudioLevels ? window.aiHubAudioLevels() : { bass: 0, high: 0, beat: 0 };
    const audioBass = audio.bass || 0;
    const audioHigh = audio.high || 0;
    const audioBeat = audio.beat || 0;

    ctx.globalCompositeOperation = "screen";
    for (let i = 0; i < n; i++) {
      const alt = alts[i];
      if (alt < ALT_MIN || alt > ALT_MAX) continue;
      let dAz = azs[i] - CENTER_AZ;
      if (dAz > PI) dAz -= TWO_PI;
      else if (dAz < -PI) dAz += TWO_PI;
      if (dAz < -FOV_H / 2 || dAz > FOV_H / 2) continue;

      const x = (dAz / FOV_H + 0.5) * w;
      const y = (1 - (alt - ALT_MIN) / ALT_SPAN) * h;
      const mag = v[i];
      const intensity = aiHubMagnitudeIntensity(mag);

      // Atmospheric extinction near horizon: stars below 15° dim noticeably.
      const altDeg = alt * 180 / PI;
      const extinction = altDeg < 15 ? Math.max(0.35, altDeg / 15) : 1;

      // Twinkle amplitude: dim stars scintillate hard, bright stars almost steady.
      const twinkleAmp = 0.05 + (1 - intensity) * 0.35;
      const twinkle = 1 + twinkleAmp * Math.sin(tSec * twinkleSpeed[i] + phases[i]);

      const baseAlpha = aiHubMagnitudeAlpha(mag);
      const baseSize = aiHubMagnitudeSize(mag);
      const boost = 1 + lift * intensity * 0.45;
      const audioLift = 1 + audioHigh * (0.08 + intensity * 0.18) + audioBeat * intensity * 0.22;
      const alpha = Math.min(1, baseAlpha * boost * twinkle * extinction * audioLift);
      const size = baseSize * (1 + lift * intensity * 0.15) * (1 + audioBass * intensity * 0.22 + audioBeat * intensity * 0.14);

      // Desaturate dim stars toward white; only the top stars keep full color.
      const satFactor = 0.25 + Math.pow(intensity, 1.6) * 0.75;
      const color = aiHubDesaturateRGB(colors[i], satFactor);

      ctx.fillStyle = aiHubCanvasColor(color.r, color.g, color.b, alpha, hdr);
      ctx.beginPath();
      ctx.arc(x, y, size, 0, TWO_PI);
      ctx.fill();

      // Halo only on the very brightest (top ~30 stars, intensity > 0.9 → mag < ~0.5).
      if (intensity > 0.9) {
        const t = (intensity - 0.9) / 0.1;
        const haloR = size * (1.6 + t * 2.4);
        const haloAlpha = Math.min(0.34, t * 0.22 * boost * twinkle * (1 + audioHigh * 0.55 + audioBeat * 0.35));
        const halo = ctx.createRadialGradient(x, y, 0, x, y, haloR);
        halo.addColorStop(0, aiHubCanvasColor(color.r, color.g, color.b, haloAlpha, hdr));
        halo.addColorStop(1, aiHubCanvasColor(color.r, color.g, color.b, 0, hdr));
        ctx.fillStyle = halo;
        ctx.beginPath();
        ctx.arc(x, y, haloR, 0, TWO_PI);
        ctx.fill();
      }
    }
    ctx.globalCompositeOperation = "source-over";
  }

  setEnabled(enabled) {
    this.enabled = enabled === true;
  }

  setLocation(lat, lon) {
    if (Number.isFinite(lat)) this.lat = lat;
    if (Number.isFinite(lon)) this.lon = lon;
    this.lastEphemerisAt = 0;
  }

  setHDR(enabled) {
    this.hdrEnabled = enabled !== false;
    this.ctx = aiHubGet2dContext(this.canvas, this.hdrEnabled);
    if (this.ctx) this.ctx.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);
    if (this.catalog) {
      const k = this.catalog.k;
      for (let i = 0; i < this.catalog.count; i++) {
        this.catalog.colors[i] = aiHubKelvinToRGB(k[i] || 5500);
      }
    }
  }

  setStarGlow(value) {
    this.starGlow = aiHubNormalizeStarGlow(value);
  }

  dispose() {
    if (this.frameId) cancelAnimationFrame(this.frameId);
    if (this._onResize) window.removeEventListener("resize", this._onResize);
  }
}

window.AIHubRealStarfield = AIHubRealStarfield;
