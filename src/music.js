const asList = v => (Array.isArray(v) ? v : v ? [v] : []).filter(Boolean);

export function createMusic(cfg = {}) {
  const files = {},
    vol = cfg.volume == null ? 0.8 : cfg.volume;
  ['day', 'night'].forEach(k => {
    const tracks = asList(cfg[k]);
    files[k] = tracks.length ? { tracks, i: 0, ok: true, el: null } : null;
  });
  let analyser = null,
    fbin = null,
    avg = 0,
    ctx,
    master,
    dayBus,
    nightBus,
    noise,
    timer = null,
    on = false,
    night = 0,
    beat = 0,
    sD = 0,
    sN = 0,
    nD = 0,
    nN = 0;
  const kicks = [],
    mtof = m => 440 * Math.pow(2, (m - 69) / 12);
  const env = (g, t, a, d, peak) => {
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(peak, t + a);
    g.gain.exponentialRampToValueAtTime(0.0001, t + a + d);
  };
  const tone = (bus, type, f, t, dur, peak, lp, det = 0) => {
    const o = ctx.createOscillator(),
      g = ctx.createGain();
    o.type = type;
    o.frequency.value = f;
    o.detune.value = det;
    let n = o;
    if (lp) {
      const b = ctx.createBiquadFilter();
      b.type = 'lowpass';
      b.frequency.value = lp;
      o.connect(b);
      n = b;
    }
    n.connect(g);
    g.connect(bus);
    env(g, t, 0.02, dur, peak);
    o.start(t);
    o.stop(t + dur + 0.1);
  };
  const kick = (bus, t, vol) => {
    const o = ctx.createOscillator(),
      g = ctx.createGain();
    o.frequency.setValueAtTime(150, t);
    o.frequency.exponentialRampToValueAtTime(42, t + 0.12);
    o.connect(g);
    g.connect(bus);
    g.gain.setValueAtTime(vol, t);
    g.gain.exponentialRampToValueAtTime(0.001, t + 0.35);
    o.start(t);
    o.stop(t + 0.4);
  };
  const nz = (bus, t, dur, peak, type, f) => {
    const s = ctx.createBufferSource(),
      b = ctx.createBiquadFilter(),
      g = ctx.createGain();
    s.buffer = noise;
    b.type = type;
    b.frequency.value = f;
    s.connect(b);
    b.connect(g);
    g.connect(bus);
    g.gain.setValueAtTime(peak, t);
    g.gain.exponentialRampToValueAtTime(0.001, t + dur);
    s.start(t, Math.random() * 0.5);
    s.stop(t + dur + 0.05);
  };
  const CH = [
      [53, 57, 60, 64],
      [52, 55, 59, 62],
      [50, 53, 57, 60],
      [48, 52, 55, 59],
    ],
    PEN = [72, 74, 76, 79, 81];
  function lofi(s, t) {
    const bar = Math.floor(s / 16) % 4,
      st = s % 16,
      sw = st % 2 ? 0.02 : 0;
    if (st === 0)
      CH[bar].forEach((m, i) => tone(dayBus, 'triangle', mtof(m), t, 1.6, 0.07, 900, (i - 1.5) * 4));
    if (st === 0 || st === 10) {
      kick(dayBus, t, 0.8);
      kicks.push(t);
    }
    if (st === 8) nz(dayBus, t, 0.14, 0.35, 'bandpass', 1800);
    if (st % 2 === 0) nz(dayBus, t + sw, 0.04, 0.12, 'highpass', 7000);
    if (Math.random() < 0.18)
      tone(dayBus, 'sine', mtof(PEN[Math.floor(Math.random() * 5)]), t + sw, 0.5, 0.05, 2200);
    if (Math.random() < 0.3) nz(dayBus, t, 0.01, 0.06, 'highpass', 3000);
  }
  const NC = [45, 41, 48, 43],
    NT = [
      [57, 60, 64],
      [53, 57, 60],
      [60, 64, 67],
      [55, 59, 62],
    ];
  function synth(s, t) {
    const bar = Math.floor(s / 16) % 4,
      st = s % 16;
    if (st === 0)
      NT[bar].forEach((m, i) => tone(nightBus, 'sawtooth', mtof(m), t, 1.8, 0.05, 1400, (i - 1) * 9));
    if (st % 2 === 0) tone(nightBus, 'sawtooth', mtof(NC[bar] + (st % 4 ? 12 : 0)), t, 0.22, 0.13, 500);
    if (st % 4 === 0) {
      kick(nightBus, t, 1);
      kicks.push(t);
    }
    if (st === 4 || st === 12) {
      nz(nightBus, t, 0.2, 0.5, 'bandpass', 2200);
      tone(nightBus, 'triangle', 190, t, 0.12, 0.2);
    }
    if (st % 2 === 0) nz(nightBus, t, 0.03, 0.1, 'highpass', 8000);
    if (Math.random() < 0.55) tone(nightBus, 'square', mtof(NT[bar][st % 3] + 12), t, 0.12, 0.035, 2600);
  }
  const fileOn = k => !!(files[k] && files[k].ok);
  const hookFiles = () => {
    analyser = ctx.createAnalyser();
    analyser.fftSize = 256;
    fbin = new Uint8Array(analyser.frequencyBinCount);
    ['day', 'night'].forEach(k => {
      const f = files[k];
      if (!f) return;
      const el = new Audio(),
        g = ctx.createGain();
      el.preload = 'none';
      el.crossOrigin = 'anonymous';
      el.loop = f.tracks.length === 1;
      el.src = f.tracks[0];
      el.onended = () => {
        f.i = (f.i + 1) % f.tracks.length;
        el.src = f.tracks[f.i];
        el.play().catch(() => {});
      };
      el.onerror = () => {
        f.ok = false;
        el.pause();
      };
      g.gain.value = vol / 0.45;
      ctx.createMediaElementSource(el).connect(g);
      g.connect(k === 'day' ? dayBus : nightBus);
      g.connect(analyser);
      f.el = el;
    });
  };
  const syncFiles = () =>
    ['day', 'night'].forEach(k => {
      const f = files[k];
      if (!f || !f.el) return;
      const w = k === 'day' ? 1 - night : night;
      if (on && f.ok && w > 0.02) {
        if (f.el.paused) f.el.play().catch(() => {});
      } else if (!f.el.paused) f.el.pause();
    });
  const tick = () => {
    const now = ctx.currentTime;
    while (nD < now + 0.15) {
      if (1 - night > 0.04 && !fileOn('day')) lofi(sD, nD);
      sD++;
      nD += 60 / 76 / 4;
    }
    while (nN < now + 0.15) {
      if (night > 0.04 && !fileOn('night')) synth(sN, nN);
      sN++;
      nN += 60 / 100 / 4;
    }
  };
  return {
    toggle() {
      if (!ctx) {
        ctx = new (window.AudioContext || window.webkitAudioContext)();
        master = ctx.createGain();
        master.gain.value = 0;
        master.connect(ctx.destination);
        dayBus = ctx.createGain();
        nightBus = ctx.createGain();
        dayBus.connect(master);
        nightBus.connect(master);
        const b = ctx.createBuffer(1, ctx.sampleRate, ctx.sampleRate),
          d = b.getChannelData(0);
        for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
        noise = b;
        hookFiles();
      }
      on = !on;
      ctx.resume();
      if (on) {
        nD = nN = ctx.currentTime + 0.1;
        timer = setInterval(tick, 30);
        master.gain.setTargetAtTime(0.45, ctx.currentTime, 0.3);
        this.setNight(night);
      } else {
        clearInterval(timer);
        master.gain.setTargetAtTime(0, ctx.currentTime, 0.2);
        kicks.length = 0;
        syncFiles();
      }
      return on;
    },
    setNight(n) {
      night = n;
      if (ctx) {
        dayBus.gain.setTargetAtTime(1 - n, ctx.currentTime, 0.4);
        nightBus.gain.setTargetAtTime(n, ctx.currentTime, 0.4);
        syncFiles();
      }
    },
    level(dt) {
      if (!ctx || !on) {
        beat = 0;
        return 0;
      }
      const now = ctx.currentTime;
      while (kicks.length && kicks[0] <= now) {
        beat = 1;
        kicks.shift();
      }
      if (analyser && ['day', 'night'].some(k => files[k] && files[k].el && !files[k].el.paused)) {
        analyser.getByteFrequencyData(fbin);
        let e = 0;
        for (let i = 0; i < 6; i++) e += fbin[i];
        e /= 6 * 255;
        avg += (e - avg) * Math.min(1, dt * 2);
        beat = Math.max(beat, Math.min(1, Math.max(0, e - avg) * 5));
      }
      beat *= Math.exp(-dt * 7);
      return beat;
    },
  };
}
