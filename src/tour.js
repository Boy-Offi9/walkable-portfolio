import * as THREE from 'three';

const $ = id => document.getElementById(id),
  C = new THREE.Vector3(),
  SIGN = [-1, 1],
  clamp = (v, a, b) => Math.max(a, Math.min(b, v));

export function createTour({ site, W, cam, go, view, settled, hour, goTime }) {
  const root = $('tour'),
    hole = $('thole'),
    ring = $('tring'),
    card = $('tcard'),
    line = $('tline'),
    dot = $('tdot'),
    num = $('tnum'),
    of = $('tof'),
    title = $('ttitle'),
    text = $('ttext'),
    dots = $('tdots'),
    bSkip = $('tskip'),
    bBack = $('tback'),
    bNext = $('tnext');
  const cfg = site.tour && typeof site.tour === 'object' ? site.tour : {},
    copy = (k, d) => (typeof cfg[k] === 'string' && cfg[k]) || d,
    touch = matchMedia('(pointer: coarse)').matches,
    first = site.name.split(/\s+/)[0],
    skills = (site.skills || []).slice(0, 4).join(', ');
  const steps = [
    {
      title: `Hi, I'm ${first}`,
      text: copy('hello', 'Take a short walk around my room. Everything in here is alive. Ready?'),
      next: 'Start',
    },
    {
      st: 'about',
      box: [
        [-3.95, 1.35, 1.2],
        [0.03, 0.42, 0.76],
      ],
      title: 'The TV',
      text: copy(
        'about',
        `${site.role}. Tap the TV or the remote to switch between my home screen and a project reel.`
      ),
    },
    {
      st: 'projects',
      box: [
        [2.5, 0.78, -0.8],
        [0.32, 0.04, 0.24],
      ],
      title: 'The notebook',
      text: copy(
        'projects',
        `${site.projects.length} projects, one per page. Tap the left or right page to flip, and watch the pen write.`
      ),
    },
    {
      st: 'skills',
      box: [
        [2.5, 0.88, -1.55],
        [0.12, 0.09, 0.09],
      ],
      title: 'The tablet',
      text: copy('skills', skills ? `${skills} and more. This is what I reach for.` : 'What I work with.'),
    },
    {
      st: 'contact',
      box: [
        [-2.2, 1.12, -4.65],
        [0.42, 0.25, 0.03],
      ],
      title: 'The workstation',
      text: copy('contact', `Type help in the terminal at the bottom, or write to ${site.email}.`),
    },
    {
      view: true,
      night: true,
      box: [
        [4.02, 1.7, -1],
        [0.03, 0.8, 1.6],
      ],
      title: 'The window',
      text: 'A quiet neighbourhood by day. Watch it turn into a neon city.',
    },
    {
      dom: 'menu',
      title: 'The menu',
      text: 'Search, jump anywhere, scrub the time of day, switch the music and the quality.',
    },
    {
      title: 'Your turn',
      text: touch
        ? 'Hold the left side of the screen to walk and drag the right side to look.'
        : 'Use W A S D to walk and drag the mouse to look around.',
      next: 'Explore',
      done: true,
    },
  ].filter(s => !s.st || W.st.some(o => o.type === s.st));

  let on = false,
    i = 0,
    arrived = false,
    tgt = null,
    k = 0,
    prevH = 0,
    nightSet = false,
    placed = null;
  const cur = { x: 0, y: 0, w: 0, h: 0 };

  const measure = s => {
    if (s.dom) {
      const r = $(s.dom).getBoundingClientRect();
      return { x: r.left, y: r.top, w: r.width, h: r.height };
    }
    if (!s.box) return null;
    const [c, hs] = s.box;
    let x0 = 1e9,
      y0 = 1e9,
      x1 = -1e9,
      y1 = -1e9,
      ok = true;
    cam.updateMatrixWorld();
    for (const a of SIGN)
      for (const b of SIGN)
        for (const d of SIGN) {
          C.set(c[0] + a * hs[0], c[1] + b * hs[1], c[2] + d * hs[2]).project(cam);
          if (C.z > 1 || C.z < -1) ok = false;
          const px = ((C.x + 1) / 2) * innerWidth,
            py = ((1 - C.y) / 2) * innerHeight;
          x0 = Math.min(x0, px);
          x1 = Math.max(x1, px);
          y0 = Math.min(y0, py);
          y1 = Math.max(y1, py);
        }
    if (!ok) return null;
    const pad = 14,
      m = 6;
    x0 = clamp(x0 - pad, m, innerWidth - m - 56);
    y0 = clamp(y0 - pad, m, innerHeight - m - 56);
    x1 = clamp(x1 + pad, x0 + 56, innerWidth - m);
    y1 = clamp(y1 + pad, y0 + 56, innerHeight - m);
    return { x: x0, y: y0, w: x1 - x0, h: y1 - y0 };
  };

  const place = () => {
    const w = Math.min(344, innerWidth - 24),
      vw = innerWidth,
      vh = innerHeight;
    card.style.width = w + 'px';
    const h = card.offsetHeight,
      s = steps[i];
    let x = (vw - w) / 2,
      y,
      mode = 'free';
    if (tgt && arrived) {
      const below = vh - (tgt.y + tgt.h),
        above = tgt.y - 64;
      x = clamp(tgt.x + tgt.w / 2 - w / 2, 12, vw - w - 12);
      if (below >= h + 40) {
        y = tgt.y + tgt.h + 22;
        mode = 'below';
      } else if (above >= h + 40) {
        y = tgt.y - h - 22;
        mode = 'above';
      } else y = vh - h - 20;
    } else y = s.next && !s.st ? (vh - h) / 2 : vh - h - 24;
    card.style.left = x + 'px';
    card.style.top = y + 'px';
    placed = { x, y, w, h, mode };
  };

  const enter = n => {
    i = n;
    const s = steps[i];
    arrived = false;
    tgt = null;
    root.classList.remove('swap');
    void root.offsetWidth;
    root.classList.add('swap');
    num.textContent = String(i + 1).padStart(2, '0');
    of.textContent = '/ ' + String(steps.length).padStart(2, '0');
    title.textContent = s.title;
    text.textContent = s.text;
    dots.replaceChildren(
      ...steps.map((_, j) => {
        const d = document.createElement('i');
        if (j < i) d.className = 'd';
        else if (j === i) d.className = 'n';
        return d;
      })
    );
    bNext.textContent = s.next || 'Next';
    bBack.hidden = i === 0;
    bSkip.hidden = !!s.done;
    const vi = steps.findIndex(o => o.night);
    if (vi >= 0 && i >= vi) {
      if (!nightSet) {
        prevH = hour();
        goTime(22);
        nightSet = true;
      }
    } else if (nightSet) {
      goTime(prevH);
      nightSet = false;
    }
    if (s.st) go(W.st.findIndex(o => o.type === s.st));
    else if (s.view) view();
    else arrived = true;
    place();
  };

  const finish = () => {
    if (!on) return;
    on = false;
    if (nightSet) goTime(prevH);
    nightSet = false;
    try {
      localStorage.setItem('walk-tour', '1');
    } catch (e) {}
    document.body.classList.remove('touring');
    root.classList.add('out');
    setTimeout(() => {
      if (!on) root.hidden = true;
    }, 450);
  };
  const next = () => (i >= steps.length - 1 ? finish() : enter(i + 1));
  const back = () => i > 0 && enter(i - 1);

  bNext.onclick = next;
  bBack.onclick = back;
  bSkip.onclick = finish;
  addEventListener('keydown', e => {
    if (!on) return;
    if (e.key === 'Escape') finish();
    else if (e.key === 'ArrowRight') next();
    else if (e.key === 'ArrowLeft') back();
    else if (e.key === 'Enter' && e.target.tagName !== 'BUTTON') next();
  });
  addEventListener('resize', () => on && place());

  return {
    get active() {
      return on;
    },
    start() {
      if (on) return;
      on = true;
      k = 0;
      nightSet = false;
      document.body.classList.add('touring');
      root.hidden = false;
      root.classList.remove('out');
      enter(0);
      bNext.focus({ preventScroll: true });
    },
    update(dt) {
      if (!on) return;
      const s = steps[i];
      if (!arrived && settled()) arrived = true;
      let m = null;
      if (arrived && (s.box || s.dom)) m = measure(s);
      if (m && !tgt) {
        cur.x = m.x + m.w / 2;
        cur.y = m.y + m.h / 2;
        cur.w = m.w;
        cur.h = m.h;
        k = 0;
        tgt = m;
        place();
      } else if (m) {
        tgt = m;
        const f = 1 - Math.exp(-dt * 14);
        cur.x += (m.x + m.w / 2 - cur.x) * f;
        cur.y += (m.y + m.h / 2 - cur.y) * f;
        cur.w += (m.w - cur.w) * f;
        cur.h += (m.h - cur.h) * f;
      } else if (!arrived && tgt) tgt = null;
      k += ((m ? 1 : 0) - k) * (1 - Math.exp(-dt * (m ? 6 : 10)));
      const e = 1 - Math.pow(1 - clamp(k, 0, 1), 3),
        w = cur.w * e,
        h = cur.h * e,
        x = cur.x - w / 2,
        y = cur.y - h / 2,
        r = Math.min(26, Math.min(w, h) / 2);
      hole.setAttribute('x', x);
      hole.setAttribute('y', y);
      hole.setAttribute('width', w);
      hole.setAttribute('height', h);
      hole.setAttribute('rx', r);
      ring.style.cssText = `left:${x}px;top:${y}px;width:${w}px;height:${h}px;border-radius:${r}px;opacity:${e}`;
      if (placed && m && e > 0.6 && (placed.mode === 'below' || placed.mode === 'above')) {
        const below = placed.mode === 'below',
          ax = clamp(cur.x, placed.x + 18, placed.x + placed.w - 18),
          ay = below ? y + h : y,
          by = below ? placed.y : placed.y + placed.h;
        line.setAttribute('x1', ax);
        line.setAttribute('y1', ay);
        line.setAttribute('x2', ax);
        line.setAttribute('y2', by);
        dot.setAttribute('cx', ax);
        dot.setAttribute('cy', ay);
        line.style.opacity = dot.style.opacity = 1;
      } else line.style.opacity = dot.style.opacity = 0;
    },
  };
}
