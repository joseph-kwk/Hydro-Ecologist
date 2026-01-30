# backend/core/chemistry_solver.py
import numpy as np
from typing import Tuple, Optional

class ChemistrySolver:
    """
    Manages biogeochemical cycles using spatially-resolved NPZD model.
    NPZD: Nutrient, Phytoplankton, Zooplankton, Detritus.
    
    Now supports 2D spatial grids with advection-diffusion transport.
    """
    def __init__(self, grid_shape=(100, 100), domain_size=(200.0, 200.0)):
        """
        Initialize spatial chemistry solver.
        
        Args:
            grid_shape: (nx, ny) grid resolution
            domain_size: (Lx, Ly) physical domain size in meters
        """
        self.nx, self.ny = grid_shape
        self.Lx, self.Ly = domain_size
        self.dx = self.Lx / self.nx
        self.dy = self.Ly / self.ny
        
        # Core NPZD Components (now spatial grids!)
        self.nutrient = np.full((self.nx, self.ny), 10.0)          # µmol/L
        self.phytoplankton = np.full((self.nx, self.ny), 1.0)      # µmol/L
        self.zooplankton = np.full((self.nx, self.ny), 0.5)        # µmol/L
        self.detritus = np.full((self.nx, self.ny), 0.1)           # µmol/L
        
        # Water Quality Parameters (spatial)
        self.dissolved_oxygen = np.full((self.nx, self.ny), 8.0)   # mg/L
        self.ph = np.full((self.nx, self.ny), 8.1)                 # -
        self.bod = np.full((self.nx, self.ny), 1.0)                # mg/L
        
        # Temperature (Phase 2 ready)
        self.temperature = np.full((self.nx, self.ny), 20.0)       # °C
        
        # Biological rate constants (vectorizable)
        self.growth_rate_phyto = 0.5       # day⁻¹
        self.grazing_rate_zoo = 0.2        # day⁻¹
        self.mortality_rate_phyto = 0.1    # day⁻¹
        self.mortality_rate_zoo = 0.05     # day⁻¹
        self.remineralization_rate = 0.03  # day⁻¹
        self.half_sat_N = 1.0              # µmol/L (half-saturation constant)
        
        # Physical transport coefficients
        self.diffusivity = 1.0  # m²/s (turbulent diffusion)
        
        print(f"Chemistry Engine Initialized: Spatial NPZD on {self.nx}x{self.ny} grid")

    def update(self, delta_time: float, velocity_u: Optional[np.ndarray] = None, 
               velocity_v: Optional[np.ndarray] = None):
        """
        Simulate one timestep of NPZD biogeochemistry with optional advection.
        
        Args:
            delta_time: Timestep in seconds
            velocity_u: u-velocity field (nx, ny) in m/s (from physics solver)
            velocity_v: v-velocity field (nx, ny) in m/s (from physics solver)
        """
        dt_days = delta_time / 86400.0  # Convert seconds to days for biological rates
        
        # --- 1. BIOLOGICAL REACTIONS (local, no transport) ---
        self._update_npzd_reactions(dt_days)
        
        # --- 2. ADVECTION (if velocity field provided) ---
        if velocity_u is not None and velocity_v is not None:
            self._advect_all_tracers(velocity_u, velocity_v, delta_time)
        
        # --- 3. DIFFUSION (turbulent mixing) ---
        self._diffuse_all_tracers(delta_time)
        
        # --- 4. OXYGEN DYNAMICS ---
        self._update_oxygen(dt_days)
        
        # Clamp all values to physical bounds
        self._clamp_parameters()

    def _update_npzd_reactions(self, dt_days: float):
        """
        Update NPZD model using vectorized NumPy operations.
        All equations applied element-wise across spatial grid.
        """
        N = self.nutrient
        P = self.phytoplankton
        Z = self.zooplankton
        D = self.detritus
        
        # Temperature correction (Q10 = 2 rule, Phase 2)
        temp_factor = 1.066 ** (self.temperature - 20.0)  # 1.0 at 20°C
        growth_rate = self.growth_rate_phyto * temp_factor
        
        # --- NPZD Equations (vectorized) ---
        
        # 1. Phytoplankton growth (Monod kinetics) and losses
        phyto_growth = growth_rate * (N / (N + self.half_sat_N)) * P
        phyto_grazing = self.grazing_rate_zoo * P * Z
        phyto_mortality = self.mortality_rate_phyto * P
        
        # 2. Zooplankton growth (assimilation efficiency 80%) and mortality
        zoo_growth = self.grazing_rate_zoo * P * Z * 0.8
        zoo_mortality = self.mortality_rate_zoo * Z
        
        # 3. Detritus production and remineralization
        detritus_gain = phyto_mortality + zoo_mortality
        detritus_loss = self.remineralization_rate * D
        
        # --- Update state variables ---
        self.nutrient -= (phyto_growth - detritus_loss) * dt_days
        self.phytoplankton += (phyto_growth - phyto_grazing - phyto_mortality) * dt_days
        self.zooplankton += (zoo_growth - zoo_mortality) * dt_days
        self.detritus += (detritus_gain - detritus_loss) * dt_days

    def _advect_all_tracers(self, u: np.ndarray, v: np.ndarray, dt: float):
        """
        Advect all chemical tracers using upwind scheme for stability.
        
        ∂C/∂t = -u·∂C/∂x - v·∂C/∂y
        
        Args:
            u, v: Velocity fields (m/s)
            dt: Timestep (seconds)
        """
        tracers = [
            self.nutrient, self.phytoplankton, self.zooplankton, 
            self.detritus, self.dissolved_oxygen, self.bod
        ]
        
        for tracer in tracers:
            self._advect_tracer(tracer, u, v, dt)

    def _advect_tracer(self, tracer: np.ndarray, u: np.ndarray, v: np.ndarray, dt: float):
        """
        Advect single tracer using upwind scheme.
        """
        # Upwind scheme: use upstream value based on flow direction
        # If u > 0, use C[i-1], if u < 0, use C[i+1]
        
        dC_dx = np.zeros_like(tracer)
        dC_dy = np.zeros_like(tracer)
        
        # X-direction advection
        u_pos = u > 0
        u_neg = u < 0
        dC_dx[1:, :] = np.where(u_pos[1:, :], 
                                (tracer[1:, :] - tracer[:-1, :]) / self.dx,
                                0)
        dC_dx[:-1, :] += np.where(u_neg[:-1, :], 
                                 (tracer[1:, :] - tracer[:-1, :]) / self.dx,
                                 0)
        
        # Y-direction advection
        v_pos = v > 0
        v_neg = v < 0
        dC_dy[:, 1:] = np.where(v_pos[:, 1:], 
                                (tracer[:, 1:] - tracer[:, :-1]) / self.dy,
                                0)
        dC_dy[:, :-1] += np.where(v_neg[:, :-1], 
                                 (tracer[:, 1:] - tracer[:, :-1]) / self.dy,
                                 0)
        
        # Update tracer
        tracer -= dt * (u * dC_dx + v * dC_dy)

    def _diffuse_all_tracers(self, dt: float):
        """
        Apply turbulent diffusion to all tracers: ∂C/∂t = κ·∇²C
        """
        tracers = [
            self.nutrient, self.phytoplankton, self.zooplankton, 
            self.detritus, self.dissolved_oxygen
        ]
        
        for tracer in tracers:
            self._diffuse_tracer(tracer, dt)

    def _diffuse_tracer(self, tracer: np.ndarray, dt: float):
        """
        Apply Laplacian diffusion operator.
        """
        # 5-point stencil Laplacian
        laplacian = (
            np.roll(tracer, 1, axis=0) + np.roll(tracer, -1, axis=0) +
            np.roll(tracer, 1, axis=1) + np.roll(tracer, -1, axis=1) - 4 * tracer
        ) / (self.dx ** 2)
        
        tracer += self.diffusivity * laplacian * dt

    def _update_oxygen(self, dt_days: float):
        """
        Update dissolved oxygen based on respiration and photosynthesis.
        """
        P = self.phytoplankton
        Z = self.zooplankton
        D = self.detritus
        
        # Respiration consumes oxygen
        respiration = (P * 0.1 + Z * 0.15 + D * 0.05) * self.bod
        self.dissolved_oxygen -= respiration * dt_days
        
        # Photosynthesis produces oxygen (proportional to phyto growth)
        # Rough estimate: 1 µmol phyto growth → 1 mg/L O₂
        photosynthesis = P * 0.2  # Simplified
        self.dissolved_oxygen += photosynthesis * dt_days

    def _clamp_parameters(self):
        """
        Ensure all parameters stay within physical bounds.
        """
        self.nutrient = np.clip(self.nutrient, 0, 100)
        self.phytoplankton = np.clip(self.phytoplankton, 0, 50)
        self.zooplankton = np.clip(self.zooplankton, 0, 20)
        self.detritus = np.clip(self.detritus, 0, 30)
        self.dissolved_oxygen = np.clip(self.dissolved_oxygen, 0, 20)
        self.ph = np.clip(self.ph, 6.0, 9.5)
        self.bod = np.clip(self.bod, 0, 50)

    def inject_nutrient(self, x: int, y: int, radius: int, amount: float):
        """
        Inject nutrient pulse at specific location.
        
        Args:
            x, y: Center grid cell
            radius: Radius of influence (grid cells)
            amount: Nutrient amount to add (µmol/L)
        """
        x_min = max(0, x - radius)
        x_max = min(self.nx, x + radius + 1)
        y_min = max(0, y - radius)
        y_max = min(self.ny, y + radius + 1)
        
        self.nutrient[x_min:x_max, y_min:y_max] += amount
        print(f"Nutrient injected at ({x}, {y}): +{amount:.2f} µmol/L")

    def inject_pollutant(self, x: int, y: int, radius: int, amount: float):
        """
        Inject pollutant (increases BOD, decreases DO).
        
        Args:
            x, y: Center grid cell
            radius: Radius of influence
            amount: Pollutant amount (mg/L)
        """
        x_min = max(0, x - radius)
        x_max = min(self.nx, x + radius + 1)
        y_min = max(0, y - radius)
        y_max = min(self.ny, y + radius + 1)
        
        self.bod[x_min:x_max, y_min:y_max] += amount
        self.dissolved_oxygen[x_min:x_max, y_min:y_max] -= amount * 0.5
        print(f"Pollutant injected at ({x}, {y}): +{amount:.2f} mg/L BOD")

    def get_parameter(self, name: str) -> np.ndarray:
        """
        Get spatial parameter grid.
        
        Returns:
            2D array of parameter values
        """
        params = {
            "nutrient": self.nutrient,
            "phytoplankton": self.phytoplankton,
            "zooplankton": self.zooplankton,
            "detritus": self.detritus,
            "dissolved_oxygen": self.dissolved_oxygen,
            "ph": self.ph,
            "bod": self.bod,
            "temperature": self.temperature
        }
        return params.get(name, np.zeros((self.nx, self.ny)))

    def get_mean_parameters(self) -> dict:
        """
        Get spatially-averaged parameters (for backward compatibility with UI).
        
        Returns:
            Dictionary of mean values
        """
        return {
            "nutrient": float(np.mean(self.nutrient)),
            "phytoplankton": float(np.mean(self.phytoplankton)),
            "zooplankton": float(np.mean(self.zooplankton)),
            "detritus": float(np.mean(self.detritus)),
            "dissolved_oxygen": float(np.mean(self.dissolved_oxygen)),
            "ph": float(np.mean(self.ph)),
            "bod": float(np.mean(self.bod)),
            "temperature": float(np.mean(self.temperature))
        }

    def is_hypoxic(self) -> bool:
        """
        Check if any region is hypoxic (DO < 2.0 mg/L).
        """
        return np.any(self.dissolved_oxygen < 2.0)

    def get_hypoxic_fraction(self) -> float:
        """
        Get fraction of domain that is hypoxic.
        
        Returns:
            Fraction (0.0 to 1.0)
        """
        return float(np.sum(self.dissolved_oxygen < 2.0) / (self.nx * self.ny))
