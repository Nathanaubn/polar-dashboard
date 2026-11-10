// Charge polar_whoop.gs dans node avec des bouchons pour les services Google (aucun accès réseau ni secret).
const fs = require('fs'), vm = require('vm'), path = require('path');
module.exports = function charger(props = {}) {
  const store = Object.assign({}, props);
  const ctx = {
    PropertiesService: { getScriptProperties: () => ({
      getProperty: k => (k in store ? store[k] : null), setProperty: (k, v) => { store[k] = v; } }) },
    console, Math, Date, JSON,
  };
  vm.createContext(ctx);
  const src = fs.readFileSync(path.join(__dirname, '..', 'src', 'Code.js'), 'utf8');
  vm.runInContext(src + '\n;this.CFG = CFG;', ctx);
  ctx.__store = store;
  return ctx;
};
