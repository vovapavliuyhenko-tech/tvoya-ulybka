/* =========================================================
   Опал — 3D-фигуры из перламутрового стекла
   Формы строятся из SDF (signed distance fields) + marching cubes,
   рендерятся одним WebGL-рендерером в 2D-canvas каждой карточки.
   ========================================================= */
import * as THREE from 'three';
import { SHAPES, bakeArrays } from './opal3d-shapes.js';

const { sin } = Math;
const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';

const reduceMotion = matchMedia('(prefers-reduced-motion: reduce)').matches;
// телефоны и планшеты: облегчённый режим (меньше пикселей, 30 кадров/с, проще материал)
const isPhone = matchMedia('(max-width: 700px), (hover: none) and (pointer: coarse)').matches;
let lastScroll = 0;
addEventListener('scroll', () => { lastScroll = performance.now(); }, { passive: true });

/* ---------- Геометрия: строится в фоновом потоке, чтобы не тормозить страницу ---------- */
const geoCache = new Map();
const geoPending = new Map();
let worker = null;
try {
  worker = new Worker(new URL('./opal3d-worker.js', import.meta.url), { type: 'module' });
  worker.addEventListener('error', () => { worker = null; });
} catch (e) {
  worker = null;
}

function bakeInWorker(name) {
  return new Promise((resolve, reject) => {
    if (!worker) return reject(new Error('no worker'));
    const timer = setTimeout(() => reject(new Error('timeout')), 10000);
    const onMsg = e => {
      if (e.data.name !== name) return;
      worker.removeEventListener('message', onMsg);
      clearTimeout(timer);
      e.data.error ? reject(new Error(e.data.error)) : resolve(e.data);
    };
    worker.addEventListener('message', onMsg);
    worker.postMessage({ name });
  });
}

function getGeo(name) {
  if (geoCache.has(name)) return Promise.resolve(geoCache.get(name));
  if (geoPending.has(name)) return geoPending.get(name);
  const p = bakeInWorker(name)
    .catch(() => bakeArrays(name))            // запасной путь: в основном потоке
    .then(({ pos, nor }) => {
      const g = new THREE.BufferGeometry();
      g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
      g.setAttribute('normal', new THREE.BufferAttribute(nor, 3));
      g.computeBoundingSphere();
      geoCache.set(name, g);
      return g;
    });
  geoPending.set(name, p);
  return p;
}

/* ---------- Рендерер и окружение ---------- */
let renderer;
try {
  renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true, powerPreference: 'high-performance' });
} catch (e) {
  renderer = null;
}

if (renderer) init();
else if (window.opalFallback) window.opalFallback();

