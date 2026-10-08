import * as THREE from 'three';

const hash = (a, b = 0) => {
  const s = Math.sin(a * 127.1 + b * 311.7) * 43758.5453;
  return s - Math.floor(s);
};
const MONO = '9px ui-monospace,Menlo,Consolas,monospace';

function chrome(x, w, h, label, p, t) {
  x.fillStyle = '#03060c';
  x.fillRect(0, 0, w, h);
  x.fillStyle = 'rgba(255,255,255,.07)';
  x.fillRect(0, 0, w, 14);
  x.fillStyle = p.c1;
  x.font = MONO;
  x.fillText(label, 6, 10);
  x.fillStyle = Math.floor(t * 2) % 2 ? p.c2 : 'rgba(255,255,255,.2)';
  x.beginPath();
  x.arc(w - 8, 7, 3, 0, 6.283);
  x.fill();
  x.strokeStyle = 'rgba(255,255,255,.12)';
  x.strokeRect(0.5, 0.5, w - 1, h - 1);
}

const KINDS = {
  stats(x, w, h, t, p) {
    chrome(x, w, h, 'SYS // MONITOR', p, t);
    const gh = (h - 24) / 3;
    for (let g = 0; g < 3; g++) {
      const y0 = 18 + g * gh,
        col = g === 1 ? p.c2 : p.c1;
      x.strokeStyle = 'rgba(255,255,255,.08)';
      x.beginPath();
      x.moveTo(6, y0 + gh - 4);
      x.lineTo(w - 46, y0 + gh - 4);
      x.stroke();
      x.beginPath();
      for (let i = 0; i <= 40; i++) {
        const v =
          0.5 + 0.32 * Math.sin(i * 0.4 + t * (1 + g * 0.5) + p.seed) + 0.12 * Math.sin(i * 1.7 + t * 3 + g);
        const px = 6 + (i / 40) * (w - 52),
          py = y0 + gh - 4 - v * (gh - 10);
        x[i ? 'lineTo' : 'moveTo'](px, py);
      }
      x.strokeStyle = col;
      x.lineWidth = 1.5;
      x.stroke();
      x.lineWidth = 1;
      x.lineTo(w - 46, y0 + gh - 4);
      x.lineTo(6, y0 + gh - 4);
      x.fillStyle = col.replace('rgb(', 'rgba(').replace(')', ',.14)');
      if (col[0] === '#') x.fillStyle = 'rgba(255,61,242,.14)';
      x.fill();
      x.fillStyle = col;
      x.font = MONO;
      x.fillText(
        ['CPU', 'NET', 'GPU'][g] + ' ' + String(Math.floor(40 + 50 * hash(Math.floor(t * 2), g))) + '%',
        w - 42,
        y0 + 12
      );
    }
  },
  map(x, w, h, t, p) {
    chrome(x, w, h, 'ctOS // CITY GRID', p, t);
    x.strokeStyle = 'rgba(255,255,255,.07)';
    for (let i = 0; i < w; i += 16) {
      x.beginPath();
      x.moveTo(i, 14);
      x.lineTo(i, h);
      x.stroke();
    }
    for (let j = 14; j < h; j += 16) {
      x.beginPath();
      x.moveTo(0, j);
      x.lineTo(w, j);
      x.stroke();
    }
    x.strokeStyle = p.c1;
    x.globalAlpha = 0.55;
    for (let k = 0; k < 7; k++) {
      const a = hash(k, p.seed);
      x.beginPath();
      if (k % 2) {
        x.moveTo(a * w, 14);
        x.lineTo(a * w + (hash(k, 3) - 0.5) * 60, h);
      } else {
        x.moveTo(0, 18 + a * (h - 20));
        x.lineTo(w, 18 + hash(k, 4) * (h - 20));
      }
      x.stroke();
    }
    x.globalAlpha = 1;
    for (let i = 0; i < 6; i++) {
      const nx = 20 + hash(i, p.seed) * (w - 40),
        ny = 26 + hash(i, 9) * (h - 40),
        r = (t * 0.5 + i * 0.27) % 1;
      x.strokeStyle = i === 0 ? p.c2 : p.c1;
      x.globalAlpha = 1 - r;
      x.beginPath();
      x.arc(nx, ny, 3 + r * 22, 0, 6.283);
      x.stroke();
      x.globalAlpha = 1;
      x.fillStyle = i === 0 ? p.c2 : '#fff';
      x.fillRect(nx - 1.5, ny - 1.5, 3, 3);
    }
    const bx = 20 + hash(0, p.seed) * (w - 40) + 8,
      by = 26 + hash(0, 9) * (h - 40) - 4;
    x.fillStyle = 'rgba(0,0,0,.7)';
    x.fillRect(bx, by, 70, 28);
    x.strokeStyle = p.c2;
    x.strokeRect(bx + 0.5, by + 0.5, 69, 27);
    x.fillStyle = '#fff';
    x.font = MONO;
    x.fillText('ID ' + (4400 + Math.floor(hash(Math.floor(t / 3)) * 99)) + '-A', bx + 4, by + 11);
    x.fillStyle = p.c2;
    x.fillText('THREAT ' + Math.floor(10 + 30 * hash(Math.floor(t))) + '%', bx + 4, by + 22);
  },
  code(x, w, h, t, p) {
    chrome(x, w, h, 'main.rs — editor', p, t);
    const rowH = 9,
      off = t * 12,
      base = Math.floor(off / rowH),
      pal = ['#9aa7b8', p.c1, p.c2, '#e8c96b', '#7ee787'];
    for (let r = 0; r < Math.ceil((h - 16) / rowH) + 1; r++) {
      const li = r + base,
        y = 18 + r * rowH - (off % rowH),
        ind = Math.floor(hash(li, 1) * 4) * 8;
      x.fillStyle = 'rgba(255,255,255,.22)';
      x.fillRect(5, y, 8, 4);
      let cx = 20 + ind;
      const n = 2 + Math.floor(hash(li, 2) * 4);
      for (let s = 0; s < n; s++) {
        const sw = 8 + Math.floor(hash(li, 3 + s) * 36);
        if (cx + sw > w - 6) break;
        x.fillStyle = pal[Math.floor(hash(li, 20 + s) * pal.length)];
        x.fillRect(cx, y, sw, 4);
        cx += sw + 5;
      }
    }
  },
  net(x, w, h, t, p) {
    chrome(x, w, h, 'NET // TOPOLOGY', p, t);
    const cx = w / 2,
      cy = h / 2 + 7,
      N = 9,
      pts = [];
    for (let i = 0; i < N; i++) {
      const a = (i / N) * 6.283 + Math.sin(t * 0.3 + i) * 0.08;
      pts.push([
        cx + Math.cos(a) * (w * 0.36) * (0.8 + 0.2 * hash(i, p.seed)),
        cy + Math.sin(a) * (h * 0.34),
      ]);
    }
    x.lineWidth = 1;
    pts.forEach(([px, py], i) => {
      x.strokeStyle = 'rgba(255,255,255,.18)';
      x.beginPath();
      x.moveTo(cx, cy);
      x.lineTo(px, py);
      x.stroke();
      const j = (i + 3) % N;
      x.beginPath();
      x.moveTo(px, py);
      x.lineTo(pts[j][0], pts[j][1]);
      x.stroke();
      const f = (t * 0.6 + i * 0.17) % 1;
      x.fillStyle = i % 2 ? p.c2 : p.c1;
      x.fillRect(cx + (px - cx) * f - 1.5, cy + (py - cy) * f - 1.5, 3, 3);
    });
    pts.forEach(([px, py], i) => {
      x.fillStyle = '#04101a';
      x.strokeStyle = i % 3 ? p.c1 : p.c2;
      x.beginPath();
      x.arc(px, py, 5, 0, 6.283);
      x.fill();
      x.stroke();
    });
    x.fillStyle = p.c2;
    x.beginPath();
    x.arc(cx, cy, 7 + Math.sin(t * 3) * 1.5, 0, 6.283);
    x.fill();
  },
  wave(x, w, h, t, p) {
    chrome(x, w, h, 'AUDIO // SPECTRUM', p, t);
    const n = Math.floor(w / 7);
    for (let i = 0; i < n; i++) {
      const v = 0.25 + 0.7 * Math.abs(Math.sin(t * 2.2 + i * 0.45) * Math.sin(t * 0.9 + i * 0.13 + p.seed)),
        bh = v * (h - 30) * 0.8;
      x.fillStyle = i % 2 ? p.c1 : p.c2;
      x.globalAlpha = 0.85;
      x.fillRect(i * 7 + 3, h - 6 - bh, 5, bh);
    }
    x.globalAlpha = 1;
    x.strokeStyle = '#fff';
    x.beginPath();
    for (let i = 0; i <= w; i += 3) {
      const y = 14 + (h - 14) * 0.35 + Math.sin(i * 0.07 + t * 5) * 8 * Math.sin(i * 0.013 + t);
      x[i ? 'lineTo' : 'moveTo'](i, y);
    }
    x.stroke();
  },
  hex(x, w, h, t, p) {
    chrome(x, w, h, 'DECRYPT // 0x7F', p, t);
    x.font = '8px ui-monospace,Menlo,Consolas,monospace';
    const rows = Math.floor((h - 36) / 11),
      tick = Math.floor(t * 3);
    for (let r = 0; r < rows; r++) {
      let s = (0x1000 + (r + tick) * 16).toString(16).toUpperCase() + ' ';
      const cols = Math.max(2, Math.floor((w - 40) / 20));
      for (let c = 0; c < cols; c++)
        s +=
          Math.floor(hash(r + tick * 0.0, c + tick) * 255)
            .toString(16)
            .padStart(2, '0') + ' ';
      x.fillStyle = r === Math.floor(t * 2) % rows ? p.c2 : p.c1;
      x.globalAlpha = r === Math.floor(t * 2) % rows ? 1 : 0.6;
      x.fillText(s, 5, 26 + r * 11, w - 10);
    }
    x.globalAlpha = 1;
    const pr = (t * 0.12) % 1;
    x.fillStyle = 'rgba(255,255,255,.12)';
    x.fillRect(6, h - 12, w - 12, 6);
    x.fillStyle = p.c2;
    x.fillRect(6, h - 12, (w - 12) * pr, 6);
    x.fillStyle = '#fff';
    x.fillText(Math.floor(pr * 100) + '%', w - 28, h - 15);
  },
  radar(x, w, h, t, p) {
    chrome(x, w, h, 'SCAN // RADAR', p, t);
    const cx = w / 2,
      cy = h / 2 + 7,
      R = Math.min(w, h - 16) * 0.42;
    x.strokeStyle = 'rgba(255,255,255,.2)';
    for (let r = 1; r <= 3; r++) {
      x.beginPath();
      x.arc(cx, cy, (R * r) / 3, 0, 6.283);
      x.stroke();
    }
    x.beginPath();
    x.moveTo(cx - R, cy);
    x.lineTo(cx + R, cy);
    x.moveTo(cx, cy - R);
    x.lineTo(cx, cy + R);
    x.stroke();
    const a = t * 1.8;
    for (let k = 0; k < 14; k++) {
      x.strokeStyle = p.c1;
      x.globalAlpha = (1 - k / 14) * 0.5;
      x.beginPath();
      x.moveTo(cx, cy);
      x.lineTo(cx + Math.cos(a - k * 0.06) * R, cy + Math.sin(a - k * 0.06) * R);
      x.stroke();
    }
    x.globalAlpha = 1;
    for (let i = 0; i < 5; i++) {
      const ba = hash(i, p.seed) * 6.283,
        br = (0.25 + hash(i, 5) * 0.7) * R,
        d = (((a - ba) % 6.283) + 6.283) % 6.283;
      x.fillStyle = p.c2;
      x.globalAlpha = Math.max(0, 1 - d / 3.5);
      x.fillRect(cx + Math.cos(ba) * br - 2, cy + Math.sin(ba) * br - 2, 4, 4);
    }
    x.globalAlpha = 1;
  },
  profile(x, w, h, t, p) {
    chrome(x, w, h, 'PROFILER // SUBJECT', p, t);
    const cx = w * 0.32,
      cy = h * 0.52;
    x.strokeStyle = p.c1;
    x.lineWidth = 1.5;
    x.beginPath();
    x.arc(cx, cy - 10, 20, 0, 6.283);
    x.stroke();
    x.beginPath();
    x.moveTo(cx - 36, h - 6);
    x.quadraticCurveTo(cx - 34, cy + 16, cx, cy + 14);
    x.quadraticCurveTo(cx + 34, cy + 16, cx + 36, h - 6);
    x.stroke();
    x.lineWidth = 1;
    const sy = 18 + ((t * 0.5) % 1) * (h - 24);
    x.fillStyle = p.c2;
    x.globalAlpha = 0.6;
    x.fillRect(cx - 40, sy, 80, 2);
    x.globalAlpha = 1;
    x.strokeStyle = p.c2;
    [
      [cx - 40, 22],
      [cx + 40, 22],
      [cx - 40, h - 8],
      [cx + 40, h - 8],
    ].forEach(([bx, by], i) => {
      const sx = i % 2 ? -1 : 1,
        sy2 = i < 2 ? 1 : -1;
      x.beginPath();
      x.moveTo(bx, by + 8 * sy2);
      x.lineTo(bx, by);
      x.lineTo(bx + 8 * -sx * -1 * (i % 2 ? -1 : 1), by);
      x.stroke();
    });
    for (let i = 0; i < 5; i++) {
      const y = 26 + i * 16,
        v = 0.3 + 0.7 * hash(Math.floor(t * 1.5) + i, i);
      x.fillStyle = 'rgba(255,255,255,.12)';
      x.fillRect(w * 0.58, y, w * 0.36, 5);
      x.fillStyle = i % 2 ? p.c2 : p.c1;
      x.fillRect(w * 0.58, y, w * 0.36 * v, 5);
      x.fillStyle = '#9aa7b8';
      x.font = '7px ui-monospace,monospace';
      x.fillText(['AGE', 'INCOME', 'RISK', 'NET', 'TRUST'][i], w * 0.58, y - 2);
    }
  },
};
export const SCREEN_KINDS = Object.keys(KINDS);

export function makeScreen(kind, p, w = 256, h = 144) {
  const cv = document.createElement('canvas');
  cv.width = w;
  cv.height = h;
  const x = cv.getContext('2d'),
    tex = new THREE.CanvasTexture(cv);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = 4;
  const fn = KINDS[kind] || KINDS.stats;
  const paint = t => {
    x.save();
    fn(x, w, h, t, p);
    x.restore();
    tex.needsUpdate = true;
  };
  paint(0);
  return { tex, paint, kind };
}
