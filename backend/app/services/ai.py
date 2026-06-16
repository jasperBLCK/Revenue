"""AI service: LLM-backed insights with deterministic heuristic fallback.

If ``OPENAI_API_KEY`` is configured the service asks the LLM for richer text
(reply generation, assistant answers, funnel design). Otherwise — or on any
LLM error — it transparently falls back to the heuristic engine so the MVP
always returns sensible results.
"""
from __future__ import annotations

import json
import logging

from app.core.config import settings
from app.models.lead import Lead
from app.models.message import Message, MessageDirection
from app.services import scoring

logger = logging.getLogger(__name__)

_TONE_HINTS = {
    "friendly": "дружелюбный, тёплый тон",
    "confident": "уверенный, экспертный тон",
    "short": "максимально короткий ответ, 1-2 предложения",
    "discount_focused": "сделай акцент на выгодном предложении/скидке",
    "value_focused": "сделай акцент на ценности продукта, а не на цене",
}


class AIService:
    def __init__(self) -> None:
        self._client = None
        self.llm_available = bool(settings.ai_enabled and settings.openai_api_key)
        if self.llm_available:
            try:
                from openai import AsyncOpenAI

                self._client = AsyncOpenAI(api_key=settings.openai_api_key)
            except Exception as exc:  # pragma: no cover - defensive
                logger.warning("OpenAI client init failed, using heuristics: %s", exc)
                self.llm_available = False

    async def _chat(self, system: str, user: str, json_mode: bool = False) -> str | None:
        if not self.llm_available or self._client is None:
            return None
        try:
            kwargs = {}
            if json_mode:
                kwargs["response_format"] = {"type": "json_object"}
            resp = await self._client.chat.completions.create(
                model=settings.openai_model,
                messages=[
                    {"role": "system", "content": system},
                    {"role": "user", "content": user},
                ],
                temperature=0.6,
                **kwargs,
            )
            return resp.choices[0].message.content
        except Exception as exc:
            logger.warning("LLM call failed, falling back to heuristics: %s", exc)
            return None

    @staticmethod
    def _transcript(messages: list[Message], limit: int = 40) -> str:
        lines = []
        for m in messages[-limit:]:
            who = "Клиент" if m.direction == MessageDirection.inbound else "Менеджер"
            lines.append(f"{who}: {m.text}")
        return "\n".join(lines) if lines else "(переписки пока нет)"

    # -------------------------------------------------- scoring / summary
    def score(self, lead: Lead, messages: list[Message]) -> dict:
        return scoring.compute_score(lead, messages)

    def summary(self, lead: Lead, messages: list[Message]) -> dict:
        return scoring.compute_summary(lead, messages)

    def next_action(self, lead: Lead, score: dict) -> dict:
        return scoring.compute_next_action(lead, score)

    # -------------------------------------------------- reply generation
    async def generate_reply(
        self, lead: Lead, messages: list[Message], tone: str, instruction: str | None
    ) -> str:
        tone_hint = _TONE_HINTS.get(tone, _TONE_HINTS["friendly"])
        system = (
            "Ты — ассистент менеджера по продажам. Пишешь ответ клиенту в Telegram "
            "от лица компании. Пиши по-русски, по делу, вежливо."
        )
        user = (
            f"Клиент: {lead.name}.\n"
            f"Переписка:\n{self._transcript(messages)}\n\n"
            f"Тон: {tone_hint}.\n"
            + (f"Доп. указание менеджера: {instruction}\n" if instruction else "")
            + "Сформулируй один готовый ответ клиенту."
        )
        text = await self._chat(system, user)
        if text:
            return text.strip()
        return self._fallback_reply(lead, messages, tone, instruction)

    @staticmethod
    def _fallback_reply(
        lead: Lead, messages: list[Message], tone: str, instruction: str | None
    ) -> str:
        name = lead.name.split()[0] if lead.name else "Здравствуйте"
        base = f"Здравствуйте, {name}! "
        if tone == "discount_focused":
            body = (
                "Хотел уточнить, актуален ли для вас вопрос подключения? "
                "Готов подготовить более выгодное предложение со скидкой."
            )
        elif tone == "value_focused":
            body = (
                "Хотел поделиться, как наш продукт поможет вам сэкономить время "
                "и увеличить выручку. Удобно обсудить детали сегодня?"
            )
        elif tone == "short":
            body = "Подскажите, актуален ли ещё вопрос? Готов помочь."
        elif tone == "confident":
            body = (
                "Мы готовы предложить решение под вашу задачу. "
                "Предлагаю короткий созвон, чтобы показать, как это работает."
            )
        else:
            body = (
                "Хотел уточнить, остаётся ли актуальным вопрос подключения. "
                "Могу подготовить предложение под ваши задачи."
            )
        if instruction:
            body += f" {instruction}"
        return base + body

    # -------------------------------------------------- assistant
    async def assistant_answer(self, query: str, leads_context: str) -> str:
        system = (
            "Ты — AI-ассистент CRM-системы. Отвечаешь менеджеру на вопросы по базе "
            "лидов кратко и по делу, на русском."
        )
        user = f"Данные по лидам:\n{leads_context}\n\nВопрос менеджера: {query}"
        text = await self._chat(system, user)
        if text:
            return text.strip()
        return (
            "Вот лиды, наиболее подходящие под ваш запрос (отсортированы по приоритету). "
            "Сосредоточьтесь на горячих лидах и тех, кто давно без ответа."
        )

    # -------------------------------------------------- funnel generation
    async def generate_funnel(self, business_description: str) -> dict:
        system = (
            "Ты — эксперт по продажам. Строишь воронку продаж под тип бизнеса. "
            "Верни JSON вида "
            '{"stages": [{"name": "...", "order": 1}], "explanation": "..."}.'
        )
        user = f"Тип бизнеса: {business_description}. Построй оптимальную воронку продаж."
        text = await self._chat(system, user, json_mode=True)
        if text:
            try:
                data = json.loads(text)
                stages = [
                    {"name": s["name"], "order": int(s.get("order", i + 1))}
                    for i, s in enumerate(data.get("stages", []))
                ]
                if stages:
                    return {
                        "stages": stages,
                        "explanation": data.get("explanation", ""),
                    }
            except (json.JSONDecodeError, KeyError, TypeError) as exc:
                logger.warning("Funnel JSON parse failed: %s", exc)
        return self._fallback_funnel(business_description)

    @staticmethod
    def _fallback_funnel(business_description: str) -> dict:
        names = [
            "Новый лид",
            "Первичный контакт",
            "Выявление потребности",
            "Коммерческое предложение",
            "Переговоры",
            "Оплата",
            "Повторная продажа",
        ]
        stages = [{"name": n, "order": i + 1} for i, n in enumerate(names)]
        return {
            "stages": stages,
            "explanation": (
                f"Базовая воронка под «{business_description}»: ведёт клиента от первого "
                "контакта до оплаты и повторной продажи. Следите за конверсией на этапе "
                "КП — обычно там теряется больше всего сделок."
            ),
        }


ai_service = AIService()
