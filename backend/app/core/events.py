"""In-process WebSocket fan-out for real-time CRM events.

A single :class:`ConnectionManager` instance (``events``) keeps the set of
connected clients and broadcasts JSON events (new lead, new message, score
change) so the frontend can react live — e.g. a Telegram message instantly
pops a new lead onto the dashboard.
"""
from __future__ import annotations

import asyncio
import json
import logging
from typing import Any

from fastapi import WebSocket

logger = logging.getLogger(__name__)


class ConnectionManager:
    def __init__(self) -> None:
        self._connections: set[WebSocket] = set()
        self._lock = asyncio.Lock()

    async def connect(self, websocket: WebSocket) -> None:
        await websocket.accept()
        async with self._lock:
            self._connections.add(websocket)

    async def disconnect(self, websocket: WebSocket) -> None:
        async with self._lock:
            self._connections.discard(websocket)

    async def broadcast(self, event: dict[str, Any]) -> None:
        """Send ``event`` to every connected client; drop dead sockets."""
        message = json.dumps(event, default=str, ensure_ascii=False)
        async with self._lock:
            targets = list(self._connections)
        dead: list[WebSocket] = []
        for websocket in targets:
            try:
                await websocket.send_text(message)
            except Exception:  # pragma: no cover - network/io errors
                dead.append(websocket)
        if dead:
            async with self._lock:
                for websocket in dead:
                    self._connections.discard(websocket)


events = ConnectionManager()
