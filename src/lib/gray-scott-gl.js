// Gray-Scott reaction-diffusion stepped on the GPU: the two chemicals live in a float texture
// (a in red, b in green) that is ping-ponged once per iteration, then drawn through the colour
// ramp at the canvas' full resolution. Needs WebGL2 with float render targets.

const VERTEX = `#version 300 es
void main() {
  // One triangle that covers the whole viewport; no vertex buffers needed.
  vec2 p = vec2(float((gl_VertexID << 1) & 2), float(gl_VertexID & 2));
  gl_Position = vec4(p * 2.0 - 1.0, 0.0, 1.0);
}`;

// Texture row 0 is the top row of the picture, as on the CPU.
const HEADER = `#version 300 es
precision highp float;
precision highp int;
precision highp sampler2D;
uniform sampler2D state;
out vec4 color;
`;

const STEP = `${HEADER}
uniform vec4 rates; // feed, kill, diffusion of a, diffusion of b
uniform vec3 seed;  // x, y and radius in cells; radius 0 means no seed
void main() {
  ivec2 size = textureSize(state, 0);
  ivec2 c = ivec2(gl_FragCoord.xy);
  // The grid wraps around at the edges.
  int l = c.x == 0 ? size.x - 1 : c.x - 1;
  int r = c.x == size.x - 1 ? 0 : c.x + 1;
  int u = c.y == 0 ? size.y - 1 : c.y - 1;
  int d = c.y == size.y - 1 ? 0 : c.y + 1;
  vec2 v = texelFetch(state, c, 0).rg;
  vec2 sides = texelFetch(state, ivec2(l, c.y), 0).rg + texelFetch(state, ivec2(r, c.y), 0).rg +
    texelFetch(state, ivec2(c.x, u), 0).rg + texelFetch(state, ivec2(c.x, d), 0).rg;
  vec2 corners = texelFetch(state, ivec2(l, u), 0).rg + texelFetch(state, ivec2(r, u), 0).rg +
    texelFetch(state, ivec2(l, d), 0).rg + texelFetch(state, ivec2(r, d), 0).rg;
  vec2 lap = 0.2 * sides + 0.05 * corners - v; // Karl Sims' normalised 3x3 Laplacian
  float abb = v.r * v.g * v.g;
  vec2 next = v + vec2(rates.z * lap.r - abb + rates.x * (1.0 - v.r),
    rates.w * lap.g + abb - (rates.y + rates.x) * v.g);
  if (seed.z > 0.0 && distance(vec2(c), seed.xy) <= seed.z) next = vec2(0.5, 1.0);
  color = vec4(clamp(next, 0.0, 1.0), 0.0, 1.0);
}`;

const SHOW = `${HEADER}
uniform sampler2D ramp;
uniform vec2 view; // output size in pixels
void main() {
  // Interpolate b between cells first and colour it afterwards, so edges stay sharp when the
  // grid is scaled up.
  ivec2 size = textureSize(state, 0);
  vec2 pos = vec2(gl_FragCoord.x, view.y - gl_FragCoord.y) / view * vec2(size) - 0.5;
  vec2 cell = floor(pos);
  vec2 t = pos - cell;
  ivec2 a = (ivec2(cell) + size) % size;
  ivec2 b = (a + 1) % size;
  float v = mix(
    mix(texelFetch(state, a, 0).g, texelFetch(state, ivec2(b.x, a.y), 0).g, t.x),
    mix(texelFetch(state, ivec2(a.x, b.y), 0).g, texelFetch(state, b, 0).g, t.x),
    t.y);
  // b rarely exceeds ~0.35, so it is stretched over the ramp (like the CPU version).
  color = texture(ramp, vec2(clamp(v * 3.0, 0.0, 1.0) * (255.0 / 256.0) + 0.5 / 256.0, 0.5));
}`;

// One value per block of cells for the completion checks: b at the block's corner (to measure
// change) and the block's highest b (so a small spot isn't missed when looking for life).
const PROBE = `${HEADER}
uniform ivec2 block;
void main() {
  ivec2 size = textureSize(state, 0) - 1;
  ivec2 origin = ivec2(gl_FragCoord.xy) * block;
  float peak = 0.0;
  for (int y = 0; y < block.y; y++) {
    for (int x = 0; x < block.x; x++) {
      peak = max(peak, texelFetch(state, min(origin + ivec2(x, y), size), 0).g);
    }
  }
  color = vec4(texelFetch(state, min(origin, size), 0).g, peak, 0.0, 1.0);
}`;

const PROBE_MAX_W = 64;
const PROBE_MAX_H = 48;

