# backend/core/remediation_manager.py
import numpy as np
from typing import List, Dict, Tuple, Optional
from dataclasses import dataclass
from enum import Enum

class RemediationType(str, Enum):
    """Types of remediation interventions"""
    AERATION = "aeration"
    WETLAND = "wetland"
    OYSTER_REEF = "oyster_reef"

@dataclass
class RemediationZone:
    """
    Represents a deployed remediation intervention.
    """
    id: int
    type: RemediationType
    x: int  # Grid x-coordinate (center)
    y: int  # Grid y-coordinate (center)
    radius: int  # Effective radius in grid cells
    intensity: float  # Effectiveness (0.0-1.0)
    cost: float  # Installation cost ($)
    operational_cost: float  # $/day
    age_days: float = 0.0  # Days since deployment
    active: bool = True
    
    def get_effectiveness(self) -> float:
        """
        Get current effectiveness accounting for degradation over time.
        Effectiveness decreases by ~10% per year for biological systems.
        """
        if not self.active:
            return 0.0
        
        # Degradation model (exponential decay)
        if self.type == RemediationType.WETLAND:
            # Wetlands maintain 90% effectiveness for ~5 years
            decay_rate = 0.00005  # day⁻¹
            return self.intensity * np.exp(-decay_rate * self.age_days)
        elif self.type == RemediationType.OYSTER_REEF:
            # Oysters maintain effectiveness if healthy
            decay_rate = 0.00002
            return self.intensity * np.exp(-decay_rate * self.age_days)
        else:
            # Mechanical systems (aeration) - minimal degradation
            return self.intensity


