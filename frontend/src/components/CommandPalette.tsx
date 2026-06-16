import { AnimatePresence, motion } from "framer-motion";
import { ArrowRight, CornerDownLeft, Search, Sparkles } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import type { ApiClient } from "../api/client";

export type PaletteCommand = {
  id: string;
  label: string;
  hint?: string;
};

export function CommandPalette({
  open,
  commands,
  client,
  onClose,
  onRun,
  onOpenLead,
}: {
  open: boolean;
  commands: PaletteCommand[];
  client: ApiClient;
  onClose: () => void;
  onRun: (id: string) => void;
  onOpenLead: (id: string) => void;
}) {
  const [query, setQuery] = useState("");
  const [active, setActive] = useState(0);
  const [answer, setAnswer] = useState<string>("");
  const [related, setRelated] = useState<{ id: string; name: string; score: number }[]>([]);
  const [asking, setAsking] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (open) {
      setQuery("");
      setActive(0);
      setAnswer("");
      setRelated([]);
      setTimeout(() => inputRef.current?.focus(), 30);
    }
  }, [open]);

  const filtered = commands.filter((c) =>
    c.label.toLowerCase().includes(query.trim().toLowerCase()),
  );

  const ask = async () => {
    if (!query.trim()) return;
    setAsking(true);
    try {
      const res = await client.assistant(query.trim());
      setAnswer(res.answer);
      setRelated(
        res.related_leads.slice(0, 4).map((lead) => ({
          id: lead.id,
          name: lead.name,
          score: Math.round(lead.ai_score.purchase_probability * 100),
        })),
      );
    } finally {
      setAsking(false);
    }
  };

  const onKeyDown = (event: React.KeyboardEvent) => {
    if (event.key === "ArrowDown") {
      event.preventDefault();
      setActive((v) => Math.min(v + 1, Math.max(filtered.length - 1, 0)));
    } else if (event.key === "ArrowUp") {
      event.preventDefault();
      setActive((v) => Math.max(v - 1, 0));
    } else if (event.key === "Enter") {
      event.preventDefault();
      if (filtered.length > 0) {
        onRun(filtered[active]?.id ?? filtered[0].id);
      } else {
        ask().catch(() => undefined);
      }
    } else if (event.key === "Escape") {
      onClose();
    }
  };

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          className="palette-overlay"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.14 }}
          onClick={onClose}
        >
          <motion.div
            className="palette glow-card"
            initial={{ opacity: 0, scale: 0.97, y: -10 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.97, y: -10 }}
            transition={{ duration: 0.2, ease: [0.22, 1, 0.36, 1] }}
            onClick={(e) => e.stopPropagation()}
            role="dialog"
            aria-modal="true"
            aria-label="Командная палитра"
          >
            <div className="palette-input">
              <Search size={18} />
              <input
                ref={inputRef}
                value={query}
                placeholder="Перейти к разделу или спросить AI…"
                onChange={(e) => {
                  setQuery(e.target.value);
                  setActive(0);
                }}
                onKeyDown={onKeyDown}
                aria-label="Поиск команды или вопрос к AI"
              />
              <kbd>ESC</kbd>
            </div>

            <div className="palette-body">
              {filtered.length > 0 ? (
                <ul className="palette-list">
                  {filtered.map((cmd, i) => (
                    <li key={cmd.id}>
                      <button
                        type="button"
                        className={i === active ? "active" : ""}
                        onMouseEnter={() => setActive(i)}
                        onClick={() => onRun(cmd.id)}
                      >
                        <span>{cmd.label}</span>
                        {cmd.hint && <small>{cmd.hint}</small>}
                        <CornerDownLeft size={14} />
                      </button>
                    </li>
                  ))}
                </ul>
              ) : (
                <button className="palette-ask" type="button" onClick={ask} disabled={asking}>
                  <Sparkles size={16} />
                  {asking ? "AI думает…" : `Спросить AI: «${query}»`}
                </button>
              )}

              {answer && (
                <div className="palette-answer">
                  <div className="message-header">
                    <Sparkles size={15} />
                    <strong>Ответ AI</strong>
                  </div>
                  <p>{answer}</p>
                  {related.map((lead) => (
                    <button
                      className="palette-related"
                      type="button"
                      key={lead.id}
                      onClick={() => onOpenLead(lead.id)}
                    >
                      <strong>{lead.name}</strong>
                      <small>{lead.score}%</small>
                      <ArrowRight size={14} />
                    </button>
                  ))}
                </div>
              )}
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
