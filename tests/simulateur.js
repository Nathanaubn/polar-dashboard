// Simulateur des services Google (Sheets en mémoire, UrlFetch avec une fausse API Polar) pour exécuter majQuotidienne en local.
const fs = require('fs'), vm = require('vm'), path = require('path');

function formatDate(date, tz, fmt) {
  const p = {};
  new Intl.DateTimeFormat('en-GB', { timeZone: tz, year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit',
    minute: '2-digit', second: '2-digit', weekday: 'short', hourCycle: 'h23' }).formatToParts(date).forEach(x => { p[x.type] = x.value; });
  const u = { Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6, Sun: 7 }[p.weekday];
  return fmt.replace(/'([^']*)'/g, '\u0001$1\u0001').split('\u0001').map((seg, k) => k % 2 ? seg : seg
    .replace('yyyy', p.year).replace('MM', p.month).replace('dd', p.day).replace('HH', p.hour).replace('mm', p.minute)
    .replace('ss', p.second).replace(/\bu\b/, String(u)).replace(/\bH\b/, String(+p.hour))).join('');
}

class Feuille {
  constructor(nom) { this.nom = nom; this.cells = []; this.maxCol = 26; }
  getLastRow() { return this.cells.length; }
  getMaxColumns() { return this.maxCol; }
  insertColumnsAfter(c, n) { this.maxCol += n; }
  setFrozenRows() {}
  appendRow(r) { this.cells.push(r.slice()); }
  getRange(r, c, nr = 1, nc = 1) {
    const f = this;
    if (c + nc - 1 > f.maxCol) throw new Error(`Plage hors de la feuille ${f.nom} : colonne ${c + nc - 1} > ${f.maxCol}`);
    const rg = {
      getValues: () => Array.from({ length: nr }, (_, i) => Array.from({ length: nc }, (_, j) => {
        const v = (f.cells[r - 1 + i] || [])[c - 1 + j]; return v === undefined ? '' : v; })),
      setValues: v => {
        if (v.length !== nr || v.some(x => x.length !== nc)) throw new Error('setValues : dimensions incorrectes');
        v.forEach((row, i) => { const t = f.cells[r - 1 + i] = f.cells[r - 1 + i] || [];
          row.forEach((x, j) => { // Sheets convertit "'texte" en texte et les nombres restent des nombres
            t[c - 1 + j] = typeof x === 'string' && x[0] === "'" ? x.slice(1) : x; }); });
        return rg; },
      clearContent: () => { for (let i = 0; i < nr; i++) for (let j = 0; j < nc; j++) if (f.cells[r - 1 + i]) f.cells[r - 1 + i][c - 1 + j] = ''; return rg; },
      setBackground: () => rg, setBackgrounds: () => rg, setFontWeight: () => rg,
    };
    return rg;
  }
}

