# backend/core/chemistry_solver.py
import math

class ChemistrySolver:
    """
    Manages biogeochemical cycles and pollutant decay based on the NPZD model.
    NPZD: Nutrient, Phytoplankton, Zooplankton, Detritus.
    """
    def __init__(self):
        self.parameters = {
            # Core NPZD Components
            "nutrient": 10.0,          # µmol/L (e.g., Nitrate)
            "phytoplankton": 1.0,      # µmol/L
            "zooplankton": 0.5,        # µmol/L
            "detritus": 0.1,           # µmol/L
            
            # Water Quality Parameters
            "dissolved_oxygen": 8.0,   # mg/L
            "ph": 8.1,
            "bod": 1.0                 # mg/L
        }
        # Constants for the NPZD model (simplified Lotka-Volterra style)
        self.growth_rate_phyto = 0.5    # Growth rate of phytoplankton
        self.grazing_rate_zoo = 0.2     # Rate at which zooplankton eat phytoplankton
        self.mortality_rate_phyto = 0.1
        self.mortality_rate_zoo = 0.05
        self.remineralization_rate = 0.03 # Rate detritus turns back to nutrients
        print("Chemistry Engine Initialized with NPZD model.")

    def update(self, delta_time):
        """
        Simulates one time-step of the NPZD interactions.
        """
        N = self.parameters["nutrient"]
        P = self.parameters["phytoplankton"]
        Z = self.parameters["zooplankton"]
        D = self.parameters["detritus"]

        # --- NPZD Equations (Simplified) ---
        
        # 1. Phytoplankton growth and loss
        phyto_growth = self.growth_rate_phyto * N / (1 + N) * P  # Growth depends on nutrients
        phyto_grazing = self.grazing_rate_zoo * P * Z            # Eaten by zooplankton
        phyto_mortality = self.mortality_rate_phyto * P
        
        # 2. Zooplankton growth and loss
        zoo_growth = self.grazing_rate_zoo * P * Z * 0.8 # Assimilation efficiency
        zoo_mortality = self.mortality_rate_zoo * Z

        # 3. Detritus changes
        detritus_gain = (phyto_mortality + zoo_mortality)
        detritus_loss = self.remineralization_rate * D

        # --- Update state variables ---
        self.parameters["nutrient"] -= (phyto_growth - detritus_loss) * delta_time
        self.parameters["phytoplankton"] += (phyto_growth - phyto_grazing - phyto_mortality) * delta_time
        self.parameters["zooplankton"] += (zoo_growth - zoo_mortality) * delta_time
        self.parameters["detritus"] += (detritus_gain - detritus_loss) * delta_time

        # Clamp values to be non-negative
        for key in ["nutrient", "phytoplankton", "zooplankton", "detritus"]:
            self.parameters[key] = max(0, self.parameters[key])

        # --- Update other chemical parameters ---
        # Oxygen is consumed by respiration from all living components and detritus decay
        respiration = (P * 0.1 + Z * 0.2 + D * 0.3) * self.parameters["bod"]
        self.parameters["dissolved_oxygen"] -= respiration * delta_time
        self.parameters["dissolved_oxygen"] = max(0, self.parameters["dissolved_oxygen"])


    def get_parameter(self, name):
        return self.parameters.get(name, None)

    def is_hypoxic(self):
        """Checks if the system is in a hypoxic state."""
        return self.parameters["dissolved_oxygen"] < 2.0
