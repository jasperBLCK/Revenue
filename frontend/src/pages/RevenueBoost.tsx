import { AnimatePresence, motion } from "framer-motion";
import {
  ArrowRight,
  Clock3,
  Flame,
  Radar,
  Sparkles,
  TrendingUp,
  TriangleAlert,
} from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import type { ApiClient } from "../api/client";
import type { DashboardSummary, GrowRevenuePlan } from "../api/types";
import { useCountUp } from "../hooks/useCountUp";
import { formatUsd, initials, type Lead } from "../lib/leads";

const ITEM_ICONS = [Radar, Flame, TriangleAlert, Clock3, TrendingUp];

export function RevenueBoost({
  client,
  dashboard,
  leads,
  onOpenLead,
}: {
  client: ApiClient;
  dashboard: DashboardSummary | null;
  leads: Lead[];
  onOpenLead: (lead: Lead) => void;
}) {
  const [plan, setPlan] = useState<GrowRevenuePlan | null>(null);
  const [loading, setLoading] = useState(false);
  const [ran, setRan] = useState(false);

  const target = plan?.potential_revenue ?? dashboard?.potential_revenue ?? 0;
  const animated = useCountUp(target);

  const run = useCallback(async () => {
    setLoading(true);
    try {
      setPlan(await client.growRevenue());
      setRan(true);
    } finally {
      setLoading(false);
    }
  }, [client]);

  useEffect(() => {
    run().catch(() => undefined);
  }, [run]);

  const leadById = (id: string) => leads.find((lead) => lead.id === id) ?? null;

  const kpis = [
    { label: "Готовы купить", value: dashboard?.hot_count ?? 0, tone: "hot", icon: Flame },
    { label: "Могут уйти", value: dashboard?.at_risk_count ?? 0, tone: "warning", icon: TriangleAlert },
    { label: "Без ответа", value: dashboard?.ghost_count ?? 0, tone: "ghost", icon: Radar },
    { label: "Дожать за 24ч", value: dashboard?.follow_up_24h_count ?? 0, tone: "info", icon: Clock3 },
  ];

  return (
    <div className="boost-view">
      <section className="boost-hero glow-card">
        <div className="boost-hero-bg" aria-hidden />
        <div className="boost-hero-copy">
          <p className="eyebrow eyebrow-glow">
            <Sparkles size={14} /> AI Revenue Engine
          </p>
          <h2>Как увеличить продажи прямо сейчас</h2>
          <p>
            AI проанализировал всю базу — лиды, переписки и этапы воронки — и собрал
            план возврата выручки на ближайшие 24 часа.
          </p>
          <button className="primary-button glow-button" type="button" onClick={run} disabled={loading}>
            <Sparkles size={17} />
            {loading ? "AI анализирует базу…" : ran ? "Пересчитать план" : "Построить план"}
          </button>
        </div>
        <div className="boost-hero-stat">
          <span className="boost-stat-label">Потенциал к возврату</span>
          <strong className="boost-stat-value">{formatUsd(animated)}</strong>
          <span className="boost-stat-sub">{dashboard?.currency ?? "USD"} · за 24 часа</span>
        </div>
      </section>

      <section className="boost-kpis">
        {kpis.map((kpi, i) => {
          const Icon = kpi.icon;
          return (
            <motion.article
              className={`boost-kpi ${kpi.tone}`}
              key={kpi.label}
              initial={{ opacity: 0, y: 14 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.3, delay: i * 0.06, ease: "easeOut" }}
            >
              <span className="boost-kpi-icon">
                <Icon size={18} />
              </span>
              <strong>{kpi.value}</strong>
              <span>{kpi.label}</span>
            </motion.article>
          );
        })}
      </section>

      <section className="boost-plan">
        <div className="section-heading">
          <div>
            <p className="eyebrow">Приоритетные действия</p>
            <h2>Что сделать, чтобы вернуть деньги</h2>
          </div>
          {plan && <span>{plan.items.length} шагов</span>}
        </div>

        <AnimatePresence mode="popLayout">
          {(plan?.items ?? []).map((item, i) => {
            const Icon = ITEM_ICONS[i % ITEM_ICONS.length];
            const linked = item.lead_ids.map(leadById).filter((l): l is Lead => Boolean(l));
            return (
              <motion.article
                className="boost-step glow-card"
                key={item.title}
                layout
                initial={{ opacity: 0, y: 16 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.32, delay: i * 0.08, ease: "easeOut" }}
              >
                <span className="boost-step-rank">{String(i + 1).padStart(2, "0")}</span>
                <span className="boost-step-icon">
                  <Icon size={20} />
                </span>
                <div className="boost-step-body">
                  <strong>{item.title}</strong>
                  <p>{item.detail}</p>
                  {linked.length > 0 && (
                    <div className="boost-step-leads">
                      {linked.slice(0, 6).map((lead) => (
                        <button
                          className={`boost-lead-chip ${lead.state}`}
                          type="button"
                          key={lead.id}
                          onClick={() => onOpenLead(lead)}
                          title={`Открыть карточку: ${lead.name}`}
                        >
                          <span className="boost-lead-avatar">{initials(lead.name)}</span>
                          {lead.name}
                          <ArrowRight size={13} />
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              </motion.article>
            );
          })}
          {!plan && loading && (
            <div className="boost-loading glow-card">
              <span className="shimmer-line" />
              <span className="shimmer-line short" />
              <span className="shimmer-line" />
            </div>
          )}
        </AnimatePresence>
      </section>
    </div>
  );
}
