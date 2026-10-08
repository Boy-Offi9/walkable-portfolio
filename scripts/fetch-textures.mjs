import { mkdirSync, writeFileSync } from 'node:fs';

const UA = 'walkable-portfolio-texture-fetch (personal portfolio)',
  RES = '1k';
const SETS = { floor: 'wood_floor_deck', walls: 'beige_wall_001', desk: 'wood_table_001' };
const REPEAT = { floor: [4, 5], walls: [1, 1], desk: [1, 1] };
const pick = (d, ...keys) => {
  for (const k of keys) {
    const u = d && d[k] && d[k][RES] && d[k][RES].jpg && d[k][RES].jpg.url;
    if (u) return u;
  }
  return '';
};
const out = {};
mkdirSync('public/assets/textures', { recursive: true });
for (const [slot, id] of Object.entries(SETS)) {
  try {
    const r = await fetch(`https://api.polyhaven.com/files/${id}`, { headers: { 'User-Agent': UA } });
    if (!r.ok) throw new Error('HTTP ' + r.status);
    const d = await r.json(),
      urls = {
        color: pick(d, 'Diffuse', 'diff'),
        normal: pick(d, 'nor_gl'),
        rough: pick(d, 'Rough', 'rough'),
      };
    out[slot] = { repeat: REPEAT[slot] };
    for (const [kind, url] of Object.entries(urls)) {
      if (!url) continue;
      const f = await fetch(url, { headers: { 'User-Agent': UA } });
      if (!f.ok) continue;
      writeFileSync(`public/assets/textures/${slot}_${kind}.jpg`, Buffer.from(await f.arrayBuffer()));
      out[slot][kind] = `assets/textures/${slot}_${kind}.jpg`;
    }
    console.log('ok  ', slot, id);
  } catch (e) {
    console.log('skip', slot, id, '-', e.message);
  }
}
console.log('\nPaste into the assets section of src/config/site.js:\n');
for (const [slot, v] of Object.entries(out)) console.log(`    ${slot}: ${JSON.stringify(v)},`);
