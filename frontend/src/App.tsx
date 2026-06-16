import { AnimatePresence, motion } from "framer-motion";
import {
  ArrowRight,
  Bot,
  CheckCircle2,
  ChevronRight,
  CircleDollarSign,
  Clock3,
  Flame,
  Gauge,
  LayoutDashboard,
  LogOut,
  Menu,
  MessageSquareText,
  Moon,
  Radar,
  Command,
  Route,
  Send,
  Sparkles,
  Sun,
  TriangleAlert,
  Wifi,
  WifiOff,
  X,
} from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";
import type { ApiClient } from "./api/client";
import type {
  AiNextAction,
  ApiLead,
  Bucket,
  DashboardSummary,
  GrowRevenuePlan,
  LiveEvent,
  ReplyTone,
  Sentiment,
} from "./api/types";
import { useAuth } from "./auth/AuthContext";
import { LoginScreen } from "./components/LoginScreen";
import { LiveToastStack, type ToastItem } from "./components/LiveToast";
import { useLiveFeed } from "./hooks/useLiveFeed";
import { useCountUp } from "./hooks/useCountUp";
import { cn } from "./lib/ui";
import {
  formatUsd,
  initials,
  mapLead,
  stateLabel,
  type Lead,
  type LeadState,
} from "./lib/leads";
import { LeadsTable } from "./pages/LeadsTable";
import { PipelineBoard } from "./pages/PipelineBoard";
import { Analytics } from "./pages/Analytics";
import { Settings } from "./pages/Settings";
import { Conversation } from "./pages/Conversation";
import { RevenueBoost } from "./pages/RevenueBoost";
import { CommandPalette } from "./components/CommandPalette";
import {
  BarChart3,
  KanbanSquare,
  MessagesSquare,
  Settings as SettingsIcon,
  Users,
} from "lucide-react";

type View =
  | "command"
  | "boost"
  | "leads"
  | "pipeline"
  | "hot"
  | "risk"
  | "ghost"
  | "funnel"
  | "assistant"
  | "analytics"
  | "settings";
type Theme = "light" | "dark";

const navMeta = [
  { id: "command", label: "Командный центр", icon: LayoutDashboard },
  { id: "boost", label: "Рост выручки", icon: Sparkles },
  { id: "leads", label: "Все лиды", icon: Users },
  { id: "pipeline", label: "Сделки", icon: KanbanSquare },
  { id: "hot", label: "Готовы купить", icon: Flame },
  { id: "risk", label: "Могут уйти", icon: TriangleAlert },
  { id: "ghost", label: "Без ответа", icon: Radar },
  { id: "funnel", label: "Воронка", icon: Route },
  { id: "analytics", label: "Аналитика", icon: BarChart3 },
  { id: "assistant", label: "AI-помощник", icon: Bot },
  { id: "settings", label: "Настройки", icon: SettingsIcon },
] as const satisfies ReadonlyArray<{
  id: View;
  label: string;
  icon: typeof LayoutDashboard;
}>;

type SegmentConfig = {
  tone: "hot" | "warning" | "ghost";
  eyebrow: string;
  title: string;
  description: string;
  amountLabel: string;
  metaIcon: typeof Flame;
  meta: string;
  cta: string;
};

const SENTIMENT_LABEL: Record<Sentiment, string> = {
  positive: "Настроен позитивно",
  neutral: "Нейтрально",
  negative: "Настроен скептично",
};

const PRIORITY_LABEL: Record<AiNextAction["priority"], string> = {
  high: "Срочно",
  medium: "Средний",
  low: "Низкий",
};

const TONE_OPTIONS: { id: ReplyTone; label: string }[] = [
  { id: "friendly", label: "Дружелюбно" },
  { id: "confident", label: "Уверенно" },
  { id: "short", label: "Коротко" },
  { id: "discount_focused", label: "Со скидкой" },
  { id: "value_focused", label: "Через ценность" },
];

const segmentConfig: Record<"hot" | "risk" | "ghost", SegmentConfig> = {
  hot: {
    tone: "hot",
    eyebrow: "Готовы купить",
    title: "Клиенты готовы купить прямо сейчас.",
    description: "Высокий интерес и понятный следующий шаг. Свяжитесь сегодня, пока сделка горячая.",
    amountLabel: "Сумма горячих сделок",
    metaIcon: Flame,
    meta: "Высокая вероятность покупки",
    cta: "Связаться со всеми",
  },
  risk: {
    tone: "warning",
    eyebrow: "Могут уйти",
    title: "Клиенты под риском ухода.",
    description: "Долго молчат после КП или сравнивают с конкурентами. Нужен мягкий, но быстрый контакт.",
    amountLabel: "Выручка под риском",
    metaIcon: TriangleAlert,
    meta: "Критичны первые 24 часа",
    cta: "Удержать клиентов",
  },
  ghost: {
    tone: "ghost",
    eyebrow: "Без ответа",
    title: "Лиды давно не отвечают.",
    description: "Контакт остыл, но потенциал остался. AI подготовил персональные поводы вернуться в диалог.",
    amountLabel: "Замороженный потенциал",
    metaIcon: Radar,
    meta: "Реактивация поднимает конверсию",
    cta: "Запустить реактивацию",
  },
};

