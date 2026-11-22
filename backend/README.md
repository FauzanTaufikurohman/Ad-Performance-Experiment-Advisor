# Backend

## Local setup

1. Copy `.env.example` to `.env` and configure `DATABASE_URL`.
2. Set `AUTH_SECRET` to a unique random value of at least 32 characters. The
   existing `JWT_SECRET` variable is also accepted for local compatibility.
3. From the `backend` directory, run `go run ./cmd/migrate`. The command
   applies ordered SQL migrations and records their versions and checksums.
4. Start the API with `go run .`.

The migration command creates its ledger only in a schema with no existing
tables. If a database already contains tables but has no ledger, the command
stops without applying SQL. Do not mark old migrations as applied or run them
against that database without a reviewed schema comparison and an explicit
adoption procedure. The API does not run migrations at startup.

The frontend provides email/password registration and login at `/auth`.
Registration creates an organization and makes the registrant its
`organization_owner`. Passwords are stored as bcrypt hashes.

Migration `002` assigns new uploads to their authenticated owner. Migration
`005` adds organizations and default workspaces, backfills legacy users and
owner-linked uploads, and scopes uploads to the active organization. Legacy
uploads without an owner remain unassigned. Protected sessions are revalidated
against current organization membership on every request; users must sign in
again after applying migration `005` to refresh old tokens.

Organization roles are `organization_owner`, `organization_admin`,
`cmo_executive`, `marketing_manager`, `campaign_specialist`, `data_analyst`,
`financial_controller`, and `auditor`. Auditor is read-only. Owner/Admin
manage members; admins cannot assign the Owner role. Financial Controllers and
Auditors cannot upload, run AI analysis, or evaluate experiments.
`platform_super_admin` is separate from organization roles and must be
provisioned through controlled database operations; registration and
member-management endpoints cannot grant it. Provisioned platform admins can
select any organization.

Owners, Admins, and Platform Super Admins can create organization invitations
through `POST /api/organizations/invitations`. Invitations are bound to an
email and organization, expire after seven days, and use one-time random tokens
whose hashes are stored in PostgreSQL. There is no email transport configured:
the API returns the link once to the authenticated inviter for delivery through
a trusted channel. The recipient accepts at `POST /api/auth/invitations/accept`
and must provide the invited account password or set a password for a new
account. Invitations cannot assign Owner or Platform Super Admin. The older
member-add endpoint remains available for compatibility.

Only a Platform Super Admin can change a user's global active state through
`POST /api/platform/users/:id/status`. The API refuses self-disable and
disabling the last active Platform Super Admin. Login and every protected
request check this state, so disabling an account blocks already-issued
sessions.

Organization managers can create service identities through
`POST /api/organizations/service-identities`. Each identity is limited to the
active organization, has read-only access to tenant data endpoints, and uses a
separate random API key rather than a user session. The API key is returned
only once; PostgreSQL stores its SHA-256 hash. Revoke a key with
`POST /api/organizations/service-identities/:id/revoke`. Service identities
cannot switch organizations, manage users, upload data, or invoke write
operations. Business Unit/Brand management and centralized platform
configuration are not implemented in this phase.

## Database and server capacity

The PostgreSQL pool defaults to 10 maximum and 1 minimum connections. Tune it
with `DB_MAX_CONNS` (1-1000), `DB_MIN_CONNS` (0 through the maximum),
`DB_MAX_CONN_LIFETIME_SECONDS` (1-86400), and
`DB_MAX_CONN_IDLE_TIME_SECONDS` (1-86400). Each API process has its own pool,
so keep the sum of pool maxima across replicas below the database connection
limit. The HTTP server applies header, write, and idle timeouts and drains
in-flight requests on SIGINT/SIGTERM.

`GET /api/health/live` is a liveness probe. `GET /api/health/ready` returns
503 when PostgreSQL is unavailable. The legacy `GET /api/health` response is
unchanged.

`GET /api/decisions?page=1&limit=25` returns findings across the active
organization's uploads, ordered by severity. Migration `004` adds stored rule
recommendations; older findings have an empty recommendation until their
dataset is uploaded again.

## Bayesian experiment API

Both experiment endpoints require the same bearer token as the upload API:

- `POST /api/v1/experiments/evaluate` evaluates 2-20 arms.
- `POST /api/v1/experiments/monte-carlo` evaluates 6-20 arms.

The JSON body contains an `experiment_id` (up to 100 characters), `metric`
(`ctr` or `cvr`), and an `arms` array. Each arm has a unique `name` and
non-negative `impressions`, `clicks`, and `conversions`, with
`conversions <= clicks <= impressions`. For example:

```json
{
  "experiment_id": "spring-campaign",
  "metric": "ctr",
  "arms": [
    {"name": "control", "impressions": 12000, "clicks": 540, "conversions": 18},
    {"name": "variant-a", "impressions": 11800, "clicks": 720, "conversions": 25}
  ]
}
```

The response includes Beta posterior parameters for CTR and CVR, probability
to be best, expected loss, and budget allocation. The priors are Beta(1,1).
Results are marked `insufficient_data` until every arm has at least 100
impressions; this suppresses a winner and allocation while still returning the
posterior estimates. Near-tied arms (expected-loss difference below 0.001) get
an equal allocation. The latest arm statistics per organization, default workspace, experiment, arm,
and metric are stored in `bayesian_experiment_results`. The complete evaluation
is also stored in `bayesian_experiment_runs`, replacing the prior result for
the same experiment and metric. Migration `007` backfills available legacy
results into this history. Members of the active organization can read the
shared history, including read-only roles; only roles allowed to evaluate can
create or replace results. `GET /api/v1/experiments/results?page=1&limit=10`
returns the paginated history for the active organization's default workspace.
`bayesian_stats` remains as the legacy per-user record table; migration `006`
copies legacy results into the organization/workspace scope without deleting
the original rows.

An arm may optionally include up to 90 `daily_metrics` entries with ISO dates,
impressions, and clicks. `ad_fatigued` is set when the posterior mean CTR
declines across three consecutive calendar-day transitions.

Measure the 10,000-iteration performance target on deployment hardware with
`go test ./internal/services -run '^$' -bench BenchmarkEvaluateBayesianExperiment10k`.
The FRD's latency targets are goals, not a guarantee across machines.

This phase implements the Bayesian engine and scaling foundations only.
Platform ad integrations, autonomous campaign changes, NGO workflows, and
gain-sharing billing are not enabled.
