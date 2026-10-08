import { cpSync, existsSync, mkdirSync } from 'node:fs';
const src = 'node_modules/three/examples/jsm/libs';
for (const [from, to] of [
  ['basis', 'public/basis'],
  ['draco/gltf', 'public/draco'],
]) {
  if (existsSync(`${src}/${from}`)) {
    mkdirSync(to, { recursive: true });
    cpSync(`${src}/${from}`, to, { recursive: true });
  }
}