// ---------------------------------------------------------------------------
// Root: auth gate
// ---------------------------------------------------------------------------

export function App() {
  const { token } = useAuth();
  if (!token) return <LoginScreen />;
  return <Workspace />;
}

function Workspace() {
  const { client, manager, logout, token } = useAuth();
  const [activeView, setActiveView] = useState<View>("command");
  const [theme, setTheme] = useState<Theme>("light");
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [intelOpen, setIntelOpen] = useState(false);
  const [paletteOpen, setPaletteOpen] = useState(false);

  const [apiLeads, setApiLeads] = useState<ApiLead[]>([]);
  const [dashboard, setDashboard] = useState<DashboardSummary | null>(null);
  const [selectedLeadId, setSelectedLeadId] = useState<string | null>(null);
  const [convoLeadId, setConvoLeadId] = useState<string | null>(null);
  const [toasts, setToasts] = useState<ToastItem[]>([]);

  const refresh = useCallback(async () => {
    const [page, summary] = await Promise.all([
      client.leads({ sort: "score_desc" }),
      client.dashboard(),
    ]);
    setApiLeads(page.items);
    setDashboard(summary);
  }, [client]);

  useEffect(() => {
    refresh().catch(() => undefined);
  }, [refresh]);

  // Live feed: a Telegram message or new web lead streams in here.
  const pushToast = useCallback((event: LiveEvent) => {
    if (!event.lead) return;
    const bucket = (event.bucket ?? null) as Bucket | null;
    const sourceLabel = event.source === "telegram" ? "Telegram" : "CRM";
    const id = `${event.lead.id}-${Date.now()}`;
    const toast: ToastItem = {
      id,
      bucket,
      title: `Новый лид: ${event.lead.name}`,
      detail: event.text ? `«${event.text.slice(0, 60)}» · ${sourceLabel}` : `Источник: ${sourceLabel}`,
    };
    setToasts((prev) => [...prev, toast].slice(-3));
    setTimeout(() => {
      setToasts((prev) => prev.filter((t) => t.id !== id));
    }, 5200);
  }, []);

  const onLiveEvent = useCallback(
    (event: LiveEvent) => {
      if (event.type === "connected") return;
      pushToast(event);
      refresh().catch(() => undefined);
    },
    [pushToast, refresh],
  );

  const connected = useLiveFeed(token, onLiveEvent);

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "k") {
        event.preventDefault();
        setPaletteOpen((v) => !v);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  const leads = useMemo(() => apiLeads.map(mapLead), [apiLeads]);

  const selectedLead =
    leads.find((lead) => lead.id === selectedLeadId) ?? leads[0] ?? null;

  const visibleLeads = useMemo(() => {
    if (activeView === "hot") return leads.filter((lead) => lead.state === "hot");
    if (activeView === "risk") return leads.filter((lead) => lead.state === "risk" || lead.risk > 65);
    if (activeView === "ghost") return leads.filter((lead) => lead.state === "ghost");
    return leads;
  }, [activeView, leads]);

  const counts: Record<View, string> = {
    command: "",
    boost: "",
    leads: leads.length ? String(leads.length) : "",
    pipeline: "",
    hot: dashboard ? String(dashboard.hot_count) : "",
    risk: dashboard ? String(dashboard.at_risk_count) : "",
    ghost: dashboard ? String(dashboard.ghost_count) : "",
    funnel: "",
    analytics: "",
    assistant: dashboard ? String(dashboard.follow_up_24h_count) : "",
    settings: "",
  };

  const openLead = (lead: Lead) => {
    setSelectedLeadId(lead.id);
    setIntelOpen(true);
  };

  const openConversation = (lead: Lead) => setConvoLeadId(lead.id);
  const convoLead = leads.find((lead) => lead.id === convoLeadId) ?? null;

  return (
    <div className={cn("app", sidebarCollapsed && "sidebar-collapsed")} data-theme={theme}>
      <SignalRail
        activeView={activeView}
        counts={counts}
        collapsed={sidebarCollapsed}
        managerName={manager?.name ?? "Менеджер"}
        onToggle={() => setSidebarCollapsed((value) => !value)}
        onNavigate={(view) => setActiveView(view)}
        onLogout={logout}
      />

      <main className="workspace">
        <TopBar
          activeView={activeView}
          theme={theme}
          connected={connected}
          onThemeChange={() => setTheme(theme === "light" ? "dark" : "light")}
          onOpenPalette={() => setPaletteOpen(true)}
        />

        <AnimatePresence mode="wait">
          <motion.div
            key={activeView}
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            transition={{ duration: 0.18, ease: "easeOut" }}
            className="view"
          >
            {activeView === "boost" ? (
              <RevenueBoost
                client={client}
                dashboard={dashboard}
                leads={leads}
                onOpenLead={openLead}
              />
            ) : activeView === "funnel" ? (
              <FunnelBuilder client={client} />
            ) : activeView === "assistant" ? (
              <AssistantPanel client={client} onOpenLead={(id) => { setSelectedLeadId(id); setIntelOpen(true); }} />
            ) : activeView === "leads" ? (
              <LeadsTable
                leads={leads}
                onOpenLead={openLead}
                onOpenConversation={openConversation}
              />
            ) : activeView === "pipeline" ? (
              <PipelineBoard
                leads={leads}
                client={client}
                onChanged={() => refresh().catch(() => undefined)}
                onOpenLead={openLead}
              />
            ) : activeView === "analytics" ? (
              <Analytics client={client} dashboard={dashboard} leads={leads} />
            ) : activeView === "settings" ? (
              <Settings
                client={client}
                manager={manager}
                theme={theme}
                connected={connected}
                onToggleTheme={() => setTheme(theme === "light" ? "dark" : "light")}
              />
            ) : (
              <CommandCenter
                activeView={activeView}
                leads={visibleLeads}
                allLeads={leads}
                dashboard={dashboard}
                selectedLead={selectedLead}
                onSelectLead={openLead}
                client={client}
              />
            )}
          </motion.div>
        </AnimatePresence>
      </main>

      {selectedLead && (
        <LeadIntel
          key={selectedLead.id}
          lead={selectedLead}
          client={client}
          open={intelOpen}
          onOpenConversation={() => { setIntelOpen(false); openConversation(selectedLead); }}
          onClose={() => setIntelOpen(false)}
        />
      )}

      <AnimatePresence>
        {convoLead && (
          <Conversation
            key={convoLead.id}
            lead={convoLead}
            client={client}
            onChanged={() => refresh().catch(() => undefined)}
            onClose={() => setConvoLeadId(null)}
          />
        )}
      </AnimatePresence>

      <CommandPalette
        open={paletteOpen}
        commands={navMeta.map((item) => ({ id: item.id, label: item.label, hint: "Раздел" }))}
        client={client}
        onClose={() => setPaletteOpen(false)}
        onRun={(id) => {
          setActiveView(id as View);
          setPaletteOpen(false);
        }}
        onOpenLead={(id) => {
          setSelectedLeadId(id);
          setIntelOpen(true);
          setPaletteOpen(false);
        }}
      />

      <LiveToastStack toasts={toasts} />
    </div>
  );
}

