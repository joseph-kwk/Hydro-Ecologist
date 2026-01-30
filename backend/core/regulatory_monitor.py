# backend/core/regulatory_monitor.py
"""
Phase 4: Regulatory Compliance & Water Quality Standards Monitoring

Tracks compliance with EPA water quality standards including:
- EPA 303(d) Impaired Waters List criteria
- TMDL (Total Maximum Daily Load) compliance
- State water quality standards
- Violation tracking and reporting
"""

from dataclasses import dataclass, field
from typing import Dict, List, Optional
from datetime import datetime
from enum import Enum


class ImpairmentCategory(Enum):
    """EPA 303(d) impairment categories"""
    NONE = "none"
    THREATENED = "threatened"
    IMPAIRED = "impaired"
    SEVERELY_IMPAIRED = "severely_impaired"


class ParameterStandard(Enum):
    """Water quality parameter standards (typical freshwater)"""
    # Dissolved Oxygen (mg/L)
    DO_MIN_COLD = 6.0      # Cold water fishery minimum
    DO_MIN_WARM = 5.0      # Warm water fishery minimum
    DO_MIN_SURVIVAL = 3.0  # Minimum for survival
    
    # Nutrients (µmol/L)
    NUTRIENT_EUTROPHIC = 50.0      # Eutrophic threshold
    NUTRIENT_HYPEREUTROPHIC = 100.0  # Hypereutrophic threshold
    
    # pH range
    PH_MIN = 6.5
    PH_MAX = 8.5
    
    # Temperature (Celsius)
    TEMP_MAX_COLD = 20.0   # Cold water species
    TEMP_MAX_WARM = 28.0   # Warm water species
    TEMP_MAX_CRITICAL = 32.0  # Critical stress
    
    # BOD (mg/L)
    BOD_MAX_GOOD = 1.0
    BOD_MAX_FAIR = 3.0
    BOD_MAX_POOR = 5.0


@dataclass
class ViolationEvent:
    """Records a water quality standard violation"""
    parameter: str
    value: float
    threshold: float
    severity: str  # "minor", "major", "critical"
    timestamp: str
    duration_steps: int = 0  # How long violation persists


@dataclass
class TMDLStatus:
    """TMDL (Total Maximum Daily Load) tracking"""
    parameter: str
    daily_load: float  # Current loading (kg/day or similar)
    max_load: float    # TMDL limit
    compliance: bool   # True if within limit
    reduction_needed: float  # Percentage reduction to meet TMDL


