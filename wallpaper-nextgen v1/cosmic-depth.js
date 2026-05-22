(function () {
  if (window.CosmicDepthLayer && window.ThreeStaticStarfieldLayer) return;

  class ThreeStaticStarfieldLayer {
    constructor(settings) {
      this.settings = settings || {};
      this.enabled = Boolean(window.THREE);
      this.time = Math.random() * 100;
      this.rafId = null;
      this.reducedMotion = window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches;

      if (!this.enabled) return;

      this.mouse = new THREE.Vector2(0.5, 0.5);
      this.targetMouse = new THREE.Vector2(0.5, 0.5);

      try {
        this._init();
      } catch (error) {
        this.enabled = false;
        console.warn("Three static starfield disabled:", error);
        this.dispose();
      }
    }

    _init() {
      this.renderer = new THREE.WebGLRenderer({
        alpha: true,
        antialias: false,
        preserveDrawingBuffer: true,
        powerPreference: "high-performance"
      });
      this.renderer.setClearColor(0x000000, 0);
      this.renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, this.reducedMotion ? 1 : 1.6));
      this.renderer.setSize(window.innerWidth, window.innerHeight, false);
      this.renderer.domElement.className = "three-starfield-layer";
      this.renderer.domElement.setAttribute("aria-hidden", "true");
      document.body.appendChild(this.renderer.domElement);

      this.scene = new THREE.Scene();
      this.camera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);
      this.geometry = this._createGeometry();
      this.material = this._createMaterial();
      this.points = new THREE.Points(this.geometry, this.material);
      this.points.frustumCulled = false;
      this.scene.add(this.points);

      this._onResize = () => this._resize();
      this._onPointerMove = (event) => {
        const w = Math.max(1, window.innerWidth);
        const h = Math.max(1, window.innerHeight);
        this.targetMouse.set(event.clientX / w, 1 - event.clientY / h);
      };
      window.addEventListener("resize", this._onResize);
      window.addEventListener("pointermove", this._onPointerMove, { passive: true });
      this._resize();
      this._render = this._render.bind(this);
      this._render();
    }

    _createGeometry() {
      const coreCount = this.reducedMotion ? 3000 : 7000;
      const deepCount = this.reducedMotion ? 1800 : 4800;
      const count = coreCount + deepCount;
      const positions = new Float32Array(count * 3);
      const colors = new Float32Array(count * 3);
      const seeds = new Float32Array(count);
      const sizes = new Float32Array(count);
      const depths = new Float32Array(count);
      const alphas = new Float32Array(count);
      const twinkles = new Float32Array(count * 2);
      // Hipparcos-ish distribution: 80% white-ish, 10% yellow, 5% orange, 5% blue.
      const palette = [
        [1.00, 1.00, 1.00], [1.00, 1.00, 1.00], [1.00, 1.00, 1.00], [1.00, 1.00, 1.00],
        [0.99, 0.99, 0.98], [0.99, 0.99, 0.98], [0.99, 0.99, 0.98], [0.99, 0.99, 0.98],
        [0.97, 0.98, 1.00], [0.97, 0.98, 1.00], [0.97, 0.98, 1.00], [0.97, 0.98, 1.00],
        [1.00, 0.99, 0.96], [1.00, 0.99, 0.96], [1.00, 0.99, 0.96], [1.00, 0.99, 0.96],
        [1.00, 0.91, 0.74], [1.00, 0.91, 0.74],
        [1.00, 0.76, 0.56],
        [0.73, 0.84, 1.00]
      ];
      const whiteTier = palette.slice(0, 16);

      for (let i = 0; i < count; i++) {
        const deepSky = i >= coreCount;
        const band = Math.random() < 0.38;
        const x = (Math.random() - 0.5) * 6.8;
        const y = band && !deepSky
          ? (Math.random() - 0.5) * 0.62 + Math.sin(x * 1.8) * 0.055
          : (Math.random() - 0.5) * 2.18;
        const depth = deepSky ? 0.74 + Math.random() * 0.26 : Math.pow(Math.random(), 0.62);
        const bright = !deepSky && Math.random() > 0.99;
        const size = deepSky
          ? 0.28 + Math.pow(Math.random(), 1.8) * 0.32
          : bright
            ? 1.42 + Math.random() * 0.34
            : 0.46 + Math.pow(Math.random(), 2.55) * 0.88;
        const color = deepSky && Math.random() < 0.78
          ? whiteTier[Math.floor(Math.random() * whiteTier.length)]
          : palette[Math.floor(Math.random() * palette.length)];

        positions[i * 3] = x;
        positions[i * 3 + 1] = Math.max(-1.2, Math.min(1.2, y));
        positions[i * 3 + 2] = 0;
        colors[i * 3] = color[0];
        colors[i * 3 + 1] = color[1];
        colors[i * 3 + 2] = color[2];
        seeds[i] = Math.random() * 1000;
        sizes[i] = size;
        depths[i] = depth;
        alphas[i] = deepSky ? 0.26 + Math.random() * 0.24 : 1;
        twinkles[i * 2] = deepSky ? 0.12 + Math.random() * 0.28 : 0.55 + depth * 1.8;
        twinkles[i * 2 + 1] = deepSky ? 0.07 + Math.random() * 0.11 : 0.28;
      }

      const geometry = new THREE.BufferGeometry();
      geometry.setAttribute("position", new THREE.BufferAttribute(positions, 3));
      geometry.setAttribute("aColor", new THREE.BufferAttribute(colors, 3));
      geometry.setAttribute("aSeed", new THREE.BufferAttribute(seeds, 1));
      geometry.setAttribute("aSize", new THREE.BufferAttribute(sizes, 1));
      geometry.setAttribute("aDepth", new THREE.BufferAttribute(depths, 1));
      geometry.setAttribute("aAlpha", new THREE.BufferAttribute(alphas, 1));
      geometry.setAttribute("aTwinkle", new THREE.BufferAttribute(twinkles, 2));
      return geometry;
    }

    _createMaterial() {
      return new THREE.ShaderMaterial({
        transparent: true,
        depthTest: false,
        depthWrite: false,
        blending: THREE.AdditiveBlending,
        uniforms: {
          uTime: { value: this.time },
          uMouse: { value: this.mouse.clone() },
          uPixelRatio: { value: Math.min(window.devicePixelRatio || 1, 1.6) },
          uBloom: { value: 1 },
          uGlow: { value: 1.7 },
          uWarp: { value: 0 },
          uRealSky: { value: 0 },
          uAudioBass: { value: 0 },
          uAudioHigh: { value: 0 },
          uAudioBeat: { value: 0 }
        },
        vertexShader: `
          attribute vec3 aColor;
          attribute float aSeed;
          attribute float aSize;
          attribute float aDepth;
          attribute float aAlpha;
          attribute vec2 aTwinkle;
          uniform float uTime;
          uniform vec2 uMouse;
          uniform float uPixelRatio;
          uniform float uBloom;
          uniform float uGlow;
          uniform float uWarp;
          uniform float uRealSky;
          uniform float uAudioBass;
          uniform float uAudioHigh;
          uniform float uAudioBeat;
          varying vec3 vColor;
          varying float vAlpha;
          varying float vBright;

          void main() {
            vec3 pos = position;
            vec4 mvPosition = modelViewMatrix * vec4(pos, 1.0);
            gl_Position = projectionMatrix * mvPosition;

            float twinkle = 1.0 - aTwinkle.y + aTwinkle.y * sin(uTime * aTwinkle.x + aSeed);
            vBright = smoothstep(1.28, 1.78, aSize);
            float glowLift = max(uGlow - 1.0, 0.0);
            float brightRank = pow(vBright, 1.9);
            float starBoost = 1.0 + glowLift * brightRank * 1.15 + uAudioHigh * brightRank * 0.42 + uAudioBeat * brightRank * 0.32;
            float dimLift = 1.0 + (1.0 - brightRank) * 0.18;
            vAlpha = aAlpha * (0.42 + (1.0 - aDepth) * 0.52) * twinkle * (1.0 - uWarp) * starBoost * dimLift * (1.0 - uRealSky);
            vColor = aColor * (0.96 + vBright * uBloom * 0.22) * (1.0 + glowLift * brightRank * 0.26 + uAudioHigh * 0.18);
            gl_PointSize = max(0.78 * uPixelRatio, aSize * uPixelRatio * (0.90 + (1.0 - aDepth) * 0.34) * (1.0 + vBright * uBloom * (0.18 + glowLift * 0.14) + uAudioBass * brightRank * 0.32 + uAudioBeat * brightRank * 0.24));
          }
        `,
        fragmentShader: `
          precision highp float;
          uniform float uBloom;
          uniform float uGlow;
          uniform float uAudioHigh;
          uniform float uAudioBeat;
          varying vec3 vColor;
          varying float vAlpha;
          varying float vBright;

          void main() {
            vec2 p = gl_PointCoord - 0.5;
            float d = length(p);
            // Adaptive core: dim stars (small sprites) keep wider fall-off so they read as solid pixels;
            // bright stars (big sprites) get tighter pinpoint so they don't smear into cotton-ball blobs.
            float coreRange = mix(0.40, 0.16, vBright);
            float core = smoothstep(coreRange, 0.0, d);
            float glowLift = max(uGlow - 1.0, 0.0);
            float brightRank = pow(vBright, 1.6);
            // Halo & bloom pulled in so they read as a ring around a hot center, not the body of the star.
            float halo = smoothstep(0.50, 0.20, d) * vBright * (0.06 + uBloom * (0.06 + brightRank * glowLift * 0.10));
            float bloom = smoothstep(0.50, 0.26, d) * vBright * uBloom * (0.16 + brightRank * glowLift * 0.28 + uAudioHigh * 0.18 + uAudioBeat * 0.12);
            // Pure-white sub-pixel anchor — eye reads bright stars as a point, not a blob.
            float hot = smoothstep(0.08, 0.0, d) * brightRank;
            float alpha = (core + halo + bloom + hot * 0.5) * vAlpha;
            if (alpha <= 0.003) discard;
            vec3 finalColor = vColor * (core + halo * 0.95 + bloom * 0.55) + vec3(1.0) * hot * 0.6;
            gl_FragColor = vec4(finalColor, alpha);
          }
        `
      });
    }

    _resize() {
      if (!this.renderer || !this.camera || !this.material) return;
      const w = window.innerWidth;
      const h = window.innerHeight;
      const aspect = w / Math.max(1, h);
      this.renderer.setSize(w, h, false);
      this.camera.left = -aspect;
      this.camera.right = aspect;
      this.camera.top = 1;
      this.camera.bottom = -1;
      this.camera.updateProjectionMatrix();
      this.material.uniforms.uPixelRatio.value = Math.min(window.devicePixelRatio || 1, 1.6);
    }

    updateSettings(settings) {
      this.settings = settings || this.settings;
    }

    _render() {
      if (!this.enabled || !this.renderer || !this.material) return;

      const active = this.settings.threeStars !== false && this.settings.cosmicDepth !== false;
      const warp = this.settings.warp === true || document.body.classList.contains("warp-mode");
      this.renderer.domElement.classList.toggle("hidden", !active);
      this.renderer.domElement.classList.toggle("warp", warp);

      this.time += this.reducedMotion ? 0.004 : 0.014;
      this.mouse.lerp(this.targetMouse, this.reducedMotion ? 0.025 : 0.055);
      this.material.uniforms.uTime.value = this.time;
      this.material.uniforms.uMouse.value.copy(this.mouse);
      this.material.uniforms.uBloom.value = this.settings.bloom === false ? 0 : 1;
      this.material.uniforms.uGlow.value = Math.min(4, Math.max(0.8, Number(this.settings.starGlow) || 1.7));
      this.material.uniforms.uWarp.value = warp ? 1 : 0;
      this.material.uniforms.uRealSky.value = (this.settings.realSky === true || this.settings.webgpuStarsActive === true) ? 1 : 0;
      const audio = this.settings.audioReactive && window.aiHubAudioLevels ? window.aiHubAudioLevels() : { bass: 0, high: 0, beat: 0 };
      this.material.uniforms.uAudioBass.value = audio.bass || 0;
      this.material.uniforms.uAudioHigh.value = audio.high || 0;
      this.material.uniforms.uAudioBeat.value = audio.beat || 0;

      if (active) this.renderer.render(this.scene, this.camera);
      this.rafId = requestAnimationFrame(this._render);
    }

    dispose() {
      if (this.rafId) cancelAnimationFrame(this.rafId);
      if (this._onResize) window.removeEventListener("resize", this._onResize);
      if (this._onPointerMove) window.removeEventListener("pointermove", this._onPointerMove);
      if (this.geometry) this.geometry.dispose();
      if (this.material) this.material.dispose();
      if (this.renderer) {
        const canvas = this.renderer.domElement;
        this.renderer.dispose();
        if (canvas && canvas.parentNode) canvas.parentNode.removeChild(canvas);
      }
    }
  }

  class CosmicDepthLayer {
    constructor(settings) {
      this.settings = settings || {};
      this.enabled = Boolean(window.THREE);
      this.time = Math.random() * 100;
      this.rafId = null;
      this.reducedMotion = window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches;

      if (!this.enabled) return;

      this.mouse = new THREE.Vector2(0.5, 0.5);
      this.targetMouse = new THREE.Vector2(0.5, 0.5);

      try {
        this._init();
      } catch (error) {
        this.enabled = false;
        console.warn("Cosmic depth layer disabled:", error);
        this.dispose();
      }
    }

    _init() {
      this.renderer = new THREE.WebGLRenderer({
        alpha: true,
        antialias: false,
        powerPreference: "high-performance"
      });
      this.renderer.setClearColor(0x000000, 0);
      this.renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, this.reducedMotion ? 1 : 1.5));
      this.renderer.setSize(window.innerWidth, window.innerHeight, false);
      this.renderer.domElement.className = "cosmic-depth-layer";
      this.renderer.domElement.setAttribute("aria-hidden", "true");
      document.body.appendChild(this.renderer.domElement);

      this.scene = new THREE.Scene();
      this.camera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);
      this.material = this._createMaterial();
      this.mesh = new THREE.Mesh(new THREE.PlaneGeometry(2, 2), this.material);
      this.scene.add(this.mesh);

      this._onResize = () => this._resize();
      this._onPointerMove = (event) => {
        const w = Math.max(1, window.innerWidth);
        const h = Math.max(1, window.innerHeight);
        this.targetMouse.set(event.clientX / w, 1 - event.clientY / h);
      };
      window.addEventListener("resize", this._onResize);
      window.addEventListener("pointermove", this._onPointerMove, { passive: true });
      this._render = this._render.bind(this);
      this._render();
    }

    _createMaterial() {
      return new THREE.ShaderMaterial({
        transparent: true,
        depthTest: false,
        depthWrite: false,
        blending: THREE.NormalBlending,
        uniforms: {
          uResolution: { value: new THREE.Vector2(window.innerWidth, window.innerHeight) },
          uMouse: { value: this.mouse.clone() },
          uTime: { value: this.time },
          uDepth: { value: 0 },
          uNebula: { value: 1 },
          uPlanet: { value: 1 },
          uLens: { value: 1 },
          uBloom: { value: 1 },
          uGlow: { value: 1.7 },
          uWarp: { value: 0 },
          uRealSky: { value: 0 },
          uAudioBass: { value: 0 },
          uAudioHigh: { value: 0 },
          uAudioBeat: { value: 0 }
        },
        vertexShader: `
          varying vec2 vUv;

          void main() {
            vUv = uv;
            gl_Position = vec4(position.xy, 0.0, 1.0);
          }
        `,
        fragmentShader: `
          precision highp float;

          uniform vec2 uResolution;
          uniform vec2 uMouse;
          uniform float uTime;
          uniform float uDepth;
          uniform float uNebula;
          uniform float uPlanet;
          uniform float uLens;
          uniform float uBloom;
          uniform float uGlow;
          uniform float uWarp;
          uniform float uRealSky;
          uniform float uAudioBass;
          uniform float uAudioHigh;
          uniform float uAudioBeat;
          varying vec2 vUv;

          float hash(vec2 p) {
            p = fract(p * vec2(123.34, 456.21));
            p += dot(p, p + 45.32);
            return fract(p.x * p.y);
          }

          float noise(vec2 p) {
            vec2 i = floor(p);
            vec2 f = fract(p);
            vec2 u = f * f * (3.0 - 2.0 * f);
            float a = hash(i);
            float b = hash(i + vec2(1.0, 0.0));
            float c = hash(i + vec2(0.0, 1.0));
            float d = hash(i + vec2(1.0, 1.0));
            return mix(mix(a, b, u.x), mix(c, d, u.x), u.y);
          }

          float fbm(vec2 p) {
            float value = 0.0;
            float amp = 0.5;
            for (int i = 0; i < 5; i++) {
              value += amp * noise(p);
              p = p * 2.02 + vec2(17.7, 9.2);
              amp *= 0.52;
            }
            return value;
          }

          void main() {
            vec2 uv = vUv;
            float aspect = uResolution.x / max(uResolution.y, 1.0);
            vec2 p = (uv - 0.5) * vec2(aspect, 1.0);
            vec2 mouse = (uMouse - 0.5) * vec2(aspect, 1.0);
            vec2 parallax = uMouse - 0.5;
            float depth = clamp(uDepth, 0.0, 0.35);
            float glow = clamp(uGlow, 0.8, 4.0);
            float glowLift = max(glow - 1.0, 0.0);
            float nebulaOn = uNebula * (1.0 - uWarp * 0.35) * (1.0 + uAudioBass * 0.18);

            vec2 slowField = p * 2.05 + vec2(uTime * 0.014, -uTime * 0.008) + parallax * vec2(0.28, -0.18);
            vec2 farField = p * 4.1 + vec2(-uTime * 0.009, uTime * 0.012) - parallax * vec2(0.42, 0.22);
            float coldNoise = fbm(slowField);
            float warmNoise = fbm(farField);
            float coldVeil = smoothstep(0.56, 0.91, coldNoise) * nebulaOn;
            float warmVeil = smoothstep(0.64, 0.95, warmNoise) * nebulaOn;

            vec3 color = vec3(0.0);
            float alpha = 0.0;

            color += vec3(0.08, 0.22, 0.34) * coldVeil * (0.10 + depth * 0.22 + uAudioHigh * 0.03);
            color += vec3(0.28, 0.11, 0.08) * warmVeil * (0.05 + depth * 0.08 + uAudioBass * 0.025);
            alpha += coldVeil * (0.020 + depth * 0.045 + uAudioHigh * 0.006);
            alpha += warmVeil * (0.012 + uAudioBass * 0.004);

            vec2 planetCenter = vec2(0.59, 0.42) + parallax * vec2(-0.035, 0.022);
            vec2 planetP = (uv - planetCenter) * vec2(aspect, 1.0);
            float planetDist = length(planetP);
            float planetRadius = 0.172;
            float planetBody = 1.0 - smoothstep(planetRadius, planetRadius + 0.008, planetDist);
            float planetShade = smoothstep(-0.18, 0.32, planetP.x + planetP.y * 0.25);
            float planetRim = (1.0 - smoothstep(planetRadius, planetRadius + 0.028, planetDist)) * smoothstep(planetRadius - 0.02, planetRadius + 0.004, planetDist);
            vec3 planetColor = mix(vec3(0.0, 0.002, 0.005), vec3(0.010, 0.025, 0.038), planetShade);
            color = mix(color, planetColor, planetBody * 0.34 * uPlanet);
            color += vec3(0.07, 0.20, 0.30) * planetRim * 0.08 * uPlanet;
            alpha += planetBody * 0.075 * uPlanet + planetRim * 0.03 * uPlanet;

            vec2 starUv = uv + parallax * 0.018 + vec2(uTime * 0.0006, -uTime * 0.0004);
            vec2 cells = vec2(92.0 * aspect, 92.0);
            vec2 id = floor(starUv * cells);
            vec2 gv = fract(starUv * cells) - 0.5;
            float rnd = hash(id);
            float twinkle = 0.65 + 0.35 * sin(uTime * (0.8 + rnd * 3.2) + rnd * 6.28318);
            float chosen = step(0.996, rnd);
            float starRank = smoothstep(0.996, 0.9997, rnd);
            float starBoost = 1.0 + glowLift * starRank * 2.2 + uAudioHigh * starRank * 0.55 + uAudioBeat * starRank * 0.4;
            float starsVisible = 1.0 - uRealSky;
            float core = smoothstep(0.052, 0.0, length(gv)) * chosen * twinkle * starBoost * starsVisible;
            float halo = smoothstep(0.24, 0.0, length(gv)) * chosen * 0.18 * twinkle * uBloom * starBoost * (0.75 + starRank * 0.5 + uAudioHigh * 0.35) * starsVisible;
            color += vec3(0.42, 0.62, 0.86) * (core * 0.28 + halo * 0.14);
            alpha += core * 0.24 + halo * 0.075;

            float mouseDist = length(p - mouse);
            float lensCore = exp(-mouseDist * mouseDist * 28.0) * uLens * (1.0 - uWarp * 0.55);
            float lensRing = (1.0 - smoothstep(0.18, 0.28, abs(mouseDist - 0.19))) * 0.018 * uLens;
            color += vec3(0.12, 0.30, 0.46) * lensCore * 0.06;
            color += vec3(0.18, 0.42, 0.58) * lensRing;
            alpha += lensCore * 0.025 + lensRing;

            color *= 1.0 - depth * 0.35;
            alpha = clamp(alpha, 0.0, 0.14);
            gl_FragColor = vec4(color, alpha);
          }
        `
      });
    }

    _resize() {
      if (!this.renderer || !this.material) return;
      const w = window.innerWidth;
      const h = window.innerHeight;
      this.renderer.setSize(w, h, false);
      this.material.uniforms.uResolution.value.set(w, h);
    }

    updateSettings(settings) {
      this.settings = settings || this.settings;
    }

    _render() {
      if (!this.enabled || !this.renderer || !this.material) return;

      const active = this.settings.cosmicDepth !== false;
      const warp = this.settings.warp === true || document.body.classList.contains("warp-mode");
      this.renderer.domElement.classList.toggle("hidden", !active);
      this.renderer.domElement.classList.toggle("warp", warp);

      this.time += this.reducedMotion ? 0.003 : 0.012;
      this.mouse.lerp(this.targetMouse, this.reducedMotion ? 0.025 : 0.055);

      this.material.uniforms.uMouse.value.copy(this.mouse);
      this.material.uniforms.uTime.value = this.time;
      this.material.uniforms.uDepth.value = Number(this.settings.bgDim) || 0;
      this.material.uniforms.uNebula.value = this.settings.nebula === false ? 0.22 : 1;
      this.material.uniforms.uPlanet.value = this.settings.planet === false ? 0 : 1;
      this.material.uniforms.uLens.value = this.settings.cursorLens === false ? 0 : 1;
      this.material.uniforms.uBloom.value = this.settings.bloom === false ? 0 : 1;
      this.material.uniforms.uGlow.value = Math.min(4, Math.max(0.8, Number(this.settings.starGlow) || 1.7));
      this.material.uniforms.uWarp.value = warp ? 1 : 0;
      this.material.uniforms.uRealSky.value = (this.settings.realSky === true || this.settings.webgpuStarsActive === true) ? 1 : 0;
      const audio = this.settings.audioReactive && window.aiHubAudioLevels ? window.aiHubAudioLevels() : { bass: 0, high: 0, beat: 0 };
      this.material.uniforms.uAudioBass.value = audio.bass || 0;
      this.material.uniforms.uAudioHigh.value = audio.high || 0;
      this.material.uniforms.uAudioBeat.value = audio.beat || 0;

      if (active) this.renderer.render(this.scene, this.camera);
      this.rafId = requestAnimationFrame(this._render);
    }

    dispose() {
      if (this.rafId) cancelAnimationFrame(this.rafId);
      if (this._onResize) window.removeEventListener("resize", this._onResize);
      if (this._onPointerMove) window.removeEventListener("pointermove", this._onPointerMove);
      if (this.mesh && this.mesh.geometry) this.mesh.geometry.dispose();
      if (this.material) this.material.dispose();
      if (this.renderer) {
        const canvas = this.renderer.domElement;
        this.renderer.dispose();
        if (canvas && canvas.parentNode) canvas.parentNode.removeChild(canvas);
      }
    }
  }

  window.ThreeStaticStarfieldLayer = ThreeStaticStarfieldLayer;
  window.CosmicDepthLayer = CosmicDepthLayer;
})();
