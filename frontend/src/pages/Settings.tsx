import { useEffect, useState } from "react";
import { Bot, Check, Moon, Sun, UserPlus, Wifi, WifiOff } from "lucide-react";
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

  useEffect(() => {
    client.me().then(setProfile).catch(() => undefined);
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
