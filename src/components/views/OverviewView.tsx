import { motion } from "framer-motion";
import { AlertTriangle, CheckCircle2, Database, HardDrive, Search, Sparkles, Trash2 } from "lucide-react";
import type { DryRunResponse, ScanResponse } from "../../types/cleaner";
import { MetricCard } from "../common/MetricCard";

type OverviewViewProps = {
  loading: boolean;
  totalKb: number;
  scan: ScanResponse | null;
  dryRun: DryRunResponse | null;
  safeItems: number;
  confirmItems: number;
  onScan: () => void;
  onPrepareCleaning: () => void;
};

const formatGb = (kb: number) => `${(kb / 1024 / 1024).toFixed(2)} GB`;

export function OverviewView({
  loading,
  totalKb,
  scan,
  dryRun,
  safeItems,
  confirmItems,
  onScan,
  onPrepareCleaning,
}: OverviewViewProps) {
  const preparedTrashCount = dryRun?.candidates.length ?? 0;

  return (
    <>
      <motion.section
        className="hero-panel"
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.45, ease: "easeOut" }}
      >
        <div className="hero-copy">
          <p className="eyebrow"><Sparkles size={15} /> Limpieza profunda para macOS</p>
          <h1>Limpia basura técnica y recupera espacio.</h1>
          <p className="lead">
            Escanea cachés, temporales, logs y Papelera. Limpia lo que sobra y conserva el control cuando algo pueda afectar tus datos.
          </p>
          <div className="hero-actions">
            <button className="primary-action" disabled={loading} onClick={onScan}>
              <Search size={18} /> Escanear basura
            </button>
            <button className="secondary-action" disabled={loading || !scan} onClick={onPrepareCleaning}>
              <Trash2 size={18} /> Preparar limpieza
            </button>
          </div>
        </div>

        <div className="orbital-card">
          <div className="orbital-ring" />
          <span>Basura detectada</span>
          <strong>{totalKb > 0 ? formatGb(totalKb) : "--"}</strong>
          <small>{scan ? `${scan.items.length} categorías detectadas` : "Escaneando este Mac"}</small>
        </div>
      </motion.section>

      <section className="metrics-grid">
        <MetricCard icon={<HardDrive size={19} />} label="Basura detectada" value={totalKb > 0 ? formatGb(totalKb) : "0.00 GB"} note="Cachés, temporales, logs y Papelera." />
        <MetricCard icon={<CheckCircle2 size={19} />} label="Bajo riesgo" value={String(safeItems)} note="Categorías listas para limpiar." />
        <MetricCard icon={<AlertTriangle size={19} />} label="Con confirmación" value={String(confirmItems)} note="Se limpian después de confirmar." />
        <MetricCard icon={<Database size={19} />} label="Preparados" value={String(preparedTrashCount)} note={dryRun ? "Archivos basura listos." : "Prepara la limpieza."} />
      </section>
    </>
  );
}
