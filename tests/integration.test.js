// Exécute majQuotidienne, detailSommeil et detailLongevite avec le simulateur : node tests/integration.test.js
const assert = require('assert');
const { simuler, fausseApi, formatDate } = require('./simulateur');
let ok = 0;
const t = (nom, f) => { f(); ok++; console.log('✓ ' + nom); };

t('formatDate du simulateur (fuseau de Paris)', () => {
  assert.strictEqual(formatDate(new Date('2026-11-09T08:30:00Z'), 'Europe/Paris', "yyyy-MM-dd'T'HH:mm:ss"), '2026-11-09T09:30:00');
  assert.strictEqual(formatDate(new Date('2026-11-09T08:30:00Z'), 'Europe/Paris', 'u'), '1');
});

// Lundi 9 novembre, 9 h 05 à Paris : 35 jours de données, quelques nuits manquantes et jours partiels
const G = simuler({ maintenant: '2026-11-09T08:05:00Z', api: fausseApi('2026-11-09', 35, { trous: [3, 9], partiels: [5, 12] }) });
// Feuille « Données » existante à 26 colonnes, avec une note manuelle à conserver
const sh0 = G.SpreadsheetApp.getActiveSpreadsheet().insertSheet('Données');
sh0.appendRow(G.ENTETES.slice(0, 26));
const ancienne = new Array(26).fill(''); ancienne[0] = '2026-10-20'; ancienne[15] = 1; ancienne[17] = 'note gardée';
sh0.appendRow(ancienne);

