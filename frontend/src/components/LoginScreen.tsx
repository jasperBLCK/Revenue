import { useState, type FormEvent } from "react";
import { motion } from "framer-motion";
import { CircleDollarSign, LogIn, ShieldCheck } from "lucide-react";
import { useAuth } from "../auth/AuthContext";

const DEMO_EMAIL = "demo@revenuepilot.ai";
const DEMO_PASSWORD = "demo12345";

export function LoginScreen() {
  const { login } = useAuth();
  const [email, setEmail] = useState(DEMO_EMAIL);
  const [password, setPassword] = useState(DEMO_PASSWORD);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    setError(null);
    setLoading(true);
    try {
      await login(email, password);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Не удалось войти");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="auth-screen" data-theme="dark">
      <div className="auth-aside">
        <div className="auth-brand">
          <span className="auth-logo">
            <CircleDollarSign size={22} />
          </span>
          <strong>RevenuePilot AI</strong>
        </div>
        <h1>AI Revenue Assistant CRM</h1>
        <p>
          Система находит выручку, которую команда теряет: горячие лиды,
          клиенты под риском ухода и забытые сделки — в реальном времени.
        </p>
        <ul className="auth-points">
          <li><ShieldCheck size={16} /> AI lead scoring и Anti-Ghost панель</li>
          <li><ShieldCheck size={16} /> Live-лента: сообщение в Telegram → лид в CRM</li>
          <li><ShieldCheck size={16} /> «Как увеличить продажи?» за 4 секунды</li>
        </ul>
      </div>

      <motion.form
        className="auth-card"
        onSubmit={submit}
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.24, ease: "easeOut" }}
      >
        <p className="eyebrow">Вход в систему</p>
        <h2>С возвращением 👋</h2>

        <label className="auth-field">
          <span>Email</span>
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            autoComplete="username"
            required
          />
        </label>

        <label className="auth-field">
          <span>Пароль</span>
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            autoComplete="current-password"
            required
          />
        </label>

        {error && <p className="auth-error">{error}</p>}

        <button className="primary-button full" type="submit" disabled={loading}>
          <LogIn size={17} />
          {loading ? "Вхожу…" : "Войти"}
        </button>

        <p className="auth-hint">
          Демо-доступ заполнен: <strong>{DEMO_EMAIL}</strong> / <strong>{DEMO_PASSWORD}</strong>
        </p>
      </motion.form>
    </div>
  );
}
