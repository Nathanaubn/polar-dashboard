# Google Sheet structure

🇫🇷 [Version française](fr/FEUILLES.md)

The script creates and fills three sheets itself. Headers are in French (the script writes them); the **Meaning** column
translates them. Do not move columns: the script finds them by position.
The **manual journal** columns (P, Q, R in "Données") are the only ones you fill in by hand; they are kept on every
update. All other columns are recalculated.

## "Données" sheet (one row per day)

| Col. | Header (as in the Sheet) | Meaning | Content |
|---|---|---|---|
| A | Date | Date | Day (yyyy-mm-dd). For overnight measurements: the morning of waking up. |
| B | RMSSD nuit (ms) | Overnight RMSSD | Mean overnight HRV (Polar Nightly Recharge). |
| C | FC nuit (bpm) | Overnight HR | Mean overnight heart rate. |
| D | Respiration (/min) | Breathing rate | Mean overnight breathing rate. |
| E | Score sommeil | Sleep score | Polar sleep score (0–100). |
| F | Statut Nightly Recharge (1-6) | Nightly Recharge status | Polar Nightly Recharge status. |
| G | ANS charge | ANS charge | Polar autonomic nervous system charge (−10 to +10). |
| H | Charge cardio du jour | Daily cardio load | Polar cardio load of workouts (TRIMP). |
| I | Strain 7 j (Polar) | 7-day strain (Polar) | Polar acute load (7 days). |
| J | Tolérance 28 j (Polar) | 28-day tolerance (Polar) | Polar chronic load (28 days). |
| K | Ratio strain/tolérance | Strain/tolerance ratio | Polar acute/chronic ratio. |
| L | Récupération (0-100) | Recovery | Computed recovery score (see METHODOLOGY.md). |
| M | Zone | Zone | Vert = green (≥ 67), Jaune = yellow (34–66), Rouge = red (≤ 33), or Calibration. |
| N | Strain (0-21) | Strain | Workout strain, logarithmic 0–21 scale. |
| O | Strain cible | Target strain | Suggested strain range for the zone. |
| P | Alcool (0/1) | Alcohol | **Manual journal**: 1 if you drank alcohol that day. |
| Q | Repas tardif (0/1) | Late meal | **Manual journal**: 1 if you ate late. |
| R | Notes | Notes | **Manual journal**: free text. |
| S | Charge journée hors séances | Load outside workouts | TRIMP from continuous heart rate outside workouts. |
| T | Strain journée (0-21) | Daily strain | Whole-day strain (workouts + rest of the day). |
| U | Stress moyen (0-3) | Mean stress | Mean awake resting stress. |
| V | Minutes stress élevé | High-stress minutes | Minutes at stress level ≥ 2. |
| W | Pas | Steps | Daily steps (Polar). |
| X | Calories actives | Active calories | Active calories (Polar). |
| Y | Stress par heure | Hourly stress | 24 values separated by ";" (0:00 → 23:00). |
| Z | FC éveil au repos (P25) | Awake resting HR (P25) | 25th percentile of awake resting heart rate outside workouts. |
| AA | Besoin sommeil ce soir (min) | Tonight's sleep need | Coach: total need for evening D (night D → D+1). |
| AB | Dette sommeil (min) | Sleep debt | Coach: weighted debt of the last 3 nights, capped. |
| AC | Performance sommeil (%) | Sleep performance | Coach: night D−1 → D / need computed the evening before. |
| AD | Régularité sommeil (0-100) | Sleep regularity | Coach: regularity of sleep/wake times over 4 nights. |
| AE | Efficacité sommeil (7 nuits) | Sleep efficiency | Coach: median actual sleep / time in bed. |
| AF | Couverture FC continue (%) | Continuous HR coverage | Share of 5-minute windows with heart rate (≥ 80 % = fully worn day). |
| AG | MET-h hors séances | MET-h outside workouts | Moderate-to-vigorous activity from continuous heart rate. |
| AH | MET-h séances | Workout MET-h | Workout activity from their mean heart rate. |
| AI | Renforcement (min) | Strength training | Minutes of strength-training workouts. |
| AJ | VO2max (mL/kg/min) | VO2max | Polar VO2max valid that day (test less than 90 days old). |
| AK | Écart âge physiologique (ans) | Physiological age difference | Longevity: daily difference (Monte Carlo median), empty while calibrating. |
| AL | Écart âge lissé (ans) | Smoothed age difference | Longevity: exponential moving average of the difference (60-day half-life). |

## "Sommeil" sheet (one row per night)

Kept beyond the 28 days returned by the Polar API: this is your sleep history. Durations are in minutes.

