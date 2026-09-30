"""End-to-end scenario simulation.

Runs the *real* event pipeline (dependency analysis, incident detection,
risk, AI, recommendations, audit) with a scripted event, so the demo shows
exactly what production ingestion would do.
"""

from __future__ import annotations

import uuid
from dataclasses import dataclass, field
from typing import Any

from sqlalchemy.ext.asyncio import AsyncSession

from apps.api.core.cache import Cache
from apps.api.schemas.event import EventCreate, EventResponse
from apps.api.schemas.intelligence import AIAnalysisResponse
from apps.api.schemas.recommendation import RecommendationResponse
from apps.api.schemas.simulation import (
    AuditStatus,
    HumanDecision,
    ScenarioInfo,
    SimulationRisk,
    SimulationRunResponse,
    TimelineStep,
)
from apps.api.services.audit_service import AuditService
from apps.api.services.demo_data import seed_demo_data
from apps.api.services.event_service import EventService
from apps.api.services.mappers import impact_nodes, incident_to_response
from packages.common import constants as C
from packages.common.enums import AuditAction, EventType, Severity, SimulationScenario
from packages.common.utils import utcnow
from packages.database.models import User
from packages.database.repositories import InfrastructureRepository
from packages.intelligence import AIProvider


@dataclass(frozen=True, slots=True)
class ScenarioDefinition:
    key: SimulationScenario
    name: str
    description: str
    event_type: EventType
    severity: Severity
    origin: str
    source: str
    title: str
    event_description: str
    chain: tuple[str, ...]
    payload: dict[str, Any] = field(default_factory=dict)
    use_origin_location: bool = False


SCENARIOS: dict[SimulationScenario, ScenarioDefinition] = {
    SimulationScenario.HOSPITAL_POWER_FAILURE: ScenarioDefinition(
        key=SimulationScenario.HOSPITAL_POWER_FAILURE,
        name="Hospital Power Failure",
        description="The Central Power Substation trips, cutting grid supply to Hyderabad Central Hospital "
        "and cascading to emergency healthcare and dispatch.",
        event_type=EventType.POWER_FAILURE,
        severity=Severity.CRITICAL,
        origin=C.DEMO_SUBSTATION,
        source="grid-monitor",
        title="Central Substation Power Failure",
        event_description="Unexpected power interruption: 132 kV bus-bar protection trip at the Central Substation.",
        chain=(C.DEMO_SUBSTATION, C.DEMO_HOSPITAL, C.DEMO_SVC_EMERGENCY_HEALTHCARE),
        payload={"voltage": 0, "duration_minutes": 12, "affected_customers": 48000},
    ),
    SimulationScenario.WATER_SUPPLY_DISRUPTION: ScenarioDefinition(
        key=SimulationScenario.WATER_SUPPLY_DISRUPTION,
        name="Water Supply Disruption",
        description="A filtration failure at the Water Treatment Plant interrupts the water service to the "
        "hospital and public facilities.",
        event_type=EventType.WATER_DISRUPTION,
        severity=Severity.HIGH,
        origin=C.DEMO_WATER_PLANT,
        source="scada-water",
        title="Water Treatment Plant Output Failure",
        event_description="Filtration train failure; treated-water output down 70%.",
        chain=(C.DEMO_WATER_PLANT, C.DEMO_SVC_WATER, C.DEMO_HOSPITAL),
        payload={"pressure_bar": 0.8, "duration_minutes": 35},
    ),
    SimulationScenario.TELECOM_OUTAGE: ScenarioDefinition(
        key=SimulationScenario.TELECOM_OUTAGE,
        name="Telecom Outage",
        description="Loss of the Telecom Tower takes down public mobile service and degrades emergency communications.",
        event_type=EventType.TELECOM_OUTAGE,
        severity=Severity.HIGH,
        origin=C.DEMO_TELECOM_TOWER,
        source="noc-telemetry",
        title="Telecom Tower Outage",
        event_description="Backhaul fibre cut; cell site offline.",
        chain=(C.DEMO_TELECOM_TOWER, C.DEMO_SVC_TELECOM, C.DEMO_SVC_EMERGENCY_COMMS),
        payload={"cells_down": 3, "packet_loss_pct": 100},
    ),
    SimulationScenario.FLOOD_INFRASTRUCTURE_RISK: ScenarioDefinition(
        key=SimulationScenario.FLOOD_INFRASTRUCTURE_RISK,
        name="Flood Infrastructure Risk",
        description="Flash flooding on the Critical Road corridor; a PostGIS radius search finds the hospital, "
        "power substation and emergency services centre inside the flood zone.",
        event_type=EventType.FLOOD,
        severity=Severity.CRITICAL,
        origin=C.DEMO_ROAD,
        source="flood-sensor-network",
        title="Flash Flood on Critical Road Corridor",
        event_description="Water level 1.4 m above road surface after 180 mm rainfall in 3 hours.",
        chain=(C.DEMO_ROAD, C.DEMO_HOSPITAL, C.DEMO_SUBSTATION, C.DEMO_EMERGENCY_CENTER),
        payload={"rainfall_mm": 180, "water_level_m": 1.4, "impact_radius_m": 1500},
        use_origin_location=True,
    ),
}


