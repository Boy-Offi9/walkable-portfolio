import * as THREE from 'three';
import './style.css';
import { site } from './config/site.js';
import { buildWorld } from './world.js';
import { createInput } from './controls.js';
import { initUI } from './ui.js';
import { createLabels } from './labels.js';
import { applyAssets, resolveAssets } from './assets.js';
import { createMusic } from './music.js';
import { fetchWeather } from './weather.js';
import { createTour } from './tour.js';
import { createList } from './list.js';

const cv = document.getElementById('c'),
  hint = document.getElementById('hint');
const list = createList(site, {
  onClose() {
    lastKey = '';
    try {
      history.replaceState(null, '', location.pathname + location.search);
    } catch (e) {}
  },
});
const RM = matchMedia('(prefers-reduced-motion:reduce)').matches;
let R;
try {
  R = new THREE.WebGLRenderer({ canvas: cv, antialias: true });
} catch (e) {
  list.open({ noGL: true });
  throw e;
}
R.toneMapping = THREE.ACESFilmicToneMapping;
R.shadowMap.enabled = true;

const QS = ['auto', 'low', 'medium', 'high'],
  weak =
    matchMedia('(pointer: coarse)').matches ||
    (navigator.hardwareConcurrency || 8) <= 4 ||
    (navigator.deviceMemory || 8) <= 4;
let qpref = 'auto';
try {
  const v = localStorage.getItem('walk-quality');
  if (QS.includes(v)) qpref = v;
  else if (localStorage.getItem('walk-fast') === '1') qpref = 'low';
} catch (e) {}
let qtier = qpref === 'auto' ? (weak ? 'medium' : 'high') : qpref;
const W = buildWorld(R, site, { lowRes: qtier === 'low' }),
  n = W.st.length,
  EYE = 1.65,
  iProj = W.st.findIndex(s => s.type === 'projects');
const cam = new THREE.PerspectiveCamera(70, 1, 0.05, 800);
cam.rotation.order = 'YXZ';
W.scene.add(cam);
const P = { x: W.start.x, z: W.start.z };
let warp = null,
  cur = -2,
  lastIdx = -1,
  lastStatus = '',
  lastH = -1,
  zoomT = 1,
  zoom = 1,
  lastNk = -1;
const cl = (v, a, b) => Math.max(a, Math.min(b, v));
const input = createInput(
  cv,
  () => {
    warp = null;
    hint.style.opacity = 0;
  },
  onTap
);
const music = createMusic(site.audio);
W.setVideo(qtier !== 'low');

function readHash() {
  const [path, qs = ''] = location.hash.slice(1).split('?'),
    [place, pg] = path.split('/').filter(Boolean),
    t = new URLSearchParams(qs).get('t'),
    num = t != null && t !== '' ? Number(t) : NaN;
  return {
    place: place ? place.toLowerCase() : '',
    pg: pg != null && Number.isFinite(+pg) ? +pg - 1 : null,
    t: t === 'night' ? 22.5 : t === 'day' ? 12 : Number.isFinite(num) ? ((num % 24) + 24) % 24 : null,
  };
}
const boot = readHash(),
  cfg = site.world,
  dayLen = cfg.dayLengthSeconds || 120;
let h = cfg.startHour == null ? 10.5 : cfg.startHour,
  playing = false,
  tween = null,
  live = false,
  liveOff = 0,
  wxInfo = null;
if (boot.t != null) h = boot.t;
const wrap24 = v => ((v % 24) + 24) % 24,
  liveHour = () => wrap24(Date.now() / 36e5 + liveOff);
const manual = () => {
  live = false;
  ui.setLive(false);
};

W.setQuality(qtier);

