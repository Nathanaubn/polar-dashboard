/**
 * Polar Pacer → tableau de bord façon Whoop
 *   - Récupération 0–100 (vert / jaune / rouge) à partir de la HRV, FC de nuit, respiration et sommeil
 *   - Strain 0–21 à partir de la charge cardio Polar (TRIMP)
 *   - Journal manuel (alcool, repas tardif, notes) pour les corrélations
 *
 * Google Apps Script lié à un Google Sheet. Source : Polar AccessLink API v3.
 * Fonctions à lancer : afficherLienAutorisation (1 fois), majQuotidienne, installerDeclencheurs (1 fois),
 * creerLienDashboard (1 fois, pour obtenir le lien privé du dashboard — fichier HTML « Dashboard »).
 * Pour se reconnecter à Polar : supprimer la propriété ACCESS_TOKEN puis refaire l'autorisation.
 */

const CFG = {
  FEUILLE: 'Données',
  FEUILLE_SOMMEIL: 'Sommeil', // détail de chaque nuit (conservé au-delà des 28 jours de l'API)
  FENETRE_BASELINE_J: 28,    // jours de référence pour moyenne / écart-type personnels
  MIN_NUITS_BASELINE: 7,     // en dessous : "Calibration", pas de score
  POIDS: { hrv: 0.50, fc: 0.25, resp: 0.10, sommeil: 0.15 },
  CHARGE_REF_STRAIN_21: 400, // charge cardio Polar qui correspond à un Strain de 21
  HEURES_MAJ: [9, 13, 21],   // mises à jour auto (heure de Paris)
  // Strain de la journée (FC continue hors séances)
  SEUIL_FCR_STRAIN: 0.30,    // seules les mesures au-dessus de 30 % de la FC de réserve comptent
  // Stress (FC au repos, éveillé, vs ta référence personnelle)
  STRESS_PAS_MAX: 50,        // au-delà de 50 pas sur 5 min, l'élévation de FC est attribuée au mouvement
  STRESS_APRES_SEANCE_MIN: 30, // minutes exclues après une séance (récupération cardiaque)
  STRESS_MIN_FENETRES: 12,   // au moins 1 h de mesures au repos pour afficher un stress du jour
  STRESS_BASE_JOURS: 14,     // référence = médiane des FC d'éveil au repos des 14 jours précédents
  STRESS_BASE_MIN_JOURS: 3,  // en dessous, la référence est celle du jour même
  JOURS_FC_CONTINUE: 7,      // jours de FC continue relus à chaque mise à jour (28 au premier passage)
  // Coach de sommeil. Conventions réglables : Whoop ne publie pas ses coefficients, ces valeurs sont des choix raisonnables.
  COACH: {
    FENETRE_J: 28,           // nuits prises en compte pour le besoin de base
    REC_BONNE: 67,           // récupération à partir de laquelle une nuit est « réussie »
    MIN_NUITS_BONNES: 5,     // nuits réussies nécessaires pour personnaliser le besoin de base
    BESOIN_DEFAUT: 480,      // à défaut d'objectif Polar (min)
    BASE_MIN: 420, BASE_MAX: 540, // bornes du besoin de base (min)
    STRAIN_SEUIL: 10,        // strain de la journée au-delà duquel le besoin augmente
    MIN_PAR_STRAIN: 4,       // minutes ajoutées par point de strain au-dessus du seuil
    STRAIN_PLAFOND: 45,      // supplément strain maximal (min)
    POIDS_DETTE: [0.5, 0.3, 0.2], // poids des déficits des nuits J−1, J−2, J−3
    DETTE_PLAFOND: 60,       // dette maximale reportée (min)
    REC_BASSE: 33,           // récupération en dessous de laquelle on ajoute du sommeil
    BONUS_REC_BASSE: 15,     // minutes ajoutées si récupération ≤ REC_BASSE
    BESOIN_PLAFOND: 600,     // besoin total maximal (min)
    CIBLES: { optimal: 1, solide: 0.85, minimum: 0.70 }, // part du besoin visée par chaque heure de coucher
    EFF_NUITS: 7, EFF_MIN: 0.80, EFF_MAX: 0.98, EFF_DEFAUT: 0.90, // efficacité = sommeil réel / temps au lit
    LATENCE_MIN: 15,         // temps moyen pour s'endormir (min)
    REGULARITE_NUITS: 4,     // nuits utilisées pour la régularité
    REGULARITE_ECHELLE: 120, // somme des écarts (coucher + réveil, min) qui donne une régularité de 0
    DETTE_ELEVEE: 45, STRAIN_ELEVE: 14, REGULARITE_FAIBLE: 60, // seuils des conseils
    REVEIL_DEFAUT: '07:30',  // heure de réveil visée par défaut (tous les jours)
  },
  /*
   * Module Longévité : âge physiologique et rythme de vieillissement.
   * Chaque coefficient cite son étude. Ce qui n'en vient pas est marqué « CONVENTION ».
   * Courbes dose-réponse : points [valeur, HR, IC 95 % bas, IC 95 % haut] ; interpolation linéaire de ln(HR),
   * courbe plate hors des points extrêmes (aucune extrapolation).
   */
  LONGEVITE: {
    // Loi de Gompertz : mortalité adulte h(âge) = a·e^(b·âge), doublement ≈ 8 ans (b = ln 2 / 8 ≈ 0,0866 /an).
    // Gompertz, Phil Trans R Soc 1825 ; ordre de grandeur actuel : Finch, The Biology of Human Longevity, 2007.
    DOUBLEMENT_ANS: 8,
    DOUBLEMENT_MIN: 7, DOUBLEMENT_MAX: 9,  // incertitude tirée uniformément (Monte Carlo)
    DELTA_MAX: 10,           // CONVENTION : écart d'âge borné à ±10 ans
    FENETRE_J: 28,           // jours utilisés pour chaque indicateur
    QUALITE_J: 31, MIN_NUITS: 21, MIN_JOURS: 14, // seuils d'affichage (même seuil que Whoop)
    COUVERTURE_MIN: 0.80,    // CONVENTION : jour « porté en entier » = FC présente sur ≥ 80 % des tranches de 5 min
    VO2_VALIDITE_J: 90,      // CONVENTION : test de VO2max plus vieux → exclu
    RECALCUL_J: 45,          // jours recalculés à chaque mise à jour (les plus anciens restent figés)
    // Monte Carlo
    MC_TIRAGES: 2000, MC_GRAINE: 20261109, // graine fixe : même résultat à chaque rechargement
    // Recouvrement entre indicateurs (CONVENTION : aucune étude n'ajuste ces 7 variables ensemble)
    RECOUVREMENT_AVEC_VO2: 0.5,             // facteur appliqué au domaine Activité et à la FC de repos si VO2max connue
    RECOUVREMENT_MIN: 0.3, RECOUVREMENT_MAX: 1.0, // tirage uniforme (Monte Carlo)
    VO2_ERREUR_SD: 3.5,      // CONVENTION : erreur d'une estimation au poignet (mL/kg/min, écart-type)
    SRI_DECALAGE_MIN: -15, SRI_DECALAGE_MAX: 0, // CONVENTION : SRI des cohortes mesuré à l'accéléromètre (plus fragmenté)
    // Lissage et rythme (CONVENTIONS)
    DEMI_VIE_J: 60,          // moyenne mobile exponentielle des écarts quotidiens
    RYTHME_J: 30, RYTHME_MIN_POINTS: 7, RYTHME_MIN: -1, RYTHME_MAX: 3,
    // 1. VO2max. Kodama et al., JAMA 2009;301:2024 : RR 0,87 (0,84–0,90) par MET de plus (1 MET = 3,5 mL/kg/min).
    // Référence : médianes FRIEND sur tapis, Kaminsky et al., Mayo Clin Proc 2015;90:1515. [âge minimal de la tranche, médiane]
    VO2: {
      RR_PAR_MET: [0.87, 0.84, 0.90], ML_PAR_MET: 3.5, ECART_MAX_MET: 3,
      REF: { H: [[20, 48.0], [30, 42.4], [40, 37.8], [50, 32.6]], F: [[20, 37.6], [30, 30.2], [40, 26.7], [50, 23.4]] },
    },
    // 2. FC de repos. Zhang et al., CMAJ 2016;188:E53 : RR 1,09 (1,07–1,12) par +10 bpm ;
    // 1,04 après correction du biais de publication, pris comme borne basse de l'incertitude.
    FC: { RR_PAR_10: [1.09, 1.04, 1.12], REF: 65 }, // REF 65 bpm : CONVENTION (cohortes : FC assise au cabinet, pas au poignet)
    // 3. Pas/jour. Paluch et al., Lancet Public Health 2022;7:e219 (15 cohortes), médianes des quartiles.
    // Plateau vers 8 000–10 000 pas avant 60 ans (même étude) : 10 000 retenu (CONVENTION).
    PAS: {
      POINTS: [[3553, 1.00], [5801, 0.60, 0.51, 0.71], [7842, 0.55, 0.49, 0.62], [10901, 0.47, 0.39, 0.57]],
      REF: 6800,             // CONVENTION : entre les médianes des quartiles 2 et 3
      PLATEAU_MOINS_60: 10000,
    },
    // 4. Activité modérée à vigoureuse (MET-h/semaine). Arem et al., JAMA Intern Med 2015;175:959 (661 137 adultes).
    // HR placé au milieu de chaque tranche ; plateau 0,61 de 22,5 à 75 ; ≥ 75 → 0,69 placé à 112,5 (CONVENTION).
    MVPA: {
      POINTS: [[0, 1.00], [3.75, 0.80, 0.78, 0.82], [11.25, 0.69, 0.67, 0.70], [18.75, 0.63, 0.62, 0.65],
        [22.5, 0.61, 0.59, 0.62], [75, 0.61, 0.59, 0.62], [112.5, 0.69, 0.59, 0.78]],
      REF: 7.5,              // CONVENTION : minimum recommandé par l'OMS
      FCR_MODEREE: 0.40, FCR_VIGOUREUSE: 0.60, MET_MODERE: 4, MET_VIGOUREUX: 8, // CONVENTIONS de conversion FC → MET
      MET_SEANCE_SANS_FC: 4, // CONVENTION : séance sans FC moyenne comptée modérée
    },
    // 5. Renforcement musculaire (min/semaine). Momma et al., Br J Sports Med 2022;56:755 :
    // risque 10–20 % plus bas vers 30–60 min/semaine. 0 → 1,00 puis ln-linéaire jusqu'à 45 min → 0,85, plateau.
    RENFO: {
      POINTS: [[0, 1.00], [45, 0.85, 0.79, 0.93]], // IC : RR global « en faire vs ne pas en faire », 0,85 (0,79–0,93)
      REF: 0,                // la majorité de la population n'en fait pas
      SPORTS: 'STRENGTH|CORE|CIRCUIT|FUNCTIONAL|CROSSFIT|WEIGHT|KETTLEBELL|BODYWEIGHT|PILATES', // CONVENTION : codes Polar
    },
    // 6. Durée de sommeil. Yin et al., J Am Heart Assoc 2017;6:e005947 : minimum à 7 h ;
    // RR 1,06 (1,04–1,07) par heure en moins, 1,13 (1,11–1,15) par heure en plus.
    // Les cohortes utilisent une durée déclarée : conversion mesuré → déclaré d'après Lauderdale et al., Epidemiology 2008;19:838.
    SOMMEIL: { OPTIMUM_H: 7, RR_COURT: [1.06, 1.04, 1.07], RR_LONG: [1.13, 1.11, 1.15],
      DECLARE_A: 6.8, DECLARE_B: 0.567, DECLARE_PIVOT: 6.0 },
    // 7. Régularité du sommeil (SRI). Windred et al., Sleep 2024;47:zsad253 (UK Biobank, 60 977 personnes),
    // modèle ajusté sur la durée de sommeil. REF 60 = médiane de la cohorte.
    // IC par quintile non vérifiés (article complet inaccessible) : écart-type de ln HR = SD_LN_CONVENTION (CONVENTION).
    SRI: { POINTS: [[41, 1.42], [60, 1.00], [75, 0.90]], REF: 60, MIN_PAIRES: 5, SD_LN_CONVENTION: 0.08 }, // MIN_PAIRES : CONVENTION
  },
};

