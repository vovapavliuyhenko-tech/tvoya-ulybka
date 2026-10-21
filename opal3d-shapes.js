/* =========================================================
   Формы 3D-фигур (SDF) и их построение (marching cubes).
   Общий модуль: работает и в фоновом потоке (opal3d-worker.js),
   и в основном — как запасной вариант.
   ========================================================= */
import { MeshBasicMaterial } from 'https://cdn.jsdelivr.net/npm/three@0.160.0/build/three.module.min.js';
import { MarchingCubes } from './vendor/MarchingCubes.js';

/* ---------- SDF-примитивы ---------- */
const { sqrt, abs, max, min, sin, cos, atan2, PI } = Math;
const len3 = (x, y, z) => sqrt(x * x + y * y + z * z);
const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
const smin = (a, b, k) => { const h = max(k - abs(a - b), 0) / k; return min(a, b) - h * h * k * 0.25; };
const smax = (a, b, k) => -smin(-a, -b, k);
const smooth = (e0, e1, x) => { const t = clamp((x - e0) / (e1 - e0), 0, 1); return t * t * (3 - 2 * t); };

function sdEllipsoid(x, y, z, rx, ry, rz) {
  const k0 = len3(x / rx, y / ry, z / rz);
  const k1 = len3(x / (rx * rx), y / (ry * ry), z / (rz * rz));
  return k1 === 0 ? -min(rx, ry, rz) : (k0 * (k0 - 1)) / k1;
}

// Конус со скруглёнными концами между точками a и b (Inigo Quilez)
function sdRoundCone(px, py, pz, a, b, r1, r2) {
  const bax = b[0] - a[0], bay = b[1] - a[1], baz = b[2] - a[2];
  const l2 = bax * bax + bay * bay + baz * baz;
  const rr = r1 - r2, a2 = l2 - rr * rr, il2 = 1 / l2;
  const pax = px - a[0], pay = py - a[1], paz = pz - a[2];
  const y = pax * bax + pay * bay + paz * baz, z = y - l2;
  const xx = pax * l2 - bax * y, xy = pay * l2 - bay * y, xz = paz * l2 - baz * y;
  const x2 = xx * xx + xy * xy + xz * xz, y2 = y * y * l2, z2 = z * z * l2;
  const k = Math.sign(rr) * rr * rr * x2;
  if (Math.sign(z) * a2 * z2 > k) return sqrt(x2 + z2) * il2 - r2;
  if (Math.sign(y) * a2 * y2 < k) return sqrt(x2 + y2) * il2 - r1;
  return (sqrt(x2 * a2 * il2) + y * rr) * il2 - r1;
}

