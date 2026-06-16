"""Thin Telegram Bot API client.

Best-effort: if no bot token is configured the methods become no-ops and the
CRM still works (messages are stored locally). This keeps the demo runnable
without a live bot while supporting a real webhook integration when configured.
"""
from __future__ import annotations

import logging

import httpx

from app.core.config import settings

logger = logging.getLogger(__name__)

API_BASE = "https://api.telegram.org/bot{token}/{method}"


class TelegramService:
    @property
    def enabled(self) -> bool:
        return bool(settings.telegram_bot_token)

    async def _call(self, method: str, payload: dict) -> dict | None:
        if not self.enabled:
            logger.debug("Telegram disabled, skipping %s", method)
            return None
        url = API_BASE.format(token=settings.telegram_bot_token, method=method)
        try:
            async with httpx.AsyncClient(timeout=10) as client:
                resp = await client.post(url, json=payload)
                data = resp.json()
                if not data.get("ok"):
                    logger.warning("Telegram %s failed: %s", method, data)
                    return None
                return data.get("result")
        except Exception as exc:
            logger.warning("Telegram %s error: %s", method, exc)
            return None

    async def create_forum_topic(self, name: str) -> int | None:
        """Create a forum topic in the managers' group; returns thread id."""
        if not settings.telegram_group_chat_id:
            return None
        result = await self._call(
            "createForumTopic",
            {"chat_id": settings.telegram_group_chat_id, "name": name[:128]},
        )
        if result:
            return result.get("message_thread_id")
        return None

    async def send_to_client(self, telegram_user_id: int, text: str) -> int | None:
        result = await self._call(
            "sendMessage", {"chat_id": telegram_user_id, "text": text}
        )
        return result.get("message_id") if result else None

    async def send_to_topic(self, message_thread_id: int, text: str) -> int | None:
        if not settings.telegram_group_chat_id:
            return None
        result = await self._call(
            "sendMessage",
            {
                "chat_id": settings.telegram_group_chat_id,
                "message_thread_id": message_thread_id,
                "text": text,
            },
        )
        return result.get("message_id") if result else None


telegram_service = TelegramService()
