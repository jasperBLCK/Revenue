import { useMemo, useState } from "react";
import { motion } from "framer-motion";
import { ArrowUpDown, Check, MessagesSquare, Search, SlidersHorizontal, Trash2 } from "lucide-react";
import type { ApiClient } from "../api/client";
import { cn } from "../lib/ui";
import { initials, STATUS_LABEL, type Lead } from "../lib/leads";

type SortKey = "score_desc" | "score_asc" | "risk_desc" | "value_desc";

const STATUS_OPTIONS: Array<{ value: string; label: string }> = [
  { value: "all", label: "Все статусы" },
  { value: "new", label: STATUS_LABEL.new },
  { value: "contacted", label: STATUS_LABEL.contacted },
  { value: "qualified", label: STATUS_LABEL.qualified },
  { value: "proposal", label: STATUS_LABEL.proposal },
  { value: "negotiation", label: STATUS_LABEL.negotiation },
  { value: "won", label: STATUS_LABEL.won },
  { value: "lost", label: STATUS_LABEL.lost },
];

const PAGE_SIZE = 8;

export function LeadsTable({
  leads,
  onOpenLead,
  onOpenConversation,
  client,
}: {
  leads: Lead[];
  onOpenLead: (lead: Lead) => void;
  onOpenConversation: (lead: Lead) => void;
  client?: ApiClient;
}) {
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [sort, setSort] = useState<SortKey>("score_desc");
  const [page, setPage] = useState(1);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [batchLoading, setBatchLoading] = useState(false);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    const rows = leads.filter((lead) => {
      const matchesSearch =
        !q ||
        lead.name.toLowerCase().includes(q) ||
        lead.person.toLowerCase().includes(q);
      const matchesStatus = statusFilter === "all" || lead.status === statusFilter;
      return matchesSearch && matchesStatus;
    });
    const sorted = [...rows].sort((a, b) => {
      if (sort === "score_asc") return a.score - b.score;
      if (sort === "risk_desc") return b.risk - a.risk;
      if (sort === "value_desc") return b.valueNum - a.valueNum;
      return b.score - a.score;
    });
    return sorted;
  }, [leads, search, statusFilter, sort]);

  const pageCount = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const safePage = Math.min(page, pageCount);
  const rows = filtered.slice((safePage - 1) * PAGE_SIZE, safePage * PAGE_SIZE);

  const resetPage = () => setPage(1);

  const toggleSelect = (id: string) => {
    const newSet = new Set(selectedIds);
    if (newSet.has(id)) {
      newSet.delete(id);
    } else {
      newSet.add(id);
    }
    setSelectedIds(newSet);
  };

  const toggleSelectAll = () => {
    if (selectedIds.size === rows.length) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(rows.map((r) => r.id)));
    }
  };

  const handleBulkStatus = async (status: string) => {
    if (!client || selectedIds.size === 0) return;
    setBatchLoading(true);
    try {
      await client.batchUpdateStatus(Array.from(selectedIds), status);
      setSelectedIds(new Set());
    } finally {
      setBatchLoading(false);
    }
  };

  return (
    <div className="leads-page">
      <section className="panel leads-toolbar">
        <div className="search-field">
          <Search size={16} />
          <input
            value={search}
            placeholder="Поиск по имени или @username…"
            onChange={(event) => {
              setSearch(event.target.value);
              resetPage();
            }}
          />
        </div>
        <div className="leads-filter">
          <SlidersHorizontal size={15} />
          <select
            value={statusFilter}
            onChange={(event) => {
              setStatusFilter(event.target.value);
              resetPage();
            }}
          >
            {STATUS_OPTIONS.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </div>
        <div className="leads-filter">
          <ArrowUpDown size={15} />
          <select value={sort} onChange={(event) => setSort(event.target.value as SortKey)}>
            <option value="score_desc">Сначала горячие</option>
            <option value="score_asc">Сначала холодные</option>
            <option value="risk_desc">Высокий риск ухода</option>
            <option value="value_desc">Крупные сделки</option>
          </select>
        </div>
        <span className="leads-total">{filtered.length} лидов</span>
      </section>

      {selectedIds.size > 0 && (
        <section className="panel" style={{ padding: "12px 16px", backgroundColor: "#f0f7ff" }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
            <span style={{ fontSize: "13px", fontWeight: "500" }}>
              Выбрано: {selectedIds.size} лидов
            </span>
            <div style={{ display: "flex", gap: "8px", alignItems: "center" }}>
              <button
                className="text-button"
                type="button"
                onClick={() => handleBulkStatus("won")}
                disabled={batchLoading}
              >
                <Check size={14} />
                Отметить как Won
              </button>
              <button
                className="text-button"
                type="button"
                onClick={() => handleBulkStatus("lost")}
                disabled={batchLoading}
              >
                <Trash2 size={14} />
                Отметить как Lost
              </button>
              <button
                className="text-button"
                type="button"
                onClick={() => setSelectedIds(new Set())}
              >
                Отменить
              </button>
            </div>
          </div>
        </section>
      )}

      <section className="panel leads-table-wrap">
        <div className="leads-table-head">
          {client && (
            <input
              type="checkbox"
              checked={selectedIds.size === rows.length && rows.length > 0}
              onChange={toggleSelectAll}
              style={{ width: "16px", height: "16px", cursor: "pointer" }}
              title="Выбрать всех на странице"
            />
          )}
          <span>Клиент</span>
          <span>Статус</span>
          <span>AI score</span>
          <span>Риск</span>
          <span>Сделка</span>
          <span>Активность</span>
          <span />
        </div>

        {rows.length === 0 && <p className="lead-empty">Ничего не найдено по фильтрам.</p>}

        {rows.map((lead, index) => (
          <motion.div
            key={lead.id}
            className="leads-row"
            initial={{ opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.16, delay: index * 0.02 }}
            style={{ backgroundColor: selectedIds.has(lead.id) ? "#f0f7ff" : "transparent" }}
          >
            {client && (
              <div style={{ padding: "0 12px", display: "flex", alignItems: "center" }}>
                <input
                  type="checkbox"
                  checked={selectedIds.has(lead.id)}
                  onChange={() => toggleSelect(lead.id)}
                  style={{ width: "16px", height: "16px", cursor: "pointer" }}
                />
              </div>
            )}
            <div className="leads-cell client">
              <span className={cn("lead-avatar", lead.state)}>{initials(lead.name)}</span>
              <div>
                <strong>{lead.name}</strong>
                <span>{lead.person} · {lead.channel}</span>
              </div>
            </div>
            <span className={cn("status-tag", lead.status)}>{STATUS_LABEL[lead.status] ?? lead.status}</span>
            <div className="leads-cell score">
              <div className="mini-bar">
                <span style={{ width: `${lead.score}%` }} className={cn("mini-bar-fill", lead.state)} />
              </div>
              <strong>{lead.score}%</strong>
            </div>
            <span className={cn("risk-value", lead.risk >= 60 && "high")}>{lead.risk}%</span>
            <strong className="leads-value">{lead.value}</strong>
            <span className="leads-activity">{lead.lastReply}</span>
            <div className="leads-actions">
              <button type="button" className="row-button" onClick={() => onOpenLead(lead)}>
                Карточка
              </button>
              <button
                type="button"
                className="row-icon"
                title="Открыть переписку"
                onClick={() => onOpenConversation(lead)}
              >
                <MessagesSquare size={15} />
              </button>
            </div>
          </motion.div>
        ))}

        {pageCount > 1 && (
          <div className="leads-pager">
            <button type="button" disabled={safePage === 1} onClick={() => setPage(safePage - 1)}>
              Назад
            </button>
            <span>
              Стр. {safePage} из {pageCount}
            </span>
            <button type="button" disabled={safePage === pageCount} onClick={() => setPage(safePage + 1)}>
              Вперёд
            </button>
          </div>
        )}
      </section>
    </div>
  );
}
