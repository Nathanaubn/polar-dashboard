// Génère apercu.html : le dashboard rempli avec des données FICTIVES (simulateur), à ouvrir dans un navigateur.
// Usage : npm run apercu   (option : node outils/apercu.js calibration  → onglet Longévité en calibration)
const fs = require('fs'), path = require('path');
const { simuler, fausseApi } = require('../tests/simulateur');

const maintenant = '2026-11-09T17:30:00Z', jour = maintenant.slice(0, 10);
const G = simuler({ maintenant, api: fausseApi(jour, 60, { trous: [3, 9], partiels: [5, 12] }) });
G.majQuotidienne();
const data = JSON.parse(JSON.stringify(G.donneesDashboard_()));
const sommeil = {};
data.slice(-10).forEach(r => { sommeil[r.d] = JSON.parse(JSON.stringify(G.detailSommeil('cle', r.d))); });
const lg = JSON.parse(JSON.stringify(G.detailLongevite('cle')));
const C = simuler({ maintenant, api: fausseApi(jour, 16) });
C.majQuotidienne();
const lgCal = JSON.parse(JSON.stringify(C.detailLongevite('cle')));

const demo = `<script>
window.DEMO_DATA = ${JSON.stringify(data)};
const _S = ${JSON.stringify(sommeil)}, _LG = ${JSON.stringify(lg)}, _LGC = ${JSON.stringify(lgCal)};
window.DEMO_SOMMEIL = d => _S[d] || { d: d, vide: true, historique: [], coach: _S[Object.keys(_S).pop()].coach };
window.DEMO_LONGEVITE = () => location.hash === '#calibration' ? _LGC : _LG;
window.DEMO_REVEIL = v => ({ reveils: v, data: window.DEMO_DATA });
</script>
`;
const html = fs.readFileSync(path.join(__dirname, '..', 'src', 'Dashboard.html'), 'utf8')
  .replace('<script>\nlet DATA', demo + '<script>\nlet DATA')
  .replace('<?!= data ?>', 'window.DEMO_DATA').replace('<?!= cle ?>', '"demo"');
const sortie = path.join(__dirname, '..', 'apercu.html');
fs.writeFileSync(sortie, html);
console.log('Aperçu écrit : ' + sortie);
