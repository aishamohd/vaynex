# Hackathon Demo Script (≈5 minutes)

**Story:** a power substation in central Hyderabad trips. Vaynex understands what
depends on it, detects the incident, scores the risk, asks the AI analyst for an
assessment, proposes actions — and waits for a human operator to decide.

## 0. Prepare (before the demo)

```bash
docker compose down -v && docker compose up --build -d
docker compose ps           # postgres, redis, api all "healthy"
```

Open http://localhost:8000/docs (or the frontend).

## 1. Login

`POST /api/v1/auth/login`

```json
{"email": "operator@vaynex.local", "password": "VaynexOperator!2026"}
```

Click **Authorize** in Swagger and paste the `access_token`.

## 2. Dashboard — "everything is green"

`GET /api/v1/dashboard/overview` → 6 assets operational, 8 services, 0 active incidents.

## 3. Infrastructure & dependency graph

* `GET /api/v1/infrastructure` — hospital, substation, water plant, telecom tower, emergency centre, road (with coordinates for the map).
* `GET /api/v1/dependencies/graph` — show *Central Power Substation → Hyderabad Central Hospital → Emergency Healthcare*.
* Optional: `GET /api/v1/infrastructure/{substation_id}/dependencies` — "if this fails, these 9 things are affected".

## 4. Simulate the hospital power failure

`POST /api/v1/simulation/run`

```json
{"scenario": "hospital_power_failure"}
```

Walk through the response (`timeline[]` is ordered for animation):

| Step | What to point at |
|------|------------------|
| EVENT_CREATED | `event` – CRITICAL POWER_FAILURE from `grid-monitor` |
| INFRASTRUCTURE_CONTEXT | origin = Central Power Substation |
| DEPENDENCIES_ANALYZED | `affected_infrastructure` (Hospital, Emergency Services Center, Water Treatment Plant) and `affected_services` (Emergency Healthcare, …) each with `path[]` and `impact_weight` |
| INCIDENT_DETECTED | `incident.status = OPEN` |
| RISK_ASSESSED | `risk.score ≈ 92`, **CRITICAL**, `factors[]` explain why |
| AI_ANALYSIS | `ai_analysis.summary`, `potential_impact`, `confidence ≈ 0.93` |
| RECOMMENDATIONS | "Activate backup power" (CRITICAL, RULE_ENGINE), AI actions naming the hospital |
| HUMAN_DECISION | `human_decision.required = true` — Vaynex is advisory only |
| AUDIT | `audit.recorded = true` |

## 5. Operator decision

`PATCH /api/v1/recommendations/{id}` (id of "Activate backup power")

```json
{"status": "ACCEPTED", "note": "Hospital engineering confirmed generator start"}
```

`GET /api/v1/incidents/{incident_id}` → status is now **MITIGATING**, decision recorded with operator and timestamp.

Optional: reject another recommendation, then mark the accepted one `COMPLETED`.

## 6. Dashboard — "the picture changed"

`GET /api/v1/dashboard/overview` → 1 active CRITICAL incident, substation FAILED, hospital DEGRADED, average risk ≈ 92.

## 7. Audit trail

`GET /api/v1/audit` → EVENT_CREATED, INCIDENT_CREATED, RISK_CALCULATED, AI_ANALYSIS_CREATED,
RECOMMENDATION_CREATED ×n, RECOMMENDATION_ACCEPTED, SIMULATION_RUN, USER_LOGIN.

## 8. (Bonus) Resolve and show other scenarios

* `POST /api/v1/incidents/{id}/resolve` `{"resolution_note": "Grid restored"}` → assets return to OPERATIONAL.
* `flood_infrastructure_risk` shows the **PostGIS** radius search (assets within 1.5 km, with `distance_m`).
* `telecom_outage`, `water_supply_disruption` show different cascades and HIGH risk.

## Talking points

* Deterministic, explainable risk (same input → same score).
* AI provider abstraction: works offline with the mock; plug in OpenAI with one env var.
* Every automated conclusion is a *recommendation*; only humans change state; everything is audited.
