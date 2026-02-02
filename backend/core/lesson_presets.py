# backend/core/lesson_presets.py

from __future__ import annotations

from dataclasses import dataclass
from typing import Dict, List, Literal, Optional


LessonActionType = Literal[
    "select_target",
    "reset",
    "inject",
    "heatwave",
    "deploy_remediation",
    "step_n",
]


@dataclass(frozen=True)
class LessonAction:
    type: LessonActionType
    params: Dict


@dataclass(frozen=True)
class LessonPreset:
    id: str
    target_id: str
    name: str
    description: str
    actions: List[LessonAction]


LESSON_PRESETS: List[LessonPreset] = [
    LessonPreset(
        id="lake_bloom_then_hypoxia",
        target_id="urban_lake",
        name="Bloom → Hypoxia",
        description="Add nutrients, then observe bloom growth and DO decline from respiration/BOD.",
        actions=[
            LessonAction(type="select_target", params={"target_id": "urban_lake"}),
            LessonAction(type="reset", params={}),
            LessonAction(type="inject", params={"nutrient": 12.0, "pollutant": 0.0}),
            LessonAction(type="step_n", params={"n": 20}),
        ],
    ),
    LessonPreset(
        id="lake_bod_shock",
        target_id="urban_lake",
        name="BOD Shock",
        description="Introduce a pollutant/BOD pulse and watch DO crash dynamics.",
        actions=[
            LessonAction(type="select_target", params={"target_id": "urban_lake"}),
            LessonAction(type="reset", params={}),
            LessonAction(type="inject", params={"nutrient": 0.0, "pollutant": 4.0}),
            LessonAction(type="step_n", params={"n": 15}),
        ],
    ),
    LessonPreset(
        id="estuary_heatwave",
        target_id="coastal_estuary",
        name="Marine Heatwave",
        description="Activate a heatwave and observe temperature-driven DO saturation stress.",
        actions=[
            LessonAction(type="select_target", params={"target_id": "coastal_estuary"}),
            LessonAction(type="reset", params={}),
            LessonAction(type="heatwave", params={"activate": True, "intensity": 3.5}),
            LessonAction(type="step_n", params={"n": 20}),
        ],
    ),
    LessonPreset(
        id="river_cold_standards",
        target_id="cold_river",
        name="Cold-Water Standards",
        description="Switch to cold-water standards and test how interventions affect compliance.",
        actions=[
            LessonAction(type="select_target", params={"target_id": "cold_river"}),
            LessonAction(type="reset", params={}),
            LessonAction(type="inject", params={"nutrient": 5.0, "pollutant": 1.0}),
            LessonAction(type="step_n", params={"n": 10}),
        ],
    ),
    LessonPreset(
        id="remediation_aeration_demo",
        target_id="urban_lake",
        name="Aeration Remediation",
        description="Create stress, deploy aeration, and compare recovery behavior.",
        actions=[
            LessonAction(type="select_target", params={"target_id": "urban_lake"}),
            LessonAction(type="reset", params={}),
            LessonAction(type="inject", params={"nutrient": 0.0, "pollutant": 3.0}),
            LessonAction(type="step_n", params={"n": 6}),
            LessonAction(
                type="deploy_remediation",
                params={"x": 50, "y": 50, "radius": 12, "intervention_type": "aeration", "intensity": 1.0},
            ),
            LessonAction(type="step_n", params={"n": 12}),
        ],
    ),

    LessonPreset(
        id="lake_chronic_loading",
        target_id="urban_lake",
        name="Chronic Nutrient Loading",
        description="Repeated small nutrient inputs can accumulate into bloom risk over time.",
        actions=[
            LessonAction(type="select_target", params={"target_id": "urban_lake"}),
            LessonAction(type="reset", params={}),
            LessonAction(type="inject", params={"nutrient": 4.0, "pollutant": 0.0}),
            LessonAction(type="step_n", params={"n": 6}),
            LessonAction(type="inject", params={"nutrient": 4.0, "pollutant": 0.0}),
            LessonAction(type="step_n", params={"n": 6}),
            LessonAction(type="inject", params={"nutrient": 4.0, "pollutant": 0.0}),
            LessonAction(type="step_n", params={"n": 10}),
        ],
    ),
    LessonPreset(
        id="estuary_compound_stress",
        target_id="coastal_estuary",
        name="Compound Stress: Heatwave + Spill",
        description="Combine a heatwave with a BOD/pollutant pulse and observe compounding DO stress.",
        actions=[
            LessonAction(type="select_target", params={"target_id": "coastal_estuary"}),
            LessonAction(type="reset", params={}),
            LessonAction(type="heatwave", params={"activate": True, "intensity": 4.0}),
            LessonAction(type="inject", params={"nutrient": 0.0, "pollutant": 2.5}),
            LessonAction(type="step_n", params={"n": 20}),
        ],
    ),
    LessonPreset(
        id="river_nutrient_pulse",
        target_id="cold_river",
        name="River Nutrient Pulse",
        description="Single nutrient pulse in a cold river target to contrast bloom dynamics vs lakes.",
        actions=[
            LessonAction(type="select_target", params={"target_id": "cold_river"}),
            LessonAction(type="reset", params={}),
            LessonAction(type="inject", params={"nutrient": 8.0, "pollutant": 0.0}),
            LessonAction(type="step_n", params={"n": 12}),
        ],
    ),
    LessonPreset(
        id="lake_aeration_early",
        target_id="urban_lake",
        name="Aeration Timing (Early)",
        description="Deploy aeration soon after a BOD shock and compare recovery to the late case.",
        actions=[
            LessonAction(type="select_target", params={"target_id": "urban_lake"}),
            LessonAction(type="reset", params={}),
            LessonAction(type="inject", params={"nutrient": 0.0, "pollutant": 3.0}),
            LessonAction(type="step_n", params={"n": 2}),
            LessonAction(
                type="deploy_remediation",
                params={"x": 50, "y": 50, "radius": 12, "intervention_type": "aeration", "intensity": 1.0},
            ),
            LessonAction(type="step_n", params={"n": 12}),
        ],
    ),
    LessonPreset(
        id="lake_aeration_late",
        target_id="urban_lake",
        name="Aeration Timing (Late)",
        description="Wait longer before aeration after a BOD shock; compare recovery to early action.",
        actions=[
            LessonAction(type="select_target", params={"target_id": "urban_lake"}),
            LessonAction(type="reset", params={}),
            LessonAction(type="inject", params={"nutrient": 0.0, "pollutant": 3.0}),
            LessonAction(type="step_n", params={"n": 10}),
            LessonAction(
                type="deploy_remediation",
                params={"x": 50, "y": 50, "radius": 12, "intervention_type": "aeration", "intensity": 1.0},
            ),
            LessonAction(type="step_n", params={"n": 12}),
        ],
    ),
]


def list_lessons(target_id: Optional[str] = None) -> List[LessonPreset]:
    if not target_id:
        return LESSON_PRESETS
    return [l for l in LESSON_PRESETS if l.target_id == target_id]


def get_lesson(lesson_id: str) -> Optional[LessonPreset]:
    for l in LESSON_PRESETS:
        if l.id == lesson_id:
            return l
    return None
