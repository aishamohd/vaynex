"""Hyderabad demo topology (organisations, assets, services, dependencies).

Shared by ``scripts/seed_demo.py`` and the simulation engine (which provisions
the topology automatically if it is missing). Seeding is idempotent: records
are matched by name and only created when absent.
"""

from __future__ import annotations

import os
from dataclasses import dataclass
from typing import Any

from sqlalchemy.ext.asyncio import AsyncSession

from apps.api.services.infrastructure_service import point
from packages.common import constants as C
from packages.common.enums import (
    Criticality,
    DependencyStrength,
    DependencyType,
    InfrastructureType,
    OrganizationType,
    ServiceType,
    UserRole,
)
from packages.database.models import Dependency, Infrastructure, Organization, PublicService
from packages.database.repositories import (
    DependencyRepository,
    InfrastructureRepository,
    OrganizationRepository,
    ServiceRepository,
    UserRepository,
)
from packages.security.password import hash_password

ORGANIZATIONS: list[dict[str, Any]] = [
    {
        "name": C.DEMO_ORG_MUNICIPAL,
        "organization_type": OrganizationType.MUNICIPAL,
        "description": "City operations, roads, emergency services coordination for Hyderabad.",
    },
    {
        "name": C.DEMO_ORG_HEALTHCARE,
        "organization_type": OrganizationType.HEALTHCARE,
        "description": "Network of public hospitals and emergency care units in Hyderabad.",
    },
    {
        "name": C.DEMO_ORG_POWER,
        "organization_type": OrganizationType.POWER_UTILITY,
        "description": "Transmission and distribution operations for the Telangana grid.",
    },
    {
        "name": C.DEMO_ORG_WATER,
        "organization_type": OrganizationType.WATER_UTILITY,
        "description": "Bulk water treatment and distribution for the Hyderabad metropolitan region.",
    },
    {
        "name": C.DEMO_ORG_TELECOM,
        "organization_type": OrganizationType.TELECOM,
        "description": "Mobile and fixed telecommunications infrastructure operator.",
    },
]

INFRASTRUCTURE: list[dict[str, Any]] = [
    {
        "name": C.DEMO_SUBSTATION,
        "org": C.DEMO_ORG_POWER,
        "infrastructure_type": InfrastructureType.POWER_SUBSTATION,
        "criticality": Criticality.CRITICAL,
        "latitude": 17.3920,
        "longitude": 78.4750,
        "description": "132/33 kV substation feeding central Hyderabad, including the Central Hospital.",
        "meta": {"voltage_kv": 132, "feeders": 8, "backup_supply": False},
    },
    {
        "name": C.DEMO_HOSPITAL,
        "org": C.DEMO_ORG_HEALTHCARE,
        "infrastructure_type": InfrastructureType.HOSPITAL,
        "criticality": Criticality.CRITICAL,
        "latitude": 17.4000,
        "longitude": 78.4800,
        "description": "Tertiary-care public hospital with trauma centre and 40-bed ICU.",
        "meta": {"beds": 850, "icu_beds": 40, "generator_autonomy_hours": 18},
    },
    {
        "name": C.DEMO_WATER_PLANT,
        "org": C.DEMO_ORG_WATER,
        "infrastructure_type": InfrastructureType.WATER_TREATMENT,
        "criticality": Criticality.CRITICAL,
        "latitude": 17.3700,
        "longitude": 78.5100,
        "description": "Primary treatment plant supplying the central distribution zone.",
        "meta": {"capacity_mld": 450},
    },
    {
        "name": C.DEMO_TELECOM_TOWER,
        "org": C.DEMO_ORG_TELECOM,
        "infrastructure_type": InfrastructureType.TELECOM_TOWER,
        "criticality": Criticality.HIGH,
        "latitude": 17.4100,
        "longitude": 78.4700,
        "description": "Macro cell site carrying mobile backhaul and the emergency services network.",
        "meta": {"technology": ["4G", "5G"], "battery_backup_hours": 4},
    },
    {
        "name": C.DEMO_EMERGENCY_CENTER,
        "org": C.DEMO_ORG_MUNICIPAL,
        "infrastructure_type": InfrastructureType.EMERGENCY_CENTER,
        "criticality": Criticality.CRITICAL,
        "latitude": 17.3950,
        "longitude": 78.4900,
        "description": "Integrated command and dispatch centre for police, fire and ambulance services.",
        "meta": {"dispatch_positions": 24},
    },
    {
        "name": C.DEMO_ROAD,
        "org": C.DEMO_ORG_MUNICIPAL,
        "infrastructure_type": InfrastructureType.ROAD,
        "criticality": Criticality.HIGH,
        "latitude": 17.3980,
        "longitude": 78.4830,
        "description": "Arterial corridor providing ambulance access to the Central Hospital.",
        "meta": {"lanes": 6, "flood_prone": True},
    },
]

