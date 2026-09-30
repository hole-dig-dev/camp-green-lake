// The buried town's layout (public/sim.js townLayout): for the fixed TOWN_SEED and 400 other seeds, every building is reachable from Main
// Street, no two tunnels cross or run too close (their walls would block each other), and no tunnel passes through a
// building or Main Street. Run: node tests/town-layout.mjs
import { createRequire } from 'module';
const SIM = createRequire(import.meta.url)('../public/sim.js');
const T = SIM.TOWN, R = T.TUN_R, bad = [];
const segDist = (p, a, b) => { const dx = b[0] - a[0], dz = b[1] - a[1], L = dx * dx + dz * dz; let t = L ? ((p[0] - a[0]) * dx + (p[1] - a[1]) * dz) / L : 0; t = Math.max(0, Math.min(1, t)); return Math.hypot(p[0] - a[0] - t * dx, p[1] - a[1] - t * dz); };
const segSeg = (a, b, c, d) => { let m = Infinity; for (let k = 0; k <= 20; k++) { const f = k / 20; m = Math.min(m, segDist([a[0] + (b[0] - a[0]) * f, a[1] + (b[1] - a[1]) * f], c, d), segDist([c[0] + (d[0] - c[0]) * f, c[1] + (d[1] - c[1]) * f], a, b)); } return m; };
const rectOf = b => { const q = Math.abs(Math.sin(b.ry)) > 0.5, w = q ? b.D : b.W, d = q ? b.W : b.D; return { x0: b.x - w / 2, x1: b.x + w / 2, z0: b.z - d / 2, z1: b.z + d / 2 }; };
const inRect = (p, r, m) => p[0] > r.x0 - m && p[0] < r.x1 + m && p[1] > r.z0 - m && p[1] < r.z1 + m;
for (let day = 0; day <= 400; day++) {
  const L = day ? SIM.townLayout(1, day) : SIM.townLayout(1), rects = L.bldgs.map(rectOf);
  // reachability: Main Street joins the six fronts; each tunnel joins the buildings whose doors it ends at (or the street)
  const adj = new Map([['street', new Set()]]), link = (a, b) => { for (const [p, q] of [[a, b], [b, a]]) { if (!adj.has(p)) adj.set(p, new Set()); adj.get(p).add(q); } };
  for (const b of L.bldgs) if (b.main) link('street', b.i);
  for (const t of L.tunnels) { const ends = L.bldgs.filter(b => Object.values(b.doors).includes('t' + t.id)).map(b => b.i); link(ends[0], ends.length > 1 ? ends[1] : 'street'); }
  const seen = new Set(['street']), q = ['street'];
  while (q.length) for (const n of adj.get(q.shift()) || []) if (!seen.has(n)) { seen.add(n); q.push(n); }
  if (seen.size !== L.bldgs.length + 1) bad.push(`seed ${day || 'fixed'}: only ${seen.size - 1}/${L.bldgs.length} buildings reachable`);
  for (const t of L.tunnels) {
    const P = t.pts;
    for (let s = 1; s < P.length - 2; s++) {   // the middle of the tunnel (not the two stubs through its own doors)
      for (let k = 0; k <= 10; k++) { const f = k / 10, p = [P[s][0] + (P[s + 1][0] - P[s][0]) * f, P[s][1] + (P[s + 1][1] - P[s][1]) * f];
        rects.forEach((r, i) => { if (inRect(p, r, R - 0.2)) bad.push(`seed ${day || 'fixed'}: tunnel ${t.id} (edge ${t.edge}) runs into ${L.bldgs[i].spot}`); });
        const S = T.STREET; if (p[0] > S.x0 && p[0] < S.x1 - 0.5 && p[1] > S.z0 - R && p[1] < S.z1 + R) bad.push(`seed ${day || 'fixed'}: tunnel ${t.id} runs into Main Street`); }
    }
    for (const u of L.tunnels) if (u.id > t.id) for (let s = 1; s < t.pts.length - 2; s++) for (let v = 1; v < u.pts.length - 2; v++) {
      const d = segSeg(t.pts[s], t.pts[s + 1], u.pts[v], u.pts[v + 1]); if (d < 2 * R + 0.6) bad.push(`seed ${day || 'fixed'}: tunnels ${t.edge} and ${u.edge} come within ${d.toFixed(1)} m`);
    }
  }
}
const uniq = [...new Set(bad.map(s => s.replace(/seed \w+: /, '')))];
console.log(bad.length ? `FAIL ${bad.length} problems, ${uniq.length} kinds:\n` + uniq.slice(0, 20).join('\n') : 'PASS town layout: the fixed seed + 400 others, all reachable, no tunnel clashes');
process.exit(bad.length ? 1 : 0);