class RemediationManager:
    """
    Manages deployment and effects of remediation interventions.
    Phase 3: Restoration toolkit for water quality management.
    """
    def __init__(self, grid_shape: Tuple[int, int]):
        self.nx, self.ny = grid_shape
        self.zones: List[RemediationZone] = []
        self.next_id = 0
        self.total_cost = 0.0
        self.daily_operational_cost = 0.0
        
        # Remediation effectiveness parameters
        self.aeration_DO_boost = 2.0  # mg/L per day at full intensity
        self.wetland_nutrient_removal = 0.3  # fraction per day
        self.wetland_BOD_removal = 0.4  # fraction per day
        self.oyster_filtration_rate = 0.2  # fraction per day (phyto, detritus)
        self.oyster_nutrient_uptake = 0.15  # fraction per day
        
        print("Remediation Manager Initialized")
    
    def deploy_intervention(self, x: int, y: int, radius: int, 
                          intervention_type: RemediationType,
                          intensity: float = 1.0) -> Dict:
        """
        Deploy a new remediation intervention.
        
        Args:
            x, y: Grid coordinates (center of intervention)
            radius: Effective radius in grid cells
            intervention_type: Type of intervention
            intensity: Effectiveness (0.0-1.0)
        
        Returns:
            Dictionary with deployment info
        """
        # Calculate costs based on intervention type and size
        area = np.pi * radius**2  # grid cells
        
        if intervention_type == RemediationType.AERATION:
            cost = 5000 + area * 200  # Base + per-cell cost
            op_cost = 50 + area * 2  # $/day (electricity)
        elif intervention_type == RemediationType.WETLAND:
            cost = 10000 + area * 500  # Higher upfront for construction
            op_cost = 10 + area * 0.5  # Minimal maintenance
        elif intervention_type == RemediationType.OYSTER_REEF:
            cost = 8000 + area * 300  # Oyster seeding + structure
            op_cost = 5 + area * 0.3  # Monitoring
        else:
            cost = 5000
            op_cost = 10
        
        zone = RemediationZone(
            id=self.next_id,
            type=intervention_type,
            x=x,
            y=y,
            radius=radius,
            intensity=intensity,
            cost=cost,
            operational_cost=op_cost
        )
        
        self.zones.append(zone)
        self.total_cost += cost
        self.daily_operational_cost += op_cost
        self.next_id += 1
        
        return {
            "id": zone.id,
            "type": zone.type,
            "location": {"x": x, "y": y, "radius": radius},
            "cost": cost,
            "operational_cost_per_day": op_cost,
            "total_cumulative_cost": self.total_cost,
            "message": f"Deployed {intervention_type} at ({x}, {y})"
        }
    
    def remove_intervention(self, zone_id: int) -> Dict:
        """Remove an intervention by ID."""
        zone = next((z for z in self.zones if z.id == zone_id), None)
        if zone:
            zone.active = False
            self.daily_operational_cost -= zone.operational_cost
            return {
                "message": f"Deactivated intervention {zone_id}",
                "type": zone.type,
                "savings_per_day": zone.operational_cost
            }
        return {"error": "Intervention not found"}
    
    def apply_remediations(self, chemistry_solver, delta_time: float):
        """
        Apply remediation effects to chemistry grids.
        Called each timestep to modify water quality parameters.
        
        Args:
            chemistry_solver: ChemistrySolver instance
            delta_time: Timestep in seconds
        """
        dt_days = delta_time / 86400.0
        
        for zone in self.zones:
            if not zone.active:
                continue
            
            # Update zone age
            zone.age_days += dt_days
            effectiveness = zone.get_effectiveness()
            
            # Create spatial mask for this zone (Gaussian profile)
            mask = self._create_zone_mask(zone.x, zone.y, zone.radius)
            
            # Apply intervention-specific effects
            if zone.type == RemediationType.AERATION:
                self._apply_aeration(chemistry_solver, mask, effectiveness, dt_days)
            elif zone.type == RemediationType.WETLAND:
                self._apply_wetland(chemistry_solver, mask, effectiveness, dt_days)
            elif zone.type == RemediationType.OYSTER_REEF:
                self._apply_oyster_reef(chemistry_solver, mask, effectiveness, dt_days)
    
    def _create_zone_mask(self, x: int, y: int, radius: int) -> np.ndarray:
        """
        Create Gaussian spatial mask for intervention zone.
        
        Returns:
            2D array with values 0-1 (0 = no effect, 1 = full effect)
        """
        mask = np.zeros((self.nx, self.ny))
        for i in range(max(0, x - radius * 2), min(self.nx, x + radius * 2)):
            for j in range(max(0, y - radius * 2), min(self.ny, y + radius * 2)):
                dist = np.sqrt((i - x)**2 + (j - y)**2)
                if dist <= radius * 2:
                    # Gaussian falloff
                    mask[i, j] = np.exp(-dist**2 / (2 * radius**2))
        return mask
    
    def _apply_aeration(self, chem, mask: np.ndarray, effectiveness: float, dt_days: float):
        """
        Apply aeration effects: Increase DO towards saturation.
        """
        DO_boost = self.aeration_DO_boost * effectiveness * mask * dt_days
        chem.dissolved_oxygen += DO_boost
        # Also reduce BOD through oxidation
        BOD_oxidation = 0.1 * mask * effectiveness * dt_days
        chem.bod *= (1 - BOD_oxidation)
    
    def _apply_wetland(self, chem, mask: np.ndarray, effectiveness: float, dt_days: float):
        """
        Apply wetland effects: Remove nutrients and BOD through biological uptake.
        """
        # Nutrient uptake by wetland plants
        nutrient_removal = self.wetland_nutrient_removal * effectiveness * mask * dt_days
        chem.nutrient *= (1 - nutrient_removal)
        
        # BOD reduction through microbial breakdown
        BOD_removal = self.wetland_BOD_removal * effectiveness * mask * dt_days
        chem.bod *= (1 - BOD_removal)
        
        # Slight DO increase from plant photosynthesis during day
        # (simplified - could check time of day)
        chem.dissolved_oxygen += 0.3 * mask * effectiveness * dt_days
    
    def _apply_oyster_reef(self, chem, mask: np.ndarray, effectiveness: float, dt_days: float):
        """
        Apply oyster reef effects: Filter phytoplankton, remove nutrients, clarify water.
        """
        # Oyster filtration (consume phytoplankton & detritus)
        filtration = self.oyster_filtration_rate * effectiveness * mask * dt_days
        chem.phytoplankton *= (1 - filtration)
        chem.detritus *= (1 - filtration * 0.5)  # Partial removal
        
        # Nutrient uptake (oysters sequester N in shells/tissue)
        nutrient_removal = self.oyster_nutrient_uptake * effectiveness * mask * dt_days
        chem.nutrient *= (1 - nutrient_removal)
        
        # Improved water clarity reduces turbidity (not yet modeled)
        # Oyster biodeposition adds some detritus (not yet modeled for complexity)
    
    def get_summary(self) -> Dict:
        """
        Get summary of all deployed interventions.
        """
        active_zones = [z for z in self.zones if z.active]
        return {
            "total_interventions": len(active_zones),
            "by_type": {
                "aeration": len([z for z in active_zones if z.type == RemediationType.AERATION]),
                "wetland": len([z for z in active_zones if z.type == RemediationType.WETLAND]),
                "oyster_reef": len([z for z in active_zones if z.type == RemediationType.OYSTER_REEF])
            },
            "total_capital_cost": self.total_cost,
            "daily_operational_cost": self.daily_operational_cost,
            "zones": [
                {
                    "id": z.id,
                    "type": z.type,
                    "location": {"x": z.x, "y": z.y, "radius": z.radius},
                    "effectiveness": z.get_effectiveness(),
                    "age_days": z.age_days
                }
                for z in active_zones
            ]
        }
