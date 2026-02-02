from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from .core.physics_solver import PhysicsSolver
from .core.chemistry_solver import ChemistrySolver
from .core.biology_solver import BiologySolver
from .core.remediation_manager import RemediationManager, RemediationType
from .core.regulatory_monitor import RegulatoryMonitor
from .core.target_profiles import TARGET_PROFILES, TargetProfile
from .core.lesson_presets import list_lessons, get_lesson

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
active_target_id = "coastal_estuary"


def _apply_target_profile(profile: TargetProfile):
    """(Re)initialize all simulation components for the given target profile."""
    global physics_solver, chemistry_solver, biology_solver, remediation_manager, regulatory_monitor, active_target_id

    active_target_id = profile.id

    physics_solver = PhysicsSolver(grid_shape=profile.grid_shape, domain_size=profile.domain_size)
    physics_solver.h0 = profile.mean_depth_m
    physics_solver.nu = profile.eddy_viscosity_m2_s
    physics_solver.h = physics_solver.h0 + physics_solver.eta

    chemistry_solver = ChemistrySolver(grid_shape=profile.grid_shape, domain_size=profile.domain_size)
    if profile.baseline:
        # Uniform baseline initialization (screening/education level)
        if "nutrient" in profile.baseline:
            chemistry_solver.nutrient.fill(profile.baseline["nutrient"])
        if "phytoplankton" in profile.baseline:
            chemistry_solver.phytoplankton.fill(profile.baseline["phytoplankton"])
        if "zooplankton" in profile.baseline:
            chemistry_solver.zooplankton.fill(profile.baseline["zooplankton"])
        if "detritus" in profile.baseline:
            chemistry_solver.detritus.fill(profile.baseline["detritus"])
        if "dissolved_oxygen" in profile.baseline:
            chemistry_solver.dissolved_oxygen.fill(profile.baseline["dissolved_oxygen"])
        if "ph" in profile.baseline:
            chemistry_solver.ph.fill(profile.baseline["ph"])
        if "bod" in profile.baseline:
            chemistry_solver.bod.fill(profile.baseline["bod"])
        if "temperature" in profile.baseline:
            chemistry_solver.temperature.fill(profile.baseline["temperature"])

    biology_solver = BiologySolver()
    remediation_manager = RemediationManager(grid_shape=profile.grid_shape)
    regulatory_monitor = RegulatoryMonitor(waterbody_type=profile.waterbody_type)


def _get_active_profile() -> TargetProfile:
    return TARGET_PROFILES.get(active_target_id) or TARGET_PROFILES["coastal_estuary"]


# Initialize with default target
_apply_target_profile(_get_active_profile())

# --- Main Simulation Loop with Physics-Chemistry Coupling ---
def run_simulation_step():
    """
    Advances the simulation by one time-step with full coupling:
    1. Physics solver computes hydrodynamics
    2. Chemistry solver uses velocity field for advection
    3. Biology solver responds to chemistry
    """
    delta_time = 0.1  # Simulated time elapsed per step (seconds)
    
    # Update physics (Shallow Water Equations)
    physics_solver.update(delta_time)
    
    # Get velocity field for chemistry advection
    velocity_u, velocity_v = physics_solver.get_velocity_field()
    
    # Apply remediation interventions (Phase 3)
    remediation_manager.apply_remediations(chemistry_solver, delta_time)
    
    # Update chemistry with advection
    chemistry_solver.update(delta_time, velocity_u, velocity_v)
    
    # Update biology based on chemistry
    biology_solver.update(chemistry_solver, delta_time)
    
    # Assess regulatory compliance (Phase 4)
    regulatory_monitor.assess_compliance(chemistry_solver.get_mean_parameters())

@app.post("/simulation/step", tags=["Simulation"])
def trigger_simulation_step():
    """
    Manually triggers one step of the simulation.
    """
    run_simulation_step()
    return {"message": "Simulation advanced by one step."}

@app.post("/simulation/reset", tags=["Simulation"])
def reset_simulation():
    # Resets all simulation components to the current active target profile
    profile = _get_active_profile()
    _apply_target_profile(profile)
    return {"message": "Simulation reset to target baseline.", "active_target": profile.id}


