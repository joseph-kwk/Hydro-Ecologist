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

@app.post("/simulation/reset", tags=["Simulation"])
def reset_simulation():
    """
    Resets the simulation to pristine initial state.
    """
    global physics_solver, chemistry_solver, biology_solver
    physics_solver = PhysicsSolver(grid_shape=(100, 100))
    chemistry_solver = ChemistrySolver()
    biology_solver = BiologySolver()
    return {"message": "Simulation reset to initial state."}

@app.post("/simulation/inject", tags=["Simulation"])
def inject_parameters(nutrient: float = 0, pollutant: float = 0):
    """
    Injects nutrients or pollutants into the system.
    """
    if nutrient > 0:
        chemistry_solver.parameters["nutrient"] += nutrient
    if pollutant > 0:
        chemistry_solver.parameters["bod"] += pollutant
        chemistry_solver.parameters["dissolved_oxygen"] -= pollutant * 0.5
    return {"message": f"Injected nutrient: {nutrient}, pollutant: {pollutant}"}

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

@app.get("/status/all", tags=["Status"])
def get_all_status():
    """
    Retrieves all simulation data in one call.
    """
    return {
        "chemistry": chemistry_solver.parameters,
        "health_status": biology_solver.get_health_status(),
        "biology": biology_solver.indicator_species
    }

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
