# Vaynex — Frontend ↔ Backend Contract

Source of truth: `apps/api/api/v1/*.py` (routes + roles) and `apps/api/schemas/*.py` (Pydantic models).
This file documents what the web app (`apps/web`) relies on. It does **not** change backend behaviour.
TypeScript mirrors live in `apps/web/src/types/`.

## Conventions

| Item | Value |
|------|-------|
| Base URL | `${NEXT_PUBLIC_API_URL}/api/v1` (default `http://localhost:8000`) |
| Auth | `Authorization: Bearer <access_token>` (HS256 JWT, 60 min default) |
| Roles | `VIEWER` < `OPERATOR` < `ADMIN` (hierarchical) — **V** / **O** / **A** below |
| IDs / time | UUID strings / ISO-8601 UTC |
| Enums | upper-case strings (simulation scenario keys are lower_snake) |
| Lists | `Page<T>` = `{items: T[], total, limit, offset}`; `?limit=1..200` (default 50) `&offset=` |
| CORS | `CORS_ALLOWED_ORIGINS` (default `["http://localhost:3000"]`), exposes `X-Request-ID` |

### Error envelope (every non-2xx)

```json
{"error": {"code": "RESOURCE_NOT_FOUND", "message": "Incident not found", "request_id": "…", "details": [/* 422 only */]}}
```

| HTTP | codes | Frontend handling |
|------|-------|-------------------|
| 400 | `BAD_REQUEST` | toast message |
| 401 | `NOT_AUTHENTICATED`, `INVALID_TOKEN`, `INVALID_CREDENTIALS`, `AUTHENTICATION_FAILED` | login form: "invalid credentials"; elsewhere: clear token → `/login?expired=1` |
| 403 | `PERMISSION_DENIED` | "requires OPERATOR role" panel / toast |
| 404 | `RESOURCE_NOT_FOUND` | not-found state |
| 409 | `RESOURCE_CONFLICT`, `INVALID_STATE_TRANSITION`, `INCIDENT_ALREADY_RESOLVED`, `EMAIL_ALREADY_REGISTERED` | toast + refetch |
| 422 | `VALIDATION_ERROR` (+`details[] {loc,msg,type}`), `INVALID_REFERENCE` | field messages |
| 500 | `INTERNAL_SERVER_ERROR` | generic error + request id |
| network | — | "DATA FABRIC OFFLINE" + retry |

---

## HEALTH

| Method | Path | Role | Response |
|---|---|---|---|
| GET | `/health` | – | `{status:"ok"}` |
| GET | `/health/ready` | – | `{status:"ready"\|"degraded"\|"not_ready", checks:{postgres:{status}, postgis:{status,version}, redis:{status}}}` — 503 when Postgres down |

Used by the top bar / sidebar status (API, DATABASE, DATA FABRIC).

## AUTH

| Method | Path | Role | Request | Response | Errors |
|---|---|---|---|---|---|
| POST | `/auth/login` | – | `{email, password}` | `TokenResponse {access_token, token_type:"bearer", expires_in, user: User}` | 401 `INVALID_CREDENTIALS`, 422 |
| GET | `/auth/me` | any | – | `User {id, email, full_name, role, is_active, created_at}` | 401 |
| POST | `/auth/register` | – | `{email, password(8-128, letter+digit), full_name?}` | 201 `User` (always VIEWER) | 409, 422 — *not used by UI* |

Demo accounts (dev seed): `admin@vaynex.local / VaynexAdmin!2026`, `operator@vaynex.local / VaynexOperator!2026`, `viewer@vaynex.local / VaynexViewer!2026`.

## DASHBOARD

| GET | `/dashboard/overview` | V |
|---|---|---|

Response `DashboardOverview`:
`total_infrastructure, operational_infrastructure, degraded_infrastructure, failed_infrastructure, maintenance_infrastructure, total_services, disrupted_services, active_incidents, critical_incidents, average_risk (float), pending_recommendations, recent_events: DashboardEvent[] {id,event_type,severity,title,source,occurred_at}, recent_incidents: Incident[], critical_infrastructure: {id,name,infrastructure_type,status,criticality,latitude,longitude}[], generated_at, cached`.
Redis-cached (TTL 15 s), invalidated by every write.

## ORGANIZATIONS