@app.get("/targets", tags=["Targets"])
def list_targets():
    """List available target environments (education/screening profiles)."""
    return {
        "active_target": active_target_id,
        "targets": [
            {
                "id": p.id,
                "name": p.name,
                "description": p.description,
                "grid_shape": list(p.grid_shape),
                "domain_size": list(p.domain_size),
                "waterbody_type": p.waterbody_type,
                "mean_depth_m": p.mean_depth_m,
                "eddy_viscosity_m2_s": p.eddy_viscosity_m2_s,
                "baseline": p.baseline or {},
            }
            for p in TARGET_PROFILES.values()
        ],
    }


@app.get("/targets/active", tags=["Targets"])
def get_active_target():
    p = _get_active_profile()
    return {
        "id": p.id,
        "name": p.name,
        "description": p.description,
        "grid_shape": list(p.grid_shape),
        "domain_size": list(p.domain_size),
        "waterbody_type": p.waterbody_type,
        "mean_depth_m": p.mean_depth_m,
        "eddy_viscosity_m2_s": p.eddy_viscosity_m2_s,
        "baseline": p.baseline or {},
    }


@app.post("/targets/select", tags=["Targets"])
def select_target(target_id: str):
    """Select a target environment profile and reset simulation to its baseline."""
    profile = TARGET_PROFILES.get(target_id)
    if profile is None:
        return {"error": f"Unknown target_id: {target_id}", "available": list(TARGET_PROFILES.keys())}

    _apply_target_profile(profile)
    return {
        "message": "Target selected and simulation reset.",
        "active_target": profile.id,
        "profile": {
            "id": profile.id,
            "name": profile.name,
            "description": profile.description,
            "grid_shape": list(profile.grid_shape),
            "domain_size": list(profile.domain_size),
            "waterbody_type": profile.waterbody_type,
            "mean_depth_m": profile.mean_depth_m,
            "eddy_viscosity_m2_s": profile.eddy_viscosity_m2_s,
            "baseline": profile.baseline or {},
        },
    }

@app.post("/simulation/inject", tags=["Simulation"])
def inject_parameters(nutrient: float = 0, pollutant: float = 0):
    """
    Injects nutrients or pollutants globally (uniform distribution).
    For spatial injection, use /simulation/inject_spatial.
    """
    if nutrient > 0:
        chemistry_solver.nutrient += nutrient
    if pollutant > 0:
        chemistry_solver.bod += pollutant
        chemistry_solver.dissolved_oxygen -= pollutant * 0.5
    return {"message": f"Injected nutrient: {nutrient}, pollutant: {pollutant}"}

@app.post("/simulation/inject_spatial", tags=["Simulation"])
def inject_spatial(x: int, y: int, radius: int = 5, 
                  nutrient: float = 0, pollutant: float = 0,
                  momentum_u: float = 0, momentum_v: float = 0):
    """
    Injects nutrients/pollutants/momentum at a specific spatial location.
    
    Args:
        x, y: Grid coordinates (0-99)
        radius: Injection radius in grid cells
        nutrient: Nutrient amount to add (µmol/L)
        pollutant: Pollutant amount to add (mg/L)
        momentum_u, momentum_v: Velocity impulse (m/s)
    """
    if nutrient > 0:
        chemistry_solver.inject_nutrient(x, y, radius, nutrient)
    if pollutant > 0:
        chemistry_solver.inject_pollutant(x, y, radius, pollutant)
    if momentum_u != 0 or momentum_v != 0:
        physics_solver.inject_momentum(x, y, radius, momentum_u, momentum_v)
    
    return {
        "message": "Spatial injection completed",
        "location": {"x": x, "y": y, "radius": radius},
        "amounts": {"nutrient": nutrient, "pollutant": pollutant, 
                   "momentum_u": momentum_u, "momentum_v": momentum_v}
    }

@app.get("/status/health", tags=["Status"])
def get_ecosystem_health():
    """
    Retrieves the overall ecosystem health status.
    """
    return {"health_status": biology_solver.get_health_status()}

@app.get("/status/chemistry", tags=["Status"])
def get_chemistry_parameters():
    """
    Retrieves the spatially-averaged chemical parameters (backward compatible).
    For full spatial grid, use /status/chemistry/grid.
    """
    return chemistry_solver.get_mean_parameters()

