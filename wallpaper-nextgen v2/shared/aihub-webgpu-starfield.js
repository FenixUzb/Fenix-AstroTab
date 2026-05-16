// AIHubWebGPUStarfield — procedural stars on WebGPU.
// Each star lives in a storage buffer (48 bytes = pos2 + vel2 + color4 + extras4).
// A compute pass advances positions every frame; a render pass draws instanced quads
// with additive blending and radial alpha falloff.
// Falls back silently on platforms without navigator.gpu — `supported` stays false.

const AIHUB_WEBGPU_FLOATS_PER_STAR = 12;
const AIHUB_WEBGPU_STAR_BYTES = AIHUB_WEBGPU_FLOATS_PER_STAR * 4;

class AIHubWebGPUStarfield {
  constructor(canvas, options = {}) {
    this.canvas = canvas;
    this.enabled = options.enabled === true;
    this.hdrEnabled = options.hdr !== false;
    this.starGlow = aiHubNormalizeStarGlow(options.starGlow);
    this.count = Math.max(64, Math.min(200000, Number(options.count) || 50000));
    this.reducedMotion = window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    this.dpr = Math.min(window.devicePixelRatio || 1, this.reducedMotion ? 1 : 1.6);

    this.supported = false;
    this.device = null;
    this.context = null;
    this.format = null;
    this.computePipeline = null;
    this.renderPipeline = null;
    this.starBuffer = null;
    this.uniformBuffer = null;
    this.bindGroup = null;
    this.frameId = 0;
    this.lastFrameAt = 0;
    this.disposed = false;

    this._onResize = () => this._resize();
    window.addEventListener("resize", this._onResize);
    this._init();
  }

  async _init() {
    if (!navigator.gpu) return;
    try {
      const adapter = await navigator.gpu.requestAdapter();
      if (!adapter || this.disposed) return;
      const device = await adapter.requestDevice();
      if (this.disposed) { device.destroy(); return; }
      const context = this.canvas.getContext("webgpu");
      if (!context) return;
      const format = navigator.gpu.getPreferredCanvasFormat();
      context.configure({
        device,
        format,
        alphaMode: "premultiplied",
        colorSpace: this.hdrEnabled ? "display-p3" : "srgb"
      });

      this.device = device;
      this.context = context;
      this.format = format;
      this._resize();

      const shader = device.createShaderModule({ code: AIHubWebGPUStarfield.WGSL });

      const bindGroupLayout = device.createBindGroupLayout({
        entries: [
          { binding: 0, visibility: GPUShaderStage.COMPUTE | GPUShaderStage.VERTEX, buffer: { type: "storage" } },
          { binding: 1, visibility: GPUShaderStage.COMPUTE | GPUShaderStage.VERTEX | GPUShaderStage.FRAGMENT, buffer: { type: "uniform" } }
        ]
      });
      const pipelineLayout = device.createPipelineLayout({ bindGroupLayouts: [bindGroupLayout] });

      this.computePipeline = device.createComputePipeline({
        layout: pipelineLayout,
        compute: { module: shader, entryPoint: "cs_main" }
      });
      this.renderPipeline = device.createRenderPipeline({
        layout: pipelineLayout,
        vertex: { module: shader, entryPoint: "vs_main" },
        fragment: {
          module: shader, entryPoint: "fs_main",
          targets: [{
            format,
            blend: {
              color: { srcFactor: "src-alpha", dstFactor: "one", operation: "add" },
              alpha: { srcFactor: "one",       dstFactor: "one", operation: "add" }
            }
          }]
        },
        primitive: { topology: "triangle-list" }
      });

      const initial = this._buildInitialStars();
      this.starBuffer = device.createBuffer({
        size: this.count * AIHUB_WEBGPU_STAR_BYTES,
        usage: GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_DST
      });
      device.queue.writeBuffer(this.starBuffer, 0, initial);

      this.uniformBuffer = device.createBuffer({
        size: 48,                                     // 12 floats: timing/size/glow + audio levels
        usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST
      });
      this.bindGroup = device.createBindGroup({
        layout: bindGroupLayout,
        entries: [
          { binding: 0, resource: { buffer: this.starBuffer } },
          { binding: 1, resource: { buffer: this.uniformBuffer } }
        ]
      });

      this.supported = true;
      this._tick = this._tick.bind(this);
      if (this.enabled) {
        this.lastFrameAt = performance.now();
        this.frameId = requestAnimationFrame(this._tick);
      }
    } catch (error) {
      console.warn("WebGPUStarfield init failed:", error);
      this.supported = false;
    }
  }