function SignalRail({
  activeView,
  counts,
  collapsed,
  managerName,
  onToggle,
  onNavigate,
  onLogout,
}: {
  activeView: View;
  counts: Record<View, string>;
  collapsed: boolean;
  managerName: string;
  onToggle: () => void;
  onNavigate: (view: View) => void;
  onLogout: () => void;
}) {
  return (
    <aside className="signal-rail">
      <div className="rail-head">
        <span className="rail-logo">
          <CircleDollarSign size={20} />
        </span>
        {!collapsed && (
          <div className="rail-title">
            <strong>RevenuePilot</strong>
            <span>AI Revenue Assistant</span>
          </div>
        )}
        <button className="rail-toggle" type="button" onClick={onToggle} title="Свернуть меню">
          <Menu size={18} />
        </button>
      </div>

      <nav className="signal-nav">
        {navMeta.map((item) => {
          const Icon = item.icon;
          const isActive = item.id === activeView;
          const value = counts[item.id];

          return (
            <button
              key={item.id}
              className={cn("signal-button", isActive && "active")}
              onClick={() => onNavigate(item.id)}
              title={item.label}
              type="button"
            >
              <span className="signal-icon">
                <Icon size={19} strokeWidth={2} />
              </span>
              <span className="signal-label">{item.label}</span>
              {value && <span className="signal-value">{value}</span>}
            </button>
          );
        })}
      </nav>

      <div className="rail-footer">
        <button className="rail-profile" type="button" title={managerName}>
          <span className="profile-avatar">{initials(managerName)}</span>
          <span className="profile-copy">
            <strong>{managerName}</strong>
            <span>Менеджер продаж</span>
          </span>
          <ChevronRight size={16} />
        </button>
        <button className="rail-logout" type="button" onClick={onLogout} title="Выйти">
          <LogOut size={16} />
          <span>Выйти</span>
        </button>
      </div>
    </aside>
  );
}

