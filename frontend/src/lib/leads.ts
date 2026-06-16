import type { ApiLead } from "../api/types";

export type LeadState = "hot" | "risk" | "ghost" | "follow";

export type Lead = {
  id: string;
  name: string;
  person: string;
  score: number;
  risk: number;
  value: string;
  valueNum: number;
  state: LeadState;
  status: ApiLead["status"];
  stage: string;
  lastReply: string;
  lastActivityAt: string | null;
  channel: string;
  reasons: string[];
  username: string | null;
  hasTopic: boolean;
};

export const STATUS_LABEL: Record<string, string> = {
  new: "Новый лид",
  contacted: "Первичный контакт",
  qualified: "Квалификация",
  proposal: "КП отправлено",
  negotiation: "Переговоры",
  won: "Сделка закрыта",
  lost: "Потерян",
};

export const PIPELINE_STATUSES: ApiLead["status"][] = [
  "new",
  "contacted",
  "qualified",
  "proposal",
  "negotiation",
  "won",
  "lost",
];

export function hoursSince(iso: string | null): number {
  if (!iso) return 1e6;
  return (Date.now() - new Date(iso).getTime()) / 3_600_000;
}

export function deriveState(api: ApiLead): LeadState {
  const idle = hoursSince(api.last_activity_at);
  if (api.ai_score.purchase_probability >= 0.7) return "hot";
  if (api.ai_score.churn_risk >= 0.6) return "risk";
  if (idle > 72) return "ghost";
  return "follow";
}

export function relativeTime(iso: string | null): string {
  if (!iso) return "нет активности";
  const h = hoursSince(iso);
  if (h < 1) return `${Math.max(1, Math.round(h * 60))} мин назад`;
  if (h < 24) return `${Math.round(h)} ч назад`;
  const d = Math.round(h / 24);
  return d === 1 ? "вчера" : `${d} дн назад`;
}

export function formatUsd(value: number): string {
  return `$${Math.round(value).toLocaleString("ru-RU").replace(/,/g, " ")}`;
}

export function mapLead(api: ApiLead): Lead {
  const valueNum =
    Math.round((api.ai_score.purchase_probability * 5000) / 100) * 100 + 1500;
  return {
    id: api.id,
    name: api.name,
    person: api.telegram_username ? `@${api.telegram_username}` : api.name,
    score: Math.round(api.ai_score.purchase_probability * 100),
    risk: Math.round(api.ai_score.churn_risk * 100),
    value: formatUsd(valueNum),
    valueNum,
    state: deriveState(api),
    status: api.status,
    stage: api.funnel_stage ?? STATUS_LABEL[api.status] ?? api.status,
    lastReply: relativeTime(api.last_activity_at),
    lastActivityAt: api.last_activity_at,
    channel: api.telegram_username ? "Telegram" : "Web",
    reasons: api.ai_score.reasons,
    username: api.telegram_username,
    hasTopic: api.topic_id != null,
  };
}

export function initials(name: string): string {
  return name
    .replace(/^ООО\s+/i, "")
    .replace(/^@/, "")
    .split(/\s+/)
    .slice(0, 2)
    .map((part) => part.charAt(0).toUpperCase())
    .join("");
}

export function stateLabel(state: LeadState): string {
  return state;
}
