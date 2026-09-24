'use strict';
// Equirectangular video -> perspective rays. No third-party rendering library.
class PanoramaViewer {
  constructor(canvas, video, onChange, onError) {
    this.canvas = canvas;
    this.video = video;
    this.onChange = onChange;
    this.yaw = -90;
    this.pitch = 0;
    this.dirty = true;
    this.enabled = true;
    const gl = canvas.getContext('webgl', { alpha: false, antialias: false });
    if (!gl) throw new Error('360° viewing is unavailable. The flat panorama is ready to play.');
    this.gl = gl;
    const shader = (type, source) => {
      const handle = gl.createShader(type);
      gl.shaderSource(handle, source);
      gl.compileShader(handle);
      if (!gl.getShaderParameter(handle, gl.COMPILE_STATUS)) throw new Error('The panorama renderer could not start. Use the flat view.');
      return handle;
    };
    const vertex = shader(gl.VERTEX_SHADER, 'attribute vec2 position; varying vec2 uv; void main(){ uv=position; gl_Position=vec4(position,0.0,1.0); }');
    const fragment = shader(gl.FRAGMENT_SHADER, `
      precision highp float;
      varying vec2 uv;
      uniform sampler2D frame;
      uniform vec3 rightV, upV, forwardV;
      uniform float aspect;
      void main() {
        vec3 ray = normalize(forwardV + uv.x * aspect * 0.62 * rightV + uv.y * 0.62 * upV);
        vec2 st = vec2(atan(ray.x, ray.z) / 6.28318530718 + 0.5,
                       0.5 - asin(clamp(ray.y, -1.0, 1.0)) / 3.14159265359);
        gl_FragColor = vec4(texture2D(frame, st).rgb, 1.0);
      }`);
    const program = gl.createProgram();
    gl.attachShader(program, vertex);
    gl.attachShader(program, fragment);
    gl.linkProgram(program);
    if (!gl.getProgramParameter(program, gl.LINK_STATUS)) throw new Error('The panorama renderer could not start. Use the flat view.');
    gl.useProgram(program);
    gl.deleteShader(vertex);
    gl.deleteShader(fragment);
    const buffer = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1,-1,1,-1,-1,1,1,1]), gl.STATIC_DRAW);
    const attribute = gl.getAttribLocation(program, 'position');
    gl.enableVertexAttribArray(attribute);
    gl.vertexAttribPointer(attribute, 2, gl.FLOAT, false, 0, 0);
    gl.bindTexture(gl.TEXTURE_2D, gl.createTexture());
    for (const parameter of [gl.TEXTURE_WRAP_S, gl.TEXTURE_WRAP_T]) gl.texParameteri(gl.TEXTURE_2D, parameter, gl.CLAMP_TO_EDGE);
    for (const parameter of [gl.TEXTURE_MIN_FILTER, gl.TEXTURE_MAG_FILTER]) gl.texParameteri(gl.TEXTURE_2D, parameter, gl.LINEAR);
    this.uniforms = Object.fromEntries(['rightV', 'upV', 'forwardV', 'aspect'].map(name => [name, gl.getUniformLocation(program, name)]));
    let drag = null;
    canvas.addEventListener('pointerdown', event => {
      if (event.button !== 0) return;
      drag = { id: event.pointerId, x: event.clientX, y: event.clientY };
      canvas.setPointerCapture(event.pointerId);
    });
    canvas.addEventListener('pointermove', event => {
      if (!drag || drag.id !== event.pointerId) return;
      this.setView(this.yaw + (drag.x - event.clientX) * 0.18, this.pitch + (event.clientY - drag.y) * 0.18);
      drag.x = event.clientX;
      drag.y = event.clientY;
    });
    for (const event of ['pointerup', 'pointercancel', 'lostpointercapture']) canvas.addEventListener(event, () => { drag = null; });
    canvas.addEventListener('keydown', event => {
      const delta = { ArrowLeft: [-5,0], ArrowRight: [5,0], ArrowUp: [0,5], ArrowDown: [0,-5] }[event.key];
      if (delta) { event.preventDefault(); this.setView(this.yaw + delta[0], this.pitch + delta[1]); }
    });
    canvas.addEventListener('webglcontextlost', event => {
      event.preventDefault();
      this.enabled = false;
      onError('360° rendering was interrupted. Continue in flat view, or reload to restore 360°.');
    });
    new ResizeObserver(() => { this.dirty = true; }).observe(canvas);
    video.addEventListener('loadeddata', () => { this.dirty = true; });
    video.addEventListener('seeked', () => { this.dirty = true; });
    document.addEventListener('visibilitychange', () => { this.dirty = true; });
    const tick = () => {
      if (this.enabled && !document.hidden && video.readyState >= 2 && (this.dirty || !video.paused)) {
        try { this.render(); } catch { this.enabled = false; onError('The 360° view could not display this video. Continue in flat view.'); }
      }
      requestAnimationFrame(tick);
    };
    requestAnimationFrame(tick);
  }
  setView(yaw, pitch) {
    this.yaw = ((yaw + 180) % 360 + 360) % 360 - 180;
    this.pitch = Math.max(-85, Math.min(85, pitch));
    this.dirty = true;
    this.onChange(this.yaw, this.pitch);
  }
  render() {
    const { gl, canvas, uniforms: u } = this;
    const scale = Math.min(window.devicePixelRatio || 1, 2);
    const width = Math.round(canvas.clientWidth * scale), height = Math.round(canvas.clientHeight * scale);
    if (!width || !height) return;
    if (canvas.width !== width || canvas.height !== height) { canvas.width = width; canvas.height = height; }
    gl.viewport(0, 0, width, height);
    const yaw = this.yaw * Math.PI / 180, pitch = this.pitch * Math.PI / 180;
    gl.uniform3fv(u.rightV, [Math.cos(yaw), 0, -Math.sin(yaw)]);
    gl.uniform3fv(u.upV, [-Math.sin(yaw)*Math.sin(pitch), Math.cos(pitch), -Math.cos(yaw)*Math.sin(pitch)]);
    gl.uniform3fv(u.forwardV, [Math.sin(yaw)*Math.cos(pitch), Math.sin(pitch), Math.cos(yaw)*Math.cos(pitch)]);
    gl.uniform1f(u.aspect, width / height);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGB, gl.RGB, gl.UNSIGNED_BYTE, this.video);
    gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
    this.dirty = false;
  }
}
