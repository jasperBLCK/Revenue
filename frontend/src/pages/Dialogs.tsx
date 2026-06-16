import { useMemo, useState } from "react";
import { motion } from "framer-motion";
import { MessagesSquare, Search, SendHorizonal } from "lucide-react";
import { cn } from "../lib/ui";
import { initials, type Lead } from "../lib/leads";

export function Dialogs({
  leads,
  onOpenConversation,
}: {
  leads: Lead[];
  onOpenConversation: (lead: Lead) => void;
}) {
  const [search, setSearch] = useState("");

  const rows = useMemo(() => {
    const q = search.trim().toLowerCase();
    return leads.filter(
      (lead) =>
        !q ||
        lead.name.toLowerCase().includes(q) ||
        lead.person.toLowerCase().includes(q),
    );
  }, [leads, search]);

  return (
    <div className="dialogs-page">
      <section className="panel dialogs-toolbar">
        <div className="search-field">
          <Search size={16} />
          <input
            value={search}
            placeholder="Поиск по имени или @username…"
            onChange={(event) => setSearch(event.target.value)}
          />
        </div>
        <span className="leads-total">{leads.length} диалогов</span>
      </section>

      <section className="panel dialogs-list">
        {rows.length === 0 && (
          <p className="lead-empty">
            Пока нет активных диалогов. Как только клиент напишет боту, переписка появится здесь.
          </p>
        )}

        {rows.map((lead, index) => (
          <motion.button
            key={lead.id}
            type="button"
            className="dialog-card"
            onClick={() => onOpenConversation(lead)}
            initial={{ opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.16, delay: index * 0.02 }}
          >
            <span className={cn("lead-avatar", lead.state)}>{initials(lead.name)}</span>
            <div className="dialog-main">
              <strong>{lead.name}</strong>
              <span>
                {lead.person} · {lead.channel}
              </span>
            </div>
            <div className="dialog-meta">
              <span className="dialog-time">{lead.lastReply}</span>
              <span className="dialog-open">
                <SendHorizonal size={14} /> Ответить
              </span>
            </div>
            <span className="dialog-icon">
              <MessagesSquare size={18} />
            </span>
          </motion.button>
        ))}
      </section>
    </div>
  );
}
