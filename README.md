# Project Hydro-Ecologist

Hydro-Ecologist is a high-fidelity Digital Twin of a marine ecosystem: a “living lab” that couples hydrodynamics, biogeochemistry, and ecological feedback.

See [MDD.txt](MDD.txt) for the full Master Design Document.

Project plan / positioning is captured in [docs/ROADMAP.md](docs/ROADMAP.md).

## Repo Structure

- [backend/](backend/) — FastAPI simulation engine (physics/chemistry/biology)
- [frontend/](frontend/) — React + Vite dashboard + 3D view (react-three-fiber)

## Quickstart (Windows)

You’ll run two terminals: one for the backend API, one for the frontend UI.

### 1) Backend (FastAPI)

From the repo root:

```powershell
python -m venv .venv-backend
.\.venv-backend\Scripts\python -m pip install -r requirements.txt
.\.venv-backend\Scripts\python -m uvicorn backend.main:app --reload --host 127.0.0.1 --port 8000
```

Backend URLs:

- API root: http://127.0.0.1:8000/
- Swagger docs: http://127.0.0.1:8000/docs

### 2) Frontend (Vite + React)

In a second terminal:

```powershell
cd frontend
npm install
npm run dev
```

Frontend URL:

- UI: http://localhost:5173/

## What to Click

In the UI, use:

- “Refresh” to pull current state from the backend
- “Step Simulation” to advance the model one timestep and refresh

## API Endpoints

- `POST /simulation/step` — advance the simulation by one step
- `GET /status/health` — ecosystem health summary
- `GET /status/chemistry` — chemistry/NPZD state (nutrients, phyto, zoo, detritus, DO, etc.)
- `GET /status/flow?x=50&y=50` — flow vector at a grid coordinate

## Troubleshooting

- If the frontend shows “Could not connect to backend”, confirm the backend is running at `http://127.0.0.1:8000`.
- CORS is enabled for `http://localhost:5173` and `http://127.0.0.1:5173` in [backend/main.py](backend/main.py).
