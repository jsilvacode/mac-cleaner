import { motion } from "framer-motion";
import { ChevronRight, Eye, EyeOff } from "lucide-react";
import type { MouseEvent } from "react";
import type { CleanCategory, RiskLevel, ScanItem } from "../types/cleaner";

type RiskMeta = { label: string; className: string; text: string };

type CleanerCardProps = {
  item: ScanItem;
  index: number;
  selected: boolean;
  riskMeta: Record<RiskLevel, RiskMeta>;
  showPath: boolean;
  onToggleCategory: (category: CleanCategory) => void;
  onTogglePath: (category: CleanCategory, event: MouseEvent<HTMLButtonElement>) => void;
};

export function CleanerCard({
  item,
  index,
  selected,
  riskMeta,
  showPath,
  onToggleCategory,
  onTogglePath,
}: CleanerCardProps) {
  const meta = riskMeta[item.risk];

  return (
    <motion.article
      className="cleaner-card"
      onClick={() => onToggleCategory(item.id)}
      onKeyDown={(event) => {
        if (event.key === "Enter" || event.key === " ") {
          event.preventDefault();
          onToggleCategory(item.id);
        }
      }}
      role="button"
      tabIndex={0}
      initial={{ opacity: 0, y: 14 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: 10 }}
      transition={{ duration: 0.28, delay: index * 0.035, ease: "easeOut" }}
      data-selected={selected}
    >
      <div className="card-topline">
        <span className={`risk-pill ${meta.className}`}>{meta.label}</span>
        <ChevronRight size={17} />
      </div>
      <h3>{item.label}</h3>
      <strong>{item.estimated_human}</strong>
      <button
        type="button"
        className="inline-link"
        onClick={(event) => onTogglePath(item.id, event)}
        aria-expanded={showPath}
      >
        {showPath ? <EyeOff size={14} /> : <Eye size={14} />}
        {showPath ? "Ocultar ruta técnica" : "Ver ruta técnica"}
      </button>
      {showPath && <p className="mono-path">{item.path}</p>}
      <small>
        {meta.text} · más de {item.age_days} días · {selected ? "incluida" : "omitida"}
      </small>
    </motion.article>
  );
}
