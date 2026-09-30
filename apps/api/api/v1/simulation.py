from __future__ import annotations

from fastapi import APIRouter

from apps.api.api.v1._common import AIProviderDep, CacheDep
from apps.api.dependencies.auth import DbSession, OperatorUser, ViewerUser
from apps.api.schemas.simulation import ScenarioInfo, SimulationRunRequest, SimulationRunResponse
from apps.api.services.simulation_service import SimulationService, list_scenarios

router = APIRouter(prefix="/simulation", tags=["Simulation"])


@router.get("/scenarios", response_model=list[ScenarioInfo])
async def scenarios(_: ViewerUser) -> list[ScenarioInfo]:
    return list_scenarios()


@router.post(
    "/run",
    response_model=SimulationRunResponse,
    summary="Run an end-to-end disruption scenario through the real pipeline",
)
async def run_simulation(
    data: SimulationRunRequest, session: DbSession, cache: CacheDep, ai: AIProviderDep, user: OperatorUser
) -> SimulationRunResponse:
    return await SimulationService(session, ai, cache).run(
        data.scenario, user, apply_status_changes=data.apply_status_changes
    )
