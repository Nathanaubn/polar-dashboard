// Tests du module Longévité : node tests/longevite.test.js
const assert = require('assert');
const G = require('./charger')({ DASH_KEY: 'cle-de-test' });
const L = G.CFG.LONGEVITE;
let ok = 0;
const t = (nom, f) => { f(); ok++; console.log('✓ ' + nom); };
const proche = (a, b, tol, msg) => assert.ok(Math.abs(a - b) <= tol, `${msg || ''} ${a} ≠ ${b} (±${tol})`);
const ln = Math.log;

t('Gompertz : HR 0,90 → Δ = −1,22 an', () => proche(G.deltaGompertz_(ln(0.90)), -1.22, 0.005));
t('VO2max : 50 contre 48 (homme 20–29 ans) → ln HR −0,0796, Δ −0,92 an', () => {
  assert.strictEqual(G.refVo2_(25, 'H'), 48.0);
  const l = G.lnHrVo2_(50, 48);
  proche(l, -0.0796, 0.00005); proche(G.deltaGompertz_(l), -0.92, 0.005);
});
t('VO2max : écart borné à ±3 MET, références FRIEND par âge et sexe', () => {
  proche(G.lnHrVo2_(80, 48), 3 * ln(0.87), 1e-12);
  assert.strictEqual(G.refVo2_(45, 'F'), 26.7);
  assert.strictEqual(G.refVo2_(70, 'H'), 32.6); // au-delà de 59 ans : dernière tranche
  assert.strictEqual(G.refVo2_(18, 'H'), 48.0);
});
t('Pas : 9 040 contre 6 800 → ln HR relatif −0,106, Δ −1,22 an (avant recouvrement)', () => {
  const l = G.lnHrCourbe_(L.PAS.POINTS, 9040) - G.lnHrCourbe_(L.PAS.POINTS, 6800);
  proche(l, -0.106, 0.0005); proche(G.deltaGompertz_(l), -1.22, 0.005);
});
t('Sommeil : 5,97 h mesurées = 6,78 h déclarées → Δ +0,15 an', () => {
  proche(G.sommeilDeclare_(5.97), 6.78, 0.005);
  proche(G.deltaGompertz_(G.lnHrSommeil_(5.97)), 0.15, 0.005);
});
t('SRI 78,9 → HR 0,90, Δ −1,22 an', () => {
  const l = G.lnHrCourbe_(L.SRI.POINTS, 78.9) - G.lnHrCourbe_(L.SRI.POINTS, 60);
  proche(Math.exp(l), 0.90, 1e-9); proche(G.deltaGompertz_(l), -1.22, 0.005);
});
t('SRI 63,9 → Δ ≈ −0,32 an', () => {
  proche(G.deltaGompertz_(G.lnHrCourbe_(L.SRI.POINTS, 63.9) - G.lnHrCourbe_(L.SRI.POINTS, 60)), -0.32, 0.005);
});
t('Interpolation : aucune extrapolation hors des points extrêmes, sur toutes les courbes', () => {
  [L.PAS.POINTS, L.MVPA.POINTS, L.RENFO.POINTS, L.SRI.POINTS].forEach(P => {
    const n = P.length - 1;
    proche(G.lnHrCourbe_(P, P[0][0] - 1e6), ln(P[0][1]), 1e-12, 'bas');
    proche(G.lnHrCourbe_(P, P[n][0] + 1e6), ln(P[n][1]), 1e-12, 'haut');
    P.forEach(p => proche(G.lnHrCourbe_(P, p[0]), ln(p[1]), 1e-12, 'point'));
    // entre deux points : ln HR reste entre les deux valeurs
    for (let k = 0; k < n; k++) {
      const m = G.lnHrCourbe_(P, (P[k][0] + P[k + 1][0]) / 2), a = ln(P[k][1]), b = ln(P[k + 1][1]);
      assert.ok(m >= Math.min(a, b) - 1e-12 && m <= Math.max(a, b) + 1e-12);
    }
  });
  proche(G.lnHrCourbe_(L.MVPA.POINTS, 50), ln(0.61), 1e-12); // plateau 22,5–75
  proche(G.lnHrCourbe_(L.RENFO.POINTS, 120), ln(0.85), 1e-12);
});
t('Pas : plateau à 10 000 avant 60 ans', () => {
  const x = { age: 30, pas: 14000 }, y = { age: 30, pas: 10000 };
  proche(G.modeleLongevite_(x).delta, G.modeleLongevite_(y).delta, 1e-12);
  assert.ok(G.modeleLongevite_({ age: 65, pas: 10901 }).delta < G.modeleLongevite_({ age: 65, pas: 10000 }).delta);
});
t('Recouvrement : Activité = moyenne(pas, MVPA) + renfo ; facteur 0,5 sur Activité et FC si VO2max connue', () => {
  const x = { age: 25, sexe: 'H', pas: 9040, mvpa: 30, renfo: 45, fc: 75 };
  const r = G.modeleLongevite_(x);
  proche(r.contributions.pas, G.deltaGompertz_(r.lnHr.pas / 2), 1e-12);
  proche(r.contributions.renfo, G.deltaGompertz_(r.lnHr.renfo), 1e-12);
  proche(r.contributions.fc, G.deltaGompertz_(r.lnHr.fc), 1e-12);
  const r2 = G.modeleLongevite_(Object.assign({ vo2: 48 }, x));
  proche(r2.contributions.pas, G.deltaGompertz_(0.5 * r2.lnHr.pas / 2), 1e-12);
  proche(r2.contributions.fc, G.deltaGompertz_(0.5 * r2.lnHr.fc), 1e-12);
  proche(r2.contributions.sommeil || 0, 0, 0);
  const somme = Object.values(r2.contributions).reduce((s, v) => s + v, 0);
  proche(r2.delta, somme, 1e-12);
});
t('Δ borné à ±10 ans', () => {
  const r = G.modeleLongevite_({ age: 25, sexe: 'H', vo2: 10, fc: 140, pas: 0, mvpa: 0, sommeil: 3, sri: 0 });
  assert.strictEqual(r.delta, 10);
});
t('Monte Carlo : graine fixe (résultat identique), P10 ≤ P50 ≤ P90, centré près du calcul central', () => {
  const x = { age: 25, sexe: 'H', vo2: 50, fc: 62, pas: 9040, mvpa: 20, renfo: 0, sommeil: 6.5, sri: 70 };
  const a = G.monteCarloLongevite_(x), b = G.monteCarloLongevite_(x);
  assert.deepStrictEqual({ ...a }, { ...b });
  assert.ok(a.p10 <= a.p50 && a.p50 <= a.p90 && a.p90 - a.p10 > 0.1);
  proche(a.p50, G.modeleLongevite_(x).delta, 1.0);
});
t('Rythme : écart lissé qui baisse de 0,1 an en 30 jours → −0,22 ; stable → 1,0 ; bornes', () => {
  const serie = k => Array.from({ length: 31 }, (_, j) => [G.dateDe_(G.jour_('2026-10-10') + j), k * j / 30]);
  assert.strictEqual(G.rythme_(serie(-0.1), '2026-11-09'), -0.22);
  assert.strictEqual(G.rythme_(serie(0), '2026-11-09'), 1);
  assert.strictEqual(G.rythme_(serie(-5), '2026-11-09'), -1);
  assert.strictEqual(G.rythme_(serie(0).slice(0, 3), '2026-11-09'), null);
});
t('Lissage : moyenne mobile exponentielle à demi-vie de 60 jours', () => {
  const rows = [['2026-01-01'], ['2026-03-02']].map(r => { const l = new Array(40).fill(''); l[0] = r[0]; return l; });
  rows[0][36] = 0; rows[1][36] = 2; // 60 jours plus tard : la moitié du chemin
  G.lisserLongevite_(rows);
  assert.strictEqual(rows[1][37], 1);
});

