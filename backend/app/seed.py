"""Seed the database with a demo manager, leads, messages and a funnel.

Run with:  python -m app.seed
Idempotent: clears existing demo data first (by the demo manager email).
"""
from __future__ import annotations

import asyncio
from datetime import UTC, datetime, timedelta

from sqlalchemy import delete, select

from app.core.database import AsyncSessionLocal
from app.core.security import hash_password
from app.models.funnel import Funnel
from app.models.lead import Lead, LeadStatus
from app.models.manager import Manager, ManagerRole
from app.models.message import Message, MessageDirection
from app.services.leads import refresh_lead_insights

DEMO_EMAIL = "demo@revenuepilot.ai"
DEMO_PASSWORD = "demo12345"

DEFAULT_STAGES = [
    "Новый лид",
    "Первичный контакт",
    "Выявление потребности",
    "Коммерческое предложение",
    "Переговоры",
    "Оплата",
    "Повторная продажа",
]


def _ago(hours: float) -> datetime:
    return datetime.now(UTC) - timedelta(hours=hours)


# (name, username, status, hours_since_activity, [(direction, text, hours_ago)])
LEADS = [
    (
        "ООО Альфа",
        "alpha_corp",
        LeadStatus.negotiation,
        2,
        [
            ("inbound", "Здравствуйте! Интересует ваш сервис, какая цена?", 30),
            ("outbound", "Здравствуйте! Расскажу подробнее, какой объём задач?", 29),
            ("inbound", "Нужно на 20 пользователей. Можно КП и годовой тариф?", 6),
            ("inbound", "И ещё раз уточните стоимость, это важно", 2),
        ],
    ),
    (
        "Иван Петров",
        "ivan_p",
        LeadStatus.proposal,
        50,
        [
            ("inbound", "Добрый день, отправили КП?", 80),
            ("outbound", "Да, отправил на почту, посмотрите пожалуйста", 79),
            ("inbound", "Дороговато выходит, подумаю. Предпочитаю писать в Telegram", 50),
        ],
    ),
    (
        "Мария Смирнова",
        "maria_s",
        LeadStatus.contacted,
        120,
        [
            ("inbound", "Привет, что у вас есть для малого бизнеса?", 130),
            ("outbound", "Здравствуйте! Подберём тариф под вас", 129),
        ],
    ),
    (
        "ИП Кузнецов",
        "kuznetsov",
        LeadStatus.qualified,
        10,
        [
            ("inbound", "Интересно, хочу попробовать демо", 20),
            ("outbound", "Отлично, организуем демо на 15 минут", 19),
            ("inbound", "Давайте, очень интересно подключиться", 10),
        ],
    ),
    (
        "ООО Бета",
        "beta_llc",
        LeadStatus.new,
        200,
        [
            ("inbound", "Здравствуйте", 200),
        ],
    ),
    (
        "Сергей Орлов",
        "orlov_s",
        LeadStatus.won,
        300,
        [
            ("inbound", "Хочу купить премиум", 320),
            ("outbound", "Оформляем! Счёт отправлен", 319),
            ("inbound", "Оплатил, спасибо!", 300),
        ],
    ),
    # --- hot: high purchase probability, на финальных этапах, недавно активны ---
    (
        "TechLabs",
        "techlabs",
        LeadStatus.negotiation,
        3,
        [
            ("inbound", "Видели демо, очень интересно. Пришлите КП и годовой тариф", 12),
            ("outbound", "Готовлю КП, какой объём пользователей?", 11),
            ("inbound", "На 50 человек, бюджет есть, хотим подключиться быстро", 3),
        ],
    ),
    (
        "ООО Гамма",
        "gamma_co",
        LeadStatus.proposal,
        5,
        [
            ("inbound", "Получили КП, цена устраивает. Как оформить договор?", 18),
            ("outbound", "Отлично! Отправлю счёт и договор сегодня", 17),
            ("inbound", "Давайте, мы готовы оплатить премиум-тариф", 5),
        ],
    ),
    (
        "Ольга Лебедева",
        "olga_leb",
        LeadStatus.negotiation,
        8,
        [
            ("inbound", "Хочу годовой тариф, интересует скидка за предоплату", 24),
            ("outbound", "Да, при годовой оплате скидка 15%", 23),
            ("inbound", "Супер, тогда давайте оформлять, это выгодно", 8),
        ],
    ),
    # --- at_risk: высокий риск ухода (долго молчат / негатив / нет ответа) ---
    (
        "Northwind",
        "northwind",
        LeadStatus.proposal,
        96,
        [
            ("inbound", "Дороговато выходит, надо подумать", 96),
        ],
    ),
    (
        "Елена Орлова",
        "elena_o",
        LeadStatus.proposal,
        120,
        [
            ("inbound", "Отправляли КП? Пока тишина с вашей стороны", 130),
            ("inbound", "Если дорого, рассмотрим конкурентов", 120),
        ],
    ),
    (
        "FinEdge",
        "finedge",
        LeadStatus.negotiation,
        140,
        [
            ("inbound", "Нужна безопасность и роли доступа, пока сомневаемся", 150),
            ("inbound", "Дорого и сложно, думаем отказаться", 140),
        ],
    ),
    # --- ghost: давно без ответа, но риск не критичный (был ответ менеджера) ---
    (
        "Skillbox Pro",
        "skillbox_pro",
        LeadStatus.contacted,
        110,
        [
            ("inbound", "Интересует массовая загрузка лидов", 120),
            ("outbound", "Подготовлю шаблон импорта, вернусь к вам", 119),
        ],
    ),
    (
        "ООО Дельта",
        "delta_llc",
        LeadStatus.qualified,
        160,
        [
            ("inbound", "Расскажите про интеграции с amoCRM", 170),
            ("outbound", "Конечно, интеграция есть, покажу на демо", 169),
        ],
    ),
    (
        "Роман Ким",
        "roman_kim",
        LeadStatus.contacted,
        220,
        [
            ("inbound", "Здравствуйте, что у вас по тарифам?", 225),
            ("outbound", "Здравствуйте! Сейчас подберём вариант", 224),
        ],
    ),
    (
        "Виктор Зайцев",
        "viktor_z",
        LeadStatus.qualified,
        95,
        [
            ("inbound", "Хотел уточнить про онбординг команды", 100),
            ("outbound", "Онбординг занимает пару дней, помогу настроить", 99),
        ],
    ),
    # --- follow_up: 24-72ч без активности, нужно дожать ---
    (
        "Анна Кузьмина",
        "anna_k",
        LeadStatus.qualified,
        40,
        [
            ("inbound", "Посмотрела демо, нравится. Подумаю до конца недели", 48),
            ("outbound", "Хорошо! Если будут вопросы — на связи", 47),
        ],
    ),
    (
        "ООО Эпсилон",
        "epsilon_co",
        LeadStatus.contacted,
        60,
        [
            ("inbound", "Интересно, пришлите презентацию", 64),
            ("outbound", "Отправил презентацию на почту", 63),
        ],
    ),
    (
        "Дмитрий Соколов",
        "dmitry_s",
        LeadStatus.proposal,
        52,
        [
            ("inbound", "Получил КП, надо согласовать с руководством", 58),
            ("outbound", "Понял, дайте знать по итогам согласования", 57),
        ],
    ),
]