SERVICES: list[dict[str, Any]] = [
    {
        "name": C.DEMO_SVC_EMERGENCY_HEALTHCARE,
        "org": C.DEMO_ORG_HEALTHCARE,
        "service_type": ServiceType.EMERGENCY_HEALTHCARE,
        "criticality": Criticality.CRITICAL,
        "infra": C.DEMO_HOSPITAL,
        "description": "24x7 emergency department, trauma and critical care.",
    },
    {
        "name": C.DEMO_SVC_CLINICAL,
        "org": C.DEMO_ORG_HEALTHCARE,
        "service_type": ServiceType.HEALTHCARE,
        "criticality": Criticality.HIGH,
        "infra": C.DEMO_HOSPITAL,
        "description": "Inpatient wards, surgery and diagnostics.",
    },
    {
        "name": C.DEMO_SVC_ELECTRICITY,
        "org": C.DEMO_ORG_POWER,
        "service_type": ServiceType.POWER_SUPPLY,
        "criticality": Criticality.CRITICAL,
        "infra": C.DEMO_SUBSTATION,
        "description": "Electricity distribution to the central zone.",
    },
    {
        "name": C.DEMO_SVC_WATER,
        "org": C.DEMO_ORG_WATER,
        "service_type": ServiceType.WATER_SUPPLY,
        "criticality": Criticality.CRITICAL,
        "infra": C.DEMO_WATER_PLANT,
        "description": "Potable water supply to households, hospitals and public facilities.",
    },
    {
        "name": C.DEMO_SVC_TELECOM,
        "org": C.DEMO_ORG_TELECOM,
        "service_type": ServiceType.TELECOMMUNICATIONS,
        "criticality": Criticality.HIGH,
        "infra": C.DEMO_TELECOM_TOWER,
        "description": "Public mobile voice and data.",
    },
    {
        "name": C.DEMO_SVC_EMERGENCY_COMMS,
        "org": C.DEMO_ORG_MUNICIPAL,
        "service_type": ServiceType.EMERGENCY_COMMUNICATIONS,
        "criticality": Criticality.CRITICAL,
        "infra": C.DEMO_EMERGENCY_CENTER,
        "description": "Responder radio/data network and 112 call handling.",
    },
    {
        "name": C.DEMO_SVC_EMERGENCY_RESPONSE,
        "org": C.DEMO_ORG_MUNICIPAL,
        "service_type": ServiceType.EMERGENCY_RESPONSE,
        "criticality": Criticality.CRITICAL,
        "infra": C.DEMO_EMERGENCY_CENTER,
        "description": "Ambulance, fire and police dispatch.",
    },
    {
        "name": C.DEMO_SVC_MOBILITY,
        "org": C.DEMO_ORG_MUNICIPAL,
        "service_type": ServiceType.TRANSPORTATION,
        "criticality": Criticality.HIGH,
        "infra": C.DEMO_ROAD,
        "description": "Traffic flow and emergency vehicle access along the corridor.",
    },
]

# (source_kind, source_name, target_kind, target_name, type, strength, description)
DEPENDENCIES: list[tuple[str, str, str, str, DependencyType, DependencyStrength, str]] = [
    (
        "I",
        C.DEMO_SUBSTATION,
        "I",
        C.DEMO_HOSPITAL,
        DependencyType.POWER,
        DependencyStrength.CRITICAL,
        "Hospital draws primary supply from the Central Substation.",
    ),
    (
        "I",
        C.DEMO_SUBSTATION,
        "I",
        C.DEMO_EMERGENCY_CENTER,
        DependencyType.POWER,
        DependencyStrength.HIGH,
        "Command centre supply (UPS covers 2 hours).",
    ),
    (
        "I",
        C.DEMO_SUBSTATION,
        "I",
        C.DEMO_WATER_PLANT,
        DependencyType.POWER,
        DependencyStrength.MEDIUM,
        "Pumping stations partly fed from the substation.",
    ),
    (
        "I",
        C.DEMO_HOSPITAL,
        "S",
        C.DEMO_SVC_EMERGENCY_HEALTHCARE,
        DependencyType.SERVICE_DELIVERY,
        DependencyStrength.CRITICAL,
        "Emergency Healthcare is delivered from the Central Hospital.",
    ),
    (
        "I",
        C.DEMO_WATER_PLANT,
        "S",
        C.DEMO_SVC_WATER,
        DependencyType.SERVICE_DELIVERY,
        DependencyStrength.CRITICAL,
        "Treated water output feeds the supply network.",
    ),
    (
        "S",
        C.DEMO_SVC_WATER,
        "I",
        C.DEMO_HOSPITAL,
        DependencyType.WATER,
        DependencyStrength.HIGH,
        "Hospital requires continuous potable water (sterilisation, dialysis).",
    ),
    (
        "S",
        C.DEMO_SVC_WATER,
        "I",
        C.DEMO_EMERGENCY_CENTER,
        DependencyType.WATER,
        DependencyStrength.MEDIUM,
        "Cooling and facility water for the command centre.",
    ),
    (
        "I",
        C.DEMO_TELECOM_TOWER,
        "S",
        C.DEMO_SVC_TELECOM,
        DependencyType.SERVICE_DELIVERY,
        DependencyStrength.CRITICAL,
        "Cell site carries the public mobile network.",
    ),
    (
        "S",
        C.DEMO_SVC_TELECOM,
        "S",
        C.DEMO_SVC_EMERGENCY_COMMS,
        DependencyType.TELECOM,
        DependencyStrength.CRITICAL,
        "Emergency communications ride on carrier backhaul.",
    ),
    (
        "S",
        C.DEMO_SVC_TELECOM,
        "S",
        C.DEMO_SVC_EMERGENCY_RESPONSE,
        DependencyType.TELECOM,
        DependencyStrength.HIGH,
        "Dispatch relies on mobile data to ambulances.",
    ),
    (
        "I",
        C.DEMO_ROAD,
        "I",
        C.DEMO_HOSPITAL,
        DependencyType.TRANSPORT,
        DependencyStrength.HIGH,
        "Primary ambulance access route to the hospital.",
    ),
    (
        "I",
        C.DEMO_ROAD,
        "S",
        C.DEMO_SVC_EMERGENCY_RESPONSE,
        DependencyType.TRANSPORT,
        DependencyStrength.HIGH,
        "Response vehicles use the corridor.",
    ),
]


