import * as THREE from 'three';

const BASE = import.meta.env.BASE_URL,
  KEYS = ['color', 'normal', 'rough'],
  SLOTS = ['floor', 'walls', 'desk'],
  seen = new Set(),
  fresh = id => !seen.has(id) && !!seen.add(id),
  hasFiles = s => !!s && KEYS.some(t => s[t]);

export function resolveAssets(cfg, tier) {
  if (!cfg || tier === 'low') return null;
  const hi = tier === 'high' && cfg.high ? cfg.high : {},
    out = { hdri: hi.hdri || cfg.hdri, models: [] };
  SLOTS.forEach(k => (out[k] = hasFiles(hi[k]) ? hi[k] : cfg[k]));
  out.models = [...(cfg.models || []), ...(hi.models || [])].filter(
    m => m && (m.tier !== 'high' || tier === 'high')
  );
  return out;
}

export async function applyAssets(R, W, cfg, onProgress) {
  const keys = KEYS,
    slots = SLOTS.filter(k => hasFiles(cfg[k])).map(k => [
      k,
      keys.filter(t => cfg[k][t] && fresh(`${k}:${t}:${cfg[k][t]}`)),
    ]),
    models = (cfg.models || []).filter(m => m && m.url && fresh('model:' + m.url)),
    hdri = cfg.hdri && fresh('hdri:' + cfg.hdri) ? cfg.hdri : '';
  const jobs = slots.reduce((n, s) => n + s[1].length, 0) + models.length + (hdri ? 1 : 0);
  if (!jobs) {
    onProgress(1);
    return;
  }
  let done = 0;
  const tick = () => onProgress(++done / jobs);

  let ktx2 = null;
  const getKtx2 = async () => {
    if (!ktx2) {
      const { KTX2Loader } = await import('three/examples/jsm/loaders/KTX2Loader.js');
      ktx2 = new KTX2Loader().setTranscoderPath(BASE + 'basis/').detectSupport(R);
    }
    return ktx2;
  };
  const plain = new THREE.TextureLoader(),
    aniso = Math.min(8, R.capabilities.getMaxAnisotropy());
  const load = async url =>
    /\.ktx2(\?|$)/i.test(url) ? (await getKtx2()).loadAsync(url) : plain.loadAsync(url);

  await Promise.all([
    ...(hdri
      ? [
          (async () => {
            try {
              const { RGBELoader } = await import('three/examples/jsm/loaders/RGBELoader.js'),
                tex = await new RGBELoader().loadAsync(hdri);
              tex.mapping = THREE.EquirectangularReflectionMapping;
              const pm = new THREE.PMREMGenerator(R);
              W.scene.environment = pm.fromEquirectangular(tex).texture;
              pm.dispose();
              tex.dispose();
            } catch (e) {
              console.warn('HDRI failed, keeping the built-in environment:', hdri, e);
            }
            tick();
          })(),
        ]
      : []),
    ...slots.flatMap(([k, files]) => {
      const c = cfg[k],
        mat = W.mats[k],
        rep = c.repeat || [1, 1];
      return files.map(async t => {
        try {
          const tx = await load(c[t]);
          tx.wrapS = tx.wrapT = THREE.RepeatWrapping;
          tx.repeat.set(rep[0], rep[1]);
          tx.anisotropy = aniso;
          if (t === 'color') {
            tx.colorSpace = THREE.SRGBColorSpace;
            mat.map = tx;
            mat.color.set(0xffffff);
          } else if (t === 'normal') mat.normalMap = tx;
          else {
            mat.roughnessMap = tx;
            mat.roughness = 1;
          }
          mat.needsUpdate = true;
        } catch (e) {
          console.warn('Texture failed, keeping the built-in look:', c[t], e);
        }
        tick();
      });
    }),
    ...models.map(async m => {
      try {
        const [{ GLTFLoader }, { DRACOLoader }, { MeshoptDecoder }] = await Promise.all([
          import('three/examples/jsm/loaders/GLTFLoader.js'),
          import('three/examples/jsm/loaders/DRACOLoader.js'),
          import('three/examples/jsm/libs/meshopt_decoder.module.js'),
        ]);
        const gl = new GLTFLoader()
          .setMeshoptDecoder(MeshoptDecoder)
          .setDRACOLoader(new DRACOLoader().setDecoderPath(BASE + 'draco/'))
          .setKTX2Loader(await getKtx2());
        const g = (await gl.loadAsync(m.url)).scene,
          p = m.position || [0, 0, 0];
        g.position.set(p[0], p[1], p[2]);
        g.rotation.y = m.rotationY || 0;
        g.scale.setScalar(m.scale || 1);
        g.traverse(o => {
          if (o.isMesh) o.castShadow = o.receiveShadow = true;
        });
        if (m.replace && W.parts[m.replace]) W.parts[m.replace].visible = false;
        if (m.blocker) W.obstacles.push(m.blocker);
        W.room.add(g);
      } catch (e) {
        console.warn('Model failed, keeping the built-in room:', m.url, e);
      }
      tick();
    }),
  ]);
}