function TopBar({
  activeView,
  theme,
  connected,
  onThemeChange,
  onOpenPalette,
}: {
  activeView: View;
  theme: Theme;
  connected: boolean;
  onThemeChange: () => void;
  onOpenPalette: () => void;
}) {
  const active = navMeta.find((item) => item.id === activeView) ?? navMeta[0];
  const ThemeIcon = theme === "light" ? Moon : Sun;

  return (
    <header className="topbar">
      <div>
        <p className="eyebrow">AI Revenue Assistant</p>
        <h1>{active.label}</h1>
      </div>
      <div className="top-actions">
        <button className="palette-trigger" type="button" onClick={onOpenPalette} title="Командная палитра (Ctrl+K)">
          <Command size={14} />
          <span>Поиск и команды</span>
          <kbd>Ctrl K</kbd>
        </button>
        <span className={cn("live-pill", connected ? "online" : "offline")} title="Статус real-time канала">
          {connected ? <Wifi size={14} /> : <WifiOff size={14} />}
          {connected ? "Live" : "Offline"}
        </span>
        <button className="icon-button" type="button" onClick={onThemeChange} title="Переключить тему">
          <ThemeIcon size={18} />
        </button>
        <button className="secondary-button" type="button">
          <Gauge size={16} />
          Демо-режим
        </button>
      </div>
    </header>
  );
}

function CommandCenter({
  activeView,
  leads,
  allLeads,
  dashboard,
  selectedLead,
  onSelectLead,
  client,
}: {
  activeView: View;
  leads: Lead[];
  allLeads: Lead[];
  dashboard: DashboardSummary | null;
  selectedLead: Lead | null;
  onSelectLead: (lead: Lead) => void;
  client: ApiClient;
}) {
  const segment =
    activeView === "hot" || activeView === "risk" || activeView === "ghost"
      ? segmentConfig[activeView]
      : null;

  const segmentAmount = leads.reduce((sum, lead) => sum + lead.valueNum, 0);

  return (
    <div className="command-layout">
      {segment ? (
        <SegmentHero segment={segment} count={leads.length} amount={segmentAmount} />
      ) : (
        <>
          <HeroPanel client={client} dashboard={dashboard} />
          <SignalMetrics dashboard={dashboard} />
        </>
      )}

      <div className="command-grid">
        <section className="command-main">
          <LeadQueue activeView={activeView} leads={leads} selectedLead={selectedLead} onSelectLead={onSelectLead} />
        </section>
        <aside className="command-side">
          {segment ? (
            <SegmentSummary segment={segment} count={leads.length} amount={segmentAmount} />
          ) : (
            <RevenueSummary dashboard={dashboard} leads={allLeads} />
          )}
          <AiInsight dashboard={dashboard} />
        </aside>
      </div>
    </div>
  );
}

function SegmentHero({ segment, count, amount }: { segment: SegmentConfig; count: number; amount: number }) {
  const MetaIcon = segment.metaIcon;

  return (
    <section className={cn("segment-hero", segment.tone)}>
      <div className="segment-hero-copy">
        <p className="eyebrow">{segment.eyebrow}</p>
        <h2>{count} {segment.title}</h2>
        <p>{segment.description}</p>
        <div className="hero-actions">
          <button className="primary-button" type="button">
            <Send size={16} />
            {segment.cta}
          </button>
          <span className="hero-note">{count} лидов в очереди</span>
        </div>
      </div>
      <div className={cn("segment-hero-stat", segment.tone)}>
        <span className="segment-stat-icon">
          <MetaIcon size={20} />
        </span>
        <span className="segment-stat-label">{segment.amountLabel}</span>
        <strong className="segment-stat-value">{formatUsd(amount)}</strong>
        <span className="segment-stat-meta">{segment.meta}</span>
      </div>
    </section>
  );
}