  _buildInitialStars() {
    const n = this.count;
    const data = new Float32Array(n * AIHUB_WEBGPU_FLOATS_PER_STAR);
    const TAU = Math.PI * 2;
    const warm = [1.0, 0.92, 0.78];
    const cool = [0.78, 0.86, 1.0];
    for (let i = 0; i < n; i++) {
      const o = i * AIHUB_WEBGPU_FLOATS_PER_STAR;
      const depth = 0.25 + Math.random() * 0.75;
      const angle = Math.random() * TAU;
      const driftSpeed = 0.012 * depth;        // screen-units per second
      // pos (uv: 0..1)
      data[o + 0] = Math.random();
      data[o + 1] = Math.random();
      // vel
      data[o + 2] = Math.cos(angle) * driftSpeed;
      data[o + 3] = Math.sin(angle) * driftSpeed;
      // color (vec4): RGB + size in pixel-space (DPR applied at draw time)
      const hue = Math.random();
      const tint = 0.65;                       // pull toward neutral white for low-light realism
      const r = 1.0 * tint + (warm[0] * (1 - hue) + cool[0] * hue) * (1 - tint);
      const g = 1.0 * tint + (warm[1] * (1 - hue) + cool[1] * hue) * (1 - tint);
      const b = 1.0 * tint + (warm[2] * (1 - hue) + cool[2] * hue) * (1 - tint);
      const mag = Math.pow(Math.random(), 3.7); // many tiny stars, few bright ones
      const intensity = 0.10 + mag * 0.90;
      const sizePx = 0.34 + Math.pow(intensity, 1.28) * 1.85;
      data[o + 4] = r;
      data[o + 5] = g;
      data[o + 6] = b;
      data[o + 7] = sizePx;
      // extras (vec4): intensity, twinkleSpeed, twinklePhase, depth
      data[o + 8]  = intensity;
      data[o + 9]  = 0.4 + Math.random() * 1.6;
      data[o + 10] = Math.random() * TAU;
      data[o + 11] = depth;
    }
    return data;
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
  }

  _tick() {
    if (this.disposed) { this.frameId = 0; return; }
    if (!this.supported || !this.enabled || !this.device) {
      // Stop pumping the loop while paused; setEnabled(true) restarts it.
      this.frameId = 0;
      return;
    }
    this.frameId = requestAnimationFrame(this._tick);

    const now = performance.now();
    const dt = Math.min(0.05, Math.max(0, (now - this.lastFrameAt) / 1000));
    this.lastFrameAt = now;

    const tSec = now / 1000;
    const lift = Math.max(0, this.starGlow - 1);
    const audio = window.aiHubAudioLevels ? window.aiHubAudioLevels() : { bass: 0, high: 0, beat: 0 };
    const uniforms = new Float32Array([
      tSec, dt, this.canvas.width, this.canvas.height,
      lift, this.dpr, this.count, this.reducedMotion ? 1 : 0,
      audio.bass || 0, audio.high || 0, audio.beat || 0, 0
    ]);
    this.device.queue.writeBuffer(this.uniformBuffer, 0, uniforms);

    const encoder = this.device.createCommandEncoder();

    // Compute pass: advance star positions.
    const cpass = encoder.beginComputePass();
    cpass.setPipeline(this.computePipeline);
    cpass.setBindGroup(0, this.bindGroup);
    cpass.dispatchWorkgroups(Math.ceil(this.count / 64));
    cpass.end();

    // Render pass: instanced quads.
    const view = this.context.getCurrentTexture().createView();
    const rpass = encoder.beginRenderPass({
      colorAttachments: [{
        view,
        clearValue: { r: 0, g: 0, b: 0, a: 0 },
        loadOp: "clear",
        storeOp: "store"
      }]
    });
    rpass.setPipeline(this.renderPipeline);
    rpass.setBindGroup(0, this.bindGroup);
    rpass.draw(6, this.count);
    rpass.end();

    this.device.queue.submit([encoder.finish()]);
  }

