# RevenuePilot AI

AI-CRM для B2B продаж. Лиды приходят через Telegram-бот, менеджеры общаются в топиках, 
AI анализирует каждое сообщение и подсказывает, что делать дальше.

## Как это работает

```
Клиент → Telegram-бот → топик менеджеров → CRM + AI анализ
                ↑                              │
                └─────── ответ бота ◄─────────┘
```

**Цикл:** клиент пишет боту → создаётся лид и топик → менеджер отвечает в топике →
AI анализирует переписку, вычисляет вероятность покупки и предлагает следующий шаг.

## Killer Features

### AI & Insights
- **AI-анализ в реальном времени** — вероятность покупки, риск ухода, саммари, next best action на каждое сообщение.
- **Anti-Ghost** — находит забытых клиентов, показывает, кому срочно написать.
- **AI-воронки** — анализирует ваш процесс продаж, находит узкие места и упущенную выручку.
- **AI-ассистент** — спроси: "кому написать сегодня?", "почему этот лид холодный?" — получи ответ.

### Communications
- **AI-генерация ответов** — персональные сообщения за один клик (выбор тона).
- **📝 Email Templates** — готовые шаблоны ответов (Follow-up, Reactivation, Value-focused, Discount-focused).
- **Telegram как основной канал** — бот в группе, полная изоляция клиентов, ноль переключений.

### Operations
- **🏆 Team Leaderboard** — рейтинг менеджеров по сделкам за период (геймификация).
- **⚡ Batch Operations** — выберите несколько лидов, отметьте как Won/Lost, назначьте менеджера за раз.
- **⚙️ Smart Automations** — создавайте правила: "если score > 80, добавить тег", "если 7 дней без ответа, напомнить".

### Analytics & Export
- **📊 Export to CSV** — скачайте все лиды с метриками (score, риск, активность, сумма).
- **📈 Advanced Analytics** — конверсия по этапам воронки, выручка по сегментам, метрики команды.

## API Endpoints

| Группа | Функция | Метод | Path |
|--------|---------|-------|------|
| **Auth** | Логин | POST | `/auth/login` |
| | Рефреш токена | POST | `/auth/refresh` |
| **Leads** | Список лидов | GET | `/leads` |
| | Деталь лида | GET | `/leads/{id}` |
| | Создать лид | POST | `/leads` |
| **Messages** | История сообщений | GET | `/messages` |
| | Отправить сообщение | POST | `/messages` |
| **AI** | Анализ (score, риск, саммари) | POST | `/ai/analyze` |
| | Сгенерировать ответ | POST | `/ai/generate-reply` |
| | Увеличить продажи (план действий) | GET | `/ai/grow-revenue` |
| **Dashboard** | Статистика | GET | `/dashboard` |
| **Funnels** | Этапы воронки | GET | `/funnels` |
| **Analytics** 🆕 | Экспорт лидов | GET | `/analytics/export` |
| | Рейтинг менеджеров | GET | `/analytics/leaderboard` |
| | Email шаблоны | GET | `/analytics/templates` |
| | Массовое обновление статуса | POST | `/analytics/batch/update-status` |
| | Массовое назначение менеджера | POST | `/analytics/batch/assign` |
| | Создать automation | POST | `/analytics/automations` |
| | Список automations | GET | `/analytics/automations` |
| **Telegram** | Webhook | POST | `/telegram/webhook` |

Полная спецификация: [openapi.yaml](openapi.yaml)

## Деплой

```bash
./deploy.sh
```

Один шаг — синхронизирует код на сервер, ставит Docker, поднимает стек 
(Postgres + FastAPI + Frontend + Caddy) и регистрирует Telegram webhook.

Сервер по умолчанию: `2.26.124.28` (revenue.makhkets.ru) · можно переопределить: `SERVER_IP=1.2.3.4 ./deploy.sh`

## Команды бота (для менеджеров в топике)

| Команда            | Что делает                                          |
| ------------------ | --------------------------------------------------- |
| `/ai_reply`        | Сгенерировать ответ клиенту по всей переписке       |
| `/ai_summary`      | Короткая выжимка по клиенту                          |
| `/ai_score`        | Вероятность покупки, риск ухода, причины             |
| `/ai_next`         | Лучшее следующее действие                            |
| `/ai_tone <тон>`   | Ответ в заданном тоне (дружелюбно/уверенно/коротко)  |

## Авторизация

JWT (access + refresh токены). Логин → `/auth/login` → получаешь токен → используешь в `Authorization: Bearer <token>`.

## Стек

- **Frontend:** React 19 + Vite + TypeScript (веб-CRM, уже инициализирован).
- **Backend:** FastAPI + SQLAlchemy 2.0 (async) + Alembic + PostgreSQL по `openapi.yaml`,
  JWT-аутентификация, Telegram Bot API (webhook). См. [`backend/`](backend/).
- **AI:** LLM для анализа переписки, генерации ответов и инсайтов с детерминированным
  эвристическим фолбэком (работает и без LLM-ключа).

## Быстрый старт бэкенда

```bash
cd backend
docker compose up -d db
uv venv && source .venv/bin/activate && uv pip install -e ".[dev]"
cp .env.example .env
alembic upgrade head
python -m app.seed          # демо-данные: demo@revenuepilot.ai / demo12345
uvicorn app.main:app --reload --port 8000
# Swagger UI: http://localhost:8000/api/v1/docs
```

## Roadmap (хакатон)

### MVP (базовая функциональность)
- [x] Telegram-бот: приём сообщений, создание лидов и топиков (`/telegram/webhook`).
- [x] Двусторонний мост сообщений клиент ↔ топик ↔ бот.
- [x] Аутентификация менеджеров (JWT access + refresh).
- [x] AI-анализ сообщений в реальном времени (score, риск, саммари).
- [x] Backend API для dashboard, лидов, карточки клиента, воронок, AI-ассистента.
- [x] Кнопка «Как увеличить продажи?» (`/ai/grow-revenue`).
- [x] Веб-CRM: подключение фронтенда к API, live feed, Command Center.

### Killer Features (новое на хакатоне)
- [x] **📊 Export to CSV** — скачайте все лиды с метриками в один клик.
- [x] **🏆 Team Leaderboard** — рейтинг менеджеров по конверсии (30 дней).
- [x] **📝 Email Templates** — 5 готовых шаблонов для быстрого ответа.
- [x] **⚡ Batch Operations** — выбор нескольких лидов, массовые действия (Won/Lost/Assign).
- [x] **⚙️ Smart Automations** — правила для автоматических действий.
- [x] **📈 Analytics** — расширенная статистика по воронке и команде.

### Future
- [ ] Реальный Telegram-бот в продакшене (токен + webhook).
- [ ] Email/SMS отправка через шаблоны.
- [ ] Интеграция с Hubspot/Pipedrive API.
- [ ] Мобильное приложение.
