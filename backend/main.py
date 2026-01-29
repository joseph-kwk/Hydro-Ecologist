from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from .core.physics_solver import PhysicsSolver
from .core.chemistry_solver import ChemistrySolver
from .core.biology_solver import BiologySolver

app = FastAPI(
    title="Hydro-Ecologist API",
    description="API for the Hydro-Ecologist Digital Twin simulation engine.",
    version="1.0.0"
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:5173",
        "http://127.0.0.1:5173",
    ],
    allow_credentials=False,
    allow_methods=["*"],
    allow_headers=["*"],
)

# --- Simulation Singleton Instances ---
physics_solver = PhysicsSolver(grid_shape=(100, 100))
chemistry_solver = ChemistrySolver()
biology_solver = BiologySolver()

# --- Main Simulation Loop (Conceptual) ---
# In a real application, this would run in a background thread/process.
# For this API, we'll trigger updates on demand for simplicity.
def run_simulation_step():
    """
    Advances the simulation by one time-step.
    """
    delta_time = 0.1  # Simulated time elapsed per step
    physics_solver.update(delta_time)
    chemistry_solver.update(delta_time)
    biology_solver.update(chemistry_solver, delta_time)

@app.post("/simulation/step", tags=["Simulation"])
def trigger_simulation_step():
    """
    Manually triggers one step of the simulation.
    """
    run_simulation_step()
    return {"message": "Simulation advanced by one step."}

@app.get("/status/health", tags=["Status"])
def get_ecosystem_health():
    """
    Retrieves the overall ecosystem health status.
    """
    return {"health_status": biology_solver.get_health_status()}

@app.get("/status/chemistry", tags=["Status"])
def get_chemistry_parameters():
    """
    Retrieves the current chemical parameters of the water body.
    """
    return chemistry_solver.parameters

@app.get("/status/flow", tags=["Status"])
def get_flow_at_point(x: int = 50, y: int = 50):
    """
    Retrieves the flow vector (u, v) at a specific grid coordinate.
    """
    flow_vector = physics_solver.get_flow_vector(x, y)
    return {"x": x, "y": y, "flow_u": flow_vector[0], "flow_v": flow_vector[1]}

@app.get("/")
def read_root():
    return {"message": "Welcome to the Hydro-Ecologist Backend. See /docs for API details."}