| Method | Path | Role | Notes |
|---|---|---|---|
| GET | `/organizations` | V | `Page<Organization {id,name,organization_type,description,created_at,updated_at}>` — used for the infrastructure org filter |
| GET | `/organizations/{id}` | V | 404 |
| POST | `/organizations` | A | not used by UI |

## INFRASTRUCTURE

| Method | Path | Role | Request / Query | Response | Errors |
|---|---|---|---|---|---|
| GET | `/infrastructure` | V | `organization_id, type, status, criticality, search(≤100), limit, offset` | `Page<Infrastructure>` | 422 |
| GET | `/infrastructure/{id}` | V | – | `Infrastructure` | 404 |
| GET | `/infrastructure/{id}/dependencies` | V | – | `{infrastructure_id, upstream: Dependency[], downstream: Dependency[], hosted_services: NodeRef[], affected_infrastructure: ImpactNode[], affected_services: ImpactNode[]}` | 404 |
| POST | `/infrastructure` | O | `InfrastructureCreate` | 201 | *not used by UI* |
| PATCH | `/infrastructure/{id}` | O | partial | `Infrastructure` | *not used by UI* |
| DELETE | `/infrastructure/{id}` | A | – | 204 | *not used by UI* |

`Infrastructure = {id, organization_id, name, infrastructure_type, status, criticality, description, latitude, longitude, metadata{}, created_at, updated_at}`
types `POWER_PLANT|POWER_SUBSTATION|HOSPITAL|WATER_TREATMENT|WATER_PIPELINE|TELECOM_TOWER|ROAD|BRIDGE|SCHOOL|DATA_CENTER|EMERGENCY_CENTER`;
status `OPERATIONAL|DEGRADED|FAILED|MAINTENANCE`; criticality `LOW|MEDIUM|HIGH|CRITICAL`.

## SERVICES

| Method | Path | Role | Query | Response |
|---|---|---|---|---|
| GET | `/services` | V | `organization_id, type, status, criticality, infrastructure_id` | `Page<Service {id, organization_id, name, service_type, status, criticality, description, infrastructure_id, created_at, updated_at}>` |
| GET | `/services/{id}` | V | – | `Service` / 404 |
| POST / PATCH | `/services[/{id}]` | O | – | *not used by UI* |

Service status `OPERATIONAL|DEGRADED|DISRUPTED|SUSPENDED`.

## DEPENDENCIES

| Method | Path | Role | Response |
|---|---|---|---|
| GET | `/dependencies/graph` | V | `{nodes: GraphNode[], edges: GraphEdge[]}` |
| GET | `/dependencies` | V | `Page<Dependency>` (`infrastructure_id, service_id, dependency_type, strength`) |
| GET | `/dependencies/{id}` | V | `Dependency` |
| POST | `/dependencies` | O | *not used by UI* |

* `GraphNode = {id, kind: INFRASTRUCTURE|SERVICE, name, type, status, criticality, organization_id, latitude?, longitude?}`
* `GraphEdge = {id: string, source: uuid, target: uuid, dependency_type, strength, implicit}` — **target depends on source**; `implicit=true` = hosting edge (asset → hosted service).
* `Dependency = {id, source_infrastructure_id, source_service_id, target_infrastructure_id, target_service_id, dependency_type, strength, description, source?: NodeRef, target?: NodeRef, created_at}`
* `NodeRef = {id, kind, name, type, status, criticality}`
* `ImpactNode = {id, kind, name, type, criticality, status, previous_status?, relationship: ORIGIN|DIRECT_EXPOSURE|DEPENDENCY|HOSTED_SERVICE, depth, impact_weight(0-1), dependency_type?, dependency_strength?, path: string[], distance_m?}`

## EVENTS (pipeline entry point)

| Method | Path | Role | Request | Response | Errors |
|---|---|---|---|---|---|
| POST | `/events` | O | `EventCreate` | 201 `EventProcessingResult` | 403, 422 (`INVALID_REFERENCE` for unknown asset) |
| GET | `/events` | V | `event_type, severity, infrastructure_id` | `Page<Event>` | |
| GET | `/events/{id}` | V | – | `Event` | 404 |

`EventCreate = {event_type, source(1-120), severity, title(3-300), description?, infrastructure_id?, service_id?, latitude?, longitude? (both or neither), payload{} (optional impact_radius_m 0-50000), occurred_at?}`
event_type `POWER_FAILURE|WATER_DISRUPTION|TELECOM_OUTAGE|FLOOD|EQUIPMENT_FAILURE|CYBER_INCIDENT|FIRE|EARTHQUAKE|TRAFFIC_DISRUPTION|SENSOR_ALERT|OTHER`; severity `LOW|MEDIUM|HIGH|CRITICAL`.