function SegmentSummary({ segment, count, amount }: { segment: SegmentConfig; count: number; amount: number }) {
  return (
    <section className="revenue-card">
      <p className="eyebrow">{segment.eyebrow}</p>
      <div className="revenue-headline">
        <strong>{formatUsd(amount)}</strong>
        <span className={cn("revenue-delta", segment.tone)}>
          <ArrowRight size={13} />
          {count} лидов · {segment.amountLabel.toLowerCase()}
        </span>
      </div>
      <div className="revenue-rows">
        <div className="revenue-row">
          <span className={cn("revenue-dot", segment.tone)} />
          <span>Средний чек</span>
          <strong>{count > 0 ? formatUsd(amount / count) : "—"}</strong>
        </div>
        <div className="revenue-row">
          <span className={cn("revenue-dot", segment.tone)} />
          <span>В очереди</span>
          <strong>{count}</strong>
        </div>
      </div>
    </section>
  );
}

function RevenueSummary({ dashboard, leads }: { dashboard: DashboardSummary | null; leads: Lead[] }) {
  const sumByState = (state: LeadState) =>
    leads.filter((lead) => lead.state === state).reduce((sum, lead) => sum + lead.valueNum, 0);

  const rows = [
    { label: "Готовы купить", value: formatUsd(sumByState("hot")), tone: "hot" },
    { label: "Под риском", value: formatUsd(sumByState("risk")), tone: "warning" },
    { label: "Спящие лиды", value: formatUsd(sumByState("ghost")), tone: "ghost" },
  ];

  const potential = useCountUp(dashboard?.potential_revenue ?? 0);

  return (
    <section className="revenue-card">
      <p className="eyebrow">Потенциал за 24 часа</p>
      <div className="revenue-headline">
        <strong>{formatUsd(potential)}</strong>
        <span className="revenue-delta">
          <ArrowRight size={13} />
          можно вернуть сегодня
        </span>
      </div>
      <div className="revenue-rows">
        {rows.map((row) => (
          <div className="revenue-row" key={row.label}>
            <span className={cn("revenue-dot", row.tone)} />
            <span>{row.label}</span>
            <strong>{row.value}</strong>
          </div>
        ))}
      </div>
    </section>
  );
}

function AiInsight({ dashboard }: { dashboard: DashboardSummary | null }) {
  return (
    <section className="insight-card">
      <div className="message-header">
        <Bot size={16} />
        <strong>AI-инсайт дня</strong>
      </div>
      <p>{dashboard?.revenue_insight ?? "AI анализирует базу лидов…"}</p>
      <div className="insight-stat">
        <div>
          <strong>{dashboard?.hot_count ?? "—"}</strong>
          <span>готовы купить</span>
        </div>
        <div>
          <strong>{dashboard?.ghost_count ?? "—"}</strong>
          <span>давно без ответа</span>
        </div>
      </div>
    </section>
  );
}

function HeroPanel({ client, dashboard }: { client: ApiClient; dashboard: DashboardSummary | null }) {
  const [plan, setPlan] = useState<GrowRevenuePlan | null>(null);
  const [loading, setLoading] = useState(false);

  const target = plan?.potential_revenue ?? dashboard?.potential_revenue ?? 0;
  const animated = useCountUp(target);

  const run = async () => {
    setLoading(true);
    try {
      setPlan(await client.growRevenue());
    } finally {
      setLoading(false);
    }
  };

  return (
    <section className="hero-panel">
      <div className="hero-copy">
        <p className="eyebrow">Сегодня в CRM</p>
        <h2>Система нашла выручку, которую команда может вернуть за сутки.</h2>
        <p>
          AI просмотрел лиды, переписки и этапы воронки. Ниже — очередность действий, а не просто список клиентов.
        </p>
        <div className="hero-actions">
          <button className="primary-button" type="button" onClick={run} disabled={loading}>
            <CircleDollarSign size={17} />
            {loading ? "AI анализирует…" : "Как увеличить продажи?"}
          </button>
          <span className="hero-note">{plan ? "План готов" : "План готов за 4 секунды"}</span>
        </div>
      </div>

      <div className="hero-stat">
        <span className="hero-stat-label">Потенциал к возврату</span>
        <strong className="hero-stat-value">{formatUsd(animated)}</strong>
        <span className="hero-stat-sub">за ближайшие 24 часа</span>
        <div className="hero-stat-meta">
          <CheckCircle2 size={15} />
          <span>{dashboard?.ghost_count ?? 0} забытых лидов готовы к действию</span>
        </div>
      </div>

      <AnimatePresence>
        {plan && (
          <motion.div
            className="revenue-plan"
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            exit={{ opacity: 0, height: 0 }}
            transition={{ duration: 0.22, ease: "easeOut" }}
          >
            {plan.items.map((item) => (
              <div className="plan-row" key={item.title}>
                <CheckCircle2 size={17} />
                <div>
                  <strong>{item.title}</strong>
                  <span>{item.detail}</span>
                </div>
              </div>
            ))}
          </motion.div>
        )}
      </AnimatePresence>
    </section>
  );
}

