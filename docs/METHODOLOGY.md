# Methodology

🇫🇷 [Version française](fr/METHODE.md)

All constants live in the `CFG` object at the top of `src/Code.js`. Anything that does not come from a published study is
marked there as a **convention**: a reasonable, adjustable choice. Nothing here is medical advice.

## Recovery (0–100)

For each component, z = direction × (today's value − mean) / standard deviation, computed over the nights of the previous
28 days (today excluded, at least 7 nights, otherwise "Calibration"):

| Component | Direction | Weight |
|---|---|---|
| ln(overnight HRV RMSSD) | + | 0.50 |
| Overnight heart rate | − | 0.25 |
| Breathing rate | − | 0.10 |
| Polar sleep score | + | 0.15 |

Z = weighted mean of the available z-scores, recovery = 100 × Φ(Z) (standard normal CDF).
Zones: ≥ 67 green, 34–66 yellow, ≤ 33 red.

## Strain (0–21)

Logarithmic scale of the cardio load (TRIMP): strain = 21 × ln(1 + load) / ln(1 + 400), capped at 21.
**Daily strain** adds the load of the rest of the day to the workouts' load (from Polar), using continuous heart rate
outside workouts: Banister TRIMP, Σ dt × HRR × 0.64 × e^(1.92 × HRR), for HRR ≥ 30 % of heart rate reserve. Each sample is
weighted by its actual duration (the watch samples every 5 min at rest and every second when moving).

## Stress (0–3)

Awake, resting 5-minute windows (< 50 steps, outside workouts and the 30 min after them), between wake-up and bedtime.
Level = (window heart rate − reference) / 10 bpm, bounded to [0; 3]. Reference = 14-day median of the daily 25th
percentile of those heart rates. At least 1 hour of valid windows is required for the day.

## Sleep coach

1. **Baseline need**: median actual sleep (light + deep + REM) of the nights followed by a recovery ≥ 67 over 28 days,
   if there are at least 5; otherwise the Polar sleep goal; otherwise 480 min. Bounded to 420–540.
2. **Strain**: +4 min per point of daily strain above 10, capped at 45 min.
3. **Sleep debt**: 0.5 × deficit of night −1 + 0.3 × night −2 + 0.2 × night −3 (weights renormalised when a night is
   missing), capped at 60 min. Deficit = max(0, previous evening's **baseline** need − actual sleep).
4. **Recovery**: +15 min if recovery ≤ 33.
5. **Total need** = sum of the above, capped at 600 min.
6. **Bedtimes** for Optimal (100 % of the need), Solid (85 %) and Minimum (70 %):
   target wake-up − (need × target / efficiency + 15 min to fall asleep). Efficiency = median of the last 7 nights
   (actual sleep / time in bed), bounded to 0.80–0.98.
7. **Regularity**: mean deviation of sleep-onset and wake-up times over 4 nights (circular mean around midnight),
   score = 100 × max(0, 1 − (onset deviation + wake deviation) / 120).

The coefficients are conventions inspired by commercial sleep planners, whose formulas are not published.
Polar does not detect naps.

## Longevity: physiological age and pace of aging

### Principle

Adult mortality rises almost exponentially with age (Gompertz law): h(age) = a·e^(b·age), doubling roughly every 8 years,
so b = ln 2 / 8 ≈ 0.0866 per year. If habits multiply the hazard by HR compared with a typical person of the same age and
sex, that hazard equals the one of a typical person who is older by **Δ = ln(HR) / b**.

ln(HR) is the sum of each indicator's relative ln HR (HR at the measured value / HR at the reference value). Dose-response
curves are interpolated linearly in ln(HR) between published points and are flat beyond them (no extrapolation).

### Indicators

| Indicator | Measurement | Curve (HR, 95 % CI) | Reference | Source |
|---|---|---|---|---|
| VO2max | Polar fitness test (≤ 90 days old) | RR 0.87 (0.84–0.90) per MET (3.5 mL/kg/min), difference bounded to ±3 MET | FRIEND median for age and sex | Kodama et al., *JAMA* 2009; Kaminsky et al., *Mayo Clin Proc* 2015 |
| Resting heart rate | 28-day median of awake resting heart rate | RR 1.09 (1.04*–1.12) per +10 bpm | 65 bpm (convention) | Zhang et al., *CMAJ* 2016 |
| Steps | Mean over fully worn days | 3,553 → 1; 5,801 → 0.60 (0.51–0.71); 7,842 → 0.55 (0.49–0.62); 10,901 → 0.47 (0.39–0.57); plateau at 10,000 under age 60 | 6,800 (convention) | Paluch et al., *Lancet Public Health* 2022 |
| Moderate-to-vigorous activity | MET-h/week (HRR ≥ 40 % = 4 MET, ≥ 60 % = 8 MET, + workouts) | 0 → 1; 3.75 → 0.80; 11.25 → 0.69; 18.75 → 0.63; 22.5–75 → 0.61; 112.5 → 0.69 | 7.5 MET-h (WHO minimum) | Arem et al., *JAMA Intern Med* 2015 |
| Strength training | Min/week of strength workouts | 0 → 1; 45 min → 0.85 (0.79–0.93), then plateau | 0 | Momma et al., *Br J Sports Med* 2022 |
| Sleep duration | Actual sleep, converted to self-reported duration: 6.8 + 0.567 × (measured − 6) | Lowest risk at 7 h; RR 1.06 (1.04–1.07) per hour less, 1.13 (1.11–1.15) per hour more | 7 h | Yin et al., *J Am Heart Assoc* 2017; Lauderdale et al., *Epidemiology* 2008 |
| Sleep regularity (SRI) | 200 × P(same asleep/awake state 24 h apart) − 100, minute by minute from the hypnogram | 41 → 1.42; 60 → 1; 75 → 0.90, then plateau | 60 (cohort median) | Windred et al., *Sleep* 2024 |

\* 1.04: estimate after correction for publication bias, used as the lower bound.

### Overlap between indicators (convention)

No study combines these 7 variables. Activity domain = mean of the ln HR of steps and activity, plus strength training.
When VO2max is known, a factor of 0.5 is applied to the Activity domain and to resting heart rate. Sleep = duration +
regularity. Δ is bounded to ±10 years.

### Uncertainty

Monte Carlo, 2,000 draws with a fixed seed: each published ln HR drawn from its CI (standard deviation = (ln upper − ln
lower) / 3.92), mortality doubling time between 7 and 9 years, overlap factor between 0.3 and 1.0, VO2max ± 3.5 mL/kg/min,
SRI shifted by −15 to 0 (cohorts used accelerometers). The median and the 80 % interval (P10–P90) are shown.

### Data quality

The age is shown only with at least 21 nights and 14 "fully worn" days (continuous heart rate on ≥ 80 % of 5-minute
windows) over the last 31 days; otherwise "En calibration" (calibrating).

### Smoothing and pace

Displayed age = chronological age + exponential moving average of the daily differences (60-day half-life).
Pace = 1 + slope of that difference over 30 days (years per calendar year), bounded between −1 and 3.

### Limitations

- Hazard ratios come mostly from cohorts aged 40–70. In young adults absolute mortality is very low: the "age" reflects a
  relative risk, not a life expectancy.
- Observational studies: associations, not proven individual effects.
- Wrist measurements ≠ study measurements (questionnaires, accelerometers, exercise tests).
- Out of scope: lean mass, HRV, naps.
- Not checked against full texts during development: the SRI hazard ratios and their uncertainty (conventional standard
  deviation of 0.08 on ln HR), Zhang's 1.04 bound, and Momma's CI (secondary sources).