`EventProcessingResult = {event, incident_created, incident?: Incident, risk?: Risk, affected_infrastructure: ImpactNode[], affected_services: ImpactNode[], ai_analysis?: AIAnalysis, recommendations: Recommendation[], pipeline: string[]}`
`pipeline` values: `EVENT_CREATED, INFRASTRUCTURE_CONTEXT, DEPENDENCIES_ANALYZED, [NO_INCIDENT | INCIDENT_DETECTED, RISK_ASSESSED, AI_ANALYSIS, RECOMMENDATIONS], AUDIT`.

## INCIDENTS

| Method | Path | Role | Request / Query | Response | Errors |
|---|---|---|---|---|---|
| GET | `/incidents` | V | `status, severity, active_only` | `Page<Incident>` | |
| GET | `/incidents/{id}` | V | – | `IncidentDetail` | 404 |
| PATCH | `/incidents/{id}` | O | `{title?, description?, status?: OPEN\|INVESTIGATING\|MITIGATING}` | `IncidentDetail` | 409 |
| POST | `/incidents/{id}/resolve` | O | `{resolution_note?, restore_asset_status?=true}` (body optional) | `IncidentDetail` | 409 `INCIDENT_ALREADY_RESOLVED` |

* `Incident = {id, event_id, title, description, status: OPEN|INVESTIGATING|MITIGATING|RESOLVED, severity, detected_at, resolved_at, resolution_note, affected_infrastructure_count, affected_services_count, risk?: {score, level}, created_at, updated_at}`
* `IncidentDetail = Incident + {event?: {id,event_type,source,severity,title,description,infrastructure_id,service_id,latitude,longitude,payload,occurred_at}, affected_infrastructure: ImpactNode[], affected_services: ImpactNode[], risk_assessment?: Risk, recommendations: Recommendation[], ai_analysis?: AIAnalysis}`
* Accepting a recommendation moves OPEN/INVESTIGATING → MITIGATING. Resolving restores asset/service statuses.

## RISK

| Method | Path | Role | Request | Response |
|---|---|---|---|---|
| GET | `/risk/incidents/{id}` | V | – | `{incident_id, latest?: Risk, history: Risk[]}` |
| POST | `/risk/incidents/{id}/recalculate` | O | – | `Risk` |
| POST | `/risk/evaluate` | V | `{event_severity, event_type?, origin_criticality?, dependency_strengths[], affected_infrastructure_criticalities[], affected_service_criticalities[]}` | `{score, level, impact_score, likelihood_score, affected_infrastructure_count, affected_services_count, explanation, factors[]}` |

`Risk = {id, incident_id, score 0-100, level LOW|MEDIUM|HIGH|CRITICAL, impact_score, likelihood_score, affected_services_count, affected_infrastructure_count, explanation, factors: RiskFactor[], created_at}`
`RiskFactor = {name, input, weight, max_points, points, description}` (5 factors, max 25/25/15/15/20).
Levels: 0-29 LOW · 30-59 MEDIUM · 60-79 HIGH · 80-100 CRITICAL.

## INTELLIGENCE

| Method | Path | Role | Response |
|---|---|---|---|
| POST | `/intelligence/analyze/{incident_id}` | O | `{incident_id, ai_analysis: AIAnalysis, new_recommendations: Recommendation[]}` |
| GET | `/intelligence/provider` | V | `{provider, model?, external}` |

`AIAnalysis = {summary, potential_impact: string[], affected_services: string[], recommended_actions: {title, description, priority}[], reasoning, confidence 0-1, provider, model?, advisory_only: true}`
`reasoning` is a short, backend-generated *evidence basis* string (graph + risk-model facts), not model chain-of-thought; the UI labels it "EVIDENCE BASIS".

## RECOMMENDATIONS

| Method | Path | Role | Request / Query | Response | Errors |
|---|---|---|---|---|---|
| GET | `/recommendations` | V | `incident_id, status, source, priority` | `Page<Recommendation>` | |
| GET | `/recommendations/{id}` | V | – | `Recommendation` | 404 |
| PATCH | `/recommendations/{id}` | O | `{status: ACCEPTED\|REJECTED\|COMPLETED, note?(≤2000)}` | `Recommendation` | 403, 409 `INVALID_STATE_TRANSITION` |