const aim = (x, z, lk) => {
  const dx = lk[0] - x,
    dz = lk[2] - z;
  return { x, z, yaw: Math.atan2(-dx, -dz), pit: Math.atan2(lk[1] - EYE, Math.hypot(dx, dz)) };
};
const go = (i, pg) => {
  const s = W.st[i];
  warp = aim(s.x, s.z, s.look);
  zoomT = s.zoom || 1;
  hint.style.opacity = 0;
  if (pg != null && i === iProj) {
    W.book.set(pg);
    ui.setPage();
  }
};
const toastEl = document.getElementById('toast');
let toastT = 0;
const toast = msg => {
  toastEl.textContent = msg;
  toastEl.classList.add('on');
  clearTimeout(toastT);
  toastT = setTimeout(() => toastEl.classList.remove('on'), 1800);
};
const atView = () => Math.hypot(P.x - W.view.x, P.z - W.view.z) < 0.5;
function hashFor(withTime) {
  let path = '';
  if (cur >= 0) {
    path = W.st[cur].type;
    if (cur === iProj) path += '/' + (W.book.page + 1);
  } else if (atView()) path = 'window';
  const t = withTime ? h : boot.t,
    q = t == null ? '' : '?t=' + Math.round(t * 10) / 10;
  return path || q ? '#/' + path + q : '';
}
const act = {
  go,
  next() {
    go((lastIdx + 1) % n);
  },
  surprise() {
    let i;
    do i = Math.floor(Math.random() * n);
    while (n > 1 && i === cur);
    go(i);
  },
  view() {
    const v = W.view;
    warp = aim(v.x, v.z, v.look);
    zoomT = 1;
    hint.style.opacity = 0;
  },
  page(d) {
    W.book.flip(d);
    ui.setPage();
  },
  getPage: () => ({ page: W.book.page, count: W.book.count }),
  scrub(v) {
    manual();
    tween = null;
    h = v;
  },
  togglePlay() {
    manual();
    playing = !playing;
    return playing;
  },
  goTime(target) {
    manual();
    tween = { from: h, d: (target - h + 24) % 24 || 24, t: 0 };
  },
  live() {
    if (!wxInfo) return;
    live = !live;
    ui.setLive(live);
    if (live) {
      tween = null;
      playing = false;
    }
  },
  tv() {
    W.tv.toggle();
  },
  async share() {
    const u = location.href.split('#')[0] + hashFor(true);
    try {
      if (navigator.share && matchMedia('(pointer: coarse)').matches) {
        await navigator.share({ title: document.title, url: u });
        return;
      }
    } catch (e) {
      if (e.name === 'AbortError') return;
    }
    try {
      await navigator.clipboard.writeText(u);
      toast('Link copied');
    } catch (e) {
      prompt('Copy this link', u);
    }
  },
  toggleMusic: () => music.toggle(),
  termInput: v => W.term.setInput(v),
  termExec(cmd) {
    const r = W.term.exec(cmd);
    if (r && r.open != null) go(iProj, r.open);
  },
  quality() {
    qpref = QS[(QS.indexOf(qpref) + 1) % QS.length];
    try {
      localStorage.setItem('walk-quality', qpref);
    } catch (e) {}
    guard.on = qpref === 'auto';
    guard.clean = 0;
    applyQuality(qpref === 'auto' ? (weak ? 'medium' : 'high') : qpref);
  },
};
const ui = initUI(site, W.st, act),
  labels = createLabels(site, W.st, go, () => ui.prefs.tags);
ui.setQuality(qpref, qtier);

async function loadWeather() {
  try {
    const w = await fetchWeather(site.weather);
    if (!w) return;
    wxInfo = w;
    liveOff = w.offsetHours;
    W.setWeather(w);
    ui.setWeather(w);
  } catch (e) {}
}
if (site.weather && site.weather.lat != null) {
  loadWeather();
  setInterval(loadWeather, 15 * 60 * 1000);
}

const ray = new THREE.Raycaster(),
  v2 = new THREE.Vector2();
function onTap(e) {
  v2.set((e.clientX / innerWidth) * 2 - 1, -(e.clientY / innerHeight) * 2 + 1);
  ray.setFromCamera(v2, cam);
  const th = ray.intersectObjects(W.tv.hits, true)[0],
    bh = ray.intersectObject(W.book.group, true)[0];
  if (th && (!bh || th.distance < bh.distance)) {
    W.tv.toggle();
    return;
  }
  if (!bh) return;
  if (cur !== iProj) {
    go(iProj);
    return;
  }
  act.page(W.book.group.worldToLocal(bh.point.clone()).x > 0 ? 1 : -1);
}

const tour = createTour({
  site,
  W,
  cam,
  go,
  view: act.view,
  settled: () => !warp && Math.abs(zoom - zoomT) < 0.02,
  hour: () => h,
  goTime: act.goTime,
});
const intro = document.getElementById('intro'),
  ibar = intro.querySelector('#ibar i'),
  istat = document.getElementById('istat'),
  ienter = document.getElementById('ienter'),
  itour = document.getElementById('itour'),
  isndc = document.getElementById('isndc');
const imark = document.getElementById('imark');
imark.textContent = site.world.mark;
if (site.photo) {
  const pic = new Image();
  pic.alt = '';
  pic.onload = () => imark.replaceChildren(pic);
  pic.src = site.photo;
}
if (site.favicon) {
  let ico = document.querySelector('link[rel~="icon"]');
  if (!ico) {
    ico = document.createElement('link');
    ico.rel = 'icon';
    document.head.append(ico);
  }
  ico.href = site.favicon;
}
document.getElementById('iname').textContent = site.name;
document.getElementById('irole').textContent = site.role;
try {
  isndc.checked = localStorage.getItem('walk-sound') !== '0';
} catch (e) {}
let entered = false,
  assetRank = -1;
