# Vaynex API Reference (v1)

Base URL: `http://localhost:8000/api/v1` · Interactive docs: `/docs` (Swagger), `/redoc`.

Authentication: `Authorization: Bearer <access_token>` (from `/auth/login`).
Roles: **V** = VIEWER+, **O** = OPERATOR+, **A** = ADMIN.

## Conventions

* JSON everywhere, UUID ids, ISO-8601 UTC timestamps, upper-case enum strings.
* Lists: `?limit=50&offset=0` → `{"items": [...], "total": 123, "limit": 50, "offset": 0}`.
* Errors:

```json
{"error": {"code": "PERMISSION_DENIED", "message": "This action requires the OPERATOR role or higher",
           "request_id": "8c451ee8..."}}
```

| HTTP | Codes |
|------|-------|
| 400 | `BAD_REQUEST` |
| 401 | `NOT_AUTHENTICATED`, `INVALID_TOKEN`, `INVALID_CREDENTIALS` |
| 403 | `PERMISSION_DENIED` |
| 404 | `RESOURCE_NOT_FOUND` |
| 409 | `RESOURCE_CONFLICT`, `EMAIL_ALREADY_REGISTERED`, `INVALID_STATE_TRANSITION`, `INCIDENT_ALREADY_RESOLVED` |
| 422 | `VALIDATION_ERROR` (with `details[]`), `INVALID_REFERENCE` |
| 500 | `INTERNAL_SERVER_ERROR` |

## Health

| Method | Path | Auth | Response |
|--------|------|------|----------|
| GET | `/health` | – | `{"status": "ok"}` |
| GET | `/health/ready` | – | `{"status": "ready"|"degraded"|"not_ready", "checks": {"postgres", "postgis", "redis"}}` (503 if Postgres is down) |

## Auth

```http
POST /auth/register   {"email": "a@b.org", "password": "Str0ngPassword", "full_name": "A B"}   → 201 User (role VIEWER)
POST /auth/login      {"email": "operator@vaynex.local", "password": "VaynexOperator!2026"}
                      → {"access_token": "...", "token_type": "bearer", "expires_in": 3600, "user": {...}}
GET  /auth/me         → User
```

Password policy: 8–128 chars, at least one letter and one digit.

## Organizations

| Method | Path | Auth |
|--------|------|------|
| POST | `/organizations` `{name, organization_type, description?}` | A |
| GET | `/organizations` | V |
| GET | `/organizations/{id}` | V |

`organization_type`: MUNICIPAL, HEALTHCARE, POWER_UTILITY, WATER_UTILITY, TELECOM, EMERGENCY_SERVICES, TRANSPORT, OTHER.

## Infrastructure

| Method | Path | Auth |
|--------|------|------|
| POST | `/infrastructure` | O |
| GET | `/infrastructure?organization_id=&type=&status=&criticality=&search=` | V |
| GET | `/infrastructure/{id}` | V |
| PATCH | `/infrastructure/{id}` | O |
| DELETE | `/infrastructure/{id}` → 204 | A |
| GET | `/infrastructure/{id}/dependencies` | V |

```json
{
  "organization_id": "UUID",
  "name": "North Substation",
  "infrastructure_type": "POWER_SUBSTATION",
  "status": "OPERATIONAL",
  "criticality": "HIGH",
  "description": "33 kV",
  "latitude": 17.45, "longitude": 78.38,
  "metadata": {"voltage_kv": 33}
}
```

Types: POWER_PLANT, POWER_SUBSTATION, HOSPITAL, WATER_TREATMENT, WATER_PIPELINE, TELECOM_TOWER,
ROAD, BRIDGE, SCHOOL, DATA_CENTER, EMERGENCY_CENTER. Status: OPERATIONAL, DEGRADED, FAILED,
MAINTENANCE. Criticality: LOW, MEDIUM, HIGH, CRITICAL.

`/infrastructure/{id}/dependencies` returns `upstream[]` (what it depends on), `downstream[]`
(what depends on it), `hosted_services[]`, and the transitive `affected_infrastructure[]` /
`affected_services[]` if the asset failed (impact nodes, see below).

