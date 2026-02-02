# Hydro‑Ecologist Roadmap (Education-first)

Date: 2026-02-02

This project is an **interactive ecohydro “living lab”**: a screening-level, standards-aware simulation sandbox designed for **students, teachers, and curious users**.

It is *not* currently a calibrated, site-certified regulatory model (e.g., ROMS/Delft3D/EFDC/CE-QUAL-W2). The goal is to be **transparent, reproducible, and pedagogically strong**.

## What “not a toy” means here

A “toy” is something that looks cool but can’t be trusted for *any* structured learning or comparison.

Hydro‑Ecologist becomes “real and usable” when it has:

- **Clear assumptions and limits** shown in the UI
- **Reproducible runs** (same inputs → same outputs)
- **Comparisons** (Scenario A vs Scenario B)
- **Diagnostics** (why did DO change?)
- **Data hooks** (optional): upload a small observed dataset and compare

## Target Profiles (Environment Switching)

We support user-selectable environment archetypes (“targets”), e.g.:

- Urban Lake
- Coastal Estuary
- Cold-Water River Reach

Targets are **screening/education profiles**:
- They set baseline conditions and standards context.
- They are not site-calibrated.

## Lesson Presets

We provide one-click guided lesson scenarios that:

- Switch the target
- Reset to baseline
- Apply an intervention/scenario (nutrients, BOD, heatwave, remediation)
- Step the simulation forward

These are meant for:
- classroom demos
- lab assignments
- fast exploration

## 6-week realistic plan (education + decision-informing)

### Weeks 1–2: Credibility & teaching quality
- Target Info panel: assumptions + units + “what this represents”
- Lesson presets: 6–10 curated lessons across targets
- “Explain this change” panel: highlight dominant drivers for DO, nutrients, phyto

### Weeks 3–4: Reproducible experiments
- Scenario runner: save/load scenarios
- Run history: compare two runs on the same charts
- Export improvements: run metadata + scenario config + outputs

### Weeks 5–6: Early data connection (optional)
- Upload CSV observation time series (single station)
- “Model vs observed” plots + simple error metrics (RMSE/MAE)
- Parameter sensitivity exploration (small ensemble)

## What we should NOT claim (yet)
- Site-specific forecasts
- Regulatory compliance decisions
- “Validated digital twin” status without observed-data calibration

## Next technical tasks

- Add run persistence on backend (run_id, saved configs)
- Add uncertainty bands (parameter ranges / ensembles)
- Add better spatial workflows (click-to-inject / click-to-remediate)
