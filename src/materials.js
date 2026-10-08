import * as THREE from 'three';

const mixf = (a, b, t) => a + (b - a) * t;
const cl = (v, a = 0, b = 1) => Math.min(b, Math.max(a, v));
const sst = (a, b, x) => {
  const t = cl((x - a) / (b - a));
  return t * t * (3 - 2 * t);
};
const hash = (x, y, s) => {
  let h = (Math.imul(x, 374761393) + Math.imul(y, 668265263) + Math.imul(s, 1274126177)) | 0;
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  return ((h ^ (h >>> 16)) >>> 0) / 4294967295;
};
const vn = (x, y, px, py, s) => {
  const xi = Math.floor(x),
    yi = Math.floor(y),
    xf = x - xi,
    yf = y - yi,
    u = xf * xf * (3 - 2 * xf),
    v = yf * yf * (3 - 2 * yf),
    g = (i, j) => hash(((i % px) + px) % px, ((j % py) + py) % py, s);
  return mixf(mixf(g(xi, yi), g(xi + 1, yi), u), mixf(g(xi, yi + 1), g(xi + 1, yi + 1), u), v);
};
const fbm = (u, v, fx, fy, oct, s) => {
  let a = 0.5,
    sum = 0,
    n = 0;
  for (let i = 0; i < oct; i++) {
    const m = 1 << i;
    sum += a * vn(u * fx * m, v * fy * m, fx * m, fy * m, s + i);
    n += a;
    a *= 0.5;
  }
  return sum / n;
};

const worley = (u, v, N, s) => {
  const gx = u * N,
    gy = v * N,
    cx = Math.floor(gx),
    cy = Math.floor(gy);
  let d1 = 9,
    d2 = 9,
    id = 0;
  for (let j = -1; j <= 1; j++)
    for (let i = -1; i <= 1; i++) {
      const nx = cx + i,
        ny = cy + j,
        wx = ((nx % N) + N) % N,
        wy = ((ny % N) + N) % N,
        d = Math.hypot(nx + hash(wx, wy, s) - gx, ny + hash(wx, wy, s + 1) - gy);
      if (d < d1) {
        d2 = d1;
        d1 = d;
        id = hash(wx, wy, s + 2);
      } else if (d < d2) d2 = d;
    }
  return { d1, d2, id };
};

function make(size, fn, strength, aniso) {
  const col = new ImageData(size, size),
    rgh = new ImageData(size, size),
    nor = new ImageData(size, size),
    H = new Float32Array(size * size);
  for (let y = 0; y < size; y++)
    for (let x = 0; x < size; x++) {
      const o = fn(x / size, y / size),
        i = y * size + x,
        p = i * 4;
      H[i] = o.h;
      col.data[p] = o.c[0];
      col.data[p + 1] = o.c[1];
      col.data[p + 2] = o.c[2];
      col.data[p + 3] = 255;
      rgh.data[p] = rgh.data[p + 1] = rgh.data[p + 2] = cl(o.r) * 255;
      rgh.data[p + 3] = 255;
    }
  const at = (x, y) => H[((y + size) % size) * size + ((x + size) % size)];
  for (let y = 0; y < size; y++)
    for (let x = 0; x < size; x++) {
      const dx = (at(x + 1, y) - at(x - 1, y)) * strength,
        dy = (at(x, y + 1) - at(x, y - 1)) * strength,
        l = Math.hypot(dx, dy, 1),
        p = (y * size + x) * 4;
      nor.data[p] = ((-dx / l) * 0.5 + 0.5) * 255;
      nor.data[p + 1] = ((dy / l) * 0.5 + 0.5) * 255;
      nor.data[p + 2] = ((1 / l) * 0.5 + 0.5) * 255;
      nor.data[p + 3] = 255;
    }
  const tex = (img, srgb) => {
    const c = document.createElement('canvas');
    c.width = c.height = size;
    c.getContext('2d').putImageData(img, 0, 0);
    const t = new THREE.CanvasTexture(c);
    t.wrapS = t.wrapT = THREE.RepeatWrapping;
    if (srgb) t.colorSpace = THREE.SRGBColorSpace;
    t.anisotropy = aniso;
    return t;
  };
  return { map: tex(col, true), normalMap: tex(nor, false), roughnessMap: tex(rgh, false) };
}