// --- SRI et qualité des données ---
const nuitL = (d, deb, fin, hyp) => { const l = new Array(31).fill(''); l[0] = d; l[1] = "'" + deb; l[2] = "'" + fin; l[3] = 300; l[4] = 60; l[5] = 90; l[27] = hyp ? JSON.stringify(hyp) : ''; return l; };
const veille = d => G.dateDe_(G.jour_(d) - 1);
t('SRI : horaires identiques → 100 ; nuit décalée → plus bas ; éveil nocturne compté comme éveil', () => {
  const ls = {};
  for (let k = 0; k < 20; k++) { const d = G.dateDe_(G.jour_('2026-10-15') + k); ls[d] = nuitL(d, veille(d) + 'T23:00:00', d + 'T07:00:00'); }
  const r = G.sri_(ls, '2026-11-03');
  assert.strictEqual(r.sri, 100);
  ls['2026-10-25'] = nuitL('2026-10-25', '2026-10-25T02:00:00', '2026-10-25T10:00:00');
  const r2 = G.sri_(ls, '2026-11-03');
  assert.ok(r2.sri < 100);
  // éveil de 3 h à 4 h une nuit : ces minutes diffèrent des nuits voisines
  ls['2026-10-25'] = nuitL('2026-10-25', '2026-10-24T23:00:00', '2026-10-25T07:00:00', { '23:00': 2, '03:00': 0, '04:00': 4 });
  const r3 = G.sri_(ls, '2026-11-03');
  // 2 paires touchées × 60 min sur r3.paires × 1440 minutes
  proche(r3.sri, 200 * (1 - 120 / (r3.paires * 1440)) - 100, 0.05);
});
t('SRI : moins de 5 paires de jours connus → indisponible', () => {
  const ls = {};
  ['2026-11-01', '2026-11-02', '2026-11-03'].forEach(d => { ls[d] = nuitL(d, veille(d) + 'T23:00:00', d + 'T07:00:00'); });
  assert.strictEqual(G.sri_(ls, '2026-11-05').sri, null);
});
t('Qualité : calibration sous 21 nuits / 14 jours portés en entier ; jours partiels exclus des pas', () => {
  const ld = {}, ls = {};
  for (let k = 0; k < 31; k++) {
    const d = G.dateDe_(G.jour_('2026-10-10') + k), l = new Array(38).fill('');
    l[0] = d; l[22] = k % 2 ? 9000 : 300; l[31] = k % 2 ? 95 : 30; l[25] = 60; l[32] = 2; l[33] = 0; l[34] = 0;
    ld[d] = l;
    if (k >= 11) ls[d] = nuitL(d, veille(d) + 'T23:00:00', d + 'T07:00:00');
  }
  const e = G.entreesLongevite_(ld, ls, '2026-11-09', { naissance: '2001-01-01', sexe: 'H' });
  assert.strictEqual(e.qualite.nuits, 20); assert.strictEqual(e.qualite.jours, 15);
  assert.strictEqual(e.qualite.ok, false);
  assert.strictEqual(e.x.pas, 9000);         // seuls les jours portés en entier
  proche(e.x.mvpa, 14, 1e-9);               // 2 MET-h/jour × 7
  proche(e.x.sommeil, 7.5, 1e-9);
  ls['2026-10-20'] = nuitL('2026-10-20', '2026-10-19T23:00:00', '2026-10-20T07:00:00');
  assert.strictEqual(G.entreesLongevite_(ld, ls, '2026-11-09', { naissance: '2001-01-01', sexe: 'H' }).qualite.ok, true);
});
t('Séances : MET-h selon la FC moyenne, minutes de renforcement par code sport', () => {
  const s = G.seancesParJour_([
    { start_time: '2026-11-02T18:00:00', duration: 'PT1H', sport: 'RUNNING', heart_rate: { average: 160 } },
    { start_time: '2026-11-02T19:30:00', duration: 'PT45M', sport: 'STRENGTH_TRAINING', heart_rate: { average: 105 } },
    { start_time: '2026-11-03T08:00:00', duration: 'PT30M', sport: 'OTHER', detailed_sport_info: 'CORE' },
  ], 60, 190);
  // course : FCR (160 − 60) / 130 = 0,77 → 8 MET × 1 h ; musculation : FCR 0,35 < 0,40 → 0 MET (minutes de renfo comptées à part)
  proche(s.jours['2026-11-02'].meth, 8, 1e-9);
  proche(s.jours['2026-11-03'].meth, 4 * 0.5, 1e-9);           // séance sans FC : 4 MET (convention)
  assert.strictEqual(s.jours['2026-11-02'].renfo, 45);
  assert.strictEqual(s.jours['2026-11-03'].renfo, 30);
  assert.strictEqual(s.sports['RUNNING'], false);
});
t('Leviers : triés du plus fort au plus faible, uniquement des gains', () => {
  const lv = G.leviersLongevite_({ age: 25, sexe: 'H', vo2: 44, fc: 62, pas: 6000, mvpa: 5, renfo: 0, sommeil: 6, sri: 55 });
  assert.ok(lv.length >= 3);
  lv.forEach((l, k) => { assert.ok(l.ans < 0); if (k) assert.ok(l.ans >= lv[k - 1].ans); });
});
console.log(`\n${ok} tests réussis`);