function SignalMetrics({ dashboard }: { dashboard: DashboardSummary | null }) {
  const metrics = [
    { label: "Готовы купить", value: dashboard?.hot_count, tone: "hot", icon: Flame },
    { label: "Могут уйти", value: dashboard?.at_risk_count, tone: "warning", icon: TriangleAlert },
    { label: "Давно без ответа", value: dashboard?.ghost_count, tone: "ghost", icon: Clock3 },
    { label: "Дожать за 24 часа", value: dashboard?.follow_up_24h_count, tone: "info", icon: Send },
  ];

  return (
    <section className="metric-grid">
      {metrics.map((metric) => {
        const Icon = metric.icon;

        return (
          <article className={cn("metric", metric.tone)} key={metric.label}>
            <span className="metric-icon">
              <Icon size={18} />
            </span>
            <div>
              <strong>{metric.value ?? "—"}</strong>
              <span>{metric.label}</span>
            </div>
          </article>
        );
      })}
    </section>
  );
}

function LeadQueue({
  activeView,
  leads,
  selectedLead,
  onSelectLead,
}: {
  activeView: View;
  leads: Lead[];
  selectedLead: Lead | null;
  onSelectLead: (lead: Lead) => void;
}) {
  const title =
    activeView === "hot"
      ? "Горячие лиды"
      : activeView === "risk"
        ? "Лиды с риском ухода"
        : activeView === "ghost"
          ? "Anti-Ghost очередь"
          : "Очередь действий";

  return (
    <section className="lead-queue">
      <div className="section-heading">
        <div>
          <p className="eyebrow">Next best action</p>
          <h2>{title}</h2>
        </div>
        <span>{leads.length} лидов</span>
      </div>

      <div className="lead-table">
        {leads.length === 0 && <p className="lead-empty">Нет лидов в этой категории.</p>}
        {leads.map((lead) => (
          <button
            className={cn("lead-row", selectedLead?.id === lead.id && "selected")}
            key={lead.id}
            onClick={() => onSelectLead(lead)}
            type="button"
          >
            <span className="lead-main">
              <span className={cn("lead-avatar", lead.state)}>{initials(lead.name)}</span>
              <span className="lead-main-copy">
                <strong>{lead.name}</strong>
                <small>{lead.person} · {lead.stage}</small>
              </span>
            </span>

            <span className="lead-progress">
              <span className="lead-progress-head">
                <span className={cn("state-pill", lead.state)}>{stateLabel(lead.state)}</span>
                <em>{lead.channel} · {lead.lastReply}</em>
              </span>
              <span className="lead-progress-track">
                <span className={cn("lead-progress-fill", lead.state)} style={{ width: `${lead.score}%` }} />
              </span>
            </span>

            <span className="lead-meta">
              <strong>{lead.score}%</strong>
              <small>{lead.value}</small>
            </span>
            <ChevronRight size={16} />
          </button>
        ))}
      </div>
    </section>
  );
}