  setEnabled(enabled) {
    const wasEnabled = this.enabled;
    this.enabled = enabled === true;
    if (this.enabled && !wasEnabled && this.supported && this.device && !this.frameId && !this.disposed) {
      this.lastFrameAt = performance.now();
      this.frameId = requestAnimationFrame(this._tick);
    }
  }
  setStarGlow(value) { this.starGlow = aiHubNormalizeStarGlow(value); }
  setHDR(enabled) {
    const next = enabled !== false;
    if (next === this.hdrEnabled) return;
    this.hdrEnabled = next;
    if (this.context && this.device && this.format) {
      try {
        this.context.configure({
          device: this.device,
          format: this.format,
          alphaMode: "premultiplied",
          colorSpace: this.hdrEnabled ? "display-p3" : "srgb"
        });
      } catch (_) {}
    }
  }

  dispose() {
    this.disposed = true;
    if (this.frameId) cancelAnimationFrame(this.frameId);
    if (this._onResize) window.removeEventListener("resize", this._onResize);
    if (this.device) { try { this.device.destroy(); } catch {} }
  }
}

AIHubWebGPUStarfield.WGSL = `
struct Star {
  pos: vec2<f32>,
  vel: vec2<f32>,
  color: vec4<f32>,    // rgb + size (px)
  extras: vec4<f32>,   // intensity, twinkleSpeed, twinklePhase, depth
};
struct U {
  tSec: f32, dt: f32, w: f32, h: f32,
  glowLift: f32, dpr: f32, count: f32, reducedMotion: f32,
  audioBass: f32, audioHigh: f32, audioBeat: f32, _pad: f32,
};
@group(0) @binding(0) var<storage, read_write> stars: array<Star>;
@group(0) @binding(1) var<uniform> u: U;

@compute @workgroup_size(64)
fn cs_main(@builtin(global_invocation_id) gid: vec3<u32>) {
  let idx = gid.x;
  if (idx >= u32(u.count)) { return; }
  var s = stars[idx];
  let motion = 1.0 - u.reducedMotion * 0.92;          // 92% slowdown under reduced motion
  s.pos = fract(s.pos + s.vel * u.dt * motion + vec2<f32>(1.0, 1.0));
  stars[idx] = s;
}

struct VSOut {
  @builtin(position) pos: vec4<f32>,
  @location(0) uv: vec2<f32>,
  @location(1) color: vec3<f32>,
  @location(2) bright: f32,
};

@vertex
fn vs_main(@builtin(vertex_index) vid: u32, @builtin(instance_index) iid: u32) -> VSOut {
  var corners = array<vec2<f32>, 6>(
    vec2<f32>(-1.0, -1.0), vec2<f32>( 1.0, -1.0), vec2<f32>(-1.0,  1.0),
    vec2<f32>(-1.0,  1.0), vec2<f32>( 1.0, -1.0), vec2<f32>( 1.0,  1.0)
  );
  let corner = corners[vid];
  let s = stars[iid];

  let intensity = s.extras.x;
  let twinkleSpeed = s.extras.y;
  let twinklePhase = s.extras.z;

  // Scintillation stays small, varied, and tied to star brightness.
  let twinkleAmp = 0.08 + intensity * 0.16 + u.audioHigh * 0.18;
  let twinkle = 1.0 + twinkleAmp * sin(u.tSec * twinkleSpeed + twinklePhase)
    + twinkleAmp * 0.18 * sin(u.tSec * (twinkleSpeed * 1.7 + 0.13) + twinklePhase * 1.37);

  let audioScale = 1.0 + u.audioBass * intensity * 0.55 + u.audioBeat * intensity * 0.45;
  let sizePx = s.color.w * (0.82 + intensity * 0.24) * audioScale * u.dpr;
  let centerPx = vec2<f32>(s.pos.x * u.w, s.pos.y * u.h);
  let posPx = centerPx + corner * sizePx;
  let clip = vec2<f32>((posPx.x / u.w) * 2.0 - 1.0, 1.0 - (posPx.y / u.h) * 2.0);

  var out: VSOut;
  out.pos = vec4<f32>(clip, 0.0, 1.0);
  out.uv = corner;
  out.color = s.color.rgb * twinkle * (0.62 + intensity * 0.58 + u.audioHigh * 0.38 + u.audioBeat * intensity * 0.28);
  out.bright = intensity;
  return out;
}

@fragment
fn fs_main(in: VSOut) -> @location(0) vec4<f32> {
  let d = length(in.uv);
  if (d > 1.0) { discard; }
  let radius = mix(0.34, 0.48, in.bright);
  let core = 1.0 - smoothstep(radius, radius + 0.08, d);
  let alpha = clamp(core, 0.0, 1.0);
  return vec4<f32>(in.color * alpha, alpha);
}
`;

window.AIHubWebGPUStarfield = AIHubWebGPUStarfield;
