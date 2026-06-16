from fastapi import APIRouter

from app.api.v1.routes import (
    ai,
    analytics,
    auth,
    dashboard,
    funnels,
    leads,
    messages,
    realtime,
    telegram,
    topics,
)

api_router = APIRouter()
api_router.include_router(auth.router)
api_router.include_router(leads.router)
api_router.include_router(messages.router)
api_router.include_router(topics.router)
api_router.include_router(ai.router)
api_router.include_router(funnels.router)
api_router.include_router(dashboard.router)
api_router.include_router(analytics.router)
api_router.include_router(telegram.router)
api_router.include_router(realtime.router)
