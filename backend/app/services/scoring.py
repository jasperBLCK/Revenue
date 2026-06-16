"""Deterministic heuristic AI engine.

Used as a fallback when no LLM API key is configured, and to derive the
Anti-Ghost buckets, lead scores and dashboard metrics from message history.
Keeps the MVP fully functional offline while staying believable for a demo.
"""
from __future__ import annotations

from datetime import UTC, datetime

from app.models.lead import Lead, LeadStatus, Sentiment
from app.models.message import Message, MessageDirection

# Buying-intent signals (Russian + English) used by the heuristic scorer.
POSITIVE_KEYWORDS = [
    "цена",
    "стоимость",
    "купить",
    "оплат",
    "счёт",
    "счет",
    "договор",
    "кп",
    "тариф",
    "подключ",
    "интересно",
    "годовой",
    "demo",
    "демо",
    "price",
    "buy",
    "invoice",
    "contract",
    "deal",
    "interested",
]
NEGATIVE_KEYWORDS = [
    "дорого",
    "потом",
    "не сейчас",
    "подумаю",
    "откажусь",
    "не нужно",
    "конкурент",
    "expensive",
    "later",
    "cancel",
    "not interested",
]

# Estimated deal value per lead, used for potential-revenue figures (USD).
DEAL_VALUE_USD = 2500.0


def _now() -> datetime:
    return datetime.now(UTC)


def _hours_since(dt: datetime | None) -> float:
    if dt is None:
        return 1e6
    if dt.tzinfo is None:
        dt = dt.replace(tzinfo=UTC)
    return (_now() - dt).total_seconds() / 3600.0


def compute_score(lead: Lead, messages: list[Message]) -> dict:
    """Return purchase_probability, churn_risk, interest_level and reasons."""
    inbound = [m for m in messages if m.direction == MessageDirection.inbound]
    outbound = [m for m in messages if m.direction == MessageDirection.outbound]
    text_blob = " ".join(m.text.lower() for m in messages)

    positive_hits = sum(text_blob.count(k) for k in POSITIVE_KEYWORDS)
    negative_hits = sum(text_blob.count(k) for k in NEGATIVE_KEYWORDS)

    reasons: list[str] = []

    # Interest: engagement volume + positive keyword density.
    interest = min(1.0, 0.12 * len(inbound) + 0.08 * positive_hits)
    if positive_hits:
        reasons.append(f"упоминал ключевые сигналы покупки ({positive_hits})")
    if len(inbound) >= 3:
        reasons.append(f"активно пишет ({len(inbound)} сообщений)")

    # Purchase probability: interest, advanced funnel status, fast replies.
    status_boost = {
        LeadStatus.new: 0.0,
        LeadStatus.contacted: 0.05,
        LeadStatus.qualified: 0.15,
        LeadStatus.proposal: 0.3,
        LeadStatus.negotiation: 0.45,
        LeadStatus.won: 1.0,
        LeadStatus.lost: 0.0,
    }[lead.status]
    purchase = min(1.0, 0.5 * interest + status_boost + 0.05 * positive_hits)
    purchase = max(0.0, purchase - 0.08 * negative_hits)
    if lead.status in (LeadStatus.proposal, LeadStatus.negotiation):
        reasons.append("находится на финальных этапах воронки")

    # Churn risk: silence + negative keywords - recent engagement.
    hours_idle = _hours_since(lead.last_activity_at)
    churn = 0.0
    if hours_idle > 24:
        churn += 0.3
        reasons.append(f"нет активности {int(hours_idle)} ч")
    if hours_idle > 72:
        churn += 0.3
    churn += 0.1 * negative_hits
    if not outbound and inbound:
        churn += 0.2
        reasons.append("менеджер ещё не ответил")
    churn = max(0.0, min(1.0, churn - 0.2 * interest))

    if lead.status == LeadStatus.won:
        purchase, churn = 1.0, 0.0
    elif lead.status == LeadStatus.lost:
        purchase, churn = 0.0, 1.0

    if not reasons:
        reasons.append("недостаточно данных для уверенной оценки")

    return {
        "purchase_probability": round(purchase, 2),
        "churn_risk": round(churn, 2),
        "interest_level": round(interest, 2),
        "reasons": reasons[:5],
    }


def compute_summary(lead: Lead, messages: list[Message]) -> dict:
    """Heuristic bullet summary + sentiment."""
    inbound = [m for m in messages if m.direction == MessageDirection.inbound]
    text_blob = " ".join(m.text.lower() for m in messages)
    bullets: list[str] = []

    if any(k in text_blob for k in ("цена", "стоимость", "дорого", "price")):
        bullets.append("Интересуется ценой / обсуждает стоимость.")
    if any(k in text_blob for k in ("премиум", "годовой", "premium", "тариф")):
        bullets.append("Рассматривает премиальный/годовой тариф.")
    if any(k in text_blob for k in ("кп", "договор", "счёт", "счет", "invoice", "contract")):
        bullets.append("Запрашивал КП / документы.")
    if inbound:
        last = inbound[-1].text.strip()
        bullets.append(f"Последнее сообщение клиента: «{last[:120]}»")
    bullets.append(f"Всего сообщений в переписке: {len(messages)}.")

    positive_hits = sum(text_blob.count(k) for k in POSITIVE_KEYWORDS)
    negative_hits = sum(text_blob.count(k) for k in NEGATIVE_KEYWORDS)
    if positive_hits > negative_hits:
        sentiment = Sentiment.positive
    elif negative_hits > positive_hits:
        sentiment = Sentiment.negative
    else:
        sentiment = Sentiment.neutral

    return {"bullets": bullets[:6], "sentiment": sentiment}


def compute_next_action(lead: Lead, score: dict) -> dict:
    hours_idle = _hours_since(lead.last_activity_at)
    if score["purchase_probability"] >= 0.7:
        return {
            "action": "Позвонить сегодня и предложить оформить сделку",
            "reason": "Высокая вероятность покупки — клиент готов к решению.",
            "priority": "high",
        }
    if score["churn_risk"] >= 0.6:
        return {
            "action": "Срочно написать, чтобы вернуть остывающего клиента",
            "reason": f"Высокий риск ухода, нет активности {int(hours_idle)} ч.",
            "priority": "high",
        }
    if lead.status in (LeadStatus.proposal, LeadStatus.negotiation):
        return {
            "action": "Отправить персональное КП и назначить звонок",
            "reason": "Клиент на финальных этапах воронки.",
            "priority": "high",
        }
    if hours_idle > 48:
        return {
            "action": "Напомнить о себе коротким follow-up сообщением",
            "reason": "Давно не было контакта.",
            "priority": "medium",
        }
    return {
        "action": "Уточнить потребность и квалифицировать лид",
        "reason": "Недостаточно сигналов — нужно больше информации.",
        "priority": "medium",
    }


def bucket_for_lead(lead: Lead) -> str | None:
    """Anti-Ghost classification for the dashboard panels."""
    if lead.status in (LeadStatus.won, LeadStatus.lost):
        return None
    hours_idle = _hours_since(lead.last_activity_at)
    if lead.ai_purchase_probability >= 0.7:
        return "hot"
    if lead.ai_churn_risk >= 0.6:
        return "at_risk"
    if hours_idle > 72:
        return "ghost"
    if 24 <= hours_idle <= 72:
        return "follow_up"
    return None