def list_scenarios() -> list[ScenarioInfo]:
    return [
        ScenarioInfo(
            key=s.key,
            name=s.name,
            description=s.description,
            event_type=s.event_type.value,
            severity=s.severity.value,
            origin=s.origin,
            chain=list(s.chain),
        )
        for s in SCENARIOS.values()
    ]


class SimulationService:
    def __init__(self, session: AsyncSession, ai_provider: AIProvider, cache: Cache | None = None) -> None:
        self.session = session
        self.ai_provider = ai_provider
        self.cache = cache
        self.infra = InfrastructureRepository(session)

    async def _ensure_topology(self, scenario: ScenarioDefinition) -> None:
        if await self.infra.get_by_name(scenario.origin) is None:
            await seed_demo_data(self.session, with_users=False)
            await self.session.commit()

    async def run(
        self, scenario_key: SimulationScenario, user: User, *, apply_status_changes: bool = True
    ) -> SimulationRunResponse:
        scenario = SCENARIOS[scenario_key]
        await self._ensure_topology(scenario)
        origin = await self.infra.get_by_name(scenario.origin)
        assert origin is not None  # guaranteed by _ensure_topology

        simulation_id = uuid.uuid4()
        event_in = EventCreate(
            event_type=scenario.event_type,
            source=scenario.source,
            severity=scenario.severity,
            title=scenario.title,
            description=scenario.event_description,
            infrastructure_id=origin.id,
            latitude=origin.latitude if scenario.use_origin_location else None,
            longitude=origin.longitude if scenario.use_origin_location else None,
            payload={
                **scenario.payload,
                "simulation": True,
                "simulation_id": str(simulation_id),
                "scenario": scenario.key.value,
            },
        )
        started = utcnow()
        events = EventService(self.session, self.ai_provider, self.cache)
        outcome = await events.process(event_in, user, apply_status_changes=apply_status_changes)

        audit = AuditService(self.session)
        audit.record(
            AuditAction.SIMULATION_RUN,
            "simulation",
            simulation_id,
            user_id=user.id,
            details={
                "scenario": scenario.key.value,
                "event_id": str(outcome.event.id),
                "incident_id": str(outcome.incident.id) if outcome.incident else None,
                "risk_score": outcome.risk.score if outcome.risk else None,
                "risk_level": str(outcome.risk.level) if outcome.risk else None,
                "started_at": started.isoformat(),
            },
        )
        await self.session.commit()

        timeline = [TimelineStep(step=t.step, label=t.label, detail=t.detail, at=t.at) for t in outcome.timeline]
        pending = len(outcome.recommendations)
        timeline.append(
            TimelineStep(
                step="HUMAN_DECISION",
                label="Awaiting operator decision",
                detail=f"{pending} recommendation(s) pending approval via PATCH /api/v1/recommendations/{{id}}",
                at=utcnow(),
            )
        )
        risk = outcome.risk
        return SimulationRunResponse(
            simulation_id=simulation_id,
            scenario=scenario.key,
            event=EventResponse.model_validate(outcome.event),
            incident=incident_to_response(outcome.incident, risk) if outcome.incident else None,
            risk=SimulationRisk(
                score=risk.score,
                level=str(risk.level),
                impact_score=risk.impact_score,
                likelihood_score=risk.likelihood_score,
                explanation=risk.explanation,
                factors=risk.factors,
            )
            if risk
            else None,
            affected_infrastructure=impact_nodes(outcome.affected_infrastructure),
            affected_services=impact_nodes(outcome.affected_services),
            ai_analysis=AIAnalysisResponse.model_validate(outcome.ai_analysis.model_dump(mode="json"))
            if outcome.ai_analysis
            else None,
            recommendations=[RecommendationResponse.model_validate(r) for r in outcome.recommendations],
            human_decision=HumanDecision(
                required=pending > 0,
                pending_recommendations=pending,
                message=C.ADVISORY_NOTICE,
            ),
            timeline=timeline,
            audit=AuditStatus(recorded=True, entries=outcome.audit_entries + 1),
        )
