# Structure du Google Sheet

Le script crée et remplit lui-même trois feuilles. Ne déplace pas les colonnes : le script les repère par leur position.
Les colonnes du **journal manuel** (P, Q, R de « Données ») sont les seules à remplir à la main ; elles sont conservées à chaque mise à jour.
Toutes les autres sont recalculées.

## Feuille « Données » (une ligne par jour)

| Col. | En-tête | Contenu |
|---|---|---|
| A | Date | Jour (aaaa-mm-jj). Pour les mesures de nuit : matin du réveil. |
| B | RMSSD nuit (ms) | HRV moyenne de la nuit (Nightly Recharge Polar). |
| C | FC nuit (bpm) | FC moyenne de la nuit. |
| D | Respiration (/min) | Fréquence respiratoire moyenne de la nuit. |
| E | Score sommeil | Score de sommeil Polar (0–100). |
| F | Statut Nightly Recharge (1-6) | Statut Nightly Recharge Polar. |
| G | ANS charge | Charge du système nerveux autonome Polar (−10 à +10). |
| H | Charge cardio du jour | Charge cardio Polar des séances (TRIMP). |
| I | Strain 7 j (Polar) | Charge aiguë Polar (7 jours). |
| J | Tolérance 28 j (Polar) | Charge chronique Polar (28 jours). |
| K | Ratio strain/tolérance | Ratio aigu/chronique Polar. |
| L | Récupération (0-100) | Score de récupération calculé (voir METHODE.md). |
| M | Zone | Vert (≥ 67), Jaune (34–66), Rouge (≤ 33), ou Calibration. |
| N | Strain (0-21) | Strain des séances, échelle logarithmique 0–21. |
| O | Strain cible | Fourchette de strain conseillée selon la zone. |
| P | Alcool (0/1) | **Journal manuel** : 1 si alcool ce jour-là. |
| Q | Repas tardif (0/1) | **Journal manuel** : 1 si repas tardif. |
| R | Notes | **Journal manuel** : texte libre. |
| S | Charge journée hors séances | TRIMP de la FC continue hors séances. |
| T | Strain journée (0-21) | Strain de toute la journée (séances + reste). |
| U | Stress moyen (0-3) | Moyenne du stress éveillé au repos. |
| V | Minutes stress élevé | Minutes à un niveau de stress ≥ 2. |
| W | Pas | Pas du jour (Polar). |
| X | Calories actives | Calories actives (Polar). |
| Y | Stress par heure | 24 valeurs séparées par « ; » (0 h → 23 h). |
| Z | FC éveil au repos (P25) | 25e centile des FC éveillé, au repos, hors séances. |
| AA | Besoin sommeil ce soir (min) | Coach : besoin total du soir J (nuit J → J+1). |
| AB | Dette sommeil (min) | Coach : dette pondérée des 3 dernières nuits, plafonnée. |
| AC | Performance sommeil (%) | Coach : nuit J−1 → J / besoin calculé la veille. |
| AD | Régularité sommeil (0-100) | Coach : régularité des horaires sur 4 nuits. |
| AE | Efficacité sommeil (7 nuits) | Coach : médiane sommeil réel / temps au lit. |
| AF | Couverture FC continue (%) | Part des tranches de 5 min avec de la FC (≥ 80 % = jour porté en entier). |
| AG | MET-h hors séances | Activité modérée à vigoureuse d'après la FC continue. |
| AH | MET-h séances | Activité des séances d'après leur FC moyenne. |
| AI | Renforcement (min) | Minutes de séances de renforcement musculaire. |
| AJ | VO2max (mL/kg/min) | VO2max Polar valide ce jour-là (test de moins de 90 jours). |
| AK | Écart âge physiologique (ans) | Longévité : écart du jour (médiane Monte Carlo), vide en calibration. |
| AL | Écart âge lissé (ans) | Longévité : moyenne mobile exponentielle de l'écart (demi-vie 60 j). |

## Feuille « Sommeil » (une ligne par nuit)

Conservée au-delà des 28 jours que l'API Polar renvoie : c'est l'historique de tes nuits.