| Col. | Header (as in the Sheet) | Meaning | Content |
|---|---|---|---|
| A | Date | Date | Morning of waking up. |
| B | Endormissement | Sleep onset | Sleep onset time (ISO, text). |
| C | Réveil | Wake-up | Wake-up time (ISO, text). |
| D | Léger (min) | Light | Light sleep. |
| E | Profond (min) | Deep | Deep sleep. |
| F | Paradoxal (min) | REM | REM sleep. |
| G | Non reconnu (min) | Unrecognised | Unrecognised stage. |
| H | Interruptions (min) | Interruptions | Total awake time during the night. |
| I | Courtes (min) | Short | Short interruptions. |
| J | Longues (min) | Long | Long interruptions. |
| K | Continuité (1-5) | Continuity | Polar continuity index. |
| L | Classe continuité (1-5) | Continuity class | Polar continuity class. |
| M | Cycles | Cycles | Sleep cycles. |
| N | Score sommeil | Sleep score | Polar sleep score. |
| O | Score quantité | Amount score | Polar sub-score. |
| P | Score solidité | Solidity score | Polar sub-score. |
| Q | Score régénération | Regeneration score | Polar sub-score. |
| R | Sleep Charge (1-5) | Sleep Charge | Polar Sleep Charge. |
| S | Ressenti (1-5) | Rating | Your own sleep rating in Polar. |
| T | Objectif (min) | Goal | Polar sleep goal. |
| U | FC moy. nuit | Mean night HR | Mean overnight heart rate. |
| V | Intervalle RR moy. (ms) | Mean RR interval | Mean beat-to-beat interval. |
| W | HRV moy. (ms) | Mean HRV | Mean overnight HRV. |
| X | Respiration moy. | Mean breathing | Mean breathing rate. |
| Y | Nightly Recharge (1-6) | Nightly Recharge | Polar Nightly Recharge status. |
| Z | ANS charge | ANS charge | Polar ANS charge. |
| AA | Statut ANS (1-5) | ANS status | Polar ANS charge status. |
| AB | Hypnogramme | Hypnogram | JSON "HH:MM" → stage (0 awake, 1 REM, 2-3 light, 4 deep, 5 unrecognised). |
| AC | FC sommeil | Sleep HR | JSON "HH:MM" → heart rate. |
| AD | HRV nuit | Night HRV | JSON "HH:MM" → HRV. |
| AE | Respiration nuit | Night breathing | JSON "HH:MM" → breathing rate. |

## "Longévité" sheet (one row per week)

Added on Mondays from the 9:00 update onwards (or immediately if the sheet is empty).

| Col. | Header (as in the Sheet) | Meaning | Content |
|---|---|---|---|
| A | Date | Date | Publication date. |
| B | Âge civil | Chronological age | Age on the publication date (birth date from the Polar profile). |
| C | Écart médian (ans) | Median difference | Monte Carlo median for the day. |
| D | Écart P10 | P10 difference | 10th percentile. |
| E | Écart P90 | P90 difference | 90th percentile. |
| F | Écart lissé (ans) | Smoothed difference | Displayed difference (moving average). |
| G | Âge physiologique | Physiological age | Chronological age + smoothed difference. |
| H | Rythme | Pace of aging | 1 + slope of the smoothed difference over 30 days. |
| I | VO2max (ans) | VO2max (years) | Indicator's contribution, in years (negative = younger). |
| J | FC repos (ans) | Resting HR (years) | Indicator's contribution, in years (negative = younger). |
| K | Pas (ans) | Steps (years) | Indicator's contribution, in years (negative = younger). |
| L | Activité MVPA (ans) | MVPA activity (years) | Indicator's contribution, in years (negative = younger). |
| M | Renforcement (ans) | Strength (years) | Indicator's contribution, in years (negative = younger). |
| N | Durée sommeil (ans) | Sleep duration (years) | Indicator's contribution, in years (negative = younger). |
| O | Régularité (ans) | Regularity (years) | Indicator's contribution, in years (negative = younger). |
| P | VO2max (mL/kg/min) | VO2max | Raw 28-day value. |
| Q | FC repos (bpm) | Resting HR | Raw 28-day value. |
| R | Pas/jour | Steps/day | Raw 28-day value. |
| S | MET-h/semaine | MET-h/week | Raw 28-day value. |
| T | Renforcement (min/sem.) | Strength (min/week) | Raw 28-day value. |
| U | Sommeil mesuré (h) | Measured sleep (h) | Raw 28-day value. |
| V | SRI | SRI | Raw 28-day value. |
| W | Nuits valides (31 j) | Valid nights (31 d) | Data quality over 31 days. |
| X | Jours portés (31 j) | Worn days (31 d) | Data quality over 31 days. |
