export function createInput(cv, onStart, onTap) {
  const keys = {},
    ptr = {},
    look = { yaw: 0, pit: 0 };
  const joy = document.getElementById('joy'),
    knob = document.getElementById('knob');
  let jx = 0,
    jy = 0;
  const cl = (v, a, b) => Math.max(a, Math.min(b, v));
  addEventListener('keydown', e => {
    if (e.target.tagName === 'INPUT') return;
    keys[e.code] = 1;
    onStart();
  });
  addEventListener('keyup', e => {
    if (e.target.tagName !== 'INPUT') keys[e.code] = 0;
  });
  cv.addEventListener('pointerdown', e => {
    cv.setPointerCapture(e.pointerId);
    const m = e.pointerType === 'touch' && e.clientX < innerWidth / 2;
    ptr[e.pointerId] = {
      m,
      x: e.clientX,
      y: e.clientY,
      sx: e.clientX,
      sy: e.clientY,
      mv: 0,
      t: performance.now(),
    };
    onStart();
    if (m) {
      joy.style.display = 'block';
      joy.style.left = e.clientX + 'px';
      joy.style.top = e.clientY + 'px';
    }
  });
  cv.addEventListener('pointermove', e => {
    const p = ptr[e.pointerId];
    if (!p) return;
    p.mv = Math.max(p.mv, Math.hypot(e.clientX - p.sx, e.clientY - p.sy));
    if (p.m) {
      jx = cl((e.clientX - p.sx) / 50, -1, 1);
      jy = cl((e.clientY - p.sy) / 50, -1, 1);
      knob.style.transform = `translate(${jx * 28}px,${jy * 28}px)`;
    } else {
      look.yaw -= (e.clientX - p.x) * 0.005;
      look.pit = cl(look.pit - (e.clientY - p.y) * 0.005, -1.1, 1.1);
      p.x = e.clientX;
      p.y = e.clientY;
    }
  });
  const up = e => {
    const p = ptr[e.pointerId];
    if (p && p.m) {
      jx = jy = 0;
      joy.style.display = 'none';
      knob.style.transform = '';
    }
    if (p && e.type === 'pointerup' && p.mv < 8 && performance.now() - p.t < 400 && onTap) onTap(e);
    delete ptr[e.pointerId];
  };
  cv.addEventListener('pointerup', up);
  cv.addEventListener('pointercancel', up);
  return {
    look,
    axes: () => ({
      sx: (keys.KeyD || keys.ArrowRight ? 1 : 0) - (keys.KeyA || keys.ArrowLeft ? 1 : 0) + jx,
      sf: (keys.KeyW || keys.ArrowUp ? 1 : 0) - (keys.KeyS || keys.ArrowDown ? 1 : 0) - jy,
    }),
  };
}