| Col. | En-tête | Contenu |
|---|---|---|
| A | Date | Matin du réveil. |
| B | Endormissement | Heure d'endormissement (ISO, texte). |
| C | Réveil | Heure de réveil (ISO, texte). |
| D | Léger (min) | Donnée Polar de la nuit (durées en minutes, voir l'en-tête). |
| E | Profond (min) | Donnée Polar de la nuit (durées en minutes, voir l'en-tête). |
| F | Paradoxal (min) | Donnée Polar de la nuit (durées en minutes, voir l'en-tête). |
| G | Non reconnu (min) | Donnée Polar de la nuit (durées en minutes, voir l'en-tête). |
| H | Interruptions (min) | Donnée Polar de la nuit (durées en minutes, voir l'en-tête). |
| I | Courtes (min) | Donnée Polar de la nuit (durées en minutes, voir l'en-tête). |
| J | Longues (min) | Donnée Polar de la nuit (durées en minutes, voir l'en-tête). |
| K | Continuité (1-5) | Donnée Polar de la nuit (durées en minutes, voir l'en-tête). |
| L | Classe continuité (1-5) | Donnée Polar de la nuit (durées en minutes, voir l'en-tête). |
| M | Cycles | Donnée Polar de la nuit (durées en minutes, voir l'en-tête). |
| N | Score sommeil | Donnée Polar de la nuit (durées en minutes, voir l'en-tête). |
| O | Score quantité | Donnée Polar de la nuit (durées en minutes, voir l'en-tête). |
| P | Score solidité | Donnée Polar de la nuit (durées en minutes, voir l'en-tête). |
| Q | Score régénération | Donnée Polar de la nuit (durées en minutes, voir l'en-tête). |
| R | Sleep Charge (1-5) | Donnée Polar de la nuit (durées en minutes, voir l'en-tête). |
| S | Ressenti (1-5) | Donnée Polar de la nuit (durées en minutes, voir l'en-tête). |
| T | Objectif (min) | Donnée Polar de la nuit (durées en minutes, voir l'en-tête). |
| U | FC moy. nuit | Donnée Polar de la nuit (durées en minutes, voir l'en-tête). |
| V | Intervalle RR moy. (ms) | Donnée Polar de la nuit (durées en minutes, voir l'en-tête). |
| W | HRV moy. (ms) | Donnée Polar de la nuit (durées en minutes, voir l'en-tête). |
| X | Respiration moy. | Donnée Polar de la nuit (durées en minutes, voir l'en-tête). |
| Y | Nightly Recharge (1-6) | Donnée Polar de la nuit (durées en minutes, voir l'en-tête). |
| Z | ANS charge | Donnée Polar de la nuit (durées en minutes, voir l'en-tête). |
| AA | Statut ANS (1-5) | Donnée Polar de la nuit (durées en minutes, voir l'en-tête). |
| AB | Hypnogramme | JSON « HH:MM » → phase (0 éveil, 1 paradoxal, 2-3 léger, 4 profond, 5 non reconnu). |
| AC | FC sommeil | JSON « HH:MM » → FC. |
| AD | HRV nuit | JSON « HH:MM » → HRV. |
| AE | Respiration nuit | JSON « HH:MM » → respiration. |

## Feuille « Longévité » (une ligne par semaine)

Ajoutée le lundi à partir de la mise à jour de 9 h (ou tout de suite si la feuille est vide).

| Col. | En-tête | Contenu |
|---|---|---|
| A | Date | Valeur brute moyenne sur 28 jours. |
| B | Âge civil | Âge au jour de la publication (date de naissance du profil Polar). |
| C | Écart médian (ans) | Médiane Monte Carlo du jour. |
| D | Écart P10 | 10e centile. |
| E | Écart P90 | 90e centile. |
| F | Écart lissé (ans) | Écart affiché (moyenne mobile). |
| G | Âge physiologique | Âge civil + écart lissé. |
| H | Rythme | 1 + pente de l'écart lissé sur 30 jours. |
| I | VO2max (ans) | Contribution de l'indicateur, en années (négatif = plus jeune). |
| J | FC repos (ans) | Contribution de l'indicateur, en années (négatif = plus jeune). |
| K | Pas (ans) | Contribution de l'indicateur, en années (négatif = plus jeune). |
| L | Activité MVPA (ans) | Contribution de l'indicateur, en années (négatif = plus jeune). |
| M | Renforcement (ans) | Contribution de l'indicateur, en années (négatif = plus jeune). |
| N | Durée sommeil (ans) | Contribution de l'indicateur, en années (négatif = plus jeune). |
| O | Régularité (ans) | Contribution de l'indicateur, en années (négatif = plus jeune). |
| P | VO2max (mL/kg/min) | Valeur brute moyenne sur 28 jours. |
| Q | FC repos (bpm) | Valeur brute moyenne sur 28 jours. |
| R | Pas/jour | Valeur brute moyenne sur 28 jours. |
| S | MET-h/semaine | Valeur brute moyenne sur 28 jours. |
| T | Renforcement (min/sem.) | Valeur brute moyenne sur 28 jours. |
| U | Sommeil mesuré (h) | Valeur brute moyenne sur 28 jours. |
| V | SRI | Valeur brute moyenne sur 28 jours. |
| W | Nuits valides (31 j) | Qualité des données sur 31 jours. |
| X | Jours portés (31 j) | Qualité des données sur 31 jours. |