/** Fausse API Polar sur `jours` jours se terminant aujourd'hui. Profil : 25 ans, homme. */
function fausseApi(aujourdhui, jours, opts = {}) {
  const r = (s => () => { s = (s * 16807) % 2147483647; return s / 2147483647; })(42);
  const d0 = Date.parse(aujourdhui + 'T00:00:00Z') / 864e5;
  const date = k => new Date((d0 - k) * 864e5).toISOString().slice(0, 10);
  const hm = m => String(Math.floor(((m % 1440) + 1440) % 1440 / 60)).padStart(2, '0') + ':' + String(((m % 60) + 60) % 60).padStart(2, '0');
  const nights = [], recharges = [], activities = [], exercises = [], fc = {};
  for (let k = jours - 1; k >= 0; k--) {
    const d = date(k), veille = date(k + 1);
    if (!(opts.trous || []).includes(k)) {
      const deb = 23 * 60 + 20 + Math.round(r() * 60 - 30), dur = 400 + Math.round(r() * 70);
      const debIso = (deb >= 1440 ? d : veille) + 'T' + hm(deb) + ':00.000+01:00';
      const fin = deb + dur, finIso = d + 'T' + hm(fin) + ':00.000+01:00';
      const hyp = {}; for (let m = 0; m < dur; m += 30) hyp[hm(deb + m)] = m === 180 ? 0 : [2, 4, 2, 1][(m / 30) % 4];
      const hrS = {}; for (let m = 0; m < dur; m += 10) hrS[hm(deb + m)] = 50 + Math.round(r() * 8);
      nights.push({ date: d, sleep_start_time: debIso, sleep_end_time: finIso, light_sleep: 0.55 * dur * 60, deep_sleep: 0.18 * dur * 60,
        rem_sleep: 0.2 * dur * 60, unrecognized_sleep_stage: 0, total_interruption_duration: 0.07 * dur * 60, continuity: 3.2,
        continuity_class: 3, sleep_cycles: 5, sleep_score: 70 + Math.round(r() * 15), sleep_goal: 480 * 60, hypnogram: hyp, heart_rate_samples: hrS });
      recharges.push({ date: d, heart_rate_variability_avg: 55 + Math.round(r() * 15), heart_rate_avg: 52 + Math.round(r() * 5),
        breathing_rate_avg: 14 + r(), nightly_recharge_status: 4, ans_charge: r() * 4 - 2, beat_to_beat_avg: 1100,
        hrv_samples: { '01:00': 60, '03:00': 65 }, breathing_samples: { '01:00': 14.2, '03:00': 14.6 } });
    }
    const partiel = (opts.partiels || []).includes(k);
    const pas = partiel ? 400 : 7000 + Math.round(r() * 4000);
    const samples = []; for (let h = 8; h < 20; h++) samples.push({ timestamp: d + 'T' + hm(h * 60) + ':00.000', steps: Math.round(pas / 12) });
    activities.push({ start_time: d + 'T00:00:00', steps: pas, active_calories: 400, samples: { steps: { interval_ms: 60000, samples: samples } } });
    const ech = [];
    for (let m = 0; m < 1440; m += 5) {
      if (partiel && m > 7 * 60 && m < 22 * 60) continue;               // montre portée la nuit seulement
      if (!partiel && m >= 18 * 60 && m < 18 * 60 + 40) {               // 40 min d'activité soutenue, mesures chaque seconde
        for (let s = 0; s < 300; s += 30) ech.push({ heart_rate: 140 + Math.round(r() * 20), sample_time: hm(m) + ':' + String(s % 60).padStart(2, '0') });
        continue;
      }
      ech.push({ heart_rate: 62 + Math.round(r() * 12), sample_time: hm(m) + ':00' });
    }
    fc[d] = { heart_rate_samples: ech };
    if (k % 4 === 1) exercises.push({ start_time: d + 'T07:00:00', duration: 'PT35M', sport: 'STRENGTH_TRAINING', heart_rate: { average: 118 } });
    if (k % 3 === 0) exercises.push({ start_time: d + 'T12:30:00', duration: 'PT45M', sport: 'RUNNING', heart_rate: { average: 158 } });
  }
  const profil = Object.assign({ vo2_max: 47, modified: date(20) + 'T10:00:00.000Z', resting_heart_rate: 55, maximum_heart_rate: 195 }, opts.profil || {});
  return (url) => {
    const p = url.replace('https://www.polaraccesslink.com/v3', '');
    if (p === '/users/nightly-recharge') return { recharges };
    if (p === '/users/sleep') return { nights };
    if (p === '/users/cardio-load') return [];
    if (p.startsWith('/users/activities')) return activities;
    if (p === '/exercises') return exercises;
    if (p === '/users/physical-info') return profil;
    if (p.startsWith('/users/continuous-heart-rate/')) return fc[p.split('/').pop()] || null;
    if (/^\/users\/\d+$/.test(p)) return { 'polar-user-id': 1, 'first-name': 'NE PAS LIRE', birthdate: '2001-05-14', gender: 'MALE' };
    return null;
  };
}

function simuler({ maintenant, api, props = {} }) {
  const store = Object.assign({ ACCESS_TOKEN: 'factice', DASH_KEY: 'cle', USER_ID: '1', SHEET_ID: 'x' }, props);
  const feuilles = {};
  const classeur = { getId: () => 'x', getSheetByName: n => feuilles[n] || null, insertSheet: n => (feuilles[n] = new Feuille(n)) };
  const reponse = url => { let o; try { o = api(url); } catch (e) { return { getResponseCode: () => 403, getContentText: () => e.message }; } return { getResponseCode: () => (o === null ? 204 : 200), getContentText: () => (o === null ? '' : JSON.stringify(o)) }; };
  const FakeDate = class extends Date { constructor(...a) { if (a.length) super(...a); else super(maintenant); } static now() { return Date.parse(maintenant); } };
  const ctx = {
    console, Math, JSON, Date: FakeDate, Intl,
    PropertiesService: { getScriptProperties: () => ({ getProperty: k => (k in store ? store[k] : null), setProperty: (k, v) => { store[k] = String(v); } }) },
    SpreadsheetApp: { getActiveSpreadsheet: () => classeur, openById: () => classeur },
    Session: { getScriptTimeZone: () => 'Europe/Paris' },
    Utilities: { formatDate, getUuid: () => '0000', base64Encode: s => Buffer.from(s).toString('base64') },
    UrlFetchApp: { fetch: u => reponse(u), fetchAll: reqs => reqs.map(q => reponse(q.url)) },
    Logger: { log: () => {} },
  };
  vm.createContext(ctx);
  vm.runInContext(fs.readFileSync(path.join(__dirname, '..', 'src', 'Code.js'), 'utf8') + '\n;this.CFG = CFG; this.ENTETES = ENTETES; this.ENTETES_LONGEVITE = ENTETES_LONGEVITE;', ctx);
  ctx.__store = store; ctx.__feuilles = feuilles;
  return ctx;
}
module.exports = { simuler, fausseApi, formatDate };