`Recommendation = {id, incident_id, title, description, priority, source: RULE_ENGINE|AI, status: PENDING|ACCEPTED|REJECTED|COMPLETED, decided_by?, decided_at?, decision_note?, created_at, updated_at}`
Transitions: PENDING → ACCEPTED | REJECTED; ACCEPTED → COMPLETED.

## SIMULATION

| Method | Path | Role | Request | Response |
|---|---|---|---|---|
| GET | `/simulation/scenarios` | V | – | `ScenarioInfo[] {key, name, description, event_type, severity, origin, chain: string[]}` |
| POST | `/simulation/run` | O | `{scenario, apply_status_changes?=true}` | `SimulationRunResponse` |

Scenario keys (backend enum): `hospital_power_failure, water_supply_disruption, telecom_outage, flood_infrastructure_risk` — the UI always reads them from `/simulation/scenarios`.

`SimulationRunResponse = {simulation_id, scenario, event, incident?, risk?: {score, level, impact_score, likelihood_score, explanation, factors}, affected_infrastructure, affected_services, ai_analysis?, recommendations, human_decision: {required, pending_recommendations, message}, timeline: {step, label, detail, at}[], audit: {recorded, entries}}`
`timeline[].step` order: `EVENT_CREATED, INFRASTRUCTURE_CONTEXT, DEPENDENCIES_ANALYZED, INCIDENT_DETECTED, RISK_ASSESSED, AI_ANALYSIS, RECOMMENDATIONS, AUDIT, HUMAN_DECISION` (the UI drives its animation from this array).

## AUDIT

| Method | Path | Role | Query | Response | Errors |
|---|---|---|---|---|---|
| GET | `/audit` | **O** | `action, entity_type, entity_id, user_id, limit, offset` | `Page<AuditLog {id, user_id?, action, entity_type, entity_id?, details{}, created_at}>` | 403 for VIEWER |

Actions: `USER_REGISTERED, USER_LOGIN, USER_LOGIN_FAILED, ORGANIZATION_CREATED, INFRASTRUCTURE_CREATED/UPDATED/DELETED, SERVICE_CREATED/UPDATED, DEPENDENCY_CREATED, EVENT_CREATED, INCIDENT_CREATED, INCIDENT_UPDATED, RISK_CALCULATED, AI_ANALYSIS_CREATED, RECOMMENDATION_CREATED/ACCEPTED/REJECTED/COMPLETED, INCIDENT_RESOLVED, SIMULATION_RUN`.

---

## Screen → endpoint map

| Screen | Calls | Invalidates after mutation |
|---|---|---|
| `/login` | `POST /auth/login`, `GET /auth/me` | – |
| Shell | `GET /health/ready`, `GET /intelligence/provider`, `GET /auth/me` | – |
| `/command` | `GET /dashboard/overview` (15 s poll), `GET /dependencies/graph`, `GET /incidents?active_only=true` | – |
| `/command/infrastructure` | `GET /infrastructure`, `GET /organizations`, `GET /infrastructure/{id}`, `GET /infrastructure/{id}/dependencies` | – |
| `/command/network` | `GET /dependencies/graph`, `GET /infrastructure/{id}/dependencies`, `GET /services` | – |
| `/command/incidents` | `GET /incidents`, `POST /events` | dashboard, incidents, infrastructure, services, graph, recommendations, audit |
| `/command/incidents/[id]` | `GET /incidents/{id}`, `GET /risk/incidents/{id}`, `POST /risk/incidents/{id}/recalculate`, `POST /incidents/{id}/resolve`, `PATCH /recommendations/{id}` | incident, risk, dashboard, infrastructure, services, graph, recommendations, audit |
| `/command/intelligence` | `GET /intelligence/provider`, `GET /incidents`, `GET /incidents/{id}`, `POST /intelligence/analyze/{id}` | incident, recommendations, audit |
| `/command/simulation` | `GET /simulation/scenarios`, `POST /simulation/run`, `GET /dependencies/graph` | everything |
| `/command/recommendations` | `GET /recommendations`, `PATCH /recommendations/{id}` | recommendations, incident, dashboard, audit |
| `/command/audit` | `GET /audit` | – |
