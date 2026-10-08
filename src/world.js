import * as THREE from 'three';
import { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment.js';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { makePBR, pbr, pbrT } from './materials.js';
import { makeScreen } from './screens.js';

const TUNE = {
  sun: 3.2,
  moon: 0.7,
  hemiDay: 0.6,
  hemiNight: 0.22,
  ceiling: 4.5,
  fill: 6,
  rgb: 8.5,
  envDay: 0.45,
  envNight: 0.1,
};
const ss = (a, b, x) => {
  const t = Math.min(1, Math.max(0, (x - a) / (b - a)));
  return t * t * (3 - 2 * t);
};
const mix = (a, b, t) => a + (b - a) * t;
const C = h => new THREE.Color(h);
const cvs = (w, h) => {
  const c = document.createElement('canvas');
  c.width = w;
  c.height = h;
  return c;
};
const mkTex = (c, rep) => {
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = 4;
  if (rep) {
    t.wrapS = t.wrapT = THREE.RepeatWrapping;
    t.repeat.set(rep[0], rep[1]);
  }
  return t;
};
const wrapText = (x, t, X, Y, mw, lh) => {
  let line = '',
    y = Y;
  for (const w of String(t || '').split(' ')) {
    const tt = line ? line + ' ' + w : w;
    if (x.measureText(tt).width > mw && line) {
      x.fillText(line, X, y);
      line = w;
      y += lh;
    } else line = tt;
  }
  x.fillText(line, X, y);
  return y + lh;
};
const rr = (x, X, Y, W, H, R) => {
  x.beginPath();
  x.moveTo(X + R, Y);
  x.arcTo(X + W, Y, X + W, Y + H, R);
  x.arcTo(X + W, Y + H, X, Y + H, R);
  x.arcTo(X, Y + H, X, Y, R);
  x.arcTo(X, Y, X + W, Y, R);
  x.closePath();
};
const hr = (k, i) => (((Math.sin(k * 12.9898 + i * 78.233) * 43758.5453) % 1) + 1) % 1;
const NIGHT_TOP = C(0x04061a),
  NIGHT_HOR = C(0x1b1040),
  DAY_TOP = C(0x3f86d8),
  DAY_HOR = C(0xc5e1ff),
  DUSK_TOP = C(0x5b5aa8),
  DUSK_HOR = C(0xff8a4a),
  WHITE = C(0xffffff),
  GRAY_TOP = C(0x8a96a3),
  GRAY_HOR = C(0xb9c0c8);

export function buildWorld(R, site, opts = {}) {
  const [cr, cg, cb] = site.accentColor.trim().split(/\s+/).map(Number),
    A = `${cr},${cg},${cb}`,
    accent = new THREE.Color().setRGB(cr / 255, cg / 255, cb / 255, THREE.SRGBColorSpace);
  const dk = `rgb(${(cr * 0.45) | 0},${(cg * 0.45) | 0},${(cb * 0.45) | 0})`;
  const PBR = makePBR({ lowRes: opts.lowRes, aniso: Math.min(8, R.capabilities.getMaxAnisotropy()) }),
    RMq = matchMedia('(prefers-reduced-motion:reduce)').matches;
  const THEMES = {
    cyber: {
      hue: (h, o) => 0.5 + 0.38 * (0.5 + 0.5 * Math.sin((h + o) * 6.283)),
      rain: '#19e3ff',
      head: '#e6ffff',
      txt: '#4be8ff',
    },
    rgb: { hue: (h, o) => (h + o) % 1, rain: '#1fe07a', head: '#d6ffe6', txt: '#28ff8c' },
    matrix: { hue: () => 0.37, rain: '#1fe07a', head: '#d6ffe6', txt: '#28ff8c' },
    vapor: {
      hue: (h, o) => 0.82 - 0.32 * (0.5 + 0.5 * Math.sin((h + o) * 6.283)),
      rain: '#ff71ce',
      head: '#ffffff',
      txt: '#ff9bdc',
    },
    amber: { hue: () => 0.09, rain: '#ffb000', head: '#ffe2a0', txt: '#ffb000' },
    gold: { hue: () => 0.13, rain: '#ffd700', head: '#fff6c0', txt: '#ffd700' },
  };
  let nightK = 0,
    theme = 'cyber',
    wxText = '',
    partyT = 0,
    tvMode = 'home',
    tvAcc = 0,
    curH = 10.5,
    wxs = { cloud: 0.15, rain: 0, fog: 0 };
  const hueOf = (h, o) => THEMES[theme].hue(h, o);
  const scene = new THREE.Scene();
  scene.fog = new THREE.FogExp2(0x9ab8d8, 0.007);
  let seed = 11;
  const rnd = () => {
    seed = (seed * 16807) % 2147483647;
    return seed / 2147483647;
  };
  const std = (c, ro = 0.8, me = 0, o) =>
    new THREE.MeshStandardMaterial(Object.assign({ color: c, roughness: ro, metalness: me }, o));
  const BOX = new THREE.BoxGeometry(1, 1, 1),
    D = new THREE.Object3D(),
    redo = [];
  const put = (geo, mat, x, y, z, p, cast = true) => {
    const m = new THREE.Mesh(geo, mat);
    m.position.set(x, y, z);
    m.castShadow = cast;
    m.receiveShadow = true;
    if (p && p.userData.merge) m.userData.m = 1;
    (p || scene).add(m);
    return m;
  };
  const geoCache = new Map(),
    tiledGeo = (w, h, d, t) => {
      const key = [w, h, d, t].join(',');
      let g = geoCache.get(key);
      if (g) return g;
      g = BOX.clone();
      const uv = g.attributes.uv,
        dims = [
          [d, h],
          [d, h],
          [w, d],
          [w, d],
          [w, h],
          [w, h],
        ];
      for (let f = 0; f < 6; f++)
        for (let i = 0; i < 4; i++) {
          const k = f * 4 + i;
          uv.setXY(k, (uv.getX(k) * dims[f][0]) / t, (uv.getY(k) * dims[f][1]) / t);
        }
      geoCache.set(key, g);
      return g;
    };
  const bx = (w, h, d, mat, x, y, z, p, cast) => {
    const m = put(mat.userData.tile ? tiledGeo(w, h, d, mat.userData.tile) : BOX, mat, x, y, z, p, cast);
    m.scale.set(w, h, d);
    return m;
  };
  const cyl = (r1, r2, h, seg, mat, x, y, z, p) =>
    put(new THREE.CylinderGeometry(r1, r2, h, seg), mat, x, y, z, p);
  const neon = new THREE.MeshBasicMaterial({ color: accent });
  // Plant kit: curved leaf blade, leaf materials, ceramic pots, rosettes
  const leafGeo = (() => {
    const g = new THREE.PlaneGeometry(0.2, 0.42, 4, 8),
      p = g.attributes.position;
    for (let i = 0; i < p.count; i++) {
      const x = p.getX(i),
        t = (p.getY(i) + 0.21) / 0.42,
        w = Math.sin(Math.PI * Math.pow(t, 0.75));
      p.setXYZ(i, x * (0.15 + w * 1.1), t * 0.42, t * t * 0.1 + Math.abs(x) * w * 0.9);
    }
    g.computeVertexNormals();
    return g;
  })();
  const lf1 = std(0x2f6b3a, 0.55, 0, { side: THREE.DoubleSide }),
    lf2 = std(0x469a4f, 0.5, 0, { side: THREE.DoubleSide }),
    lf3 = std(0x1f4f33, 0.6, 0, { side: THREE.DoubleSide });
  const leafAt = (x, y, z, az, tilt, s, m, p) => {
    const l = put(leafGeo, m, x, y, z, p || room, false);
    l.rotation.set(tilt, az, 0, 'YXZ');
    l.scale.set(s, s, s);
    return l;
  };
  const rosette = (x, y, z, n, s, m, p) => {
    for (let i = 0; i < n; i++)
      leafAt(x, y, z, i * 2.4, 0.75 + (i % 3) * 0.18, s * (1 - (i % 3) * 0.12), m, p);
  };
  const pot = (x, z, r, h, c, y0 = 0) => {
    const m = std(c, 0.5);
    cyl(r * 1.05, r * 0.95, 0.016, 20, m, x, y0 + 0.008, z, room);
    cyl(r, r * 0.72, h, 20, m, x, y0 + 0.016 + h / 2, z, room);
    cyl(r * 1.07, r, 0.035, 20, m, x, y0 + 0.016 + h, z, room);
    cyl(r * 0.93, r * 0.93, 0.01, 16, std(0x2a1f18, 1), x, y0 + 0.016 + h + 0.004, z, room);
    return y0 + 0.016 + h + 0.009;
  };
  try {
    const pm = new THREE.PMREMGenerator(R);
    scene.environment = pm.fromScene(new RoomEnvironment(), 0.04).texture;
    pm.dispose();
  } catch (e) {}

  // ---- Lights ----
  const hemi = new THREE.HemisphereLight(0xcfe3ff, 0x5a4a3a, 0.6);
  scene.add(hemi);
  const sun = new THREE.DirectionalLight(0xffffff, 3);
  sun.castShadow = true;
  sun.shadow.mapSize.set(1024, 1024);
  Object.assign(sun.shadow.camera, { left: -10, right: 10, top: 10, bottom: -10, near: 1, far: 160 });
  sun.shadow.bias = -0.0005;
  sun.shadow.normalBias = 0.03;
  sun.target.position.set(2, 1, -1);
  scene.add(sun, sun.target);
  const ceil = new THREE.PointLight(0xfff0dd, 0, 14, 2);
  ceil.position.set(0, 1.7, 0);
  scene.add(ceil);
  const fill = new THREE.PointLight(0xcfe3ff, 0, 9, 2);
  fill.position.set(3.2, 1.8, -1);
  scene.add(fill);
  const rgbA = new THREE.PointLight(0xffffff, 0, 9, 2),
    rgbB = new THREE.PointLight(0xffffff, 0, 9, 2);
  rgbA.position.set(-2.2, 1.15, -3.9);
  rgbB.position.set(-2.4, 1.0, 1.2);
  const rgbC = new THREE.PointLight(0xffffff, 0, 9, 2);
  rgbC.position.set(1.4, 1.15, 3.4);
  scene.add(rgbA, rgbB, rgbC);

  // ---- Sky dome (sun, moon, stars, gradient) ----
  const skyU = {
    top: { value: new THREE.Color() },
    hor: { value: new THREE.Color() },
    sunDir: { value: new THREE.Vector3(0, 1, 0) },
    moonDir: { value: new THREE.Vector3(0, -1, 0) },
    night: { value: 0 },
    sunVis: { value: 1 },
  };
  const sky = new THREE.Mesh(
    new THREE.SphereGeometry(500, 32, 16),
    new THREE.ShaderMaterial({
      uniforms: skyU,
      side: THREE.BackSide,
      depthWrite: false,
      fog: false,
      vertexShader:
        'varying vec3 vD;void main(){vD=position;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);}',
      fragmentShader: `varying vec3 vD;uniform vec3 top,hor,sunDir,moonDir;uniform float night,sunVis;
float hs(vec3 p){return fract(sin(dot(p,vec3(12.9898,78.233,37.719)))*43758.5453);}
void main(){vec3 d=normalize(vD);float e=clamp(d.y,0.,1.);vec3 c=mix(hor,top,pow(e,.5));
float sd=max(dot(d,normalize(sunDir)),0.);c+=vec3(1.,.85,.6)*(pow(sd,1200.)*4.+pow(sd,10.)*.2)*sunVis;
float md=max(dot(d,normalize(moonDir)),0.);c+=vec3(.85,.92,1.)*pow(md,2500.)*2.5*night;
float s=step(.997,hs(floor(d*260.)))*night*smoothstep(.04,.3,d.y);c+=vec3(s);
gl_FragColor=vec4(c,1.);
#include <tonemapping_fragment>
#include <colorspace_fragment>
}`,
    })
  );
  sky.renderOrder = -1;
  sky.frustumCulled = false;
  scene.add(sky);

  // ---- RGB system: strips, hex panels and rainbow-mapped parts all cycle color and brighten at night ----
  const rgb = [],
    rbMats = [],
    rgbMat = off => {
      const m = new THREE.MeshBasicMaterial({ color: 0xffffff });
      rgb.push({ m, off });
      return m;
    };
  const rbCv = cvs(256, 8),
    rbx = rbCv.getContext('2d');
  for (let i = 0; i < 256; i++) {
    rbx.fillStyle = `hsl(${(i / 256) * 360},100%,50%)`;
    rbx.fillRect(i, 0, 1, 8);
  }
  const rainbow = mkTex(rbCv, [2, 1]),
    rbMat = o => {
      const m = new THREE.MeshBasicMaterial(Object.assign({ map: rainbow }, o));
      rbMats.push(m);
      return m;
    };

  // ---- Room shell ----
  const room = new THREE.Group();
  room.userData.merge = true;
  scene.add(room);
  const fc = cvs(256, 256),
    fx = fc.getContext('2d');
  for (let i = 0; i < 4; i++) {
    const l = 150 + Math.floor(rnd() * 40);
    fx.fillStyle = `rgb(${l},${(l * 0.72) | 0},${(l * 0.46) | 0})`;
    fx.fillRect(i * 64, 0, 64, 256);
    for (let k = 0; k < 30; k++) {
      fx.fillStyle = `rgba(0,0,0,${rnd() * 0.08})`;
      fx.fillRect(i * 64 + rnd() * 60, rnd() * 256, 1.5, rnd() * 60 + 10);
    }
    fx.fillStyle = 'rgba(0,0,0,.45)';
    fx.fillRect(i * 64, 0, 2, 256);
    fx.fillRect(i * 64, rnd() * 256, 64, 2);
  }
  const floor = put(new THREE.PlaneGeometry(8, 10), pbr(PBR.floor, 4, 5, 0xffffff), 0, 0, 0, room, false);
  floor.rotation.x = -Math.PI / 2;
  const plaster = pbrT(PBR.plaster, 2, 0xe9e4da),
    slate = pbrT(PBR.concrete, 2.4, 0x7e8a99),
    trim = std(0xf2eee6, 0.7),
    frameM = std(0x15191d, 0.5, 0.4),
    wood = pbrT(PBR.wood, 0.9, 0xffffff),
    metal = pbrT(PBR.metal, 0.8, 0x2c323a, { metalness: 0.8 }),
    dark = std(0x0e1114, 0.4, 0.6),
    walnut = pbrT(PBR.wood, 0.9, 0x7a5a48),
    leaf = std(0x2f6b3a, 0.8);
  const ceilPl = pbrT(PBR.plaster, 2, 0xf0ece4);
  const CEIL_N = C(0x2a2838);
  bx(8.4, 3, 0.2, slate, 0, 1.5, -5.1, room);
  bx(8.4, 3, 0.2, plaster, 0, 1.5, 5.1, room);
  bx(0.2, 3, 10.4, plaster, -4.1, 1.5, 0, room);
  bx(8.4, 0.2, 10.4, ceilPl, 0, 3.1, 0, room);
  bx(0.2, 3, 2.6, plaster, 4.1, 1.5, -3.9, room);
  bx(0.2, 3, 4.6, plaster, 4.1, 1.5, 2.9, room);
  bx(0.2, 0.9, 3.2, plaster, 4.1, 0.45, -1, room);
  bx(0.2, 0.5, 3.2, plaster, 4.1, 2.75, -1, room);
  bx(0.05, 1.6, 0.035, frameM, 4, 1.7, -1, room);
  bx(0.05, 0.035, 3.2, frameM, 4, 1.7, -1, room);
  bx(0.4, 0.05, 3.4, trim, 3.9, 0.92, -1, room);
  bx(0.1, 0.06, 3.3, frameM, 4, 2.5, -1, room);
  bx(0.1, 1.6, 0.07, frameM, 4, 1.7, -2.6, room);
  bx(0.1, 1.6, 0.07, frameM, 4, 1.7, 0.6, room);
  bx(0.03, 0.14, 0.03, metal, 3.95, 1.7, -0.9, room, false);
  bx(8, 0.1, 0.03, trim, 0, 0.05, 4.97, room, false);
  bx(0.03, 0.1, 9.9, trim, -3.97, 0.05, 0, room, false);
  bx(8, 0.1, 0.03, trim, 0, 0.05, -4.97, room, false);
  // Glass window: a tinted, glossy pane plus a glare streak that picks up the RGB glow at night
  const glass = new THREE.Mesh(
    new THREE.PlaneGeometry(3.2, 1.6),
    new THREE.MeshPhysicalMaterial({
      color: 0xdfeeff,
      transparent: true,
      opacity: 0.16,
      roughness: 0.04,
      metalness: 0,
      clearcoat: 1,
      clearcoatRoughness: 0.05,
      envMapIntensity: 1.4,
      side: THREE.DoubleSide,
      depthWrite: false,
    })
  );
  glass.position.set(4.02, 1.7, -1);
  glass.rotation.y = Math.PI / 2;
  room.add(glass);
  const glc = cvs(256, 256),
    glx = glc.getContext('2d'),
    glg = glx.createLinearGradient(0, 0, 256, 256);
  [
    [0.25, 0],
    [0.38, 0.55],
    [0.46, 0],
    [0.58, 0.3],
    [0.62, 0],
  ].forEach(([s, a]) => glg.addColorStop(s, `rgba(255,255,255,${a})`));
  glx.fillStyle = glg;
  glx.fillRect(0, 0, 256, 256);
  const glareM = new THREE.MeshBasicMaterial({
    map: mkTex(glc),
    transparent: true,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
    opacity: 0.4,
    toneMapped: false,
  });
  const glare = new THREE.Mesh(new THREE.PlaneGeometry(3.2, 1.6), glareM);
  glare.position.set(4.0, 1.7, -1);
  glare.rotation.y = Math.PI / 2;
  room.add(glare);
  const curt = pbrT(PBR.fabric, 0.5, 0xcfc6b4);
  bx(0.05, 2.3, 0.55, curt, 3.88, 1.45, -2.95, room);
  bx(0.05, 2.3, 0.55, curt, 3.88, 1.45, 0.95, room);
  bx(0.03, 0.03, 4.6, metal, 3.86, 2.65, -1, room, false);
  // Ceiling cove LEDs and ceiling lights
  for (let k = 0; k < 4; k++) {
    bx(1.95, 0.04, 0.06, rgbMat(k * 0.08), -2.925 + k * 1.95, 2.96, -4.94, room, false);
    bx(1.95, 0.04, 0.06, rgbMat(0.32 + k * 0.08), -2.925 + k * 1.95, 2.96, 4.94, room, false);
    bx(0.06, 0.04, 2.45, rgbMat(0.64 + k * 0.08), -3.94, 2.96, -3.675 + k * 2.45, room, false);
  }
  const ceilMat = std(0xffffff, 0.5, 0, { emissive: 0xfff2dd, emissiveIntensity: 0.3 });
  bx(1.8, 0.04, 0.5, ceilMat, -1.8, 2.98, 0, room, false);
  bx(1.8, 0.04, 0.5, ceilMat, 1.8, 2.98, 0, room, false);
  const rug = put(
    new THREE.PlaneGeometry(3.2, 2.6),
    pbr(PBR.rug, 1, 1, 0xffffff),
    -2.3,
    0.012,
    1.2,
    room,
    false
  );
  rug.rotation.x = -Math.PI / 2;
  // Night-only neon outline traced on the rug (cyan diamonds, magenta border), plus drifting dust that catches the light
  const ledC = cvs(1024, 832),
    ledX = ledC.getContext('2d'),
    LW = 1024,
    LH = 832,
    MAG = '#ff59d8',
    CYA = '#5eeaff';
  const neonStroke = (path, col, core, lw, dash) => {
    ledX.save();
    ledX.lineJoin = 'round';
    ledX.lineCap = 'round';
    ledX.shadowColor = col;
    ledX.shadowBlur = 26;
    ledX.setLineDash(dash || []);
    ledX.strokeStyle = core;
    ledX.lineWidth = lw;
    path();
    ledX.stroke();
    ledX.restore();
  };
  const rectP = (ix, iy, r) => () => {
    ledX.beginPath();
    rr(ledX, ix, iy, LW - ix * 2, LH - iy * 2, r);
  };
  const diaP = d => () => {
    ledX.beginPath();
    ledX.moveTo(LW * (0.5 - d), LH * 0.5);
    ledX.lineTo(LW * 0.5, LH * (0.5 - d));
    ledX.lineTo(LW * (0.5 + d), LH * 0.5);
    ledX.lineTo(LW * 0.5, LH * (0.5 + d));
    ledX.closePath();
  };
  neonStroke(rectP(LW * 0.0425, LH * 0.0425, 18), MAG, '#fff2fb', 12, [44, 26]);
  neonStroke(diaP(0.25), CYA, '#eafeff', 10);
  neonStroke(diaP(0.0833), MAG, '#ffc9f2', 8);
  const ledRugM = new THREE.MeshBasicMaterial({
      map: mkTex(ledC),
      transparent: true,
      opacity: 0,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
      toneMapped: false,
    }),
    ledRug = new THREE.Mesh(new THREE.PlaneGeometry(3.2, 2.6), ledRugM);
  ledRug.rotation.x = -Math.PI / 2;
  ledRug.position.set(-2.3, 0.016, 1.2);
  ledRug.visible = false;
  room.add(ledRug);
  const DN = 90,
    dustA = new Float32Array(DN * 3),
    dustB = new Float32Array(DN * 3);
  for (let i = 0; i < DN; i++) {
    dustB[i * 3] = -3.5 + rnd() * 7;
    dustB[i * 3 + 1] = 0.3 + rnd() * 2.4;
    dustB[i * 3 + 2] = -4.5 + rnd() * 9;
  }
  const dustG = new THREE.BufferGeometry();
  dustG.setAttribute('position', new THREE.BufferAttribute(dustA, 3));
  const dustM = new THREE.PointsMaterial({
      color: 0xcfe0ff,
      size: 0.03,
      map: (() => {
        const c = cvs(32, 32),
          x = c.getContext('2d'),
          g = x.createRadialGradient(16, 16, 0, 16, 16, 16);
        g.addColorStop(0, 'rgba(255,255,255,1)');
        g.addColorStop(0.4, 'rgba(255,255,255,.35)');
        g.addColorStop(1, 'rgba(255,255,255,0)');
        x.fillStyle = g;
        x.fillRect(0, 0, 32, 32);
        return new THREE.CanvasTexture(c);
      })(),
      alphaTest: 0.01,
      transparent: true,
      opacity: 0,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
      sizeAttenuation: true,
    }),
    dust = new THREE.Points(dustG, dustM);
  dust.frustumCulled = false;
  dust.visible = false;
  dust.raycast = () => {};
  scene.add(dust);

  // ---- Stations ----
  const projects = site.projects,
    NP = projects.length;
  const st = [
    {
      type: 'about',
      x: -1.8,
      z: -0.3,
      look: [-3.95, 1.35, 1.2],
      zoom: 0.8,
      anchor: new THREE.Vector3(-3.7, 2.2, 1.2),
    },
    {
      type: 'projects',
      x: 1.2,
      z: -1.3,
      look: [2.5, 0.78, -0.8],
      zoom: 0.5,
      anchor: new THREE.Vector3(2.45, 1.3, -0.8),
    },
    {
      type: 'skills',
      x: 2.6,
      z: -2.6,
      look: [2.5, 0.88, -1.55],
      zoom: 0.6,
      anchor: new THREE.Vector3(2.5, 1.3, -1.55),
    },
    {
      type: 'contact',
      x: -2.2,
      z: -3.1,
      look: [-2.2, 1.3, -4.5],
      zoom: 0.75,
      anchor: new THREE.Vector3(-2.2, 1.9, -4.5),
    },
  ];
  st.forEach((s, i) => {
    s.i = i;
  });
  const screenMat = t => new THREE.MeshBasicMaterial({ map: t, toneMapped: false });
  const dots = x =>
    [
      ['#ff5f57', 18],
      ['#febc2e', 38],
      ['#28c840', 58],
    ].forEach(([c, cx]) => {
      x.fillStyle = c;
      x.beginPath();
      x.arc(cx, 17, 6, 0, 6.283);
      x.fill();
    });
  const screen = (w, h, paint) => {
    const cv = cvs(w, h),
      t = mkTex(cv),
      go = () => {
        paint(cv.getContext('2d'), w, h);
        t.needsUpdate = true;
      };
    go();
    redo.push(go);
    t.userData.go = go;
    return t;
  };

  // Smart TV home screen (About)
  const tvTex = screen(1024, 576, (x, W, H) => {
    const g = x.createLinearGradient(0, 0, W, H);
    g.addColorStop(0, '#0a1020');
    g.addColorStop(1, '#14203a');
    x.fillStyle = g;
    x.fillRect(0, 0, W, H);
    const rg = x.createRadialGradient(W * 0.8, H * 0.3, 10, W * 0.8, H * 0.3, 380);
    rg.addColorStop(0, `rgba(${A},.35)`);
    rg.addColorStop(1, 'rgba(0,0,0,0)');
    x.fillStyle = rg;
    x.fillRect(0, 0, W, H);
    x.font = '600 26px "Exo 2",sans-serif';
    ['Home', 'Apps', 'Library', 'Settings'].forEach((t, i) => {
      x.fillStyle = i ? '#7f93a8' : '#fff';
      x.fillText(t, 48 + i * 130, 56);
    });
    x.fillStyle = `rgb(${A})`;
    x.fillRect(48, 68, 56, 4);
    x.textAlign = 'right';
    x.fillStyle = '#8aa4bd';
    x.fillText((wxText ? wxText + '   ' : '') + 'Smart TV', W - 48, 56);
    x.textAlign = 'left';
    x.fillStyle = '#e8f6ff';
    x.font = '800 84px "Exo 2",sans-serif';
    x.fillText(site.name, 48, 230, W - 420);
    x.fillStyle = `rgb(${A})`;
    x.font = '600 36px "Exo 2",sans-serif';
    x.fillText(site.role, 48, 284, W - 420);
    x.fillStyle = '#9fb4c8';
    x.font = '400 28px "Exo 2",sans-serif';
    wrapText(x, site.tagline, 48, 336, W - 480, 38);
    const av = x.createRadialGradient(W - 190, 210, 10, W - 190, 230, 120);
    av.addColorStop(0, `rgba(${A},.9)`);
    av.addColorStop(1, `rgba(${A},.25)`);
    x.fillStyle = av;
    x.beginPath();
    x.arc(W - 190, 230, 105, 0, 6.283);
    x.fill();
    x.fillStyle = '#04101a';
    x.font = '800 80px "Exo 2",sans-serif';
    x.textAlign = 'center';
    x.fillText(
      site.name
        .split(/\s+/)
        .map(w => w[0])
        .join('')
        .slice(0, 2)
        .toUpperCase(),
      W - 190,
      258
    );
    x.textAlign = 'left';
    site.skills.slice(0, 6).forEach((s, i) => {
      const tx = 48 + i * 156,
        ty = H - 170;
      rr(x, tx, ty, 142, 112, 16);
      x.fillStyle = `hsla(${(i * 47 + 200) % 360},55%,35%,.9)`;
      x.fill();
      x.fillStyle = '#fff';
      x.textAlign = 'center';
      x.font = '700 46px "Exo 2",sans-serif';
      x.fillText(s[0].toUpperCase(), tx + 71, ty + 58);
      x.font = '500 22px "Exo 2",sans-serif';
      x.fillText(s, tx + 71, ty + 94, 128);
      x.textAlign = 'left';
    });
  });
  // Tablet home screen (Skills)
  const tabTex = screen(640, 440, (x, W, H) => {
    const g = x.createLinearGradient(0, 0, W, H);
    g.addColorStop(0, '#171a3a');
    g.addColorStop(1, `rgb(${(cr * 0.5) | 0},${(cg * 0.5) | 0},${(cb * 0.6) | 0})`);
    x.fillStyle = g;
    x.fillRect(0, 0, W, H);
    x.fillStyle = '#fff';
    x.font = '600 20px "Exo 2",sans-serif';
    x.fillText('Skills', 24, 34);
    x.textAlign = 'right';
    x.fillText('Wi-Fi  ▮▮▮', W - 24, 34);
    x.textAlign = 'left';
    site.skills.slice(0, 8).forEach((s, i) => {
      const tx = 40 + (i % 4) * 150,
        ty = 70 + Math.floor(i / 4) * 150;
      rr(x, tx, ty, 100, 100, 24);
      x.fillStyle = `hsl(${(i * 53 + 190) % 360},60%,45%)`;
      x.fill();
      x.fillStyle = '#fff';
      x.textAlign = 'center';
      x.font = '700 50px "Exo 2",sans-serif';
      x.fillText(s[0].toUpperCase(), tx + 50, ty + 66);
      x.font = '500 19px "Exo 2",sans-serif';
      x.fillText(s, tx + 50, ty + 126, 140);
      x.textAlign = 'left';
    });
    rr(x, 150, H - 70, 340, 52, 26);
    x.fillStyle = 'rgba(255,255,255,.18)';
    x.fill();
    [0, 1, 2, 3].forEach(i => {
      x.fillStyle = `hsl(${i * 80 + 20},70%,60%)`;
      x.beginPath();
      x.arc(200 + i * 80, H - 44, 16, 0, 6.283);
      x.fill();
    });
  });
  // PC monitor: terminal window (Contact) over animated code rain
  const PWd = 640,
    PHt = 360,
    rainCv = cvs(PWd, PHt),
    rx = rainCv.getContext('2d'),
    pcCv = cvs(PWd, PHt),
    pcx = pcCv.getContext('2d'),
    termCv = cvs(PWd, PHt),
    pcTex = mkTex(pcCv);
  const termLines = [];
  let termInput = '',
    cursorOn = true;
  const say = (...ls) => {
    termLines.push(...ls);
    while (termLines.length > 200) termLines.shift();
  };
  say(
    '> open_channel --to ' + site.name.toLowerCase().replace(/\s+/g, '.'),
    site.email,
    ...site.links.slice(0, 2).map(l => `${l.label.toLowerCase()}: ${l.url.replace(/^https?:\/\//, '')}`),
    "type 'help' for commands"
  );
  const drawTerm = () => {
    const x = termCv.getContext('2d'),
      T = THEMES[theme];
    x.clearRect(0, 0, PWd, PHt);
    rr(x, 30, 24, PWd - 60, PHt - 48, 10);
    x.fillStyle = 'rgba(3,12,8,.86)';
    x.fill();
    const col2 = nightK > 0.5 ? T.txt : `rgb(${A})`;
    x.strokeStyle = col2;
    x.lineWidth = 2;
    x.stroke();
    x.save();
    x.translate(30, 24);
    dots(x);
    x.restore();
    x.font = '500 24px ui-monospace,monospace';
    termLines.slice(-7).forEach((l, i) => {
      x.fillStyle = l.startsWith('>') ? col2 : '#e8f6ff';
      x.fillText(l, 54, 86 + i * 30, PWd - 110);
    });
    x.fillStyle = col2;
    x.fillText('$ ' + termInput + (cursorOn ? '▌' : ''), 54, 86 + 7 * 30 + 2, PWd - 110);
  };
  drawTerm();
  redo.push(drawTerm);
  const term = {
    setInput(v) {
      termInput = v.slice(0, 40);
      drawTerm();
    },
    exec(cmd) {
      const c = cmd.trim(),
        a = c.toLowerCase().split(/\s+/);
      termInput = '';
      if (!c) {
        drawTerm();
        return null;
      }
      say('> ' + c);
      let out = null;
      if (c.toLowerCase() === 'sudo hire me') {
        say('[sudo] password for recruiter: ********', 'ACCESS GRANTED. Gold theme unlocked.', site.email);
        theme = 'gold';
        partyT = 4;
      } else if (a[0] === 'help')
        say('help  whoami  ls  open <n>', 'theme cyber|rgb|matrix|vapor|amber', 'weather  clear');
      else if (a[0] === 'whoami') say(`${site.name}, ${site.role}`);
      else if (a[0] === 'ls' || a[0] === 'projects') projects.forEach((p, i) => say(`${i + 1}. ${p.title}`));
      else if (a[0] === 'open') {
        const n = parseInt(a[1], 10);
        if (n >= 1 && n <= NP) {
          say(`opening notebook, page ${n}`);
          out = { open: n - 1 };
        } else say('usage: open <1-' + NP + '>');
      } else if (a[0] === 'theme') {
        if (a[1] && THEMES[a[1]] && a[1] !== 'gold') {
          theme = a[1];
          say('theme: ' + a[1]);
        } else say('themes: cyber rgb matrix vapor amber');
      } else if (a[0] === 'weather') say(wxText || 'no weather data');
      else if (a[0] === 'clear') termLines.length = 0;
      else say('command not found: ' + a[0]);
      drawTerm();
      return out;
    },
  };
  const cols = Math.floor(PWd / 16),
    drops = Array.from({ length: cols }, () => rnd() * 22),
    gly = '01{}<>/=$#@%&*+-';
  let monMode = -1,
    wallK = -1;
  const paintWall = () => {
    const g = rx.createLinearGradient(0, 0, PWd, PHt);
    g.addColorStop(0, '#0f1a30');
    g.addColorStop(1, `rgb(${(cr * 0.55) | 0},${(cg * 0.55) | 0},${(cb * 0.7) | 0})`);
    rx.fillStyle = g;
    rx.fillRect(0, 0, PWd, PHt);
    const rg2 = rx.createRadialGradient(PWd * 0.75, PHt * 0.3, 10, PWd * 0.75, PHt * 0.3, 260);
    rg2.addColorStop(0, `rgba(${A},.35)`);
    rg2.addColorStop(1, 'rgba(0,0,0,0)');
    rx.fillStyle = rg2;
    rx.fillRect(0, 0, PWd, PHt);
    rx.fillStyle = 'rgba(0,0,0,.4)';
    rx.fillRect(0, 0, PWd, 22);
    rx.fillStyle = '#e8f6ff';
    rx.font = '600 13px "Exo 2",sans-serif';
    rx.fillText('Terminal   File   Edit   View', 12, 16);
    const m = Math.round(curH * 60) % 1440;
    rx.textAlign = 'right';
    rx.fillText(
      String(Math.floor(m / 60)).padStart(2, '0') + ':' + String(m % 60).padStart(2, '0'),
      PWd - 12,
      16
    );
    rx.textAlign = 'left';
    rr(rx, PWd / 2 - 130, PHt - 52, 260, 42, 14);
    rx.fillStyle = 'rgba(255,255,255,.16)';
    rx.fill();
    for (let i = 0; i < 6; i++) {
      rr(rx, PWd / 2 - 118 + i * 40, PHt - 46, 30, 30, 8);
      rx.fillStyle = `hsl(${i * 55 + 190},60%,55%)`;
      rx.fill();
    }
  };
  function stepRain() {
    const nm = nightK > 0.5 ? 1 : 0;
    if (nm !== monMode) {
      monMode = nm;
      wallK = -1;
      if (nm) {
        rx.fillStyle = '#020a06';
        rx.fillRect(0, 0, PWd, PHt);
      }
      drawTerm();
    }
    if (nm) {
      rx.fillStyle = 'rgba(2,10,6,.2)';
      rx.fillRect(0, 0, PWd, PHt);
      rx.font = '16px ui-monospace,monospace';
      for (let i = 0; i < cols; i++) {
        rx.fillStyle = drops[i] * 16 < 40 ? THEMES[theme].head : THEMES[theme].rain;
        rx.fillText(gly[Math.floor(rnd() * gly.length)], i * 16, drops[i] * 16);
        if (drops[i] * 16 > PHt && rnd() > 0.96) drops[i] = 0;
        drops[i] += 1;
      }
    } else {
      const wk = Math.floor(curH * 6);
      if (wk !== wallK) {
        wallK = wk;
        paintWall();
      }
    }
    pcx.drawImage(rainCv, 0, 0);
    pcx.drawImage(termCv, 0, 0);
    pcTex.needsUpdate = true;
  }
  rx.fillStyle = '#020a06';
  rx.fillRect(0, 0, PWd, PHt);
  for (let i = 0; i < 24; i++) stepRain();

  // ---- Living area: TV on the wall, cabinet, sofa facing it, coffee table ----
  const tvG = new THREE.Group();
  tvG.position.set(-3.93, 1.4, 1.2);
  tvG.rotation.y = Math.PI / 2;
  room.add(tvG);
  bx(1.5, 0.86, 0.04, dark, 0, 0, 0, tvG);
  const tvS = new THREE.Mesh(new THREE.PlaneGeometry(1.44, 0.8), screenMat(tvTex));
  tvS.position.z = 0.022;
  tvG.add(tvS);
  bx(1.58, 0.02, 0.02, rgbMat(0.1), 0, 0.44, -0.03, tvG, false);
  bx(1.58, 0.02, 0.02, rgbMat(0.3), 0, -0.44, -0.03, tvG, false);
  bx(0.02, 0.9, 0.02, rgbMat(0.5), -0.78, 0, -0.03, tvG, false);
  bx(0.02, 0.9, 0.02, rgbMat(0.7), 0.78, 0, -0.03, tvG, false);
  bx(1.1, 0.07, 0.1, dark, 0, -0.6, 0.04, tvG);
  bx(0.4, 0.45, 2, walnut, -3.77, 0.225, 1.2, room);
  bx(0.3, 0.06, 0.4, dark, -3.77, 0.48, 0.6, room);
  bx(0.06, 0.02, 0.06, rgbMat(0.2), -3.62, 0.5, 0.6, room, false);
  {
    const b = pot(-3.75, 1.9, 0.07, 0.12, 0xb5654a, 0.45);
    rosette(-3.75, b, 1.9, 9, 0.3, lf2);
  }
  const sofa = new THREE.Group();
  sofa.userData.merge = true;
  sofa.position.set(-1.2, 0, 1.2);
  sofa.rotation.y = -Math.PI / 2;
  room.add(sofa);
  const fabric = pbrT(PBR.fabric, 0.5, 0x7a8696),
    cush = pbrT(PBR.fabric, 0.5, 0x8c98a8),
    pill = pbrT(PBR.fabric, 0.5, accent.clone().multiplyScalar(0.85));
  bx(2.1, 0.4, 0.95, fabric, 0, 0.25, 0, sofa);
  bx(0.98, 0.13, 0.8, cush, -0.5, 0.52, 0.06, sofa);
  bx(0.98, 0.13, 0.8, cush, 0.5, 0.52, 0.06, sofa);
  bx(2.1, 0.6, 0.2, fabric, 0, 0.75, -0.38, sofa);
  [-0.5, 0.5].forEach(o => {
    bx(0.95, 0.42, 0.16, cush, o, 0.8, -0.24, sofa).rotation.x = -0.18;
  });
  [-1.05, 1.05].forEach(o => bx(0.2, 0.58, 0.95, fabric, o, 0.43, 0, sofa));
  bx(0.34, 0.34, 0.1, pill, 0.7, 0.78, -0.08, sofa).rotation.set(-0.2, 0, 0.3);
  [
    [-0.95, 0.05],
    [0.95, 0.05],
    [-0.95, 0.85],
    [0.95, 0.85],
  ].forEach(([a, b]) => bx(0.05, 0.06, 0.05, metal, a, 0.03, b - 0.45, sofa, false));
  const brass = std(0xb08d57, 0.3, 0.9);
  {
    const top = put(new THREE.CylinderGeometry(0.45, 0.45, 0.035, 40), wood, -2.4, 0.3825, 1.2, room);
    top.scale.set(0.67, 1, 1);
    const lip = put(new THREE.CylinderGeometry(0.43, 0.41, 0.03, 40), walnut, -2.4, 0.35, 1.2, room);
    lip.scale.set(0.67, 1, 1);
    const sh = put(new THREE.CylinderGeometry(0.36, 0.36, 0.02, 32), walnut, -2.4, 0.16, 1.2, room);
    sh.scale.set(0.67, 1, 1);
    [
      [-0.2, -0.32],
      [0.2, -0.32],
      [-0.2, 0.32],
      [0.2, 0.32],
    ].forEach(([a, b]) => {
      const l = cyl(0.022, 0.012, 0.36, 10, walnut, -2.4 + a * 1.06, 0.18, 1.2 + b * 1.06, room);
      l.rotation.set(b > 0 ? -0.07 : 0.07, 0, a > 0 ? 0.07 : -0.07);
      cyl(0.013, 0.013, 0.02, 8, brass, -2.4 + a * 1.1, 0.01, 1.2 + b * 1.1, room);
    });
  }
  cyl(0.04, 0.035, 0.09, 12, std(0xe8e4dc, 0.4), -2.45, 0.44, 0.95, room);
  const remote = bx(0.05, 0.015, 0.16, dark, -2.35, 0.405, 1.45, room);
  remote.userData.m = 0;
  cyl(0.07, 0.05, 0.08, 12, std(0xb5654a, 0.9), -2.4, 0.44, 1.2, room);

  // ---- Dining table: notebook (all projects), tablet (skills), mug, flowers ----
  bx(0.95, 0.035, 1.7, wood, 2.55, 0.7475, -1, room);
  bx(0.91, 0.02, 1.66, walnut, 2.55, 0.72, -1, room);
  bx(0.97, 0.012, 1.72, walnut, 2.55, 0.7655 - 0.0155, -1, room, false);
  [-0.37, 0.37].forEach(a => bx(0.03, 0.08, 1.5, walnut, 2.55 + a, 0.675, -1, room));
  [-0.76, 0.76].forEach(b => bx(0.74, 0.08, 0.03, walnut, 2.55, 0.675, -1 + b, room));
  [
    [-0.4, -0.78],
    [0.4, -0.78],
    [-0.4, 0.78],
    [0.4, 0.78],
  ].forEach(([a, b]) => {
    cyl(0.032, 0.018, 0.68, 10, walnut, 2.55 + a, 0.35, -1 + b, room);
    cyl(0.02, 0.02, 0.02, 8, brass, 2.55 + a, 0.01, -1 + b, room);
  });
  bx(0.03, 0.03, 1.4, walnut, 2.55, 0.2, -1, room);
  bx(0.8, 0.025, 0.025, walnut, 2.55, 0.2, -1, room);
  const dChair = (x, z, ry) => {
    const g = new THREE.Group();
    g.userData.merge = true;
    g.position.set(x, 0, z);
    g.rotation.y = ry;
    room.add(g);
    const cu = pbrT(PBR.fabric, 0.5, 0x7d9279);
    bx(0.44, 0.04, 0.44, wood, 0, 0.43, 0, g);
    bx(0.4, 0.045, 0.4, cu, 0, 0.475, 0.005, g);
    [
      [-0.19, 0.19],
      [0.19, 0.19],
    ].forEach(([a, b]) => {
      cyl(0.02, 0.014, 0.43, 8, wood, a, 0.215, b, g).rotation.x = -0.04;
    });
    [-0.19, 0.19].forEach(a => {
      bx(0.035, 0.55, 0.035, wood, a, 0.7, -0.2, g).rotation.x = -0.08;
      cyl(0.02, 0.014, 0.43, 8, wood, a, 0.215, -0.19, g).rotation.x = 0.04;
    });
    bx(0.42, 0.07, 0.03, wood, 0, 0.96, -0.235, g).rotation.x = -0.08;
    for (let k = -2; k <= 2; k++) bx(0.022, 0.32, 0.016, wood, k * 0.085, 0.74, -0.215, g).rotation.x = -0.08;
    bx(0.36, 0.018, 0.018, wood, 0, 0.15, 0.19, g);
    bx(0.36, 0.018, 0.018, wood, 0, 0.15, -0.19, g);
    bx(0.018, 0.018, 0.36, wood, -0.19, 0.15, 0, g);
    bx(0.018, 0.018, 0.36, wood, 0.19, 0.15, 0, g);
  };
  dChair(1.7, -0.75, Math.PI / 2);
  dChair(2.55, 0.3, Math.PI);
  cyl(0.04, 0.035, 0.09, 12, std(0xe8e4dc, 0.4), 2.85, 0.81, -0.35, room);
  cyl(0.05, 0.04, 0.16, 10, std(0x9ebfd9, 0.2, 0.2), 2.6, 0.85, -0.3, room);
  for (let k = 0; k < 4; k++)
    put(
      new THREE.SphereGeometry(0.035, 8, 6),
      std([0xff7a8a, 0xffd166, 0xfff1f1, 0xff9f68][k], 0.8),
      2.6 + (k - 1.5) * 0.03,
      0.97 + (k % 2) * 0.03,
      -0.3,
      room,
      false
    );
  const tg = new THREE.Group();
  tg.position.set(2.5, 0.765, -1.55);
  tg.rotation.y = Math.PI;
  room.add(tg);
  bx(0.25, 0.01, 0.1, dark, 0, 0.005, 0.04, tg);
  const lean = new THREE.Group();
  lean.rotation.x = -0.3;
  tg.add(lean);
  bx(0.25, 0.17, 0.01, dark, 0, 0.09, 0, lean);
  const tabS = new THREE.Mesh(new THREE.PlaneGeometry(0.235, 0.16), screenMat(tabTex));
  tabS.position.set(0, 0.09, 0.0055);
  lean.add(tabS);

  // Notebook: one book holds every project (right page) with a brainstorm mind map (left page)
  const PW = 512,
    PH = 704,
    imgs = [],
    hostOf = u => {
      try {
        return new URL(u).host;
      } catch (e) {
        return u;
      }
    };
  const ell = (x, cx, cy, rx, ry, s) => {
    x.beginPath();
    for (let a = 0; a <= 6.4; a += 0.2) {
      const r = 1 + Math.sin(a * 3 + s) * 0.025;
      x[a ? 'lineTo' : 'moveTo'](cx + Math.cos(a) * rx * r, cy + Math.sin(a) * ry * r);
    }
    x.closePath();
  };
  const wob = (x, x1, y1, x2, y2, s) => {
    x.beginPath();
    x.moveTo(x1, y1);
    x.quadraticCurveTo((x1 + x2) / 2 + Math.sin(s) * 14, (y1 + y2) / 2 + Math.cos(s) * 14, x2, y2);
    x.stroke();
  };
  const lineWrap = (x, t, mw) => {
    const out = [];
    let line = '';
    for (const w of String(t || '').split(' ')) {
      const tt = line ? line + ' ' + w : w;
      if (x.measureText(tt).width > mw && line) {
        out.push(line);
        line = w;
      } else line = tt;
    }
    out.push(line);
    return out;
  };

  function paintRight(cv, k, prog = 1) {
    const x = cv.getContext('2d'),
      p = projects[k];
    x.fillStyle = '#f6f0e1';
    x.fillRect(0, 0, PW, PH);
    x.strokeStyle = 'rgba(90,140,200,.35)';
    x.lineWidth = 1.5;
    for (let y = 170; y < PH - 30; y += 40) {
      x.beginPath();
      x.moveTo(0, y);
      x.lineTo(PW, y);
      x.stroke();
    }
    x.strokeStyle = 'rgba(220,70,70,.45)';
    x.beginPath();
    x.moveTo(64, 0);
    x.lineTo(64, PH);
    x.stroke();
    x.font = '500 31px Caveat,cursive';
    const dl = lineWrap(x, p.description, PW - 120).slice(0, 5),
      im = imgs[k];
    const items = [
      {
        y: 100,
        w: 380,
        f: () => {
          x.fillStyle = '#1d2f52';
          x.font = '700 62px Caveat,cursive';
          x.fillText(`${k + 1}. ${p.title}`, 84, 100, PW - 110);
        },
      },
      {
        y: 118,
        w: 380,
        f: () => {
          x.strokeStyle = dk;
          x.lineWidth = 3;
          x.beginPath();
          x.moveTo(84, 118);
          for (let i = 0; i < 14; i++) x.lineTo(84 + i * 28, 118 + (i % 2 ? 5 : -3));
          x.stroke();
        },
      },
      {
        y: 158,
        w: 340,
        f: () => {
          x.fillStyle = dk;
          x.font = '600 34px Caveat,cursive';
          x.fillText(`${p.role}  /  ${p.year}`, 84, 158, PW - 110);
        },
      },
      ...dl.map((l, i) => ({
        y: 210 + i * 40,
        w: 380,
        f: () => {
          x.fillStyle = '#2a2f3a';
          x.font = '500 31px Caveat,cursive';
          x.fillText(l, 84, 210 + i * 40, PW - 110);
        },
      })),
      {
        y: 420,
        w: 380,
        f: () => {
          let tx = 84,
            ty = 420;
          (p.tags || []).slice(0, 5).forEach((t, i) => {
            x.font = '600 28px Caveat,cursive';
            const w = x.measureText(t).width + 24;
            if (tx + w > PW - 30) {
              tx = 84;
              ty += 48;
            }
            x.save();
            x.translate(tx, ty);
            x.rotate((((i * 7) % 5) - 2) * 0.012);
            x.strokeStyle = dk;
            x.lineWidth = 2.5;
            rr(x, 0, -28, w, 38, 8);
            x.stroke();
            x.fillStyle = dk;
            x.fillText(t, 12, 0);
            x.restore();
            tx += w + 14;
          });
        },
      },
      ...(p.url
        ? [
            {
              y: 492,
              w: 300,
              f: () => {
                x.fillStyle = dk;
                x.font = '600 30px Caveat,cursive';
                x.fillText('→ ' + hostOf(p.url), 84, 492, PW - 120);
              },
            },
          ]
        : []),
      {
        y: 590,
        w: 330,
        f: () => {
          if (im) {
            x.save();
            x.translate(PW / 2 + 20, 592);
            x.rotate(-0.04);
            x.fillStyle = '#fff';
            x.shadowColor = 'rgba(0,0,0,.3)';
            x.shadowBlur = 10;
            x.fillRect(-150, -85, 300, 170);
            x.shadowBlur = 0;
            x.beginPath();
            x.rect(-140, -75, 280, 130);
            x.clip();
            const sc = Math.max(280 / im.width, 130 / im.height);
            x.drawImage(
              im,
              (-im.width * sc) / 2,
              -75 + (130 - im.height * sc) / 2,
              im.width * sc,
              im.height * sc
            );
            x.restore();
            x.fillStyle = 'rgba(255,230,120,.75)';
            x.fillRect(PW / 2 - 10, 496, 60, 22);
          } else {
            x.save();
            x.strokeStyle = '#3b4a63';
            x.lineWidth = 3;
            x.translate(84, 515);
            rr(x, 0, 0, 330, 140, 10);
            x.stroke();
            x.beginPath();
            x.moveTo(0, 28);
            x.lineTo(330, 28);
            x.stroke();
            for (let i = 0; i < 3; i++)
              x.strokeRect(14 + i * 105, 44 + ((k + i) % 2) * 14, 92, 56 + hr(k, i) * 30);
            x.beginPath();
            x.arc(290, 14, 6, 0, 6.283);
            x.stroke();
            x.fillStyle = dk;
            x.font = '600 26px Caveat,cursive';
            x.fillText('wireframe v' + (k + 1), 14, 172);
            x.restore();
          }
        },
      },
    ];
    const N = items.length;
    let tip = null;
    for (let i = 0; i < N; i++) {
      const fr = Math.min(1, Math.max(0, prog * N - i));
      if (fr <= 0) break;
      x.save();
      if (fr < 1) {
        x.beginPath();
        x.rect(0, 0, 84 + items[i].w * fr, PH);
        x.clip();
        tip = { x: 84 + items[i].w * fr, y: items[i].y };
      }
      items[i].f();
      x.restore();
    }
    if (prog >= 1) {
      x.fillStyle = 'rgba(40,50,70,.55)';
      x.font = '500 24px Caveat,cursive';
      x.fillText(`p. ${k + 1} / ${NP}`, PW - 100, PH - 18);
    }
    return tip;
  }
  function paintLeft(cv, k) {
    const x = cv.getContext('2d'),
      p = projects[k];
    x.fillStyle = '#f6f0e1';
    x.fillRect(0, 0, PW, PH);
    x.fillStyle = 'rgba(70,90,120,.25)';
    for (let i = 32; i < PW; i += 32) for (let j = 32; j < PH; j += 32) x.fillRect(i, j, 2, 2);
    x.fillStyle = '#1d2f52';
    x.font = '700 54px Caveat,cursive';
    x.fillText('Brainstorm', 40, 80);
    x.save();
    x.translate(PW - 150, 24);
    x.rotate(0.05);
    x.fillStyle = '#ffe66d';
    x.fillRect(0, 0, 120, 90);
    x.fillStyle = '#4a3b00';
    x.font = '600 26px Caveat,cursive';
    x.fillText('shipped', 14, 38);
    x.fillText(String(p.year), 14, 70);
    x.restore();
    const cx = PW / 2,
      cy = 330,
      tags = (p.tags || []).slice(0, 5),
      ang = [-2.6, -1.1, 0.2, 1.6, 2.9];
    x.strokeStyle = dk;
    x.lineWidth = 3;
    tags.forEach((t, i) => {
      const nx = cx + Math.cos(ang[i]) * 175,
        ny = cy + Math.sin(ang[i]) * 135;
      wob(x, cx, cy, nx, ny, i);
      x.fillStyle = '#fffaf0';
      ell(x, nx, ny, 70, 28, i);
      x.fill();
      x.stroke();
      x.fillStyle = dk;
      x.font = '600 26px Caveat,cursive';
      x.textAlign = 'center';
      x.fillText(t, nx, ny + 9, 120);
    });
    x.fillStyle = '#fffaf0';
    ell(x, cx, cy, 125, 52, 7);
    x.fill();
    x.strokeStyle = '#1d2f52';
    x.lineWidth = 4;
    x.stroke();
    x.fillStyle = '#1d2f52';
    x.font = '700 38px Caveat,cursive';
    x.textAlign = 'center';
    x.fillText(p.title, cx, cy + 12, 220);
    x.textAlign = 'left';
    const ideas = site.ideas || [];
    if (ideas.length)
      for (let i = 0; i < 3; i++) {
        x.fillStyle = '#2a2f3a';
        x.font = '500 28px Caveat,cursive';
        x.fillText('★ ' + ideas[(k + i) % ideas.length], 40, 545 + i * 44, PW - 70);
      }
  }
  const cvR = cvs(PW, PH),
    cvL = cvs(PW, PH),
    cvF = cvs(PW, PH),
    cvB = cvs(PW, PH),
    tR = mkTex(cvR),
    tL = mkTex(cvL),
    tF = mkTex(cvF),
    tB = mkTex(cvB);
  tB.center.set(0.5, 0.5);
  tB.rotation = Math.PI;
  const nb = new THREE.Group();
  nb.position.set(2.45, 0.765, -0.8);
  nb.rotation.y = -1.95;
  nb.scale.setScalar(1.25);
  room.add(nb);
  const leather = pbrT(PBR.leather, 0.5, accent.clone().multiplyScalar(0.6)),
    cream = std(0xf0e9d6, 0.9),
    paper = t => std(0xffffff, 0.9, 0, { map: t });
  bx(0.64, 0.018, 0.43, leather, 0, 0.009, 0, nb);
  bx(0.3, 0.012, 0.41, cream, -0.152, 0.024, 0, nb);
  bx(0.3, 0.012, 0.41, cream, 0.152, 0.024, 0, nb);
  bx(0.012, 0.03, 0.43, leather, 0, 0.02, 0, nb, false);
  bx(0.012, 0.002, 0.14, neon, 0, 0.0316, 0.26, nb, false);
  const penG = new THREE.Group();
  penG.position.set(0.42, 0.007, 0.1);
  penG.rotation.set(1.55, 0.2, 0);
  nb.add(penG);
  cyl(0.006, 0.006, 0.14, 8, std(0x3b6fd4, 0.35, 0.3), 0, 0.075, 0, penG);
  cyl(0.001, 0.006, 0.012, 8, metal, 0, 0.004, 0, penG);
  const penRest = { x: 0.42, y: 0.007, z: 0.1 },
    penTarget = { x: 0.4, z: 0.1 };
  const pg = (t, x) => {
    const m = new THREE.Mesh(new THREE.PlaneGeometry(0.29, 0.4), paper(t));
    m.rotation.x = -Math.PI / 2;
    m.position.set(x, 0.0305, 0);
    m.receiveShadow = true;
    nb.add(m);
  };
  pg(tL, -0.15);
  pg(tR, 0.15);
  const leafG = new THREE.Group();
  leafG.position.y = 0.0305;
  leafG.visible = false;
  nb.add(leafG);
  const lf = new THREE.Mesh(new THREE.PlaneGeometry(0.29, 0.4), paper(tF));
  lf.rotation.x = -Math.PI / 2;
  lf.position.set(0.15, 0.0008, 0);
  leafG.add(lf);
  const lb = new THREE.Mesh(new THREE.PlaneGeometry(0.29, 0.4), paper(tB));
  lb.rotation.x = Math.PI / 2;
  lb.position.set(0.15, -0.0008, 0);
  leafG.add(lb);
  let page = 0,
    flipT = -1,
    flipDir = 1,
    writeT = -1,
    penK = 0;
  const paintStatic = () => {
    paintLeft(cvL, page);
    paintRight(cvR, page);
    tL.needsUpdate = tR.needsUpdate = true;
  };
  function startWrite() {
    if (flipT >= 0 || writeT >= 0 || RMq) return;
    writeT = 0;
    paintRight(cvR, page, 0);
    tR.needsUpdate = true;
  }
  const endFlip = () => {
    flipT = -1;
    leafG.visible = false;
    paintStatic();
    startWrite();
  };
  function setPage(k, dir) {
    k = ((k % NP) + NP) % NP;
    if (k === page) return;
    if (flipT >= 0) endFlip();
    writeT = -1;
    const old = page;
    flipDir = dir || (k > old ? 1 : -1);
    page = k;
    if (flipDir > 0) {
      paintRight(cvF, old);
      paintLeft(cvB, k);
      paintRight(cvR, k, 0);
      paintLeft(cvL, old);
    } else {
      paintRight(cvF, k, 0);
      paintLeft(cvB, old);
      paintLeft(cvL, k);
      paintRight(cvR, old);
    }
    tF.needsUpdate = tB.needsUpdate = tL.needsUpdate = tR.needsUpdate = true;
    leafG.visible = true;
    leafG.rotation.z = flipDir > 0 ? 0 : Math.PI;
    flipT = 0;
  }
  projects.forEach((p, k) => {
    const urls = [p.image, p.repo && `https://opengraph.githubassets.com/1/${p.repo}`].filter(Boolean);
    const next = () => {
      const u = urls.shift();
      if (!u) return;
      const im = new Image();
      im.crossOrigin = 'anonymous';
      im.onload = () => {
        imgs[k] = im;
        if (k === page && flipT < 0) paintStatic();
      };
      im.onerror = next;
      im.src = u;
    };
    next();
  });
  paintStatic();
  redo.push(paintStatic);
  const book = {
    group: nb,
    count: NP,
    get page() {
      return page;
    },
    set: setPage,
    flip: d => setPage(page + d, d),
    write: startWrite,
  };
  const tvIni = t =>
    t
      .split(/\s+/)
      .map(w => w[0])
      .join('')
      .slice(0, 2)
      .toUpperCase();
  function paintReel(t) {
    const x = tvTex.image.getContext('2d'),
      W = 1024,
      H = 576,
      SL = 4.5,
      idx = Math.floor(t / SL) % NP,
      ph = (t % SL) / SL,
      p = projects[idx],
      im = imgs[idx],
      z = 1 + ph * 0.08,
      fa = Math.min(1, ph * 6, (1 - ph) * 6);
    x.fillStyle = '#05080f';
    x.fillRect(0, 0, W, H);
    x.save();
    x.translate(W / 2, H / 2);
    x.scale(z, z);
    x.translate(-W / 2, -H / 2);
    if (im) {
      const sc = Math.max(W / im.width, H / im.height);
      x.drawImage(im, (W - im.width * sc) / 2, (H - im.height * sc) / 2, im.width * sc, im.height * sc);
    } else {
      const g = x.createLinearGradient(0, 0, W, H);
      g.addColorStop(0, `rgba(${A},.6)`);
      g.addColorStop(1, '#0a1020');
      x.fillStyle = g;
      x.fillRect(0, 0, W, H);
      x.fillStyle = `rgba(${A},.25)`;
      x.font = '800 340px "Exo 2",sans-serif';
      x.textAlign = 'center';
      x.fillText(tvIni(p.title), W / 2, H / 2 + 110);
      x.textAlign = 'left';
    }
    x.restore();
    const sh = x.createLinearGradient(0, H * 0.4, 0, H);
    sh.addColorStop(0, 'rgba(0,0,0,0)');
    sh.addColorStop(1, 'rgba(0,0,0,.85)');
    x.fillStyle = sh;
    x.fillRect(0, 0, W, H);
    x.fillStyle = '#fff';
    x.font = '800 66px "Exo 2",sans-serif';
    x.fillText(p.title, 48, H - 120, W - 96);
    x.fillStyle = `rgb(${A})`;
    x.font = '600 30px "Exo 2",sans-serif';
    x.fillText(`${p.role}  ·  ${p.year}`, 48, H - 76, W - 96);
    for (let i = 0; i < NP; i++) {
      x.fillStyle = i === idx ? `rgb(${A})` : 'rgba(255,255,255,.35)';
      x.fillRect(48 + i * 40, H - 40, 30, 5);
    }
    x.fillStyle = 'rgba(255,60,60,.95)';
    x.beginPath();
    x.arc(64, 52, 9, 0, 6.283);
    x.fill();
    x.fillStyle = '#fff';
    x.font = '700 26px "Exo 2",sans-serif';
    x.fillText('REEL', 86, 61);
    x.fillStyle = `rgba(0,0,0,${0.9 * (1 - fa)})`;
    x.fillRect(0, 0, W, H);
    tvTex.needsUpdate = true;
  }
  const tv = {
    hits: [tvG, remote],
    toggle() {
      tvMode = tvMode === 'home' ? 'reel' : 'home';
      if (tvMode === 'home') tvTex.userData.go();
      else paintReel(performance.now() / 1000);
      return tvMode;
    },
  };

  // ---- Workstation: a clean, normal desk by day; a full cyber rig grows in at night ----
  const deploy = [],
    glowL = [],
    halos = [],
    scr = [],
    rotors = [];
  const pivot = (x, y, z, night, ry = 0) => {
    const g = new THREE.Group();
    g.position.set(x, y, z);
    g.rotation.y = ry;
    room.add(g);
    deploy.push({ g, n: night });
    return g;
  };
  const glow = (hex, lo, hi, o) => {
    const m = new THREE.MeshBasicMaterial(Object.assign({ color: 0xffffff, toneMapped: false }, o));
    glowL.push({ m, c: new THREE.Color(hex), lo, hi });
    return m;
  };
  const haloTex = (() => {
    const c = cvs(64, 64),
      x = c.getContext('2d'),
      g = x.createRadialGradient(32, 32, 0, 32, 32, 32);
    g.addColorStop(0, 'rgba(255,255,255,1)');
    g.addColorStop(0.3, 'rgba(255,255,255,.35)');
    g.addColorStop(1, 'rgba(255,255,255,0)');
    x.fillStyle = g;
    x.fillRect(0, 0, 64, 64);
    return mkTex(c);
  })();
  const halo = (x, y, z, s, off, max = 0.8) => {
    const m = new THREE.SpriteMaterial({
        map: haloTex,
        color: 0xffffff,
        transparent: true,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
        opacity: 0,
        fog: false,
      }),
      sp = new THREE.Sprite(m);
    sp.position.set(x, y, z);
    sp.scale.set(s, s, 1);
    sp.visible = false;
    scene.add(sp);
    halos.push({ m, sp, off, max });
    return sp;
  };
  const PAL = seed => ({ c1: [`rgb(${A})`, '#3dd7ff', '#ffd23d'][seed % 3], c2: '#ff3df2', seed });
  const white = pbrT(PBR.plastic, 0.3, 0xe9ecef),
    alu = pbrT(PBR.brushed, 0.3, 0xcfd4da, { metalness: 0.9 }),
    deskTop = pbrT(PBR.wood, 0.7, 0xd8c1a0);

  bx(2.4, 0.04, 0.8, deskTop, -2.2, 0.74, -4.55, room);
  [-3.3, -1.1].forEach(x => {
    bx(0.06, 0.7, 0.06, metal, x, 0.35, -4.55, room);
    bx(0.06, 0.03, 0.72, metal, x, 0.015, -4.55, room);
  });
  bx(2.2, 0.04, 0.05, metal, -2.2, 0.69, -4.8, room);
  bx(2.3, 0.015, 0.015, rgbMat(0.0), -2.2, 0.7, -4.2, room, false);
  bx(2.3, 0.02, 0.02, rgbMat(0.4), -2.2, 0.8, -4.94, room, false);

  // Main monitor (always there): the interactive terminal lives here
  const mon = new THREE.Group();
  mon.position.set(-2.2, 0.76, -4.65);
  room.add(mon);
  bx(0.84, 0.49, 0.025, dark, 0, 0.36, 0, mon);
  const monS = new THREE.Mesh(new THREE.PlaneGeometry(0.8, 0.45), screenMat(pcTex));
  monS.position.set(0, 0.36, 0.014);
  mon.add(monS);
  cyl(0.02, 0.02, 0.12, 8, metal, 0, 0.06, -0.02, mon);
  bx(0.3, 0.012, 0.18, metal, 0, 0.006, 0, mon);
  bx(0.05, 0.014, 0.02, dark, 0, 0.617, 0.005, mon);
  bx(0.86, 0.015, 0.015, rgbMat(0.15), 0, 0.62, -0.02, mon, false);
  bx(0.86, 0.015, 0.015, rgbMat(0.45), 0, 0.1, -0.02, mon, false);
  [-0.42, 0.42].forEach((o, i) => bx(0.015, 0.5, 0.015, rgbMat(0.25 + i * 0.3), o, 0.36, -0.02, mon, false));
  [-3.3, -1.1].forEach(x => {
    bx(0.1, 0.2, 0.1, dark, x, 0.86, -4.8, room);
    put(new THREE.CircleGeometry(0.03, 12), std(0x20252b, 0.5, 0.6), x, 0.9, -4.748, room, false).rotation.y =
      x < -2 ? 0.2 : -0.2;
  });

  // PC tower on the floor: pale case by day, dark glass-and-RGB build by night
  const tower = new THREE.Group();
  tower.position.set(-0.74, 0, -4.55);
  room.add(tower);
  const towerBody = pbrT(PBR.brushed, 0.3, 0xd7dce2, { metalness: 0.6 });
  bx(0.22, 0.48, 0.45, towerBody, 0, 0.24, 0, tower);
  [
    [-0.09, -0.19],
    [0.09, -0.19],
    [-0.09, 0.19],
    [0.09, 0.19],
  ].forEach(([a, b]) => cyl(0.02, 0.025, 0.03, 8, dark, a, 0.015, b, tower));
  bx(0.2, 0.012, 0.42, dark, 0, 0.486, 0, tower);
  for (let k = 0; k < 9; k++) bx(0.16, 0.004, 0.012, towerBody, 0, 0.494, -0.18 + k * 0.045, tower, false);
  bx(0.05, 0.012, 0.015, rgbMat(0.2), -0.04, 0.498, 0.2, tower, false);
  cyl(0.012, 0.012, 0.01, 10, std(0x15191d, 0.4, 0.6), 0.05, 0.496, 0.2, tower);
  const bayM = rbMat({ side: THREE.DoubleSide }),
    bay = new THREE.Mesh(new THREE.PlaneGeometry(0.4, 0.42), bayM);
  bay.position.set(0.112, 0.24, 0);
  bay.rotation.y = Math.PI / 2;
  tower.add(bay);
  bx(
    0.012,
    0.4,
    0.3,
    std(0xffffff, 0.55, 0.3, {
      map: (() => {
        const c = cvs(256, 256),
          x = c.getContext('2d');
        x.fillStyle = '#0d1413';
        x.fillRect(0, 0, 256, 256);
        x.strokeStyle = 'rgba(190,150,60,.55)';
        x.lineWidth = 1.5;
        for (let i = 0; i < 46; i++) {
          let px = hr(i, 1) * 256,
            py = hr(i, 2) * 256;
          x.beginPath();
          x.moveTo(px, py);
          for (let k = 0; k < 4; k++) {
            if (k % 2) py += (hr(i, k + 3) - 0.5) * 90;
            else px += (hr(i, k + 3) - 0.5) * 90;
            x.lineTo(px, py);
          }
          x.stroke();
        }
        for (let i = 0; i < 30; i++) {
          x.fillStyle = i % 3 ? '#1b2323' : '#232b2b';
          x.fillRect(hr(i, 7) * 230, hr(i, 8) * 230, 8 + hr(i, 9) * 22, 8 + hr(i, 10) * 18);
        }
        for (let i = 0; i < 120; i++) {
          x.fillStyle = 'rgba(215,175,80,.8)';
          x.fillRect(hr(i, 11) * 256, hr(i, 12) * 256, 2, 2);
        }
        x.fillStyle = '#2a3535';
        x.fillRect(100, 150, 70, 70);
        x.fillStyle = '#566';
        x.font = '700 10px monospace';
        x.fillText('CHIPSET', 108, 188);
        return mkTex(c);
      })(),
    }),
    0.116,
    0.24,
    -0.05,
    tower
  );
  [-0.09, -0.075, -0.06, -0.045].forEach((z, i) => {
    bx(0.012, 0.13, 0.008, std(0x1b2027, 0.4, 0.6), 0.128, 0.33, z, tower);
    bx(0.014, 0.012, 0.008, rgbMat(i * 0.12), 0.128, 0.402, z, tower, false);
  });
  cyl(0.04, 0.04, 0.025, 18, std(0x1b2027, 0.3, 0.8), 0.133, 0.3, -0.14, tower).rotation.z = Math.PI / 2;
  put(new THREE.TorusGeometry(0.034, 0.004, 6, 24), rgbMat(0.5), 0.147, 0.3, -0.14, tower, false).rotation.y =
    Math.PI / 2;
  bx(0.026, 0.4, 0.15, pbrT(PBR.brushed, 0.3, 0x2a2f36, { metalness: 0.8 }), 0.123, 0.24, 0.14, tower);
  const tube = (pts, z0) => {
    for (let k = 0; k < pts.length - 1; k++) {
      const [y1, z1] = pts[k],
        [y2, z2] = pts[k + 1],
        L = Math.hypot(y2 - y1, z2 - z1),
        m = cyl(0.007, 0.007, L, 6, std(0x1a1f26, 0.3, 0.2), 0.126, (y1 + y2) / 2, (z1 + z2) / 2, tower);
      m.rotation.x = Math.atan2(z2 - z1, y2 - y1);
    }
  };
  tube([
    [0.32, -0.14],
    [0.43, -0.08],
    [0.43, 0.08],
  ]);
  tube([
    [0.28, -0.14],
    [0.17, -0.06],
    [0.1, 0.06],
  ]);
  bx(0.04, 0.06, 0.24, pbrT(PBR.carbon, 0.1, 0xffffff, { metalness: 0.5 }), 0.134, 0.16, -0.08, tower);
  bx(0.004, 0.012, 0.22, rgbMat(0.3), 0.155, 0.185, -0.08, tower, false);
  bx(0.004, 0.05, 0.05, rgbMat(0.8), 0.155, 0.16, -0.17, tower, false);
  bx(
    0.004,
    0.44,
    0.43,
    std(0x0a0f14, 0.05, 0.9, { transparent: true, opacity: 0.2 }),
    0.162,
    0.24,
    0,
    tower,
    false
  );
  [0.025, 0.455].forEach(y => bx(0.012, 0.014, 0.44, dark, 0.16, y, 0, tower));
  [-0.215, 0.215].forEach(z => bx(0.012, 0.44, 0.014, dark, 0.16, 0.24, z, tower));
  const fans = [];
  [0.1, 0.24, 0.38].forEach((y, i) => {
    const g = new THREE.Group();
    g.position.set(0.14, y, 0.14);
    g.rotation.y = Math.PI / 2;
    g.scale.setScalar(0.72);
    tower.add(g);
    const sp = new THREE.Group();
    g.add(sp);
    sp.add(new THREE.Mesh(new THREE.TorusGeometry(0.085, 0.006, 8, 32), rgbMat(i * 0.1)));
    for (let b = 0; b < 7; b++) {
      const a = b * 0.8976,
        bl = bx(0.02, 0.07, 0.003, dark, -Math.sin(a) * 0.045, Math.cos(a) * 0.045, 0, sp, false);
      bl.rotation.z = a;
    }
    fans.push(sp);
  });

  // Ergonomic chair (mesh back, armrests); the RGB spine strip is only visible at night
  const fab = std(0x2b3139, 0.9),
    meshC = (() => {
      const c = cvs(32, 32),
        x = c.getContext('2d');
      x.fillStyle = '#20262d';
      x.fillRect(0, 0, 32, 32);
      x.fillStyle = '#3a434d';
      for (let i = 0; i < 4; i++) for (let j = 0; j < 4; j++) x.fillRect(i * 8 + 2, j * 8 + 2, 5, 5);
      return mkTex(c, [6, 7]);
    })(),
    meshM = std(0xffffff, 0.9, 0, { map: meshC }),
    chair = new THREE.Group();
  chair.position.set(-2.2, 0, -3.65);
  chair.rotation.y = Math.PI + 0.25;
  room.add(chair);
  put(new THREE.CylinderGeometry(0.27, 0.25, 0.08, 24), fab, 0, 0.5, 0, chair).scale.set(1, 1, 1.05);
  put(new THREE.TorusGeometry(0.262, 0.008, 6, 28), std(accent, 0.5), 0, 0.538, 0, chair, false).rotation.x =
    Math.PI / 2;
  cyl(0.045, 0.05, 0.1, 12, dark, 0, 0.44, 0, chair);
  cyl(0.022, 0.022, 0.3, 10, metal, 0, 0.25, 0, chair);
  cyl(0.035, 0.035, 0.14, 10, std(0x1a1e24, 0.4, 0.6), 0, 0.13, 0, chair);
  for (let k = 0; k < 5; k++) {
    const a = k * 1.2566,
      sp = cyl(0.016, 0.022, 0.32, 8, metal, Math.cos(a) * 0.15, 0.075, -Math.sin(a) * 0.15, chair);
    sp.rotation.set(0, a, Math.PI / 2);
    cyl(0.008, 0.008, 0.05, 6, dark, Math.cos(a) * 0.29, 0.055, -Math.sin(a) * 0.29, chair);
    put(new THREE.SphereGeometry(0.03, 8, 6), dark, Math.cos(a) * 0.29, 0.03, -Math.sin(a) * 0.29, chair);
  }
  const back = new THREE.Group();
  back.position.set(0, 0.56, -0.22);
  back.rotation.x = -0.12;
  chair.add(back);
  [-0.2, 0.2].forEach(x => bx(0.03, 0.66, 0.035, fab, x, 0.33, 0, back));
  bx(0.4, 0.52, 0.014, meshM, 0, 0.34, 0.004, back);
  bx(0.44, 0.05, 0.04, fab, 0, 0.67, 0, back);
  bx(0.4, 0.04, 0.04, fab, 0, 0.06, 0, back);
  bx(0.32, 0.12, 0.05, fab, 0, 0.22, 0.03, back);
  bx(0.34, 0.012, 0.052, std(accent, 0.5), 0, 0.285, 0.03, back, false);
  bx(0.03, 0.09, 0.02, metal, 0, 0.74, 0, back);
  bx(0.22, 0.1, 0.05, fab, 0, 0.82, 0.01, back);
  bx(0.025, 0.5, 0.018, rgbMat(0.6), 0, 0.34, -0.014, back, false);
  bx(0.06, 0.16, 0.05, metal, 0, 0.6, -0.2, chair);
  [-0.27, 0.27].forEach(x => {
    cyl(0.014, 0.014, 0.2, 8, metal, x, 0.62, -0.08, chair);
    bx(0.075, 0.03, 0.28, fab, x, 0.735, -0.04, chair);
  });

  // DAY props: white keyboard and mouse, lamp, mug, plant, phone, notebook, prints and a shelf
  const dayDesk = pivot(-2.2, 0.76, -4.3, false),
    kdC = cvs(256, 80),
    kdx = kdC.getContext('2d');
  kdx.fillStyle = '#f4f6f8';
  kdx.fillRect(0, 0, 256, 80);
  kdx.fillStyle = '#c9ced5';
  for (let r = 0; r < 4; r++)
    for (let c = 0; c < 14; c++) {
      rr(kdx, 5 + c * 17.5, 5 + r * 18.5, 14.5, 15, 3);
      kdx.fill();
    }
  bx(0.44, 0.012, 0.14, white, 0, 0.006, 0, dayDesk);
  const kd = new THREE.Mesh(new THREE.PlaneGeometry(0.43, 0.13), std(0xffffff, 0.6, 0, { map: mkTex(kdC) }));
  kd.rotation.x = -Math.PI / 2;
  kd.position.y = 0.0125;
  dayDesk.add(kd);
  bx(0.3, 0.004, 0.24, std(0x3a4048, 0.9), 0.4, 0.002, 0, dayDesk);
  bx(0.06, 0.024, 0.1, white, 0.4, 0.016, 0, dayDesk);
  cyl(0.07, 0.08, 0.015, 16, metal, -0.95, 0.008, -0.15, dayDesk);
  bx(0.015, 0.35, 0.015, metal, -0.95, 0.19, -0.15, dayDesk);
  const la = bx(0.015, 0.28, 0.015, metal, -0.88, 0.38, -0.15, dayDesk);
  la.rotation.z = -1.1;
  const lh = cyl(
    0.02,
    0.07,
    0.07,
    14,
    std(0xf5f5f5, 0.4, 0.2, { emissive: 0xfff0d0, emissiveIntensity: 0.5 }),
    -0.75,
    0.43,
    -0.15,
    dayDesk
  );
  lh.rotation.z = 0.5;
  cyl(0.04, 0.035, 0.09, 14, std(0xe8e4dc, 0.4), 0.8, 0.045, -0.05, dayDesk);
  cyl(0.036, 0.036, 0.005, 14, std(0x3a2a20, 0.3), 0.8, 0.09, -0.05, dayDesk);
  cyl(0.035, 0.03, 0.05, 10, std(0xb5654a, 0.9), 0.95, 0.025, -0.22, dayDesk);
  for (let k = 0; k < 4; k++)
    put(
      new THREE.SphereGeometry(0.03, 8, 6),
      leaf,
      0.95 + Math.cos(k * 1.6) * 0.02,
      0.07 + (k % 2) * 0.02,
      -0.22 + Math.sin(k * 1.6) * 0.02,
      dayDesk
    ).scale.set(0.8, 1.3, 0.8);
  bx(
    0.07,
    0.14,
    0.008,
    std(0x1a2a44, 0.2, 0, { emissive: 0x274b7a, emissiveIntensity: 0.7 }),
    -0.55,
    0.08,
    0.02,
    dayDesk
  ).rotation.x = -0.3;
  bx(0.21, 0.014, 0.15, cream, 0.55, 0.007, 0.06, dayDesk).rotation.y = 0.2;
  const dayWall = pivot(-2.2, 2.0, -4.97, false),
    art = (seed, w, h) => {
      const c = cvs(128, 160),
        x = c.getContext('2d'),
        g = x.createLinearGradient(0, 0, 128, 160);
      g.addColorStop(0, `hsl(${(seed * 70) % 360},55%,62%)`);
      g.addColorStop(1, `hsl(${(seed * 70 + 60) % 360},60%,34%)`);
      x.fillStyle = g;
      x.fillRect(0, 0, 128, 160);
      x.fillStyle = 'rgba(255,255,255,.6)';
      x.beginPath();
      x.arc(40 + ((seed * 20) % 60), 60, 26, 0, 6.283);
      x.fill();
      x.fillStyle = 'rgba(0,0,0,.25)';
      x.fillRect(0, 110, 128, 50);
      return new THREE.Mesh(new THREE.PlaneGeometry(w, h), std(0xffffff, 0.7, 0, { map: mkTex(c) }));
    };
  [
    [-0.85, 0.4, 0.5],
    [0, 0.5, 0.36],
    [0.85, 0.4, 0.5],
  ].forEach(([x, w, h], i) => {
    bx(w + 0.04, h + 0.04, 0.02, frameM, x, 0.1, 0, dayWall);
    const a = art(i + 2, w, h);
    a.position.set(x, 0.1, 0.0115);
    dayWall.add(a);
  });
  bx(2.3, 0.025, 0.16, walnut, 0, -0.38, 0.08, dayWall);
  bx(0.2, 0.14, 0.12, std(0x2e6b5e, 0.7), -0.7, -0.3, 0.08, dayWall);
  bx(0.16, 0.1, 0.12, std(0xa8402b, 0.7), -0.5, -0.32, 0.08, dayWall);
  cyl(0.05, 0.04, 0.09, 12, std(0xe8e4dc, 0.4), 0.8, -0.325, 0.08, dayWall);

  // NIGHT rig: RGB keyboard, pad, headset, two side monitors, an ultrawide, a wall of screens, a hologram projector, a drone
  const nA = pivot(-2.2, 0.76, -4.3, true);
  bx(0.46, 0.012, 0.15, dark, 0, 0.006, 0.1, nA);
  const kg = new THREE.Mesh(new THREE.PlaneGeometry(0.44, 0.13), rbMat());
  kg.rotation.x = -Math.PI / 2;
  kg.position.set(0, 0.0125, 0.1);
  nA.add(kg);
  const kc = cvs(256, 96),
    kx = kc.getContext('2d');
  kx.fillStyle = '#0c0e12';
  for (let r = 0; r < 5; r++)
    for (let c = 0; c < 15; c++) {
      rr(kx, 3 + c * 16.8, 3 + r * 18.4, 14, 15.5, 3);
      kx.fill();
    }
  const keys = new THREE.Mesh(
    new THREE.PlaneGeometry(0.44, 0.13),
    new THREE.MeshBasicMaterial({ map: mkTex(kc), transparent: true })
  );
  keys.rotation.x = -Math.PI / 2;
  keys.position.set(0, 0.0135, 0.1);
  nA.add(keys);
  const padC = cvs(256, 128),
    pxx = padC.getContext('2d'),
    pgr = pxx.createLinearGradient(0, 0, 256, 0);
  for (let i = 0; i <= 6; i++) pgr.addColorStop(i / 6, `hsl(${i * 60},100%,50%)`);
  pxx.fillStyle = pgr;
  rr(pxx, 0, 0, 256, 128, 14);
  pxx.fill();
  pxx.fillStyle = '#0d1016';
  rr(pxx, 6, 6, 244, 116, 10);
  pxx.fill();
  const padM = rbMat();
  padM.map = mkTex(padC);
  const pad = new THREE.Mesh(new THREE.PlaneGeometry(0.5, 0.25), padM);
  pad.rotation.x = -Math.PI / 2;
  pad.position.set(0.6, 0.0025, 0.08);
  nA.add(pad);
  bx(0.06, 0.03, 0.1, dark, 0.6, 0.017, 0.08, nA);
  cyl(0.05, 0.06, 0.012, 12, metal, -0.8, 0.006, -0.15, nA);
  cyl(0.008, 0.008, 0.22, 6, metal, -0.8, 0.12, -0.15, nA);
  const hb = put(new THREE.TorusGeometry(0.075, 0.012, 8, 20, Math.PI), dark, -0.8, 0.24, -0.15, nA);
  [-0.08, 0.08].forEach((o, i) =>
    put(new THREE.SphereGeometry(0.04, 10, 8), rgbMat(i * 0.5), -0.8 + o, 0.22, -0.15, nA, false)
  );
  const screenAt = (g, w, h, kind, seed, cw, ch, x, y, z) => {
    const s = makeScreen(kind, PAL(seed), cw, ch);
    scr.push(s);
    const m = new THREE.Mesh(new THREE.PlaneGeometry(w, h), screenMat(s.tex));
    m.position.set(x, y, z);
    g.add(m);
    return m;
  };
  const sideMon = (x, ry, kind, seed) => {
    const g = pivot(x, 0.76, -4.72, true, ry);
    bx(0.56, 0.34, 0.02, dark, 0, 0.38, 0, g);
    screenAt(g, 0.52, 0.3, kind, seed, 256, 150, 0, 0.38, 0.0115);
    cyl(0.015, 0.015, 0.2, 8, metal, 0, 0.1, -0.02, g);
    bx(0.22, 0.01, 0.14, metal, 0, 0.005, 0, g);
    bx(0.58, 0.012, 0.012, rgbMat(seed * 0.2), 0, 0.56, -0.015, g, false);
    bx(0.58, 0.012, 0.012, rgbMat(seed * 0.2 + 0.3), 0, 0.2, -0.015, g, false);
  };
  sideMon(-2.95, 0.5, 'profile', 1);
  sideMon(-1.45, -0.5, 'radar', 2);
  const ultra = pivot(-2.2, 1.68, -4.72, true);
  bx(1.12, 0.34, 0.02, dark, 0, 0, 0, ultra);
  screenAt(ultra, 1.08, 0.3, 'wave', 3, 384, 106, 0, 0, 0.0115);
  cyl(0.015, 0.015, 0.75, 8, metal, 0, -0.545, -0.03, ultra);
  bx(1.14, 0.012, 0.012, rgbMat(0.35), 0, -0.19, 0.0, ultra, false);
  const wallScr = (x, y, w, h, kind, seed, cw, ch) => {
    const g = pivot(x, y, -4.975, true);
    bx(w + 0.04, h + 0.04, 0.02, dark, 0, 0, 0, g);
    screenAt(g, w, h, kind, seed, cw, ch, 0, 0, 0.0115);
    bx(w, 0.012, 0.012, rgbMat(seed * 0.17), 0, -(h / 2 + 0.04), 0.01, g, false);
  };
  wallScr(-3.1, 2.18, 0.72, 0.41, 'net', 4, 256, 144);
  wallScr(-2.2, 2.18, 0.72, 0.41, 'map', 5, 256, 144);
  wallScr(-1.3, 2.18, 0.72, 0.41, 'stats', 6, 256, 144);
  wallScr(-3.76, 1.95, 0.36, 0.62, 'code', 7, 144, 256);
  wallScr(-0.64, 1.95, 0.36, 0.62, 'hex', 8, 144, 256);
  const holoP = pivot(-1.15, 0.76, -4.36, true);
  cyl(0.07, 0.08, 0.02, 20, dark, 0, 0.01, 0, holoP);
  put(new THREE.TorusGeometry(0.06, 0.004, 6, 24), rgbMat(0.2), 0, 0.022, 0, holoP, false).rotation.x =
    Math.PI / 2;
  const holoM = rgbMat(0.3);
  holoM.wireframe = true;
  holoM.transparent = true;
  holoM.opacity = 0.9;
  holoM.blending = THREE.AdditiveBlending;
  holoM.depthWrite = false;
  const holoD = new THREE.Group();
  holoD.position.y = 0.2;
  holoP.add(holoD);
  holoD.add(
    new THREE.Mesh(new THREE.IcosahedronGeometry(0.09, 1), holoM),
    new THREE.Mesh(new THREE.OctahedronGeometry(0.05, 0), holoM)
  );
  const holoR = new THREE.Mesh(new THREE.TorusGeometry(0.13, 0.003, 6, 36), holoM);
  holoR.rotation.x = 1.2;
  holoD.add(holoR);
  const drone = pivot(0, 2.45, -1, true),
    droneM = std(0x1b1f26, 0.4, 0.7);
  bx(0.22, 0.05, 0.22, droneM, 0, 0, 0, drone);
  bx(0.05, 0.02, 0.05, rgbMat(0.5), 0, -0.035, 0, drone, false);
  [
    [-1, -1],
    [1, -1],
    [-1, 1],
    [1, 1],
  ].forEach(([a, b], i) => {
    bx(0.2, 0.012, 0.012, droneM, a * 0.1, 0.005, b * 0.1, drone).rotation.y = a * b * 0.785;
    const r = cyl(
      0.07,
      0.07,
      0.004,
      14,
      std(0x8aa4bd, 0.3, 0, { transparent: true, opacity: 0.45 }),
      a * 0.17,
      0.03,
      b * 0.17,
      drone
    );
    rotors.push(r);
  });

  // ---- Bookshelf, plants, clock ----
  bx(0.03, 2.1, 1.6, walnut, -3.96, 1.05, 3.4, room);
  [-0.785, 0.785].forEach(o => bx(0.35, 2.1, 0.03, walnut, -3.8, 1.05, 3.4 + o, room));
  [0.03, 0.45, 0.9, 1.35, 1.8, 2.1].forEach(y => bx(0.35, 0.03, 1.6, walnut, -3.8, y, 3.4, room));
  const bpal = [0x27407a, 0xa8402b, 0xd6a75c, 0x2e6b5e, 0xe8e4dc, 0x5a3a6b, accent.getHex()],
    books = new THREE.InstancedMesh(BOX, std(0xffffff, 0.7), 56),
    col = new THREE.Color();
  let bi = 0;
  for (let r = 0; r < 4; r++) {
    let zz = 2.7;
    for (let k = 0; k < 14; k++) {
      const w = 0.04 + rnd() * 0.04,
        h = 0.26 + rnd() * 0.12;
      zz += w / 2;
      D.position.set(-3.78, [0.045, 0.465, 0.915, 1.365][r] + h / 2, zz);
      D.rotation.set(0, 0, 0);
      D.scale.set(0.24, h, w);
      D.updateMatrix();
      books.setMatrixAt(bi, D.matrix);
      books.setColorAt(bi++, col.setHex(bpal[Math.floor(rnd() * bpal.length)]));
      zz += w / 2 + 0.005;
    }
  }
  books.castShadow = books.receiveShadow = true;
  room.add(books);
  cyl(0.22, 0.16, 0.38, 14, std(0xb5654a, 0.9), 3.5, 0.19, 4.3, room);
  cyl(0.02, 0.03, 0.9, 6, std(0x5a4030, 1), 3.5, 0.8, 4.3, room);
  for (let k = 0; k < 9; k++) {
    const a = k * 0.7,
      l = put(
        new THREE.SphereGeometry(0.2, 10, 8),
        leaf,
        3.5 + Math.cos(a) * 0.28,
        1.0 + (k % 3) * 0.28,
        4.3 + Math.sin(a) * 0.28,
        room
      );
    l.scale.set(1, 0.35, 0.6);
    l.rotation.y = -a;
  }
  const cc = cvs(256, 256),
    cx2 = cc.getContext('2d');
  cx2.fillStyle = '#f7f5ef';
  cx2.beginPath();
  cx2.arc(128, 128, 126, 0, 6.283);
  cx2.fill();
  cx2.fillStyle = '#222';
  for (let k = 0; k < 12; k++) {
    cx2.save();
    cx2.translate(128, 128);
    cx2.rotate(k * 0.5236);
    cx2.fillRect(-3, -118, 6, k % 3 ? 14 : 24);
    cx2.restore();
  }
  const face = new THREE.Mesh(
    new THREE.CircleGeometry(0.24, 40),
    new THREE.MeshBasicMaterial({ map: mkTex(cc), toneMapped: false })
  );
  face.position.set(0.9, 2.3, -4.965);
  room.add(face);
  const hourH = new THREE.Group(),
    minH = new THREE.Group();
  hourH.position.set(0.9, 2.3, -4.96);
  minH.position.set(0.9, 2.3, -4.955);
  room.add(hourH, minH);
  bx(0.014, 0.12, 0.004, metal, 0, 0.06, 0, hourH, false);
  bx(0.009, 0.18, 0.004, metal, 0, 0.09, 0, minH, false);

  // ---- Filling the big room: bar, fridge, armchair, lamp, server rack, 3D printer, holo table, shelves, art, gadgets ----
  const grp = (x, y, z, ry = 0, p = room) => {
    const g = new THREE.Group();
    g.position.set(x, y, z);
    g.rotation.y = ry;
    g.userData.merge = true;
    p.add(g);
    return g;
  };
  const plant = (x, z, h) => {
    const b = pot(x, z, 0.17, 0.3, 0xd8d2c6);
    cyl(0.012, 0.02, h * 0.9, 6, std(0x6b4a34, 0.9), x, b + h * 0.45, z, room);
    for (let k = 0; k < 16; k++) {
      const u = k / 15,
        az = k * 2.4,
        r = 0.02 + 0.03 * u,
        sc = (1.15 - 0.45 * u) * (h / 0.9);
      leafAt(
        x + Math.sin(az) * r,
        b + h * (0.3 + 0.7 * u),
        z + Math.cos(az) * r,
        az,
        1.0 - 0.6 * u,
        sc,
        [lf1, lf2, lf3][k % 3]
      );
    }
  };
  const snake = (x, z, h) => {
    const b = pot(x, z, 0.15, 0.26, 0x3b4048);
    for (let k = 0; k < 9; k++) {
      const az = k * 2.4,
        hh = h * (0.6 + (0.4 * ((k * 5) % 9)) / 8),
        l = leafAt(
          x + Math.sin(az) * 0.04,
          b,
          z + Math.cos(az) * 0.04,
          az,
          0.06 + (k % 4) * 0.08,
          1,
          [lf3, lf1][k % 2]
        );
      l.scale.set(0.55, hh / 0.42, 0.7);
    }
  };
  const hubC = cvs(256, 160),
    hubTex = mkTex(hubC);
  let hubK = -1;
  const hubPaint = () => {
    const x = hubC.getContext('2d'),
      m = Math.round(curH * 60) % 1440;
    x.fillStyle = '#08101c';
    x.fillRect(0, 0, 256, 160);
    x.fillStyle = `rgb(${A})`;
    x.font = '700 56px "Exo 2",sans-serif';
    x.fillText(String(Math.floor(m / 60)).padStart(2, '0') + ':' + String(m % 60).padStart(2, '0'), 16, 70);
    x.fillStyle = '#9fb4c8';
    x.font = '500 20px "Exo 2",sans-serif';
    x.fillText(wxText || 'Home hub', 16, 106, 224);
    x.fillText((site.weather && site.weather.label) || '', 16, 134, 224);
    hubTex.needsUpdate = true;
  };
  hubPaint();
  redo.push(hubPaint);
  const metalL = pbrT(PBR.brushed, 0.3, 0xc9ced6, { metalness: 0.9 }),
    stoolM = std(0x23282f, 0.6),
    quartz = pbrT(PBR.marble, 1.6, 0xffffff, { metalness: 0.05 }),
    slats = pbrT(PBR.wood, 0.5, 0x6b4a38),
    lth = pbrT(PBR.leather, 0.5, 0x9a5b3c);

  // Bar counter, stools, coffee machine, smart hub, back shelf with bottles, neon sign
  bx(2.4, 1.0, 0.6, slats, 1.95, 0.5, 4.7, room);
  bx(2.5, 0.04, 0.72, quartz, 1.95, 1.02, 4.66, room);
  bx(2.3, 0.02, 0.02, rgbMat(0.55), 1.95, 0.08, 4.38, room, false);
  [1.3, 1.95, 2.6].forEach(x => {
    cyl(0.18, 0.18, 0.05, 20, stoolM, x, 0.68, 3.95, room);
    cyl(0.025, 0.025, 0.64, 8, metalL, x, 0.34, 3.95, room);
    cyl(0.17, 0.17, 0.02, 16, metalL, x, 0.01, 3.95, room);
  });
  bx(0.3, 0.34, 0.3, metalL, 1.25, 1.21, 4.78, room);
  bx(0.3, 0.08, 0.3, dark, 1.25, 1.42, 4.78, room);
  bx(0.12, 0.012, 0.1, dark, 1.25, 1.06, 4.64, room);
  cyl(0.03, 0.025, 0.05, 10, std(0xf4f0e8, 0.4), 1.25, 1.09, 4.64, room);
  const hubM = new THREE.Mesh(new THREE.PlaneGeometry(0.2, 0.125), screenMat(hubTex));
  hubM.position.set(1.8, 1.14, 4.6);
  hubM.rotation.set(-0.35, Math.PI, 0);
  room.add(hubM);
  bx(0.22, 0.14, 0.015, dark, 1.8, 1.14, 4.61, room).rotation.set(-0.35, Math.PI, 0);
  cyl(0.12, 0.08, 0.05, 16, std(0xd9d3c6, 0.5), 2.5, 1.065, 4.6, room);
  [0xe8553a, 0xf2c14e, 0x7cc36a, 0xe8553a].forEach((c, i) =>
    put(
      new THREE.SphereGeometry(0.045, 10, 8),
      std(c, 0.6),
      2.5 + Math.cos(i * 1.6) * 0.05,
      1.12 + (i % 2) * 0.03,
      4.6 + Math.sin(i * 1.6) * 0.05,
      room,
      false
    )
  );
  [1.5, 1.85].forEach((y, r) => {
    bx(2.2, 0.03, 0.16, walnut, 1.95, y, 4.9, room);
    for (let k = 0; k < 7; k++) {
      const c = [0x2e6b5e, 0xa8402b, 0x27407a, 0xd6a75c, 0x5a3a6b][(k + r * 2) % 5];
      if ((k + r) % 3 === 0) bx(0.1, 0.12, 0.1, std(c, 0.6), 0.95 + k * 0.3, y + 0.075, 4.9, room);
      else
        cyl(
          0.03,
          0.035,
          0.2 + (k % 3) * 0.04,
          10,
          std(c, 0.15, 0.1, { transparent: true, opacity: 0.85 }),
          0.95 + k * 0.3,
          y + 0.115,
          4.9,
          room
        );
    }
  });
  bx(2.2, 0.012, 0.012, rgbMat(0.7), 1.95, 1.47, 4.84, room, false);
  bx(2.2, 0.012, 0.012, rgbMat(0.85), 1.95, 1.82, 4.84, room, false);
  const signC = cvs(512, 180),
    signT = mkTex(signC),
    signDraw = () => {
      const x = signC.getContext('2d');
      x.clearRect(0, 0, 512, 180);
      x.textAlign = 'center';
      x.font = '800 78px "Exo 2",sans-serif';
      x.shadowColor = '#ff3df2';
      x.shadowBlur = 26;
      x.fillStyle = '#ffd6fb';
      x.fillText(String(site.world.name).toUpperCase(), 256, 100, 480);
      x.shadowBlur = 0;
      x.strokeStyle = '#33e6ff';
      x.lineWidth = 5;
      rr(x, 8, 20, 496, 130, 26);
      x.stroke();
      signT.needsUpdate = true;
    };
  signDraw();
  redo.push(signDraw);
  const sign = new THREE.Mesh(
    new THREE.PlaneGeometry(1.4, 0.5),
    glow(0xffffff, 0.22, 1.5, {
      map: signT,
      transparent: true,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
    })
  );
  sign.position.set(1.95, 2.4, 4.955);
  sign.rotation.y = Math.PI;
  room.add(sign);
  halo(1.95, 2.4, 4.8, 2.6, 0.85, 0.55);

  // Smart fridge with a glowing display, and a tall plant beside the bar
  bx(0.7, 1.8, 0.7, metalL, 0.3, 0.9, 4.62, room);
  bx(0.012, 1.0, 0.012, dark, 0.3, 0.4, 4.265, room);
  bx(0.03, 0.6, 0.03, metal, 0.52, 1.15, 4.25, room);
  bx(0.22, 0.14, 0.008, glow(0x6fd8ff, 0.5, 1.1), 0.3, 1.38, 4.266, room, false);

  // Armchair by the window with a side table and an arc floor lamp
  const ac = grp(3.1, 0, 1.7, 2.82);
  bx(0.75, 0.16, 0.72, lth, 0, 0.34, 0, ac);
  bx(0.75, 0.5, 0.14, lth, 0, 0.66, -0.3, ac).rotation.x = -0.12;
  [-0.37, 0.37].forEach(x => bx(0.1, 0.28, 0.66, lth, x, 0.46, 0, ac));
  [
    [-0.3, -0.28],
    [0.3, -0.28],
    [-0.3, 0.28],
    [0.3, 0.28],
  ].forEach(([a, b]) => cyl(0.02, 0.014, 0.2, 6, metalL, a, 0.1, b, ac));
  bx(0.3, 0.3, 0.08, pill, 0.2, 0.62, -0.12, ac).rotation.set(-0.2, 0, 0.2);
  cyl(0.22, 0.22, 0.03, 22, wood, 3.55, 0.5, 2.3, room);
  cyl(0.02, 0.02, 0.48, 8, metalL, 3.55, 0.25, 2.3, room);
  cyl(0.14, 0.14, 0.015, 16, metalL, 3.55, 0.01, 2.3, room);
  cyl(0.07, 0.1, 0.14, 14, glow(0xffe0b0, 0.6, 1.3), 3.55, 0.6, 2.3, room);
  cyl(0.16, 0.18, 0.03, 20, metalL, 3.65, 0.015, 2.9, room);
  cyl(0.012, 0.012, 1.7, 8, metalL, 3.65, 0.85, 2.9, room);
  bx(0.015, 0.015, 0.9, metalL, 3.65, 1.7, 2.45, room);
  cyl(0.08, 0.2, 0.18, 18, glow(0xffe6c0, 0.55, 1.2), 3.65, 1.6, 2.0, room);

  // North wall: server rack with blinking LEDs, and a 3D printer on a workbench
  bx(0.62, 1.8, 0.62, dark, 0.25, 0.9, -4.65, room);
  const unit = std(0x151a22, 0.4, 0.7);
  for (let u = 0; u < 8; u++) bx(0.56, 0.13, 0.01, unit, 0.25, 0.3 + u * 0.17, -4.335, room);
  const ledM = new THREE.MeshBasicMaterial({ color: 0xffffff, toneMapped: false }),
    leds = new THREE.InstancedMesh(BOX, ledM, 32),
    LEDC = [0x39ff88, 0xffb000, 0x33e6ff, 0xff3df2];
  for (let i = 0; i < 32; i++) {
    D.position.set(0.25 + ((i % 4) - 1.5) * 0.12, 0.3 + Math.floor(i / 4) * 0.17, -4.328);
    D.rotation.set(0, 0, 0);
    D.scale.set(0.025, 0.025, 0.008);
    D.updateMatrix();
    leds.setMatrixAt(i, D.matrix);
    leds.setColorAt(i, col.setHex(LEDC[i % 4]));
  }
  room.add(leds);
  halo(0.25, 1.2, -4.2, 1.6, 0.5, 0.35);
  halo(-2.2, 2.0, -4.7, 5.0, 0.55, 0.3);
  halo(-3.2, 1.2, -4.6, 2.6, 0.85, 0.22);
  halo(1.7, 1.4, -4.6, 2.8, 0.5, 0.2);
  bx(1.2, 0.04, 0.7, wood, 1.65, 0.74, -4.6, room);
  bx(1.12, 0.08, 0.62, walnut, 1.65, 0.68, -4.6, room);
  bx(1.1, 0.02, 0.6, wood, 1.65, 0.2, -4.6, room);
  [
    [-0.55, -0.3],
    [0.55, -0.3],
    [-0.55, 0.3],
    [0.55, 0.3],
  ].forEach(([a, b]) => {
    bx(0.04, 0.72, 0.04, metal, 1.65 + a, 0.36, -4.6 + b, room);
    cyl(0.028, 0.028, 0.012, 8, dark, 1.65 + a, 0.006, -4.6 + b, room);
  });
  [
    [1.3, 0xe8553a],
    [1.5, 0x3d86d8],
    [1.7, 0xffd23d],
  ].forEach(([x, c]) => {
    cyl(0.06, 0.06, 0.05, 20, std(c, 0.6), x, 0.235, -4.6, room);
    cyl(0.02, 0.02, 0.052, 10, std(0xd8d2c6, 0.6), x, 0.235, -4.6, room);
  });

  const px = 1.65,
    pz = -4.6,
    frameP = std(0x1a1e24, 0.5, 0.6),
    acrylic = std(0x7a8b9c, 0.08, 0.2, { transparent: true, opacity: 0.16, depthWrite: false });
  bx(0.46, 0.05, 0.46, pbrT(PBR.brushed, 0.3, 0x3a4048, { metalness: 0.8 }), px, 0.785, pz, room);
  [
    [-0.22, -0.22],
    [0.22, -0.22],
    [-0.22, 0.22],
    [0.22, 0.22],
  ].forEach(([a, b]) => bx(0.022, 0.46, 0.022, frameP, px + a, 1.03, pz + b, room));
  bx(0.46, 0.025, 0.46, frameP, px, 1.265, pz, room);
  bx(0.44, 0.4, 0.012, std(0x0f1216, 0.6, 0.4), px, 1.04, pz - 0.215, room);
  [-0.22, 0.22].forEach(a => bx(0.008, 0.42, 0.42, acrylic, px + a, 1.04, pz, room, false));
  bx(0.42, 0.42, 0.008, acrylic, px, 1.04, pz + 0.225, room, false);
  bx(0.1, 0.014, 0.014, metalL, px, 1.2, pz + 0.235, room);
  bx(0.44, 0.006, 0.006, rgbMat(0.2), px, 1.245, pz + 0.2, room, false);
  bx(0.27, 0.012, 0.27, std(0x3b4350, 0.35, 0.8), px, 0.822, pz + 0.02, room);
  bx(0.3, 0.012, 0.3, frameP, px, 0.81, pz + 0.02, room);
  [-0.2, 0.2].forEach(a => cyl(0.006, 0.006, 0.42, 6, metalL, px + a, 1.04, pz - 0.19, room));
  const gantry = bx(0.42, 0.016, 0.024, metalL, px, 1.045, pz, room);
  gantry.userData.m = 0;
  const pobj = put(
    new THREE.CylinderGeometry(0.04, 0.05, 1, 10),
    std(accent, 0.4, 0.1, { emissive: accent, emissiveIntensity: 0.25 }),
    px,
    0.9,
    pz + 0.02,
    room
  );
  pobj.userData.m = 0;
  const hot = new THREE.Group();
  hot.position.set(px, 1.0, pz);
  room.add(hot);
  bx(0.055, 0.045, 0.045, frameP, 0, 0.015, 0, hot, false);
  bx(0.03, 0.03, 0.012, glow(0x58e6ff, 0.6, 1.6), 0, 0.012, 0.03, hot, false);
  cyl(0.003, 0.014, 0.018, 8, brass, 0, -0.016, 0, hot, false);
  const pdT = (() => {
    const c = cvs(256, 128),
      x = c.getContext('2d');
    x.fillStyle = '#04101a';
    x.fillRect(0, 0, 256, 128);
    x.fillStyle = '#58e6ff';
    x.font = '700 30px monospace';
    x.fillText('NOZ 210C', 14, 44);
    x.fillStyle = '#ffd23d';
    x.fillText('BED  60C', 14, 84);
    x.fillStyle = '#3ddc84';
    x.fillRect(14, 104, 170, 8);
    return mkTex(c);
  })();
  {
    const m = new THREE.Mesh(new THREE.PlaneGeometry(0.11, 0.055), screenMat(pdT));
    m.position.set(px + 0.12, 0.787, pz + 0.2315);
    room.add(m);
  }
  cyl(0.09, 0.09, 0.012, 24, std(0x20242a, 0.5), px, 1.38, pz - 0.05, room).rotation.x = Math.PI / 2;
  cyl(0.09, 0.09, 0.012, 24, std(0x20242a, 0.5), px, 1.38, pz + 0.01, room).rotation.x = Math.PI / 2;
  cyl(0.082, 0.082, 0.06, 24, std(accent, 0.5), px, 1.38, pz - 0.02, room).rotation.x = Math.PI / 2;
  cyl(0.03, 0.03, 0.065, 12, std(0xd8d2c6, 0.6), px, 1.38, pz - 0.02, room).rotation.x = Math.PI / 2;
  bx(0.02, 0.12, 0.02, frameP, px, 1.325, pz - 0.02, room);
  [
    [2.0, 0.78, -4.45, 0xe8553a, 0.04],
    [2.1, 0.78, -4.36, 0x3d86d8, 0.03],
  ].forEach(([x, y, z, c, r]) =>
    put(new THREE.CylinderGeometry(r * 0.6, r, 0.07, 10), std(c, 0.5), x, y + 0.015, z, room)
  );
  plant(3.5, -4.3, 0.9);

  // Centre of the room: a pedestal table. A flower vase by day, a holographic city by night
  const ht = grp(0.9, 0, 2.0);
  cyl(0.3, 0.36, 0.04, 24, metal, 0, 0.02, 0, ht);
  cyl(0.08, 0.12, 0.8, 16, dark, 0, 0.42, 0, ht);
  cyl(0.4, 0.4, 0.04, 28, std(0x10151c, 0.1, 0.8), 0, 0.84, 0, ht);
  put(new THREE.TorusGeometry(0.4, 0.008, 6, 40), rgbMat(0.5), 0, 0.865, 0, ht, false).rotation.x =
    Math.PI / 2;
  const vaseD = pivot(0.9, 0.86, 2.0, false);
  cyl(0.05, 0.04, 0.18, 14, std(0x9ebfd9, 0.1, 0.1, { transparent: true, opacity: 0.8 }), 0, 0.09, 0, vaseD);
  for (let k = 0; k < 6; k++) {
    cyl(
      0.004,
      0.004,
      0.25 + (k % 3) * 0.04,
      4,
      leaf,
      Math.cos(k) * 0.03,
      0.28,
      Math.sin(k) * 0.03,
      vaseD
    ).rotation.z = Math.cos(k) * 0.3;
    put(
      new THREE.SphereGeometry(0.035, 8, 6),
      std([0xff7a8a, 0xffd166, 0xfff1f1][k % 3], 0.8),
      Math.cos(k) * 0.07,
      0.42 + (k % 3) * 0.02,
      Math.sin(k) * 0.07,
      vaseD,
      false
    );
  }
  bx(0.22, 0.04, 0.16, std(0x27407a, 0.7), 0.2, 0.02, 0.15, vaseD);
  bx(0.2, 0.04, 0.15, std(0xa8402b, 0.7), 0.2, 0.06, 0.15, vaseD).rotation.y = 0.3;
  const cityP = pivot(0.9, 0.86, 2.0, true),
    cityM = rgbMat(0.5);
  cityM.transparent = true;
  cityM.opacity = 0.8;
  cityM.blending = THREE.AdditiveBlending;
  cityM.depthWrite = false;
  const cityG = new THREE.Group();
  cityG.position.y = 0.3;
  cityP.add(cityG);
  const city = new THREE.InstancedMesh(BOX, cityM, 40);
  for (let i = 0; i < 40; i++) {
    const a = hr(i, 1) * 6.283,
      r = 0.04 + Math.sqrt(hr(i, 2)) * 0.26,
      hh = 0.03 + hr(i, 3) * 0.22;
    D.position.set(Math.cos(a) * r, hh / 2 - 0.18, Math.sin(a) * r);
    D.rotation.set(0, hr(i, 4), 0);
    D.scale.set(0.03 + hr(i, 5) * 0.04, hh, 0.03 + hr(i, 6) * 0.04);
    D.updateMatrix();
    city.setMatrixAt(i, D.matrix);
  }
  cityG.add(city);
  const scan = new THREE.Mesh(new THREE.TorusGeometry(0.33, 0.004, 6, 40), cityM);
  scan.rotation.x = Math.PI / 2;
  cityG.add(scan);
  const beam = new THREE.Mesh(new THREE.CylinderGeometry(0.34, 0.34, 0.5, 28, 1, true), rgbMat(0.55));
  beam.position.y = -0.0;
  beam.material.transparent = true;
  beam.material.opacity = 0.12;
  beam.material.blending = THREE.AdditiveBlending;
  beam.material.depthWrite = false;
  beam.material.side = THREE.DoubleSide;
  cityG.add(beam);
  halo(0.9, 1.3, 2.0, 1.4, 0.5, 0.45);

  // East wall shelves with gadgets, south wall art, dining pendants, TV soundbar and speaker, tiny helpers
  [1.25, 1.65, 2.05].forEach(y => bx(0.24, 0.03, 1.6, walnut, 3.88, y, 2.7, room));
  bx(0.012, 0.012, 1.58, rgbMat(0.2), 3.99, 2.02, 2.7, room, false);
  [
    [1.28, 2.0, 0x27407a, 0.2, 0.05],
    [1.28, 2.15, 0xa8402b, 0.24, 0.05],
    [1.28, 2.3, 0x2e6b5e, 0.18, 0.05],
    [1.28, 3.2, 0xd6a75c, 0.22, 0.06],
  ].forEach(([y, z, c, h, w]) => bx(0.16, h, w, std(c, 0.6), 3.88, y + h / 2 + 0.015, z, room));
  bx(0.09, 0.1, 0.07, white, 3.88, 1.72, 2.4, room);
  bx(0.07, 0.06, 0.06, white, 3.88, 1.8, 2.4, room);
  [-0.02, 0.02].forEach(o => bx(0.012, 0.012, 0.012, rgbMat(0.5), 3.84, 1.8, 2.4 + o, room, false));
  put(new THREE.SphereGeometry(0.07, 14, 10), std(0x3d86d8, 0.4, 0.2), 3.88, 1.72, 3.0, room);
  cyl(0.03, 0.04, 0.02, 10, metal, 3.88, 1.685, 3.0, room);
  bx(0.12, 0.08, 0.1, dark, 3.88, 1.7, 3.4, room);
  put(new THREE.CylinderGeometry(0.02, 0.02, 0.05, 10), std(0xe8e4dc, 0.4), 3.88, 2.1, 2.4, room);
  const sky2 = cvs(300, 190),
    sx2 = sky2.getContext('2d'),
    sg2 = sx2.createLinearGradient(0, 0, 0, 190);
  sg2.addColorStop(0, '#2b0f5c');
  sg2.addColorStop(0.6, '#ff4f9a');
  sg2.addColorStop(1, '#ffb347');
  sx2.fillStyle = sg2;
  sx2.fillRect(0, 0, 300, 190);
  sx2.fillStyle = '#ffe9b0';
  sx2.beginPath();
  sx2.arc(210, 110, 28, 0, 6.283);
  sx2.fill();
  sx2.fillStyle = '#12081f';
  for (let i = 0; i < 16; i++) {
    const bw = 14 + hr(i, 1) * 14,
      bh = 40 + hr(i, 2) * 90;
    sx2.fillRect(i * 19, 190 - bh, bw, bh);
  }
  bx(1.5, 0.95, 0.03, frameM, -1.2, 1.75, 4.95, room);
  const artP = new THREE.Mesh(
    new THREE.PlaneGeometry(1.42, 0.87),
    glow(0xffffff, 0.55, 0.95, { map: mkTex(sky2) })
  );
  artP.position.set(-1.2, 1.75, 4.93);
  artP.rotation.y = Math.PI;
  room.add(artP);
  [-1.6, -1.0, -0.4].forEach(z => {
    cyl(0.004, 0.004, 0.9, 4, dark, 2.55, 2.55, z, room);
    cyl(0.09, 0.14, 0.14, 16, glow(0xffe6c0, 0.55, 1.15), 2.55, 2.05, z, room);
  });
  bx(0.08, 0.06, 0.8, dark, -3.8, 0.51, 1.2, room);
  cyl(0.05, 0.05, 0.14, 16, std(0x2c3138, 0.9), -3.8, 0.55, 1.72, room);
  cyl(0.052, 0.052, 0.008, 16, rgbMat(0.5), -3.8, 0.625, 1.72, room, false);
  bx(0.14, 0.03, 0.07, dark, -2.5, 0.41, 1.0, room);
  [
    [3.92, 1.5, 4.92, 0.1],
    [-3.92, 1.5, 4.92, 0.6],
    [-3.92, 1.5, -4.92, 0.35],
  ].forEach(([x, y, z, o]) => bx(0.04, 2.8, 0.04, rgbMat(o), x, y, z, room, false));
  bx(3.0, 0.03, 0.03, rgbMat(0.85), -1.2, 2.7, 4.95, room, false);
  bx(0.02, 0.02, 3.3, rgbMat(0.5), 3.97, 2.55, -1, room, false);
  const vac = new THREE.Group();
  room.add(vac);
  cyl(0.17, 0.17, 0.07, 24, std(0xdfe3e8, 0.4, 0.2), 0, 0.045, 0, vac);
  cyl(0.04, 0.04, 0.03, 12, dark, 0, 0.1, 0.02, vac);
  cyl(0.02, 0.02, 0.01, 8, rgbMat(0.35), 0.09, 0.085, 0, vac, false);

  // ---- Wall decor, door, desk clutter, light beams, soft furnishings ----
  const tx2 = (w, h, fn, rep) => {
    const c = cvs(w, h),
      x = c.getContext('2d');
    fn(x, w, h);
    return mkTex(c, rep);
  };
  const SF = 'sans-serif',
    MF = 'monospace',
    HAND = 'italic 700 22px cursive';
  const decal = (tex, w, h, x, y, z, ry, o) => {
    const m = new THREE.Mesh(
      new THREE.PlaneGeometry(w, h),
      new THREE.MeshStandardMaterial(Object.assign({ map: tex, roughness: 0.7 }, o))
    );
    m.position.set(x, y, z);
    m.rotation.y = ry;
    m.receiveShadow = true;
    room.add(m);
    return m;
  };
  const prj = i => projects[i % NP] || { title: 'Project', tags: [], role: '' };
  const spotM = (hex, lo, hi) =>
    glow(hex, lo, hi, {
      map: haloTex,
      transparent: true,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
    });
  const pool = (x, y, z, s, hex, lo, hi) => {
    const m = new THREE.Mesh(new THREE.PlaneGeometry(s, s), spotM(hex, lo, hi));
    m.rotation.x = -Math.PI / 2;
    m.position.set(x, y, z);
    room.add(m);
    return m;
  };
  const beamTex = tx2(16, 128, (x, W, H) => {
    const g = x.createLinearGradient(0, 0, 0, H);
    g.addColorStop(0, 'rgba(255,255,255,.9)');
    g.addColorStop(1, 'rgba(255,255,255,0)');
    x.fillStyle = g;
    x.fillRect(0, 0, W, H);
  });
  const cone = (x, y, z, r0, r1, h, hex, lo, hi) => {
    const m = new THREE.Mesh(
      new THREE.CylinderGeometry(r0, r1, h, 24, 1, true),
      glow(hex, lo, hi, {
        map: beamTex,
        transparent: true,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
        side: THREE.DoubleSide,
      })
    );
    m.position.set(x, y - h / 2, z);
    room.add(m);
    return m;
  };

  // Whiteboard with a system-design sketch (west wall) and marker tray
  const wbT = tx2(640, 400, (x, W, H) => {
    x.fillStyle = '#f3f5f6';
    x.fillRect(0, 0, W, H);
    x.fillStyle = 'rgba(0,0,0,.035)';
    for (let i = 0; i < 16; i++) x.fillRect(hr(i, 1) * W, hr(i, 2) * H, 40 + hr(i, 3) * 90, 7);
    x.lineWidth = 3.5;
    x.lineCap = 'round';
    x.lineJoin = 'round';
    x.textAlign = 'center';
    const B = '#1d5fd1',
      R2 = '#d6342c',
      G = '#1c9a55',
      K = '#2a2f36';
    const box = (X, Y, w, h, t, c) => {
      x.strokeStyle = c;
      x.fillStyle = c;
      x.beginPath();
      rr(x, X, Y, w, h, 9);
      x.stroke();
      x.font = '700 24px ' + MF;
      x.fillText(t, X + w / 2, Y + h / 2 + 8, w - 12);
    };
    const arr = (x1, y1, x2, y2, c) => {
      x.strokeStyle = c;
      x.beginPath();
      x.moveTo(x1, y1);
      x.lineTo(x2, y2);
      x.stroke();
      const a = Math.atan2(y2 - y1, x2 - x1);
      x.beginPath();
      x.moveTo(x2 - 13 * Math.cos(a - 0.45), y2 - 13 * Math.sin(a - 0.45));
      x.lineTo(x2, y2);
      x.lineTo(x2 - 13 * Math.cos(a + 0.45), y2 - 13 * Math.sin(a + 0.45));
      x.stroke();
    };
    x.fillStyle = B;
    x.font = '700 30px ' + MF;
    x.textAlign = 'left';
    x.fillText('// ' + String(site.world.name).toLowerCase() + ' · architecture', 28, 44);
    x.textAlign = 'center';
    const sk = i => String(site.skills[i % site.skills.length] || 'svc');
    box(28, 120, 120, 56, 'client', B);
    box(210, 120, 110, 56, 'edge', B);
    box(390, 70, 120, 56, 'api', G);
    box(390, 180, 120, 56, sk(1).slice(0, 10), G);
    box(530, 120, 90, 56, 'db', R2);
    arr(148, 148, 208, 148, K);
    arr(320, 140, 388, 106, K);
    arr(320, 156, 388, 205, K);
    arr(510, 98, 560, 118, K);
    arr(510, 208, 560, 178, K);
    x.strokeStyle = R2;
    x.setLineDash([9, 8]);
    x.beginPath();
    rr(x, 372, 52, 154, 200, 14);
    x.stroke();
    x.setLineDash([]);
    x.fillStyle = R2;
    x.font = HAND;
    x.fillText('hot path', 450, 276);
    x.strokeStyle = B;
    x.beginPath();
    x.ellipse(88, 148, 78, 44, 0, 0, 6.28);
    x.stroke();
    x.fillStyle = K;
    x.font = '600 22px ' + MF;
    x.textAlign = 'left';
    [prj(0).title, prj(1).title, prj(2).title].forEach((t, i) => {
      x.fillStyle = [B, G, R2][i];
      x.fillText('☐ ship: ' + String(t).slice(0, 22), 30, 310 + i * 28);
    });
    x.fillStyle = '#ffe66b';
    x.save();
    x.translate(470, 300);
    x.rotate(0.06);
    x.fillRect(0, 0, 130, 78);
    x.fillStyle = K;
    x.font = HAND;
    x.fillText('cache', 12, 30);
    x.fillText('invalidation?', 12, 58);
    x.restore();
  });
  decal(wbT, 1.5, 0.94, -3.966, 1.72, -1.4, Math.PI / 2);
  bx(0.025, 0.98, 1.56, std(0xc9ced4, 0.4, 0.8), -3.99, 1.72, -1.4, room);
  bx(0.05, 0.025, 0.55, metalL, -3.96, 1.2, -1.4, room);
  [
    [0.12, 0x1d5fd1],
    [0.2, 0xd6342c],
    [0.28, 0x1c9a55],
  ].forEach(
    ([o, c]) =>
      (cyl(0.011, 0.011, 0.12, 8, std(c, 0.5), -3.95, 1.222, -1.4 + o - 0.2, room).rotation.x = Math.PI / 2)
  );
  bx(0.02, 0.06, 0.1, white, -3.95, 1.235, -1.05, room);

  // Cork board with polaroids, sticky notes and red string
  const corkT = tx2(512, 360, (x, W, H) => {
    x.fillStyle = '#b98757';
    x.fillRect(0, 0, W, H);
    for (let i = 0; i < 1400; i++) {
      x.fillStyle = `rgba(${(60 + hr(i, 1) * 80) | 0},${(30 + hr(i, 2) * 40) | 0},10,${0.05 + hr(i, 3) * 0.14})`;
      x.fillRect(hr(i, 4) * W, hr(i, 5) * H, 1 + hr(i, 6) * 4, 1 + hr(i, 7) * 3);
    }
    const pins = [],
      pol = (X, Y, rot, g1, g2, cap) => {
        x.save();
        x.translate(X, Y);
        x.rotate(rot);
        x.shadowColor = 'rgba(0,0,0,.4)';
        x.shadowBlur = 8;
        x.shadowOffsetY = 4;
        x.fillStyle = '#f7f4ec';
        x.fillRect(-52, -60, 104, 124);
        x.shadowColor = 'transparent';
        const g = x.createLinearGradient(0, -50, 0, 30);
        g.addColorStop(0, g1);
        g.addColorStop(1, g2);
        x.fillStyle = g;
        x.fillRect(-45, -53, 90, 84);
        x.fillStyle = 'rgba(0,0,0,.25)';
        x.beginPath();
        x.moveTo(-45, 31);
        x.lineTo(-18, -8);
        x.lineTo(2, 14);
        x.lineTo(20, -14);
        x.lineTo(45, 31);
        x.fill();
        x.fillStyle = '#2a2f36';
        x.font = HAND;
        x.textAlign = 'center';
        x.fillText(String(cap).slice(0, 11), 0, 54, 90);
        x.restore();
        pins.push([X + Math.sin(rot) * -3, Y - 58]);
      };
    pol(90, 120, -0.1, '#ffb347', '#ff4f9a', prj(0).title);
    pol(230, 140, 0.07, '#3dd7ff', '#27407a', prj(1).title);
    pol(370, 118, -0.05, '#7cc36a', '#1f4f3a', prj(2).title);
    pol(440, 250, 0.12, '#c9a7ff', '#3b2a7a', site.world.mark || 'OA');
    pol(
      150,
      262,
      0.05,
      '#ffd23d',
      '#c4602b',
      String(site.role)
        .split(/[,/·|]/)[0]
        .trim()
    );
    x.strokeStyle = '#c4261f';
    x.lineWidth = 2;
    x.beginPath();
    pins.forEach((p, i) => {
      x[i ? 'lineTo' : 'moveTo'](p[0], p[1] + (i % 2) * 6);
    });
    x.stroke();
    [
      ['#ffe66b', 285, 40, -0.08, 'todo:'],
      ['#ff9bdc', 20, 20, 0.05, 'ship it'],
    ].forEach(([c, X, Y, r, t]) => {
      x.save();
      x.translate(X, Y);
      x.rotate(r);
      x.fillStyle = c;
      x.fillRect(0, 0, 74, 74);
      x.fillStyle = '#2a2f36';
      x.font = HAND;
      x.textAlign = 'left';
      x.fillText(t, 8, 30);
      x.fillText('· · ·', 8, 54);
      x.restore();
      pins.push([X + 37, Y + 4]);
    });
    pins.forEach(([X, Y], i) => {
      x.fillStyle = ['#e8553a', '#3dd7ff', '#ffd23d'][i % 3];
      x.beginPath();
      x.arc(X, Y, 6, 0, 6.28);
      x.fill();
      x.fillStyle = 'rgba(255,255,255,.55)';
      x.beginPath();
      x.arc(X - 2, Y - 2, 2, 0, 6.28);
      x.fill();
    });
  });
  decal(corkT, 1.0, 0.7, -3.958, 1.72, -3.05, Math.PI / 2, { roughness: 1 });
  bx(0.03, 0.74, 1.06, walnut, -3.985, 1.72, -3.05, room);

  // Slat panel with backlight strips behind the TV
  bx(0.02, 2.4, 2.8, std(0x15181c, 0.9), -3.99, 1.4, 1.2, room);
  for (let k = 0; k < 22; k++) bx(0.03, 2.4, 0.07, slats, -3.972, 1.4, -0.1 + k * 0.126, room);
  [-0.12, 2.52].forEach((z, i) => bx(0.012, 2.4, 0.02, rgbMat(0.15 + i * 0.4), -3.96, 1.4, z, room, false));

  // Project poster gallery (east wall, north)
  [0, 1, 2].forEach(i => {
    const p = prj(i),
      hue = (i * 80 + 190) % 360;
    const pt = tx2(256, 360, (x, W, H) => {
      const g = x.createLinearGradient(0, 0, W, H);
      g.addColorStop(0, `hsl(${hue},70%,22%)`);
      g.addColorStop(1, `hsl(${(hue + 60) % 360},75%,48%)`);
      x.fillStyle = g;
      x.fillRect(0, 0, W, H);
      x.strokeStyle = 'rgba(255,255,255,.18)';
      x.lineWidth = 2;
      for (let k = 0; k < 6; k++) {
        x.beginPath();
        x.arc(200, 90, 20 + k * 22, 0, 6.28);
        x.stroke();
      }
      x.fillStyle = 'rgba(255,255,255,.9)';
      x.fillRect(22, 24, 36, 5);
      x.font = '800 30px ' + SF;
      x.textAlign = 'left';
      wrapText(x, String(p.title).toUpperCase(), 22, 210, 210, 34);
      x.font = '500 14px ' + MF;
      x.fillStyle = 'rgba(255,255,255,.8)';
      x.fillText(String(p.role || '').slice(0, 28), 22, 300);
      x.fillText(((p.year || '') + '  ' + (p.tags || []).slice(0, 2).join(' · ')).slice(0, 30), 22, 322);
    });
    const z = -4.62 + i * 0.57;
    decal(pt, 0.46, 0.64, 3.962, 1.85, z, -Math.PI / 2);
    bx(0.03, 0.68, 0.5, i === 1 ? walnut : frameM, 3.985, 1.85, z, room);
  });

  // Entrance door (south wall), mat, coat hooks
  bx(1.05, 2.12, 0.03, trim, -3.1, 1.06, 4.985, room);
  bx(0.92, 2.05, 0.05, walnut, -3.1, 1.025, 4.97, room);
  [1.55, 0.6].forEach(y => bx(0.7, y === 1.55 ? 0.7 : 0.8, 0.012, std(0x5a3f31, 0.7), -3.1, y, 4.942, room));
  bx(0.1, 0.025, 0.04, metalL, -2.74, 1.0, 4.925, room);
  cyl(0.03, 0.03, 0.02, 14, metalL, -2.72, 1.0, 4.94, room).rotation.x = Math.PI / 2;
  cyl(0.012, 0.012, 0.01, 10, dark, -3.1, 1.65, 4.94, room).rotation.x = Math.PI / 2;
  bx(0.9, 0.006, 0.02, glow(0xfff0d0, 0.6, 0.9), -3.1, 0.004, 4.93, room, false);
  const matT = tx2(256, 160, (x, W, H) => {
    x.fillStyle = '#2b2f36';
    x.fillRect(0, 0, W, H);
    x.strokeStyle = `rgb(${A})`;
    x.lineWidth = 4;
    x.strokeRect(10, 10, W - 20, H - 20);
    x.fillStyle = '#e8eef5';
    x.font = '800 42px ' + SF;
    x.textAlign = 'center';
    x.fillText('WELCOME', W / 2, H / 2 + 14);
  });
  {
    const m = new THREE.Mesh(
      new THREE.PlaneGeometry(0.9, 0.56),
      new THREE.MeshStandardMaterial({ map: matT, roughness: 1 })
    );
    m.rotation.x = -Math.PI / 2;
    m.rotation.z = Math.PI;
    m.position.set(-3.1, 0.012, 4.6);
    m.receiveShadow = true;
    room.add(m);
  }
  bx(0.32, 0.05, 0.03, walnut, -2.28, 1.62, 4.97, room);
  [-2.4, -2.28, -2.16].forEach(
    x => (cyl(0.012, 0.012, 0.05, 8, metalL, x, 1.62, 4.94, room).rotation.x = Math.PI / 2)
  );
  bx(0.17, 0.56, 0.07, std(0x2c3e50, 0.85), -2.4, 1.3, 4.92, room);
  bx(0.13, 0.12, 0.08, std(0x2c3e50, 0.85), -2.4, 1.62, 4.92, room);
  cyl(0.06, 0.06, 0.03, 14, std(0xe8553a, 0.7), -2.28, 1.56, 4.92, room);
  bx(0.2, 0.3, 0.1, std(0xe8553a, 0.7), -2.1, 1.38, 4.92, room);

  // Desk clutter: lamp, pen cup, duck, sticky pad, drawer unit, cables, speakers
  const cup = grp(-3.3, 0.765, -4.78);
  cyl(0.04, 0.035, 0.1, 14, std(0x3c4a5a, 0.5, 0.2), 0, 0.05, 0, cup);
  [
    [0.01, 0.17, 0xd6342c, 0.15],
    [-0.015, 0.15, 0x1d5fd1, -0.1],
    [0.0, 0.16, 0xffd23d, 0.02],
  ].forEach(([o, h, c, r]) => {
    const p = cyl(0.005, 0.005, h, 6, std(c, 0.5), o, 0.09, 0.005 * (r > 0 ? 1 : -1), cup);
    p.rotation.z = r;
  });
  const duck = grp(-0.74, 0.492, -4.55, -0.5);
  put(new THREE.SphereGeometry(0.03, 12, 10), std(0xffd23d, 0.4), 0, 0.03, 0, duck).scale.set(1.15, 0.9, 1);
  put(new THREE.SphereGeometry(0.02, 10, 8), std(0xffd23d, 0.4), 0, 0.068, 0.018, duck);
  bx(0.02, 0.008, 0.016, std(0xff8a1f, 0.5), 0, 0.064, 0.04, duck);
  put(new THREE.SphereGeometry(0.004, 6, 5), dark, 0.011, 0.074, 0.03, duck, false);
  put(new THREE.SphereGeometry(0.004, 6, 5), dark, -0.011, 0.074, 0.03, duck, false);
  bx(0.07, 0.022, 0.07, std(0xffe66b, 0.8), -3.0, 0.776, -4.3, room).rotation.y = 0.3;
  bx(0.07, 0.003, 0.07, std(0xff9bdc, 0.8), -2.96, 0.7685, -4.24, room, false).rotation.y = -0.2;
  bx(0.4, 0.55, 0.6, walnut, -3.1, 0.275, -4.55, room);
  [0.1, 0.38].forEach(y => {
    bx(0.36, 0.22, 0.012, std(0x8a6a52, 0.6), -3.1, y, -4.25, room);
    bx(0.12, 0.012, 0.02, metalL, -3.1, y + 0.06, -4.245, room);
  });
  cyl(0.006, 0.006, 1.46, 6, std(0x0c0e11, 0.8), -1.47, 0.012, -4.9, room).rotation.z = Math.PI / 2;
  cyl(0.006, 0.006, 0.73, 6, std(0x0c0e11, 0.8), -2.2, 0.38, -4.93, room);
  cyl(0.006, 0.006, 0.73, 6, std(0xc9ced4, 0.8), -2.12, 0.38, -4.93, room);
  bx(0.3, 0.03, 0.06, white, -1.6, 0.02, -4.88, room);
  [-0.1, -0.03, 0.04, 0.1].forEach(o => bx(0.025, 0.006, 0.02, dark, -1.6 + o, 0.037, -4.88, room, false));
  bx(0.012, 0.006, 0.012, glow(0xff3030, 0.8, 1.2), -1.72, 0.037, -4.86, room, false);
  [-3.17, -1.23].forEach(x => {
    bx(0.12, 0.22, 0.14, std(0x1a1e24, 0.5, 0.3), x, 0.875, -4.8, room);
    cyl(0.04, 0.04, 0.004, 16, dark, x, 0.88, -4.725, room).rotation.x = Math.PI / 2;
    cyl(0.014, 0.014, 0.004, 12, dark, x, 0.95, -4.725, room).rotation.x = Math.PI / 2;
  });

  // Dining: pendant light cones, glow pool, jute rug
  [-1.6, -1.0, -0.4].forEach(z => cone(2.55, 1.96, z, 0.12, 0.5, 1.18, 0xffe2b0, 0.06, 0.14));
  pool(2.55, 0.768, -1, 1.5, 0xffd9a0, 0.3, 0.55);
  {
    const r1 = new THREE.Mesh(new THREE.PlaneGeometry(1.9, 2.5), std(0x7a6244, 1)),
      r2 = new THREE.Mesh(new THREE.PlaneGeometry(1.7, 2.3), pbr(PBR.fabric, 4, 5, 0xc8b48c));
    [r1, r2].forEach((m, i) => {
      m.rotation.x = -Math.PI / 2;
      m.position.set(2.55, 0.007 + i * 0.002, -1);
      m.receiveShadow = true;
      room.add(m);
    });
  }

  // Living: throw blanket, pillows, coffee table props
  const plaid = tx2(
    64,
    64,
    (x, W, H) => {
      x.fillStyle = '#c0583a';
      x.fillRect(0, 0, W, H);
      x.fillStyle = 'rgba(20,20,30,.55)';
      x.fillRect(0, 10, W, 8);
      x.fillRect(10, 0, 8, H);
      x.fillStyle = 'rgba(255,230,190,.45)';
      x.fillRect(0, 36, W, 3);
      x.fillRect(36, 0, 3, H);
    },
    [2, 2]
  );
  const throwM = new THREE.MeshStandardMaterial({ map: plaid, roughness: 1 });
  bx(0.8, 0.035, 0.62, throwM, -0.55, 0.605, 0.07, sofa).rotation.z = 0.04;
  bx(0.8, 0.3, 0.035, throwM, -0.55, 0.45, 0.5, sofa);
  bx(0.3, 0.3, 0.1, pbrT(PBR.fabric, 0.5, 0xd9a441), -0.82, 0.78, -0.08, sofa).rotation.set(-0.2, 0, -0.3);
  [
    [-0.5, 0x27407a, 0.025],
    [-0.5, 0xa8402b, 0.0],
    [-0.5, 0x2e6b5e, -0.02],
  ].forEach(([_, c, o], i) => {
    const b = bx(0.2, 0.025, 0.15, std(c, 0.6), -2.52 + o, 0.4125 + i * 0.025, 1.25, room);
    b.rotation.y = i * 0.35;
  });
  cyl(0.03, 0.025, 0.04, 10, std(0xe8e4dc, 0.6), -2.52, 0.495, 1.25, room);
  for (let k = 0; k < 5; k++)
    put(
      new THREE.SphereGeometry(0.02, 8, 6),
      leaf,
      -2.52 + Math.cos(k * 1.26) * 0.022,
      0.53 + (k % 2) * 0.01,
      1.25 + Math.sin(k * 1.26) * 0.022,
      room,
      false
    ).scale.set(1, 0.6, 1);
  cyl(0.032, 0.032, 0.06, 14, std(0xf3efe6, 0.5), -2.25, 0.43, 1.06, room);
  put(new THREE.SphereGeometry(0.009, 8, 6), glow(0xffb347, 1.2, 1.6), -2.25, 0.47, 1.06, room, false);
  pool(-2.25, 0.403, 1.06, 0.45, 0xffb347, 0.12, 0.22);

  // Window: sheer curtains, rod, sill plants
  cyl(0.012, 0.012, 4.2, 8, dark, 3.93, 2.68, -1, room).rotation.x = Math.PI / 2;
  [-3.1, 1.1].forEach(z => put(new THREE.SphereGeometry(0.024, 10, 8), metalL, 3.93, 2.68, z, room, false));
  const curtains = [-2.88, 0.88].map(z => {
    const g = new THREE.PlaneGeometry(0.55, 1.95, 14, 1),
      p = g.attributes.position;
    for (let i = 0; i < p.count; i++) p.setZ(i, Math.sin(p.getX(i) * 22) * 0.03);
    g.computeVertexNormals();
    const m = new THREE.Mesh(
      g,
      new THREE.MeshLambertMaterial({
        color: 0xf4efe6,
        transparent: true,
        opacity: 0.7,
        side: THREE.DoubleSide,
        depthWrite: false,
      })
    );
    m.position.set(3.93, 1.65, z);
    m.rotation.y = -Math.PI / 2;
    room.add(m);
    return m;
  });
  [
    [-2.2, 0],
    [-1.7, 1],
    [0.1, 2],
  ].forEach(([z, kind]) => {
    const b = pot(3.88, z, 0.05, 0.06, [0xb5654a, 0xe8e4dc, 0x3c4a5a][kind], 0.945);
    if (kind === 0) {
      cyl(0.028, 0.03, 0.17, 10, lf1, 3.88, b + 0.085, z, room);
      [-1, 1].forEach(s2 => {
        cyl(0.012, 0.012, 0.06, 6, lf1, 3.88, b + 0.09, z + s2 * 0.04, room).rotation.x = s2 * 0.9;
      });
    } else if (kind === 1) rosette(3.88, b, z, 10, 0.3, lf2);
    else {
      for (let k = 0; k < 6; k++) leafAt(3.88, b, z, k * 1.3, 0.7 + (k % 2) * 0.3, 0.26, lf1);
      for (let k = 0; k < 5; k++)
        leafAt(3.86 + (k % 2) * 0.03, 0.96 - k * 0.07, z + (k - 2) * 0.02, k * 2 + 1, 2.7, 0.2, lf2);
    }
  });

  // Kitchen bits on the bar
  cyl(0.07, 0.09, 0.18, 14, metalL, 2.95, 1.13, 4.65, room);
  cyl(0.05, 0.07, 0.04, 14, dark, 2.95, 1.24, 4.65, room);
  bx(0.012, 0.1, 0.05, dark, 3.03, 1.14, 4.65, room).rotation.z = -0.2;
  bx(0.03, 0.02, 0.03, glow(0x58a6ff, 0.7, 1.2), 2.95, 1.045, 4.65, room, false);
  bx(0.2, 0.14, 0.13, std(0xd9534f, 0.4, 0.3), 1.55, 1.11, 4.8, room);
  [-0.04, 0.04].forEach(o => bx(0.02, 0.006, 0.09, dark, 1.55 + o, 1.182, 4.8, room, false));

  // Gadgets: laptop, stream deck, headphones, smart speaker, air purifier, thermostat, shelf curios, game pad, better robot vacuum, floor plants
  const lapS = makeScreen('code', PAL(2), 256, 144);
  lapS.paint(0);
  redo.push(() => lapS.paint(0));
  const lap = grp(-1.5, 0.766, -4.34, 0.2),
    lapM = pbrT(PBR.brushed, 0.25, 0xc4cad2, { metalness: 0.9 });
  bx(0.32, 0.012, 0.22, lapM, 0, 0.006, 0, lap);
  {
    const lkT = tx2(512, 180, (x, W, H) => {
        x.fillStyle = '#0b0d10';
        x.fillRect(0, 0, W, H);
        for (let r = 0; r < 5; r++) {
          const n = r === 4 ? 9 : 13,
            kw = W / n;
          for (let k = 0; k < n; k++) {
            const g = x.createLinearGradient(0, r * 36, 0, r * 36 + 32);
            g.addColorStop(0, '#2a2f37');
            g.addColorStop(1, '#171a20');
            x.fillStyle = g;
            rr(x, k * kw + 3, r * 36 + 3, kw - 6, 30, 5);
            x.fill();
            x.strokeStyle = 'rgba(80,220,255,.5)';
            x.lineWidth = 1.2;
            x.stroke();
          }
        }
      }),
      kb = new THREE.Mesh(
        new THREE.PlaneGeometry(0.285, 0.1),
        new THREE.MeshStandardMaterial({
          map: lkT,
          emissiveMap: lkT,
          emissive: 0xffffff,
          emissiveIntensity: 0.3,
          roughness: 0.5,
        })
      );
    kb.rotation.x = -Math.PI / 2;
    kb.position.set(0, 0.0135, -0.03);
    lap.add(kb);
  }
  bx(0.1, 0.0025, 0.06, lapM, 0, 0.0128, 0.065, lap, false);
  [-0.14, 0.14].forEach(a =>
    [-0.09, 0.09].forEach(b => cyl(0.008, 0.008, 0.004, 8, dark, a, -0.001, b, lap))
  );
  bx(0.3, 0.003, 0.003, rgbMat(0.3), 0, 0.0125, 0.108, lap, false);
  const lid = new THREE.Group();
  lid.position.set(0, 0.012, -0.108);
  lid.rotation.x = -0.3;
  lap.add(lid);
  bx(0.32, 0.22, 0.008, lapM, 0, 0.11, -0.004, lid);
  const ls = new THREE.Mesh(new THREE.PlaneGeometry(0.295, 0.2), screenMat(lapS.tex));
  ls.position.set(0, 0.112, 0.0006);
  lid.add(ls);
  cyl(0.02, 0.02, 0.002, 14, glow(0xffffff, 0.5, 1.4), 0, 0.11, -0.0085, lid).rotation.x = Math.PI / 2;
  const deckT = tx2(384, 256, (x, W, H) => {
    x.fillStyle = '#05080c';
    x.fillRect(0, 0, W, H);
    for (let i = 0; i < 6; i++) {
      const cx = (i % 3) * 128 + 10,
        cy = Math.floor(i / 3) * 128 + 10,
        S = 108,
        g = x.createLinearGradient(cx, cy, cx + S, cy + S);
      g.addColorStop(0, `hsl(${(i * 55 + 180) % 360},90%,58%)`);
      g.addColorStop(1, `hsl(${(i * 55 + 250) % 360},90%,30%)`);
      x.fillStyle = g;
      rr(x, cx, cy, S, S, 16);
      x.fill();
      const gl = x.createLinearGradient(0, cy, 0, cy + S * 0.55);
      gl.addColorStop(0, 'rgba(255,255,255,.35)');
      gl.addColorStop(1, 'rgba(255,255,255,0)');
      x.fillStyle = gl;
      rr(x, cx + 3, cy + 3, S - 6, S * 0.55, 13);
      x.fill();
      x.strokeStyle = 'rgba(0,0,0,.45)';
      x.lineWidth = 3;
      rr(x, cx, cy, S, S, 16);
      x.stroke();
      x.strokeStyle = '#fff';
      x.fillStyle = '#fff';
      x.lineWidth = 7;
      x.lineCap = 'round';
      x.lineJoin = 'round';
      const mx = cx + S / 2,
        my = cy + S / 2;
      x.beginPath();
      if (i === 0) {
        x.moveTo(mx - 10, my - 20);
        x.lineTo(mx - 28, my);
        x.lineTo(mx - 10, my + 20);
        x.moveTo(mx + 10, my - 20);
        x.lineTo(mx + 28, my);
        x.lineTo(mx + 10, my + 20);
        x.moveTo(mx + 5, my - 26);
        x.lineTo(mx - 5, my + 26);
        x.stroke();
      } else if (i === 1) {
        x.font = '800 44px monospace';
        x.textAlign = 'center';
        x.fillText('{ }', mx, my + 15);
      } else if (i === 2) {
        x.moveTo(mx - 14, my - 22);
        x.lineTo(mx + 24, my);
        x.lineTo(mx - 14, my + 22);
        x.closePath();
        x.fill();
      } else if (i === 3) {
        rr(x, mx - 11, my - 28, 22, 38, 11);
        x.stroke();
        x.beginPath();
        x.arc(mx, my + 2, 20, 0.15 * Math.PI, 0.85 * Math.PI);
        x.stroke();
        x.beginPath();
        x.moveTo(mx, my + 22);
        x.lineTo(mx, my + 32);
        x.stroke();
      } else if (i === 4) {
        x.arc(mx, my, 24, 0.4, 5.2);
        x.stroke();
        x.beginPath();
        x.moveTo(mx + 14, my - 30);
        x.lineTo(mx + 26, my - 14);
        x.lineTo(mx + 6, my - 12);
        x.fill();
      } else {
        x.moveTo(mx - 14, my - 26);
        x.lineTo(mx - 14, my + 26);
        x.moveTo(mx - 14, my - 4);
        x.quadraticCurveTo(mx + 14, my - 4, mx + 14, my - 18);
        x.stroke();
        [
          [mx - 14, my - 28],
          [mx - 14, my + 28],
          [mx + 14, my - 20],
        ].forEach(([a, b]) => {
          x.beginPath();
          x.arc(a, b, 8, 0, 6.3);
          x.fill();
        });
      }
    }
  });
  const deck = grp(-2.76, 0.766, -4.28, 0.15);
  bx(0.17, 0.018, 0.115, pbrT(PBR.plastic, 0.2, 0x22262c), 0, 0.009, 0, deck);
  {
    const dp = new THREE.Mesh(new THREE.PlaneGeometry(0.15, 0.1), glow(0xffffff, 0.5, 1.5, { map: deckT }));
    dp.rotation.x = -Math.PI / 2;
    dp.position.y = 0.0195;
    deck.add(dp);
  }
  const hp = pivot(-1.1, 0.766, -4.28, false, -0.3);
  cyl(0.05, 0.055, 0.012, 16, dark, 0, 0.006, 0, hp);
  cyl(0.008, 0.008, 0.26, 8, metalL, 0, 0.13, 0, hp);
  put(
    new THREE.TorusGeometry(0.07, 0.009, 8, 20, Math.PI),
    pbr(PBR.carbon, 6, 1, 0xffffff, { metalness: 0.3 }),
    0,
    0.2,
    0,
    hp
  );
  [-0.07, 0.07].forEach(o => {
    cyl(0.038, 0.038, 0.03, 16, pbr(PBR.plastic, 1, 1, 0x2a2f36), o, 0.2, 0, hp).rotation.z = Math.PI / 2;
    cyl(0.035, 0.035, 0.014, 16, pbr(PBR.leather, 1, 1, 0x1c1d20), o * 0.62, 0.2, 0, hp).rotation.z =
      Math.PI / 2;
    put(
      new THREE.TorusGeometry(0.028, 0.004, 6, 20),
      rgbMat(0.5),
      o + (o < 0 ? -0.017 : 0.017),
      0.2,
      0,
      hp,
      false
    ).rotation.y = Math.PI / 2;
  });
  cyl(0.055, 0.06, 0.14, 20, pbr(PBR.grille, 3, 1.2, 0x8a929c, { metalness: 0.35 }), 0.9, 1.11, 4.6, room);
  cyl(0.056, 0.056, 0.006, 20, dark, 0.9, 1.183, 4.6, room);
  put(
    new THREE.TorusGeometry(0.045, 0.004, 6, 24),
    glow(0x3dd7ff, 0.5, 1.8),
    0.9,
    1.187,
    4.6,
    room,
    false
  ).rotation.x = Math.PI / 2;
  cyl(0.13, 0.13, 0.7, 20, pbr(PBR.plastic, 2, 3, 0xf4f6f8), 3.55, 0.35, 0.95, room);
  cyl(0.125, 0.125, 0.05, 20, dark, 3.55, 0.725, 0.95, room);
  put(
    new THREE.TorusGeometry(0.1, 0.006, 6, 28),
    glow(0x58e6ff, 0.35, 1.8),
    3.55,
    0.755,
    0.95,
    room,
    false
  ).rotation.x = Math.PI / 2;
  cyl(0.1325, 0.1325, 0.34, 24, pbr(PBR.grille, 5, 2, 0x4a525c, { metalness: 0.4 }), 3.55, 0.32, 0.95, room);
  bx(0.004, 0.012, 0.06, glow(0x58e6ff, 0.7, 1.6), 3.419, 0.55, 0.95, room, false);
  cyl(0.06, 0.06, 0.02, 24, white, 3.99, 1.35, -2.85, room).rotation.z = Math.PI / 2;
  {
    const tT = tx2(128, 128, (x, W, H) => {
        x.fillStyle = '#04101a';
        x.fillRect(0, 0, W, H);
        x.strokeStyle = '#58a6ff';
        x.lineWidth = 6;
        x.beginPath();
        x.arc(64, 64, 54, 0.8, 5.6);
        x.stroke();
        x.fillStyle = '#e8f6ff';
        x.font = '700 44px sans-serif';
        x.textAlign = 'center';
        x.fillText('21°', 64, 78);
        x.font = '600 14px sans-serif';
        x.fillStyle = '#7fd0ff';
        x.fillText('HEAT', 64, 100);
      }),
      tm = new THREE.Mesh(new THREE.CircleGeometry(0.05, 28), glow(0xffffff, 0.6, 1.3, { map: tT }));
    tm.position.set(3.977, 1.35, -2.85);
    tm.rotation.y = -Math.PI / 2;
    room.add(tm);
  }
  bx(0.06, 0.08, 0.05, white, 3.88, 2.105, 2.0, room);
  bx(0.045, 0.04, 0.04, white, 3.88, 2.165, 2.0, room);
  [-0.038, 0.038].forEach(o => bx(0.016, 0.06, 0.016, white, 3.88, 2.1, 2.0 + o, room));
  bx(0.004, 0.01, 0.03, glow(0x3dd7ff, 0.7, 1.6), 3.856, 2.168, 2.0, room, false);
  cyl(0.003, 0.003, 0.04, 5, dark, 3.88, 2.205, 2.0, room);
  put(new THREE.SphereGeometry(0.008, 6, 5), glow(0xff3df2, 0.8, 1.6), 3.88, 2.228, 2.0, room, false);
  bx(0.1, 0.07, 0.12, pbrT(PBR.plastic, 0.2, 0xf3efe6), 3.88, 1.3, 3.3, room);
  cyl(0.03, 0.03, 0.04, 14, dark, 3.832, 1.31, 3.3, room).rotation.z = Math.PI / 2;
  bx(0.03, 0.02, 0.03, glow(0xfff2c0, 0.6, 1.2), 3.88, 1.345, 3.35, room, false);
  bx(0.102, 0.012, 0.122, pbrT(PBR.leather, 0.2, 0xe8553a), 3.88, 1.285, 3.3, room, false);
  cyl(0.04, 0.03, 0.06, 10, std(0xe8e4dc, 0.6), 3.88, 1.695, 3.2, room);
  rosette(3.88, 1.725, 3.2, 8, 0.14, lf2);
  const gpad = grp(-2.55, 0.402, 1.5, 0.4);
  bx(0.15, 0.03, 0.09, pbrT(PBR.plastic, 0.15, 0x2a2f36), 0, 0.015, 0, gpad);
  [-0.045, 0.045].forEach(o => cyl(0.014, 0.014, 0.014, 10, dark, o, 0.035, 0.012, gpad));
  [
    [0.05, -0.012],
    [0.062, 0.006],
    [0.038, 0.006],
    [0.05, 0.024],
  ].forEach(([a, b], i) =>
    cyl(
      0.006,
      0.006,
      0.006,
      8,
      std([0xe8553a, 0x7cc36a, 0x3d86d8, 0xffd23d][i], 0.5),
      a,
      0.032,
      b - 0.012,
      gpad
    )
  );
  put(
    new THREE.TorusGeometry(0.168, 0.012, 6, 28),
    pbr(PBR.plastic, 4, 1, 0x3a4048),
    0,
    0.045,
    0,
    vac,
    false
  ).rotation.x = Math.PI / 2;
  cyl(0.05, 0.055, 0.03, 16, dark, 0, 0.125, -0.02, vac);
  put(
    new THREE.TorusGeometry(0.095, 0.004, 6, 28),
    glow(0x58e6ff, 0.5, 1.6),
    0,
    0.083,
    0,
    vac,
    false
  ).rotation.x = Math.PI / 2;
  cyl(0.02, 0.02, 0.004, 8, std(0xd6342c, 0.6), 0.11, 0.012, 0.12, vac);
  cyl(0.02, 0.02, 0.004, 8, std(0xd6342c, 0.6), -0.11, 0.012, 0.12, vac);
  snake(-3.7, -2.35, 0.8);

  // Sun shafts through the window (daytime only); direction follows the sun
  const shaftTex = tx2(32, 128, (x, W, H) => {
    const g = x.createLinearGradient(0, 0, 0, H);
    g.addColorStop(0, 'rgba(255,244,214,.85)');
    g.addColorStop(1, 'rgba(255,244,214,0)');
    x.fillStyle = g;
    x.fillRect(0, 0, W, H);
    x.globalCompositeOperation = 'destination-in';
    const h = x.createLinearGradient(0, 0, W, 0);
    h.addColorStop(0, 'rgba(0,0,0,0)');
    h.addColorStop(0.5, 'rgba(0,0,0,1)');
    h.addColorStop(1, 'rgba(0,0,0,0)');
    x.fillStyle = h;
    x.fillRect(0, 0, W, H);
  });
  const shaftM = new THREE.MeshBasicMaterial({
    map: shaftTex,
    transparent: true,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
    side: THREE.DoubleSide,
    opacity: 0,
    toneMapped: false,
    fog: false,
  });
  const shaftG = new THREE.Group();
  scene.add(shaftG);
  const shafts = [],
    shGeo = new THREE.PlaneGeometry(0.42, 6.5);
  shGeo.translate(0, -3.25, 0);
  [
    [-1.9, 1.2],
    [-1.3, 2.0],
    [-0.7, 1.4],
    [-0.1, 2.2],
    [0.35, 1.1],
    [-1.0, 0.95],
  ].forEach(([z, y]) => {
    const p = new THREE.Group();
    p.position.set(4.0, y, z);
    [0, Math.PI / 2].forEach(r => {
      const m = new THREE.Mesh(shGeo, shaftM);
      m.rotation.y = r;
      p.add(m);
    });
    shaftG.add(p);
    shafts.push(p);
  });
  const shDown = new THREE.Vector3(0, -1, 0),
    shDir = new THREE.Vector3(),
    shQ = new THREE.Quaternion();
  const detailUpdate = (t, w) => {
    const sv =
        Math.max(0, Math.min(1, sunDir.y * 3)) *
        Math.max(0, Math.min(1, sunDir.x * 2)) *
        (1 - nightK) *
        (1 - wxs.cloud * 0.8) *
        (1 - wxs.fog * 0.3),
      on = sv > 0.01;
    shaftG.visible = on;
    if (on) {
      shaftM.opacity = 0.13 * sv * (0.85 + 0.15 * Math.sin(t * 0.5 * w));
      shQ.setFromUnitVectors(shDown, shDir.copy(sunDir).negate().normalize());
      shafts.forEach(p => p.quaternion.copy(shQ));
    }
    curtains.forEach((c, i) => {
      c.rotation.z = Math.sin(t * 0.7 + i * 2) * 0.012 * w;
    });
  };

  // ---- Outside: DAY (house, bench, trees) ----
  const day = new THREE.Group(),
    night = new THREE.Group();
  scene.add(day, night);
  const gcv = cvs(256, 256),
    gx = gcv.getContext('2d');
  gx.fillStyle = '#5b8a3f';
  gx.fillRect(0, 0, 256, 256);
  for (let k = 0; k < 3500; k++) {
    gx.fillStyle = `rgb(${(70 + rnd() * 40) | 0},${(120 + rnd() * 40) | 0},${(48 + rnd() * 24) | 0})`;
    gx.fillRect(rnd() * 256, rnd() * 256, 2, 3);
  }
  put(
    new THREE.PlaneGeometry(400, 400),
    pbr(PBR.grass, 80, 80, 0xffffff),
    60,
    -0.02,
    0,
    day,
    false
  ).rotation.x = -Math.PI / 2;
  const house = new THREE.Group();
  house.position.set(15, 0, -4);
  house.rotation.y = -Math.PI / 2;
  day.add(house);
  const brickM = pbrT(PBR.brick, 2.2, 0xe0b098),
    roofM = pbrT(PBR.roof, 1.5, 0xffffff),
    whiteT = std(0xf6f4ee, 0.5),
    glassD = std(0x9ebfd9, 0.08, 0.5);
  bx(6, 3.2, 5, brickM, 0, 1.6, 0, house);
  bx(6.1, 0.18, 5.1, std(0xe9e4da, 0.8), 0, 3.25, 0, house);
  const roofSlab = (z, rx) => {
    const r = bx(6.7, 0.14, 3.2, roofM, 0, 3.2 + 0.82, z, house);
    r.rotation.x = rx;
    return r;
  };
  roofSlab(1.38, 0.49);
  roofSlab(-1.38, -0.49);
  bx(6.75, 0.12, 0.3, roofM, 0, 3.2 + 1.5, 0, house);
  [-1, 1].forEach(sd => {
    const sh = new THREE.Shape();
    sh.moveTo(-2.5, 0);
    sh.lineTo(2.5, 0);
    sh.lineTo(0, 1.5);
    const g = new THREE.ExtrudeGeometry(sh, { depth: 0.12, bevelEnabled: false });
    g.rotateY(Math.PI / 2);
    put(g, brickM, sd * 3.0 - 0.06, 3.3, 0, house);
  });
  bx(0.6, 1.5, 0.6, brickM, 1.8, 4.5, -0.9, house);
  bx(0.72, 0.1, 0.72, std(0x7d7a74, 0.9), 1.8, 5.3, -0.9, house);
  bx(1.0, 2.1, 0.1, std(0x3f5f7a, 0.6), -1.3, 1.05, 2.53, house);
  bx(0.08, 0.5, 0.04, glassD, -1.3, 1.5, 2.6, house);
  put(new THREE.SphereGeometry(0.04, 8, 6), std(0xd6b45c, 0.3, 0.9), -1.0, 1.0, 2.6, house);
  bx(1.8, 0.14, 1.0, std(0xb0aca4, 0.9), -1.3, 0.07, 3.0, house);
  bx(1.9, 0.1, 1.1, whiteT, -1.3, 2.35, 3.0, house);
  [-2.15, -0.45].forEach(x => bx(0.08, 2.3, 0.08, whiteT, x, 1.15, 3.45, house));
  [0.9, 2.2].forEach(x => {
    bx(1.16, 1.36, 0.08, whiteT, x, 1.75, 2.5, house);
    bx(1.0, 1.2, 0.06, glassD, x, 1.75, 2.54, house);
    bx(0.04, 1.2, 0.04, whiteT, x, 1.75, 2.58, house);
    bx(1.0, 0.04, 0.04, whiteT, x, 1.75, 2.58, house);
    bx(1.3, 0.06, 0.2, std(0xb0aca4, 0.9), x, 1.04, 2.6, house);
  });
  [-2, 0, 2].forEach(x => bx(0.9, 1.0, 0.06, glassD, x, 1.8, -2.54, house));
  const bench = new THREE.Group();
  bench.position.set(8.6, 0, -1.2);
  bench.rotation.y = -Math.PI / 2;
  day.add(bench);
  const slat = pbrT(PBR.wood, 0.7, 0xd9a070);
  for (let k = 0; k < 4; k++) bx(1.5, 0.04, 0.08, slat, 0, 0.46, -0.15 + k * 0.1, bench);
  for (let k = 0; k < 3; k++) {
    const b = bx(1.5, 0.08, 0.03, slat, 0, 0.7 + k * 0.1, -0.28, bench);
    b.rotation.x = -0.15;
  }
  [-0.65, 0.65].forEach(x => {
    bx(0.05, 0.46, 0.5, metal, x, 0.23, 0, bench);
    bx(0.05, 0.4, 0.05, metal, x, 0.66, -0.27, bench);
  });
  const trees = [];
  [
    [11, 4.5],
    [18, 7],
    [17, -11],
    [10.5, -6.5],
    [24, -2],
  ].forEach(([x, z]) => {
    const t = new THREE.Group();
    t.position.set(x, 0, z);
    cyl(0.18, 0.28, 2.2, 8, std(0x5a4030, 1), 0, 1.1, 0, t);
    const lm = std(0x3f7a3c, 0.9);
    [
      [0, 3.2, 0, 1.5],
      [0.7, 2.7, 0.3, 1.1],
      [-0.6, 2.8, -0.3, 1.2],
    ].forEach(([a, b, c, r]) => put(new THREE.IcosahedronGeometry(r, 1), lm, a, b, c, t));
    day.add(t);
    trees.push(t);
  });
  const fence = new THREE.InstancedMesh(BOX, std(0xf1ede4, 0.8), 34);
  let fi = 0;
  for (let k = 0; k < 40 && fi < 34; k++) {
    const z = -9 + k * 0.3;
    if (z > -6.2 && z < -4.4) continue;
    D.position.set(11.2, 0.45, z);
    D.rotation.set(0, 0, 0);
    D.scale.set(0.03, 0.9, 0.06);
    D.updateMatrix();
    fence.setMatrixAt(fi++, D.matrix);
  }
  fence.count = fi;
  fence.castShadow = true;
  day.add(fence);
  bx(0.04, 0.05, 9, std(0xf1ede4, 0.8), 11.2, 0.7, -4.5, day);
  bx(0.04, 0.05, 9, std(0xf1ede4, 0.8), 11.2, 0.25, -4.5, day);
  for (let k = 0; k < 7; k++)
    bx(0.8, 0.04, 0.5, std(0xa9a49a, 1), 9.8 + k * 0.4, 0.02, -1.6 - k * 0.55, day, false);
  const clouds = [],
    cloudMats = [];
  for (let i = 0; i < 7; i++) {
    const g = new THREE.Group(),
      mt = new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.85, fog: false });
    for (let k = 0; k < 4; k++)
      put(
        new THREE.SphereGeometry(6 + rnd() * 5, 12, 8),
        mt,
        k * 8 - 12,
        rnd() * 3,
        rnd() * 6,
        g,
        false
      ).scale.y = 0.4;
    g.position.set(70 + rnd() * 90, 45 + rnd() * 25, -140 + rnd() * 280);
    day.add(g);
    clouds.push(g);
    cloudMats.push(mt);
  }
  [
    [170, -60, 40],
    [190, 10, 55],
    [180, 70, 35],
  ].forEach(([x, z, r]) => {
    const h = put(new THREE.SphereGeometry(r, 16, 10), std(0x6f9a68, 1), x, 0, z, day, false);
    h.scale.set(1.6, 0.45, 1.3);
  });
  // Garden, hedges, flower bed, pines, a street with moving cars, neighbours across the road, birds
  const hedge = new THREE.InstancedMesh(new THREE.SphereGeometry(0.42, 9, 7), std(0x2f6b3a, 0.9), 16),
    flw = new THREE.InstancedMesh(new THREE.SphereGeometry(0.07, 6, 5), std(0xffffff, 0.7), 46);
  let hi2 = 0;
  for (let k = 0; k < 16; k++) {
    const z = -9 + k * 0.62;
    if (z > -6.3 && z < -4.3) {
      D.scale.setScalar(0.0001);
    } else D.scale.set(0.9 + rnd() * 0.4, 0.8 + rnd() * 0.5, 0.9 + rnd() * 0.4);
    D.position.set(10.85 + rnd() * 0.1, 0.35, z);
    D.rotation.set(0, 0, 0);
    D.updateMatrix();
    hedge.setMatrixAt(hi2++, D.matrix);
  }
  hedge.castShadow = true;
  day.add(hedge);
  const FP = [0xff7a8a, 0xffd166, 0xfff1f1, 0xc58cff, 0xff9f68];
  for (let k = 0; k < 46; k++) {
    D.position.set(11.7 + rnd() * 0.5, 0.1 + rnd() * 0.06, -8.6 + k * 0.18);
    D.scale.setScalar(0.8 + rnd() * 0.6);
    D.rotation.set(0, 0, 0);
    D.updateMatrix();
    flw.setMatrixAt(k, D.matrix);
    flw.setColorAt(k, col.setHex(FP[k % 5]));
  }
  day.add(flw);
  const pineM = std(0x25563a, 0.9);
  [
    [20, -15],
    [27, 11],
    [31, -9],
    [23, 16],
  ].forEach(([x, z]) => {
    const t = new THREE.Group();
    t.position.set(x, 0, z);
    cyl(0.14, 0.2, 1.4, 8, std(0x5a4030, 1), 0, 0.7, 0, t);
    [
      [1.4, 1.6, 1.3],
      [1.1, 2.4, 1.2],
      [0.8, 3.1, 1.0],
      [0.5, 3.7, 0.8],
    ].forEach(([r, y, h]) => put(new THREE.ConeGeometry(r, h, 9), pineM, 0, y, 0, t));
    day.add(t);
    trees.push(t);
  });
  put(
    new THREE.PlaneGeometry(8, 400),
    pbr(PBR.asphalt, 2, 60, 0xffffff),
    36,
    -0.005,
    0,
    day,
    false
  ).rotation.x = -Math.PI / 2;
  [31.6, 40.4].forEach(
    x =>
      (put(
        new THREE.PlaneGeometry(1.6, 400),
        pbr(PBR.concrete, 1, 100, 0xcfd2d6),
        x + (x < 36 ? -0.8 : 0.8),
        0.0,
        0,
        day,
        false
      ).rotation.x = -Math.PI / 2)
  );
  const lanes = new THREE.InstancedMesh(BOX, std(0xf2efe4, 0.8), 60);
  for (let k = 0; k < 60; k++) {
    D.position.set(36, 0.004, -90 + k * 3);
    D.scale.set(0.12, 0.01, 1.4);
    D.rotation.set(0, 0, 0);
    D.updateMatrix();
    lanes.setMatrixAt(k, D.matrix);
  }
  day.add(lanes);
  const dcarBody = new THREE.InstancedMesh(BOX, std(0xffffff, 0.35, 0.4), 8),
    dcarCab = new THREE.InstancedMesh(BOX, std(0x20262e, 0.2, 0.6), 8),
    dcars = [],
    CC = [0xd94a3a, 0x2f6fd6, 0xf2f2f2, 0x2c2f36, 0xf2b632, 0x3aa86b, 0xa0a6ae, 0x8a4fd6];
  for (let k = 0; k < 8; k++) {
    dcars.push({ z: -80 + rnd() * 160, x: k % 2 ? 34.2 : 37.8, v: (k % 2 ? 1 : -1) * (5 + rnd() * 4) });
    dcarBody.setColorAt(k, col.setHex(CC[k]));
  }
  dcarBody.frustumCulled = dcarCab.frustumCulled = false;
  day.add(dcarBody, dcarCab);
  const nbrM = [0xe9d8b8, 0xd6e0e8, 0xe8c9c0, 0xdce8d4, 0xf0e4c4];
  [-30, -14, 2, 18, 34].forEach((z, i) => {
    const g = new THREE.Group();
    g.position.set(50, 0, z);
    g.rotation.y = -Math.PI / 2;
    day.add(g);
    bx(7, 3.4, 6, pbrT(PBR.plaster, 2, nbrM[i]), 0, 1.7, 0, g);
    [1, -1].forEach(sd => {
      const r = bx(7.6, 0.14, 3.6, roofM, 0, 4.2, sd * 1.45, g);
      r.rotation.x = sd * 0.5;
    });
    bx(1, 2, 0.1, std(0x5a3a26, 0.7), -1.5, 1, 3.03, g);
    [1, 2.4].forEach(x => bx(1.1, 1.1, 0.08, glassD, x, 1.9, 3.03, g));
  });
  const sTrees = new THREE.InstancedMesh(new THREE.IcosahedronGeometry(1.4, 1), std(0x3f7a3c, 0.9), 12),
    sTrunk = new THREE.InstancedMesh(new THREE.CylinderGeometry(0.12, 0.18, 1, 6), std(0x5a4030, 1), 12);
  for (let k = 0; k < 12; k++) {
    const z = -60 + k * 11 + rnd() * 3;
    D.position.set(43.5, 2.8, z);
    D.scale.setScalar(0.8 + rnd() * 0.4);
    D.rotation.set(0, 0, 0);
    D.updateMatrix();
    sTrees.setMatrixAt(k, D.matrix);
    D.position.set(43.5, 1, z);
    D.scale.set(1, 2, 1);
    D.updateMatrix();
    sTrunk.setMatrixAt(k, D.matrix);
  }
  day.add(sTrees, sTrunk);
  const birds = [];
  for (let k = 0; k < 6; k++) {
    const b = new THREE.Group(),
      bm = std(0x2a2d33, 0.8),
      wl = bx(0.5, 0.012, 0.16, bm, -0.25, 0, 0, b, false),
      wr = bx(0.5, 0.012, 0.16, bm, 0.25, 0, 0, b, false);
    b.userData = { wl, wr, r: 14 + k * 3, a: k * 1.1, y: 14 + (k % 3) * 4 };
    day.add(b);
    birds.push(b);
  }

  // ---- Outside: NIGHT (sci-fi city) ----
  put(new THREE.PlaneGeometry(400, 400), std(0x07090f, 0.35, 0.6), 60, -0.03, 0, night, false).rotation.x =
    -Math.PI / 2;
  const wc = cvs(128, 128),
    wx = wc.getContext('2d');
  wx.fillStyle = '#000';
  wx.fillRect(0, 0, 128, 128);
  const wpal = ['#ffd696', '#9ad2ff', `rgb(${A})`, '#ffe9b8'];
  for (let i = 0; i < 4; i++)
    for (let j = 0; j < 4; j++)
      if (rnd() < 0.5) {
        wx.fillStyle = wpal[Math.floor(rnd() * 4)];
        wx.fillRect(i * 32 + 5, j * 32 + 6, 22, 18);
      }
  const towerMat = std(0x0b0f18, 0.5, 0.5, {
    emissive: 0xffffff,
    emissiveMap: mkTex(wc, [1, 1]),
    emissiveIntensity: 1,
  });
  const towerG = (w, h, d) => {
    const g = new THREE.BoxGeometry(w, h, d),
      uv = g.attributes.uv;
    for (let i = 0; i < uv.count; i++) {
      const f = Math.floor(i / 4);
      if (f < 2) uv.setXY(i, (uv.getX(i) * d) / 3, (uv.getY(i) * h) / 3);
      else if (f > 3) uv.setXY(i, (uv.getX(i) * w) / 3, (uv.getY(i) * h) / 3);
    }
    return g;
  };
  for (let gx2 = 0; gx2 < 7; gx2++)
    for (let gz = -6; gz <= 6; gz++) {
      const x = 18 + gx2 * 11 + (rnd() - 0.5) * 4,
        z = gz * 11 + (rnd() - 0.5) * 4;
      if (
        (x < 30 && Math.abs(z) < 16) ||
        Math.abs(z) < 4 ||
        [24, 48, 72].some(r => Math.abs(x - r) < 4) ||
        rnd() < 0.2
      )
        continue;
      const w = 5 + rnd() * 3,
        d = 5 + rnd() * 3,
        h = 10 + rnd() * 30 + gx2 * 6;
      put(towerG(w, h, d), towerMat, x, h / 2, z, night, false);
      if (rnd() < 0.45) bx(w + 0.3, 0.3, d + 0.3, neon, x, h + 0.15, z, night, false);
      if (rnd() < 0.25) cyl(0.12, 0.2, 8, 6, neon, x, h + 4, z, night).castShadow = false;
    }
  const dash = new THREE.InstancedMesh(BOX, neon, 160);
  let di = 0;
  const dashAt = (x, z, sx, sz) => {
    D.position.set(x, 0.02, z);
    D.rotation.set(0, 0, 0);
    D.scale.set(sx, 0.02, sz);
    D.updateMatrix();
    dash.setMatrixAt(di++, D.matrix);
  };
  for (let k = 0; k < 28; k++) dashAt(8 + k * 3.5, 0, 1.6, 0.18);
  [24, 48, 72].forEach(x => {
    for (let k = 0; k < 40; k++) dashAt(x, -68 + k * 3.5, 0.18, 1.6);
  });
  dash.count = di;
  night.add(dash);
  const veh = new THREE.InstancedMesh(BOX, new THREE.MeshBasicMaterial({ color: 0xffffff }), 40),
    vpal = [accent.getHex(), 0xff4fd8, 0xfff2b0],
    cars = [];
  veh.frustumCulled = false;
  for (let k = 0; k < 40; k++) {
    const ax = rnd() < 0.5;
    cars.push({
      ax,
      p: ax ? 8 + rnd() * 92 : -70 + rnd() * 140,
      lane: ax ? (Math.floor(rnd() * 7) - 3) * 9 + 4.5 : 24 + Math.floor(rnd() * 3) * 24 + 3,
      y: 5 + rnd() * 25,
      v: 6 + rnd() * 8,
    });
    veh.setColorAt(k, col.setHex(vpal[k % 3]));
  }
  night.add(veh);
  const boards = [],
    board = (txt, x, y, z) => {
      const c = cvs(512, 200),
        q = c.getContext('2d'),
        t = mkTex(c),
        draw = () => {
          q.clearRect(0, 0, 512, 200);
          q.font = '800 84px "Exo 2",sans-serif';
          q.textAlign = 'center';
          q.shadowColor = `rgb(${A})`;
          q.shadowBlur = 24;
          q.fillStyle = '#fff';
          q.fillText(txt, 256, 120, 480);
          q.strokeStyle = `rgb(${A})`;
          q.lineWidth = 6;
          q.strokeRect(6, 40, 500, 130);
          t.needsUpdate = true;
        };
      draw();
      redo.push(draw);
      const p = new THREE.Mesh(
        new THREE.PlaneGeometry(9, 3.5),
        new THREE.MeshBasicMaterial({
          map: t,
          transparent: true,
          toneMapped: false,
          side: THREE.DoubleSide,
          depthWrite: false,
        })
      );
      p.position.set(x, y, z);
      p.rotation.y = -Math.PI / 2;
      night.add(p);
      boards.push(p);
    };
  board(site.name, 20, 14, -9);
  board(site.world.name, 27, 24, 8);
  board((projects[0] || { title: 'Hello' }).title, 19, 9, -22);
  const beams = [];
  [
    [40, -30],
    [58, 24],
  ].forEach(([x, z]) => {
    const g = new THREE.Group();
    g.position.set(x, 0, z);
    const geo = new THREE.ConeGeometry(3, 70, 16, 1, true);
    geo.rotateX(Math.PI);
    geo.translate(0, 35, 0);
    const bm = new THREE.Mesh(
      geo,
      new THREE.MeshBasicMaterial({
        color: accent,
        transparent: true,
        opacity: 0.12,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
        side: THREE.DoubleSide,
      })
    );
    bm.rotation.x = 0.5;
    g.add(bm);
    night.add(g);
    beams.push(g);
  });
  // Night street life: wet asphalt roads, street lamps, neon light spill on the ground, a monorail, more holo ads
  const roadAt = (x, z, w, d) => {
    const r = put(
      new THREE.PlaneGeometry(w, d),
      pbr(PBR.asphalt, w / 4, d / 4, 0x7b8190, { roughness: 1, metalness: 0.15 }),
      x,
      0.004,
      z,
      night,
      false
    );
    r.rotation.x = -Math.PI / 2;
  };
  roadAt(58, 0, 100, 6);
  [24, 48, 72].forEach(x => roadAt(x, 0, 6, 140, 0));
  const lampH = new THREE.InstancedMesh(
      BOX,
      new THREE.MeshBasicMaterial({ color: 0xffffff, toneMapped: false }),
      40
    ),
    lampP = new THREE.InstancedMesh(BOX, std(0x1a1e26, 0.5, 0.7), 40);
  let li = 0;
  for (let k = 0; k < 20; k++)
    [-4.2, 4.2].forEach(sz => {
      const x = 10 + k * 5;
      D.position.set(x, 2.4, sz);
      D.scale.set(0.14, 4.8, 0.14);
      D.rotation.set(0, 0, 0);
      D.updateMatrix();
      lampP.setMatrixAt(li, D.matrix);
      D.position.set(x, 4.85, sz * 0.88);
      D.scale.set(0.5, 0.1, 0.3);
      D.updateMatrix();
      lampH.setMatrixAt(li, D.matrix);
      lampH.setColorAt(li, col.setHex(k % 3 === 0 ? 0xff9ad8 : 0xbfe9ff));
      li++;
    });
  night.add(lampP, lampH);
  const poolM = new THREE.MeshBasicMaterial({
      map: haloTex,
      transparent: true,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
      toneMapped: false,
      opacity: 0.55,
    }),
    pools = new THREE.InstancedMesh(new THREE.PlaneGeometry(1, 1), poolM, 34),
    PC2 = [0x33e6ff, 0xff3df2, 0xffb347];
  for (let k = 0; k < 34; k++) {
    D.position.set(10 + k * 3.4 + rnd() * 2, 0.03, (k % 2 ? -1 : 1) * (3 + rnd() * 3));
    D.scale.set(8 + rnd() * 6, 8 + rnd() * 6, 1);
    D.rotation.set(-Math.PI / 2, 0, 0);
    D.updateMatrix();
    pools.setMatrixAt(k, D.matrix);
    pools.setColorAt(k, col.setHex(PC2[k % 3]));
  }
  night.add(pools);
  const rail = new THREE.Group();
  night.add(rail);
  bx(130, 0.5, 2.4, std(0x1a1e26, 0.5, 0.6), 70, 17.6, -26, rail, false);
  bx(130, 0.08, 0.1, neon, 70, 17.95, -24.9, rail, false);
  for (let k = 0; k < 26; k++) bx(0.8, 17.6, 0.8, std(0x1a1e26, 0.6, 0.5), 8 + k * 5, 8.8, -26, rail, false);
  const trainM = std(0x0d1118, 0.3, 0.8),
    winM = new THREE.MeshBasicMaterial({ color: 0xbfe9ff, toneMapped: false }),
    train = new THREE.Group();
  night.add(train);
  [0, 1, 2].forEach(i => {
    bx(9, 2.2, 2.2, trainM, i * 9.4, 0, 0, train, false);
    bx(8.6, 0.55, 0.05, winM, i * 9.4, 0.3, 1.13, train, false);
    bx(8.6, 0.55, 0.05, winM, i * 9.4, 0.3, -1.13, train, false);
  });
  bx(0.2, 0.1, 2.0, neon, -4.6, -0.5, 0, train, false);
  train.position.set(40, 19, -26);
  board(
    String(site.role)
      .split(/[,/·|]/)[0]
      .trim(),
    32,
    18,
    14
  );
  board(String(site.skills[0] || 'Code').toUpperCase(), 46, 30, -16);

  // ---- Time of day ----
  const matsOf = g => {
    const s = new Set();
    g.traverse(o => {
      if (o.material) [].concat(o.material).forEach(mm => s.add(mm));
    });
    return [...s];
  };
  const dayM = matsOf(day),
    nightM = matsOf(night);
  const fade = (list, grp, f) => {
    grp.visible = f > 0.01;
    list.forEach(mm => {
      if (mm.userData.o === undefined) mm.userData.o = mm.opacity;
      mm.opacity = mm.userData.o * f;
      mm.transparent = f < 0.999 || mm.userData.o < 1;
    });
  };
  const sunDir = new THREE.Vector3(),
    moonDir = new THREE.Vector3(),
    tmp = new THREE.Color();
  function setTime(h) {
    curH = h;
    const a = ((h - 6) / 12) * Math.PI,
      el = Math.sin(a),
      hh = h < 6 ? h + 24 : h,
      nb2 = ((hh - 18) / 12) * Math.PI,
      mel = Math.sin(nb2);
    sunDir.set(0.55 + 0.45 * Math.cos(a), el * 0.85, -0.25).normalize();
    moonDir.set(0.55 + 0.45 * Math.cos(nb2), mel * 0.85, -0.25).normalize();
    const dayF = ss(-0.12, 0.28, el),
      nightF = 1 - dayF,
      dusk = Math.exp(-Math.pow(el / 0.22, 2)),
      useSun = el >= 0,
      dir = useSun ? sunDir : moonDir;
    nightK = nightF;
    sun.position
      .set(dir.x, Math.max(dir.y, 0.03), dir.z)
      .normalize()
      .multiplyScalar(70)
      .add(sun.target.position);
    sun.intensity =
      (useSun ? TUNE.sun * ss(0, 0.22, el) : TUNE.moon * ss(0, 0.22, mel)) * (1 - 0.65 * wxs.cloud);
    sun.color.set(useSun ? 0xfff3e0 : 0x9bb8ff);
    if (useSun) sun.color.lerp(tmp.set(0xff9a55), 1 - ss(0, 0.5, el));
    skyU.top.value
      .copy(NIGHT_TOP)
      .lerp(DAY_TOP, dayF)
      .lerp(DUSK_TOP, dusk * 0.6);
    skyU.hor.value
      .copy(NIGHT_HOR)
      .lerp(DAY_HOR, dayF)
      .lerp(DUSK_HOR, dusk * 0.85);
    skyU.top.value.lerp(GRAY_TOP, wxs.cloud * 0.55 * dayF);
    skyU.hor.value.lerp(GRAY_HOR, wxs.cloud * 0.55 * dayF);
    skyU.sunDir.value.copy(sunDir);
    skyU.moonDir.value.copy(moonDir);
    skyU.night.value = nightF;
    skyU.sunVis.value = ss(-0.05, 0.1, el);
    scene.fog.color.copy(skyU.hor.value);
    hemi.color.copy(skyU.top.value).lerp(WHITE, 0.5);
    hemi.intensity = mix(TUNE.hemiNight, TUNE.hemiDay, dayF);
    if ('environmentIntensity' in scene) scene.environmentIntensity = mix(TUNE.envNight, TUNE.envDay, dayF);
    ceil.intensity = TUNE.ceiling * (dayF * 0.9 + 0.12);
    ceilMat.emissiveIntensity = 0.3 * dayF + 0.04;
    fill.intensity = TUNE.fill * (dayF * 0.9 + nightF * 0.35);
    fill.color.set(0xcfe3ff).lerp(tmp.set(0x9a6bff), nightF);
    R.toneMappingExposure = mix(0.85, 1.05, dayF);
    towerMat.emissiveIntensity = 0.15 + 0.85 * nightF;
    const vis = ss(-0.12, 0.2, el);
    fade(dayM, day, vis);
    fade(nightM, night, 1 - vis);
    const hk = Math.floor(h * 6);
    if (hk !== hubK) {
      hubK = hk;
      hubPaint();
    }
    hourH.rotation.z = -((h % 12) / 12) * 6.2832;
    minH.rotation.z = -(((h * 60) % 60) / 60) * 6.2832;
  }
  // ---- Weather: overcast sky, rain outside, droplets on the glass ----
  const RN = 450,
    rpos = new Float32Array(RN * 6),
    rb = [];
  for (let i = 0; i < RN; i++) rb.push([4.5 + rnd() * 22, rnd() * 16, -15 + rnd() * 30]);
  const rg = new THREE.BufferGeometry();
  rg.setAttribute('position', new THREE.BufferAttribute(rpos, 3));
  const rain = new THREE.LineSegments(
    rg,
    new THREE.LineBasicMaterial({ color: 0xaec8ff, transparent: true, opacity: 0.45 })
  );
  rain.visible = false;
  rain.frustumCulled = false;
  scene.add(rain);
  const dc = cvs(256, 256),
    dx = dc.getContext('2d');
  for (let i = 0; i < 70; i++) {
    const dxp = rnd() * 256,
      dyp = rnd() * 256,
      r = 2 + rnd() * 5,
      g = dx.createRadialGradient(dxp - r * 0.3, dyp - r * 0.3, 0, dxp, dyp, r);
    g.addColorStop(0, 'rgba(255,255,255,.9)');
    g.addColorStop(1, 'rgba(180,210,255,.15)');
    dx.fillStyle = g;
    dx.beginPath();
    dx.arc(dxp, dyp, r, 0, 6.283);
    dx.fill();
    if (rnd() < 0.25) {
      dx.strokeStyle = 'rgba(200,225,255,.25)';
      dx.lineWidth = 1.5;
      dx.beginPath();
      dx.moveTo(dxp, dyp);
      dx.lineTo(dxp + rnd() * 2 - 1, dyp - r * 6);
      dx.stroke();
    }
  }
  const dropT = mkTex(dc, [2, 1]),
    dropM = new THREE.MeshBasicMaterial({ map: dropT, transparent: true, opacity: 0, depthWrite: false }),
    dropP = new THREE.Mesh(new THREE.PlaneGeometry(3.2, 1.6), dropM);
  dropP.position.set(4.03, 1.7, -1);
  dropP.rotation.y = Math.PI / 2;
  dropP.visible = false;
  room.add(dropP);
  function setWeather(w) {
    wxs = { cloud: w.cloud, rain: w.rain, fog: w.fog };
    wxText = w.text || '';
    cloudMats.forEach(m => {
      m.userData.o = 0.3 + 0.65 * wxs.cloud;
    });
    clouds.forEach(c => c.scale.setScalar(0.8 + 0.7 * wxs.cloud));
    scene.fog.density = 0.007 + wxs.fog * 0.02;
    rain.visible = dropP.visible = wxs.rain > 0;
    dropM.opacity = 0.75 * Math.min(1, wxs.rain);
    hubPaint();
    setTime(curH);
    if (tvMode === 'home') tvTex.userData.go();
  }
  if (document.fonts) document.fonts.ready.then(() => redo.forEach(f => f()));

  let rainT = 0,
    scrT = 0,
    scrF = 0,
    ledT = 0;
  const TW_N = C(0x0d0f13);
  // Outside extras: distant wind turbines (day) and a landmark tower with aircraft blinkers (night)
  const turbines = [],
    twM = std(0xf1f3f5, 0.5),
    blinkers = [];
  [
    [78, -34, 1],
    [92, -12, 0.85],
    [84, 16, 1.1],
    [104, 36, 0.8],
    [98, -52, 0.9],
  ].forEach(([x, z, sc], i) => {
    const g = new THREE.Group();
    g.position.set(x, 0, z);
    g.scale.setScalar(sc);
    day.add(g);
    cyl(0.5, 0.9, 30, 10, twM, 0, 15, 0, g);
    bx(1.6, 1.4, 3, twM, 0, 30.4, 0.3, g);
    const rot = new THREE.Group();
    rot.position.set(-1.4, 30.4, 0.3);
    g.add(rot);
    cyl(0.6, 0.6, 1, 10, twM, 0, 0, 0, rot).rotation.z = Math.PI / 2;
    for (let b = 0; b < 3; b++) {
      const bl = new THREE.Group();
      bl.rotation.x = b * 2.094;
      rot.add(bl);
      bx(0.25, 13, 0.7, twM, 0, 6.8, 0, bl, false);
    }
    rot.userData.v = 0.7 + i * 0.12;
    turbines.push(rot);
  });
  {
    const T = new THREE.Group();
    T.position.set(74, 0, -18);
    night.add(T);
    const tm = std(0x10151d, 0.4, 0.8);
    cyl(3.2, 5.4, 18, 12, tm, 0, 9, 0, T);
    cyl(1.6, 3.2, 30, 12, tm, 0, 33, 0, T);
    cyl(0.5, 1.6, 24, 8, tm, 0, 60, 0, T);
    cyl(0.12, 0.3, 14, 6, tm, 0, 79, 0, T);
    [10, 26, 42, 54].forEach((y, i) => {
      const r = 4.8 - i * 0.95;
      cyl(r, r, 0.8, 24, i % 2 ? rbMat() : neon, 0, y, 0, T);
    });
    for (let k = 0; k < 24; k++)
      bx(
        0.35,
        14 + hr(k, 3) * 10,
        0.35,
        neon,
        Math.cos(k * 0.26) * 3.9,
        14,
        Math.sin(k * 0.26) * 3.9,
        T,
        false
      );
    [
      [0, 86],
      [0, 52],
    ].forEach(([_, y]) => {
      const sp = new THREE.Sprite(
        new THREE.SpriteMaterial({
          map: haloTex,
          color: 0xff2a2a,
          transparent: true,
          blending: THREE.AdditiveBlending,
          depthWrite: false,
          fog: false,
        })
      );
      sp.position.set(0, y, 0);
      sp.scale.set(14, 14, 1);
      T.add(sp);
      blinkers.push(sp);
      const m = new THREE.Mesh(
        new THREE.SphereGeometry(0.5, 8, 6),
        new THREE.MeshBasicMaterial({ color: 0xff4040, toneMapped: false })
      );
      m.position.set(0, y, 0);
      T.add(m);
    });
    [
      [-2.6, 0],
      [2.6, 0],
      [0, 2.6],
      [0, -2.6],
    ].forEach(([a, b]) => {
      const sp = new THREE.Sprite(
        new THREE.SpriteMaterial({
          map: haloTex,
          color: 0xff2a2a,
          transparent: true,
          blending: THREE.AdditiveBlending,
          depthWrite: false,
          fog: false,
        })
      );
      sp.position.set(a, 40, b);
      sp.scale.set(5, 5, 1);
      T.add(sp);
      blinkers.push(sp);
    });
  }

  function update(t, dt, RM, cam, beat = 0) {
    partyT = Math.max(0, partyT - dt);
    const w = RM ? 0 : 1,
      bt = beat + (partyT > 0 ? 0.6 * (0.5 + 0.5 * Math.sin(t * 14)) : 0),
      k = (0.12 + 0.88 * nightK) * (1 + bt * 0.7),
      h0 = RM ? 0.55 : (t * 0.07) % 1;
    sky.position.copy(cam.position);
    rgb.forEach(({ m, off }) => m.color.setHSL(hueOf(h0, off), 1, 0.5).multiplyScalar(k * 1.2));
    rbMats.forEach(m => m.color.setScalar(k));
    rainbow.offset.x = (t * 0.15 * w) % 1;
    rgbA.color.setHSL(hueOf(h0, 0), 1, 0.5);
    rgbB.color.setHSL(hueOf(h0, 0.5), 1, 0.5);
    rgbC.color.setHSL(hueOf(h0, 0.25), 1, 0.5);
    rgbA.intensity = rgbB.intensity = rgbC.intensity = TUNE.rgb * (0.04 + 0.96 * nightK) * (1 + bt * 0.6);
    glareM.color.setHSL(h0, 1, 0.6).lerp(WHITE, 1 - nightK);
    glareM.opacity = 0.12 + 0.3 * (1 - nightK);
    fans.forEach(f => {
      f.rotation.z += dt * 5 * w;
    });

    const dn = ss(0.3, 0.7, nightK);
    deploy.forEach(d => {
      const f = d.n ? dn : 1 - dn;
      d.g.visible = f > 0.01;
      d.g.scale.setScalar(Math.max(f, 0.001));
    });
    glowL.forEach(({ m, c, lo, hi }) => {
      m.color.copy(c).multiplyScalar(lo + (hi - lo) * nightK);
    });
    halos.forEach(hh => {
      hh.sp.visible = nightK > 0.03;
      if (hh.sp.visible) {
        hh.m.color.setHSL(hueOf(h0, hh.off), 1, 0.6);
        hh.m.opacity = hh.max * nightK * (1 + bt * 0.3);
      }
    });
    ledRug.visible = nightK > 0.03;
    ledRugM.opacity = 0.95 * nightK;
    dust.visible = nightK > 0.05;
    if (dust.visible) {
      dustM.opacity = 0.5 * nightK;
      for (let i = 0; i < DN; i++) {
        const p = i * 3,
          ph = i * 1.7;
        dustA[p] = dustB[p] + Math.sin(t * 0.15 * w + ph) * 0.25;
        dustA[p + 1] = dustB[p + 1] + Math.sin(t * 0.2 * w + ph * 1.3) * 0.18;
        dustA[p + 2] = dustB[p + 2] + Math.cos(t * 0.12 * w + ph) * 0.25;
      }
      dustG.attributes.position.needsUpdate = true;
    }
    towerBody.color.setHex(0xd7dce2).lerp(TW_N, nightK);
    ceilPl.color.setHex(0xf0ece4).lerp(CEIL_N, nightK * 0.92);
    ledM.color.setScalar(0.5 + 0.9 * nightK);
    if (dn > 0.02) {
      holoD.rotation.y = t * 0.8 * w;
      holoD.rotation.x = Math.sin(t * 0.5) * 0.2 * w;
      cityG.rotation.y = t * 0.3 * w;
      scan.position.y = -0.18 + ((t * 0.25) % 1) * 0.4;
      beam.position.y = 0.05;
      drone.position.set(
        1.2 + 2.4 * Math.cos(t * 0.25),
        2.45 + Math.sin(t * 1.3) * 0.05,
        -0.8 + 2.2 * Math.sin(t * 0.5)
      );
      drone.rotation.y = t * 0.25;
      rotors.forEach(r => {
        r.rotation.y += dt * 40 * w;
      });
      scrT += dt;
      if (
        scrT > (opts.lowRes ? 0.14 : 0.07) &&
        dn > 0.5 &&
        Math.hypot(cam.position.x + 2.2, cam.position.z + 4.5) < 10.5
      ) {
        scrT = 0;
        scrF ^= 1;
        scr.forEach((sc, i) => {
          if ((i & 1) === scrF) sc.paint(t);
        });
      }
    }
    ledT += dt;
    if (ledT > 0.25 && nightK > 0.2) {
      ledT = 0;
      for (let i = 0; i < 32; i++)
        if (rnd() < 0.3) leds.setColorAt(i, col.setHex(LEDC[Math.floor(rnd() * 4)]));
      leds.instanceColor.needsUpdate = true;
    }
    vac.position.set(0.9 + 1.0 * Math.sin(0.13 * t), 0, -2 + 1.3 * Math.sin(0.21 * t + 0.5));
    vac.rotation.y = Math.atan2(1.0 * 0.13 * Math.cos(0.13 * t), 1.3 * 0.21 * Math.cos(0.21 * t + 0.5)) * w;
    {
      const hgt = 0.02 + 0.1 * ((t * 0.04) % 1);
      pobj.scale.y = hgt;
      pobj.position.y = 0.827 + hgt / 2;
      hot.position.set(
        1.65 + Math.sin(t * 3) * 0.08 * w,
        0.827 + hgt + 0.03,
        -4.58 + Math.cos(t * 2.3) * 0.06 * w
      );
      gantry.position.set(1.65, 0.827 + hgt + 0.07, hot.position.z);
    }
    if (rain.visible) {
      for (let i = 0; i < RN; i++) {
        const d = rb[i];
        if (!RMq) d[1] -= dt * 16;
        if (d[1] < 0) d[1] += 16;
        const o = i * 6;
        rpos[o] = d[0];
        rpos[o + 1] = d[1];
        rpos[o + 2] = d[2];
        rpos[o + 3] = d[0] - 0.04;
        rpos[o + 4] = d[1] + 0.55;
        rpos[o + 5] = d[2];
      }
      rg.attributes.position.needsUpdate = true;
      dropT.offset.y = (dropT.offset.y - dt * 0.01 * w) % 1;
    }
    if (tvMode === 'reel') {
      tvAcc += dt;
      if (tvAcc > 0.1 && Math.hypot(cam.position.x + 3.9, cam.position.z - 1.2) < 9) {
        tvAcc = 0;
        paintReel(t);
      }
    }
    if (writeT >= 0) {
      writeT += dt / 2.6;
      const pr = Math.min(1, writeT),
        tip = paintRight(cvR, page, pr);
      tR.needsUpdate = true;
      if (tip) {
        penTarget.x = 0.005 + (tip.x / PW) * 0.29;
        penTarget.z = -0.2 + (tip.y / PH) * 0.4;
      }
      if (pr >= 1) writeT = -1;
    }
    penK += ((writeT >= 0 ? 1 : 0) - penK) * (1 - Math.exp(-dt * 6));
    penG.position.set(
      mix(penRest.x, penTarget.x + Math.sin(t * 25) * 0.002, penK),
      mix(penRest.y, 0.0335, penK),
      mix(penRest.z, penTarget.z, penK)
    );
    penG.rotation.set(mix(1.55, 0.45, penK), mix(0.2, 0, penK), mix(0, -0.85, penK));
    if (day.visible) {
      birds.forEach((b, i) => {
        const u = b.userData;
        u.a += dt * 0.25 * w;
        b.position.set(28 + Math.cos(u.a) * u.r, u.y + Math.sin(u.a * 3 + i) * 0.6, -4 + Math.sin(u.a) * u.r);
        b.rotation.y = -u.a;
        const fl = Math.sin(t * 9 + i * 2) * 0.6 * w;
        u.wl.rotation.z = fl;
        u.wr.rotation.z = -fl;
        u.wl.position.y = Math.sin(fl) * 0.2;
        u.wr.position.y = Math.sin(fl) * 0.2;
      });
      dcars.forEach((c, i) => {
        c.z += c.v * dt * w;
        if (c.z > 90) c.z = -90;
        if (c.z < -90) c.z = 90;
        D.position.set(c.x, 0.4, c.z);
        D.scale.set(1.8, 0.6, 4.2);
        D.rotation.set(0, 0, 0);
        D.updateMatrix();
        dcarBody.setMatrixAt(i, D.matrix);
        D.position.set(c.x, 0.95, c.z - 0.2 * Math.sign(c.v));
        D.scale.set(1.6, 0.5, 2.2);
        D.updateMatrix();
        dcarCab.setMatrixAt(i, D.matrix);
      });
      dcarBody.instanceMatrix.needsUpdate = dcarCab.instanceMatrix.needsUpdate = true;
      turbines.forEach(r => {
        r.rotation.x += dt * r.userData.v * w;
      });
    }
    detailUpdate(t, w);
    trees.forEach((tr, i) => {
      tr.rotation.z = Math.sin(t * 0.8 + i) * 0.015 * w;
    });
    clouds.forEach(c => {
      c.position.z += dt * 0.8 * w;
      if (c.position.z > 150) c.position.z = -150;
    });
    rainT += dt;
    if (rainT > 0.1 && Math.hypot(cam.position.x + 2.2, cam.position.z + 4) < 9) {
      rainT = 0;
      const co = Math.floor(t * 2) % 2 === 0;
      if (co !== cursorOn) {
        cursorOn = co;
        drawTerm();
      }
      stepRain();
    }
    if (flipT >= 0) {
      flipT += dt / 0.6;
      const p = Math.min(1, flipT),
        e = p * p * (3 - 2 * p);
      leafG.rotation.z = flipDir > 0 ? e * Math.PI : (1 - e) * Math.PI;
      leafG.position.y = 0.0305 + Math.sin(p * Math.PI) * 0.03;
      if (p >= 1) {
        leafG.position.y = 0.0305;
        endFlip();
      }
    }
    if (night.visible) {
      cars.forEach((c, i) => {
        c.p += c.v * dt * w;
        if (c.ax) {
          if (c.p > 100) c.p = 8;
          D.position.set(c.p, c.y, c.lane);
          D.scale.set(1.2, 0.2, 0.45);
        } else {
          if (c.p > 70) c.p = -70;
          D.position.set(c.lane, c.y, c.p);
          D.scale.set(0.45, 0.2, 1.2);
        }
        D.rotation.set(0, 0, 0);
        D.updateMatrix();
        veh.setMatrixAt(i, D.matrix);
      });
      blinkers.forEach((sp, i) => {
        sp.material.opacity =
          i < 2 ? (Math.sin(t * 2.4) > 0.55 ? 1 : 0.05) : Math.sin(t * 2.4 + 1.6) > 0.7 ? 0.8 : 0.05;
      });
      train.position.x += dt * 14 * w;
      if (train.position.x > 140) train.position.x = -30;
      veh.instanceMatrix.needsUpdate = true;
      boards.forEach((b, i) => {
        b.position.y += Math.sin(t * 1.2 + i) * 0.004 * w;
      });
      beams.forEach((b, i) => {
        b.rotation.y = t * 0.4 * (i ? -1 : 1) * w;
      });
    }
  }
  const OB = [
    [-3.5, -0.5, -5, -3.95],
    [-4, -3.4, 0.2, 2.2],
    [-1.75, -0.65, 0.15, 2.25],
    [-2.75, -2.05, 0.8, 1.6],
    [2.05, 3.05, -1.9, -0.1],
    [1.4, 2.0, -1.0, -0.5],
    [2.3, 2.8, 0, 0.55],
    [-4, -3.35, 2.5, 4.3],
    [3.2, 4, 3.9, 4.7],
    [0.7, 3.2, 4.0, 5],
    [-0.15, 0.7, 4.2, 5],
    [-0.15, 0.65, -5, -4.3],
    [0.95, 2.3, -5, -4.2],
    [3.1, 4, -4.7, -3.9],
    [0.45, 1.35, 1.55, 2.45],
    [2.7, 3.8, 1.3, 3.1],
    [-2.62, -1.78, -4.08, -3.22],
    [1.1, 2.8, 3.77, 4.13],
    [3.35, 3.75, 0.75, 1.15],
    [-3.95, -3.45, -2.6, -2.1],
  ];
  const unstick = (x, z) => {
    for (let it = 0; it < 6 && blocked(x, z); it++) {
      let best = null;
      for (const [a, b, c, d] of OB)
        if (x > a && x < b && z > c && z < d) {
          const o = [
            [x - a, -1, 0],
            [b - x, 1, 0],
            [z - c, 0, -1],
            [d - z, 0, 1],
          ].sort((p, q) => p[0] - q[0])[0];
          if (!best || o[0] < best[0]) best = o;
        }
      if (best) {
        x += best[1] * (best[0] + 0.06);
        z += best[2] * (best[0] + 0.06);
      }
      x = Math.min(3.6, Math.max(-3.7, x));
      z = Math.min(4.6, Math.max(-4.7, z));
    }
    return { x, z };
  };
  const blocked = (x, z) =>
    x < -3.7 || x > 3.6 || z < -4.7 || z > 4.6 || OB.some(([a, b, c, d]) => x > a && x < b && z > c && z < d);
  function setQuality(q) {
    const low = q === 'low',
      hi = q === 'high';
    R.shadowMap.enabled = !low;
    sun.castShadow = !low;
    R.shadowMap.autoUpdate = hi;
    R.shadowMap.needsUpdate = true;
    rgbC.visible = !low;
    R.setPixelRatio(Math.min(devicePixelRatio, low ? 1 : hi ? 1.75 : 1.5));
    R.setSize(innerWidth, innerHeight);
    scene.traverse(o => {
      if (o.material)
        [].concat(o.material).forEach(mm => {
          mm.needsUpdate = true;
        });
    });
  }

  function mergeStatic() {
    scene.updateMatrixWorld(true);
    const buckets = new Map(),
      list = [];
    room.traverse(o => {
      if (o.isMesh && !o.isInstancedMesh && o.userData.m === 1 && !Array.isArray(o.material)) list.push(o);
    });
    list.forEach(o => {
      const k = o.material.uuid + (o.castShadow ? 'c' : 'n');
      let b = buckets.get(k);
      if (!b) buckets.set(k, (b = { mat: o.material, cast: o.castShadow, geos: [], src: [] }));
      const g = o.geometry.clone();
      g.applyMatrix4(o.matrixWorld);
      b.geos.push(g);
      b.src.push(o);
    });
    buckets.forEach(b => {
      let mg = null;
      if (b.geos.length > 1) {
        try {
          mg = mergeGeometries(b.geos, false);
        } catch (e) {
          mg = null;
        }
      }
      b.geos.forEach(g => g.dispose());
      if (!mg) return;
      const m = new THREE.Mesh(mg, b.mat);
      m.castShadow = b.cast;
      m.receiveShadow = true;
      m.matrixAutoUpdate = false;
      m.updateMatrix();
      room.add(m);
      b.src.forEach(o => o.parent.remove(o));
    });
  }
  if (!opts.noMerge) mergeStatic();
  return {
    scene,
    st,
    update,
    setTime,
    blocked,
    unstick,
    setQuality,
    room,
    book,
    term,
    tv,
    setWeather,
    night: () => nightK,
    obstacles: OB,
    mats: { floor: floor.material, walls: plaster, desk: wood },
    parts: { chair },
    start: { x: 0.5, z: 3.6 },
    view: { x: 3.3, z: -1, look: [10, 1.1, -1.2] },
  };
}
