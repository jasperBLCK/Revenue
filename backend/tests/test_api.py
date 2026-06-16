import pytest


async def _register(client, email: str) -> dict:
    resp = await client.post(
        "/auth/register",
        json={"email": email, "password": "password123", "name": "Tester"},
    )
    assert resp.status_code == 201, resp.text
    return resp.json()


@pytest.mark.asyncio
async def test_auth_flow(client, unique_email):
    auth = await _register(client, unique_email)
    assert auth["access_token"]
    assert auth["refresh_token"]
    assert auth["manager"]["email"] == unique_email

    headers = {"Authorization": f"Bearer {auth['access_token']}"}
    me = await client.get("/auth/me", headers=headers)
    assert me.status_code == 200
    assert me.json()["email"] == unique_email

    # refresh
    refreshed = await client.post(
        "/auth/refresh", json={"refresh_token": auth["refresh_token"]}
    )
    assert refreshed.status_code == 200
    assert refreshed.json()["access_token"]


@pytest.mark.asyncio
async def test_requires_auth(client):
    resp = await client.get("/dashboard/summary")
    assert resp.status_code == 401


@pytest.mark.asyncio
async def test_lead_lifecycle_and_ai(client, unique_email):
    auth = await _register(client, unique_email)
    headers = {"Authorization": f"Bearer {auth['access_token']}"}

    created = await client.post(
        "/leads",
        json={"name": "Acme Corp", "telegram_username": "acme"},
        headers=headers,
    )
    assert created.status_code == 201, created.text
    lead_body = created.json()
    lead_id = lead_body["id"]
    assert "ai_score" in lead_body
    # A brand-new lead must not be flagged stale (regression: _hours_since(None)).
    assert lead_body["ai_score"]["churn_risk"] < 0.6
    assert not any("1000000" in r for r in lead_body["ai_score"]["reasons"])

    # Send an outbound message with buying-intent keywords.
    msg = await client.post(
        f"/leads/{lead_id}/messages",
        json={"text": "Здравствуйте, расскажу про цену и тариф"},
        headers=headers,
    )
    assert msg.status_code == 201

    score = await client.get(f"/leads/{lead_id}/ai/score", headers=headers)
    assert score.status_code == 200
    body = score.json()
    assert 0 <= body["purchase_probability"] <= 1
    assert 0 <= body["churn_risk"] <= 1

    summary = await client.get(f"/leads/{lead_id}/ai/summary", headers=headers)
    assert summary.status_code == 200
    assert summary.json()["sentiment"] in ("positive", "neutral", "negative")

    nxt = await client.get(f"/leads/{lead_id}/ai/next-action", headers=headers)
    assert nxt.status_code == 200
    assert nxt.json()["priority"] in ("low", "medium", "high")

    reply = await client.post(
        f"/leads/{lead_id}/ai/generate-reply",
        json={"tone": "friendly"},
        headers=headers,
    )
    assert reply.status_code == 200
    assert reply.json()["text"]


@pytest.mark.asyncio
async def test_dashboard_and_assistant(client, unique_email):
    auth = await _register(client, unique_email)
    headers = {"Authorization": f"Bearer {auth['access_token']}"}

    dash = await client.get("/dashboard/summary", headers=headers)
    assert dash.status_code == 200
    assert "hot_count" in dash.json()

    assistant = await client.post(
        "/ai/assistant", json={"query": "Кому написать сегодня?"}, headers=headers
    )
    assert assistant.status_code == 200
    assert "answer" in assistant.json()

    grow = await client.post("/ai/grow-revenue", headers=headers)
    assert grow.status_code == 200
    assert "potential_revenue" in grow.json()


@pytest.mark.asyncio
async def test_funnel_generation(client, unique_email):
    auth = await _register(client, unique_email)
    headers = {"Authorization": f"Bearer {auth['access_token']}"}

    gen = await client.post(
        "/funnels/generate",
        json={"business_description": "B2B SaaS"},
        headers=headers,
    )
    assert gen.status_code == 200
    assert len(gen.json()["stages"]) > 0


@pytest.mark.asyncio
async def test_telegram_webhook_creates_lead(client):
    payload = {
        "update_id": 10,
        "message": {
            "message_id": 1,
            "from": {"id": 555123, "first_name": "Web", "username": "webhook_user"},
            "chat": {"id": 555123, "type": "private"},
            "text": "Здравствуйте, хочу купить, какая цена?",
        },
    }
    resp = await client.post("/telegram/webhook", json=payload)
    assert resp.status_code == 200
    assert resp.json() == {"ok": True}
