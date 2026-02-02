# backend/core/target_profiles.py

from __future__ import annotations

from dataclasses import dataclass
from typing import Dict, Tuple, Optional


@dataclass(frozen=True)
class TargetProfile:
    """Defines a user-selectable environment profile.

    This is intentionally a *screening/education* configuration layer:
    it sets baseline conditions and standards context, not site-calibration.
    """

    id: str
    name: str
    description: str

    # Model configuration
    grid_shape: Tuple[int, int] = (100, 100)
    domain_size: Tuple[float, float] = (200.0, 200.0)  # meters

    # Regulatory context
    waterbody_type: str = "warm_water_fishery"

    # Baseline chemistry (uniform fields)
    baseline: Optional[Dict[str, float]] = None

    # Baseline physics
    mean_depth_m: float = 10.0
    eddy_viscosity_m2_s: float = 0.01


TARGET_PROFILES: Dict[str, TargetProfile] = {
    "urban_lake": TargetProfile(
        id="urban_lake",
        name="Urban Lake",
        description="Warm, nutrient-impacted lake with higher BOD risk (education/screening).",
        waterbody_type="warm_water_fishery",
        baseline={
            "temperature": 24.0,
            "nutrient": 35.0,
            "phytoplankton": 2.5,
            "zooplankton": 0.8,
            "detritus": 0.3,
            "dissolved_oxygen": 7.0,
            "ph": 8.0,
            "bod": 2.5,
        },
        mean_depth_m=6.0,
        eddy_viscosity_m2_s=0.02,
    ),
    "coastal_estuary": TargetProfile(
        id="coastal_estuary",
        name="Coastal Estuary",
        description="Mixing-dominated nearshore estuary; generally well-oxygenated but event-sensitive.",
        waterbody_type="estuarine",
        baseline={
            "temperature": 20.0,
            "nutrient": 15.0,
            "phytoplankton": 1.2,
            "zooplankton": 0.6,
            "detritus": 0.15,
            "dissolved_oxygen": 8.5,
            "ph": 8.1,
            "bod": 1.2,
        },
        mean_depth_m=12.0,
        eddy_viscosity_m2_s=0.03,
    ),
    "cold_river": TargetProfile(
        id="cold_river",
        name="Cold-Water River Reach",
        description="Cooler, higher-DO system with stricter DO/temperature expectations (screening).",
        waterbody_type="cold_water_fishery",
        baseline={
            "temperature": 14.0,
            "nutrient": 8.0,
            "phytoplankton": 0.6,
            "zooplankton": 0.3,
            "detritus": 0.08,
            "dissolved_oxygen": 10.0,
            "ph": 7.6,
            "bod": 0.8,
        },
        mean_depth_m=3.0,
        eddy_viscosity_m2_s=0.01,
    ),
}
