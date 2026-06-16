import type {
  AiNextAction,
  AiSummary,
  ApiLead,
  AssistantResponse,
  AuthResponse,
  Bucket,
  DashboardSummary,
  Funnel,
  FunnelAnalytics,
  GeneratedFunnel,
  GeneratedReply,
  GrowRevenuePlan,
  LeadPage,
  LeadStatus,
  Manager,
  Message,
  MessagePage,
  ReplyTone,
} from "./types";

export const API_BASE =
  import.meta.env.VITE_API_BASE ?? "http://localhost:8000/api/v1";

export function wsUrl(token: string | null): string {
  const httpBase = API_BASE.replace(/\/$/, "");
  const wsBase = httpBase.replace(/^http/, "ws");
  const url = `${wsBase}/ws`;
  return token ? `${url}?token=${encodeURIComponent(token)}` : url;
}

export class ApiError extends Error {
  status: number;
  constructor(status: number, message: string) {
    super(message);
    this.status = status;
  }
}

export class ApiClient {
  private token: string | null;

  constructor(token: string | null = null) {
    this.token = token;
  }

  setToken(token: string | null) {
    this.token = token;
  }

  private async request<T>(path: string, init: RequestInit = {}): Promise<T> {
    const headers: Record<string, string> = {
      "Content-Type": "application/json",
      ...(init.headers as Record<string, string> | undefined),
    };
    if (this.token) headers.Authorization = `Bearer ${this.token}`;

    const res = await fetch(`${API_BASE}${path}`, { ...init, headers });
    if (!res.ok) {
      let detail = `Request failed (${res.status})`;
      try {
        const body = await res.json();
        if (typeof body?.detail === "string") detail = body.detail;
      } catch {
        // non-JSON error body; keep default message
      }
      throw new ApiError(res.status, detail);
    }
    if (res.status === 204) return undefined as T;
    return (await res.json()) as T;
  }

  // --- Auth ---
  login(email: string, password: string): Promise<AuthResponse> {
    return this.request<AuthResponse>("/auth/login", {
      method: "POST",
      body: JSON.stringify({ email, password }),
    });
  }

  register(email: string, password: string, name: string): Promise<AuthResponse> {
    return this.request<AuthResponse>("/auth/register", {
      method: "POST",
      body: JSON.stringify({ email, password, name }),
    });
  }

  me(): Promise<Manager> {
    return this.request<Manager>("/auth/me");
  }

  // --- Dashboard ---
  dashboard(): Promise<DashboardSummary> {
    return this.request<DashboardSummary>("/dashboard/summary");
  }

  // --- Leads ---
  leads(params: {
    bucket?: Bucket;
    status?: string;
    search?: string;
    sort?: string;
    page_size?: number;
  } = {}): Promise<LeadPage> {
    const qs = new URLSearchParams();
    if (params.bucket) qs.set("bucket", params.bucket);
    if (params.status) qs.set("status", params.status);
    if (params.search) qs.set("search", params.search);
    qs.set("sort", params.sort ?? "score_desc");
    qs.set("page_size", String(params.page_size ?? 100));
    return this.request<LeadPage>(`/leads?${qs.toString()}`);
  }

  updateLead(
    leadId: string,
    patch: { status?: LeadStatus; funnel_stage?: string; notes?: string; tags?: string[] },
  ): Promise<ApiLead> {
    return this.request<ApiLead>(`/leads/${leadId}`, {
      method: "PATCH",
      body: JSON.stringify(patch),
    });
  }

  // --- Messages ---
  messages(leadId: string, page = 1, pageSize = 50): Promise<MessagePage> {
    return this.request<MessagePage>(
      `/leads/${leadId}/messages?page=${page}&page_size=${pageSize}`,
    );
  }

  sendMessage(leadId: string, text: string, isAiGenerated = false): Promise<Message> {
    return this.request<Message>(`/leads/${leadId}/messages`, {
      method: "POST",
      body: JSON.stringify({ text, is_ai_generated: isAiGenerated }),
    });
  }

  // --- Per-lead AI ---
  summary(leadId: string): Promise<AiSummary> {
    return this.request<AiSummary>(`/leads/${leadId}/ai/summary`);
  }

  nextAction(leadId: string): Promise<AiNextAction> {
    return this.request<AiNextAction>(`/leads/${leadId}/ai/next-action`);
  }

  generateReply(leadId: string, tone: ReplyTone = "friendly"): Promise<GeneratedReply> {
    return this.request<GeneratedReply>(`/leads/${leadId}/ai/generate-reply`, {
      method: "POST",
      body: JSON.stringify({ tone }),
    });
  }

  // --- Assistant / Grow revenue ---
  assistant(query: string): Promise<AssistantResponse> {
    return this.request<AssistantResponse>("/ai/assistant", {
      method: "POST",
      body: JSON.stringify({ query }),
    });
  }

  growRevenue(): Promise<GrowRevenuePlan> {
    return this.request<GrowRevenuePlan>("/ai/grow-revenue", { method: "POST" });
  }

  // --- Funnels ---
  funnels(): Promise<Funnel[]> {
    return this.request<Funnel[]>("/funnels");
  }

  funnelAnalytics(funnelId: string): Promise<FunnelAnalytics> {
    return this.request<FunnelAnalytics>(`/funnels/${funnelId}/analytics`);
  }

  generateFunnel(businessDescription: string): Promise<GeneratedFunnel> {
    return this.request<GeneratedFunnel>("/funnels/generate", {
      method: "POST",
      body: JSON.stringify({ business_description: businessDescription }),
    });
  }

  // --- Analytics & Export ---
  async exportLeads(format: "csv" = "csv"): Promise<void> {
    const headers: Record<string, string> = {
      ...(this.token && { Authorization: `Bearer ${this.token}` }),
    };
    const res = await fetch(`${API_BASE}/analytics/export?format=${format}`, { headers });
    if (!res.ok) throw new ApiError(res.status, "Export failed");
    const blob = await res.blob();
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `leads_export_${new Date().toISOString().split("T")[0]}.csv`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }

  async leaderboard(periodDays: number = 30): Promise<{
    period_days: number;
    leaderboard: Array<{
      manager_id: string;
      name: string;
      total_leads: number;
      won_deals: number;
      conversion_rate: number;
    }>;
  }> {
    return this.request("/analytics/leaderboard", {
      method: "GET",
    });
  }

  async listTemplates(): Promise<{
    templates: Array<{
      name: string;
      subject: string;
      body: string;
    }>;
  }> {
    return this.request("/analytics/templates");
  }

  async batchUpdateStatus(
    leadIds: string[],
    status: string,
  ): Promise<{ updated: number }> {
    return this.request("/analytics/batch/update-status", {
      method: "POST",
      body: JSON.stringify({ lead_ids: leadIds, status }),
    });
  }

  async batchAssign(leadIds: string[], managerId: string): Promise<{ updated: number }> {
    return this.request("/analytics/batch/assign", {
      method: "POST",
      body: JSON.stringify({ lead_ids: leadIds, manager_id: managerId }),
    });
  }

  async createAutomation(payload: {
    name: string;
    trigger: string;
    score_threshold?: number;
    action: string;
    action_value?: string;
  }): Promise<any> {
    return this.request("/analytics/automations", {
      method: "POST",
      body: JSON.stringify(payload),
    });
  }

  async listAutomations(): Promise<{ automations: any[] }> {
    return this.request("/analytics/automations");
  }
}