@app.get("/status/chemistry/grid", tags=["Status"])
def get_chemistry_grid(parameter: str = "dissolved_oxygen", downsample: int = 4):
    # Retrieves full spatial grid for a specific parameter
    # Args: parameter, downsample factor
    # Returns: Downsampled grid as nested list
    grid = chemistry_solver.get_parameter(parameter)
    
    # Downsample to reduce payload size
    if downsample > 1:
        step = downsample
        grid = grid[::step, ::step]
    
    return {
        "parameter": parameter,
        "grid": grid.tolist(),
        "nx": int(grid.shape[1]),  # width
        "ny": int(grid.shape[0]),  # height
        "min": float(grid.min()),
        "max": float(grid.max()),
        "mean": float(grid.mean())
    }

@app.get("/status/all", tags=["Status"])
def get_all_status():
    """
    Retrieves all simulation data in one call (spatially-averaged).
    """
    return {
        "chemistry": chemistry_solver.get_mean_parameters(),
        "health_status": biology_solver.get_health_status(),
        "biology": biology_solver.indicator_species,
        "spatial_metrics": {
            "hypoxic_fraction": chemistry_solver.get_hypoxic_fraction(),
            "min_DO": float(chemistry_solver.dissolved_oxygen.min()),
            "max_phyto": float(chemistry_solver.phytoplankton.max())
        }
    }

@app.get("/status/flow", tags=["Status"])
def get_flow_at_point(x: int = 50, y: int = 50):
    """
    Retrieves the flow vector (u, v) at a specific grid coordinate.
    """
    flow_vector = physics_solver.get_flow_vector(x, y)
    return {"x": x, "y": y, "flow_u": flow_vector[0], "flow_v": flow_vector[1]}

@app.post("/simulation/heatwave", tags=["Scenarios"])
def toggle_marine_heatwave(activate: bool = True, intensity: float = 3.5):
    # Activate or deactivate marine heatwave scenario
    # Args: activate (bool), intensity (float, 3-5C typical)
    if activate:
        chemistry_solver.activate_marine_heatwave(intensity)
        return {
            "message": f"Marine heatwave activated: +{intensity}C anomaly",
            "impact": "Reduced DO saturation, increased metabolism",
            "status": "active"
        }
    else:
        chemistry_solver.deactivate_marine_heatwave()
        return {
            "message": "Marine heatwave deactivated",
            "status": "inactive"
        }

@app.post("/remediation/deploy", tags=["Remediation"])
def deploy_remediation(x: int, y: int, radius: int, 
                       intervention_type: str = "aeration",
                       intensity: float = 1.0):
    """
    Deploy a remediation intervention at specified location.
    Phase 3: Water quality restoration toolkit!
    
    Args:
        x, y: Grid coordinates (0-99)
        radius: Effective radius in grid cells
        intervention_type: "aeration", "wetland", or "oyster_reef"
        intensity: Effectiveness (0.0-1.0)
    
    Intervention Types:
    - Aeration: Mechanical DO injection (+2 mg/L per day)
    - Wetland: Biological nutrient/BOD removal (30-40% per day)
    - Oyster Reef: Natural filtration (20% phyto removal per day)
    """
    try:
        rem_type = RemediationType(intervention_type)
        result = remediation_manager.deploy_intervention(
            x, y, radius, rem_type, intensity
        )
        return result
    except ValueError:
        return {"error": f"Invalid intervention type: {intervention_type}. Use: aeration, wetland, oyster_reef"}

@app.delete("/remediation/{zone_id}", tags=["Remediation"])
def remove_remediation(zone_id: int):
    """
    Remove/deactivate a remediation intervention.
    
    Args:
        zone_id: ID of intervention to remove
    """
    return remediation_manager.remove_intervention(zone_id)

@app.get("/remediation/summary", tags=["Remediation"])
def get_remediation_summary():
    """
    Get summary of all deployed remediation interventions.
    Includes costs, effectiveness, and locations.
    """
    return remediation_manager.get_summary()

@app.get("/regulatory/compliance", tags=["Regulatory"])
def get_regulatory_compliance():
    """
    Get current regulatory compliance status.
    Phase 4: EPA 303(d) and TMDL monitoring.
    
    Returns:
        Current violations, impairment status, TMDL compliance
    """
    chemistry_data = chemistry_solver.get_mean_parameters()
    return regulatory_monitor.assess_compliance(chemistry_data)