## Services

| Method | Path | Auth |
|--------|------|------|
| POST | `/services` `{organization_id, name, service_type, status?, criticality?, description?, infrastructure_id?}` | O |
| GET | `/services?organization_id=&type=&status=&criticality=&infrastructure_id=` | V |
| GET | `/services/{id}` | V |
| PATCH | `/services/{id}` | O |

Service types: EMERGENCY_HEALTHCARE, HEALTHCARE, POWER_SUPPLY, WATER_SUPPLY, TELECOMMUNICATIONS,
EMERGENCY_COMMUNICATIONS, EMERGENCY_RESPONSE, TRANSPORTATION, PUBLIC_EDUCATION, DATA_SERVICES,
PUBLIC_SAFETY, OTHER. Status: OPERATIONAL, DEGRADED, DISRUPTED, SUSPENDED.

## Dependencies

`target` depends on `source`; exactly one source id and one target id.

```json
{"source_infrastructure_id": "UUID", "target_service_id": "UUID",
 "dependency_type": "POWER", "strength": "CRITICAL", "description": "..."}
```

| Method | Path | Auth |
|--------|------|------|
| POST | `/dependencies` | O |
| GET | `/dependencies?infrastructure_id=&service_id=&dependency_type=&strength=` | V |
| GET | `/dependencies/{id}` | V |
| GET | `/dependencies/graph` → `{nodes[], edges[]}` | V |

Items include resolved `source`/`target` references (`{id, kind, name, type, status, criticality}`).
Graph edges with `implicit: true` are derived from `service.infrastructure_id` (hosting).

## Events (pipeline entry point)

```http
POST /events   (O)
{
  "event_type": "POWER_FAILURE",
  "source": "grid-monitor",
  "severity": "HIGH",
  "title": "Central Substation Power Failure",
  "description": "Unexpected power interruption",
  "infrastructure_id": "UUID",
  "payload": {"voltage": 0, "duration_minutes": 12}
}
```

Optional: `service_id`, `latitude`/`longitude`, `occurred_at`, and `payload.impact_radius_m`
(0–50000) to find directly exposed assets with PostGIS.

Response `201`:

```json
{
  "event": {...},
  "incident_created": true,
  "incident": {"id": "...", "status": "OPEN", "severity": "CRITICAL", "risk": {"score": 92, "level": "CRITICAL"}, ...},
  "risk": {"score": 92, "level": "CRITICAL", "impact_score": 87, "likelihood_score": 100, "explanation": "...", "factors": [...]},
  "affected_infrastructure": [ImpactNode...],
  "affected_services": [ImpactNode...],
  "ai_analysis": {"summary": "...", "potential_impact": [], "affected_services": [], "recommended_actions": [], "reasoning": "...", "confidence": 0.93, "provider": "mock"},
  "recommendations": [Recommendation...],
  "pipeline": ["EVENT_CREATED", "INFRASTRUCTURE_CONTEXT", "DEPENDENCIES_ANALYZED", "INCIDENT_DETECTED",
               "RISK_ASSESSED", "AI_ANALYSIS", "RECOMMENDATIONS", "AUDIT"]
}
```

**ImpactNode**: `{id, kind: INFRASTRUCTURE|SERVICE, name, type, criticality, status, previous_status,
relationship: ORIGIN|DIRECT_EXPOSURE|DEPENDENCY|HOSTED_SERVICE, depth, impact_weight (0–1),
dependency_type, dependency_strength, path[], distance_m}`.

`GET /events?event_type=&severity=&infrastructure_id=` (V), `GET /events/{id}` (V).

## Incidents

| Method | Path | Auth |
|--------|------|------|
| GET | `/incidents?status=&severity=&active_only=` | V |
| GET | `/incidents/{id}` → detail with `event`, `affected_infrastructure`, `affected_services`, `risk_assessment`, `recommendations`, `ai_analysis` | V |
| PATCH | `/incidents/{id}` `{title?, description?, status?: OPEN|INVESTIGATING|MITIGATING}` | O |
| POST | `/incidents/{id}/resolve` `{resolution_note?, restore_asset_status?: true}` | O |

