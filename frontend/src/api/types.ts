// TypeScript mirrors of the backend Pydantic schemas (FastAPI /api/v1).

export type LeadStatus =
  | "new"
  | "contacted"
  | "qualified"
  | "proposal"
  | "negotiation"
  | "won"
  | "lost";

export type Sentiment = "positive" | "neutral" | "negative";

export type Bucket = "hot" | "at_risk" | "ghost" | "follow_up";

export interface AiScore {
  purchase_probability: number;
  churn_risk: number;
  interest_level: number;
  reasons: string[];
  updated_at: string | null;
}

export interface ApiLead {
  id: string;
  name: string;
  telegram_user_id: number | null;
  telegram_username: string | null;
  status: LeadStatus;
  funnel_stage: string | null;
  assigned_manager_id: string | null;
  topic_id: string | null;
  ai_score: AiScore;
  tags: string[];
  notes: string | null;
  last_activity_at: string | null;
  created_at: string;
}

export interface LeadPage {
  items: ApiLead[];
  page: number;
  page_size: number;
  total: number;
}

export interface DashboardSummary {
  hot_count: number;
  at_risk_count: number;
  ghost_count: number;
  follow_up_24h_count: number;
  potential_revenue: number;
  currency: string;
  revenue_insight: string;
}

export interface AiSummary {
  lead_id: string;
  bullets: string[];
  sentiment: Sentiment;
  updated_at: string | null;
}

export interface AiNextAction {
  action: string;
  reason: string;
  priority: "low" | "medium" | "high";
}

export type ReplyTone =
  | "friendly"
  | "confident"
  | "short"
  | "discount_focused"
  | "value_focused";

export interface GeneratedReply {
  text: string;
  tone: string;
}

export interface Manager {
  id: string;
  email: string;
  name: string;
  role: string;
  created_at: string;
}

export interface AuthResponse {
  access_token: string;
  refresh_token: string;
  token_type: string;
  expires_in: number;
  manager: Manager;
}

export interface AssistantResponse {
  answer: string;
  related_leads: ApiLead[];
}

export interface GrowRevenueItem {
  title: string;
  detail: string;
  lead_ids: string[];
}

export interface GrowRevenuePlan {
  potential_revenue: number;
  currency: string;
  items: GrowRevenueItem[];
}

export interface FunnelStage {
  name: string;
  order: number;
}

export interface GeneratedFunnel {
  stages: FunnelStage[];
  explanation: string;
}

export interface Funnel {
  id: string;
  name: string;
  business_type: string | null;
  stages: FunnelStage[];
  created_at: string;
}

export interface FunnelAnalyticsStage {
  name: string;
  count: number;
  conversion_rate: number;
}

export interface FunnelAnalytics {
  funnel_id: string;
  stages: FunnelAnalyticsStage[];
  ai_insight: string;
}

export type MessageDirection = "inbound" | "outbound";

export interface Message {
  id: string;
  lead_id: string;
  direction: MessageDirection;
  text: string;
  sender_manager_id: string | null;
  telegram_message_id: number | null;
  is_ai_generated: boolean;
  created_at: string;
}

export interface MessagePage {
  items: Message[];
  page: number;
  page_size: number;
  total: number;
}

// Real-time WebSocket events broadcast by the backend.
export interface LiveEvent {
  type: "connected" | "lead.created" | "lead.updated";
  source?: "web" | "telegram";
  bucket?: Bucket | null;
  text?: string;
  lead?: ApiLead;
}
