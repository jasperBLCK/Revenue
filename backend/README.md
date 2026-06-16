# RevenuePilot AI — Backend

AI-CRM backend implementing [`../openapi.yaml`](../openapi.yaml). Clients arrive via a
Telegram bot, managers reply through the bot, and an AI layer scores leads, summarizes
conversations and recommends the next best action in real time.

## Stack

| Layer        | Choice                                              |
| ------------ | --------------------------------------------------- |
| API          | **FastAPI** (async, OpenAPI 3.1, auto docs)         |
| ORM          | **SQLAlchemy 2.0** (async) + **asyncpg**            |
| Migrations   | **Alembic** (async env)                             |
| Database     | **PostgreSQL 16**                                   |
| Validation   | **Pydantic v2** + pydantic-settings                 |
| Auth         | **JWT** (access + refresh, rotation) via python-jose, bcrypt hashing |
| AI           | **OpenAI** (optional) with a deterministic heuristic fallback |
| Telegram     | Bot API client (webhook + outbound), no-op without a token |
| Lint / tests | **ruff**, **pytest** + pytest-asyncio + httpx       |

The AI layer works **with or without** an LLM key: if `OPENAI_API_KEY` is set it uses the
model for reply/assistant/funnel text; otherwise (or on any error) it falls back to the
heuristic engine in `app/services/scoring.py`. The MVP is fully functional offline.

## Quick start (Docker — one command)

Runs Postgres + the API together. The API container waits for the DB, applies
migrations, seeds demo data (`SEED_ON_STARTUP=true`), then serves on `:8000`.

```bash
cd backend
docker compose up --build
# API: http://localhost:8000/api/v1/docs  ·  login demo@revenuepilot.ai / demo12345
```

## Quick start (local dev)

```bash
cd backend

# 1. Start PostgreSQL
docker compose up -d db

# 2. Install deps (uv recommended)
uv venv && source .venv/bin/activate
uv pip install -e ".[dev]"

# 3. Configure env
cp .env.example .env   # defaults already match docker-compose

# 4. Run migrations
alembic upgrade head

# 5. (optional) Seed demo data — login demo@revenuepilot.ai / demo12345
python -m app.seed

# 6. Run the API
uvicorn app.main:app --reload --port 8000
```

- Swagger UI: http://localhost:8000/api/v1/docs
- OpenAPI JSON: http://localhost:8000/api/v1/openapi.json
- Health: http://localhost:8000/health

## Project layout

```
app/
  core/        config, async DB engine, JWT/password security
  models/      SQLAlchemy models (managers, leads, messages, topics, funnels)
  schemas/     Pydantic request/response models (mirror openapi.yaml)
  api/
    deps.py    auth dependency (current manager)
    v1/        routers: auth, leads, messages, topics, ai, funnels, dashboard, telegram
  services/
    scoring.py heuristic AI engine (score, summary, next-action, buckets)
    ai.py      LLM wrapper with heuristic fallback
    telegram.py Telegram Bot API client
    leads.py   recompute & persist cached AI insights
  seed.py      demo data
alembic/       migration environment + versions
tests/         pytest API tests (run against Postgres)
```

## Endpoints (per openapi.yaml)

- **Auth**: `POST /auth/register`, `/auth/login`, `/auth/refresh`, `/auth/logout`, `GET /auth/me`
- **Leads**: `GET/POST /leads`, `GET/PATCH/DELETE /leads/{id}`, `POST /leads/{id}/assign`
  - list filters: `status`, `bucket` (`hot|at_risk|ghost|follow_up`), `search`, `sort`
- **Messages**: `GET/POST /leads/{id}/messages`
- **Topics**: `GET/POST /leads/{id}/topic`
- **AI**: `GET /leads/{id}/ai/score|summary|next-action`,
  `POST /leads/{id}/ai/generate-reply`, `POST /ai/assistant`, `POST /ai/grow-revenue`
- **Funnels**: `GET/POST /funnels`, `POST /funnels/generate`, `GET /funnels/{id}/analytics`
- **Dashboard**: `GET /dashboard/summary`
- **Telegram**: `POST /telegram/webhook` (creates lead + topic, stores message, runs AI)

## Tests & lint

```bash
docker compose up -d db      # tests need Postgres
ruff check .
pytest -q
```

## Connecting the frontend

Point the React frontend at `http://localhost:8000/api/v1`. CORS origins are configurable
via `CORS_ORIGINS` in `.env`.