function program(gl, source, uniforms) {
  const prog = gl.createProgram();
  const shaders = [[gl.VERTEX_SHADER, VERTEX], [gl.FRAGMENT_SHADER, source]].map(([type, text]) => {
    const shader = gl.createShader(type);
    gl.shaderSource(shader, text);
    gl.compileShader(shader);
    gl.attachShader(prog, shader);
    return shader;
  });
  gl.linkProgram(prog);
  if (!gl.getProgramParameter(prog, gl.LINK_STATUS)) {
    const log = shaders.map((s) => gl.getShaderInfoLog(s)).join('') || gl.getProgramInfoLog(prog);
    throw new Error(`shader failed to build: ${log}`);
  }
  for (const shader of shaders) gl.deleteShader(shader);
  const loc = {};
  for (const name of uniforms) loc[name] = gl.getUniformLocation(prog, name);
  return { prog, loc };
}

function texture(gl, format, width, height, filter) {
  const tex = gl.createTexture();
  gl.bindTexture(gl.TEXTURE_2D, tex);
  gl.texStorage2D(gl.TEXTURE_2D, 1, format, width, height);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, filter);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, filter);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
  return tex;
}

function framebuffer(gl, tex) {
  const fb = gl.createFramebuffer();
  gl.bindFramebuffer(gl.FRAMEBUFFER, fb);
  gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, tex, 0);
  if (gl.checkFramebufferStatus(gl.FRAMEBUFFER) !== gl.FRAMEBUFFER_COMPLETE) {
    throw new Error('float framebuffer is not supported');
  }
  return fb;
}

export class GrayScottGL {
  /** An engine on its own offscreen canvas, or null where the GPU can't run it. */
  static create() {
    const canvas = document.createElement('canvas');
    const gl = canvas.getContext('webgl2', { alpha: false, antialias: false, depth: false, stencil: false });
    if (!gl) return null;
    if (gl.getExtension('EXT_color_buffer_float')) {
      try {
        return new GrayScottGL(canvas, gl);
      } catch (error) {
        console.warn(`Reaction-diffusion runs on the CPU instead: ${error.message}`);
      }
    }
    gl.getExtension('WEBGL_lose_context')?.loseContext();
    return null;
  }

  w = 0;
  h = 0;
  lost = false;
  iterations = 0;
  #textures = [];
  #targets = [];
  #current = 0;
  #rampKey = '';
  #fence = null;
  #pendingAt = 0;
  #lastAt = 0;
  #hasLast = false;
  #probeSize = [0, 0];

  constructor(canvas, gl) {
    this.canvas = canvas;
    this.gl = gl;
    canvas.addEventListener('webglcontextlost', () => { this.lost = true; });
    this.step = program(gl, STEP, ['rates', 'seed']);
    this.show = program(gl, SHOW, ['ramp', 'view']);
    this.probe = program(gl, PROBE, ['block']);
    gl.useProgram(this.show.prog);
    gl.uniform1i(this.show.loc.ramp, 1);
    gl.bindVertexArray(gl.createVertexArray());
    gl.disable(gl.DITHER);
    this.ramp = texture(gl, gl.RGBA8, 256, 1, gl.LINEAR);
    this.probeTarget = framebuffer(gl, texture(gl, gl.RGBA32F, PROBE_MAX_W, PROBE_MAX_H, gl.NEAREST));
    this.probeBuffer = gl.createBuffer();
    gl.bindBuffer(gl.PIXEL_PACK_BUFFER, this.probeBuffer);
    gl.bufferData(gl.PIXEL_PACK_BUFFER, PROBE_MAX_W * PROBE_MAX_H * 16, gl.STREAM_READ);
    gl.bindBuffer(gl.PIXEL_PACK_BUFFER, null);
    this.readback = new Float32Array(PROBE_MAX_W * PROBE_MAX_H * 4);
    this.last = new Float32Array(PROBE_MAX_W * PROBE_MAX_H);
  }