const API = 'https://www.polaraccesslink.com/v3';
const P = PropertiesService.getScriptProperties();

const ENTETES = ['Date', 'RMSSD nuit (ms)', 'FC nuit (bpm)', 'Respiration (/min)', 'Score sommeil',
  'Statut Nightly Recharge (1-6)', 'ANS charge', 'Charge cardio du jour', 'Strain 7 j (Polar)',
  'Tolérance 28 j (Polar)', 'Ratio strain/tolérance', 'Récupération (0-100)', 'Zone', 'Strain (0-21)',
  'Strain cible', 'Alcool (0/1)', 'Repas tardif (0/1)', 'Notes',
  'Charge journée hors séances', 'Strain journée (0-21)', 'Stress moyen (0-3)', 'Minutes stress élevé',
  'Pas', 'Calories actives', 'Stress par heure', 'FC éveil au repos (P25)',
  'Besoin sommeil ce soir (min)', 'Dette sommeil (min)', 'Performance sommeil (%)', 'Régularité sommeil (0-100)',
  'Efficacité sommeil (7 nuits)',
  'Couverture FC continue (%)', 'MET-h hors séances', 'MET-h séances', 'Renforcement (min)', 'VO2max (mL/kg/min)',
  'Écart âge physiologique (ans)', 'Écart âge lissé (ans)'];
// Colonnes A→O et S→AM : calculées par le script. P→R : journal manuel, conservé à chaque mise à jour.
// AA→AE (coach) : sur la ligne du jour J, besoin du soir J (nuit J → J+1), dette et régularité à ce moment,
// performance de la nuit J−1 → J par rapport au besoin calculé le soir J−1.
// AF→AL (longévité) : couverture de la FC continue, MET-h d'activité modérée à vigoureuse (hors séances / séances),
// minutes de renforcement, VO2max valide ce jour-là, écart d'âge du jour (médiane Monte Carlo) et écart lissé.
const ENTETES_LONGEVITE = ['Date', 'Âge civil', 'Écart médian (ans)', 'Écart P10', 'Écart P90', 'Écart lissé (ans)',
  'Âge physiologique', 'Rythme', 'VO2max (ans)', 'FC repos (ans)', 'Pas (ans)', 'Activité MVPA (ans)', 'Renforcement (ans)',
  'Durée sommeil (ans)', 'Régularité (ans)', 'VO2max (mL/kg/min)', 'FC repos (bpm)', 'Pas/jour', 'MET-h/semaine',
  'Renforcement (min/sem.)', 'Sommeil mesuré (h)', 'SRI', 'Nuits valides (31 j)', 'Jours portés (31 j)'];

// Feuille « Sommeil » : une ligne par nuit (date = matin du réveil). Durées en minutes.
// Hypnogramme Polar : 0 éveil, 1 paradoxal (REM), 2-3 léger, 4 profond, 5 non reconnu.
const ENTETES_SOMMEIL = ['Date', 'Endormissement', 'Réveil', 'Léger (min)', 'Profond (min)', 'Paradoxal (min)',
  'Non reconnu (min)', 'Interruptions (min)', 'Courtes (min)', 'Longues (min)', 'Continuité (1-5)', 'Classe continuité (1-5)',
  'Cycles', 'Score sommeil', 'Score quantité', 'Score solidité', 'Score régénération', 'Sleep Charge (1-5)',
  'Ressenti (1-5)', 'Objectif (min)', 'FC moy. nuit', 'Intervalle RR moy. (ms)', 'HRV moy. (ms)', 'Respiration moy.',
  'Nightly Recharge (1-6)', 'ANS charge', 'Statut ANS (1-5)', 'Hypnogramme', 'FC sommeil', 'HRV nuit', 'Respiration nuit'];

/* ======================= 1. Connexion Polar (une seule fois) ======================= */

function onOpen() {
  SpreadsheetApp.getUi().createMenu('Polar')
    .addItem('Mettre à jour maintenant', 'majQuotidienne')
    .addItem('Lien d\'autorisation Polar', 'afficherLienAutorisation')
    .addItem('Installer la mise à jour automatique', 'installerDeclencheurs')
    .addItem('Lien du dashboard', 'creerLienDashboard')
    .addToUi();
}

function afficherLienAutorisation() {
  const id = P.getProperty('CLIENT_ID');
  if (!id || !P.getProperty('CLIENT_SECRET')) {
    throw new Error('Ajoute CLIENT_ID et CLIENT_SECRET dans Paramètres du projet > Propriétés du script.');
  }
  const url = 'https://flow.polar.com/oauth2/authorization?response_type=code&client_id=' + encodeURIComponent(id);
  Logger.log('Ouvre ce lien dans ton navigateur : ' + url);
  try {
    SpreadsheetApp.getUi().showModalDialog(
      HtmlService.createHtmlOutput('<a href="' + url + '" target="_blank" style="font:16px sans-serif">Autoriser l\'accès Polar</a>'),
      'Polar');
  } catch (e) { /* lancé depuis l'éditeur : le lien est dans le journal d'exécution */ }
}

/**
 * Point d'entrée de l'application web :
 *   ?code=...  → retour de l'autorisation Polar (connexion, une seule fois)
 *   ?k=<clé>   → dashboard
 */
function doGet(e) {
  const p = (e && e.parameter) || {};
  if (p.code) return connexionPolar_(p.code);
  if (p.error) return page_('Polar a refusé l\'autorisation : ' + p.error);
  return servirDashboard_(p);
}

function connexionPolar_(code) {
  if (P.getProperty('ACCESS_TOKEN')) return page_('Déjà connecté à Polar. Rien à faire.');

  const basic = Utilities.base64Encode(P.getProperty('CLIENT_ID') + ':' + P.getProperty('CLIENT_SECRET'));
  const r = UrlFetchApp.fetch('https://polarremote.com/v2/oauth2/token', {
    method: 'post',
    headers: { Authorization: 'Basic ' + basic, Accept: 'application/json;charset=UTF-8' },
    payload: { grant_type: 'authorization_code', code: code },
    muteHttpExceptions: true,
  });
  if (r.getResponseCode() !== 200) return page_('Échec de l\'échange du code : ' + r.getContentText());

  const tok = JSON.parse(r.getContentText());
  P.setProperty('ACCESS_TOKEN', tok.access_token);
  P.setProperty('USER_ID', String(tok.x_user_id));

  const reg = UrlFetchApp.fetch(API + '/users', {
    method: 'post',
    contentType: 'application/json',
    headers: { Authorization: 'Bearer ' + tok.access_token, Accept: 'application/json' },
    payload: JSON.stringify({ 'member-id': 'user-' + tok.x_user_id }),
    muteHttpExceptions: true,
  });
  const c = reg.getResponseCode();
  if ((c < 200 || c >= 300) && c !== 409) { // 200/201 = enregistré, 409 = déjà enregistré
    return page_('Token obtenu mais enregistrement refusé (HTTP ' + c + '). Vérifie tes consentements sur account.polar.com.');
  }
  return page_('Connexion Polar réussie ✅ Tu peux fermer cet onglet.');
}

function page_(t) { return HtmlService.createHtmlOutput('<p style="font:16px sans-serif">' + t + '</p>'); }

/* ======================= 2. Mise à jour des données ======================= */

function majQuotidienne() {
  if (!P.getProperty('ACCESS_TOKEN')) throw new Error('Pas encore connecté à Polar : fais l\'étape d\'autorisation.');

  const recharges = (api_('/users/nightly-recharge') || {}).recharges || [];
  const nuits = (api_('/users/sleep') || {}).nights || [];
  const charges = api_('/users/cardio-load') || [];
  const activites = api_('/users/activities?steps=true') || [];
  const seances = api_('/exercises') || [];
  const profil = dernier_(api_('/users/physical-info'));
  const fcJours = fcContinue_();

  const sh = feuille_();
  const lignes = lire_(sh);
  const ligne = d => lignes[d] || (lignes[d] = nouvelleLigne_(d));

  recharges.forEach(r => {
    if (!r.date) return;
    const l = ligne(r.date);
    l[1] = num_(r.heart_rate_variability_avg);
    l[2] = num_(r.heart_rate_avg);
    l[3] = num_(r.breathing_rate_avg);
    l[5] = num_(r.nightly_recharge_status);
    l[6] = num_(r.ans_charge);
  });
  nuits.forEach(n => { if (n.date) ligne(n.date)[4] = num_(n.sleep_score); });
  charges.forEach(c => {
    if (!c.date || c.cardio_load_status === 'LOAD_STATUS_NOT_AVAILABLE') return;
    const l = ligne(c.date);
    l[7] = num_(c.cardio_load);
    l[8] = num_(c.strain);
    l[9] = num_(c.tolerance);
    l[10] = num_(c.cardio_load_ratio);
  });

  activites.forEach(a => {
    const d = String(a.start_time || '').slice(0, 10);
    if (!d) return;
    const l = ligne(d);
    l[22] = num_(a.steps);
    l[23] = num_(a.active_calories);
  });

  // FC de référence : profil Polar, sinon médiane des FC de nuit / formule d'âge
  const fcNuits = recharges.map(r => r.heart_rate_avg).filter(estNum_).sort((a, b) => a - b);
  const fcRepos = estNum_(profil.resting_heart_rate) ? profil.resting_heart_rate
    : fcNuits.length ? fcNuits[Math.floor(fcNuits.length / 2)] : 60;
  const fcMax = estNum_(profil.maximum_heart_rate) ? profil.maximum_heart_rate : 190;
  const ctx = {
    fcRepos: fcRepos, fcMax: fcMax,
    nuits: indexer_(nuits, n => n.date),
    pas: pasParMinute_(activites),
    seances: fenetresSeances_(seances),
  };
  // 1er passage : charge et FC d'éveil au repos de chaque jour ; 2e passage : stress vs référence personnelle
  const journees = {};
  Object.keys(fcJours).forEach(d => {
    const j = journees[d] = analyserJournee_(d, fcJours[d], ctx);
    const l = ligne(d);
    l[18] = j.trimp;
    l[25] = j.p25;
    l[31] = j.couverture;
    l[32] = j.methHors;
  });

  // Séances : MET-h et minutes de renforcement par jour (l'API couvre ~30 jours ; jours sans séance = 0)
  const parJour = seancesParJour_(seances, fcRepos, fcMax);
  const t30 = jour_(dateDe_(Math.floor(Date.now() / 864e5))) - 29;
  Object.keys(parJour.jours).forEach(d => ligne(d));
  Object.keys(lignes).forEach(d => {
    if (jour_(d) < t30) return;
    const s = parJour.jours[d] || { meth: 0, renfo: 0 };
    lignes[d][33] = Math.round(s.meth * 10) / 10;
    lignes[d][34] = Math.round(s.renfo);
  });
  P.setProperty('SPORTS_VUS', JSON.stringify(parJour.sports));
  const prof = majProfilLongevite_(profil);
  Object.keys(journees).sort().forEach(d => {
    const t = jour_(d);
    const hist = Object.keys(lignes)
      .filter(x => jour_(x) < t && t - jour_(x) <= CFG.STRESS_BASE_JOURS && estNum_(lignes[x][25]))
      .map(x => lignes[x][25]);
    const base = hist.length >= CFG.STRESS_BASE_MIN_JOURS ? mediane_(hist) : journees[d].p25;
    const st = stressJournee_(journees[d].fenetres, base);
    const l = ligne(d);
    l[20] = st.stress;
    l[21] = st.minEleve;
    l[24] = st.horaire;
  });

  const rows = Object.keys(lignes).sort().map(d => lignes[d]);
  rows.forEach((l, i) => calculer_(l, rows, i));

  // Coach de sommeil : besoin, dette, performance, régularité, efficacité (colonnes AA→AE)
  const sommeil = majSommeil_(nuits, recharges);
  remplirCoach_(lignes, sommeil);
  remplirLongevite_(lignes, sommeil, prof, dateDe_(Math.floor(Date.now() / 864e5)));

  const n = sh.getLastRow() - 1;
  if (n > 0) sh.getRange(2, 1, n, ENTETES.length).clearContent().setBackground(null);
  if (rows.length) {
    sh.getRange(2, 1, rows.length, ENTETES.length).setValues(rows);
    colorer_(sh, rows);
  }
  publierLongevite_(lignes, sommeil, prof);
}

