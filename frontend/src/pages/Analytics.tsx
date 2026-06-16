import { useEffect, useMemo, useState } from "react";
import { motion } from "framer-motion";
import { Lightbulb, TrendingDown, TrendingUp } from "lucide-react";
import type { ApiClient } from "../api/client";
import type { DashboardSummary, FunnelAnalytics } from "../api/types";
import { cn } from "../lib/ui";
import { formatUsd, type Lead, type LeadState } from "../lib/leads";

export function Analytics({
  client,
  dashboard,
  leads,
}: {
  client: ApiClient;
  dashboard: DashboardSummary | null;
  leads: Lead[];
}) {
  const [analytics, setAnalytics] = useState<FunnelAnalytics | null>(null);
  const [funnelName, setFunnelName] = useState<string>("");

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const funnels = await client.funnels();
      if (cancelled || funnels.length === 0) return;
      setFunnelName(funnels[0].name);
      const data = await client.funnelAnalytics(funnels[0].id);
      if (!cancelled) setAnalytics(data);
    })().catch(() => undefined);
    return () => {
      cancelled = true;
    };
  }, [client]);

  const sumByState = (state: LeadState) =>
    leads.filter((lead) => lead.state === state).reduce((acc, lead) => acc + lead.valueNum, 0);

  const revenueRows = [
    { label: "Готовы купить", value: sumByState("hot"), tone: "hot" },
    { label: "Под риском", value: sumByState("risk"), tone: "warning" },
    { label: "Спящие лиды", value: sumByState("ghost"), tone: "ghost" },
    { label: "В работе", value: sumByState("follow"), tone: "follow" },
  ];
  const revenueMax = Math.max(1, ...revenueRows.map((row) => row.value));

  const biggestDrop = useMemo(() => {
    if (!analytics) return null;
    let worst = { name: "", drop: 0 };
    for (let i = 1; i < analytics.stages.length; i += 1) {
      const prev = analytics.stages[i - 1].count;
      const cur = analytics.stages[i].count;
      const drop = prev > 0 ? (prev - cur) / prev : 0;
      if (drop > worst.drop) worst = { name: analytics.stages[i].name, drop };
    }
    return worst.name ? worst : null;
  }, [analytics]);

  const kpis = dashboard
    ? [
        { label: "Готовы купить", value: dashboard.hot_count, icon: TrendingUp, tone: "hot" },
        { label: "Под риском", value: dashboard.at_risk_count, icon: TrendingDown, tone: "warning" },
        { label: "Спящие лиды", value: dashboard.ghost_count, icon: TrendingDown, tone: "ghost" },
        { label: "Дожать за 24ч", value: dashboard.follow_up_24h_count, icon: TrendingUp, tone: "follow" },
      ]
    : [];

  return (
    <div className="analytics-page">
      <section className="analytics-kpis">
        {kpis.map((kpi) => (
          <motion.div
            key={kpi.label}
            className={cn("kpi-card", kpi.tone)}
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
          >
            <kpi.icon size={18} />
            <strong>{kpi.value}</strong>
            <span>{kpi.label}</span>
          </motion.div>
        ))}
      </section>

      <div className="analytics-grid">
        <section className="panel">
          <div className="panel-head">
            <h2>Конверсия воронки</h2>
            <span className="panel-sub">{funnelName || "Воронка"}</span>
          </div>
          {!analytics && <p className="lead-empty">Считаю конверсию по этапам…</p>}
          <div className="funnel-bars">
            {analytics?.stages.map((stage) => (
              <div key={stage.name} className="funnel-bar-row">
                <span className="funnel-bar-label">{stage.name}</span>
                <div className="funnel-bar-track">
                  <motion.span
                    className={cn(
                      "funnel-bar-fill",
                      biggestDrop?.name === stage.name && "drop",
                    )}
                    initial={{ width: 0 }}
                    animate={{ width: `${Math.max(4, stage.conversion_rate * 100)}%` }}
                    transition={{ duration: 0.5, ease: "easeOut" }}
                  />
                  <span className="funnel-bar-count">{stage.count}</span>
                </div>
                <span className="funnel-bar-rate">{Math.round(stage.conversion_rate * 100)}%</span>
              </div>
            ))}
          </div>
          {analytics?.ai_insight && (
            <div className="analytics-insight">
              <Lightbulb size={16} />
              <p>{analytics.ai_insight}</p>
            </div>
          )}
        </section>

        <section className="panel">
          <div className="panel-head">
            <h2>Выручка по сегментам</h2>
            <span className="panel-sub">Потенциал: {dashboard ? formatUsd(dashboard.potential_revenue) : "—"}</span>
          </div>
          <div className="revenue-bars">
            {revenueRows.map((row) => (
              <div key={row.label} className="revenue-row">
                <span className="revenue-label">{row.label}</span>
                <div className="revenue-track">
                  <motion.span
                    className={cn("revenue-fill", row.tone)}
                    initial={{ width: 0 }}
                    animate={{ width: `${(row.value / revenueMax) * 100}%` }}
                    transition={{ duration: 0.5, ease: "easeOut" }}
                  />
                </div>
                <strong className="revenue-amount">{formatUsd(row.value)}</strong>
              </div>
            ))}
          </div>
        </section>
      </div>
    </div>
  );
}