  /** Starts over on a w × h grid; `data` holds a and b interleaved, row by row from the top. */
  load(w, h, data) {
    const gl = this.gl;
    if (w !== this.w || h !== this.h) {
      this.#freeGrid();
      this.#textures = [0, 1].map(() => texture(gl, gl.RG32F, w, h, gl.NEAREST));
      this.#targets = this.#textures.map((tex) => framebuffer(gl, tex));
      this.w = w;
      this.h = h;
    }
    this.#current = 0;
    gl.bindTexture(gl.TEXTURE_2D, this.#textures[0]);
    gl.texSubImage2D(gl.TEXTURE_2D, 0, 0, 0, w, h, gl.RG, gl.FLOAT, data);
    this.#dropProbe();
  }

  /** Runs `count` iterations; `seed` ({ x, y, r } in cells) drops chemical b first. */
  iterate(count, feed, kill, diffusionA, diffusionB, seed) {
    const gl = this.gl;
    const { prog, loc } = this.step;
    gl.useProgram(prog);
    gl.viewport(0, 0, this.w, this.h);
    gl.uniform4f(loc.rates, feed, kill, diffusionA, diffusionB);
    gl.uniform3f(loc.seed, seed ? seed.x : 0, seed ? seed.y : 0, seed ? seed.r : 0);
    gl.activeTexture(gl.TEXTURE0);
    for (let i = 0; i < count; i++) {
      if (i === 1 && seed) gl.uniform3f(loc.seed, 0, 0, 0);
      gl.bindFramebuffer(gl.FRAMEBUFFER, this.#targets[1 - this.#current]);
      gl.bindTexture(gl.TEXTURE_2D, this.#textures[this.#current]);
      gl.drawArrays(gl.TRIANGLES, 0, 3);
      this.#current = 1 - this.#current;
    }
    this.iterations += count;
    return count;
  }

  /** Draws the current state at width × height pixels and returns the canvas holding it. */
  render(width, height, lut, lutKey) {
    const gl = this.gl;
    if (this.canvas.width !== width || this.canvas.height !== height) {
      this.canvas.width = width;
      this.canvas.height = height;
    }
    gl.activeTexture(gl.TEXTURE1);
    gl.bindTexture(gl.TEXTURE_2D, this.ramp);
    if (lutKey !== this.#rampKey) {
      gl.texSubImage2D(gl.TEXTURE_2D, 0, 0, 0, 256, 1, gl.RGBA, gl.UNSIGNED_BYTE, new Uint8Array(lut.buffer));
      this.#rampKey = lutKey;
    }
    gl.activeTexture(gl.TEXTURE0);
    gl.bindTexture(gl.TEXTURE_2D, this.#textures[this.#current]);
    gl.bindFramebuffer(gl.FRAMEBUFFER, null);
    gl.viewport(0, 0, width, height);
    gl.useProgram(this.show.prog);
    gl.uniform2f(this.show.loc.view, width, height);
    gl.drawArrays(gl.TRIANGLES, 0, 3);
    return this.canvas;
  }

  /**
   * Samples the grid without stalling the GPU: returns the previous sample once it has arrived
   * ({ peak, change } with change = mean change in b per iteration since the sample before, or
   * null for the first one), else null, and starts the next.
   */
  sample() {
    const gl = this.gl;
    let result = null;
    if (this.#fence) {
      const status = gl.clientWaitSync(this.#fence, 0, 0);
      if (status === gl.TIMEOUT_EXPIRED) return null;
      gl.deleteSync(this.#fence);
      this.#fence = null;
      if (status !== gl.WAIT_FAILED) result = this.#compare();
    }
    const bx = Math.ceil(this.w / PROBE_MAX_W);
    const by = Math.ceil(this.h / PROBE_MAX_H);
    const pw = Math.ceil(this.w / bx);
    const ph = Math.ceil(this.h / by);
    this.#probeSize = [pw, ph];
    gl.bindFramebuffer(gl.FRAMEBUFFER, this.probeTarget);
    gl.viewport(0, 0, pw, ph);
    gl.useProgram(this.probe.prog);
    gl.uniform2i(this.probe.loc.block, bx, by);
    gl.activeTexture(gl.TEXTURE0);
    gl.bindTexture(gl.TEXTURE_2D, this.#textures[this.#current]);
    gl.drawArrays(gl.TRIANGLES, 0, 3);
    gl.bindBuffer(gl.PIXEL_PACK_BUFFER, this.probeBuffer);
    gl.readPixels(0, 0, pw, ph, gl.RGBA, gl.FLOAT, 0);
    gl.bindBuffer(gl.PIXEL_PACK_BUFFER, null);
    this.#fence = gl.fenceSync(gl.SYNC_GPU_COMMANDS_COMPLETE, 0);
    gl.flush();
    this.#pendingAt = this.iterations;
    return result;
  }

  #compare() {
    const gl = this.gl;
    const [pw, ph] = this.#probeSize;
    const n = pw * ph;
    gl.bindBuffer(gl.PIXEL_PACK_BUFFER, this.probeBuffer);
    gl.getBufferSubData(gl.PIXEL_PACK_BUFFER, 0, this.readback, 0, n * 4);
    gl.bindBuffer(gl.PIXEL_PACK_BUFFER, null);
    let peak = 0;
    let change = 0;
    for (let i = 0; i < n; i++) {
      const b = this.readback[i * 4];
      change += Math.abs(b - this.last[i]);
      this.last[i] = b;
      peak = Math.max(peak, this.readback[i * 4 + 1]);
    }
    const iterations = this.#pendingAt - this.#lastAt;
    const first = !this.#hasLast;
    this.#lastAt = this.#pendingAt;
    this.#hasLast = true;
    return { peak, change: first || iterations <= 0 ? null : change / n / iterations };
  }

  #dropProbe() {
    if (this.#fence) this.gl.deleteSync(this.#fence);
    this.#fence = null;
    this.#hasLast = false;
  }

  #freeGrid() {
    for (const fb of this.#targets) this.gl.deleteFramebuffer(fb);
    for (const tex of this.#textures) this.gl.deleteTexture(tex);
    this.#targets = [];
    this.#textures = [];
  }

  destroy() {
    this.#dropProbe();
    // Frees the GPU memory now rather than whenever the context is garbage-collected.
    this.gl.getExtension('WEBGL_lose_context')?.loseContext();
    this.canvas.width = 0;
    this.canvas.height = 0;
  }
}
