// Real constellation overlay. Coordinates are approximate J2000 anchors for
// recognizable constellation line art, projected for the current observer.

(function () {
  const DEG = Math.PI / 180;
  const HOUR = Math.PI / 12;
  const TAU = Math.PI * 2;
  const DEFAULT_LAT = 41.31;
  const DEFAULT_LON = 69.24;
  const CONSTELLATION_ALPHA_SCALE = 0.0416667;
  const CONSTELLATION_SEQUENCE_STEP = 5;

  function star(raHours, decDeg) {
    return {
      ra: raHours * HOUR,
      dec: decDeg * DEG
    };
  }

  const CONSTELLATIONS = [
    {
      name: "Ursa Major",
      label: "alioth",
      stars: {
        dubhe: star(11.062, 61.75),
        merak: star(11.017, 56.38),
        phecda: star(11.900, 53.69),
        megrez: star(12.250, 57.03),
        alioth: star(12.900, 55.96),
        mizar: star(13.400, 54.93),
        alkaid: star(13.800, 49.31)
      },
      lines: [
        ["merak", "dubhe"],
        ["merak", "phecda"],
        ["phecda", "megrez"],
        ["megrez", "dubhe"],
        ["megrez", "alioth"],
        ["alioth", "mizar"],
        ["mizar", "alkaid"]
      ]
    },
    {
      name: "Cassiopeia",
      label: "gamma",
      stars: {
        caph: star(0.150, 59.15),
        schedar: star(0.683, 56.54),
        gamma: star(0.950, 60.72),
        ruchbah: star(1.433, 60.24),
        segin: star(1.900, 63.67)
      },
      lines: [
        ["caph", "schedar"],
        ["schedar", "gamma"],
        ["gamma", "ruchbah"],
        ["ruchbah", "segin"]
      ]
    },
    {
      name: "Orion",
      label: "alnilam",
      stars: {
        betelgeuse: star(5.917, 7.40),
        bellatrix: star(5.417, 6.35),
        mintaka: star(5.533, -0.30),
        alnilam: star(5.600, -1.20),
        alnitak: star(5.683, -1.94),
        saiph: star(5.800, -9.67),
        rigel: star(5.250, -8.20)
      },
      lines: [
        ["betelgeuse", "bellatrix"],
        ["betelgeuse", "mintaka"],
        ["bellatrix", "mintaka"],
        ["mintaka", "alnilam"],
        ["alnilam", "alnitak"],
        ["alnitak", "saiph"],
        ["saiph", "rigel"],
        ["rigel", "mintaka"]
      ]
    },
    {
      name: "Cygnus",
      label: "sadr",
      stars: {
        deneb: star(20.683, 45.28),
        sadr: star(20.367, 40.26),
        gienah: star(20.767, 33.97),
        delta: star(19.750, 45.13),
        albireo: star(19.517, 27.96)
      },
      lines: [
        ["deneb", "sadr"],
        ["sadr", "gienah"],
        ["sadr", "delta"],
        ["sadr", "albireo"]
      ]
    },
    {
      name: "Lyra",
      label: "vega",
      stars: {
        vega: star(18.617, 38.78),
        epsilon: star(18.733, 39.67),
        delta: star(18.900, 36.90),
        sheliak: star(18.833, 33.36),
        sulafat: star(18.983, 32.69)
      },
      lines: [
        ["vega", "epsilon"],
        ["epsilon", "delta"],
        ["delta", "sulafat"],
        ["sulafat", "sheliak"],
        ["sheliak", "epsilon"]
      ]
    },
    {
      name: "Aquila",
      label: "altair",
      stars: {
        altair: star(19.850, 8.87),
        tarazed: star(19.767, 10.61),
        alshain: star(19.917, 6.41),
        deneb_el_okab: star(19.083, 13.86),
        lambda: star(19.100, -4.88)
      },
      lines: [
        ["tarazed", "altair"],
        ["altair", "alshain"],
        ["deneb_el_okab", "altair"],
        ["altair", "lambda"]
      ]
    },
    {
      name: "Scorpius",
      label: "antares",
      stars: {
        acrab: star(16.083, -19.80),
        dschubba: star(16.000, -22.62),
        antares: star(16.483, -26.43),
        wei: star(16.833, -34.29),
        shaula: star(17.567, -37.10),
        lesath: star(17.517, -37.30),
        sargas: star(17.617, -42.99)
      },
      lines: [
        ["acrab", "dschubba"],
        ["dschubba", "antares"],
        ["antares", "wei"],
        ["wei", "shaula"],
        ["shaula", "lesath"],
        ["lesath", "sargas"]
      ]
    },
    {
      name: "Leo",
      label: "regulus",
      stars: {
        regulus: star(10.133, 11.97),
        algieba: star(10.333, 19.84),
        adhafera: star(10.283, 23.42),
        rasalas: star(9.867, 26.00),
        denebola: star(11.817, 14.57),
        zosma: star(11.233, 20.52),
        chertan: star(11.233, 15.43)
      },
      lines: [
        ["regulus", "algieba"],
        ["algieba", "adhafera"],
        ["adhafera", "rasalas"],
        ["algieba", "zosma"],
        ["zosma", "denebola"],
        ["denebola", "chertan"],
        ["chertan", "regulus"]
      ]
    },
    {
      name: "Bootes",
      label: "arcturus",
      stars: {
        arcturus: star(14.267, 19.18),
        nekkar: star(15.033, 40.39),
        seginus: star(14.533, 38.31),
        izar: star(14.750, 27.07),
        muphrid: star(13.917, 18.40)
      },
      lines: [
        ["arcturus", "izar"],
        ["izar", "seginus"],
        ["seginus", "nekkar"],
        ["izar", "muphrid"],
        ["muphrid", "arcturus"]
      ]
    },
    {
      name: "Corona Borealis",
      label: "alphecca",
      stars: {
        alphecca: star(15.583, 26.71),
        nusakan: star(15.450, 29.10),
        theta: star(15.550, 31.36),
        delta: star(15.817, 26.07),
        gamma: star(15.717, 26.30),
        epsilon: star(15.967, 26.88)
      },
      lines: [
        ["nusakan", "theta"],
        ["theta", "alphecca"],
        ["alphecca", "gamma"],
        ["gamma", "delta"],
        ["delta", "epsilon"]
      ]
    },
    {
      name: "Pegasus",
      label: "scheat",
      stars: {
        markab: star(23.083, 15.20),
        scheat: star(23.067, 28.08),
        algenib: star(0.217, 15.18),
        alpheratz: star(0.133, 29.09),
        enif: star(21.733, 9.88)
      },
      lines: [
        ["markab", "scheat"],
        ["scheat", "alpheratz"],
        ["alpheratz", "algenib"],
        ["algenib", "markab"],
        ["markab", "enif"]
      ]
    },
    {
      name: "Andromeda",
      label: "mirach",
      stars: {
        alpheratz: star(0.133, 29.09),
        mirach: star(1.167, 35.62),
        almach: star(2.067, 42.33),
        mu: star(0.950, 38.50)
      },
      lines: [
        ["alpheratz", "mirach"],
        ["mirach", "almach"],
        ["mirach", "mu"]
      ]
    },
    {
      name: "Taurus",
      label: "aldebaran",
      stars: {
        aldebaran: star(4.600, 16.51),
        elnath: star(5.433, 28.61),
        zeta: star(5.633, 21.14),
        alcyone: star(3.783, 24.11)
      },
      lines: [
        ["alcyone", "aldebaran"],
        ["aldebaran", "elnath"],
        ["aldebaran", "zeta"]
      ]
    },
    {
      name: "Gemini",
      label: "pollux",
      stars: {
        castor: star(7.583, 31.89),
        pollux: star(7.750, 28.03),
        alhena: star(6.633, 16.40),
        wasat: star(7.333, 21.98),
        mebsuta: star(6.733, 25.13)
      },
      lines: [
        ["castor", "mebsuta"],
        ["mebsuta", "wasat"],
        ["wasat", "alhena"],
        ["pollux", "wasat"]
      ]
    }
  ];

  const CONSTELLATION_TIMING = CONSTELLATIONS.map((_, index) => {
    const visible = 11000 + ((index * 4211) % 9000);
    const gap = 12000 + ((index * 2953 + 1700) % 18000);
    const fade = Math.min(5200, Math.max(2800, visible * 0.28 + (index % 4) * 360));
    return {
      visible,
      gap,
      fade,
      total: visible + gap
    };
  });
  const CONSTELLATION_TIMELINE_MS = CONSTELLATION_TIMING.reduce((sum, timing) => sum + timing.total, 0);

  class AIHubRealConstellationLayer {
    constructor(options = {}) {
      this.canvas = document.createElement("canvas");
      this.canvas.className = "real-constellation-canvas";
      this.canvas.setAttribute("aria-hidden", "true");
      this.canvas.style.position = "fixed";
      this.canvas.style.inset = "0";
      this.canvas.style.width = "100%";
      this.canvas.style.height = "100%";
      this.canvas.style.zIndex = "1";
      this.canvas.style.pointerEvents = "none";
      this.canvas.style.background = "transparent";
      this.canvas.style.mixBlendMode = "screen";
      this.canvas.style.opacity = "0.82";
      this.canvas.style.transition = "opacity 0.25s ease";
      document.body.appendChild(this.canvas);

      this.hdrEnabled = options.hdr !== false;
      this.ctx = typeof aiHubGet2dContext === "function"
        ? aiHubGet2dContext(this.canvas, this.hdrEnabled)
        : this.canvas.getContext("2d");
      this.settings = options.settings || {};
      this.enabled = options.enabled !== false;
      this.lat = Number.isFinite(options.lat) ? options.lat : DEFAULT_LAT;
      this.lon = Number.isFinite(options.lon) ? options.lon : DEFAULT_LON;
      this.reducedMotion = window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
      this.dpr = 1;
      this.frameId = 0;
      this.lastLayoutWidth = 0;
      this.lastLayoutHeight = 0;

      this._onResize = () => this._resize();
      window.addEventListener("resize", this._onResize);
      this._resize();
      this._tick = this._tick.bind(this);
      this.frameId = requestAnimationFrame(this._tick);
    }

    _color(r, g, b, alpha) {
      if (typeof aiHubCanvasColor === "function") {
        return aiHubCanvasColor(r, g, b, alpha, this.hdrEnabled);
      }
      return `rgba(${Math.round(r)}, ${Math.round(g)}, ${Math.round(b)}, ${Math.max(0, Math.min(1, alpha))})`;
    }

    _resize() {
      const w = window.innerWidth;
      const h = window.innerHeight;
      this.dpr = Math.min(window.devicePixelRatio || 1, this.reducedMotion ? 1 : 1.55);
      this.canvas.width = Math.max(1, Math.round(w * this.dpr));
      this.canvas.height = Math.max(1, Math.round(h * this.dpr));
      this.canvas.style.width = w + "px";
      this.canvas.style.height = h + "px";
      if (this.ctx) this.ctx.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);
      this.lastLayoutWidth = w;
      this.lastLayoutHeight = h;
    }

    _shouldDraw() {
      return this.enabled;
    }

    _smoothstep(value) {
      const t = Math.min(1, Math.max(0, value));
      return t * t * (3 - 2 * t);
    }

    _activeConstellationState(now) {
      const motionScale = this.reducedMotion ? 1.35 : 1;
      let t = now % (CONSTELLATION_TIMELINE_MS * motionScale);
      for (let slotIndex = 0; slotIndex < CONSTELLATION_TIMING.length; slotIndex++) {
        const timing = CONSTELLATION_TIMING[slotIndex];
        const visible = timing.visible * motionScale;
        const gap = timing.gap * motionScale;
        const total = visible + gap;
        if (t >= total) {
          t -= total;
          continue;
        }
        if (t >= visible) return { index: -1, visibility: 0 };
        const fade = Math.min(timing.fade * motionScale, visible / 2);
        let visibility = 1;
        if (t < fade) visibility = this._smoothstep(t / fade);
        else if (t > visible - fade) visibility = this._smoothstep((visible - t) / fade);
        return {
          index: (slotIndex * CONSTELLATION_SEQUENCE_STEP) % CONSTELLATIONS.length,
          visibility
        };
      }
      return { index: -1, visibility: 0 };
    }

    _project(eq, latRad, lst, w, h) {
      if (typeof aiHubEqToAltAz !== "function") return null;
      const horizontal = aiHubEqToAltAz(eq.ra, eq.dec, latRad, lst);
      const altMin = -4 * DEG;
      const altMax = 88 * DEG;
      if (horizontal.alt < altMin || horizontal.alt > altMax) return null;

      let dAz = horizontal.az - Math.PI;
      if (dAz > Math.PI) dAz -= TAU;
      else if (dAz < -Math.PI) dAz += TAU;

      const realSkyProjection = this.settings && this.settings.realSky === true;
      const fovH = realSkyProjection ? 135 * DEG : TAU;
      if (realSkyProjection && (dAz < -fovH / 2 || dAz > fovH / 2)) return null;

      return {
        x: (dAz / fovH + 0.5) * w,
        y: (1 - (horizontal.alt - altMin) / (altMax - altMin)) * h,
        altitude: horizontal.alt
      };
    }

    _drawWrappedLine(ctx, a, b, width, wrap) {
      let x1 = a.x;
      let x2 = b.x;
      const y1 = a.y;
      const y2 = b.y;
      if (wrap && Math.abs(x1 - x2) > width * 0.5) {
        if (x1 < x2) x1 += width;
        else x2 += width;
      }

      ctx.moveTo(x1, y1);
      ctx.lineTo(x2, y2);
      if (x1 > width || x2 > width) {
        ctx.moveTo(x1 - width, y1);
        ctx.lineTo(x2 - width, y2);
      }
      if (x1 < 0 || x2 < 0) {
        ctx.moveTo(x1 + width, y1);
        ctx.lineTo(x2 + width, y2);
      }
    }

    _drawNode(ctx, point, pulse, visibility) {
      const horizonFade = Math.min(1, Math.max(0.28, point.altitude / (18 * DEG)));
      const alpha = (0.26 + pulse * 0.08) * horizonFade * visibility * CONSTELLATION_ALPHA_SCALE;
      ctx.fillStyle = this._color(210, 232, 255, alpha);
      ctx.beginPath();
      ctx.arc(point.x, point.y, 1.15, 0, TAU);
      ctx.fill();
    }

    _drawLabel(ctx, constellation, point, pulse, w, visibility) {
      if (!point || this.reducedMotion) return;
      if (w < 760) return;
      const alpha = (0.16 + pulse * 0.05) * visibility * CONSTELLATION_ALPHA_SCALE;
      ctx.font = "600 10px Orbitron, system-ui, sans-serif";
      ctx.letterSpacing = "0";
      ctx.fillStyle = this._color(154, 196, 230, alpha);
      ctx.fillText(constellation.name.toUpperCase(), point.x + 8, point.y - 8);
    }

    _tick() {
      this.frameId = requestAnimationFrame(this._tick);
      if (!this.ctx) return;
      const w = window.innerWidth;
      const h = window.innerHeight;
      if (w !== this.lastLayoutWidth || h !== this.lastLayoutHeight) this._resize();

      const ctx = this.ctx;
      ctx.clearRect(0, 0, w, h);
      if (!this._shouldDraw()) return;
      if (typeof aiHubJulianDay !== "function" || typeof aiHubGMST !== "function" || typeof aiHubLST !== "function") return;

      const now = Date.now();
      const jd = aiHubJulianDay(now);
      const lst = aiHubLST(aiHubGMST(jd), this.lon * DEG);
      const latRad = this.lat * DEG;
      const pulse = 0.5 + 0.5 * Math.sin(now / 5200);
      const warpMode = this.settings && this.settings.warp === true;
      const modeAlpha = warpMode ? 0.58 : 1;
      const lineAlpha = (this.hdrEnabled ? 0.22 + pulse * 0.045 : 0.18 + pulse * 0.035) * modeAlpha * CONSTELLATION_ALPHA_SCALE;
      const wrapLines = !(this.settings && this.settings.realSky === true);

      ctx.save();
      ctx.globalCompositeOperation = "screen";
      ctx.lineCap = "round";
      ctx.lineJoin = "round";

      const active = this._activeConstellationState(now);
      if (active.index >= 0 && active.visibility > 0.01) {
        const constellation = CONSTELLATIONS[active.index];
        const visibility = active.visibility;

        const projected = {};
        for (const [id, coords] of Object.entries(constellation.stars)) {
          const point = this._project(coords, latRad, lst, w, h);
          if (point) projected[id] = point;
        }

        ctx.beginPath();
        let segmentCount = 0;
        ctx.lineWidth = 0.65 + visibility * 0.2;
        ctx.strokeStyle = this._color(138, 194, 244, lineAlpha * visibility);
        ctx.shadowColor = this._color(90, 160, 255, 0.18 * visibility * CONSTELLATION_ALPHA_SCALE);
        ctx.shadowBlur = (this.hdrEnabled ? 5 : 3) * visibility;
        for (const [from, to] of constellation.lines) {
          const a = projected[from];
          const b = projected[to];
          if (!a || !b) continue;
          this._drawWrappedLine(ctx, a, b, w, wrapLines);
          segmentCount++;
        }
        if (segmentCount > 0) ctx.stroke();
        if (segmentCount > 0) {
          ctx.shadowBlur = 0;
          for (const id of Object.keys(projected)) {
            this._drawNode(ctx, projected[id], pulse, visibility);
          }
          this._drawLabel(ctx, constellation, projected[constellation.label], pulse, w, visibility);
        }
      }

      ctx.restore();
    }

    updateSettings(settings = {}) {
      this.settings = settings;
      this.enabled = settings.constellations !== false;
    }

    setLocation(lat, lon) {
      if (Number.isFinite(lat)) this.lat = lat;
      if (Number.isFinite(lon)) this.lon = lon;
    }

    setHDR(enabled) {
      this.hdrEnabled = enabled !== false;
      this.ctx = typeof aiHubGet2dContext === "function"
        ? aiHubGet2dContext(this.canvas, this.hdrEnabled)
        : this.canvas.getContext("2d");
      if (this.ctx) this.ctx.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);
    }

    dispose() {
      if (this.frameId) cancelAnimationFrame(this.frameId);
      if (this._onResize) window.removeEventListener("resize", this._onResize);
      if (this.canvas && this.canvas.parentNode) this.canvas.parentNode.removeChild(this.canvas);
    }
  }

  window.AIHubRealConstellationLayer = AIHubRealConstellationLayer;
})();
