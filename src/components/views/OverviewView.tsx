import { motion } from "framer-motion";
import { AlertTriangle, Battery, BatteryCharging, CheckCircle2, Cpu, Database, HardDrive, MemoryStick, Search, Sparkles, Trash2 } from "lucide-react";
import type { DryRunResponse, ScanResponse, SystemMetrics } from "../../types/cleaner";
import { MetricCard } from "../common/MetricCard";

type OverviewViewProps = {
  loading: boolean;
  totalKb: number;
  scan: ScanResponse | null;
  dryRun: DryRunResponse | null;
  systemMetrics: SystemMetrics | null;
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
  systemMetrics,
  safeItems,
  confirmItems,
  onScan,
  onPrepareCleaning,
}: OverviewViewProps) {
  const preparedTrashCount = dryRun?.candidates.length ?? 0;
  const hasHighReclaimableSpace = totalKb >= 1024 * 1024;
  const cpuDisplay = systemMetrics ? `${systemMetrics.cpu_usage_percent.toFixed(1)}%` : "--%";
  const ramDisplay = systemMetrics
    ? `${systemMetrics.ram_used_gb.toFixed(1)} / ${systemMetrics.ram_total_gb.toFixed(1)} GB`
    : "-- / -- GB";
  const batteryDisplay = systemMetrics?.battery_percent !== null
    ? `${systemMetrics?.battery_percent}% ${systemMetrics?.is_charging ? "· Cargando" : "· En uso"}`
    : "No disponible";

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
              <Trash2 size={18} /> Analizar espacio
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
        <MetricCard
          icon={<HardDrive size={19} />}
          label="Basura detectada"
          value={totalKb > 0 ? formatGb(totalKb) : "0.00 GB"}
          note={hasHighReclaimableSpace ? "Hay espacio relevante para recuperar." : "Cachés, temporales, logs y Papelera."}
          tone={hasHighReclaimableSpace ? "signal" : "default"}
        />
        <MetricCard icon={<CheckCircle2 size={19} />} label="Bajo riesgo" value={String(safeItems)} note="Categorías listas para limpiar." />
        <MetricCard icon={<AlertTriangle size={19} />} label="Con confirmación" value={String(confirmItems)} note="Se limpian después de confirmar." />
        <MetricCard icon={<Database size={19} />} label="Preparados" value={String(preparedTrashCount)} note={dryRun ? "Archivos basura listos." : "Prepara la limpieza."} />
        <MetricCard icon={<Cpu size={19} />} label="CPU" value={cpuDisplay} note="Uso global del sistema en tiempo real." />
        <MetricCard icon={<MemoryStick size={19} />} label="RAM" value={ramDisplay} note="Memoria utilizada sobre el total disponible." />
        <MetricCard
          icon={systemMetrics?.is_charging ? <BatteryCharging size={19} /> : <Battery size={19} />}
          label="Batería"
          value={batteryDisplay}
          note="Estado de energía del equipo."
        />
      </section>
    </>
  );
}
