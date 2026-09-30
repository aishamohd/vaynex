# Vaynex Architecture

## Principles

* **Modular monolith** – one deployable FastAPI service; modules separated by
  package boundaries, not network hops.
* **Layering** – `API router → Service → Repository → Database`. Routers only
  validate input and enforce roles; services own business rules; repositories
  own every SQL statement; ORM objects never leave the service layer (Pydantic
  response models are returned).
* **Advisory only** – nothing in the codebase writes to external systems.
  "Status changes" only reflect observed state inside Vaynex's registry and are
  reverted when an incident is resolved.
* **Deterministic core** – risk scoring, dependency propagation, rule-based
  recommendations and the mock AI are pure functions of their inputs.
* **Graceful degradation** – no Redis → no cache; no OpenAI key → mock AI;
  OpenAI failure → mock fallback; no PostGIS functions → haversine fallback.

## Component map

```
apps/api
 ├─ main.py                create_app(): middleware, error handlers, routers, lifespan
 ├─ core/                  Settings (pydantic-settings), logging w/ redaction,
 │                         error envelope, request-id middleware, JWT helpers, Redis cache
 ├─ dependencies/          get_db_session, get_current_user, require_role(...)
 ├─ api/v1/*.py            one router per resource
 ├─ schemas/*.py           request/response contracts
 └─ services/*.py          business logic
packages
 ├─ database/              Base + models, repositories, async session, Alembic
 ├─ risk/                  RiskEngine (pure) + recommendation rule catalogue
 ├─ intelligence/          AIProvider, MockAIProvider, OpenAIProvider, prompts, schemas
 ├─ security/              Argon2id, JWT
 └─ common/                enums, constants, utils
```

`packages/*` never import from `apps/*`.

## Data model

```
organizations 1─* infrastructure 1─* services (infrastructure_id nullable)
                     │  location geometry(POINT,4326) + GiST index
dependencies: source_(infrastructure|service)_id → target_(infrastructure|service)_id
              (CHECK exactly one source and one target; target depends on source)
events ─1:0..1─ incidents 1─* risks
                     │         1─* recommendations (decided_by → users)
                     └ JSONB snapshots: affected_infrastructure, affected_services, ai_analysis
audit_logs (append-only; user_id, action, entity_type, entity_id, details JSONB)
users (email unique, Argon2id hash, role)
```

Enums are stored as `VARCHAR(32)` (non-native) to keep migrations simple;
validation happens in Pydantic and SQLAlchemy.

## Event pipeline (`EventService.process`)

| # | Step | Implementation |
|---|------|----------------|
| 1 | Validate | Pydantic schema + referenced asset/service existence |
| 2 | Store | `events` row (+ PostGIS point, inherited from the asset if absent) |
| 3 | Infrastructure context | origin asset/service; optional `payload.impact_radius_m` → PostGIS `ST_DWithin` on geography → `DIRECT_EXPOSURE` assets |
| 4 | Dependency analysis | best-first propagation over explicit edges + implicit hosting edges (asset → hosted service) maximising the product of strength weights; stops below weight 0.25 or depth 5 |
| 5 | Affected services | split of the propagation result |
| 6 | Incident detection | severity ≥ MEDIUM, or HIGH/CRITICAL origin, or any CRITICAL node affected |
| 7 | Status reflection | origin → FAILED/DEGRADED, strongly affected nodes → DEGRADED/DISRUPTED (previous status kept for restore) |
| 8 | Risk | `RiskEngine.calculate()`; incident severity := risk level |
| 9 | AI | `AIProvider.analyze_incident(IncidentContext)` stored on the incident |
| 10 | Recommendations | rule engine matches + AI actions, de-duplicated by title, all `PENDING` |
| 11 | Audit | one audit row per created entity, committed in the **same transaction** |

The whole pipeline is one database transaction: any failure rolls back
everything. The dashboard cache key is invalidated after commit.

## Risk engine

See `packages/risk/engine.py`. Score = Σ factor points (max 100):
severity 25, origin criticality 25, strongest dependency 15, affected
infrastructure 15, affected services 20. Affected nodes contribute
`criticality_weight × impact_weight`, saturating at 4.0 (infrastructure) and
5.0 (services). `impact_score` and `likelihood_score` are reported separately
for UI gauges; `factors[]` makes every score explainable.

## AI layer

```
IncidentContext (sanitised)  ──►  AIProvider.analyze_incident()  ──►  AIAnalysis
                                        ├─ MockAIProvider   (default, deterministic)
                                        └─ OpenAIProvider   (OPENAI_API_KEY; JSON mode; mock fallback)
```

Provider selection happens once at startup (`build_ai_provider`) and is exposed
at `GET /api/v1/intelligence/provider`.

## Security

* Argon2id hashing (argon2-cffi defaults), constant-time verify, dummy verify for unknown e-mails.
* HS256 JWT with `exp`, `iat`, `iss`, `jti`, `type=access`; `JWT_SECRET_KEY` must be ≥ 32 chars in production.
* Role hierarchy ADMIN > OPERATOR > VIEWER enforced by `require_role()` dependencies.
* Request IDs on every response; access log records method, path, status and duration only.
* Log redaction for bearer tokens, JWTs, `sk-` keys and `password=`/`token=` pairs.
* Validation errors never echo submitted values.

## Caching

`GET /dashboard/overview` is cached in Redis for `DASHBOARD_CACHE_TTL_SECONDS`
and invalidated by every write that changes dashboard numbers. The `Cache`
wrapper uses 0.5 s timeouts and a 30 s circuit breaker so a dead Redis never
slows requests.

## Future roadmap (out of scope)

Kafka ingestion, background workers, multi-tenant scoping, SSO/MFA,
notifications, vector search / knowledge graph, real SCADA or government
integrations, distributed tracing.
