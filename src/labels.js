import * as THREE from 'three';
import { describe } from './ui.js';

export function createLabels(site, st, go, enabled) {
  const root = document.getElementById('labels'),
    v = new THREE.Vector3(),
    d = new THREE.Vector3(),
    dir = new THREE.Vector3();
  const els = st.map((s, i) => {
    const e = document.createElement('button'),
      b = document.createElement('b'),
      m = document.createElement('span'),
      t = describe(site, s);
    e.type = 'button';
    e.className = 'label';
    b.textContent = t.title;
    m.textContent = t.sub;
    e.append(b, m);
    e.onclick = () => go(i);
    root.append(e);
    return e;
  });
  return (cam, active) => {
    const on = enabled();
    cam.getWorldDirection(dir);
    st.forEach((s, i) => {
      v.copy(s.anchor);
      d.subVectors(v, cam.position);
      const dist = d.length(),
        ok = on && i !== active && dist < 14 && d.dot(dir) / dist > 0.3;
      els[i].hidden = !ok;
      if (!ok) return;
      v.project(cam);
      els[i].style.transform =
        `translate(${(v.x * 0.5 + 0.5) * innerWidth}px,${(-v.y * 0.5 + 0.5) * innerHeight}px) translate(-50%,-50%)`;
      els[i].style.opacity = Math.max(0.3, Math.min(1, 1.6 - dist / 8));
    });
  };
}
