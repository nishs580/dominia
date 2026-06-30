// Cleans the 16 designer "Honor badge" SVGs into an inline RN-SVG data module.
//  - strips <defs>/<style> and the trailing baked-in name-text <g>
//  - inlines the two fill colours (so no CSS-class parsing is needed at runtime)
//  - converts the rotated endurance "diamond" rect into an explicit polygon
//  - recrops the viewBox to the badge art (uniform across all 16)
// Output: <mobile>/lib/medalBadges.js  (rendered via react-native-svg's SvgXml)
import { readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

const SRC = 'C:/Users/nisha/Downloads/Honor badges SVG and PNG Formats/SVG Files';
const OUT = 'C:/Users/nisha/dominia/lib/medalBadges.js';
const VIEWBOX = '47 24 206 206';

// Row/column position -> stable medal_key (names/keys are NOT changing).
const FILE_TO_KEY = {
  'First Row 1':  'combat.first_blood',
  'First Row 2':  'combat.conqueror',
  'First Row 3':  'combat.trophy_hunter',
  'First Row 4':  'combat.reclaimer',
  'Second Row 1': 'defense.the_wall',
  'Second Row 2': 'defense.bulwark',
  'Second Row 3': 'defense.guardian',
  'Second Row 4': 'defense.immovable',
  'Third Row 1':  'distance.pathfinder',
  'Third Row 2':  'distance.iron_legs',
  'Third Row 3':  'distance.daily_marcher',
  'Third Row 4':  'distance.war_marcher',
  'Fourth Row 1': 'endurance.unbroken',
  'Fourth Row 2': 'endurance.phoenix',
  'Fourth Row 3': 'endurance.eternal',
  'Fourth Row 4': 'endurance.time_served',
};

const BONE = '#f2eee6';

// Split a chunk of SVG markup into its top-level elements (balanced <g>...</g>).
function topLevelElements(body) {
  const els = [];
  let i = 0;
  const n = body.length;
  while (i < n) {
    if (body[i] !== '<') { i++; continue; }
    // tag name
    const m = /^<\s*([a-zA-Z]+)/.exec(body.slice(i));
    if (!m) { i++; continue; }
    const tag = m[1];
    if (tag === 'g') {
      // find matching </g> with depth tracking
      let depth = 0, j = i;
      const re = /<\s*(\/?)g\b[^>]*>/g;
      re.lastIndex = i;
      let mm;
      while ((mm = re.exec(body))) {
        if (mm[1] === '/') depth--; else depth++;
        if (depth === 0) { j = mm.index + mm[0].length; break; }
      }
      els.push(body.slice(i, j));
      i = j;
    } else {
      // self-contained leaf element: <tag .../> or <tag ...>...</tag>
      const selfClose = body.indexOf('/>', i);
      const open = /^<\s*[a-zA-Z]+[^>]*>/.exec(body.slice(i));
      // these source files use self-closing leaves (rect/polygon/path)
      const end = (selfClose !== -1) ? selfClose + 2 : i + (open ? open[0].length : 1);
      els.push(body.slice(i, end));
      i = end;
    }
  }
  return els.map((s) => s.trim()).filter(Boolean);
}

// Transform a single rect (with optional translate()+rotate() transform) into
// a polygon points string by mapping its four corners.
function rectToPolygon(rectTag) {
  const num = (re) => { const m = re.exec(rectTag); return m ? parseFloat(m[1]) : null; };
  const x = num(/\bx="([-\d.]+)"/), y = num(/\by="([-\d.]+)"/);
  const w = num(/\bwidth="([-\d.]+)"/), h = num(/\bheight="([-\d.]+)"/);
  const corners = [[x, y], [x + w, y], [x + w, y + h], [x, y + h]];
  const tm = /transform="([^"]+)"/.exec(rectTag);
  let pts = corners;
  if (tm) {
    const t = /translate\(\s*([-\d.]+)[ ,]+([-\d.]+)\s*\)/.exec(tm[1]);
    const r = /rotate\(\s*([-\d.]+)\s*\)/.exec(tm[1]);
    const tx = t ? parseFloat(t[1]) : 0, ty = t ? parseFloat(t[2]) : 0;
    const deg = r ? parseFloat(r[1]) : 0;
    const rad = (deg * Math.PI) / 180, c = Math.cos(rad), s = Math.sin(rad);
    // SVG "translate(...) rotate(...)" applies rotate first to the point, then translate.
    pts = corners.map(([px, py]) => [
      round(px * c - py * s + tx),
      round(px * s + py * c + ty),
    ]);
  }
  const fill = /fill="([^"]+)"/.exec(rectTag);
  const points = pts.map((p) => p.join(' ')).join(' ');
  return `<polygon fill="${fill ? fill[1] : BONE}" points="${points}"/>`;
}