/* ======================= 2 bis. Détail du sommeil ======================= */

/** Met à jour la feuille « Sommeil » (une ligne par nuit, anciennes nuits conservées). */
function majSommeil_(nuits, recharges) {
  const ss = classeur_();
  const sh = ss.getSheetByName(CFG.FEUILLE_SOMMEIL) || ss.insertSheet(CFG.FEUILLE_SOMMEIL);
  colonnes_(sh, ENTETES_SOMMEIL.length);
  sh.getRange(1, 1, 1, ENTETES_SOMMEIL.length).setValues([ENTETES_SOMMEIL]).setFontWeight('bold');
  sh.setFrozenRows(1);
  const lignes = lireSommeil_(sh);
  const ligne = d => lignes[d] || (lignes[d] = [d].concat(new Array(ENTETES_SOMMEIL.length - 1).fill('')));
  const min = x => (estNum_(x) ? Math.round(x / 6) / 10 : ''); // secondes → minutes, 1 décimale
  const arr = x => (estNum_(x) ? Math.round(x * 10) / 10 : '');
  const txt = x => (x ? "'" + x : ''); // apostrophe : texte brut, pas de conversion en date par Sheets

  nuits.forEach(n => {
    if (!n.date) return;
    const l = ligne(n.date);
    l[1] = txt(n.sleep_start_time); l[2] = txt(n.sleep_end_time);
    l[3] = min(n.light_sleep); l[4] = min(n.deep_sleep); l[5] = min(n.rem_sleep); l[6] = min(n.unrecognized_sleep_stage);
    l[7] = min(n.total_interruption_duration); l[8] = min(n.short_interruption_duration); l[9] = min(n.long_interruption_duration);
    l[10] = arr(n.continuity); l[11] = num_(n.continuity_class); l[12] = num_(n.sleep_cycles);
    l[13] = num_(n.sleep_score); l[14] = arr(n.group_duration_score); l[15] = arr(n.group_solidity_score);
    l[16] = arr(n.group_regeneration_score); l[17] = num_(n.sleep_charge); l[18] = num_(n.sleep_rating);
    l[19] = min(n.sleep_goal);
    l[27] = n.hypnogram ? JSON.stringify(n.hypnogram) : l[27];
    l[28] = n.heart_rate_samples ? JSON.stringify(n.heart_rate_samples) : l[28];
  });
  recharges.forEach(r => {
    if (!r.date) return;
    const l = ligne(r.date);
    l[20] = num_(r.heart_rate_avg); l[21] = num_(r.beat_to_beat_avg); l[22] = num_(r.heart_rate_variability_avg);
    l[23] = num_(r.breathing_rate_avg); l[24] = num_(r.nightly_recharge_status); l[25] = num_(r.ans_charge);
    l[26] = num_(r.ans_charge_status);
    l[29] = r.hrv_samples ? JSON.stringify(r.hrv_samples) : l[29];
    l[30] = r.breathing_samples ? JSON.stringify(r.breathing_samples) : l[30];
  });

  const rows = Object.keys(lignes).sort().map(d => lignes[d]);
  if (rows.length) sh.getRange(2, 1, rows.length, ENTETES_SOMMEIL.length).setValues(rows);
  return lignes;
}

