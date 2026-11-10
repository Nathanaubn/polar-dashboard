# Méthode de calcul

🇬🇧 [English version](../METHODOLOGY.md)

Toutes les constantes sont dans l'objet `CFG` en tête de `src/Code.js`. Ce qui ne vient pas d'une étude publiée y est marqué
comme **convention** : ce sont des choix raisonnables, réglables. Rien ici n'est un avis médical.

## Récupération (0–100)

Pour chaque composante, z = sens × (valeur du jour − moyenne) / écart-type, calculés sur les nuits des 28 jours précédents
(le jour exclu, au moins 7 nuits, sinon « Calibration ») :

| Composante | Sens | Poids |
|---|---|---|
| ln(HRV RMSSD de la nuit) | + | 0,50 |
| FC de la nuit | − | 0,25 |
| Respiration | − | 0,10 |
| Score de sommeil Polar | + | 0,15 |

Z = moyenne pondérée des z disponibles, récupération = 100 × Φ(Z) (loi normale).
Zones : ≥ 67 vert, 34–66 jaune, ≤ 33 rouge.

## Strain (0–21)

Échelle logarithmique de la charge cardio (TRIMP) : strain = 21 × ln(1 + charge) / ln(1 + 400), plafonné à 21.
Le **strain de la journée** ajoute à la charge des séances (Polar) celle de la FC continue hors séances :
TRIMP de Banister, Σ dt × FCr × 0,64 × e^(1,92 × FCr), pour FCr ≥ 30 % de la FC de réserve. Chaque mesure est pondérée
par sa durée réelle (la montre mesure toutes les 5 min au repos, toutes les secondes en mouvement).

## Stress (0–3)

Tranches de 5 min éveillé, au repos (< 50 pas, hors séance et 30 min après), entre le réveil et le coucher.
Niveau = (FC de la tranche − référence) / 10 bpm, borné à [0 ; 3]. Référence = médiane, sur 14 jours, du 25e centile
quotidien de ces FC. Il faut au moins 1 h de tranches valides dans la journée.

## Coach de sommeil

1. **Besoin de base** : médiane du sommeil réel (léger + profond + paradoxal) des nuits suivies d'une récupération ≥ 67
   sur 28 jours, s'il y en a au moins 5 ; sinon l'objectif de sommeil Polar ; sinon 480 min. Borné à 420–540.
2. **Strain** : +4 min par point de strain de la journée au-dessus de 10, plafonné à 45 min.
3. **Dette** : 0,5 × déficit J−1 + 0,3 × J−2 + 0,2 × J−3 (poids renormalisés si une nuit manque), plafonnée à 60 min.
   Déficit = max(0, besoin **de base** du soir précédent − sommeil réel).