class RegulatoryMonitor:
    """
    Monitors water quality against regulatory standards.
    Tracks violations, impairment status, and TMDL compliance.
    """
    
    def __init__(self, waterbody_type: str = "warm_water_fishery"):
        """
        Args:
            waterbody_type: "cold_water_fishery", "warm_water_fishery", 
                           "estuarine", "coastal"
        """
        self.waterbody_type = waterbody_type
        self.violations: List[ViolationEvent] = []
        self.current_impairment = ImpairmentCategory.NONE
        self.consecutive_violations = 0
        self.total_steps_monitored = 0
        
        # TMDL targets (example values - would be site-specific)
        self.tmdl_targets = {
            "nutrient": 30.0,  # µmol/L daily average
            "bod": 2.0,        # mg/L daily average
            "sediment": 10.0   # mg/L suspended solids
        }
        
        # Set DO standard based on waterbody type
        if waterbody_type == "cold_water_fishery":
            self.do_standard = ParameterStandard.DO_MIN_COLD.value
            self.temp_max = ParameterStandard.TEMP_MAX_COLD.value
        else:
            self.do_standard = ParameterStandard.DO_MIN_WARM.value
            self.temp_max = ParameterStandard.TEMP_MAX_WARM.value
    
    def assess_compliance(self, chemistry_data: Dict) -> Dict:
        """
        Evaluates current water quality against all standards.
        
        Args:
            chemistry_data: Dict with keys: dissolved_oxygen, nutrient, 
                           ph, bod, temperature
        
        Returns:
            Compliance report with violations and impairment status
        """
        self.total_steps_monitored += 1
        current_violations = []
        
        # Check Dissolved Oxygen
        do_val = chemistry_data.get("dissolved_oxygen", 10.0)
        if do_val < ParameterStandard.DO_MIN_SURVIVAL.value:
            current_violations.append(self._create_violation(
                "dissolved_oxygen", do_val, 
                ParameterStandard.DO_MIN_SURVIVAL.value, "critical"
            ))
        elif do_val < self.do_standard:
            current_violations.append(self._create_violation(
                "dissolved_oxygen", do_val, self.do_standard, "major"
            ))
        
        # Check Nutrients
        nutrient_val = chemistry_data.get("nutrient", 10.0)
        if nutrient_val > ParameterStandard.NUTRIENT_HYPEREUTROPHIC.value:
            current_violations.append(self._create_violation(
                "nutrient", nutrient_val,
                ParameterStandard.NUTRIENT_HYPEREUTROPHIC.value, "major"
            ))
        elif nutrient_val > ParameterStandard.NUTRIENT_EUTROPHIC.value:
            current_violations.append(self._create_violation(
                "nutrient", nutrient_val,
                ParameterStandard.NUTRIENT_EUTROPHIC.value, "minor"
            ))
        
        # Check pH
        ph_val = chemistry_data.get("ph", 7.5)
        if ph_val < ParameterStandard.PH_MIN.value or ph_val > ParameterStandard.PH_MAX.value:
            current_violations.append(self._create_violation(
                "ph", ph_val, 
                f"{ParameterStandard.PH_MIN.value}-{ParameterStandard.PH_MAX.value}",
                "major"
            ))
        
        # Check Temperature
        temp_val = chemistry_data.get("temperature", 20.0)
        if temp_val > ParameterStandard.TEMP_MAX_CRITICAL.value:
            current_violations.append(self._create_violation(
                "temperature", temp_val,
                ParameterStandard.TEMP_MAX_CRITICAL.value, "critical"
            ))
        elif temp_val > self.temp_max:
            current_violations.append(self._create_violation(
                "temperature", temp_val, self.temp_max, "major"
            ))
        
        # Check BOD
        bod_val = chemistry_data.get("bod", 1.0)
        if bod_val > ParameterStandard.BOD_MAX_POOR.value:
            current_violations.append(self._create_violation(
                "bod", bod_val, ParameterStandard.BOD_MAX_POOR.value, "major"
            ))
        elif bod_val > ParameterStandard.BOD_MAX_FAIR.value:
            current_violations.append(self._create_violation(
                "bod", bod_val, ParameterStandard.BOD_MAX_FAIR.value, "minor"
            ))
        
        # Update violation tracking
        if current_violations:
            self.violations.extend(current_violations)
            self.consecutive_violations += 1
        else:
            self.consecutive_violations = 0
        
        # Keep only recent violations (last 100)
        if len(self.violations) > 100:
            self.violations = self.violations[-100:]
        
        # Update impairment status
        self._update_impairment_status(current_violations)
        
        # Calculate TMDL status
        tmdl_status = self._assess_tmdl(chemistry_data)
        
        return {
            "compliant": len(current_violations) == 0,
            "violations": [
                {
                    "parameter": v.parameter,
                    "value": round(v.value, 2),
                    "threshold": v.threshold,
                    "severity": v.severity,
                    "timestamp": v.timestamp
                }
                for v in current_violations
            ],
            "impairment_category": self.current_impairment.value,
            "consecutive_violations": self.consecutive_violations,
            "total_violations": len(self.violations),
            "waterbody_type": self.waterbody_type,
            "tmdl_status": tmdl_status,
            "standards": {
                "do_minimum": self.do_standard,
                "temp_maximum": self.temp_max,
                "nutrient_eutrophic": ParameterStandard.NUTRIENT_EUTROPHIC.value,
                "bod_maximum": ParameterStandard.BOD_MAX_FAIR.value
            }
        }
    
    def _create_violation(self, parameter: str, value: float, 
                         threshold: float, severity: str) -> ViolationEvent:
        """Creates a violation event record"""
        return ViolationEvent(
            parameter=parameter,
            value=value,
            threshold=threshold,
            severity=severity,
            timestamp=datetime.now().isoformat()
        )
    
    def _update_impairment_status(self, current_violations: List[ViolationEvent]):
        """Updates EPA 303(d) impairment category"""
        critical_count = sum(1 for v in current_violations if v.severity == "critical")
        major_count = sum(1 for v in current_violations if v.severity == "major")
        
        if critical_count > 0 or self.consecutive_violations > 10:
            self.current_impairment = ImpairmentCategory.SEVERELY_IMPAIRED
        elif major_count > 0 or self.consecutive_violations > 5:
            self.current_impairment = ImpairmentCategory.IMPAIRED
        elif len(current_violations) > 0:
            self.current_impairment = ImpairmentCategory.THREATENED
        elif self.consecutive_violations == 0:
            self.current_impairment = ImpairmentCategory.NONE
    
    def _assess_tmdl(self, chemistry_data: Dict) -> List[TMDLStatus]:
        """Assesses TMDL compliance for key pollutants"""
        tmdl_results = []
        
        # Nutrient TMDL
        nutrient_val = chemistry_data.get("nutrient", 10.0)
        nutrient_tmdl = self.tmdl_targets["nutrient"]
        tmdl_results.append({
            "parameter": "nutrient",
            "current_load": round(nutrient_val, 2),
            "tmdl_limit": nutrient_tmdl,
            "compliance": nutrient_val <= nutrient_tmdl,
            "reduction_needed": round(max(0, (nutrient_val - nutrient_tmdl) / nutrient_val * 100), 1)
        })
        
        # BOD TMDL
        bod_val = chemistry_data.get("bod", 1.0)
        bod_tmdl = self.tmdl_targets["bod"]
        tmdl_results.append({
            "parameter": "bod",
            "current_load": round(bod_val, 2),
            "tmdl_limit": bod_tmdl,
            "compliance": bod_val <= bod_tmdl,
            "reduction_needed": round(max(0, (bod_val - bod_tmdl) / bod_val * 100), 1)
        })
        
        return tmdl_results
    
    def get_compliance_summary(self) -> Dict:
        """Returns overall compliance history and statistics"""
        recent_violations = self.violations[-20:] if self.violations else []
        
        violation_by_parameter = {}
        for v in self.violations:
            violation_by_parameter[v.parameter] = violation_by_parameter.get(v.parameter, 0) + 1
        
        return {
            "total_assessments": self.total_steps_monitored,
            "total_violations": len(self.violations),
            "violation_rate": round(len(self.violations) / max(1, self.total_steps_monitored) * 100, 1),
            "current_impairment": self.current_impairment.value,
            "consecutive_violations": self.consecutive_violations,
            "violations_by_parameter": violation_by_parameter,
            "recent_violations": [
                {
                    "parameter": v.parameter,
                    "value": round(v.value, 2),
                    "threshold": v.threshold,
                    "severity": v.severity
                }
                for v in recent_violations
            ],
            "waterbody_type": self.waterbody_type
        }
    
    def reset(self):
        """Resets monitoring history"""
        self.violations.clear()
        self.current_impairment = ImpairmentCategory.NONE
        self.consecutive_violations = 0
        self.total_steps_monitored = 0