function lireSommeil_(sh) {
  const out = {};
  const n = sh.getLastRow() - 1;
  if (n < 1) return out;
  const tz = Session.getScriptTimeZone();
  sh.getRange(2, 1, n, ENTETES_SOMMEIL.length).getValues().forEach(r => {
    if (!r[0]) return;
    r[0] = r[0] instanceof Date ? Utilities.formatDate(r[0], tz, 'yyyy-MM-dd') : String(r[0]);
    [1, 2].forEach(c => {
      if (r[c] instanceof Date) r[c] = "'" + Utilities.formatDate(r[c], tz, "yyyy-MM-dd'T'HH:mm:ss");
      else if (r[c]) r[c] = "'" + String(r[c]).replace(/^'/, '');
    });
    out[r[0]] = r;
  });
  return out;
}

/** Appelé par l'onglet Sommeil du dashboard : détail d'une nuit (date = matin du réveil) + 7 dernières nuits. */
function detailSommeil(k, d) {
  if (!k || k !== P.getProperty('DASH_KEY')) throw new Error('Accès refusé.');
  const ss = classeur_();
  const sh = ss.getSheetByName(CFG.FEUILLE_SOMMEIL), shD = ss.getSheetByName(CFG.FEUILLE);
  const tz = Session.getScriptTimeZone(), now = new Date();
  return construireDetail_(sh ? lireSommeil_(sh) : {}, shD ? lire_(shD) : {}, d, lireReveils_(), {
    jour: Utilities.formatDate(now, tz, 'yyyy-MM-dd'), minutes: minutesHeure_(Utilities.formatDate(now, tz, 'HH:mm')),
  });
}

/** Détail d'une nuit + coach du soir, à partir des lignes des feuilles « Sommeil » et « Données » (sans accès Google). */
function construireDetail_(lignes, lignesDonnees, d, reveils, maintenant) {
  const coach = coachDuSoir_(joursCoach_(lignes, lignesDonnees), d, reveils, maintenant);
  const v = x => (estNum_(x) ? x : null);
  const resume = x => ({ d: x[0], leger: v(x[3]), profond: v(x[4]), paradoxal: v(x[5]), eveil: v(x[7]), score: v(x[13]) });
  const historique = Object.keys(lignes).filter(x => x <= d).sort().slice(-7).map(x => resume(lignes[x]));
  const r = lignes[d];
  if (!r || !r[1]) return { d: d, vide: true, historique: historique, coach: coach };

  const debut = String(r[1]).replace(/^'/, ''), fin = String(r[2]).replace(/^'/, '');
  const d0 = minutesIso_(debut);
  const duree = (minutesIso_(fin) - d0 + 1440) % 1440;
  // Séries « HH:MM » → [minutes depuis l'endormissement, valeur]
  const serie = s => {
    let o;
    try { o = JSON.parse(s || '{}'); } catch (e) { return []; }
    return Object.keys(o).map(t => {
      let m = minutesHeure_(t) - d0;
      if (m < -60) m += 1440;
      return [m, o[t]];
    }).filter(p => estNum_(p[0]) && estNum_(p[1])).sort((a, b) => a[0] - b[0]);
  };
  return {
    d: d, debut: debut, fin: fin, duree: duree,
    leger: v(r[3]), profond: v(r[4]), paradoxal: v(r[5]), nonReconnu: v(r[6]),
    interruptions: v(r[7]), courtes: v(r[8]), longues: v(r[9]),
    continuite: v(r[10]), classe: v(r[11]), cycles: v(r[12]),
    score: v(r[13]), sQuantite: v(r[14]), sSolidite: v(r[15]), sRegeneration: v(r[16]),
    sleepCharge: v(r[17]), ressenti: v(r[18]), objectif: v(r[19]),
    fcMoy: v(r[20]), rr: v(r[21]), hrv: v(r[22]), resp: v(r[23]),
    recharge: v(r[24]), ans: v(r[25]), ansStatut: v(r[26]),
    hypno: serie(r[27]), fc: serie(r[28]), hrvS: serie(r[29]), respS: serie(r[30]),
    historique: historique, coach: coach,
  };
}

/* ======================= 2 ter. Coach de sommeil ======================= */

/**
 * Données utiles au coach, par date : { reel, debut, fin, objectif } (feuille « Sommeil », date = matin du réveil)
 * et { rec, strain } (feuille « Données », date = jour J). Sommeil réel = léger + profond + paradoxal.
 */
function joursCoach_(lignesSommeil, lignesDonnees) {
  const j = {};
  const v = x => (estNum_(x) ? x : null);
  const iso = x => String(x || '').replace(/^'/, '');
  Object.keys(lignesSommeil || {}).forEach(d => {
    const r = lignesSommeil[d], ph = [r[3], r[4], r[5]];
    j[d] = {
      reel: ph.some(estNum_) ? ph.reduce((s, x) => s + (estNum_(x) ? x : 0), 0) : null,
      debut: iso(r[1]), fin: iso(r[2]), objectif: v(r[19]),
    };
  });
  Object.keys(lignesDonnees || {}).forEach(d => {
    const r = lignesDonnees[d], o = j[d] = j[d] || {};
    o.rec = v(r[11]);
    o.strain = estNum_(r[19]) ? r[19] : v(r[13]); // strain de la journée, à défaut celui des séances
  });
  return j;
}

/** Remplit les colonnes AA→AE de la feuille « Données » (lignes modifiées sur place). */
function remplirCoach_(lignesDonnees, lignesSommeil) {
  const coach = historiqueCoach_(joursCoach_(lignesSommeil, lignesDonnees));
  const val = x => (estNum_(x) ? x : '');
  Object.keys(lignesDonnees).forEach(d => {
    const l = lignesDonnees[d], c = coach[d] || {};
    l[26] = val(c.besoin); l[27] = val(c.dette); l[28] = val(c.perf); l[29] = val(c.regularite); l[30] = val(c.eff);
  });
}

/** Indice (0 = lundi) du jour de réveil qui suit le soir d. */
function jourReveil_(d) { return (new Date((jour_(d) + 1) * 864e5).getUTCDay() + 6) % 7; }

/** Calcule, jour après jour, le besoin du soir (il sert à mesurer le déficit de la nuit suivante). */
function historiqueCoach_(jours) {
  const dates = Object.keys(jours).sort(), out = {};
  if (!dates.length) return out;
  for (let t = jour_(dates[0]), fin = jour_(dates[dates.length - 1]); t <= fin; t++) {
    const d = dateDe_(t);
    out[d] = besoinDuSoir_(jours, out, d);
  }
  return out;
}

/** Besoin du soir J (nuit J → J+1) et indicateurs associés. hist = besoins des soirs précédents. */
function besoinDuSoir_(jours, hist, d) {
  const C = CFG.COACH, t = jour_(d), j = jours[d] || {};
  const nuits = Object.keys(jours).filter(n => jour_(n) <= t && estNum_(jours[n].reel) && jours[n].reel > 0).sort();

  // 1. Base : médiane du sommeil réel des nuits suivies d'une bonne récupération, sinon objectif Polar
  const bonnes = nuits.filter(n => t - jour_(n) < C.FENETRE_J && estNum_(jours[n].rec) && jours[n].rec >= C.REC_BONNE);
  const objectifs = Object.keys(jours).filter(n => jour_(n) <= t && estNum_(jours[n].objectif) && jours[n].objectif > 0).sort();
  let base, source;
  if (bonnes.length >= C.MIN_NUITS_BONNES) { base = mediane_(bonnes.map(n => jours[n].reel)); source = 'nuits'; }
  else if (objectifs.length) { base = jours[objectifs[objectifs.length - 1]].objectif; source = 'objectif'; }
  else { base = C.BESOIN_DEFAUT; source = 'defaut'; }

  // 3. Déficits des nuits J−1, J−2, J−3 (nuits datées J, J−1, J−2) par rapport au besoin de BASE calculé la veille.
  //    (Pas le besoin total : il contient déjà la dette, ce qui la ferait s'auto-entretenir.)
  const deficits = [0, 1, 2].map(k => {
    const n = dateDe_(t - k), r = jours[n] && jours[n].reel, b = hist[dateDe_(t - k - 1)];
    return estNum_(r) && r > 0 && b && estNum_(b.base) ? Math.max(0, b.base - r) : null;
  });
  const res = besoinTotal_(base, j.strain, deficits, j.rec);
  res.source = source; res.nbBonnes = bonnes.length; res.deficits = deficits;
  res.strainJour = estNum_(j.strain) ? j.strain : null;
  res.rec = estNum_(j.rec) ? j.rec : null;

  // 6. Performance de la nuit passée (datée J) vs besoin calculé le soir J−1
  const veille = hist[dateDe_(t - 1)];
  res.reelNuit = estNum_(j.reel) && j.reel > 0 ? j.reel : null;
  res.besoinVeille = veille && estNum_(veille.besoin) ? veille.besoin : null;
  res.perf = performanceSommeil_(res.reelNuit, res.besoinVeille);

  // 7. Efficacité médiane des 7 dernières nuits ; 8. régularité des 4 dernières
  const recentes = nuits.filter(n => jours[n].debut && jours[n].fin);
  const effs = recentes.slice(-C.EFF_NUITS).map(n => {
    const lit = dureeAuLit_(jours[n].debut, jours[n].fin);
    return lit > 0 ? jours[n].reel / lit : null;
  }).filter(x => estNum_(x) && x > 0 && x <= 1.05);
  res.eff = efficacite_(effs);
  const reg = regularite_(recentes.filter(n => t - jour_(n) < 7).slice(-C.REGULARITE_NUITS)
    .map(n => [minutesIso_(jours[n].debut), minutesIso_(jours[n].fin)]));
  res.regularite = reg.score; res.ecartCoucher = reg.ecartCoucher; res.ecartReveil = reg.ecartReveil;
  return res;
}

/** Étapes 1 à 5 : décomposition du besoin total (minutes entières, la somme des parts donne le total). */
function besoinTotal_(base, strain, deficits, rec) {
  const C = CFG.COACH;
  const b = Math.round(Math.max(C.BASE_MIN, Math.min(C.BASE_MAX, base)));
  const s = Math.round(estNum_(strain) ? Math.min(C.STRAIN_PLAFOND, Math.max(0, strain - C.STRAIN_SEUIL) * C.MIN_PAR_STRAIN) : 0);
  const dette = Math.round(detteSommeil_(deficits));
  const ajust = estNum_(rec) && rec <= C.REC_BASSE ? C.BONUS_REC_BASSE : 0;
  // Plafond : on rogne d'abord l'ajustement, puis la dette, puis le strain, pour que la barre reste juste
  let surplus = Math.max(0, b + s + dette + ajust - C.BESOIN_PLAFOND);
  const rogne = x => { const r = Math.min(x, surplus); surplus -= r; return x - r; };
  const a2 = rogne(ajust), d2 = rogne(dette), s2 = rogne(s);
  return { base: b, strain: s2, dette: d2, ajust: a2, besoin: b + s2 + d2 + a2 };
}

/** Dette = moyenne pondérée des déficits J−1, J−2, J−3 ; poids renormalisés sur les nuits présentes (null = pas de données). */
function detteSommeil_(deficits) {
  const C = CFG.COACH;
  let s = 0, p = 0;
  C.POIDS_DETTE.forEach((w, k) => { if (estNum_(deficits[k])) { s += w * deficits[k]; p += w; } });
  return p > 0 ? Math.min(C.DETTE_PLAFOND, s / p) : 0;
}

function performanceSommeil_(reel, besoin) {
  return estNum_(reel) && estNum_(besoin) && besoin > 0 ? Math.round(100 * Math.min(1, reel / besoin)) : null;
}

/** Efficacité médiane bornée [EFF_MIN ; EFF_MAX], EFF_DEFAUT sans données. */
function efficacite_(effs) {
  const C = CFG.COACH;
  if (!effs.length) return C.EFF_DEFAUT;
  return Math.round(100 * Math.max(C.EFF_MIN, Math.min(C.EFF_MAX, mediane_(effs)))) / 100;
}

/** Heure de coucher (minutes depuis minuit) pour atteindre `cible` × besoin avant `reveil` (minutes). */
function coucher_(besoin, cible, eff, reveil) {
  const lit = besoin * cible / eff + CFG.COACH.LATENCE_MIN;
  return ((Math.round(reveil - lit) % 1440) + 1440) % 1440;
}

/** Plan du soir : heure de coucher et sommeil visé pour chaque cible. */
function planSoir_(besoin, eff, reveil) {
  const o = {};
  Object.keys(CFG.COACH.CIBLES).forEach(k => {
    const c = CFG.COACH.CIBLES[k], m = coucher_(besoin, c, eff, reveil);
    o[k] = { heure: hhmm_(m), minutes: m, sommeil: Math.round(besoin * c) };
  });
  return o;
}

/**
 * Régularité 0–100 : écart absolu moyen des heures d'endormissement et de réveil autour de leur moyenne
 * circulaire (23:50 et 00:10 sont à 20 min l'une de l'autre). nuits = [[endormissement, réveil] en minutes].
 */
function regularite_(nuits) {
  const ok = nuits.filter(p => estNum_(p[0]) && estNum_(p[1]));
  if (ok.length < 2) return { score: null, ecartCoucher: null, ecartReveil: null };
  const ecart = ms => {
    const a = ms.map(m => m / 1440 * 2 * Math.PI);
    const mu = Math.atan2(moy_(a.map(Math.sin)), moy_(a.map(Math.cos))) / (2 * Math.PI) * 1440;
    return moy_(ms.map(m => { const e = Math.abs(m - mu) % 1440; return Math.min(e, 1440 - e); }));
  };
  const c = ecart(ok.map(p => p[0])), r = ecart(ok.map(p => p[1]));
  return {
    score: Math.round(100 * Math.max(0, 1 - (c + r) / CFG.COACH.REGULARITE_ECHELLE)),
    ecartCoucher: Math.round(c), ecartReveil: Math.round(r),
  };
}

/** Coach complet du soir J : besoin, plan pour l'heure de réveil du lendemain, conseil. */
function coachDuSoir_(jours, d, reveils, maintenant) {
  const c = historiqueCoach_(Object.assign({ [d]: {} }, jours))[d];
  const idx = jourReveil_(d);
  c.d = d;
  c.reveils = reveils;
  c.jourReveil = idx;
  c.reveil = reveils[idx];
  c.plan = planSoir_(c.besoin, c.eff, minutesHeure_(c.reveil));
  c.conseil = conseilSoir_(c, maintenant && maintenant.jour === d ? maintenant.minutes : null);
  return c;
}

/**
 * Conseil du soir (une ou deux phrases), par ordre de priorité. `maintenant` : minutes depuis minuit si le soir
 * affiché est aujourd'hui, sinon null. Les heures sont comparées en « minutes depuis midi » (passage de minuit).
 */
function conseilSoir_(c, maintenant) {
  const C = CFG.COACH, phr = [];
  const soir = m => (m - 720 + 1440) % 1440;
  if (estNum_(maintenant) && c.plan) {
    const passe = k => soir(maintenant) > soir(c.plan[k].minutes);
    if (passe('minimum')) phr.push('Toutes les heures conseillées sont dépassées : couche-toi dès que possible et garde ton réveil habituel.');
    else if (passe('solide')) phr.push('Le coucher Solide est passé : vise ' + c.plan.minimum.heure + ' au plus tard pour assurer le minimum.');
    else if (passe('optimal')) phr.push('Le coucher Optimal est passé, mais ' + c.plan.solide.heure + ' te laisse encore une bonne nuit.');
  }
  if (estNum_(c.rec) && c.rec <= C.REC_BASSE) phr.push('Récupération basse ce matin : ce soir, le sommeil passe avant le reste.');
  if (c.dette >= C.DETTE_ELEVEE) phr.push('Environ ' + hm_(c.dette) + ' de retard sur les dernières nuits : un coucher plus tôt aide à le combler.');
  if (estNum_(c.strainJour) && c.strainJour >= C.STRAIN_ELEVE) {
    phr.push('Grosse journée (strain ' + String(c.strainJour).replace('.', ',') + ') : compte ' + c.strain + ' min de sommeil en plus.');
  }
  if (estNum_(c.regularite) && c.regularite < C.REGULARITE_FAIBLE) phr.push('Tes horaires varient beaucoup : des heures de coucher et de lever fixes, même le week-end, rendent les nuits plus efficaces.');
  if (!phr.length) phr.push('Rien à signaler : un coucher vers ' + c.plan.optimal.heure + ' couvre tout ton besoin.');
  return phr.slice(0, 2).join(' ');
}

/** Heures de réveil visées (lundi → dimanche), propriété REVEIL_SEMAINE. */
function lireReveils_() {
  let r = null;
  try { r = JSON.parse(P.getProperty('REVEIL_SEMAINE') || 'null'); } catch (e) { r = null; }
  return Array.isArray(r) && r.length === 7 && r.every(estHeure_) ? r : new Array(7).fill(CFG.COACH.REVEIL_DEFAUT);
}

/** Appelé par le dashboard : enregistre les 7 heures de réveil (lundi → dimanche, « HH:MM »). */
function enregistrerReveil(k, valeurs) {
  if (!k || k !== P.getProperty('DASH_KEY')) throw new Error('Accès refusé.');
  if (!Array.isArray(valeurs) || valeurs.length !== 7 || !valeurs.every(estHeure_)) {
    throw new Error('Format attendu : 7 heures HH:MM, du lundi au dimanche.');
  }
  P.setProperty('REVEIL_SEMAINE', JSON.stringify(valeurs));
  return { reveils: valeurs, data: donneesDashboard_() }; // le résumé « Aujourd'hui » dépend des heures de réveil
}

function estHeure_(x) { return typeof x === 'string' && /^([01]\d|2[0-3]):[0-5]\d$/.test(x); }
function hhmm_(m) { const t = ((Math.round(m) % 1440) + 1440) % 1440; return String(Math.floor(t / 60)).padStart(2, '0') + ':' + String(t % 60).padStart(2, '0'); }
function hm_(m) { const t = Math.round(m), h = Math.floor(t / 60), mn = t % 60; return h ? h + ' h ' + String(mn).padStart(2, '0') : mn + ' min'; }
function dateDe_(t) { return new Date(t * 864e5).toISOString().slice(0, 10); }
/** Temps au lit (min) entre endormissement et réveil (ISO), passage de minuit compris. */
function dureeAuLit_(debut, fin) {
  const a = Date.parse(debut), b = Date.parse(fin);
  if (isFinite(a) && isFinite(b) && b > a) return (b - a) / 6e4;
  return (minutesIso_(fin) - minutesIso_(debut) + 1440) % 1440;
}

/* ======================= 2 quater. Longévité ======================= */

/**
 * Âge physiologique (loi de Gompertz) : si mes comportements multiplient mon risque de mortalité par HR
 * par rapport à la personne typique de mon âge et de mon sexe, mon risque égale celui d'une personne typique
 * plus âgée de Δ = ln(HR) / b, avec b = ln 2 / temps de doublement.
 */
function deltaGompertz_(lnHr, doublement) { return lnHr / (Math.LN2 / (doublement || CFG.LONGEVITE.DOUBLEMENT_ANS)); }

/** Écart-type de ln(HR) déduit d'un IC 95 % : (ln haut − ln bas) / 3,92. */
function sdIc_(bas, haut) { return estNum_(bas) && estNum_(haut) && bas > 0 && haut > 0 ? (Math.log(haut) - Math.log(bas)) / 3.92 : 0; }

/** ln(HR) sur une courbe dose-réponse : interpolation linéaire de ln(HR), plate hors des points extrêmes. z = tirage (écarts-types). */
function lnHrCourbe_(points, x, z, sdDefaut) {
  const ln = points.map(p => Math.log(p[1]) + (z ? z * (estNum_(p[2]) ? sdIc_(p[2], p[3]) : p[1] === 1 ? 0 : (sdDefaut || 0)) : 0));
  const n = points.length - 1;
  if (x <= points[0][0]) return ln[0];
  if (x >= points[n][0]) return ln[n];
  for (let k = 0; k < n; k++) {
    if (x <= points[k + 1][0]) return ln[k] + (x - points[k][0]) / (points[k + 1][0] - points[k][0]) * (ln[k + 1] - ln[k]);
  }
  return ln[n];
}

/** VO2max de référence (médiane FRIEND) pour l'âge et le sexe ('H' ou 'F'). */
function refVo2_(age, sexe) {
  const t = CFG.LONGEVITE.VO2.REF[sexe === 'F' ? 'F' : 'H'];
  let r = t[0][1];
  t.forEach(p => { if (age >= p[0]) r = p[1]; });
  return r;
}

/** VO2max : ln HR = ln(RR par MET) × (VO2 − réf) / 3,5, écart borné à ±3 MET. */
function lnHrVo2_(vo2, ref, z) {
  const V = CFG.LONGEVITE.VO2;
  const lnRr = Math.log(V.RR_PAR_MET[0]) + (z || 0) * sdIc_(V.RR_PAR_MET[1], V.RR_PAR_MET[2]);
  return lnRr * Math.max(-V.ECART_MAX_MET, Math.min(V.ECART_MAX_MET, (vo2 - ref) / V.ML_PAR_MET));
}

/** FC de repos : ln HR = ln(RR par 10 bpm) × (FC − réf) / 10. */
function lnHrFc_(fc, z) {
  const F = CFG.LONGEVITE.FC;
  return (Math.log(F.RR_PAR_10[0]) + (z || 0) * sdIc_(F.RR_PAR_10[1], F.RR_PAR_10[2])) * (fc - F.REF) / 10;
}

/** Sommeil mesuré (h) → durée déclarée équivalente (Lauderdale 2008). */
function sommeilDeclare_(h) { const S = CFG.LONGEVITE.SOMMEIL; return S.DECLARE_A + S.DECLARE_B * (h - S.DECLARE_PIVOT); }

/** Durée de sommeil (mesurée, h) : courbe en V autour de 7 h déclarées (Yin 2017). */
function lnHrSommeil_(hMesure, zCourt, zLong) {
  const S = CFG.LONGEVITE.SOMMEIL, h = sommeilDeclare_(hMesure);
  if (h < S.OPTIMUM_H) return (Math.log(S.RR_COURT[0]) + (zCourt || 0) * sdIc_(S.RR_COURT[1], S.RR_COURT[2])) * (S.OPTIMUM_H - h);
  return (Math.log(S.RR_LONG[0]) + (zLong || 0) * sdIc_(S.RR_LONG[1], S.RR_LONG[2])) * (h - S.OPTIMUM_H);
}

/** Pas : plateau à PLATEAU_MOINS_60 avant 60 ans (Paluch 2022). */
function pasPlafonnes_(pas, age) { return age < 60 ? Math.min(pas, CFG.LONGEVITE.PAS.PLATEAU_MOINS_60) : pas; }

const TIRAGE_CENTRAL_ = { z: {}, doublement: null, recouvrement: null, vo2Err: 0, sriDecal: 0 };

/**
 * Modèle complet. x = { age, sexe, vo2, fc, pas, mvpa, renfo, sommeil (h mesurées), sri } (null = indisponible).
 * t = tirage Monte Carlo (TIRAGE_CENTRAL_ par défaut). Renvoie ln HR et contributions (en années) par indicateur.
 * Recouvrement (CONVENTION) : Activité = moyenne(pas, MVPA) + renforcement ; si VO2max connue, facteur sur Activité et FC.
 */
function modeleLongevite_(x, t) {
  const L = CFG.LONGEVITE;
  t = t || TIRAGE_CENTRAL_;
  const z = k => t.z[k] || 0;
  const doublement = t.doublement || L.DOUBLEMENT_ANS;
  const ln = {};
  if (estNum_(x.vo2) && estNum_(x.age)) ln.vo2 = lnHrVo2_(x.vo2 + (t.vo2Err || 0), refVo2_(x.age, x.sexe), z('vo2'));
  if (estNum_(x.fc)) ln.fc = lnHrFc_(x.fc, z('fc'));
  if (estNum_(x.pas)) {
    const a = estNum_(x.age) ? x.age : 0;
    ln.pas = lnHrCourbe_(L.PAS.POINTS, pasPlafonnes_(x.pas, a), z('pas')) - lnHrCourbe_(L.PAS.POINTS, pasPlafonnes_(L.PAS.REF, a), z('pas'));
  }
  if (estNum_(x.mvpa)) ln.mvpa = lnHrCourbe_(L.MVPA.POINTS, x.mvpa, z('mvpa')) - lnHrCourbe_(L.MVPA.POINTS, L.MVPA.REF, z('mvpa'));
  if (estNum_(x.renfo)) ln.renfo = lnHrCourbe_(L.RENFO.POINTS, x.renfo, z('renfo')) - lnHrCourbe_(L.RENFO.POINTS, L.RENFO.REF, z('renfo'));
  if (estNum_(x.sommeil)) ln.sommeil = lnHrSommeil_(x.sommeil, z('court'), z('long'));
  if (estNum_(x.sri)) {
    ln.sri = lnHrCourbe_(L.SRI.POINTS, x.sri + (t.sriDecal || 0), z('sri'), L.SRI.SD_LN_CONVENTION)
      - lnHrCourbe_(L.SRI.POINTS, L.SRI.REF, z('sri'), L.SRI.SD_LN_CONVENTION);
  }
  const f = estNum_(ln.vo2) ? (estNum_(t.recouvrement) ? t.recouvrement : L.RECOUVREMENT_AVEC_VO2) : 1;
  const nAct = [ln.pas, ln.mvpa].filter(estNum_).length;
  const poids = { vo2: 1, fc: f, pas: f / nAct, mvpa: f / nAct, renfo: f, sommeil: 1, sri: 1 };
  const contrib = {};
  let total = 0;
  Object.keys(ln).forEach(k => { contrib[k] = deltaGompertz_(poids[k] * ln[k], doublement); total += poids[k] * ln[k]; });
  const delta = Math.max(-L.DELTA_MAX, Math.min(L.DELTA_MAX, deltaGompertz_(total, doublement)));
  return { lnHr: ln, contributions: contrib, delta: delta };
}

/** Générateur pseudo-aléatoire à graine (mulberry32) : résultats identiques à chaque calcul. */
function alea_(graine) {
  let a = graine >>> 0;
  return () => {
    a = (a + 0x6D2B79F5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Monte Carlo : médiane et intervalle de 80 % (P10–P90) de l'écart d'âge. */
function monteCarloLongevite_(x, n) {
  const L = CFG.LONGEVITE, r = alea_(L.MC_GRAINE);
  n = n || L.MC_TIRAGES;
  const normal = () => Math.sqrt(-2 * Math.log(1 - r())) * Math.cos(2 * Math.PI * r());
  const cles = ['vo2', 'fc', 'pas', 'mvpa', 'renfo', 'court', 'long', 'sri'];
  const d = [];
  for (let k = 0; k < n; k++) {
    const t = { z: {} };
    cles.forEach(c => { t.z[c] = normal(); }); // tous les tirages sont faits, que l'indicateur existe ou non
    t.doublement = L.DOUBLEMENT_MIN + (L.DOUBLEMENT_MAX - L.DOUBLEMENT_MIN) * r();
    t.recouvrement = L.RECOUVREMENT_MIN + (L.RECOUVREMENT_MAX - L.RECOUVREMENT_MIN) * r();
    t.vo2Err = L.VO2_ERREUR_SD * normal();
    t.sriDecal = L.SRI_DECALAGE_MIN + (L.SRI_DECALAGE_MAX - L.SRI_DECALAGE_MIN) * r();
    d.push(modeleLongevite_(x, t).delta);
  }
  d.sort((a, b) => a - b);
  const q = p => { const i = (d.length - 1) * p, k = Math.floor(i); return d[k] + (i - k) * ((d[k + 1] !== undefined ? d[k + 1] : d[k]) - d[k]); };
  return { p10: q(0.10), p50: q(0.50), p90: q(0.90) };
}

/**
 * SRI (Sleep Regularity Index) : probabilité d'être dans le même état (endormi / éveillé) à 24 h d'écart,
 * sur toutes les paires de jours consécutifs connus de la fenêtre. SRI = 200 × P(même état) − 100.
 * État minute par minute : endormi entre endormissement et réveil, sauf phases d'éveil de l'hypnogramme (code 0).
 * Un jour est « connu » si la nuit qui le commence (datée J) et celle qui le termine (datée J+1) sont enregistrées.
 */
function sri_(lignesSommeil, d) {
  const L = CFG.LONGEVITE, tD = jour_(d), t0 = tD - L.FENETRE_J - 1, nJ = L.FENETRE_J + 3;
  const dort = new Array(nJ * 1440).fill(0);
  const iso = x => String(x || '').replace(/^'/, '');
  const idx = s => (jour_(s.slice(0, 10)) - t0) * 1440 + minutesIso_(s);
  const nuits = {};
  Object.keys(lignesSommeil || {}).forEach(n => {
    const r = lignesSommeil[n], tn = jour_(n);
    if (tn < t0 || tn > tD) return;
    const deb = iso(r[1]), fin = iso(r[2]);
    if (!/^\d{4}-\d\d-\d\dT\d\d:\d\d/.test(deb) || !/^\d{4}-\d\d-\d\dT\d\d:\d\d/.test(fin)) return;
    const a = idx(deb), b = idx(fin);
    if (!(b > a)) return;
    nuits[n] = true;
    for (let m = Math.max(0, a); m < Math.min(dort.length, b); m++) dort[m] = 1;
    let h = {};
    try { h = JSON.parse(r[27] || '{}') || {}; } catch (e) { h = {}; }
    const d0 = minutesIso_(deb);
    const ph = Object.keys(h).map(k => { let o = minutesHeure_(k) - d0; if (o < -60) o += 1440; return [o, h[k]]; })
      .filter(p => estNum_(p[0])).sort((u, v) => u[0] - v[0]);
    ph.forEach((p, k) => {
      if (p[1] !== 0) return;
      const finPh = k + 1 < ph.length ? a + ph[k + 1][0] : b;
      for (let m = Math.max(0, a + p[0]); m < Math.min(dort.length, finPh, b); m++) dort[m] = 0;
    });
  });
  const connu = t => nuits[dateDe_(t)] && nuits[dateDe_(t + 1)];
  let meme = 0, total = 0, paires = 0;
  for (let t = tD - L.FENETRE_J; t + 1 < tD; t++) {
    if (!connu(t) || !connu(t + 1)) continue;
    paires++;
    const i0 = (t - t0) * 1440;
    for (let m = 0; m < 1440; m++) { total++; if (dort[i0 + m] === dort[i0 + 1440 + m]) meme++; }
  }
  return { sri: paires >= L.SRI.MIN_PAIRES && total ? Math.round(10 * (200 * meme / total - 100)) / 10 : null, paires: paires };
}

/**
 * Entrées du modèle au jour d (fenêtre de 28 jours) et qualité des données (31 jours).
 * Données : W pas (22), Z FC éveil au repos P25 (25), AF couverture (31), AG MET-h hors séances (32),
 * AH MET-h séances (33), AI renforcement (34), AJ VO2max (35).
 */
function entreesLongevite_(lignesDonnees, lignesSommeil, d, profil) {
  const L = CFG.LONGEVITE, t = jour_(d);
  const dans = (x, n) => { const e = t - jour_(x); return e >= 0 && e < n; };
  const rows = Object.keys(lignesDonnees || {}).filter(x => dans(x, L.FENETRE_J)).map(x => lignesDonnees[x]);
  const entier = r => estNum_(r[31]) && r[31] >= 100 * L.COUVERTURE_MIN;
  const pleins = rows.filter(entier);
  const moyOuNull = a => (a.length ? moy_(a) : null);
  const fcs = rows.map(r => r[25]).filter(estNum_);
  const pas = pleins.map(r => r[22]).filter(estNum_);
  const methH = pleins.map(r => r[32]).filter(estNum_);
  const methS = rows.map(r => r[33]).filter(estNum_);
  const renfo = rows.map(r => r[34]).filter(estNum_);
  const nuits = Object.keys(lignesSommeil || {}).filter(x => dans(x, L.FENETRE_J)).map(x => {
    const r = lignesSommeil[x], ph = [r[3], r[4], r[5]];
    return ph.some(estNum_) ? ph.reduce((s, v) => s + (estNum_(v) ? v : 0), 0) : null;
  }).filter(v => estNum_(v) && v > 0);
  // VO2max : dernière valeur valide de la semaine (la colonne n'est remplie que si le test a moins de 90 jours)
  const vo2r = Object.keys(lignesDonnees || {}).filter(x => dans(x, 7) && estNum_(lignesDonnees[x][35])).sort();
  const sr = sri_(lignesSommeil, d);
  const age = profil && profil.naissance ? (t - jour_(profil.naissance)) / 365.25 : null;
  const x = {
    age: age, sexe: profil && profil.sexe || null,
    vo2: vo2r.length ? lignesDonnees[vo2r[vo2r.length - 1]][35] : null,
    fc: fcs.length ? mediane_(fcs) : null,
    pas: moyOuNull(pas),
    mvpa: methH.length ? 7 * (moy_(methH) + methS.reduce((s, v) => s + v, 0) / L.FENETRE_J) : null,
    renfo: renfo.length ? renfo.reduce((s, v) => s + v, 0) / (L.FENETRE_J / 7) : null,
    sommeil: nuits.length ? moy_(nuits) / 60 : null,
    sri: sr.sri,
  };
  const nuits31 = Object.keys(lignesSommeil || {}).filter(n => dans(n, L.QUALITE_J)).filter(n => {
    const r = lignesSommeil[n]; return [r[3], r[4], r[5]].some(v => estNum_(v) && v > 0);
  }).length;
  const jours31 = Object.keys(lignesDonnees || {}).filter(n => dans(n, L.QUALITE_J) && entier(lignesDonnees[n])).length;
  return { x: x, qualite: { nuits: nuits31, jours: jours31, paires: sr.paires,
    ok: nuits31 >= L.MIN_NUITS && jours31 >= L.MIN_JOURS && estNum_(age) } };
}

/** Écart du jour (médiane Monte Carlo) pour chaque jour récent, puis moyenne mobile exponentielle (colonnes AK, AL). */
function remplirLongevite_(lignesDonnees, lignesSommeil, profil, aujourdhui) {
  const L = CFG.LONGEVITE, dates = Object.keys(lignesDonnees).sort(), tA = jour_(aujourdhui);
  dates.forEach(d => {
    if (tA - jour_(d) >= L.RECALCUL_J) return; // les jours plus anciens restent figés
    const l = lignesDonnees[d];
    // VO2max valide ce jour-là : test daté, antérieur, de moins de VO2_VALIDITE_J jours
    if (!estNum_(l[35]) && profil && estNum_(profil.vo2) && profil.vo2Date && profil.vo2Date <= d
        && jour_(d) - jour_(profil.vo2Date) <= L.VO2_VALIDITE_J) l[35] = profil.vo2;
    const e = entreesLongevite_(lignesDonnees, lignesSommeil, d, profil);
    l[36] = e.qualite.ok ? Math.round(100 * monteCarloLongevite_(e.x).p50) / 100 : '';
  });
  lisserLongevite_(dates.map(d => lignesDonnees[d]));
}

/** Moyenne mobile exponentielle (demi-vie DEMI_VIE_J jours calendaires) des écarts quotidiens : colonne AL. */
function lisserLongevite_(rows) {
  let ema = null, tPrec = null;
  rows.forEach(l => {
    if (!estNum_(l[36])) { l[37] = ema === null ? '' : Math.round(100 * ema) / 100; return; }
    const t = jour_(l[0]);
    if (ema === null) ema = l[36];
    else { const a = 1 - Math.pow(0.5, (t - tPrec) / CFG.LONGEVITE.DEMI_VIE_J); ema += a * (l[36] - ema); }
    tPrec = t;
    l[37] = Math.round(100 * ema) / 100;
  });
}

/**
 * Rythme de vieillissement = 1 + pente de l'écart lissé (années d'écart par année de calendrier, régression
 * linéaire sur RYTHME_J jours), borné [RYTHME_MIN ; RYTHME_MAX]. 1,0 = l'âge physiologique avance comme le calendrier.
 * serie = [[date, écart lissé]].
 */
function rythme_(serie, d) {
  const L = CFG.LONGEVITE, t = jour_(d);
  const pts = serie.filter(p => estNum_(p[1]) && t - jour_(p[0]) >= 0 && t - jour_(p[0]) <= L.RYTHME_J)
    .map(p => [jour_(p[0]), p[1]]);
  if (pts.length < L.RYTHME_MIN_POINTS) return null;
  const mx = moy_(pts.map(p => p[0])), my = moy_(pts.map(p => p[1]));
  const sxx = pts.reduce((s, p) => s + (p[0] - mx) * (p[0] - mx), 0);
  if (!(sxx > 0)) return null;
  const pente = pts.reduce((s, p) => s + (p[0] - mx) * (p[1] - my), 0) / sxx * 365.25;
  return Math.round(100 * Math.max(L.RYTHME_MIN, Math.min(L.RYTHME_MAX, 1 + pente))) / 100;
}

/** Leviers : gain (années) de quelques changements réalistes, calculés par le modèle central. */
function leviersLongevite_(x) {
  const base = modeleLongevite_(x).delta;
  const essai = (cle, texte, f) => {
    if (!estNum_(x[cle])) return null;
    const y = Object.assign({}, x); y[cle] = f(x[cle]);
    return { cle: cle, texte: texte, ans: Math.round(100 * (modeleLongevite_(y).delta - base)) / 100 };
  };
  return [
    essai('pas', '+1 000 pas par jour', v => v + 1000),
    essai('vo2', '+3 mL/kg/min de VO2max', v => v + 3),
    essai('sri', 'Sommeil plus régulier (SRI +10)', v => Math.min(100, v + 10)),
    essai('mvpa', '+2 h d\'activité modérée par semaine (+8 MET-h)', v => v + 8),
    essai('renfo', '+30 min de renforcement par semaine', v => v + 30),
    essai('fc', 'FC de repos −5 bpm', v => v - 5),
    essai('sommeil', '+30 min de sommeil par nuit', v => v + 0.5),
  ].filter(l => l && l.ans <= -0.05).sort((a, b) => a.ans - b.ans);
}

/** Profil utile au module : naissance, sexe, VO2max et date du test. Stocké dans la propriété PROFIL_LONGEVITE. */
function majProfilLongevite_(profil) {
  let prec = {};
  try { prec = JSON.parse(P.getProperty('PROFIL_LONGEVITE') || '{}') || {}; } catch (e) { prec = {}; }
  const p = profil || {};
  const out = {
    naissance: dateIso_(p.birthday || p.birthdate || p['birth-date']) || prec.naissance || null,
    sexe: sexe_(p.gender || p.sex) || prec.sexe || null,
    vo2: estNum_(p.vo2_max) ? p.vo2_max : estNum_(p['vo2-max']) ? p['vo2-max'] : (estNum_(prec.vo2) ? prec.vo2 : null),
    vo2Date: dateIso_(p.modified || p.created) || prec.vo2Date || null,
  };
  if ((!out.naissance || !out.sexe) && P.getProperty('USER_ID')) {
    // Données d'inscription Polar (on ne garde que la date de naissance et le sexe)
    try {
      const u = api_('/users/' + P.getProperty('USER_ID')) || {};
      out.naissance = out.naissance || dateIso_(u.birthdate);
      out.sexe = out.sexe || sexe_(u.gender);
    } catch (e) { /* profil indisponible : le module reste en attente, la mise à jour continue */ }
  }
  P.setProperty('PROFIL_LONGEVITE', JSON.stringify(out));
  return out;
}

function lireProfilLongevite_() {
  try { return JSON.parse(P.getProperty('PROFIL_LONGEVITE') || '{}') || {}; } catch (e) { return {}; }
}
function dateIso_(x) { const m = /^(\d{4}-\d\d-\d\d)/.exec(String(x || '')); return m ? m[1] : null; }
function sexe_(g) { const s = String(g || '').toUpperCase(); return /^F/.test(s) ? 'F' : /^M/.test(s) ? 'H' : null; }
function dernier_(o) { return Array.isArray(o) ? (o[o.length - 1] || {}) : (o || {}); }

/** Séances par jour : MET-h (d'après la FC moyenne) et minutes de renforcement ; liste des codes sport rencontrés. */
function seancesParJour_(seances, fcRepos, fcMax) {
  const M = CFG.LONGEVITE.MVPA, re = new RegExp(CFG.LONGEVITE.RENFO.SPORTS, 'i'), jours = {}, sports = {};
  (seances || []).forEach(s => {
    const d = String(s.start_time || '').slice(0, 10);
    if (!/^\d{4}-\d\d-\d\d$/.test(d)) return;
    const du = /PT(?:(\d+)H)?(?:(\d+)M)?(?:([\d.]+)S)?/.exec(String(s.duration || '')) || [];
    const min = (+du[1] || 0) * 60 + (+du[2] || 0) + (+du[3] || 0) / 60;
    const code = [s.sport, s.detailed_sport_info].filter(Boolean).join(' / ');
    const renfo = re.test(code);
    if (code) sports[code] = renfo;
    const fc = s.heart_rate && s.heart_rate.average, reserve = fcMax - fcRepos;
    const fcr = estNum_(fc) && reserve > 0 ? (fc - fcRepos) / reserve : null;
    const met = fcr === null ? M.MET_SEANCE_SANS_FC : fcr >= M.FCR_VIGOUREUSE ? M.MET_VIGOUREUX : fcr >= M.FCR_MODEREE ? M.MET_MODERE : 0;
    const j = jours[d] = jours[d] || { meth: 0, renfo: 0 };
    j.meth += met * min / 60;
    if (renfo) j.renfo += min;
  });
  return { jours: jours, sports: sports };
}

/** Résultat complet pour le jour d : écart (lissé), intervalle, rythme, contributions, leviers, qualité. */
function calculLongevite_(lignesDonnees, lignesSommeil, d, profil) {
  const L = CFG.LONGEVITE;
  const e = entreesLongevite_(lignesDonnees, lignesSommeil, d, profil), x = e.x;
  const central = modeleLongevite_(x);
  const dates = Object.keys(lignesDonnees).filter(k => k <= d).sort();
  const serie = dates.map(k => [k, lignesDonnees[k][37]]);
  const res = { d: d, qualite: e.qualite, x: x, profil: { sexe: profil.sexe || null, naissance: !!profil.naissance },
    vo2: { valeur: x.vo2, date: profil.vo2Date || null, brut: estNum_(profil.vo2) ? profil.vo2 : null,
      ageJ: profil.vo2Date ? jour_(d) - jour_(profil.vo2Date) : null, ref: estNum_(x.age) ? refVo2_(x.age, x.sexe) : null },
    contributions: central.contributions, deltaCentral: central.delta, leviers: leviersLongevite_(x),
    historique: dates.filter(k => estNum_(lignesDonnees[k][37])).slice(-120).map(k => [k, lignesDonnees[k][37]]) };
  if (e.qualite.ok) {
    const mc = monteCarloLongevite_(x);
    const lisse = estNum_((lignesDonnees[d] || [])[37]) ? lignesDonnees[d][37] : mc.p50;
    // Intervalle centré sur l'écart lissé : on garde la largeur P10–P90 du jour (CONVENTION d'affichage)
    Object.assign(res, { ageCivil: x.age, p50: mc.p50, p10: mc.p10, p90: mc.p90, lisse: lisse,
      bas: lisse + mc.p10 - mc.p50, haut: lisse + mc.p90 - mc.p50, rythme: rythme_(serie, d) });
  }
  return res;
}

/** Appelé par l'onglet Longévité du dashboard. */
function detailLongevite(k) {
  if (!k || k !== P.getProperty('DASH_KEY')) throw new Error('Accès refusé.');
  const ss = classeur_(), tz = Session.getScriptTimeZone();
  const shS = ss.getSheetByName(CFG.FEUILLE_SOMMEIL), shD = ss.getSheetByName(CFG.FEUILLE);
  const ld = shD ? lire_(shD) : {};
  const d = Utilities.formatDate(new Date(), tz, 'yyyy-MM-dd');
  const res = calculLongevite_(ld, shS ? lireSommeil_(shS) : {}, d, lireProfilLongevite_());
  let sports = {};
  try { sports = JSON.parse(P.getProperty('SPORTS_VUS') || '{}') || {}; } catch (e) { sports = {}; }
  res.sports = sports;
  res.methode = CFG.LONGEVITE;
  return res;
}

/**
 * Publication hebdomadaire dans la feuille « Longévité » : le lundi à partir de 9 h (déclenchement de 9 h),
 * une ligne par semaine ; ou immédiatement si la feuille est vide.
 */
function publierLongevite_(lignesDonnees, lignesSommeil, profil) {
  const ss = classeur_(), tz = Session.getScriptTimeZone(), now = new Date();
  const sh = ss.getSheetByName('Longévité') || ss.insertSheet('Longévité');
  colonnes_(sh, ENTETES_LONGEVITE.length);
  sh.getRange(1, 1, 1, ENTETES_LONGEVITE.length).setValues([ENTETES_LONGEVITE]).setFontWeight('bold');
  sh.setFrozenRows(1);
  const d = Utilities.formatDate(now, tz, 'yyyy-MM-dd');
  const lundi9 = Utilities.formatDate(now, tz, 'u') === '1' && +Utilities.formatDate(now, tz, 'H') >= 9;
  const n = sh.getLastRow() - 1;
  const deja = n > 0 && sh.getRange(2, 1, n, 1).getValues().some(r =>
    (r[0] instanceof Date ? Utilities.formatDate(r[0], tz, 'yyyy-MM-dd') : String(r[0])) === d);
  if (deja || (n > 0 && !lundi9)) return;
  sh.appendRow(ligneLongevite_(calculLongevite_(lignesDonnees, lignesSommeil, d, profil)));
}

/** Ligne de la feuille « Longévité » (ordre de ENTETES_LONGEVITE). */
function ligneLongevite_(r) {
  const v = (x, dec) => (estNum_(x) ? Math.round(x * Math.pow(10, dec)) / Math.pow(10, dec) : '');
  const c = r.contributions || {}, x = r.x || {};
  return [r.d, v(x.age, 2), v(r.p50, 2), v(r.p10, 2), v(r.p90, 2), v(r.lisse, 2),
    estNum_(r.lisse) && estNum_(x.age) ? v(x.age + r.lisse, 1) : '', v(r.rythme, 2),
    v(c.vo2, 2), v(c.fc, 2), v(c.pas, 2), v(c.mvpa, 2), v(c.renfo, 2), v(c.sommeil, 2), v(c.sri, 2),
    v(x.vo2, 1), v(x.fc, 1), v(x.pas, 0), v(x.mvpa, 1), v(x.renfo, 0), v(x.sommeil, 2), v(x.sri, 1),
    r.qualite.nuits, r.qualite.jours];
}

/* ======================= 3. Modèle de score ======================= */

/**
 * Récupération : pour chaque composante, z = sens × (valeur du jour − moyenne) / écart-type,
 * calculés sur les nuits des 28 jours précédents (le jour lui-même exclu).
 *   HRV en ln(RMSSD) (sens +), FC de nuit (sens −), respiration (sens −), score de sommeil (sens +).
 * Z = moyenne pondérée des z (poids renormalisés sur les composantes disponibles),
 * Récupération = 100 × Φ(Z), Φ = fonction de répartition de la loi normale.
 * Zones Whoop : ≥ 67 vert, 34–66 jaune, ≤ 33 rouge.
 */
function calculer_(l, rows, i) {
  const t = jour_(l[0]);
  const fen = rows.slice(0, i).filter(r => t - jour_(r[0]) <= CFG.FENETRE_BASELINE_J);
  const lnOuVide = v => (estNum_(v) && v > 0 ? Math.log(v) : '');
  const comp = [
    { k: 'hrv', v: lnOuVide(l[1]), base: fen.map(r => lnOuVide(r[1])), sens: +1 },
    { k: 'fc', v: l[2], base: fen.map(r => r[2]), sens: -1 },
    { k: 'resp', v: l[3], base: fen.map(r => r[3]), sens: -1 },
    { k: 'sommeil', v: l[4], base: fen.map(r => r[4]), sens: +1 },
  ];

  let somme = 0, poids = 0, hrvOk = false;
  comp.forEach(c => {
    if (!estNum_(c.v)) return;
    const b = c.base.filter(estNum_);
    if (b.length < CFG.MIN_NUITS_BASELINE) return;
    const m = moy_(b), s = ecartType_(b, m);
    if (!(s > 0)) return;
    somme += CFG.POIDS[c.k] * c.sens * (c.v - m) / s;
    poids += CFG.POIDS[c.k];
    if (c.k === 'hrv') hrvOk = true;
  });

  if (hrvOk) {
    const rec = Math.round(100 * phi_(somme / poids));
    l[11] = rec;
    l[12] = rec >= 67 ? 'Vert' : rec >= 34 ? 'Jaune' : 'Rouge';
  } else {
    l[11] = '';
    l[12] = estNum_(l[1]) ? 'Calibration' : '';
  }

  // Strain 0–21 : échelle logarithmique de la charge cardio du jour, plafonnée à 21.
  l[13] = estNum_(l[7])
    ? Math.round(10 * Math.min(21, 21 * Math.log(1 + l[7]) / Math.log(1 + CFG.CHARGE_REF_STRAIN_21))) / 10
    : '';
  l[14] = { Vert: '14 – 18', Jaune: '10 – 14', Rouge: '0 – 10' }[l[12]] || '';

  // Strain de la journée = séances (charge cardio Polar) + reste de la journée (FC continue), même échelle.
  l[19] = estNum_(l[7]) || estNum_(l[18]) ? echelleStrain_((estNum_(l[7]) ? l[7] : 0) + (estNum_(l[18]) ? l[18] : 0)) : '';
}

function echelleStrain_(charge) {
  return Math.round(10 * Math.min(21, 21 * Math.log(1 + charge) / Math.log(1 + CFG.CHARGE_REF_STRAIN_21))) / 10;
}

/* ======================= 3 bis. Journée : strain continu et stress ======================= */

/**
 * La montre mesure la FC toutes les 5 min au repos et toutes les secondes dès que tu bouges :
 * chaque mesure est donc pondérée par sa durée réelle dt (écart jusqu'à la mesure suivante, plafonné à 5 min).
 *  - Charge hors séances (TRIMP de Banister) : Σ dt (min) × FCr × 0,64 × e^(1,92 × FCr),
 *    FCr = (FC − FC repos) / (FC max − FC repos), uniquement si FCr ≥ CFG.SEUIL_FCR_STRAIN.
 *  - Stress : la journée est découpée en tranches de 5 min ; une tranche est « au repos éveillé » si elle
 *    est entre le réveil et le coucher, avec moins de CFG.STRESS_PAS_MAX pas, hors récupération post-séance.
 *    Sa FC = moyenne pondérée par dt. Le 25e centile de ces tranches = FC d'éveil au repos du jour.
 * Le stress est calculé ensuite (stressJournee_) par rapport à la référence personnelle.
 */
function analyserJournee_(d, echantillons, ctx) {
  const reserve = ctx.fcMax - ctx.fcRepos;
  const nuitMatin = ctx.nuits[d], nuitSoir = ctx.nuits[lendemain_(d)];
  const finSommeil = nuitMatin && String(nuitMatin.sleep_end_time).slice(0, 10) === d ? minutesIso_(nuitMatin.sleep_end_time) : 360;
  const debutSommeil = nuitSoir && String(nuitSoir.sleep_start_time).slice(0, 10) === d ? minutesIso_(nuitSoir.sleep_start_time) : 1440;
  const pas = ctx.pas[d];
  const seances = ctx.seances[d] || [];

  const ech = echantillons
    .map(e => ({ t: secondesHeure_(e.sample_time), fc: e.heart_rate }))
    .filter(e => estNum_(e.t) && estNum_(e.fc))
    .sort((x, y) => x.t - y.t);

  let trimp = 0, minMod = 0, minVig = 0;
  const tranches = {};
  const M = CFG.LONGEVITE.MVPA;
  const enSeance = sec => seances.some(s => sec / 60 >= s[0] && sec / 60 < s[1]);
  ech.forEach((e, k) => {
    const suiv = k + 1 < ech.length ? ech[k + 1].t : 86400;
    const dt = Math.min(suiv - e.t, 300);
    if (dt <= 0) return;
    const fcr = reserve > 0 ? (e.fc - ctx.fcRepos) / reserve : 0;
    if (fcr >= CFG.SEUIL_FCR_STRAIN) trimp += (dt / 60) * fcr * 0.64 * Math.exp(1.92 * fcr);
    // Activité modérée à vigoureuse hors séances (les séances sont comptées à part, sans double compte)
    if (!enSeance(e.t)) {
      if (fcr >= M.FCR_VIGOUREUSE) minVig += dt / 60;
      else if (fcr >= M.FCR_MODEREE) minMod += dt / 60;
    }
    const b = Math.floor(e.t / 300);
    const tr = tranches[b] = tranches[b] || { s: 0, dt: 0 };
    tr.s += e.fc * dt;
    tr.dt += dt;
  });

  const fenetres = [];
  if (pas) {
    Object.keys(tranches).forEach(k => {
      const tr = tranches[k], m = Number(k) * 5;
      if (tr.dt < 60 || m < finSommeil || m >= debutSommeil) return;
      if (seances.some(s => m + 5 > s[0] && m <= s[1] + CFG.STRESS_APRES_SEANCE_MIN)) return;
      let p = 0;
      for (let q = Math.max(0, m - 1); q < Math.min(1440, m + 5); q++) p += pas[q] || 0;
      if (p >= CFG.STRESS_PAS_MAX) return;
      fenetres.push({ m: m, fc: tr.s / tr.dt });
    });
  }

  const fcs = fenetres.map(f => f.fc).sort((x, y) => x - y);
  // Couverture : tranches de 5 min avec au moins une mesure, ou comprises dans une séance (FC enregistrée à part)
  let couvertes = 0;
  for (let b = 0; b < 288; b++) if (tranches[b] || seances.some(s => b * 5 + 5 > s[0] && b * 5 < s[1])) couvertes++;
  return {
    couverture: ech.length ? Math.round(100 * couvertes / 288) : '',
    methHors: ech.length ? Math.round((minMod * M.MET_MODERE + minVig * M.MET_VIGOUREUX) / 60 * 10) / 10 : '',
    trimp: ech.length ? Math.round(trimp * 10) / 10 : '',
    p25: fcs.length >= CFG.STRESS_MIN_FENETRES ? Math.round(fcs[Math.floor(0.25 * (fcs.length - 1))] * 10) / 10 : '',
    fenetres: fenetres,
  };
}

/**
 * Stress 0–3 : niveau = (FC − référence d'éveil au repos) / 10, borné à [0 ; 3]
 * (+10 bpm = 1 modéré, +20 bpm = 2 élevé, +30 bpm = 3 maximum).
 * Stress du jour = moyenne des niveaux ; minutes élevées = fenêtres à niveau ≥ 2, × 5 min.
 */
function stressJournee_(fenetres, base) {
  if (!estNum_(base) || fenetres.length < CFG.STRESS_MIN_FENETRES) return { stress: '', minEleve: '', horaire: '' };
  const niveaux = [], parHeure = {};
  fenetres.forEach(f => {
    const niv = Math.max(0, Math.min(3, (f.fc - base) / 10));
    niveaux.push(niv);
    const h = Math.floor(f.m / 60);
    (parHeure[h] = parHeure[h] || []).push(niv);
  });
  return {
    stress: Math.round(10 * moy_(niveaux)) / 10,
    minEleve: niveaux.filter(n => n >= 2).length * 5,
    horaire: Array.from({ length: 24 }, (_, h) => parHeure[h] ? (Math.round(10 * moy_(parHeure[h])) / 10).toFixed(1) : '').join(';'),
  };
}

function mediane_(a) { const s = a.slice().sort((x, y) => x - y), k = s.length >> 1; return s.length % 2 ? s[k] : (s[k - 1] + s[k]) / 2; }

/** FC continue des derniers jours (28 au premier passage, puis CFG.JOURS_FC_CONTINUE) : { 'aaaa-mm-jj': [échantillons] }. */
function fcContinue_() {
  // FC_INIT = '2' : 28 jours déjà relus avec le calcul de couverture et d'activité (module Longévité)
  const n = P.getProperty('FC_INIT') === '2' ? CFG.JOURS_FC_CONTINUE : 28;
  const tz = Session.getScriptTimeZone();
  const dates = Array.from({ length: n }, (_, k) => Utilities.formatDate(new Date(Date.now() - k * 864e5), tz, 'yyyy-MM-dd'));
  const auth = { Authorization: 'Bearer ' + P.getProperty('ACCESS_TOKEN'), Accept: 'application/json' };
  const reps = UrlFetchApp.fetchAll(dates.map(d => ({
    url: API + '/users/continuous-heart-rate/' + d, headers: auth, muteHttpExceptions: true,
  })));
  const out = {};
  reps.forEach((r, k) => {
    if (r.getResponseCode() !== 200) return;
    const s = (JSON.parse(r.getContentText() || '{}').heart_rate_samples) || [];
    if (s.length) out[dates[k]] = s;
  });
  P.setProperty('FC_INIT', '2');
  return out;
}

/** Pas minute par minute : { 'aaaa-mm-jj': tableau de 1440 }. */
function pasParMinute_(activites) {
  const out = {};
  activites.forEach(a => {
    const d = String(a.start_time || '').slice(0, 10);
    const ech = a.samples && a.samples.steps && a.samples.steps.samples;
    if (!d || !ech) return;
    const t = out[d] = out[d] || new Array(1440).fill(0);
    ech.forEach(e => {
      const ts = String(e.timestamp || '');
      if (ts.slice(0, 10) !== d) return;
      const m = minutesHeure_(ts.slice(11));
      if (estNum_(m)) t[m] += e.steps || 0;
    });
  });
  return out;
}

/** Séances par date : [[début, fin] en minutes depuis minuit]. */
function fenetresSeances_(seances) {
  const out = {};
  seances.forEach(s => {
    const st = String(s.start_time || '');
    const d = st.slice(0, 10), m0 = minutesHeure_(st.slice(11));
    if (!d || !estNum_(m0)) return;
    const du = /PT(?:(\d+)H)?(?:(\d+)M)?(?:([\d.]+)S)?/.exec(String(s.duration || '')) || [];
    const min = (+du[1] || 0) * 60 + (+du[2] || 0) + (+du[3] || 0) / 60;
    (out[d] = out[d] || []).push([m0, m0 + min]);
  });
  return out;
}

function indexer_(liste, cle) { const o = {}; liste.forEach(x => { const k = cle(x); if (k) o[k] = x; }); return o; }
function minutesHeure_(hms) { const p = String(hms).split(':').map(Number); return p.length >= 2 && isFinite(p[0]) && isFinite(p[1]) ? p[0] * 60 + p[1] : NaN; }
function secondesHeure_(hms) { const p = String(hms).split(':').map(Number); return p.length >= 2 && isFinite(p[0]) && isFinite(p[1]) ? p[0] * 3600 + p[1] * 60 + (isFinite(p[2]) ? p[2] : 0) : NaN; }
function minutesIso_(iso) { return minutesHeure_(String(iso).slice(11, 16)); }
function lendemain_(d) { return Utilities.formatDate(new Date(Date.UTC(+d.slice(0, 4), +d.slice(5, 7) - 1, +d.slice(8, 10) + 1, 12)), 'UTC', 'yyyy-MM-dd'); }

/* ======================= 4. Déclencheurs ======================= */

function installerDeclencheurs() {
  ScriptApp.getProjectTriggers()
    .filter(t => t.getHandlerFunction() === 'majQuotidienne')
    .forEach(t => ScriptApp.deleteTrigger(t));
  CFG.HEURES_MAJ.forEach(h => ScriptApp.newTrigger('majQuotidienne').timeBased().everyDays(1).atHour(h).create());
}

/* ======================= 5. Dashboard (application web) ======================= */

/** Génère la clé privée du dashboard et affiche le lien à ouvrir sur ton téléphone. */
function creerLienDashboard() {
  let k = P.getProperty('DASH_KEY');
  if (!k) { k = Utilities.getUuid().replace(/-/g, ''); P.setProperty('DASH_KEY', k); }
  const base = ScriptApp.getService().getUrl();
  if (!base) throw new Error('Déploie d\'abord le script en application Web (Déployer → Nouveau déploiement).');
  const url = base + '?k=' + k;
  Logger.log('Lien du dashboard : ' + url);
  try {
    SpreadsheetApp.getUi().showModalDialog(HtmlService.createHtmlOutput(
      '<p style="font:15px sans-serif"><a href="' + url + '" target="_blank">Ouvrir le dashboard</a></p>' +
      '<p style="font:13px sans-serif;color:#666;word-break:break-all">' + url + '</p>'), 'Dashboard');
  } catch (e) { /* lancé depuis l'éditeur : le lien est dans le journal d'exécution */ }
}

function servirDashboard_(p) {
  const cle = P.getProperty('DASH_KEY');
  if (!cle || p.k !== cle) return page_('Accès refusé.');
  const t = HtmlService.createTemplateFromFile('Dashboard');
  t.data = json_(donneesDashboard_());
  t.cle = json_(cle);
  return t.evaluate()
    .setTitle('Récupération')
    .addMetaTag('viewport', 'width=device-width, initial-scale=1, viewport-fit=cover');
}

/** Appelé par le bouton « Mettre à jour » du dashboard. */
function rafraichirDashboard(k) {
  if (!k || k !== P.getProperty('DASH_KEY')) throw new Error('Accès refusé.');
  majQuotidienne();
  return donneesDashboard_();
}

function donneesDashboard_() {
  const sh = classeur_().getSheetByName(CFG.FEUILLE);
  if (!sh) return [];
  const v = x => (typeof x === 'number' && isFinite(x) ? x : null);
  const coche = x => (x === true || x === 1 || x === '1' ? 1 : 0);
  const lignes = lire_(sh), reveils = lireReveils_();
  return Object.keys(lignes).sort().map(d => {
    const r = lignes[d];
    const solide = estNum_(r[26])
      ? planSoir_(r[26], estNum_(r[30]) ? r[30] : CFG.COACH.EFF_DEFAUT, minutesHeure_(reveils[jourReveil_(d)])).solide.heure : null;
    return {
      d: d, hrv: v(r[1]), fc: v(r[2]), resp: v(r[3]), sommeil: v(r[4]), nr: v(r[5]), ans: v(r[6]),
      charge: v(r[7]), strain7: v(r[8]), tol: v(r[9]), ratio: v(r[10]), rec: v(r[11]),
      zone: r[12] || null, strain: v(r[13]), alcool: coche(r[15]), repas: coche(r[16]),
      trimpJ: v(r[18]), strainJ: v(r[19]), stress: v(r[20]), stressMin: v(r[21]), pas: v(r[22]), cal: v(r[23]),
      stressH: r[24] ? String(r[24]).split(';').map(x => (x === '' ? null : Number(x))) : null,
      besoin: v(r[26]), dette: v(r[27]), perf: v(r[28]), regul: v(r[29]), eff: v(r[30]), solide: solide,
    };
  });
}

function json_(o) { return JSON.stringify(o).replace(/</g, '\\u003c'); }

/* ======================= Outils ======================= */

function api_(chemin) {
  const r = UrlFetchApp.fetch(API + chemin, {
    headers: { Authorization: 'Bearer ' + P.getProperty('ACCESS_TOKEN'), Accept: 'application/json' },
    muteHttpExceptions: true,
  });
  const c = r.getResponseCode();
  if (c === 204 || c === 404) return null;
  if (c >= 400) throw new Error(chemin + ' → HTTP ' + c + ' : ' + r.getContentText());
  const txt = r.getContentText();
  return txt ? JSON.parse(txt) : null;
}

function classeur_() {
  const actif = SpreadsheetApp.getActiveSpreadsheet();
  if (actif) { P.setProperty('SHEET_ID', actif.getId()); return actif; }
  return SpreadsheetApp.openById(P.getProperty('SHEET_ID')); // appel depuis le dashboard
}

function feuille_() {
  const ss = classeur_();
  const sh = ss.getSheetByName(CFG.FEUILLE) || ss.insertSheet(CFG.FEUILLE);
  colonnes_(sh, ENTETES.length);
  sh.getRange(1, 1, 1, ENTETES.length).setValues([ENTETES]).setFontWeight('bold');
  sh.setFrozenRows(1);
  return sh;
}

function lire_(sh) {
  const out = {};
  const n = sh.getLastRow() - 1;
  if (n < 1) return out;
  const tz = Session.getScriptTimeZone();
  const nc = Math.min(sh.getMaxColumns(), ENTETES.length); // feuille pas encore élargie : colonnes manquantes = vides
  sh.getRange(2, 1, n, nc).getValues().forEach(r => {
    while (r.length < ENTETES.length) r.push('');
    if (!r[0]) return;
    r[0] = r[0] instanceof Date ? Utilities.formatDate(r[0], tz, 'yyyy-MM-dd') : String(r[0]);
    out[r[0]] = r;
  });
  return out;
}

/** Ajoute des colonnes si la feuille en a moins que n (une feuille neuve en a 26). */
function colonnes_(sh, n) { if (sh.getMaxColumns() < n) sh.insertColumnsAfter(sh.getMaxColumns(), n - sh.getMaxColumns()); }

function nouvelleLigne_(d) { const l = new Array(ENTETES.length).fill(''); l[0] = d; return l; }

function colorer_(sh, rows) {
  const c = { Vert: '#b7e1cd', Jaune: '#fce8b2', Rouge: '#f4c7c3' };
  sh.getRange(2, 12, rows.length, 2).setBackgrounds(rows.map(r => { const b = c[r[12]] || null; return [b, b]; }));
}

function jour_(d) { const [y, m, j] = String(d).split('-').map(Number); return Date.UTC(y, m - 1, j) / 864e5; }
function num_(v) { return typeof v === 'number' && isFinite(v) ? v : ''; }
function estNum_(v) { return typeof v === 'number' && isFinite(v); }
function moy_(a) { return a.reduce((s, x) => s + x, 0) / a.length; }
function ecartType_(a, m) { return Math.sqrt(a.reduce((s, x) => s + (x - m) * (x - m), 0) / (a.length - 1)); }

/** Φ(x), fonction de répartition de la loi normale centrée réduite (Abramowitz & Stegun 7.1.26). */
function phi_(x) {
  const t = 1 / (1 + 0.3275911 * Math.abs(x) / Math.SQRT2);
  const erf = 1 - ((((1.061405429 * t - 1.453152027) * t + 1.421413741) * t - 0.284496736) * t + 0.254829592) * t * Math.exp(-x * x / 2);
  return x >= 0 ? (1 + erf) / 2 : (1 - erf) / 2;
}

/** Diagnostic : affiche la forme des données Polar dans le journal d'exécution (aucune écriture). */
function diagnostic() {
  const tz = Session.getScriptTimeZone();
  const d = n => Utilities.formatDate(new Date(Date.now() - n * 864e5), tz, 'yyyy-MM-dd');
  const show = (label, o) => Logger.log(label + ' → ' + JSON.stringify(o).slice(0, 1800));
  const hr = api_('/users/continuous-heart-rate/' + d(1));
  const s = (hr && hr.heart_rate_samples) || [];
  show('FC continue (hier)', hr && { keys: Object.keys(hr), n: s.length, debut: s.slice(0, 3), fin: s.slice(-2) });
  const hrr = api_('/users/continuous-heart-rate?from=' + d(3) + '&to=' + d(1));
  show('FC continue (plage)', hrr && (Array.isArray(hrr) ? { tableau: hrr.length, cles: Object.keys(hrr[0] || {}) } : { cles: Object.keys(hrr) }));
  const nuits = (api_('/users/sleep') || {}).nights || [];
  const der = nuits[nuits.length - 1] || {};
  show('Sommeil (dernière nuit)', Object.keys(der).filter(k => k !== 'hypnogram' && k !== 'heart_rate_samples').reduce((o, k) => (o[k] = der[k], o), {}));
  const act = api_('/users/activities?steps=true&from=' + d(2) + '&to=' + d(1));
  show('Activité', act && act.map(a => ({ debut: a.start_time, pas: a.steps, cal: a.active_calories,
    ech: a.samples && a.samples.steps && { intervalle: a.samples.steps.interval_ms, n: (a.samples.steps.samples || []).length, debut: (a.samples.steps.samples || []).slice(0, 3) } })));
  const ex = api_('/exercises');
  show('Séances', ex && ex.slice(-3).map(e => ({ debut: e.start_time, duree: e.duration, sport: e.sport })));
  const pi = dernier_(api_('/users/physical-info'));
  show('Profil', pi && { cles: Object.keys(pi), fc_max: pi.maximum_heart_rate, fc_repos: pi.resting_heart_rate, vo2: pi.vo2_max,
    modifie: pi.modified, naissance: !!(pi.birthday || pi.birthdate), sexe: pi.gender || pi.sex });
  show('Codes sport des séances', ex && Object.keys(seancesParJour_(ex, 60, 190).sports));
}
