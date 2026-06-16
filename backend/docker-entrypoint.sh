#!/usr/bin/env bash
set -euo pipefail

# Wait for the database to accept connections.
echo "Waiting for database..."
python - <<'PY'
import asyncio
import os
import sys

import asyncpg

url = os.environ.get(
    "DATABASE_URL",
    "postgresql+asyncpg://revenuepilot:revenuepilot@db:5432/revenuepilot",
)
dsn = url.replace("postgresql+asyncpg://", "postgresql://")


async def wait() -> None:
    for attempt in range(30):
        try:
            conn = await asyncpg.connect(dsn)
            await conn.close()
            print("Database is ready.")
            return
        except Exception as exc:  # noqa: BLE001
            print(f"  db not ready ({attempt + 1}/30): {exc}")
            await asyncio.sleep(2)
    print("Database did not become ready in time.", file=sys.stderr)
    sys.exit(1)


asyncio.run(wait())
PY

echo "Running migrations..."
alembic upgrade head

if [ "${SEED_ON_STARTUP:-false}" = "true" ]; then
  echo "Seeding demo data..."
  python -m app.seed || echo "Seed skipped/failed (continuing)."
fi

echo "Starting API: $*"
exec "$@"
