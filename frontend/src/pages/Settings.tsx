import { useEffect, useState } from "react";
import { Bot, Check, Zap, Moon, Sun, UserPlus, Wifi, WifiOff } from "lucide-react";
import type { ApiClient } from "../api/client";
import type { Manager } from "../api/types";
import { cn } from "../lib/ui";
import { initials } from "../lib/leads";

const ROLE_LABEL: Record<string, string> = {
  admin: "Администратор",
  manager: "Менеджер",
};

export function Settings({
  client,
  manager,
  theme,
  connected,
  onToggleTheme,
}: {
  client: ApiClient;
  manager: Manager | null;
  theme: "light" | "dark";
  connected: boolean;
  onToggleTheme: () => void;
}) {
  const [profile, setProfile] = useState<Manager | null>(manager);
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [status, setStatus] = useState<{ kind: "ok" | "error"; text: string } | null>(null);
  const [saving, setSaving] = useState(false);
  const [automations, setAutomations] = useState<any[]>([]);
  const [showNewAutomation, setShowNewAutomation] = useState(false);
  const [autoName, setAutoName] = useState("");
  const [autoTrigger, setAutoTrigger] = useState("score_above");
  const [autoScore, setAutoScore] = useState(75);
  const [autoAction, setAutoAction] = useState("tag");

  useEffect(() => {
    client.me().then(setProfile).catch(() => undefined);
    client.listAutomations().then((res) => setAutomations(res.automations)).catch(() => undefined);
  }, [client]);

  const addTeammate = async (event: React.FormEvent) => {
    event.preventDefault();
    if (saving) return;
    setSaving(true);
    setStatus(null);
    try {
      await client.register(email, password, name);
      setStatus({ kind: "ok", text: `Коллега ${name} добавлен в команду.` });
      setName("");
      setEmail("");
      setPassword("");
    } catch (err) {
      const text = err instanceof Error ? err.message : "Не удалось добавить коллегу";
      setStatus({ kind: "error", text });
    } finally {
      setSaving(false);
    }
  };

  const addAutomation = async (event: React.FormEvent) => {
    event.preventDefault();
    if (saving || !autoName) return;
    setSaving(true);
    try {
      const newAuto = await client.createAutomation({
        name: autoName,
        trigger: autoTrigger,
        score_threshold: autoScore,
        action: autoAction,
      });
      setAutomations([...automations, newAuto]);
      setAutoName("");
      setShowNewAutomation(false);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="settings-page">
      <section className="panel settings-profile">
        <div className="panel-head">
          <h2>Профиль</h2>
        </div>
        <div className="profile-row">
          <span className="profile-avatar lg">{initials(profile?.name ?? "M")}</span>
          <div>
            <strong>{profile?.name ?? "Менеджер"}</strong>
            <span>{profile?.email}</span>
            <span className="role-chip">{ROLE_LABEL[profile?.role ?? "manager"] ?? profile?.role}</span>
          </div>
        </div>
      </section>

      <section className="panel">
        <div className="panel-head">
          <h2>Добавить коллегу</h2>
          <span className="panel-sub">Создаёт нового менеджера в системе</span>
        </div>
        <form className="teammate-form" onSubmit={addTeammate}>
          <label>
            Имя
            <input value={name} required onChange={(event) => setName(event.target.value)} placeholder="Иван Петров" />
          </label>
          <label>
            Email
            <input
              type="email"
              value={email}
              required
              onChange={(event) => setEmail(event.target.value)}
              placeholder="ivan@company.com"
            />
          </label>
          <label>
            Пароль
            <input
              type="password"
              value={password}
              required
              minLength={8}
              onChange={(event) => setPassword(event.target.value)}
              placeholder="минимум 8 символов"
            />
          </label>
          <button className="primary-button" type="submit" disabled={saving}>
            <UserPlus size={16} />
            {saving ? "Создаю…" : "Добавить в команду"}
          </button>
          {status && (
            <p className={cn("teammate-status", status.kind)}>
              {status.kind === "ok" && <Check size={14} />}
              {status.text}
            </p>
          )}
        </form>
      </section>

      <section className="panel">
        <div className="panel-head">
          <h2>⚡ Smart Automations</h2>
          <span className="panel-sub">Автоматические действия для лидов</span>
        </div>
        {automations.length > 0 && (
          <div style={{ display: "flex", flexDirection: "column", gap: "12px", marginBottom: "16px" }}>
            {automations.map((auto) => (
              <div key={auto.id} style={{
                padding: "12px",
                borderRadius: "6px",
                backgroundColor: "#f9f9f9",
                borderLeft: "3px solid #6366f1",
                fontSize: "13px",
              }}>
                <div style={{ fontWeight: "600", marginBottom: "4px" }}>{auto.name}</div>
                <div style={{ color: "#666", fontSize: "12px" }}>
                  {auto.trigger === "score_above" && `Если score > ${auto.score_threshold}%`}
                  {auto.trigger === "days_without_response" && `Если ${auto.days_threshold} дней без ответа`}
                  {" → "}
                  {auto.action === "tag" && `Добавить тег: ${auto.action_value}`}
                  {auto.action === "notify" && "Отправить уведомление"}
                </div>
                <span style={{
                  display: "inline-block",
                  marginTop: "6px",
                  fontSize: "11px",
                  padding: "2px 6px",
                  backgroundColor: auto.status === "active" ? "#d4edda" : "#f8d7da",
                  color: auto.status === "active" ? "#155724" : "#856404",
                  borderRadius: "3px",
                }}>
                  {auto.status === "active" ? "✓ Активна" : "Отключена"}
                </span>
              </div>
            ))}
          </div>
        )}
        <button
          className="secondary-button"
          type="button"
          onClick={() => setShowNewAutomation(!showNewAutomation)}
        >
          <Zap size={15} />
          {showNewAutomation ? "Отменить" : "Создать правило"}
        </button>
        {showNewAutomation && (
          <form style={{ marginTop: "16px", display: "flex", flexDirection: "column", gap: "12px" }} onSubmit={addAutomation}>
            <label>
              Название правила
              <input
                value={autoName}
                required
                onChange={(e) => setAutoName(e.target.value)}
                placeholder="Например: Auto-tag горячих лидов"
              />
            </label>
            <label>
              Условие
              <select value={autoTrigger} onChange={(e) => setAutoTrigger(e.target.value)}>
                <option value="score_above">Score выше чем</option>
                <option value="days_without_response">Дней без ответа</option>
              </select>
            </label>
            <label>
              Порог
              <input type="number" value={autoScore} onChange={(e) => setAutoScore(Number(e.target.value))} min={0} max={100} />
            </label>
            <label>
              Действие
              <select value={autoAction} onChange={(e) => setAutoAction(e.target.value)}>
                <option value="tag">Добавить тег</option>
                <option value="notify">Отправить уведомление</option>
              </select>
            </label>
            <button className="primary-button" type="submit" disabled={saving}>
              <Zap size={15} />
              {saving ? "Создаю…" : "Создать"}
            </button>
          </form>
        )}
      </section>

      <section className="panel settings-system">
        <div className="panel-head">
          <h2>Система</h2>
        </div>
        <div className="settings-rows">
          <div className="settings-line">
            <span>Тема интерфейса</span>
            <button className="secondary-button" type="button" onClick={onToggleTheme}>
              {theme === "light" ? <Moon size={15} /> : <Sun size={15} />}
              {theme === "light" ? "Тёмная" : "Светлая"}
            </button>
          </div>
          <div className="settings-line">
            <span>Real-time канал</span>
            <span className={cn("live-pill", connected ? "online" : "offline")}>
              {connected ? <Wifi size={14} /> : <WifiOff size={14} />}
              {connected ? "Подключён" : "Отключён"}
            </span>
          </div>
          <div className="settings-line">
            <span>AI-движок</span>
            <span className="ai-status">
              <Bot size={14} />
              Активен (эвристика + LLM при наличии ключа)
            </span>
          </div>
        </div>
      </section>
    </div>
  );
}