@dataclass
class SeedReport:
    organizations: int = 0
    infrastructure: int = 0
    services: int = 0
    dependencies: int = 0
    users: int = 0

    def as_dict(self) -> dict[str, int]:
        return self.__dict__.copy()


def demo_users() -> list[dict[str, Any]]:
    """Demo accounts. Passwords can be overridden via environment variables."""
    return [
        {
            "email": "admin@vaynex.local",
            "full_name": "Vaynex Admin",
            "role": UserRole.ADMIN,
            "password": os.getenv("DEMO_ADMIN_PASSWORD", "VaynexAdmin!2026"),
        },
        {
            "email": "operator@vaynex.local",
            "full_name": "Duty Operator",
            "role": UserRole.OPERATOR,
            "password": os.getenv("DEMO_OPERATOR_PASSWORD", "VaynexOperator!2026"),
        },
        {
            "email": "viewer@vaynex.local",
            "full_name": "Read-only Analyst",
            "role": UserRole.VIEWER,
            "password": os.getenv("DEMO_VIEWER_PASSWORD", "VaynexViewer!2026"),
        },
    ]


async def seed_demo_data(session: AsyncSession, *, with_users: bool = True) -> SeedReport:
    """Idempotently create the demo topology (and optionally demo users). Caller commits."""
    report = SeedReport()
    orgs_repo = OrganizationRepository(session)
    infra_repo = InfrastructureRepository(session)
    svc_repo = ServiceRepository(session)
    dep_repo = DependencyRepository(session)

    orgs: dict[str, Organization] = {}
    for spec in ORGANIZATIONS:
        org = await orgs_repo.get_by_name(spec["name"])
        if org is None:
            org = await orgs_repo.create(**spec)
            report.organizations += 1
        orgs[spec["name"]] = org

    infra: dict[str, Infrastructure] = {}
    for spec in INFRASTRUCTURE:
        item = await infra_repo.get_by_name(spec["name"])
        if item is None:
            values = {k: v for k, v in spec.items() if k != "org"}
            item = await infra_repo.create(
                **values,
                organization_id=orgs[spec["org"]].id,
                location=point(spec["latitude"], spec["longitude"]),
            )
            report.infrastructure += 1
        infra[spec["name"]] = item

    services: dict[str, PublicService] = {}
    for spec in SERVICES:
        svc = await svc_repo.get_by_name(spec["name"])
        if svc is None:
            svc = await svc_repo.create(
                name=spec["name"],
                organization_id=orgs[spec["org"]].id,
                service_type=spec["service_type"],
                criticality=spec["criticality"],
                description=spec["description"],
                infrastructure_id=infra[spec["infra"]].id,
            )
            report.services += 1
        services[spec["name"]] = svc

    def ids(kind: str, name: str) -> dict[str, Any]:
        return {"infrastructure_id": infra[name].id} if kind == "I" else {"service_id": services[name].id}

    for s_kind, s_name, t_kind, t_name, dep_type, strength, desc in DEPENDENCIES:
        src = {f"source_{k}": v for k, v in ids(s_kind, s_name).items()}
        tgt = {f"target_{k}": v for k, v in ids(t_kind, t_name).items()}
        keys = {
            "source_infrastructure_id": None,
            "source_service_id": None,
            "target_infrastructure_id": None,
            "target_service_id": None,
            **src,
            **tgt,
        }
        if await dep_repo.find_duplicate(**keys, dependency_type=dep_type) is None:
            session.add(Dependency(**keys, dependency_type=dep_type, strength=strength, description=desc))
            report.dependencies += 1
    await session.flush()

    if with_users:
        users = UserRepository(session)
        for spec in demo_users():
            if await users.get_by_email(spec["email"]) is None:
                await users.create(
                    email=spec["email"],
                    full_name=spec["full_name"],
                    role=spec["role"],
                    password_hash=hash_password(spec["password"]),
                    is_active=True,
                )
                report.users += 1
    return report
