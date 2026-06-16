import { AnimatePresence, motion } from "framer-motion";
import { Flame, MessageSquareText, Radar, TriangleAlert } from "lucide-react";
import type { Bucket } from "../api/types";

export interface ToastItem {
  id: string;
  bucket: Bucket | null;
  title: string;
  detail: string;
}

const toneByBucket: Record<string, { tone: string; icon: typeof Flame; label: string }> = {
  hot: { tone: "hot", icon: Flame, label: "Горячий лид" },
  at_risk: { tone: "warning", icon: TriangleAlert, label: "Риск ухода" },
  ghost: { tone: "ghost", icon: Radar, label: "Спящий лид" },
  follow_up: { tone: "info", icon: MessageSquareText, label: "Нужно дожать" },
};

export function LiveToastStack({ toasts }: { toasts: ToastItem[] }) {
  return (
    <div className="toast-stack">
      <AnimatePresence>
        {toasts.map((toast) => {
          const cfg = toneByBucket[toast.bucket ?? "follow_up"] ?? toneByBucket.follow_up;
          const Icon = cfg.icon;
          return (
            <motion.div
              key={toast.id}
              className={`live-toast ${cfg.tone}`}
              initial={{ opacity: 0, x: 40, scale: 0.96 }}
              animate={{ opacity: 1, x: 0, scale: 1 }}
              exit={{ opacity: 0, x: 40, scale: 0.96 }}
              transition={{ duration: 0.22, ease: [0.22, 1, 0.36, 1] }}
            >
              <span className="toast-icon">
                <Icon size={18} />
              </span>
              <div className="toast-copy">
                <strong>{toast.title}</strong>
                <span>{toast.detail}</span>
              </div>
            </motion.div>
          );
        })}
      </AnimatePresence>
    </div>
  );
}
