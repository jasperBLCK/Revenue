"""Real-time event stream for the CRM frontend.

Clients connect to ``/api/v1/ws`` (optionally with ``?token=<access_token>``)
and receive JSON events broadcast by the backend, e.g. when a Telegram
message creates a new lead.
"""
import logging

from fastapi import APIRouter, WebSocket, WebSocketDisconnect

from app.core.events import events
from app.core.security import ACCESS_TOKEN_TYPE, decode_token

logger = logging.getLogger(__name__)

router = APIRouter(tags=["Realtime"])


@router.websocket("/ws")
async def realtime_ws(websocket: WebSocket, token: str | None = None) -> None:
    # If a token is supplied, validate it; reject only when it is clearly bad.
    if token:
        try:
            payload = decode_token(token)
        except ValueError:
            await websocket.close(code=4401)
            return
        if payload.get("type") != ACCESS_TOKEN_TYPE:
            await websocket.close(code=4401)
            return

    await events.connect(websocket)
    try:
        await websocket.send_json({"type": "connected"})
        while True:
            # Keep the socket open; inbound frames (heartbeats) are ignored.
            await websocket.receive_text()
    except WebSocketDisconnect:
        await events.disconnect(websocket)
    except Exception:  # pragma: no cover - defensive cleanup
        await events.disconnect(websocket)