/* ---------- Формы ---------- */
export const SHAPES = {
  tooth: {
    res: 84,
    sdf(x, y, z) {
      // коронка
      let d = sdEllipsoid(x, y - 0.36, z, 0.6, 0.38, 0.5);
      for (const sx of [-1, 1]) for (const sz of [-1, 1]) {
        d = smin(d, len3(x - sx * 0.27, y - 0.58, z - sz * 0.21) - 0.27, 0.22);
      }
      d = smax(d, -(len3(x, y - 0.98, z) - 0.3), 0.16);           // фиссура
      d = smin(d, sdEllipsoid(x, y - 0.04, z, 0.47, 0.26, 0.4), 0.2); // шейка
      // корни
      d = smin(d, sdRoundCone(x, y, z, [-0.24, 0.02, 0.1], [-0.4, -0.9, 0.16], 0.21, 0.055), 0.2);
      d = smin(d, sdRoundCone(x, y, z, [0.24, 0.02, 0.1], [0.38, -0.88, 0.2], 0.21, 0.055), 0.2);
      d = smin(d, sdRoundCone(x, y, z, [0, 0.02, -0.2], [0.03, -0.84, -0.32], 0.21, 0.06), 0.2);
      return d;
    },
    rot: [0.12, -0.45, 0.04], wobble: 0.12
  },

  star: {
    res: 80,
    sdf(x, y, z) {
      const zs = z / 0.62;
      let d = sdEllipsoid(x, y, zs, 0.36, 0.36, 0.42);
      const L = 0.94;
      for (const [ax, ay] of [[L, 0], [-L, 0], [0, L], [0, -L]]) {
        d = smin(d, sdRoundCone(x, y, zs, [0, 0, 0], [ax, ay, 0], 0.3, 0.035), 0.34);
      }
      return d * 0.62;
    },
    rot: [0.25, 0.35, 0.12], wobble: 0.15
  },

  bubble: {
    res: 64,
    sdf: (x, y, z) => len3(x, y, z) - 0.86,
    rot: [0, 0, 0], wobble: 1
  },

  drop: {
    res: 76,
    sdf: (x, y, z) => sdRoundCone(x, y, z, [0, -0.3, 0], [0, 0.88, 0], 0.6, 0.025),
    rot: [0.08, 0, -0.08], wobble: 0.55
  },

  lens: {
    res: 72,
    sdf: (x, y, z) => sdEllipsoid(x, y, z, 0.86, 0.86, 0.4),
    rot: [0.45, -0.75, 0.55], wobble: 0.3
  },

  veneer: {
    res: 84,
    sdf(x, y, z) {
      // изогнутая тонкая «лопатка», шире к режущему краю
      const w = 0.84 + 0.2 * clamp(-y, -1, 1);
      const bz = z + 0.4 * x * x - 0.08 - 0.12 * y * y;
      return sdEllipsoid(x / w, y, bz, 0.62, 0.86, 0.17) * 0.8;
    },
    rot: [-0.1, -0.5, -0.18], wobble: 0.15
  },

  aligner: {
    res: 96,
    sdf(x, y, z) {
      let d = 1e9;
      const n = 14;
      for (let i = 0; i < n; i++) {
        const t = -1 + (2 * i) / (n - 1);
        const th = t * 1.33;
        const cx = 0.8 * sin(th), cz = -0.62 * cos(th) + 0.28;
        const m = smooth(0.35, 1, abs(t));
        // ориентируем «зуб» по касательной к дуге
        const dx = x - cx, dz = z - cz;
        const c = cos(th), s = sin(th);
        const lx = dx * c - dz * s, lz = dx * s + dz * c;
        const e = sdEllipsoid(lx, y, lz, 0.075 + 0.045 * m, 0.13 - 0.015 * m, 0.07 + 0.075 * m);
        d = smin(d, e, 0.075);
      }
      // каппа полая — вычитаем внутренний объём снизу
      return smax(d, -(y + 0.06 + 0.0), 0.04);
    },
    rot: [1.0, 0, 0], wobble: 0.1
  },

  implant: {
    res: 100,
    sdf(x, y, z) {
      // винт с винтовой резьбой
      const q = sqrt(x * x + z * z);
      const phase = y * 7.5 - atan2(z, x) / (2 * PI);
      const tri = abs(phase - Math.floor(phase) - 0.5) * 2;
      const taper = 1 - 0.38 * smooth(-0.45, -0.95, y);
      const r = (0.16 + 0.055 * (1 - tri)) * taper;
      let screw = (q - r) * 0.7;
      screw = smax(screw, y - 0.06, 0.05);
      screw = smax(screw, -0.95 - y, 0.08);
      // абатмент
      let d = smin(screw, sdRoundCone(x, y, z, [0, 0.02, 0], [0, 0.26, 0], 0.15, 0.11), 0.06);
      // коронка
      let crown = sdEllipsoid(x, y - 0.56, z, 0.44, 0.27, 0.4);
      for (const sx of [-1, 1]) for (const sz of [-1, 1]) {
        crown = smin(crown, len3(x - sx * 0.19, y - 0.72, z - sz * 0.16) - 0.18, 0.15);
      }
      crown = smax(crown, -(len3(x, y - 0.98, z) - 0.2), 0.12);
      return smin(d, crown, 0.1);
    },
    rot: [0.15, 0.4, -0.12], wobble: 0.08
  }
};

/* ---------- Построение формы: массивы вершин и нормалей ---------- */
let mcCache = null;

export function bakeArrays(name) {
  const def = SHAPES[name];
  const res = def.res;
  if (!mcCache || mcCache.size !== res) {
    mcCache = new MarchingCubes(res, new MeshBasicMaterial(), false, false, 260000);
  }
  const mc = mcCache;
  mc.reset();
  const f = mc.field, half = res / 2, size2 = res * res;
  for (let k = 0; k < res; k++) {
    const z = (k - half) / half;
    for (let j = 0; j < res; j++) {
      const y = (j - half) / half;
      const o = k * size2 + j * res;
      for (let i = 0; i < res; i++) f[o + i] = -def.sdf((i - half) / half, y, z);
    }
  }
  mc.isolation = 0;
  mc.update();

  const n = mc.count;
  const pos = mc.positionArray.slice(0, n * 3);
  const nor = mc.normalArray.slice(0, n * 3);
  // центрируем и вписываем в сферу радиуса 1
  let minX = Infinity, minY = Infinity, minZ = Infinity, maxX = -Infinity, maxY = -Infinity, maxZ = -Infinity;
  for (let i = 0; i < n * 3; i += 3) {
    const x = pos[i], y = pos[i + 1], z = pos[i + 2];
    if (x < minX) minX = x; if (x > maxX) maxX = x;
    if (y < minY) minY = y; if (y > maxY) maxY = y;
    if (z < minZ) minZ = z; if (z > maxZ) maxZ = z;
    const l = Math.hypot(nor[i], nor[i + 1], nor[i + 2]) || 1;
    nor[i] /= l; nor[i + 1] /= l; nor[i + 2] /= l;
  }
  const cx = (minX + maxX) / 2, cy = (minY + maxY) / 2, cz = (minZ + maxZ) / 2;
  let r = 0;
  for (let i = 0; i < n * 3; i += 3) {
    pos[i] -= cx; pos[i + 1] -= cy; pos[i + 2] -= cz;
    const d = pos[i] * pos[i] + pos[i + 1] * pos[i + 1] + pos[i + 2] * pos[i + 2];
    if (d > r) r = d;
  }
  const s = 1 / (Math.sqrt(r) || 1);
  for (let i = 0; i < n * 3; i++) pos[i] *= s;
  return { pos, nor };
}
