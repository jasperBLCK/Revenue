from pydantic import BaseModel


class DashboardSummary(BaseModel):
    hot_count: int
    at_risk_count: int
    ghost_count: int
    follow_up_24h_count: int
    potential_revenue: float
    currency: str = "USD"
    revenue_insight: str
