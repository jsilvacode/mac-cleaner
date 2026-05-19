import { useMemo, useState, type ReactNode } from "react";
import { AnimatePresence, motion } from "framer-motion";
import {
  Activity,
  AlertTriangle,
  CheckCircle2,
  ChevronRight,
  Database,
  Files,
  Gauge,
  HardDrive,
  Layers3,
  Play,
  Search,
  ShieldCheck,
  Sparkles,
  TerminalSquare,
} from "lucide-react";
import { dryRunCleaning, findLargeFiles, getTopDirs, runCleaning, scanCleanable } from "./services/cleanerApi";
import type { DryRunResponse, RiskLevel, ScanResponse } from "./types/cleaner";

const formatGb = (kb: number) => `${(kb / 1024 / 1024).toFixed(2)} GB`;

const riskMeta: Record<RiskLevel, { label: string; className: string; text: string }> = {
  bajo: { label: "Seguro", className: "risk-low", text: "Recomendado" },
  medio: { label: "Revisar", className: "risk-medium", text: "Confirmación sugerida" },
  alto: { label: "Avanzado", className: "risk-high", text: "Usar con criterio" },
};

export default function App() {
  const [scan, setScan] = useState<ScanResponse | null>(null);
  const [dryRun, setDryRun] = useState<DryRunResponse | null>(null);
  const [output, setOutput] = useState<string>("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string>("");

  const totalKb = useMemo(() => scan?.items.reduce((sum, item) => sum + item.estimated_kb, 0) ?? 0, [scan]);
  const safeItems = scan?.items.filter((item) => item.risk === "bajo").length ?? 0;
  const reviewItems = scan?.items.filter((item) => item.risk !== "bajo").length ?? 0;

  async function runAction<T>(action: () => Promise<T>, onSuccess: (data: T) => void) {
    setLoading(true);
    setError("");
    try {
      const data = await action();
      onSuccess(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="app-shell">
      <aside className="sidebar">
        <div className="brand-block">
          <div className="brand-mark"><Sparkles size={19} /></div>
          <div>
            <strong>Mac Cleaner</strong>
            <span>Secure Tauri Engine</span>
          </div>
        </div>

        <nav className="nav-stack" aria-label="Principal">
          <a className="nav-item active"><Gauge size={17} /> Overview</a>
          <a className="nav-item"><Files size={17} /> Archivos</a>
          <a className="nav-item"><Layers3 size={17} /> Historial</a>
          <a className="nav-item"><ShieldCheck size={17} /> Seguridad</a>
        </nav>

        <div className="engine-card">
          <span className="status-dot" />
          <div>
            <strong>Motor seguro activo</strong>
            <p>Whitelist, dry-run y ejecución controlada.</p>
          </div>
        </div>
      </aside>

      <section className="content-area">
        <motion.section
          className="hero-panel"
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.45, ease: "easeOut" }}
        >
          <div className="hero-copy">
            <p className="eyebrow"><Activity size={15} /> Mantenimiento premium para macOS</p>
            <h1>Limpieza segura, visual y controlada.</h1>
            <p className="lead">
              Escanea rutas permitidas, revisa candidatos antes de limpiar y conserva trazabilidad técnica sin exponer al usuario a comandos complejos.
            </p>
            <div className="hero-actions">
              <button className="primary-action" disabled={loading} onClick={() => runAction(scanCleanable, setScan)}>
                <Search size={18} /> Escanear Mac
              </button>
              <button className="secondary-action" disabled={loading || !scan} onClick={() => runAction(dryRunCleaning, setDryRun)}>
                <TerminalSquare size={18} /> Vista previa
              </button>
            </div>
          </div>

          <div className="orbital-card">
            <div className="orbital-ring" />
            <span>Recuperable estimado</span>
            <strong>{totalKb > 0 ? formatGb(totalKb) : "--"}</strong>
            <small>{scan ? `${scan.items.length} categorías analizadas` : "Ejecuta un escaneo para comenzar"}</small>
          </div>
        </motion.section>

        <section className="metrics-grid">
          <MetricCard icon={<HardDrive size={19} />} label="Espacio potencial" value={totalKb > 0 ? formatGb(totalKb) : "0.00 GB"} note="Antes de limpiar se recomienda dry-run." />
          <MetricCard icon={<CheckCircle2 size={19} />} label="Elementos seguros" value={String(safeItems)} note="Categorías de menor riesgo operativo." />
          <MetricCard icon={<AlertTriangle size={19} />} label="Requieren revisión" value={String(reviewItems)} note="Acciones medias o avanzadas." />
          <MetricCard icon={<Database size={19} />} label="Dry-run" value={dryRun ? String(dryRun.candidates.length) : "--"} note="Candidatos concretos detectados." />
        </section>

        <section className="command-strip">
          <button disabled={loading || !dryRun} className="danger-action" onClick={() => {
            const ok = window.confirm("Se ejecutará limpieza segura solo en rutas permitidas. ¿Continuar?");
            if (ok) runAction(runCleaning, (data) => setOutput(data.stdout || data.stderr));
          }}>
            <Play size={17} /> Limpiar seleccionado
          </button>
          <button disabled={loading} onClick={() => runAction(() => findLargeFiles("1G"), (data) => setOutput(data.stdout))}>Archivos &gt; 1GB</button>
          <button disabled={loading} onClick={() => runAction(getTopDirs, (data) => setOutput(data.stdout))}>Top carpetas</button>
        </section>

        <AnimatePresence>
          {error && (
            <motion.section className="error-panel" initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }}>
              {error}
            </motion.section>
          )}
        </AnimatePresence>

        <section className="section-heading">
          <div>
            <p className="eyebrow muted">Categorías</p>
            <h2>Elementos detectados</h2>
          </div>
          <span>{scan ? "Escaneo disponible" : "Sin escaneo"}</span>
        </section>

        <section className="cleaner-grid">
          <AnimatePresence mode="popLayout">
            {scan?.items.map((item, index) => {
              const meta = riskMeta[item.risk];
              return (
                <motion.article
                  className="cleaner-card"
                  key={item.id}
                  initial={{ opacity: 0, y: 14 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: 10 }}
                  transition={{ duration: 0.28, delay: index * 0.035, ease: "easeOut" }}
                >
                  <div className="card-topline">
                    <span className={`risk-pill ${meta.className}`}>{meta.label}</span>
                    <ChevronRight size={17} />
                  </div>
                  <h3>{item.label}</h3>
                  <strong>{item.estimated_human}</strong>
                  <p className="mono-path">{item.path}</p>
                  <small>{meta.text} · regla: más de {item.age_days} días</small>
                </motion.article>
              );
            })}
          </AnimatePresence>

          {!scan && (
            <div className="empty-state">
              <Sparkles size={28} />
              <h3>Escaneo pendiente</h3>
              <p>Ejecuta el primer análisis para ver espacio recuperable, riesgos y recomendaciones.</p>
            </div>
          )}
        </section>

        {dryRun && (
          <section className="glass-panel">
            <div className="panel-heading">
              <h2>Candidatos dry-run</h2>
              <span>{dryRun.candidates.length} elementos</span>
            </div>
            <div className="dryrun-table">
              {dryRun.candidates.slice(0, 80).map((candidate) => (
                <div className="dryrun-row" key={`${candidate.category}-${candidate.path}`}>
                  <span>{candidate.size_human}</span>
                  <span>{candidate.category}</span>
                  <code>{candidate.path}</code>
                </div>
              ))}
            </div>
          </section>
        )}

        {output && (
          <section className="glass-panel">
            <div className="panel-heading">
              <h2>Salida técnica</h2>
              <span>Disponible para auditoría</span>
            </div>
            <pre>{output}</pre>
          </section>
        )}
      </section>
    </main>
  );
}

function MetricCard({ icon, label, value, note }: { icon: ReactNode; label: string; value: string; note: string }) {
  return (
    <motion.article className="metric-card" whileHover={{ y: -3 }} transition={{ duration: 0.18 }}>
      <div className="metric-icon">{icon}</div>
      <span>{label}</span>
      <strong>{value}</strong>
      <p>{note}</p>
    </motion.article>
  );
}
