import { motion } from "framer-motion";
import type { ReactNode } from "react";

type MetricCardProps = {
  icon: ReactNode;
  label: string;
  value: string;
  note: string;
  tone?: "default" | "signal";
};

export function MetricCard({ icon, label, value, note, tone = "default" }: MetricCardProps) {
  const isSignal = tone === "signal";
  return (
    <motion.article className={`metric-card${isSignal ? " metric-card-signal" : ""}`} whileHover={{ y: -3 }} transition={{ duration: 0.18 }}>
      <div className={`metric-icon${isSignal ? " metric-icon-signal" : ""}`}>{icon}</div>
      <span>{label}</span>
      <strong>{value}</strong>
      <p>{note}</p>
    </motion.article>
  );
}