@app.get("/regulatory/summary", tags=["Regulatory"])
def get_regulatory_summary():
    """
    Get historical compliance summary and statistics.
    
    Returns:
        Total violations, violation rate, impairment history
    """
    return regulatory_monitor.get_compliance_summary()

@app.post("/regulatory/set_waterbody", tags=["Regulatory"])
def set_waterbody_type(waterbody_type: str = "warm_water_fishery"):
    """
    Set waterbody classification for appropriate standards.
    
    Args:
        waterbody_type: "cold_water_fishery", "warm_water_fishery", 
                       "estuarine", "coastal"
    """
    global regulatory_monitor
    regulatory_monitor = RegulatoryMonitor(waterbody_type=waterbody_type)
    return {
        "message": f"Waterbody type set to: {waterbody_type}",
        "standards_updated": True
    }

@app.get("/")
def read_root():
    return {"message": "Welcome to the Hydro-Ecologist Backend. See /docs for API details."}


@app.get("/lessons", tags=["Lessons"])
def get_lessons(target_id: str | None = None):
    """List guided lesson presets (education scenarios).

    If target_id is provided, filters to lessons intended for that target.
    """
    lessons = list_lessons(target_id)
    return {
        "target_id": target_id,
        "lessons": [
            {
                "id": l.id,
                "target_id": l.target_id,
                "name": l.name,
                "description": l.description,
            }
            for l in lessons
        ],
    }


@app.post("/lessons/run", tags=["Lessons"])
def run_lesson(lesson_id: str):
    """Run a guided lesson preset.

    This will typically switch the target and reset to baseline before applying actions.
    """
    lesson = get_lesson(lesson_id)
    if lesson is None:
        return {"error": f"Unknown lesson_id: {lesson_id}"}

    # Apply lesson actions in order
    for action in lesson.actions:
        if action.type == "select_target":
            tid = action.params.get("target_id")
            profile = TARGET_PROFILES.get(tid)
            if profile is None:
                return {"error": f"Lesson references unknown target_id: {tid}"}
            _apply_target_profile(profile)

        elif action.type == "reset":
            _apply_target_profile(_get_active_profile())

        elif action.type == "inject":
            nutrient = float(action.params.get("nutrient", 0.0))
            pollutant = float(action.params.get("pollutant", 0.0))
            if nutrient > 0:
                chemistry_solver.nutrient += nutrient
            if pollutant > 0:
                chemistry_solver.bod += pollutant
                chemistry_solver.dissolved_oxygen -= pollutant * 0.5

        elif action.type == "heatwave":
            activate = bool(action.params.get("activate", True))
            intensity = float(action.params.get("intensity", 3.5))
            if activate:
                chemistry_solver.activate_marine_heatwave(intensity)
            else:
                chemistry_solver.deactivate_marine_heatwave()

        elif action.type == "deploy_remediation":
            x = int(action.params.get("x", 50))
            y = int(action.params.get("y", 50))
            radius = int(action.params.get("radius", 10))
            intervention_type = str(action.params.get("intervention_type", "aeration"))
            intensity = float(action.params.get("intensity", 1.0))
            rem_type = RemediationType(intervention_type)
            remediation_manager.deploy_intervention(x, y, radius, rem_type, intensity)

        elif action.type == "step_n":
            n = int(action.params.get("n", 1))
            for _ in range(max(0, n)):
                run_simulation_step()

        else:
            return {"error": f"Unsupported lesson action: {action.type}"}

    # Snapshot for the UI to immediately display something coherent
    return {
        "message": "Lesson applied.",
        "lesson": {
            "id": lesson.id,
            "target_id": lesson.target_id,
            "name": lesson.name,
            "description": lesson.description,
        },
        "active_target": active_target_id,
        "status": {
            "chemistry": chemistry_solver.get_mean_parameters(),
            "health_status": biology_solver.get_health_status(),
            "regulatory": regulatory_monitor.assess_compliance(chemistry_solver.get_mean_parameters()),
            "remediation": remediation_manager.get_summary(),
        },
    }
