# backend/core/biology_solver.py

class BiologySolver:
    """
    Manages the ecological feedback, trophic cascades, and mortality logic for
    higher-order species (beyond the NPZD model).
    """
    def __init__(self):
        # Population counts for key indicator species
        self.indicator_species = {
            "stoneflies": 100,   # Pristine water indicator
            "leeches": 5,        # Polluted water indicator
            "seagrass": 500,     # Habitat-forming species (m^2)
            "top_predator": 10   # e.g., Large fish
        }
        self.pathogen_load = 10  # E. coli CFU/100mL
        print("Biology Engine Initialized with Trophic Logic.")

    def update(self, chemistry_solver, delta_time):
        """
        Updates biological populations based on chemical conditions from the
        chemistry solver, implementing trophic cascade logic.
        """
        # --- 1. Direct Chemical Impacts ---
        
        # Hypoxia impacts sensitive species
        if chemistry_solver.is_hypoxic():
            # Stoneflies are very sensitive to low oxygen
            self.indicator_species["stoneflies"] *= (1 - 0.5 * delta_time)
            # Top predators are also sensitive
            self.indicator_species["top_predator"] *= (1 - 0.2 * delta_time)

        # High nutrient/phytoplankton levels (algal bloom) favor pollution-tolerant species
        if chemistry_solver.get_parameter("phytoplankton") > 5.0:
            self.indicator_species["leeches"] += 20 * delta_time
        
        # --- 2. Trophic Cascade Logic ---

        # If Top Predators die off, their prey (not explicitly modeled, but implied)
        # would decrease, which could lead to an explosion of grazers that eat seagrass.
        # For this simulation, we'll simplify: low predator count directly impacts seagrass.
        if self.indicator_species["top_predator"] < 5:
            # Simulate overgrazing on seagrass due to lack of predators
            self.indicator_species["seagrass"] *= (1 - 0.1 * delta_time)

        # Clamp populations to be non-negative
        for key in self.indicator_species:
            self.indicator_species[key] = max(0, self.indicator_species[key])

    def get_health_status(self):
        """
        Provides a qualitative assessment of ecosystem health based on the
        balance of indicator species.
        """
        if self.indicator_species["stoneflies"] > 50 and self.indicator_species["seagrass"] > 400:
            return "Pristine: Healthy and balanced ecosystem."
        elif self.indicator_species["leeches"] > 50:
            return "Heavily Polluted: Dominated by pollution-tolerant species."
        elif self.indicator_species["seagrass"] < 100:
            return "Habitat Collapse: Critical loss of foundational seagrass beds."
        elif self.indicator_species["top_predator"] < 2:
            return "Trophic Cascade: Loss of top predators is destabilizing the food web."
        return "Moderate: System is under stress."