const RANK = { low: 0, medium: 1, high: 2 };
async function loadAssets(onP) {
  const a = resolveAssets(site.assets, qtier);
  if (!a || RANK[qtier] <= assetRank) return onP && onP(1);
  assetRank = RANK[qtier];
  await applyAssets(R, W, a, onP || (() => {})).catch(e => console.warn(e));
}
(async () => {
  const setP = (p, label) => {
    ibar.style.width = p * 100 + '%';
    if (label) istat.textContent = label;
  };
  setP(0.15, 'Building the room');
  await loadAssets(p => setP(0.15 + p * 0.7, p < 1 ? 'Loading textures and models' : ''));
  setP(0.9, 'Compiling shaders');
  try {
    await R.compileAsync(W.scene, cam);
  } catch (e) {}
  setP(1, 'Ready');
  ienter.disabled = itour.disabled = false;
  intro.classList.add('ready');
  ienter.focus({ preventScroll: true });
})();
function openHash() {
  const { place, pg, t } = readHash();
  if (place === 'list') return openList();
  if (t != null) {
    manual();
    tween = null;
    playing = false;
    h = t;
  }
  if (place === 'window') act.view();
  else {
    const i = W.st.findIndex(o => o.type === place);
    if (i >= 0) go(i, pg);
  }
}
addEventListener('hashchange', () => entered && !tour.active && openHash());
function openList() {
  list.open();
  try {
    history.replaceState(null, '', location.pathname + location.search + '#/list');
  } catch (e) {}
}
const enter = withTour => {
  if (entered) return;
  entered = true;
  intro.classList.add('out');
  setTimeout(() => intro.remove(), 700);
  guard.start = performance.now() + 2500;
  try {
    localStorage.setItem('walk-sound', isndc.checked ? '1' : '0');
  } catch (e) {}
  if (isndc.checked) ui.setMusic(music.toggle());
  if (withTour) setTimeout(tour.start, 700);
  else openHash();
};
ienter.onclick = () => enter(false);
itour.onclick = () => enter(true);
document.getElementById('ilist').onclick = openList;
if (boot.place === 'list') openList();
const ttour = document.getElementById('ttour');
if (site.tour === false) {
  itour.remove();
  ttour.remove();
}
document.getElementById('tlist').onclick = () => {
  const panel = document.getElementById('panel');
  if (!panel.inert) document.getElementById('pclose').click();
  openList();
};
ttour.onclick = () => {
  if (!entered || tour.active) return;
  const panel = document.getElementById('panel');
  if (!panel.inert) document.getElementById('pclose').click();
  setTimeout(tour.start, 350);
};

const baseFov = () => (cam.aspect < 1 ? 80 : 70);
function size() {
  R.setSize(innerWidth, innerHeight);
  if (comp) {
    comp.setPixelRatio(R.getPixelRatio());
    comp.setSize(innerWidth, innerHeight);
  }
  cam.aspect = innerWidth / innerHeight;
  cam.fov = baseFov() * zoom;
  cam.updateProjectionMatrix();
}

let comp = null,
  bloom = null,
  postOn = false,
  postTried = false,
  shT = 0;
async function syncPost() {
  if (qtier !== 'high') {
    postOn = false;
    return;
  }
  if (comp) {
    postOn = true;
    return;
  }
  if (postTried) return;
  postTried = true;
  try {
    const [{ EffectComposer }, { RenderPass }, { UnrealBloomPass }, { OutputPass }] = await Promise.all([
      import('three/examples/jsm/postprocessing/EffectComposer.js'),
      import('three/examples/jsm/postprocessing/RenderPass.js'),
      import('three/examples/jsm/postprocessing/UnrealBloomPass.js'),
      import('three/examples/jsm/postprocessing/OutputPass.js'),
    ]);
    const rt = new THREE.WebGLRenderTarget(innerWidth, innerHeight, {
      type: THREE.HalfFloatType,
      samples: 4,
    });
    comp = new EffectComposer(R, rt);
    comp.addPass(new RenderPass(W.scene, cam));
    bloom = new UnrealBloomPass(new THREE.Vector2(innerWidth, innerHeight), 0.3, 0.6, 0.85);
    comp.addPass(bloom);
    comp.addPass(new OutputPass());
    comp.setPixelRatio(R.getPixelRatio());
    comp.setSize(innerWidth, innerHeight);
    postOn = qtier === 'high';
  } catch (e) {
    console.warn('Bloom unavailable, using the plain renderer', e);
    comp = null;
    postOn = false;
  }
}
function applyQuality(t) {
  qtier = t;
  W.setQuality(t);
  W.setVideo(t !== 'low');
  if (entered && RANK[t] > assetRank) loadAssets();
  size();
  syncPost();
  ui.setQuality(qpref, qtier);
}
const guard = { on: qpref === 'auto', last: 0, acc: 0, n: 0, clean: 0, start: performance.now() + 3000 };
addEventListener('resize', size);
size();
syncPost();