G.majQuotidienne();
const F = G.__feuilles;
t('majQuotidienne : colonnes ajoutées, journal manuel conservé', () => {
  assert.strictEqual(F['Données'].getMaxColumns(), G.ENTETES.length);
  assert.strictEqual(JSON.stringify(F['Données'].cells[0]), JSON.stringify(G.ENTETES));
  const l = F['Données'].cells.find(r => r[0] === '2026-10-20');
  assert.strictEqual(l[15], 1); assert.strictEqual(l[17], 'note gardée');
});
t('majQuotidienne : couverture, MVPA, séances, renforcement, VO2max', () => {
  const l = F['Données'].cells.find(r => r[0] === '2026-11-07'); // k = 2
  assert.ok(l[31] >= 95, 'couverture ' + l[31]);
  assert.ok(l[32] > 2 && l[32] < 6, 'MET-h hors séances ' + l[32]); // 40 min ≥ 60 % FCR → 8 MET
  const partiel = F['Données'].cells.find(r => r[0] === '2026-11-04'); // k = 5
  assert.ok(partiel[31] < 80, 'jour partiel ' + partiel[31]);
  const renfo = F['Données'].cells.find(r => r[0] === '2026-11-08'); // k = 1 → renforcement 35 min
  assert.strictEqual(renfo[34], 35);
  assert.strictEqual(l[35], 47);                                     // VO2max valide (test il y a 20 jours)
  const avant = F['Données'].cells.find(r => r[0] === '2026-10-15');
  assert.strictEqual(avant[35], '');                                 // avant la date du test
  assert.ok(JSON.parse(G.__store.SPORTS_VUS).STRENGTH_TRAINING === true);
  const prof = JSON.parse(G.__store.PROFIL_LONGEVITE);
  assert.deepStrictEqual(prof, { naissance: '2001-05-14', sexe: 'H', vo2: 47, vo2Date: '2026-10-20' });
  assert.ok(!JSON.stringify(G.__store.PROFIL_LONGEVITE).includes('NE PAS LIRE'));
});
t('majQuotidienne : écart quotidien et lissé calculés une fois la calibration atteinte', () => {
  const j = F['Données'].cells.find(r => r[0] === '2026-11-09');
  assert.ok(typeof j[36] === 'number' && Math.abs(j[36]) < 10, 'écart ' + j[36]);
  assert.ok(typeof j[37] === 'number');
  const tot = F['Données'].cells.find(r => r[0] === '2026-10-10');
  assert.strictEqual(tot[36], '');                                   // pas encore 21 nuits
});
t('Feuille « Longévité » : publiée (feuille vide), une seule ligne par jour', () => {
  const L = F['Longévité'];
  assert.strictEqual(JSON.stringify(L.cells[0]), JSON.stringify(G.ENTETES_LONGEVITE));
  assert.strictEqual(L.cells.length, 2);
  assert.strictEqual(L.cells[1][0], '2026-11-09');
  assert.strictEqual(L.cells[1].length, G.ENTETES_LONGEVITE.length);
  G.majQuotidienne();
  assert.strictEqual(F['Longévité'].cells.length, 2);
});
t('detailLongevite : clé vérifiée, résultat complet', () => {
  assert.throws(() => G.detailLongevite('mauvaise'), /Accès refusé/);
  const r = G.detailLongevite('cle');
  assert.ok(r.qualite.ok, JSON.stringify(r.qualite));
  assert.ok(r.bas <= r.lisse && r.lisse <= r.haut);
  ['vo2', 'fc', 'pas', 'mvpa', 'renfo', 'sommeil', 'sri'].forEach(k => assert.ok(k in r.contributions, k));
  assert.ok(r.leviers.length >= 1);
  const S = simuler({ maintenant: '2026-11-09T08:05:00Z', api: fausseApi('2026-11-09', 35), props: { DASH_KEY: 'CLE-SECRETE-XYZ' } });
  S.majQuotidienne();
  const rs = JSON.stringify(S.detailLongevite('CLE-SECRETE-XYZ')) + JSON.stringify(S.detailSommeil('CLE-SECRETE-XYZ', '2026-11-09'));
  assert.ok(!rs.includes('CLE-SECRETE') && !rs.includes('factice'));  // ni la clé ni le jeton ne sont renvoyés
});
t('detailSommeil reste fonctionnel', () => {
  const s = G.detailSommeil('cle', '2026-11-09');
  assert.ok(s.coach && s.coach.plan.solide.heure);
});
t('Publication : pas de nouvelle ligne mardi ; nouvelle ligne le lundi suivant à 9 h', () => {
  const mardi = simuler({ maintenant: '2026-11-10T08:05:00Z', api: fausseApi('2026-11-10', 35) });
  mardi.__feuilles['Longévité'] = { };
  // on rejoue avec une feuille déjà remplie
  const A = simuler({ maintenant: '2026-11-09T08:05:00Z', api: fausseApi('2026-11-09', 35) });
  A.majQuotidienne();
  const B = simuler({ maintenant: '2026-11-10T08:05:00Z', api: fausseApi('2026-11-10', 35), props: A.__store });
  Object.assign(B.__feuilles, A.__feuilles);
  B.majQuotidienne();
  assert.strictEqual(B.__feuilles['Longévité'].cells.length, 2);
  const C = simuler({ maintenant: '2026-11-16T07:30:00Z', api: fausseApi('2026-11-16', 35), props: B.__store }); // 8 h 30 : trop tôt
  Object.assign(C.__feuilles, B.__feuilles);
  C.majQuotidienne();
  assert.strictEqual(C.__feuilles['Longévité'].cells.length, 2);
  const D = simuler({ maintenant: '2026-11-16T08:02:00Z', api: fausseApi('2026-11-16', 35), props: C.__store });
  Object.assign(D.__feuilles, C.__feuilles);
  D.majQuotidienne();
  assert.strictEqual(D.__feuilles['Longévité'].cells.length, 3);
});
t('Calibration : peu de nuits → pas d\'écart, compteurs renvoyés', () => {
  const C = simuler({ maintenant: '2026-11-09T17:00:00Z', api: fausseApi('2026-11-09', 15) });
  C.majQuotidienne();
  const r = C.detailLongevite('cle');
  assert.strictEqual(r.qualite.ok, false);
  assert.ok(r.qualite.nuits < 21);
  assert.ok(!('lisse' in r));
});
t('Profil Polar indisponible : majQuotidienne continue, module en attente de profil', () => {
  const base = fausseApi('2026-11-09', 30);
  const api = u => { if (/\/users\/\d+$/.test(u)) throw new Error('HTTP 403'); return base(u); };
  const E = simuler({ maintenant: '2026-11-09T17:00:00Z', api: api });
  E.majQuotidienne();
  const r = E.detailLongevite('cle');
  assert.strictEqual(r.profil.naissance, false);
  assert.ok(E.__feuilles['Données'].cells.length > 20);
});
console.log(`\n${ok} tests réussis`);