4. **Récupération** : +15 min si récupération ≤ 33.
5. **Besoin total** = somme, plafonnée à 600 min.
6. **Heures de coucher** pour Optimal (100 % du besoin), Solide (85 %), Minimum (70 %) :
   réveil visé − (besoin × cible / efficacité + 15 min d'endormissement). Efficacité = médiane des 7 dernières nuits
   (sommeil réel / temps au lit), bornée 0,80–0,98.
7. **Régularité** : écart moyen des heures d'endormissement et de réveil sur 4 nuits (moyenne circulaire autour de minuit),
   score = 100 × max(0, 1 − (écart coucher + écart réveil) / 120).

Les coefficients sont des conventions inspirées des planificateurs de sommeil du commerce, dont les formules ne sont pas publiées.
Polar ne détecte pas les siestes.

## Longévité : âge physiologique et rythme de vieillissement

### Principe

La mortalité adulte croît de façon quasi exponentielle avec l'âge (loi de Gompertz) : h(âge) = a·e^(b·âge), et double
environ tous les 8 ans, donc b = ln 2 / 8 ≈ 0,0866 par an. Si les habitudes multiplient le risque par HR par rapport à
la personne typique du même âge et du même sexe, ce risque est celui d'une personne typique plus âgée de **Δ = ln(HR) / b**.

ln(HR) est la somme des ln HR relatifs de chaque indicateur (HR de la valeur mesurée / HR de la valeur de référence).
Les courbes dose-réponse sont interpolées linéairement en ln(HR) entre les points publiés, et plates au-delà.

### Indicateurs

| Indicateur | Mesure | Courbe (HR, IC 95 %) | Référence | Source |
|---|---|---|---|---|
| VO2max | Test de forme Polar (≤ 90 j) | RR 0,87 (0,84–0,90) par MET (3,5 mL/kg/min), écart borné à ±3 MET | Médiane FRIEND par âge et sexe | Kodama et al., *JAMA* 2009 ; Kaminsky et al., *Mayo Clin Proc* 2015 |
| FC de repos | Médiane 28 j de la FC éveillé au repos | RR 1,09 (1,04*–1,12) par +10 bpm | 65 bpm (convention) | Zhang et al., *CMAJ* 2016 |
| Pas | Moyenne des jours portés en entier | 3 553 → 1 ; 5 801 → 0,60 (0,51–0,71) ; 7 842 → 0,55 (0,49–0,62) ; 10 901 → 0,47 (0,39–0,57) ; plateau à 10 000 avant 60 ans | 6 800 (convention) | Paluch et al., *Lancet Public Health* 2022 |
| Activité modérée à vigoureuse | MET-h/semaine (FC de réserve ≥ 40 % = 4 MET, ≥ 60 % = 8 MET, + séances) | 0 → 1 ; 3,75 → 0,80 ; 11,25 → 0,69 ; 18,75 → 0,63 ; 22,5–75 → 0,61 ; 112,5 → 0,69 | 7,5 MET-h (minimum OMS) | Arem et al., *JAMA Intern Med* 2015 |
| Renforcement | Min/semaine de séances de renforcement | 0 → 1 ; 45 min → 0,85 (0,79–0,93), plateau | 0 | Momma et al., *Br J Sports Med* 2022 |
| Durée de sommeil | Sommeil réel, converti en durée déclarée : 6,8 + 0,567 × (mesuré − 6) | Minimum à 7 h ; RR 1,06 (1,04–1,07) par heure en moins, 1,13 (1,11–1,15) par heure en plus | 7 h | Yin et al., *J Am Heart Assoc* 2017 ; Lauderdale et al., *Epidemiology* 2008 |
| Régularité (SRI) | 200 × P(même état endormi/éveillé à 24 h d'écart) − 100, minute par minute depuis l'hypnogramme | 41 → 1,42 ; 60 → 1 ; 75 → 0,90, plateau | 60 (médiane de la cohorte) | Windred et al., *Sleep* 2024 |

\* 1,04 : estimation après correction du biais de publication, utilisée comme borne basse.

### Recouvrement entre indicateurs (convention)

Aucune étude ne combine ces 7 variables. Domaine Activité = moyenne des ln HR des pas et de l'activité, plus le
renforcement. Si la VO2max est connue, facteur 0,5 sur le domaine Activité et sur la FC de repos. Sommeil = durée + régularité.
Δ borné à ±10 ans.

### Incertitude

Monte Carlo, 2 000 tirages à graine fixe : chaque ln HR publié tiré selon son IC (écart-type = (ln haut − ln bas) / 3,92),
doublement de la mortalité entre 7 et 9 ans, recouvrement entre 0,3 et 1,0, VO2max ± 3,5 mL/kg/min, SRI décalé de −15 à 0
(les cohortes utilisent des accéléromètres). On affiche la médiane et l'intervalle de 80 % (P10–P90).

### Qualité des données

Âge affiché seulement avec au moins 21 nuits et 14 jours « portés en entier » (FC continue sur ≥ 80 % des tranches de
5 min) sur les 31 derniers jours ; sinon « En calibration ».

### Lissage et rythme

Âge affiché = âge civil + moyenne mobile exponentielle des écarts quotidiens (demi-vie 60 jours).
Rythme = 1 + pente de cet écart sur 30 jours (années par année de calendrier), borné entre −1 et 3.

### Limites

- Les rapports de risque viennent surtout de cohortes de 40 à 70 ans. Chez un adulte jeune, la mortalité absolue est très
  faible : l'« âge » traduit un risque relatif, pas une espérance de vie.
- Études observationnelles : associations, pas effets prouvés à l'échelle individuelle.
- Mesures au poignet ≠ mesures des études (questionnaires, accéléromètres, tests d'effort).
- Hors périmètre : masse maigre, HRV, siestes.
- Non vérifiés sur le texte intégral lors du développement : les HR du SRI et leur incertitude (écart-type conventionnel
  de 0,08 sur ln HR), la borne 1,04 de Zhang, l'IC de Momma (sources secondaires).
