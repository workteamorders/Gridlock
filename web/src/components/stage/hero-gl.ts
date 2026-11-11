import { frameGovernor } from '../fx/governor';

const vertex = 'attribute vec2 p;void main(){gl_Position=vec4(p,0.,1.);}';
const fragment = `precision mediump float;
uniform vec2 uRes;uniform float uTime;uniform vec2 uPointer;uniform vec3 uInk;uniform float uCell;
void main(){
  vec2 px=gl_FragCoord.xy;
  float a=0.26;mat2 r=mat2(cos(a),-sin(a),sin(a),cos(a));mat2 ri=mat2(cos(a),sin(a),-sin(a),cos(a));
  vec2 g=r*px/uCell;vec2 id=floor(g)+.5;vec2 f=fract(g)-.5;
  vec2 c=ri*(id*uCell);
  float wave=.5+.5*sin(c.x*.004+uTime*.6)*sin(c.y*.005-uTime*.45);
  float d=distance(c,uPointer*uRes);
  float near=exp(-d*d/(uCell*uCell*140.));
  float radius=.5*clamp(wave*.55+near*1.1,0.,1.);
  float m=1.-smoothstep(radius-.06,radius+.02,length(f));
  float alpha=m*.34;
  gl_FragColor=vec4(uInk*alpha,alpha);
}`;

/** Reads a color token such as --brush from the page and returns it as 0..1 channels. */
function token(name: string): [number, number, number] {
  const raw = getComputedStyle(document.documentElement).getPropertyValue(name).trim();
  const m = /^#([0-9a-f]{2})([0-9a-f]{2})([0-9a-f]{2})$/i.exec(raw);
  return m ? [parseInt(m[1]!, 16) / 255, parseInt(m[2]!, 16) / 255, parseInt(m[3]!, 16) / 255] : [1, 1, 1];
}

function compile(gl: WebGLRenderingContext, type: number, source: string) {
  const shader = gl.createShader(type);
  if (!shader) return null;
  gl.shaderSource(shader, source);
  gl.compileShader(shader);
  return gl.getShaderParameter(shader, gl.COMPILE_STATUS) ? shader : null;
}

/** A halftone field that swells where the pointer is. Returns a stop function, or does nothing when WebGL is missing. */
export function startHeroGL(canvas: HTMLCanvasElement, host: HTMLElement): () => void {
  const gl = canvas.getContext('webgl', { alpha: true, premultipliedAlpha: true, antialias: false, powerPreference: 'low-power', failIfMajorPerformanceCaveat: true });
  if (!gl) return () => undefined;
  // Software renderers (SwiftShader, llvmpipe) compile and draw on the CPU and would stall the page, so they get the static posters only.
  const renderer = gl.getExtension('WEBGL_debug_renderer_info');
  const name = renderer ? String(gl.getParameter(renderer.UNMASKED_RENDERER_WEBGL)) : '';
  if (!renderer || /swiftshader|llvmpipe|softpipe|software|basic render/i.test(name)) return () => undefined;
  const vs = compile(gl, gl.VERTEX_SHADER, vertex);
  const fs = compile(gl, gl.FRAGMENT_SHADER, fragment);
  const program = gl.createProgram();
  if (!vs || !fs || !program) return () => undefined;
  gl.attachShader(program, vs);
  gl.attachShader(program, fs);
  gl.linkProgram(program);
  if (!gl.getProgramParameter(program, gl.LINK_STATUS)) return () => undefined;
  gl.useProgram(program);
  gl.bindBuffer(gl.ARRAY_BUFFER, gl.createBuffer());
  gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 1, -1, -1, 1, 1, 1]), gl.STATIC_DRAW);
  const loc = gl.getAttribLocation(program, 'p');
  gl.enableVertexAttribArray(loc);
  gl.vertexAttribPointer(loc, 2, gl.FLOAT, false, 0, 0);
  gl.enable(gl.BLEND);
  gl.blendFunc(gl.ONE, gl.ONE_MINUS_SRC_ALPHA);
  const u = (name: string) => gl.getUniformLocation(program, name);
  const ink = token('--brush');
  gl.uniform3f(u('uInk'), ink[0], ink[1], ink[2]);

  // The poster layers only move while a real GPU is drawing the halftone; if the engine stops, they hold still.
  host.dataset.live = 'true';
  const dpr = Math.min(devicePixelRatio || 1, 1.5);
  let pointer: [number, number] = [0.5, 0.5];
  let target: [number, number] = [0.5, 0.5];
  const resize = () => {
    const w = Math.max(1, Math.round(canvas.clientWidth * dpr));
    const h = Math.max(1, Math.round(canvas.clientHeight * dpr));
    if (canvas.width !== w || canvas.height !== h) { canvas.width = w; canvas.height = h; gl.viewport(0, 0, w, h); }
    gl.uniform2f(u('uRes'), w, h);
    gl.uniform1f(u('uCell'), 20 * dpr);
  };
  resize();
  const observer = new ResizeObserver(resize);
  observer.observe(canvas);

  const onMove = (event: PointerEvent) => {
    if (event.pointerType === 'touch') return;
    const box = canvas.getBoundingClientRect();
    target = [(event.clientX - box.left) / box.width, 1 - (event.clientY - box.top) / box.height];
  };
  host.addEventListener('pointermove', onMove);

  const governor = frameGovernor(1);
  let visible = true;
  const watcher = new IntersectionObserver((entries) => { visible = entries.some((e) => e.isIntersecting); });
  watcher.observe(host);
  let frame = 0;
  let last = performance.now();
  let stopped = false;
  const draw = (now: number) => {
    if (stopped) return;
    frame = requestAnimationFrame(draw);
    const dt = now - last;
    last = now;
    if (!visible || document.hidden) { governor.pause(); return; }
    if (governor.sample(dt) === 0) { stop(); return; }
    pointer = [pointer[0] + (target[0] - pointer[0]) * 0.12, pointer[1] + (target[1] - pointer[1]) * 0.12];
    gl.uniform1f(u('uTime'), now / 1000);
    gl.uniform2f(u('uPointer'), pointer[0], pointer[1]);
    gl.clear(gl.COLOR_BUFFER_BIT);
    gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
  };
  function stop() {
    stopped = true;
    cancelAnimationFrame(frame);
    observer.disconnect();
    watcher.disconnect();
    host.removeEventListener('pointermove', onMove);
    delete host.dataset.live;
    gl!.getExtension('WEBGL_lose_context')?.loseContext();
  }
  frame = requestAnimationFrame(draw);
  return stop;
}
