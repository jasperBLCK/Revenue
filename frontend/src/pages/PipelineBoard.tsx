import { useMemo, useState } from "react";
import { motion } from "framer-motion";
import type { ApiClient } from "../api/client";
import type { LeadStatus } from "../api/types";
import { cn } from "../lib/ui";
import { formatUsd, initials, PIPELINE_STATUSES, STATUS_LABEL, type Lead } from "../lib/leads";

const COLUMN_TONE: Record<string, string> = {
  new: "ghost",
  contacted: "follow",
  qualified: "follow",
  proposal: "hot",
  negotiation: "hot",
  won: "won",
  lost: "lost",
};

export function PipelineBoard({
  leads,
  client,
  onChanged,
  onOpenLead,
}: {
  leads: Lead[];
  client: ApiClient;
  onChanged: () => void;
  onOpenLead: (lead: Lead) => void;
}) {
  const [dragId, setDragId] = useState<string | null>(null);
  const [overStatus, setOverStatus] = useState<string | null>(null);
  const [pending, setPending] = useState<string | null>(null);

  const byStatus = useMemo(() => {
    const map: Record<string, Lead[]> = {};
    for (const status of PIPELINE_STATUSES) map[status] = [];
    for (const lead of leads) (map[lead.status] ??= []).push(lead);
    return map;
  }, [leads]);

  const drop = async (status: LeadStatus) => {
    const id = dragId;
    setDragId(null);
    setOverStatus(null);
    if (!id) return;
    const lead = leads.find((item) => item.id === id);
    if (!lead || lead.status === status) return;
    setPending(id);
    try {
      await client.updateLead(id, { status });
      onChanged();
    } finally {
      setPending(null);
    }
  };

  return (
    <div className="pipeline-board">
      {PIPELINE_STATUSES.map((status) => {
        const items = byStatus[status] ?? [];
        const sum = items.reduce((acc, lead) => acc + lead.valueNum, 0);
        return (
          <div
            key={status}
            className={cn("pipeline-column", overStatus === status && "drag-over")}
            onDragOver={(event) => {
              event.preventDefault();
              setOverStatus(status);
            }}
            onDragLeave={() => setOverStatus((cur) => (cur === status ? null : cur))}
            onDrop={() => drop(status)}
          >
            <div className={cn("pipeline-head", COLUMN_TONE[status])}>
              <div>
                <strong>{STATUS_LABEL[status]}</strong>
                <span>{items.length} · {formatUsd(sum)}</span>
              </div>
            </div>
            <div className="pipeline-cards">
              {items.length === 0 && <p className="pipeline-empty">Перетащите лид сюда</p>}
              {items.map((lead) => (
                <motion.div
                  key={lead.id}
                  layout
                  className={cn("pipeline-card", pending === lead.id && "pending")}
                  draggable
                  onDragStart={() => setDragId(lead.id)}
                  onDragEnd={() => setDragId(null)}
                  onClick={() => onOpenLead(lead)}
                  whileHover={{ y: -2 }}
                >
                  <div className="pipeline-card-top">
                    <span className={cn("lead-avatar", lead.state)}>{initials(lead.name)}</span>
                    <strong>{lead.name}</strong>
                  </div>
                  <div className="pipeline-card-meta">
                    <span className="pipeline-card-value">{lead.value}</span>
                    <span className={cn("pipeline-card-score", lead.state)}>{lead.score}%</span>
                  </div>
                </motion.div>
              ))}
            </div>
          </div>
        );
      })}
    </div>
  );
}