function init() {
  renderer.setPixelRatio(1);
  renderer.setClearColor(0x000000, 0);
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 0.95;
  renderer.setScissorTest(true);

  const scene = new THREE.Scene();
  const pmrem = new THREE.PMREMGenerator(renderer);
  scene.environment = pmrem.fromScene(new RoomEnvironment(renderer), 0.03).texture;

  // цветные «студийные» источники дают перламутровые блики
  const pink = new THREE.DirectionalLight(0xffb8ea, 2.2); pink.position.set(-3, 2, 2);
  const cyan = new THREE.DirectionalLight(0xa8ecff, 2.0); cyan.position.set(3, -1, 2);
  const key = new THREE.DirectionalLight(0xffffff, 0.8); key.position.set(0.5, 3, 4);
  const lilac = new THREE.PointLight(0xc6a8ff, 6, 10); lilac.position.set(0, 0, -2.5);
  scene.add(pink, cyan, key, lilac);

  /* ---------- Материал: стекло + перламутр ---------- */
  const shared = { uTime: { value: 0 } };

  function glass(side) {
    const front = side === THREE.FrontSide;
    const m = new THREE.MeshPhysicalMaterial({
      color: 0x7d74b8,
      roughness: 0.06,
      metalness: 0.05,
      iridescence: 1,
      iridescenceIOR: 1.45,
      iridescenceThicknessRange: [180, 900],
      clearcoat: isPhone ? 0.5 : 1,
      clearcoatRoughness: 0.03,
      specularIntensity: 1,
      sheen: isPhone ? 0 : 1,
      sheenColor: new THREE.Color(0xf0c8ff),
      sheenRoughness: 0.25,
      envMapIntensity: 1.25,
      transparent: true,
      side,
      depthWrite: front
    });
    m.userData.uniforms = {
      uWobble: { value: 0 },
      uAlphaMin: { value: front ? 0.16 : 0.1 },
      uRim: { value: front ? 0.7 : 0.35 },
      uShift: { value: 0 }
    };
    m.onBeforeCompile = sh => {
      Object.assign(sh.uniforms, shared, m.userData.uniforms);
      sh.vertexShader = sh.vertexShader
        .replace('#include <common>', '#include <common>\nuniform float uTime;\nuniform float uWobble;')
        .replace('#include <begin_vertex>', `#include <begin_vertex>
          float w = sin(position.y * 4.2 + uTime * 1.9) * 0.5
                  + sin(position.x * 5.1 - uTime * 1.4) * 0.35
                  + sin(position.z * 6.3 + uTime * 2.3) * 0.25;
          transformed += normal * w * 0.035 * uWobble;`);
      sh.fragmentShader = sh.fragmentShader
        .replace('#include <common>', '#include <common>\nuniform float uAlphaMin;\nuniform float uRim;\nuniform float uShift;\nuniform float uTime;')
        .replace('#include <dithering_fragment>', `
          vec3 nn = normalize(vNormal);
          if (!gl_FrontFacing) nn = -nn;
          float fres = pow(1.0 - clamp(dot(nn, normalize(vViewPosition)), 0.0, 1.0), 1.8);
          // перламутровый перелив: пастельная радуга по краю и по наклону нормали
          float band = fres * 0.85 + nn.y * 0.18 + nn.x * 0.12 + uShift;
          vec3 rainbow = 0.62 + 0.38 * cos(6.2831 * (band + vec3(0.0, 0.33, 0.67)));
          gl_FragColor.rgb = mix(gl_FragColor.rgb, rainbow, 0.28);
          gl_FragColor.rgb += fres * uRim * mix(vec3(1.0), rainbow, 0.7);
          float lum = dot(gl_FragColor.rgb, vec3(0.299, 0.587, 0.114));
          float a = uAlphaMin + fres * (0.95 - uAlphaMin);
          a = max(a, smoothstep(0.78, 1.15, lum) * 0.95);
          gl_FragColor.a = clamp(a, 0.0, 1.0) * opacity;
          #include <dithering_fragment>`);
    };
    m.customProgramCacheKey = () => 'opal-glass-' + (front ? 'f' : 'b');
    return m;
  }

  /* ---------- Вьюхи (по одной на карточку) ---------- */
  const views = [];
  const pointer = { x: innerWidth / 2, y: innerHeight / 2 };
  addEventListener('pointermove', e => { pointer.x = e.clientX; pointer.y = e.clientY; }, { passive: true });

  class View {
    constructor(el) {
      this.el = el;
      this.canvas = document.createElement('canvas');
      this.canvas.className = 'obj3d__canvas';
      el.appendChild(this.canvas);
      this.ctx = this.canvas.getContext('2d');
      this.camera = new THREE.PerspectiveCamera(26, 1, 0.1, 50);
      this.group = new THREE.Group();
      this.back = new THREE.Mesh(undefined, glass(THREE.BackSide));
      this.front = new THREE.Mesh(undefined, glass(THREE.FrontSide));
      this.back.renderOrder = 0; this.front.renderOrder = 1;
      this.group.add(this.back, this.front);
      this.visible = false;
      this.ready = false;
      this.appear = 0;           // 0..1 появление
      this.hover = 0;
      this.spin = 0; this.spinVel = 0;
      this.tilt = { x: 0, y: 0 };
      this.swap = null;          // смена формы
      this.phase = Math.random() * 10;
      this.trigger = el.closest('.card, .service, .case, .cta') || el;
      this.trigger.addEventListener('pointerenter', () => { this.hoverOn = true; this.spinVel += 7; });
      this.trigger.addEventListener('pointerleave', () => { this.hoverOn = false; });
      this.setShape(el.dataset.shape, true);
    }

    setShape(name, initial) {
      if (!SHAPES[name] || name === this.shape) return;
      if (initial || !this.ready) { this.shape = name; this.ready = false; this.loading = false; return; }
      getGeo(name);                 // заранее просим фоновый поток построить форму
      this.swap = { name, t: 0 };   // анимация «уйти — прийти»
    }

    applyShape() {
      const name = this.shape;
      this.loading = true;
      return getGeo(name).then(g => {
        this.loading = false;
        if (this.shape !== name) return;
        const def = SHAPES[name];
        this.back.geometry = g; this.front.geometry = g;
        this.base = def.rot;
        this.wobble = def.wobble;
        this.ready = true;
        this.el.classList.add('is-3d');
      }, () => { this.loading = false; });
    }
  }

  const io = new IntersectionObserver(entries => {
    entries.forEach(e => {
      const v = e.target.__view;
      v.visible = e.isIntersecting;
    });
  }, { rootMargin: isPhone ? '60px 0px' : '200px 0px' });

  document.querySelectorAll('.obj3d').forEach(el => {
    const v = new View(el);
    el.__view = v;
    views.push(v);
    io.observe(el);
  });

  // публичный API для смены формы (вкладки «До и после»)
  window.opal3d = { setShape: (el, name) => el && el.__view && el.__view.setShape(name) };

  /* ---------- Ленивое запекание: сначала видимые ---------- */
  function bakeNext() {
    const pending = views.filter(v => !v.ready && !v.loading);
    if (!pending.length) return;
    pending.sort((a, b) => (b.visible - a.visible) || (a.el.getBoundingClientRect().top - b.el.getBoundingClientRect().top));
    // формы строятся по очереди в фоне; вьюхи с той же формой получают её из кэша
    pending[0].applyShape().then(() => {
      views.forEach(v => { if (!v.ready && !v.loading && geoCache.has(v.shape)) v.applyShape(); });
      bakeNext();
    });
  }
  // стартуем после первой отрисовки страницы
  (window.requestIdleCallback || (cb => setTimeout(cb, 200)))(bakeNext, { timeout: 1200 });

  /* ---------- Цикл рендера ---------- */
  let bufW = 0, bufH = 0, last = performance.now();
  const ease = t => 1 - Math.pow(1 - t, 3);
  const backOut = t => { const c1 = 1.5, c3 = c1 + 1; return 1 + c3 * Math.pow(t - 1, 3) + c1 * Math.pow(t - 1, 2); };

  // адаптивное качество: если кадры долгие, снижаем плотность пикселей
  let quality = isPhone ? 1.25 : 2;
  let slowTime = 0, frameNo = 0, lastRender = performance.now();

  function frame(now) {
    const rawDt = (now - last) / 1000;
    last = now;
    frameNo++;
    if (rawDt > 0.028 && rawDt < 0.5) slowTime += rawDt; else slowTime = Math.max(0, slowTime - rawDt * 0.5);
    if (slowTime > 1 && quality > 1) { quality = 1; slowTime = 0; }
    // телефоны: 30 кадров/с, а во время прокрутки — реже, чтобы листалось плавно
    const scrolling = now - lastScroll < 160;
    const every = isPhone ? (scrolling ? 4 : 2) : (scrolling ? 2 : 1);
    if (frameNo % every !== 0) { requestAnimationFrame(frame); return; }
    const dt = Math.min(0.1, (now - lastRender) / 1000);
    lastRender = now;
    const time = now / 1000;
    shared.uTime.value = time;
    const dpr = Math.min(devicePixelRatio || 1, quality);

    for (const v of views) {
      if (!v.visible || !v.ready) continue;
      const rect = v.el.getBoundingClientRect();
      if (rect.width < 2 || rect.height < 2) continue;
      const w = Math.round(rect.width * dpr), h = Math.round(rect.height * dpr);
      if (v.canvas.width !== w || v.canvas.height !== h) { v.canvas.width = w; v.canvas.height = h; }
      if (w > bufW || h > bufH) {
        bufW = Math.max(bufW, w); bufH = Math.max(bufH, h);
        renderer.setSize(bufW, bufH, false);
      }

      /* --- анимация --- */
      const m = reduceMotion ? 0 : 1;
      v.appear = Math.min(1, v.appear + dt / 1.5);
      v.hover += ((v.hoverOn ? 1 : 0) - v.hover) * Math.min(1, dt * 6);
      v.spinVel *= Math.pow(0.04, dt);                  // затухание раскрутки
      v.spin += v.spinVel * dt * m;

      let swapScale = 1;
      if (v.swap) {
        v.swap.t += dt / 0.9;
        if (v.swap.t >= 0.5 && v.shape !== v.swap.name) {
          if (geoCache.has(v.swap.name)) { v.shape = v.swap.name; v.applyShape(); }
          else v.swap.t = 0.5;          // ждём, пока фоновый поток достроит форму
        }
        swapScale = v.swap.t < 0.5 ? 1 - ease(v.swap.t * 2) : backOut((v.swap.t - 0.5) * 2);
        if (v.swap.t >= 1) v.swap = null;
      }

      // наклон к курсору
      const cx = rect.left + rect.width / 2, cy = rect.top + rect.height / 2;
      const tx = clamp((pointer.x - cx) / innerWidth, -1, 1);
      const ty = clamp((pointer.y - cy) / innerHeight, -1, 1);
      const k = (0.55 + 0.6 * v.hover) * m;
      v.tilt.x += (ty * 0.7 * k - v.tilt.x) * Math.min(1, dt * 3);
      v.tilt.y += (tx * 1.1 * k - v.tilt.y) * Math.min(1, dt * 3);

      const a = backOut(v.appear);
      const t = time * m + v.phase;
      const g = v.group;
      g.rotation.set(
        v.base[0] + sin(t * 0.45) * 0.1 + v.tilt.x,
        v.base[1] + sin(t * 0.35) * 0.28 + v.tilt.y + v.spin + (1 - ease(v.appear)) * 2.4,
        v.base[2] + sin(t * 0.5) * 0.06
      );
      const s = (0.55 + 0.45 * a) * (1 + 0.07 * v.hover) * swapScale;
      g.scale.setScalar(Math.max(0.001, s));
      // парение + лёгкий параллакс от скролла
      const par = ((cy - innerHeight / 2) / innerHeight) * -0.18;
      g.position.set(0, sin(t * 0.9) * 0.05 * m + par * m - (1 - ease(v.appear)) * 0.35, 0);

      for (const mesh of [v.back, v.front]) {
        const u = mesh.material.userData.uniforms;
        u.uWobble.value = (v.wobble + v.hover * 0.6) * m;
        u.uShift.value = (t * 0.05 + v.hover * 0.25);
        mesh.material.opacity = Math.min(1, v.appear * 1.6) * Math.min(1, swapScale * 1.5);
        mesh.material.iridescenceThicknessRange[1] = 700 + 180 * sin(t * 0.7);
      }

      /* --- камера: вписать объект радиуса ~1 --- */
      const cam = v.camera;
      cam.aspect = w / h;
      const tanV = Math.tan(THREE.MathUtils.degToRad(cam.fov / 2));
      const fit = Math.min(tanV, tanV * cam.aspect);
      cam.position.set(0, 0, 1.08 / fit + 0.2);
      cam.lookAt(0, 0, 0);
      cam.updateProjectionMatrix();

      /* --- рендер в общий буфер и копия в canvas карточки --- */
      scene.add(g);
      renderer.setViewport(0, 0, w, h);
      renderer.setScissor(0, 0, w, h);
      renderer.clear();
      renderer.render(scene, cam);
      scene.remove(g);

      v.ctx.clearRect(0, 0, w, h);
      v.ctx.drawImage(renderer.domElement, 0, bufH - h, w, h, 0, 0, w, h);
    }
    requestAnimationFrame(frame);
  }
  requestAnimationFrame(frame);
}