async def seed() -> None:
    async with AsyncSessionLocal() as db:
        # Reset demo data. Leads keep their manager FK as SET NULL, so they
        # must be cleared explicitly (messages and topics cascade from leads).
        await db.execute(delete(Lead))
        await db.execute(delete(Funnel))
        existing = await db.execute(select(Manager).where(Manager.email == DEMO_EMAIL))
        old = existing.scalar_one_or_none()
        if old is not None:
            await db.execute(delete(Manager).where(Manager.id == old.id))
        await db.commit()

        manager = Manager(
            email=DEMO_EMAIL,
            name="Demo Manager",
            password_hash=hash_password(DEMO_PASSWORD),
            role=ManagerRole.admin,
        )
        db.add(manager)
        await db.flush()

        funnel = Funnel(
            name="Стандартная воронка",
            business_type="B2B SaaS",
            stages=[{"name": n, "order": i + 1} for i, n in enumerate(DEFAULT_STAGES)],
        )
        db.add(funnel)

        tg_id = 100001
        for name, username, lead_status, idle_h, msgs in LEADS:
            lead = Lead(
                name=name,
                telegram_user_id=tg_id,
                telegram_username=username,
                status=lead_status,
                assigned_manager_id=manager.id,
                funnel_stage=DEFAULT_STAGES[min(lead_status_index(lead_status), 6)],
                last_activity_at=_ago(idle_h),
                tags=["demo"],
            )
            tg_id += 1
            db.add(lead)
            await db.flush()
            for direction, text, h in msgs:
                db.add(
                    Message(
                        lead_id=lead.id,
                        direction=MessageDirection(direction),
                        text=text,
                        sender_manager_id=manager.id if direction == "outbound" else None,
                        created_at=_ago(h),
                    )
                )
            await db.flush()
            await refresh_lead_insights(db, lead)
            # Keep the curated last_activity_at after recompute.
            lead.last_activity_at = _ago(idle_h)

        await db.commit()
    print(f"Seeded demo data. Login: {DEMO_EMAIL} / {DEMO_PASSWORD}")


def lead_status_index(status: LeadStatus) -> int:
    order = [
        LeadStatus.new,
        LeadStatus.contacted,
        LeadStatus.qualified,
        LeadStatus.proposal,
        LeadStatus.negotiation,
        LeadStatus.won,
        LeadStatus.lost,
    ]
    return order.index(status)


if __name__ == "__main__":
    asyncio.run(seed())