let last = performance.now(),
  lastKey = '';
function frame(now) {
  const dt = Math.min((now - last) / 1000, 0.05),
    t = now / 1000;
  last = now;
  if (live) h = liveHour();
  else if (tween) {
    tween.t += dt / 6;
    const k = Math.min(1, tween.t);
    h = wrap24(tween.from + tween.d * k * k * (3 - 2 * k));
    if (k >= 1) tween = null;
  } else if (playing) h = wrap24(h + (dt * 24) / dayLen);
  if (Math.abs(h - lastH) > 0.002) {
    lastH = h;
    W.setTime(h);
    ui.setClock(h);
  }
  const nk = W.night();
  if (Math.abs(nk - lastNk) > 0.02) {
    lastNk = nk;
    music.setNight(nk);
  }

  const L = input.look,
    { sx, sf } = entered && !tour.active && !list.active ? input.axes() : { sx: 0, sf: 0 },
    sn = Math.sin(L.yaw),
    cs = Math.cos(L.yaw);
  let dx = cs * sx - sn * sf,
    dz = -sn * sx - cs * sf;
  const m = Math.hypot(dx, dz);
  if (m > 1) {
    dx /= m;
    dz /= m;
  }
  if (m > 0.05) zoomT = 1;
  if (!warp && W.blocked(P.x, P.z)) {
    const q = W.unstick(P.x, P.z);
    P.x = q.x;
    P.z = q.z;
  }
  const nx = P.x + dx * 3.2 * dt,
    nz = P.z + dz * 3.2 * dt;
  if (!W.blocked(nx, P.z)) P.x = nx;
  if (!W.blocked(P.x, nz)) P.z = nz;
  if (warp) {
    const k = 1 - Math.exp(-dt * 3.5);
    P.x += (warp.x - P.x) * k;
    P.z += (warp.z - P.z) * k;
    let dy = warp.yaw - L.yaw;
    dy = Math.atan2(Math.sin(dy), Math.cos(dy));
    L.yaw += dy * k;
    L.pit += (warp.pit - L.pit) * k;
    if (Math.hypot(warp.x - P.x, warp.z - P.z) < 0.05 && Math.abs(dy) < 0.02) warp = null;
  }
  if (Math.abs(zoom - zoomT) > 0.002) {
    zoom += (zoomT - zoom) * (1 - Math.exp(-dt * 4));
    cam.fov = baseFov() * zoom;
    cam.updateProjectionMatrix();
  }
  cam.position.set(P.x, EYE + (RM ? 0 : Math.sin(t * 8) * 0.015 * Math.min(1, m)), P.z);
  cam.rotation.set(L.pit, L.yaw, 0);
  W.update(t, dt, RM, cam, music.level(dt));
  if (qtier === 'medium') {
    shT += dt;
    if (shT > 0.2) {
      shT = 0;
      R.shadowMap.needsUpdate = true;
    }
  }
  if (bloom) bloom.strength = 0.1 + 0.42 * W.night();
  if (guard.on && now > guard.start) {
    const d = now - guard.last;
    if (guard.last && d < 500) {
      guard.acc += d;
      guard.n++;
      if (guard.n >= 40) {
        const avg = guard.acc / guard.n;
        guard.acc = 0;
        guard.n = 0;
        if (avg > 42 && qtier !== 'low') {
          applyQuality(qtier === 'high' ? 'medium' : 'low');
          guard.clean = 0;
        } else if (++guard.clean >= 4) guard.on = false;
      }
    }
  }
  guard.last = now;

  let near = -1,
    bd = 1.5;
  W.st.forEach((s, i) => {
    const d = Math.hypot(s.x - P.x, s.z - P.z);
    if (d < bd) {
      bd = d;
      near = i;
    }
  });
  if (near !== cur) {
    cur = near;
    ui.show(near < 0 ? null : W.st[near]);
    if (near >= 0) {
      lastIdx = near;
      ui.setStation(near);
      if (near === iProj) W.book.write();
    }
  }
  const status = warp ? 'Gliding' : m > 0.05 ? 'Walking' : near >= 0 ? 'At station' : 'Standing';
  if (status !== lastStatus) {
    lastStatus = status;
    ui.setStatus(status);
  }
  tour.update(dt);
  if (entered && !warp && !tour.active && !list.active) {
    const key = cur + '|' + W.book.page + '|' + (cur < 0 && atView());
    if (key !== lastKey) {
      lastKey = key;
      try {
        history.replaceState(null, '', location.pathname + location.search + hashFor(false));
      } catch (e) {}
    }
  }
  labels(cam, near);
  if (postOn && comp) comp.render(dt);
  else R.render(W.scene, cam);
  requestAnimationFrame(frame);
}
requestAnimationFrame(frame);
