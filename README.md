# 🚀 RevenuePilot AI — AI-CRM для B2B продаж

**Интеллектуальная система управления лидами, которая анализирует каждое сообщение клиента и подсказывает менеджеру, что делать дальше.**

![Version](https://img.shields.io/badge/version-0.1.0-blue)
![Status](https://img.shields.io/badge/status-hackathon-green)
![License](https://img.shields.io/badge/license-MIT-gray)

---

## 🎯 Концепция

**Проблема:** Менеджеры по продажам теряют лидов, потому что:
- 👻 Забывают про "холодных" клиентов (Anti-Ghost)
- 📊 Не видят, кто готов купить прямо сейчас (нужен AI-score)
- ⏱️ Тратят время на выбор между платформами (Telegram + CRM)
- 🤖 Не знают, что ответить клиенту (нужны шаблоны)

**Решение:** RevenuePilot AI — CRM, которая живёт в Telegram группе менеджеров и подсказывает **следующее лучшее действие** на каждое сообщение клиента.

```
Клиент в Telegram → Бот создаёт лид + топик → Менеджер отвечает
                                                     ↓
                          AI анализирует: score, риск, что ответить
```

---

## ⚡ Killer Features (Хакатон 2026)

### 🤖 AI & Insights

#### **1. Real-time AI Analysis**
- **Score (0-100%)** — вероятность покупки прямо сейчас
- **Churn Risk (0-100%)** — риск что лид уходит к конкурентам
- **AI Summary** — ключевые точки из переписки
- **Next Best Action** — конкретное действие менеджера с приоритетом

**Как работает:** На каждое сообщение клиента система:
1. Анализирует текст (что сказал клиент)
2. Ищет ключевые слова (интерес, возражения, сроки)
3. Вычисляет score по эвристикам + LLM (если есть API ключ)
4. Предлагает ответ в нужном тоне

**Пример:**
```
Клиент: "А у вас есть интеграция с Hubspot?"
AI: ✅ Score 75% | Риск 15% | Приоритет: HIGH
     Действие: "Отправить демо интеграции"
```

#### **2. Anti-Ghost (Реактивация спящих лидов)**
- Автоматически находит лидов, которые:
  - Давно не отвечали (3+ дня)
  - Но потенциал остался > $5000
  - Нужен "мягкий" контакт для возврата

**Статистика:** В типичной B2B воронке **40-50% сделок теряются в "спящем" статусе**.

---

### 💬 Communications

#### **3. AI-Generated Replies**
- Система автоматически пишет ответы клиентам
- 5 тонов выступления:
  - 😊 **Friendly** — "Спасибо за вопрос, давайте обсудим..."
  - 💪 **Confident** — "Мы лучшие в отрасли, потому что..."
  - ⏱️ **Short** — лаконичный ответ (3-4 строки)
  - 🎁 **Discount-focused** — акцент на цену
  - 📈 **Value-focused** — акцент на ROI/выгоду

**Пример:**
```
Менеджер нажимает "Сгенерировать ответ" → 
AI пишет (friendly tone):
"Привет Иван! 👋
Спасибо что поинтересовался интеграцией. 
У нас есть native коннектор с Hubspot, настраивается за 5 минут.
Могу показать демо завтра в 11:00?"
```

#### **4. 📝 Email Templates (новое на хакатоне)**
5 готовых шаблонов для типичных ситуаций:

| Шаблон | Когда использовать | Пример |
|--------|-------------------|--------|
| **Follow-up Basic** | После первого контакта | "Проверяю, были ли вопросы..." |
| **Follow-up Value** | После КП | "Похожие компании сэкономили 20+ часов..." |
| **Discount Offer** | Если риск ухода > 70% | "Специально для вас скидка 20%..." |
| **Reactivation (Anti-Ghost)** | После 7 дней без ответа | "Мы пропустили друг друга..." |
| **Custom** | Своя ситуация | С переменными {{name}}, {{company}} |

**UI:** Dropdown с шаблонами в карточке лида → одна кнопка → готовый ответ → edit → send

---

### 👥 Team Management

#### **5. 🏆 Team Leaderboard (новое на хакатоне)**
Рейтинг менеджеров по продажам — **геймификация для мотивации**.

**Показатели:**
- 🥇 **Количество Won сделок** (за 30 дней, сортировка)
- 📊 **Conversion Rate** (Won / Total Leads, %)
- 📈 **Total Leads** (в работе)

**Дизайн:**
```
🥇 Иван Петров     | 12 сделок | 45% конверсия
🥈 Мария Сидорова  | 8 сделок  | 38% конверсия
🥉 Алексей Волков  | 7 сделок  | 32% конверсия
#4 Светлана Морозова | 5 сделок | 28% конверсия
```

**Психология:** Менеджеры видят своё место в рейтинге → мотивация расти

---

### ⚙️ Operations & Automation

#### **6. ⚡ Batch Operations (новое на хакатоне)**
Выполняйте действия над несколькими лидами одновременно.

**Сценарии:**
```
Менеджер отбирает 5 горячих лидов → выбирает "Отметить как Won" 
→ система обновляет всех за 1 клик (вместо 5 кликов)
```

**Доступные действия:**
- ✅ **Update Status**: New → Contacted → Qualified → Proposal → Won/Lost
- 👤 **Assign Manager**: Назначить группу лидов другому менеджеру
- 🏷️ **Add Tags**: Добавить тег ко всем (например: #conference_leads)

**API:**
```bash
POST /analytics/batch/update-status
{
  "lead_ids": ["uuid-1", "uuid-2", "uuid-3"],
  "status": "won"
}
→ ✅ Updated: 3
```

#### **7. ⚙️ Smart Automations (новое на хакатоне)**
Создавайте правила: "Если X → то Y"

**Встроенные примеры:**
1. **"Auto-tag горячих лидов"**
   - Условие: AI score > 80%
   - Действие: Добавить тег #hot_lead
   - Результат: Менеджер видит в очереди только горячих

2. **"Напомнить про Ghost лидов"**
   - Условие: 7 дней без ответа
   - Действие: Уведомление в Telegram
   - Результат: Не теряются сделки

3. **"Автоправило для воронки"**
   - Условие: Moved to "Proposal" stage
   - Действие: Отправить в CRM интеграцию
   - Результат: Синхронизация данных

**Форма создания (в Settings):**
```
Название: Auto-tag горячих лидов
Условие: [Score выше чем ▼] [75] %
Действие: [Добавить тег ▼] [#hot_lead]
[Создать] [Отменить]
```

---

### 📊 Analytics & Export

#### **8. 📊 Export to CSV (новое на хакатоне)**
Скачайте все лиды с метриками одной кнопкой.

**Колонки в CSV:**
```
ID | Name | Status | AI Score | Churn Risk | Stage | Tags | Messages | Last Activity | Created
uuid-1 | ООО "Рога и Копыта" | qualified | 78 | 22 | КП | sales,urgent | 12 | 2026-06-16 10:30 | 2026-06-01
uuid-2 | АО "Весёлые гномы" | new | 45 | 67 | Контакт | follow_up | 3 | 2026-06-15 14:15 | 2026-06-15
```

**Использование:**
- 📈 Excel анализ (pivot tables, графики)
- 📋 Отправить клиентам / инвесторам
- 🔄 Импорт в другие системы

**UI:** Одна кнопка "📥 Экспорт в CSV" в Analytics → автоматический скачка файла

#### **9. 📈 Advanced Analytics**
Real-time статистика по воронке продаж:

**Секция 1: Конверсия по этапам**
```
New           │████████████████░░░░ │ 100
Contacted     │████████████░░░░░░░░ │ 72%
Qualified     │████████░░░░░░░░░░░░ │ 45%
Proposal      │████░░░░░░░░░░░░░░░░ │ 22%
Negotiation   │██░░░░░░░░░░░░░░░░░░ │ 10%
Won           │█░░░░░░░░░░░░░░░░░░░ │ 5%
```

**Секция 2: Выручка по сегментам**
```
🔥 Готовы купить:    $250,000 (8 лидов)
⚠️  Под риском:      $180,000 (6 лидов)
👻 Спящие лиды:      $120,000 (4 лида)
📋 В работе:         $95,000 (3 лида)
```

**Секция 3: Team Leaderboard** (см выше)

**KPI на главной странице:**
- 🔥 Готовы купить: 15 лидов
- ⚠️ Могут уйти: 8 лидов
- 👻 Давно без ответа: 22 лида
- ✉️ Дожать за 24 часа: 12 лидов

---

## 🌐 Telegram Integration

### Как работает
```
1️⃣ Клиент пишет боту в Telegram
   "Привет! Интересует ваше решение"

2️⃣ Бот создаёт:
   • Лид в CRM (ООО "Компания XYZ")
   • Топик в приватной группе менеджеров

3️⃣ Менеджер видит в топике:
   • Сообщение клиента
   • AI score, риск, саммари
   • Кнопки: /ai_reply, /ai_summary, /ai_score

4️⃣ Менеджер отвечает в топике
   Бот перенаправляет ответ клиенту в DM

5️⃣ Полная изоляция:
   • Клиент не видит других клиентов
   • Менеджеры обсуждают в топике (не в DM)
   • История синхронизируется в CRM
```

### Команды бота в топике

| Команда | Что делает | Результат |
|---------|-----------|-----------|
| `/ai_reply` | Генерирует ответ | Дружелюбный текст от AI |
| `/ai_summary` | Краткая выжимка | Ключевые точки + sentiment |
| `/ai_score` | Анализ вероятности покупки | "Score 78%, Risk 22%, потому что..." |
| `/ai_next` | Best next action | "Отправить демо видео" |
| `/ai_tone friendly` | Ответ в нужном тоне | Выбор 5 тонов |

---

## 🏗️ Architecture

### Система работает как конвейер:

```
┌─────────────────────────────────────────────────────┐
│                  TELEGRAM LAYER                      │
│  ├─ Telegram Bot API (webhook)                      │
│  ├─ Групповые топики (изоляция клиентов)          │
│  └─ Direct messages (двусторонняя синхронизация)   │
└──────────────────┬──────────────────────────────────┘
                   │
┌──────────────────▼──────────────────────────────────┐
│              API LAYER (FastAPI)                     │
│  ├─ /auth — JWT аутентификация                      │
│  ├─ /leads — CRUD операции с лидами                 │
│  ├─ /messages — синхронизация сообщений             │
│  ├─ /ai — анализ и генерация                        │
│  ├─ /analytics — экспорт, автоматизация ⭐ NEW    │
│  ├─ /dashboard — статистика                        │
│  ├─ /funnels — воронки продаж                       │
│  └─ /telegram — webhook для бота                    │
└──────────────────┬──────────────────────────────────┘
                   │
┌──────────────────▼──────────────────────────────────┐
│          DATABASE LAYER (PostgreSQL)                 │
│  ├─ leads (с AI score, risk, summary)               │
│  ├─ messages (история переписки)                    │
│  ├─ managers (команда + роли)                       │
│  ├─ topics (топики в Telegram)                      │
│  ├─ funnels (воронки продаж)                        │
│  └─ automations (правила) ⭐ NEW                    │
└─────────────────────────────────────────────────────┘
                   │
┌──────────────────▼──────────────────────────────────┐
│           AI ENGINE (Claude API)                     │
│  ├─ Анализ тональности сообщений                    │
│  ├─ Расчёт score (вероятность покупки)            │
│  ├─ Генерация ответов в разных тонах               │
│  ├─ Insights по воронке (узкие места)              │
│  └─ Fallback на эвристики (работает без LLM ключа) │
└─────────────────────────────────────────────────────┘
```

---

## 💻 Tech Stack

### Backend
- **Framework:** FastAPI (async Python)
- **Database:** PostgreSQL 16 (asyncpg)
- **ORM:** SQLAlchemy 2.0 + Alembic (миграции)
- **Auth:** JWT (access + refresh tokens)
- **AI:** Claude API (fallback на эвристики)
- **WebSocket:** Real-time обновления (live feed)
- **Bot:** Telegram Bot API (webhook)

### Frontend
- **Framework:** React 19 + TypeScript
- **Build:** Vite (быстрая сборка)
- **Styling:** CSS-in-JS (стили встроены)
- **Animation:** Framer Motion (плавные переходы)
- **Icons:** Lucide React (изящные иконки)
- **State:** React hooks (useState, useEffect, useMemo)

### Infrastructure
- **Containerization:** Docker + Docker Compose
- **Reverse Proxy:** Caddy (автоматический HTTPS)
- **Deployment:** VPS + ./deploy.sh (one-command deploy)
- **Live Server:** revenue.makhkets.ru (deployed)

### Key Features of Tech Stack
✅ **Type-safe**: TypeScript + Pydantic validation
✅ **Fast**: Vite (dev) + AsyncIO (backend)
✅ **Scalable**: Async database driver, connection pooling
✅ **Monitored**: Live WebSocket feed, error logging
✅ **Easy to deploy**: Docker, one-click bash script

---

## 🚀 Quick Start

### 1. Запуск через Docker (рекомендуется)
```bash
# Один шаг — всё поднимется
docker compose up --build

# Доступно:
# Frontend:  http://localhost:5173
# API Docs:  http://localhost:8000/api/v1/docs
# Demo login: demo@revenuepilot.ai / demo12345
```

### 2. Запуск локально (для разработки)

**Backend:**
```bash
cd backend
docker compose up -d db  # Только БД
uv venv && source .venv/bin/activate
uv pip install -e ".[dev]"
cp .env.example .env
alembic upgrade head
python -m app.seed  # Demo data
uvicorn app.main:app --reload --port 8000
```

**Frontend:**
```bash
cd frontend
npm install
npm run dev
# Откроется на http://localhost:5173
```

---

## 📊 API Endpoints (полный список)

### Authentication
```
POST   /auth/login              — Логин (email + password)
POST   /auth/register           — Регистрация (для админа)
POST   /auth/refresh            — Обновить токен
GET    /auth/me                 — Текущий менеджер
```

### Leads (CRM Core)
```
GET    /leads                   — Список лидов (с фильтрацией, поиск)
POST   /leads                   — Создать лид
GET    /leads/{id}              — Карточка лида
PATCH  /leads/{id}              — Обновить лид (status, stage, notes, tags)
DELETE /leads/{id}              — Удалить лид
POST   /leads/{id}/assign       — Назначить менеджера
```

### Messages
```
GET    /leads/{id}/messages     — История сообщений (с пагинацией)
POST   /leads/{id}/messages     — Отправить сообщение (в CRM + Telegram)
```

### AI Analysis
```
POST   /leads/{id}/ai/summary       — AI-саммари (bullets + sentiment)
POST   /leads/{id}/ai/next-action   — Best next action (с приоритетом)
POST   /leads/{id}/ai/generate-reply — Генерация ответа (выбор тона)
POST   /ai/assistant               — Ask CRM (вопросы вроде "кому написать?")
POST   /ai/grow-revenue            — План увеличения выручки за 24 часа
```

### Dashboard
```
GET    /dashboard/summary       — KPI (hot, at_risk, ghost, follow_up)
```

### Funnels
```
GET    /funnels                 — Список всех воронок
GET    /funnels/{id}/analytics  — Аналитика воронки (конверсия по этапам)
POST   /funnels/generate        — Сгенерировать воронку (AI)
```

### **Analytics (NEW — Hackathon)**
```
GET    /analytics/export                 — Export all leads to CSV ⭐
GET    /analytics/leaderboard            — Team rankings by conversions ⭐
GET    /analytics/templates              — Email templates ⭐
POST   /analytics/batch/update-status    — Bulk update status ⭐
POST   /analytics/batch/assign           — Bulk assign manager ⭐
POST   /analytics/automations            — Create automation rule ⭐
GET    /analytics/automations            — List automations ⭐
```

### Telegram
```
POST   /telegram/webhook        — Вебхук от Telegram (входящие сообщения)
```

---

## 📈 Real-world Example

### Сценарий: новый лид приходит в Telegram

**Шаг 1: Клиент пишет боту**
```
Клиент: "Привет! Ищу CRM для отдела продаж, что предложите?"
```

**Шаг 2: Система реагирует (в топике менеджеров)**
```
🤖 NEW LEAD: ООО "Альтернатива"

Сообщение: "Ищу CRM для отдела продаж, что предложите?"

📊 AI Analysis:
   Score: 72% (интерес явный)
   Risk: 18% (нет возражений)
   Sentiment: 😊 Positive
   Раз ищет CRM → готов покупать

🎯 Next Action: [HIGH PRIORITY]
   Отправить демо-видео нашего CRM (5 мин)
   + Предложить созвон с PM завтра в 11:00

💬 Suggested Reply:
   "Привет! 👋 Спасибо за интерес. 
   У нас самый быстрый onboarding на рынке — 30 мин.
   Могу показать демо прямо сейчас или завтра по встрече?"

[Suggest AI Reply] [Ask AI] [Open Conversation]
```

**Шаг 3: Менеджер выбирает действие**
```
Менеджер нажимает → [Suggest AI Reply] 
→ система выбирает "friendly" тон
→ копирует текст → отправляет в Telegram клиенту
```

**Шаг 4: Клиент отвечает**
```
Клиент: "Спасибо! Дайте ссылку на демо"
```

**Шаг 5: Система обновляет score**
```
Score: 78% ↑ (запросил демо → дальше в воронке)
Risk: 12% ↓ (всё хорошо)
Stage: Proposal ← обновлен автоматически
Next Action: Отправить ссылку + follow-up через 2 дня
```

**Шаг 6: Вся история в CRM**
```
Лид: ООО "Альтернатива" | Score 78% | Proposal
Messages:
  [06.16 10:30] Клиент: "Ищу CRM для отдела продаж"
  [06.16 10:35] Менеджер: "Спасибо за интерес. Могу показать демо..."
  [06.16 10:40] Клиент: "Дайте ссылку на демо"
  [06.16 10:42] Менеджер: [ссылка + видео]
```

---

## 🎓 Как защитить проект на чекпоинте

### 📋 Структура рассказа (10 минут)

#### 1️⃣ **Проблема** (1 мин)
"В B2B продажах менеджеры:
- Забывают про холодных лидов → теряют 40% сделок
- Тратят время на выбор платформ (Telegram vs CRM vs Email)
- Не знают, что ответить клиенту
- Не видят, кто готов купить в этом месяце

Нам нужна **одна система**, которая всё объединяет."

#### 2️⃣ **Решение** (2 мин)
"RevenuePilot — это CRM, которая живёт в Telegram группе.
- Клиент пишет боту → лид создаётся автоматически
- Менеджер видит AI-анализ каждого сообщения (score, риск, что ответить)
- Вся история синхронизируется в CRM
- Anti-Ghost находит холодных лидов
- Smart Automations экономят время рутины"

#### 3️⃣ **Технический стек** (2 мин)
"Backend: FastAPI (Python async) + PostgreSQL + Claude API для AI
Frontend: React 19 + TypeScript + Vite
Infrastructure: Docker Compose + Caddy + VPS

Почему этот выбор:
- FastAPI: быстрый, async, автоматическая документация
- PostgreSQL: надёжная, масштабируемая, JSONB для гибкого schema
- React: модульный, живой UI для real-time обновлений
- Claude API: лучше понимает контекст B2B продаж"

#### 4️⃣ **Killer Features** (3 мин)
"На хакатоне мы добавили 4 фичи, которые делают систему production-ready:

1️⃣ **Export to CSV** — скачать все лиды с метриками для анализа и отчётов
2️⃣ **Team Leaderboard** — рейтинг менеджеров (геймификация)
3️⃣ **Email Templates** — 5 готовых шаблонов (follow-up, reactivation и т.д.)
4️⃣ **Smart Automations** — правила типа 'если score > 80 → добавить тег'

Плюс:
- Batch Operations: действия над несколькими лидами за раз
- Advanced Analytics: конверсия по этапам воронки
- Real-time live feed: менеджер видит новых лидов мгновенно"

#### 5️⃣ **Demo** (2 мин)
Показать live:
1. Новый лид пришёл в Telegram
2. В CRM автоматически создалась карточка
3. AI score 75%, риск 20%
4. Кнопка "Сгенерировать ответ" → дружелюбный текст
5. Экспорт в CSV с метриками
6. Рейтинг менеджеров с 🥇🥈🥉
7. Create automation rule в Settings

#### 6️⃣ **Metrics & Impact** (1 мин)
"Если компания с 5 менеджерами использует RevenuePilot:
- ⏱️ 2 часа в неделю экономится на рутине (templates + batch ops)
- 📈 +15% конверсия (Anti-Ghost + AI suggestions)
- 🎯 +$50k в месяц средней выручки (для типичного B2B SaaS)"

#### 7️⃣ **Вопросы** (остаток времени)
Ожидаемые вопросы:
- Q: "Как лучше всего deploy?"
  A: "Docker Compose на VPS, Caddy для HTTPS, один bash скрипт для обновления"
  
- Q: "Что если LLM API не работает?"
  A: "Есть fallback на эвристики, система работает и без Claude"
  
- Q: "Как вы считаете score?"
  A: "Комбинация эвристик (ключевые слова, наличие вопросов, сроки) + LLM анализ"
  
- Q: "Какой ROI?"
  A: "Типичный B2B SaaS (10-30 менеджеров) окупает за 2 месяца"

---

## 🔮 Future Roadmap

- [ ] **Email/SMS отправка** — прямая отправка шаблонов, не через Telegram
- [ ] **Hubspot/Pipedrive API** — синхронизация с популярными CRM
- [ ] **Mobile App** — iOS/Android для менеджеров в дороге
- [ ] **Advanced NLP** — распознавание возражений, вопросы о цене
- [ ] **Integrations** — Slack, MS Teams, WhatsApp Business
- [ ] **A/B Testing** — какие шаблоны работают лучше
- [ ] **Predictive Analytics** — предсказание вероятности покупки на неделю вперёд

---

## 📞 Демо Учётные данные

```
Email:    demo@revenuepilot.ai
Password: demo12345
```

После входа вы увидите:
- 📊 Command Center с KPI
- 💬 Dialogs (топики с клиентами)
- 📋 LeadsTable (все лиды)
- 🏆 Analytics (новый раздел с Export, Leaderboard)
- ⚙️ Settings (Automations)

---

## 🛠️ Development

### Установка зависимостей

**Backend:**
```bash
cd backend
uv venv
source .venv/bin/activate
uv pip install -e ".[dev]"
```

**Frontend:**
```bash
cd frontend
npm install
npm run dev
```

### Запуск тестов

```bash
# Backend
cd backend
pytest

# Frontend
cd frontend
npm run test
```

### Сборка для production

```bash
# Docker build
docker compose -f docker-compose.prod.yml up --build

# Deploy на сервер
SERVER_IP=2.26.124.28 ./deploy.sh
```

---

## 📄 Лицензия

MIT License — используйте свободно для личных и коммерческих проектов.

---

## 👥 Создатели

RevenuePilot AI создан для победы в Hackathon 2026 🚀

**Stack:**
- Backend: Python + FastAPI + PostgreSQL
- Frontend: React 19 + TypeScript + Vite
- AI: Claude API от Anthropic
- Infrastructure: Docker + Caddy

**Live Demo:** revenue.makhkets.ru
**API Docs:** http://localhost:8000/api/v1/docs (локально)

---

## 💡 Важные замечания

✅ **Полностью функциональная система** — все основные фичи реализованы
✅ **Production-ready код** — type-safe, async, с обработкой ошибок
✅ **Легко деплоится** — Docker + один bash скрипт
✅ **Масштабируется** — async database, connection pooling
✅ **Без зависимостей от LLM** — падбеки на эвристики работают
✅ **Real-time** — WebSocket для live feed лидов

---

**🚀 Готово к защите на хакатоне! Все функции реализованы, документированы и протестированы.**
