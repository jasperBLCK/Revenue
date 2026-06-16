import { useEffect, useRef, useState } from "react";
import { motion } from "framer-motion";
import { Bot, SendHorizonal, Sparkles, X } from "lucide-react";
import type { ApiClient } from "../api/client";
import type { Message } from "../api/types";
import { cn } from "../lib/ui";
import { type Lead } from "../lib/leads";

function timeOf(iso: string): string {
  return new Date(iso).toLocaleTimeString("ru-RU", { hour: "2-digit", minute: "2-digit" });
}

export function Conversation({
  lead,
  client,
  onChanged,
  onClose,
}: {
  lead: Lead;
  client: ApiClient;
  onChanged: () => void;
  onClose: () => void;
}) {
  const [messages, setMessages] = useState<Message[]>([]);
  const [draft, setDraft] = useState("");
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [generating, setGenerating] = useState(false);
  const listRef = useRef<HTMLDivElement>(null);

  const load = async () => {
    const page = await client.messages(lead.id);
    setMessages(page.items);
    setLoading(false);
  };

  useEffect(() => {
    load().catch(() => setLoading(false));
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    // Poll so client replies (incl. those answered from a Telegram topic) appear live.
    const poll = window.setInterval(() => {
      client
        .messages(lead.id)
        .then((page) => setMessages((prev) => (page.items.length !== prev.length ? page.items : prev)))
        .catch(() => {});
    }, 4000);
    return () => {
      window.removeEventListener("keydown", onKey);
      window.clearInterval(poll);
    };
  }, [lead.id]);

  useEffect(() => {
    listRef.current?.scrollTo({ top: listRef.current.scrollHeight, behavior: "smooth" });
  }, [messages]);

  const send = async () => {
    const text = draft.trim();
    if (!text || sending) return;
    setSending(true);
    try {
      const sent = await client.sendMessage(lead.id, text);
      setMessages((prev) => [...prev, sent]);
      setDraft("");
      onChanged();
    } finally {
      setSending(false);
    }
  };

  const suggest = async () => {
    setGenerating(true);
    try {
      const reply = await client.generateReply(lead.id, "friendly");
      setDraft(reply.text);
    } finally {
      setGenerating(false);
    }
  };

  return (
    <motion.div
      className="intel-overlay"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.16 }}
      onClick={onClose}
      role="dialog"
      aria-modal="true"
    >
      <motion.section
        className="convo-drawer"
        initial={{ x: 64, opacity: 0 }}
        animate={{ x: 0, opacity: 1 }}
        exit={{ x: 64, opacity: 0 }}
        transition={{ duration: 0.24, ease: [0.22, 1, 0.36, 1] }}
        onClick={(event) => event.stopPropagation()}
      >
        <header className="convo-head">
          <div>
            <p className="eyebrow">Переписка · {lead.channel}</p>
            <h2>{lead.name}</h2>
            <span>{lead.person}</span>
          </div>
          <button className="intel-close" type="button" onClick={onClose} title="Закрыть">
            <X size={18} />
          </button>
        </header>

        <div className="convo-thread" ref={listRef}>
          {loading && <p className="lead-empty">Загружаю переписку…</p>}
          {!loading && messages.length === 0 && (
            <p className="lead-empty">Сообщений пока нет — начните диалог.</p>
          )}
          {messages.map((message) => (
            <div
              key={message.id}
              className={cn("convo-bubble", message.direction === "outbound" ? "out" : "in")}
            >
              {message.is_ai_generated && (
                <span className="convo-ai-tag">
                  <Bot size={12} /> AI
                </span>
              )}
              <p>{message.text}</p>
              <time>{timeOf(message.created_at)}</time>
            </div>
          ))}
        </div>

        <div className="convo-composer">
          <button
            type="button"
            className="convo-suggest"
            onClick={suggest}
            disabled={generating}
            title="AI предложит ответ"
          >
            <Sparkles size={15} />
            {generating ? "AI думает…" : "AI-ответ"}
          </button>
          <textarea
            value={draft}
            placeholder="Напишите сообщение…"
            onChange={(event) => setDraft(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === "Enter" && (event.metaKey || event.ctrlKey)) send();
            }}
          />
          <button
            type="button"
            className="primary-button convo-send"
            onClick={send}
            disabled={sending || !draft.trim()}
          >
            <SendHorizonal size={16} />
            {sending ? "Отправка…" : "Отправить"}
          </button>
        </div>
      </motion.section>
    </motion.div>
  );
}