function round(v) { return Math.round(v * 100) / 100; }

function clean(raw, key) {
  // 1. style map: .uuid-xxxx { fill: #hex; }
  const styleBlock = /<style>([\s\S]*?)<\/style>/.exec(raw);
  if (!styleBlock) throw new Error(`${key}: no <style> block`);
  const classFill = {};
  for (const m of styleBlock[1].matchAll(/\.([\w-]+)\s*\{\s*fill:\s*(#[0-9a-fA-F]+)\s*;?\s*\}/g)) {
    classFill[m[1]] = m[2].toLowerCase();
  }
  const colors = Object.values(classFill);
  if (colors.length !== 2) throw new Error(`${key}: expected 2 fill classes, got ${colors.length}`);
  if (!colors.includes(BONE)) throw new Error(`${key}: no bone fill (${colors.join(',')})`);

  // 2. body = everything between </defs> and </svg>
  const afterDefs = raw.slice(raw.indexOf('</defs>') + '</defs>'.length);
  const body = afterDefs.slice(0, afterDefs.lastIndexOf('</svg>'));

  // 3. split into top-level elements, inline fills, drop the classless text group
  let dropped = 0;
  const kept = [];
  for (let el of topLevelElements(body)) {
    const hasClass = /class="/.test(el);
    if (!hasClass) { dropped++; continue; } // the baked-in name text group
    // inline fills
    el = el.replace(/class="([\w-]+)"/g, (_, cls) => {
      const fill = classFill[cls];
      if (!fill) throw new Error(`${key}: unknown class ${cls}`);
      return `fill="${fill}"`;
    });
    // rotated/positioned rect -> polygon (keeps SvgXml off transform parsing)
    el = el.replace(/<rect\b[^>]*transform="[^"]*"[^>]*\/>/g, (r) => rectToPolygon(r));
    kept.push(el);
  }
  if (dropped !== 1) throw new Error(`${key}: expected to drop exactly 1 text group, dropped ${dropped}`);
  if (/class="/.test(kept.join(''))) throw new Error(`${key}: residual class= after inlining`);
  if (!/fill="/.test(kept.join(''))) throw new Error(`${key}: no fills in output`);

  const inner = kept.join('').replace(/\s+/g, ' ').replace(/>\s+</g, '><').trim();
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="${VIEWBOX}">${inner}</svg>`;
}

const entries = [];
for (const [name, key] of Object.entries(FILE_TO_KEY)) {
  const raw = readFileSync(join(SRC, `${name}.svg`), 'utf8');
  const xml = clean(raw, key);
  entries.push([key, xml]);
  console.log(`ok  ${key.padEnd(24)} <- ${name}.svg  (${xml.length} chars)`);
}

const header = `// AUTO-GENERATED. Do not edit by hand.
// Source: designer "Honor badges" SVGs, cleaned by scripts/gen-medal-badges.mjs:
//   baked-in name text + <defs>/<style> stripped, fill colours inlined,
//   viewBox recropped to the badge art. Display names/keys are unchanged and
//   come from lib/legacyMedals.js. Rendered via react-native-svg's <SvgXml>.

export const MEDAL_BADGE_SVG = {
${entries.map(([k, v]) => `  '${k}': ${JSON.stringify(v)},`).join('\n')}
};
`;

writeFileSync(OUT, header, 'utf8');
console.log(`\nwrote ${OUT} (${entries.length} badges)`);