export function makePBR(opts = {}) {
  const lo = !!opts.lowRes,
    A = opts.aniso || 4,
    big = lo ? 256 : 512,
    mid = lo ? 128 : 256,
    mk = (s, fn, st) => make(s, fn, st, A);
  return {
    floor: mk(
      big,
      (u, v) => {
        const pi = Math.floor(u * 4),
          lu = u * 4 - pi,
          j = v * 2 + hash(pi, 3, 1) * 2,
          bi = Math.floor(j),
          lv = j - bi,
          b = bi % 2;
        const id = hash(pi, b, 5),
          tone = 0.84 + 0.22 * id,
          g = fbm(u, v, 28, 4, 4, 11),
          ring = 0.5 + 0.5 * Math.sin((g * 8 + lu * 3 + id * 9) * 6.283);
        const fine = vn(u * 320, v * 24, 320, 24, 12),
          pore = vn(u * 400, v * 120, 400, 120, 13);
        const hasK = hash(pi, b, 8) > 0.72,
          kd = hasK
            ? Math.hypot(
                (lu - (0.2 + 0.6 * hash(pi, b, 9))) * 0.9,
                (lv - (0.2 + 0.6 * hash(pi, b, 10))) * 0.45
              )
            : 9,
          knot = Math.exp(-kd * kd * 180),
          kr = 0.5 + 0.5 * Math.sin(kd * 70);
        const groove = Math.min(
          sst(0, 0.018, lu),
          sst(0, 0.018, 1 - lu),
          sst(0, 0.008, lv),
          sst(0, 0.008, 1 - lv)
        );
        const l =
            tone *
            (0.8 + 0.3 * g) *
            (0.9 + 0.14 * ring) *
            (1 - 0.12 * pore) *
            (1 - 0.18 * fine) *
            (1 - 0.55 * knot * (0.5 + 0.5 * kr)),
          gm = 0.35 + 0.65 * groove,
          wear = fbm(u, v, 6, 6, 2, 14);
        return {
          h: g * 0.25 + ring * 0.08 + pore * 0.05 - (1 - groove) * 1.2 - knot * 0.2,
          c: [200 * l * gm, 151 * l * gm, 106 * l * gm],
          r: groove < 0.9 ? 0.9 : 0.34 + 0.3 * wear + 0.1 * pore,
        };
      },
      2.4
    ),

    wood: mk(
      big,
      (u, v) => {
        const g = fbm(u, v, 4, 26, 4, 5),
          ring = 0.5 + 0.5 * Math.sin((g * 6 + u * 7) * 6.283),
          fine = vn(u * 6, v * 220, 6, 220, 6),
          pore = vn(u * 300, v * 60, 300, 60, 7);
        const kd = Math.hypot(u - 0.62, (v - 0.38) * 0.45),
          knot = Math.exp(-kd * kd * 260),
          kr = 0.5 + 0.5 * Math.sin(kd * 95);
        const l =
          (0.62 + 0.3 * g) *
          (0.88 + 0.18 * ring) *
          (1 - 0.1 * fine) *
          (1 - 0.1 * pore) *
          (1 - 0.5 * knot * (0.5 + 0.5 * kr));
        return {
          h: g * 0.4 + ring * 0.25 + pore * 0.05 - knot * 0.15,
          c: [212 * l, 158 * l, 110 * l],
          r: 0.42 + 0.2 * (1 - g) + 0.1 * pore,
        };
      },
      2
    ),

    plaster: mk(
      big,
      (u, v) => {
        const n = fbm(u, v, 28, 28, 4, 9),
          f = fbm(u, v, 3, 3, 3, 4),
          tr = fbm(u, v, 2, 10, 3, 15),
          fine = vn(u * 220, v * 220, 220, 220, 16),
          sp = hash(Math.floor(u * big), Math.floor(v * big), 21) > 0.996 ? 0.7 : 1;
        const l = (0.95 - 0.06 * n - 0.035 * f - 0.03 * tr - 0.02 * fine) * sp;
        return {
          h: n * 0.45 + tr * 0.3 + fine * 0.15,
          c: [255 * l, 254 * l, 250 * l],
          r: 0.92 + 0.06 * fine,
        };
      },
      1.5
    ),

    fabric: mk(
      mid,
      (u, v) => {
        const N = mid / 4,
          par = (Math.floor(u * N) + Math.floor(v * N)) & 1,
          wx = 0.5 + 0.5 * Math.sin(u * 6.283 * N),
          wy = 0.5 + 0.5 * Math.sin(v * 6.283 * N),
          th = par ? wx : wy;
        const fz = hash(Math.floor(u * mid), Math.floor(v * mid), 3),
          m = fbm(u, v, 6, 6, 2, 8),
          l = (0.55 + 0.4 * th) * (0.92 + 0.12 * fz) * (0.9 + 0.2 * m);
        return { h: th * 0.7 + fz * 0.2, c: [255 * l, 255 * l, 255 * l], r: 0.93 + 0.05 * fz };
      },
      2.6
    ),

    leather: mk(
      mid,
      (u, v) => {
        const w = worley(u, v, 36, 5),
          crease = sst(0, 0.16, w.d2 - w.d1),
          grain = vn(u * 180, v * 180, 180, 180, 6),
          l = (0.5 + 0.4 * crease) * (0.88 + 0.2 * w.id) * (0.95 + 0.08 * grain);
        return {
          h: crease * 0.8 + (1 - w.d1) * 0.15 + grain * 0.05,
          c: [255 * l, 255 * l, 255 * l],
          r: 0.46 + 0.3 * (1 - crease) + 0.08 * grain,
        };
      },
      2.4
    ),

    metal: mk(
      mid,
      (u, v) => {
        const n =
            vn(u * 2, v * 256, 2, 256, 3) * 0.5 +
            vn(u * 8, v * 220, 8, 220, 4) * 0.3 +
            vn(u * 40, v * 90, 40, 90, 5) * 0.2,
          sc = hash(0, Math.floor(v * mid), 9) > 0.975 ? 1 : 0,
          l = 0.76 + 0.2 * n + 0.1 * sc;
        return { h: n * 0.3, c: [255 * l, 255 * l, 255 * l], r: 0.28 + 0.25 * n + 0.1 * sc };
      },
      0.9
    ),

    concrete: mk(
      big,
      (u, v) => {
        const pu = (u * 2) % 1,
          pv = v % 1,
          seam = Math.min(sst(0, 0.012, pu), sst(0, 0.012, 1 - pu), sst(0, 0.006, pv), sst(0, 0.006, 1 - pv)),
          m = fbm(u, v, 5, 5, 4, 31),
          st = vn(u * 6, v * 90, 6, 90, 32),
          fine = vn(u * 240, v * 240, 240, 240, 33);
        const tx = Math.abs(((u * 2 * 4) % 1) - 0.5),
          ty = Math.abs(((v * 4) % 1) - 0.5),
          tie = Math.exp(-(tx * tx + ty * ty) * 900) * (pu > 0.06 && pu < 0.94 ? 1 : 0),
          bub = hash(Math.floor(u * big), Math.floor(v * big), 34) > 0.994 ? 0.6 : 1;
        const l = (0.62 + 0.22 * m - 0.07 * st - 0.05 * fine) * (0.55 + 0.45 * seam) * (1 - 0.6 * tie) * bub;
        return {
          h: m * 0.3 + st * 0.1 - (1 - seam) * 0.9 - tie * 0.8,
          c: [l * 255, l * 255, l * 252],
          r: 0.86 + 0.1 * fine,
        };
      },
      1.6
    ),

    marble: mk(
      mid,
      (u, v) => {
        const w = fbm(u, v, 3, 3, 4, 41),
          t = Math.abs(Math.sin((u * 2 + v * 1.3 + w * 2.6) * 6.283)),
          vein = Math.exp(-Math.pow(t * 7, 1.4)),
          vein2 = Math.exp(-Math.pow(Math.abs(Math.sin((v * 3 - u + w * 3.4) * 6.283)) * 14, 1.3)),
          cl2 = fbm(u, v, 10, 10, 3, 42);
        const l = 0.94 - 0.05 * cl2 - 0.32 * vein - 0.14 * vein2;
        return { h: vein * 0.05, c: [l * 252, l * 252, l * 255], r: 0.12 + 0.1 * cl2 };
      },
      0.4
    ),

    rug: mk(
      big,
      (u, v) => {
        const du = Math.abs(u - 0.5),
          dv = Math.abs(v - 0.5),
          bd = Math.max(du, dv),
          dm = du + dv,
          fz = vn(u * 260, v * 260, 260, 260, 51),
          wv = 0.5 + 0.5 * Math.sin(u * 6.283 * 130) * Math.sin(v * 6.283 * 130);
        let c = [31, 95, 107];
        if (bd > 0.455) c = [226, 214, 190];
        else if (bd > 0.43) c = [196, 94, 62];
        else if (bd > 0.41) c = [226, 214, 190];
        else {
          const ring = Math.abs(((dm * 6) % 1) - 0.5);
          if (ring < 0.07) c = [226, 214, 190];
          else if (dm < 0.09) c = [196, 94, 62];
          else if ((Math.floor(u * 14) + Math.floor(v * 14)) % 2 === 0 && ring < 0.14) c = [24, 78, 90];
        }
        const l = (0.78 + 0.22 * fz) * (0.9 + 0.12 * wv);
        return { h: fz * 0.6 + wv * 0.4, c: [c[0] * l, c[1] * l, c[2] * l], r: 0.95 };
      },
      2.2
    ),

    asphalt: mk(
      mid,
      (u, v) => {
        const n = fbm(u, v, 24, 24, 3, 61),
          a = vn(u * 200, v * 200, 200, 200, 62),
          m = fbm(u, v, 4, 4, 2, 63),
          w = worley(u, v, 7, 64),
          crack = w.d2 - w.d1 < 0.025 ? 0.55 : 1,
          fl = hash(Math.floor(u * mid), Math.floor(v * mid), 65) > 0.985 ? 0.3 : 0;
        const l = (0.34 + 0.2 * a + 0.1 * n + 0.06 * m + fl) * crack;
        return { h: a * 0.5 + n * 0.3 - (1 - crack) * 0.6, c: [l * 255, l * 255, l * 262], r: 0.7 + 0.2 * a };
      },
      2
    ),

    brick: mk(
      big,
      (u, v) => {
        const R = 28,
          C = 10,
          row = Math.floor(v * R),
          off = row % 2 ? 0.5 : 0,
          bu = u * C + off,
          col2 = Math.floor(bu),
          lu = bu - col2,
          lv = v * R - row,
          id = hash(((col2 % C) + C) % C, row, 71),
          gap = Math.min(sst(0, 0.07, lu), sst(0, 0.07, 1 - lu), sst(0, 0.14, lv), sst(0, 0.14, 1 - lv)),
          n = fbm(u, v, 40, 40, 3, 72),
          fine = vn(u * 260, v * 260, 260, 260, 73);
        const bl = (0.7 + 0.5 * id) * (0.9 + 0.2 * n) * (0.94 + 0.08 * fine),
          ml = 0.62 + 0.1 * fine;
        const c = [
          176 * bl * gap + 150 * ml * (1 - gap),
          92 * bl * gap + 146 * ml * (1 - gap),
          68 * bl * gap + 138 * ml * (1 - gap),
        ];
        return { h: gap * 0.9 + n * 0.1, c, r: 0.9 - 0.1 * gap };
      },
      2.6
    ),

    roof: mk(
      big,
      (u, v) => {
        const R = 16,
          C = 8,
          row = Math.floor(v * R),
          off = row % 2 ? 0.5 : 0,
          bu = u * C + off,
          col2 = Math.floor(bu),
          lu = bu - col2,
          lv = v * R - row,
          id = hash(((col2 % C) + C) % C, row, 81),
          edge = sst(0, 0.18, lv),
          side = Math.min(sst(0, 0.06, lu), sst(0, 0.06, 1 - lu)),
          n = fbm(u, v, 30, 30, 3, 82);
        const l = (0.62 + 0.38 * edge) * (0.55 + 0.45 * side) * (0.82 + 0.3 * id) * (0.92 + 0.14 * n);
        return { h: edge * 0.6 + side * 0.3, c: [190 * l, 92 * l, 64 * l], r: 0.82 };
      },
      2.4
    ),

    brushed: mk(
      big,
      (u, v) => {
        const a = vn(u * 4, v * 400, 4, 400, 91),
          b = vn(u * 10, v * 900, 10, 900, 92),
          sc = hash(Math.floor(u * big), Math.floor(v * big), 93) > 0.998 ? 0.22 : 0,
          l = 0.64 + 0.18 * a + 0.1 * b + sc;
        return { h: a * 0.5 + b * 0.3, c: [l * 255, l * 257, l * 262], r: 0.3 + 0.28 * b };
      },
      1.6
    ),
    plastic: mk(
      mid,
      (u, v) => {
        const g = vn(u * 180, v * 180, 180, 180, 95),
          n = fbm(u, v, 10, 10, 3, 96),
          l = 0.9 + 0.07 * g + 0.04 * n;
        return { h: g * 0.35 + n * 0.1, c: [l * 255, l * 255, l * 255], r: 0.5 + 0.28 * g };
      },
      1.2
    ),
    grille: mk(
      big,
      (u, v) => {
        const N = 24,
          fx = u * N - Math.floor(u * N) - 0.5,
          fy = v * N - Math.floor(v * N) - 0.5,
          d = Math.hypot(fx, fy),
          hole = sst(0.38, 0.3, d),
          n = vn(u * 120, v * 120, 120, 120, 97),
          l = mixf(0.66 + 0.1 * n, 0.03, hole);
        return { h: -hole * 1.1 + n * 0.08, c: [l * 255, l * 257, l * 262], r: mixf(0.45, 0.95, hole) };
      },
      2.2
    ),
    carbon: mk(
      mid,
      (u, v) => {
        const N = 14,
          i = Math.floor(u * N),
          j = Math.floor(v * N),
          fu = u * N - i,
          fv = v * N - j,
          along = ((i + j) & 2) === 0,
          sh = along ? 0.55 + 0.45 * Math.sin(Math.PI * fv) : 0.55 + 0.45 * Math.sin(Math.PI * fu),
          l = 0.1 + 0.15 * sh;
        return { h: sh * 0.6, c: [l * 255, l * 257, l * 264], r: 0.25 + 0.25 * (1 - sh) };
      },
      1.4
    ),
    grass: mk(
      mid,
      (u, v) => {
        const n = fbm(u, v, 32, 32, 3, 8),
          m = fbm(u, v, 4, 4, 2, 2),
          bl = vn(u * 180, v * 60, 180, 60, 3),
          s = hash(Math.floor(u * mid), Math.floor(v * mid), 3),
          k = 0.8 + 0.35 * m;
        return {
          h: n * 0.5 + bl * 0.3 + s * 0.2,
          c: [(66 + 60 * n + 30 * bl) * k, (116 + 62 * n + 26 * s) * k, (44 + 22 * n) * k],
          r: 0.95,
        };
      },
      1.6
    ),
  };
}

export const pbr = (set, rx, ry, color, o = {}) => {
  const c = t => {
    const k = t.clone();
    k.needsUpdate = true;
    k.wrapS = k.wrapT = THREE.RepeatWrapping;
    k.repeat.set(rx, ry);
    return k;
  };
  return new THREE.MeshStandardMaterial(
    Object.assign(
      {
        color,
        map: c(set.map),
        normalMap: c(set.normalMap),
        roughnessMap: c(set.roughnessMap),
        roughness: 1,
        metalness: 0,
      },
      o
    )
  );
};

export const pbrT = (set, tileM, color, o = {}) => {
  const m = pbr(set, 1, 1, color, o);
  m.userData.tile = tileM;
  return m;
};