function LeadIntel({
  lead,
  client,
  open,
  onClose,
  onOpenConversation,
}: {
  lead: Lead;
  client: ApiClient;
  open: boolean;
  onClose: () => void;
  onOpenConversation: () => void;
}) {
  const [bullets, setBullets] = useState<string[]>([]);
  const [action, setAction] = useState<string>("");
  const [sentiment, setSentiment] = useState<Sentiment | null>(null);
  const [priority, setPriority] = useState<AiNextAction["priority"] | null>(null);
  const [tone, setTone] = useState<ReplyTone>("friendly");
  const [generated, setGenerated] = useState<string | null>(null);
  const [generating, setGenerating] = useState(false);

  useEffect(() => {
    if (!open) return;
    let cancelled = false;
    setBullets([]);
    setAction("");
    setSentiment(null);
    setPriority(null);
    setGenerated(null);
    Promise.all([client.summary(lead.id), client.nextAction(lead.id)])
      .then(([summary, next]) => {
        if (cancelled) return;
        setBullets(summary.bullets);
        setSentiment(summary.sentiment);
        setAction(next.action);
        setPriority(next.priority);
      })
      .catch(() => undefined);
    return () => {
      cancelled = true;
    };
  }, [open, lead.id, client]);

  useEffect(() => {
    if (!open) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  const generate = async () => {
    setGenerating(true);
    try {
      const reply = await client.generateReply(lead.id, tone);
      setGenerated(reply.text);
    } finally {
      setGenerating(false);
    }
  };

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          className="intel-overlay"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.18, ease: "easeOut" }}
          onClick={onClose}
          role="dialog"
          aria-modal="true"
          aria-label={`Карточка клиента ${lead.name}`}
        >
          <motion.section
            className="lead-intel"
            initial={{ opacity: 0, scale: 0.96, y: 12 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.96, y: 12 }}
            transition={{ duration: 0.22, ease: [0.22, 1, 0.36, 1] }}
            onClick={(event) => event.stopPropagation()}
          >
            <button className="intel-close" type="button" onClick={onClose} title="Закрыть">
              <X size={18} />
            </button>

            <div className="lead-intel-top">
              <div>
                <p className="eyebrow">Карточка клиента</p>
                <h2>{lead.name}</h2>
                <span>{lead.person} · {lead.channel}</span>
                {sentiment && (
                  <span className={cn("sentiment-chip", sentiment)}>
                    {SENTIMENT_LABEL[sentiment]}
                  </span>
                )}
              </div>
              <div className="score-ring">
                <strong>{lead.score}%</strong>
                <span>покупка</span>
              </div>
            </div>

            <div className="intel-stat-row">
              <div className="intel-stat">
                <span>Риск ухода</span>
                <strong className={cn(lead.risk >= 60 && "danger")}>{lead.risk}%</strong>
              </div>
              <div className="intel-stat">
                <span>Этап</span>
                <strong>{lead.stage}</strong>
              </div>
              <div className="intel-stat">
                <span>Активность</span>
                <strong>{lead.lastReply}</strong>
              </div>
            </div>

            <div className="intel-block">
              <h3>AI-саммари</h3>
              <ul>
                {bullets.length === 0 && <li>AI читает переписку…</li>}
                {bullets.map((item) => (
                  <li key={item}>{item}</li>
                ))}
              </ul>
            </div>

            <div className="intel-block">
              <h3>Почему такой score</h3>
              <div className="reason-list">
                {lead.reasons.map((reason) => (
                  <span key={reason}>{reason}</span>
                ))}
              </div>
            </div>

            <div className="recommendation">
              <div>
                <h3>
                  Следующее действие
                  {priority && (
                    <span className={cn("priority-chip", priority)}>
                      {PRIORITY_LABEL[priority]}
                    </span>
                  )}
                </h3>
                <p>{action || "AI определяет лучший следующий шаг…"}</p>
              </div>
              <div className="tone-picker">
                {TONE_OPTIONS.map((opt) => (
                  <button
                    key={opt.id}
                    type="button"
                    className={cn("tone-option", tone === opt.id && "active")}
                    onClick={() => setTone(opt.id)}
                  >
                    {opt.label}
                  </button>
                ))}
              </div>
              <div className="intel-actions">
                <button className="primary-button full" type="button" onClick={generate} disabled={generating}>
                  <MessageSquareText size={17} />
                  {generating ? "AI пишет…" : "Сгенерировать ответ"}
                </button>
                <button className="secondary-button full" type="button" onClick={onOpenConversation}>
                  <MessagesSquare size={16} />
                  Открыть переписку
                </button>
              </div>
            </div>

            <AnimatePresence>
              {generated && (
                <motion.div
                  className="generated-message"
                  initial={{ opacity: 0, scale: 0.98 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0, scale: 0.98 }}
                  transition={{ duration: 0.18, ease: "easeOut" }}
                >
                  <div className="message-header">
                    <Bot size={16} />
                    <strong>Готовый follow-up</strong>
                  </div>
                  <p>{generated}</p>
                </motion.div>
              )}
            </AnimatePresence>
          </motion.section>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

function FunnelBuilder({ client }: { client: ApiClient }) {
  const [businessPrompt, setBusinessPrompt] = useState("B2B SaaS для отделов продаж");
  const [stages, setStages] = useState<string[]>([
    "Новый лид",
    "Первичный контакт",
    "Выявление потребности",
    "Демо",
    "КП",
    "Переговоры",
    "Оплата",
    "Онбординг",
  ]);
  const [explanation, setExplanation] = useState<string>(
    "Большая часть лидов теряется после коммерческого предложения. Добавьте авто-напоминание через 6 часов и короткий расчёт окупаемости.",
  );
  const [loading, setLoading] = useState(false);

  const build = async () => {
    setLoading(true);
    try {
      const result = await client.generateFunnel(businessPrompt);
      setStages(result.stages.map((stage) => stage.name));
      setExplanation(result.explanation);
    } finally {
      setLoading(false);
    }
  };

  const examples = [
    "Продажа онлайн-курсов",
    "B2B SaaS для отделов продаж",
    "Агентство недвижимости",
    "Фитнес-студия",
  ];

  return (
    <div className="funnel-view">
      <section className="funnel-builder glow-card">
        <p className="eyebrow eyebrow-glow">
          <Sparkles size={14} /> AI Funnel Builder
        </p>
        <h2>Опишите бизнес. Система соберёт воронку и покажет слабое место.</h2>
        <div className="prompt-box">
          <input
            value={businessPrompt}
            onChange={(event) => setBusinessPrompt(event.target.value)}
            aria-label="Описание бизнеса"
            onKeyDown={(event) => event.key === "Enter" && build()}
          />
          <button className="primary-button glow-button" type="button" onClick={build} disabled={loading}>
            <Route size={17} />
            {loading ? "Строю…" : "Построить"}
          </button>
        </div>
        <div className="funnel-examples">
          {examples.map((ex) => (
            <button key={ex} type="button" onClick={() => setBusinessPrompt(ex)}>
              {ex}
            </button>
          ))}
        </div>
        <div className="funnel-shape">
          {stages.map((stage, index) => {
            const width = 100 - (index / Math.max(stages.length - 1, 1)) * 52;
            return (
              <motion.div
                className="funnel-bar"
                key={`${stage}-${index}`}
                style={{ width: `${width}%` }}
                initial={{ opacity: 0, scaleX: 0.6 }}
                animate={{ opacity: 1, scaleX: 1 }}
                transition={{ duration: 0.3, delay: index * 0.06, ease: "easeOut" }}
              >
                <span className="funnel-bar-rank">{String(index + 1).padStart(2, "0")}</span>
                <strong>{stage}</strong>
              </motion.div>
            );
          })}
        </div>
      </section>

      <section className="funnel-analysis">
        <div className="section-heading">
          <div>
            <p className="eyebrow">AI-оценка воронки</p>
            <h2>Рекомендация</h2>
          </div>
        </div>
        <div className="analysis-note">
          <TriangleAlert size={18} />
          <p>{explanation}</p>
        </div>
      </section>
    </div>
  );
}

function AssistantPanel({
  client,
  onOpenLead,
}: {
  client: ApiClient;
  onOpenLead: (id: string) => void;
}) {
  const presets = [
    "Кому нужно написать сегодня?",
    "Кто готов купить?",
    "Кто давно не отвечал?",
    "Где теряется выручка?",
  ];
  const [prompt, setPrompt] = useState(presets[0]);
  const [answer, setAnswer] = useState<string>("");
  const [related, setRelated] = useState<{ id: string; name: string; score: number }[]>([]);
  const [loading, setLoading] = useState(false);

  const ask = async (q?: string) => {
    const query = q ?? prompt;
    setPrompt(query);
    setLoading(true);
    try {
      const res = await client.assistant(query);
      setAnswer(res.answer);
      setRelated(
        res.related_leads.slice(0, 4).map((lead) => ({
          id: lead.id,
          name: lead.name,
          score: Math.round(lead.ai_score.purchase_probability * 100),
        })),
      );
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="assistant-view">
      <section className="assistant-panel">
        <p className="eyebrow">Ask CRM</p>
        <h2>Спросите базу как живого аналитика.</h2>
        <div className="assistant-input">
          <input
            value={prompt}
            onChange={(event) => setPrompt(event.target.value)}
            aria-label="Вопрос к CRM"
            onKeyDown={(event) => event.key === "Enter" && ask()}
          />
          <button className="primary-button" type="button" onClick={() => ask()} disabled={loading}>
            <Send size={17} />
            {loading ? "Думаю…" : "Спросить"}
          </button>
        </div>
        <div className="quick-prompts">
          {presets.map((preset) => (
            <button key={preset} type="button" onClick={() => ask(preset)}>
              {preset}
            </button>
          ))}
        </div>
      </section>

      <section className="assistant-answer">
        <div className="message-header">
          <Bot size={17} />
          <strong>Ответ CRM</strong>
        </div>
        <p>{answer || "Задайте вопрос — AI проанализирует базу лидов и ответит со ссылками на клиентов."}</p>
        <div className="answer-leads">
          {related.map((lead) => (
            <div className="answer-lead" key={lead.id}>
              <span>
                <strong>{lead.name}</strong>
                <small>Вероятность покупки {lead.score}%</small>
              </span>
              <button className="text-button" type="button" onClick={() => onOpenLead(lead.id)}>
                Открыть
                <ArrowRight size={15} />
              </button>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}