Accepting a recommendation moves an OPEN/INVESTIGATING incident to MITIGATING. Resolving restores
asset/service statuses changed by the incident (unless another active incident still affects them).

## Risk

| Method | Path | Auth |
|--------|------|------|
| GET | `/risk/incidents/{id}` → `{latest, history[]}` | V |
| POST | `/risk/incidents/{id}/recalculate` | O |
| POST | `/risk/evaluate` (stateless what-if) | V |

```json
{"event_severity": "HIGH", "origin_criticality": "CRITICAL", "dependency_strengths": ["CRITICAL"],
 "affected_infrastructure_criticalities": ["CRITICAL"], "affected_service_criticalities": ["CRITICAL", "HIGH"]}
```

## Intelligence & recommendations

| Method | Path | Auth |
|--------|------|------|
| POST | `/intelligence/analyze/{incident_id}` → `{incident_id, ai_analysis, new_recommendations[]}` | O |
| GET | `/intelligence/provider` → `{provider, model, external}` | V |
| GET | `/recommendations?incident_id=&status=&source=&priority=` | V |
| GET | `/recommendations/{id}` | V |
| PATCH | `/recommendations/{id}` `{"status": "ACCEPTED"|"REJECTED"|"COMPLETED", "note": "..."}` | O |

Transitions: PENDING → ACCEPTED | REJECTED; ACCEPTED → COMPLETED (others → 409).
Recommendation: `{id, incident_id, title, description, priority, source: RULE_ENGINE|AI, status,
decided_by, decided_at, decision_note, created_at, updated_at}`.

## Dashboard

`GET /dashboard/overview` (V):

```json
{
  "total_infrastructure": 6, "operational_infrastructure": 3, "degraded_infrastructure": 2,
  "failed_infrastructure": 1, "maintenance_infrastructure": 0,
  "total_services": 8, "disrupted_services": 6,
  "active_incidents": 1, "critical_incidents": 1, "average_risk": 92.0, "pending_recommendations": 9,
  "recent_events": [...], "recent_incidents": [...], "critical_infrastructure": [...],
  "generated_at": "2026-09-28T16:05:30Z", "cached": false
}
```

## Simulation

`GET /simulation/scenarios` (V) → `[{key, name, description, event_type, severity, origin, chain[]}]`

`POST /simulation/run` (O) `{"scenario": "hospital_power_failure", "apply_status_changes": true}` →

```json
{
  "simulation_id": "UUID", "scenario": "hospital_power_failure",
  "event": {...}, "incident": {...},
  "risk": {"score": 92, "level": "CRITICAL", "impact_score": 87, "likelihood_score": 100, "explanation": "...", "factors": [...]},
  "affected_infrastructure": [...], "affected_services": [...],
  "ai_analysis": {...}, "recommendations": [...],
  "human_decision": {"required": true, "pending_recommendations": 9, "message": "..."},
  "timeline": [{"step": "EVENT_CREATED", "label": "...", "detail": "...", "at": "..."}, ...],
  "audit": {"recorded": true, "entries": 14}
}
```

Scenarios: `hospital_power_failure`, `water_supply_disruption`, `telecom_outage`, `flood_infrastructure_risk`.

## Audit

`GET /audit?action=&entity_type=&entity_id=&user_id=` (O) → `{id, user_id, action, entity_type, entity_id, details, created_at}`.

Actions: USER_REGISTERED, USER_LOGIN, USER_LOGIN_FAILED, ORGANIZATION_CREATED, INFRASTRUCTURE_CREATED/UPDATED/DELETED,
SERVICE_CREATED/UPDATED, DEPENDENCY_CREATED, EVENT_CREATED, INCIDENT_CREATED, INCIDENT_UPDATED, RISK_CALCULATED,
AI_ANALYSIS_CREATED, RECOMMENDATION_CREATED, RECOMMENDATION_ACCEPTED, RECOMMENDATION_REJECTED,
RECOMMENDATION_COMPLETED, INCIDENT_RESOLVED, SIMULATION_RUN.
