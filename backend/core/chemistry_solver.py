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
        self.thermal_diffusivity = 1.2  # m²/s (heat diffusion, slightly higher)
        
        # Temperature dynamics parameters (Phase 2)
        self.solar_heating_rate = 0.0001  # °C/s at solar noon
        self.atmospheric_cooling_rate = 0.00002  # °C/s (radiative + evaporative)
        self.heatwave_active = False
        self.heatwave_intensity = 0.0  # °C anomaly
        self.simulation_time = 0.0  # seconds (for day/night cycle)
        
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
        
        # --- 0. TEMPERATURE DYNAMICS (Phase 2) ---
        self._update_temperature(delta_time, velocity_u, velocity_v)
        
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
        
        # Increment simulation time for day/night cycle
        self.simulation_time += delta_time

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
        Update dissolved oxygen based on respiration, photosynthesis, and temperature-dependent solubility.
        Phase 2: DO saturation decreases with temperature!
        """
        P = self.phytoplankton
        Z = self.zooplankton
        D = self.detritus
        
        # Oxygen production from photosynthesis (light-dependent, simplified)
        photosynthesis_O2 = P * 0.12 * dt_days
        
        # Respiration consumes oxygen
        respiration = (P * 0.1 + Z * 0.15 + D * 0.05) * self.bod
        self.dissolved_oxygen += photosynthesis_O2 - respiration * dt_days
        
        # Temperature-dependent DO saturation (Phase 2 critical!)
        # DO_sat(T) = 14.6 - 0.41*(T - 10) mg/L (empirical freshwater formula)
        DO_saturation = 14.6 - 0.41 * (self.temperature - 10.0)
        DO_saturation = np.clip(DO_saturation, 4.0, 16.0)  # Physical bounds
        
        # Gas exchange with atmosphere (re-aeration)
        # If DO < DO_sat, water absorbs O2; if DO > DO_sat, water releases O2
        k_reaeration = 0.1  # day⁻¹ (reaeration coefficient)
        reaeration = k_reaeration * (DO_saturation - self.dissolved_oxygen) * dt_days
        self.dissolved_oxygen += reaeration

    def _update_temperature(self, dt: float, velocity_u: Optional[np.ndarray] = None,
                           velocity_v: Optional[np.ndarray] = None):
        """
        Update temperature field with solar heating, cooling, advection, and diffusion.
        Phase 2: Implements day/night cycle and marine heatwave scenarios.
        
        ∂T/∂t = Q_solar + Q_atm + κ_T·∇²T - u·∇T
        """
        # Day/night cycle (24-hour period = 86400 seconds)
        hour_of_day = (self.simulation_time % 86400) / 3600.0  # 0-24 hours
        solar_factor = np.maximum(0, np.sin(np.pi * (hour_of_day - 6) / 12))  # Peak at noon
        
        # Solar heating (spatially uniform for now, could add spatial variation)
        Q_solar = self.solar_heating_rate * solar_factor
        
        # Atmospheric cooling (radiative + evaporative)
        Q_atm = -self.atmospheric_cooling_rate
        
        # Marine heatwave anomaly (if active)
        if self.heatwave_active:
            Q_solar += self.heatwave_intensity / 86400.0  # Convert °C/day to °C/s
        
        # Apply heating/cooling
        self.temperature += (Q_solar + Q_atm) * dt
        
        # Advection of heat (if velocity provided)
        if velocity_u is not None and velocity_v is not None:
            self._advect_tracer(self.temperature, velocity_u, velocity_v, dt)
        
        # Thermal diffusion (heat spreads faster than dissolved chemicals)
        laplacian = (
            np.roll(self.temperature, 1, axis=0) + np.roll(self.temperature, -1, axis=0) +
            np.roll(self.temperature, 1, axis=1) + np.roll(self.temperature, -1, axis=1) - 
            4 * self.temperature
        ) / (self.dx ** 2)
        self.temperature += self.thermal_diffusivity * laplacian * dt
        
        # Clamp temperature to realistic bounds
        self.temperature = np.clip(self.temperature, 0.0, 40.0)

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
        self.temperature = np.clip(self.temperature, 0.0, 40.0)

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
    
    def activate_marine_heatwave(self, intensity: float = 3.0):
        """
        Activate marine heatwave scenario.
        
        Args:
            intensity: Temperature anomaly in °C (typically 3-5°C)
        """
        self.heatwave_active = True
        self.heatwave_intensity = intensity
        print(f"🌡️ Marine Heatwave ACTIVATED: +{intensity}°C anomaly")
    
    def deactivate_marine_heatwave(self):
        """
        Deactivate marine heatwave scenario.
        """
        self.heatwave_active = False
        self.heatwave_intensity = 0.0
        print("🌡️ Marine Heatwave deactivated")
    
    def inject_temperature(self, x: int, y: int, radius: int, delta_temp: float):
        """
        Inject localized temperature anomaly (e.g., thermal discharge, upwelling).
        
        Args:
            x, y: Grid coordinates
            radius: Injection radius in grid cells
            delta_temp: Temperature change in °C
        """
        for i in range(max(0, x - radius), min(self.nx, x + radius + 1)):
            for j in range(max(0, y - radius), min(self.ny, y + radius + 1)):
                dist = np.sqrt((i - x)**2 + (j - y)**2)
                if dist <= radius:
                    # Gaussian profile
                    weight = np.exp(-dist**2 / (2 * (radius / 3)**2))
                    self.temperature[i, j] += delta_temp * weight
