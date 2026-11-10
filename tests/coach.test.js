// Tests du coach de sommeil : node tests/coach.test.js
const assert = require('assert');
const G = require('./charger')({ DASH_KEY: 'cle-de-test' });
let ok = 0;
const t = (nom, f) => { f(); ok++; console.log('✓ ' + nom); };

t('Exemple chiffré : besoin 512 min (8 h 32)', () => {
  const b = G.besoinTotal_(465, 12, [60, 30, 0], 50);
  assert.deepStrictEqual({ ...b }, { base: 465, strain: 8, dette: 39, ajust: 0, besoin: 512 });
  assert.strictEqual(G.hm_(b.besoin), '8 h 32');
});
t('Exemple chiffré : couchers 21:46 / 23:11 / 00:37 pour un réveil à 07:30', () => {
  const p = G.planSoir_(512, 0.90, G.minutesHeure_('07:30'));
  assert.strictEqual(p.optimal.heure, '21:46');
  assert.strictEqual(p.solide.heure, '23:11');
  assert.strictEqual(p.minimum.heure, '00:37');
});
t('Dette : poids renormalisés sur les nuits présentes, plafond 90', () => {
  assert.strictEqual(G.detteSommeil_([60, 30, null]), (0.5 * 60 + 0.3 * 30) / 0.8);
  assert.strictEqual(G.detteSommeil_([null, null, null]), 0);
  assert.strictEqual(G.detteSommeil_([300, 300, 300]), 60);
});
t('Strain : 4 min/point au-dessus de 10, plafond 45 ; récupération ≤ 33 : +15', () => {
  assert.strictEqual(G.besoinTotal_(480, 9, [], null).strain, 0);
  assert.strictEqual(G.besoinTotal_(480, 25, [], null).strain, 45);
  assert.strictEqual(G.besoinTotal_(480, null, [], 33).ajust, 15);
  assert.strictEqual(G.besoinTotal_(480, null, [], 34).ajust, 0);
});
t('Bornes : base 420–540, total ≤ 600 (parts cohérentes)', () => {
  assert.strictEqual(G.besoinTotal_(300, null, [], null).base, 420);
  const b = G.besoinTotal_(540, 25, [300, 300, 300], 10); // 540 + 45 + 60 + 15 = 660 → 600
  assert.strictEqual(b.besoin, 600);
  assert.strictEqual(b.base + b.strain + b.dette + b.ajust, 600);
});
t('Efficacité : médiane bornée 0,80–0,98, 0,90 par défaut', () => {
  assert.strictEqual(G.efficacite_([]), 0.9);
  assert.strictEqual(G.efficacite_([0.5, 0.6, 0.7]), 0.8);
  assert.strictEqual(G.efficacite_([0.99, 1, 1]), 0.98);
  assert.strictEqual(G.efficacite_([0.85, 0.9, 0.95]), 0.9);
});
t('Performance plafonnée à 100 %', () => {
  assert.strictEqual(G.performanceSommeil_(400, 500), 80);
  assert.strictEqual(G.performanceSommeil_(600, 500), 100);
  assert.strictEqual(G.performanceSommeil_(null, 500), null);
});
t('Régularité : moyenne circulaire autour de minuit', () => {
  // endormissements 23:50 et 00:10 → écart 10 min ; réveils identiques → 0
  const r = G.regularite_([[23 * 60 + 50, 450], [10, 450]]);
  assert.strictEqual(r.ecartCoucher, 10);
  assert.strictEqual(r.ecartReveil, 0);
  assert.strictEqual(r.score, Math.round(100 * (1 - 10 / 120)));
  assert.strictEqual(G.regularite_([[0, 450]]).score, null);
  assert.strictEqual(G.regularite_([[0, 0], [720, 720]]).score, 0);
});
t('Base : médiane des nuits suivies d\'une récup ≥ 67 (≥ 5), sinon objectif Polar, sinon 480', () => {
  const j = {};
  const nuit = (d, reel, rec) => { j[d] = { reel, rec, debut: d + 'T00:00:00', fin: d + 'T08:00:00', objectif: 510 }; };
  ['01', '02', '03', '04'].forEach((x, k) => nuit('2026-11-' + x, 440 + 10 * k, 70));
  let h = G.historiqueCoach_(j);
  assert.strictEqual(h['2026-11-04'].base, 510);
  assert.strictEqual(h['2026-11-04'].source, 'objectif');
  nuit('2026-11-05', 500, 80);
  h = G.historiqueCoach_(j);
  assert.strictEqual(h['2026-11-05'].base, 460); // médiane de 440, 450, 460, 470, 500
  assert.strictEqual(h['2026-11-05'].source, 'nuits');
  assert.strictEqual(G.historiqueCoach_({ '2026-11-01': { rec: 50 } })['2026-11-01'].base, 480);
});
t('Contrôle : base 480, nuits 291,5 / 342 / 342,5 → déficits 188,5 / 138 / 137,5, dette 163,2 ramenée à 60', () => {
  const j = {};
  const nuit = (d, reel) => { j[d] = { reel, rec: 50, objectif: 480, debut: d + 'T00:00:00', fin: d + 'T08:00:00' }; };
  nuit('2026-11-05', 480); nuit('2026-11-06', 342.5); nuit('2026-11-07', 342); nuit('2026-11-08', 291.5);
  const c = G.historiqueCoach_(j)['2026-11-08'];
  assert.deepStrictEqual([...c.deficits], [188.5, 138, 137.5]);
  assert.ok(Math.abs(0.5 * 188.5 + 0.3 * 138 + 0.2 * 137.5 - 163.2) < 0.05);
  assert.strictEqual(c.dette, 60);
  assert.strictEqual(c.besoin, 480 + 60);
});
t('Plus de boucle : des nuits courtes répétées ne font pas grimper la dette au-delà de la base', () => {
  const j = {};
  for (let k = 0; k < 14; k++) { const d = G.dateDe_(G.jour_('2026-10-20') + k); j[d] = { reel: 450, rec: 50, objectif: 480, debut: d + 'T00:00:00', fin: d + 'T08:00:00' }; }
  const h = G.historiqueCoach_(j);
  assert.strictEqual(h['2026-11-02'].dette, 30);    // 480 − 450, stable, au lieu de croître nuit après nuit
  assert.strictEqual(h['2026-11-02'].besoin, 510);
});
t('Dette : déficit = besoin de base calculé la veille − sommeil réel', () => {
  const j = {
    '2026-11-01': { reel: 480, rec: 50, objectif: 480, debut: '2026-11-01T00:00:00', fin: '2026-11-01T08:00:00' },
    '2026-11-02': { reel: 420, rec: 50, debut: '2026-11-02T00:00:00', fin: '2026-11-02T08:00:00' },
  };
  const h = G.historiqueCoach_(j);
  // la nuit du 1er n'a pas de besoin calculé la veille (31 octobre absent) : elle ne compte pas
  assert.deepStrictEqual([...h['2026-11-02'].deficits], [60, null, null]);
  assert.strictEqual(h['2026-11-02'].dette, 60);
  assert.strictEqual(h['2026-11-02'].perf, Math.round(100 * 420 / 480));
});
t('Coucher : passage de minuit et réveil du lendemain selon le jour de la semaine', () => {
  assert.strictEqual(G.hhmm_(G.coucher_(480, 1, 0.9, 420)), '21:52');
  const rev = ['06:00', '07:30', '07:30', '07:30', '07:30', '09:00', '09:00'];
  const c = G.coachDuSoir_({}, '2026-11-08', rev, null); // dimanche soir → réveil lundi
  assert.strictEqual(c.reveil, '06:00');
  assert.strictEqual(G.coachDuSoir_({}, '2026-11-13', rev, null).reveil, '09:00'); // vendredi → samedi
});
t('Conseil : coucher Optimal passé, puis Solide passé', () => {
  const c = G.coachDuSoir_({}, '2026-11-09', new Array(7).fill('07:30'), null);
  const opt = c.plan.optimal.minutes, sol = c.plan.solide.minutes;
  assert.match(G.conseilSoir_(c, opt + 5), /Optimal est passé/);
  assert.match(G.conseilSoir_(c, (sol + 5) % 1440), /Solide est passé/);
  assert.match(G.conseilSoir_(c, 20 * 60), /Rien à signaler/);
  assert.ok(G.conseilSoir_({ ...c, rec: 20, dette: 60 }, null).includes('Récupération basse'));
});
t('enregistrerReveil : clé vérifiée, format HH:MM validé, stockage JSON', () => {
  assert.throws(() => G.enregistrerReveil('mauvaise', new Array(7).fill('07:30')), /Accès refusé/);
  assert.throws(() => G.enregistrerReveil('cle-de-test', new Array(7).fill('7:30')), /Format/);
  assert.throws(() => G.enregistrerReveil('cle-de-test', new Array(6).fill('07:30')), /Format/);
  assert.throws(() => G.enregistrerReveil('cle-de-test', new Array(7).fill('24:00')), /Format/);
  G.classeur_ = () => ({ getSheetByName: () => null }); // pas de Sheet en local
  const v = ['06:45', '07:30', '07:30', '07:30', '07:30', '09:00', '09:30'];
  const res = G.enregistrerReveil('cle-de-test', v);
  assert.deepStrictEqual([...res.reveils], v);
  assert.strictEqual(G.__store.REVEIL_SEMAINE, JSON.stringify(v));
  assert.deepStrictEqual([...G.lireReveils_()], v);
  G.__store.REVEIL_SEMAINE = 'n\'importe quoi';
  assert.deepStrictEqual([...G.lireReveils_()], new Array(7).fill('07:30'));
});
t('remplirCoach_ : colonnes AA→AE sans toucher aux colonnes existantes', () => {
  const ld = { '2026-11-02': new Array(31).fill(''), '2026-11-03': new Array(31).fill('') };
  ld['2026-11-02'][0] = '2026-11-02'; ld['2026-11-03'][0] = '2026-11-03';
  ld['2026-11-03'][11] = 20; ld['2026-11-03'][15] = 1; ld['2026-11-03'][17] = 'note';
  const ls = { '2026-11-03': ['2026-11-03', "'2026-11-03T00:30:00", "'2026-11-03T07:30:00", 250, 60, 90] };
  G.remplirCoach_(ld, ls);
  const l = ld['2026-11-03'];
  assert.strictEqual(l[15], 1); assert.strictEqual(l[17], 'note');
  // nuit du 3 : 400 min réelles pour une base de 480 la veille → déficit 80, dette plafonnée à 60
  assert.strictEqual(l[27], 60);
  assert.strictEqual(l[26], 480 + 60 + 15);          // défaut 480 + dette + récupération basse
  assert.strictEqual(l[28], 83);                     // 400 / 480
  assert.strictEqual(l[30], 0.95);                   // 400 / 420 min au lit
  assert.strictEqual(ld['2026-11-02'][26], 480);
});
t('jourReveil_ : dimanche soir → lundi (0), samedi soir → dimanche (6)', () => {
  assert.strictEqual(G.jourReveil_('2026-11-08'), 0);
  assert.strictEqual(G.jourReveil_('2026-11-14'), 6);
});
console.log(`\n${ok} tests réussis`);
