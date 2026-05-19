import { useEffect, useMemo, useState, type ReactNode } from "react";
import { AnimatePresence, motion } from "framer-motion";
import {
  Activity,
  AlertTriangle,
  CheckCircle2,
  ChevronRight,
  Database,
  Download,
  Files,
  Gauge,
  HardDrive,
  History,
  Play,
  Search,
  Settings,
  ShieldCheck,
  Sparkles,
  TerminalSquare,
} from "lucide-react";
import {
  applyCleanHistoryRetention,
  dryRunCleaning,
  exportCleanHistoryReport,
  findLargeFiles,
  getCleanHistory,
  getTopDirs,
  runCleaning,
  scanCleanable,
} from "./services/cleanerApi";
import type {
  CleanCategory,
  CleanHistoryEntry,
  CleaningPreferences,
  DryRunResponse,
  LargeFilesThreshold,
  RiskLevel,
  ScanResponse,
} from "./types/cleaner";

const formatGb = (kb: number) => `${(kb / 1024 / 1024).toFixed(2)} GB`;
const PREFERENCES_KEY = "mac_cleaner_preferences_v2";

const allCategories: Array<{ id: CleanCategory; label: string }> = [
  { id: "user_cache", label: "Caché de usuario" },
  { id: "user_logs", label: "Logs de usuario" },
  { id: "trash", label: "Papelera" },
  { id: "tmp", label: "Temporales /tmp" },
];

const allowedThresholds: LargeFilesThreshold[] = ["500M", "1G", "2G", "5G"];

const defaultPreferences: CleaningPreferences = {
  defaultCategories: ["user_cache", "user_logs", "trash", "tmp"],
  largeFilesThreshold: "1G",
  historyRetentionDays: 30,
  historyExportLimit: 30,
};

const riskMeta: Record<RiskLevel, { label: string; className: string; text: string }> = {
  bajo: { label: "Seguro", className: "risk-low", text: "Recomendado" },
  medio: { label: "Revisar", className: "risk-medium", text: "Confirmación sugerida" },
  alto: { label: "Avanzado", className: "risk-high", text: "Usar con criterio" },
};

type AppView = "overview" | "files" | "history" | "settings";
type HistoryStatusFilter = "all" | "ok" | "partial" | "running" | "incomplete";
type HistorySort = "date_desc" | "date_asc" | "reclaimed_desc" | "errors_desc";

function clampNumber(value: number, min: number, max: number): number {
  if (!Number.isFinite(value)) {
    return min;
  }
  return Math.min(max, Math.max(min, Math.trunc(value)));
}

function epochToLocalDateKey(epochSecs: number): string {
  const date = new Date(epochSecs * 1000);
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function loadPreferences(): CleaningPreferences {
  try {
    const raw = window.localStorage.getItem(PREFERENCES_KEY);
    if (!raw) {
      return defaultPreferences;
    }
    const parsed = JSON.parse(raw) as Partial<CleaningPreferences>;
    const largeFilesThreshold = allowedThresholds.includes(parsed.largeFilesThreshold as LargeFilesThreshold)
      ? (parsed.largeFilesThreshold as LargeFilesThreshold)
      : defaultPreferences.largeFilesThreshold;

    const defaultCategories = Array.isArray(parsed.defaultCategories)
      ? parsed.defaultCategories.filter((item): item is CleanCategory =>
        allCategories.some((category) => category.id === item),
      )
      : defaultPreferences.defaultCategories;

    const historyRetentionDays = clampNumber(parsed.historyRetentionDays ?? defaultPreferences.historyRetentionDays, 1, 3650);
    const historyExportLimit = clampNumber(parsed.historyExportLimit ?? defaultPreferences.historyExportLimit, 5, 200);

    return {
      defaultCategories: defaultCategories.length > 0 ? defaultCategories : defaultPreferences.defaultCategories,
      largeFilesThreshold,
      historyRetentionDays,
      historyExportLimit,
    };
  } catch {
    return defaultPreferences;
  }
}

function formatEpoch(epoch: number | null): string {
  if (!epoch) {
    return "Ejecución incompleta";
  }
  return new Date(epoch * 1000).toLocaleString();
}

export default function App() {
  const [view, setView] = useState<AppView>("overview");
  const [scan, setScan] = useState<ScanResponse | null>(null);
  const [dryRun, setDryRun] = useState<DryRunResponse | null>(null);
  const [selectedCategories, setSelectedCategories] = useState<CleanCategory[]>([]);
  const [historyItems, setHistoryItems] = useState<CleanHistoryEntry[]>([]);
  const [historyLoaded, setHistoryLoaded] = useState(false);
  const [historyStatusFilter, setHistoryStatusFilter] = useState<HistoryStatusFilter>("all");
  const [historyCategoryFilter, setHistoryCategoryFilter] = useState<"all" | CleanCategory>("all");
  const [historyFromDate, setHistoryFromDate] = useState<string>("");
  const [historyToDate, setHistoryToDate] = useState<string>("");
  const [historySort, setHistorySort] = useState<HistorySort>("date_desc");
  const [preferences, setPreferences] = useState<CleaningPreferences>(() => loadPreferences());
  const [output, setOutput] = useState<string>("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string>("");

  useEffect(() => {
    window.localStorage.setItem(PREFERENCES_KEY, JSON.stringify(preferences));
  }, [preferences]);

  useEffect(() => {
    if (view === "history" && !historyLoaded) {
      void loadHistory();
    }
  }, [view, historyLoaded]);

  const totalKb = useMemo(() => scan?.items.reduce((sum, item) => sum + item.estimated_kb, 0) ?? 0, [scan]);
  const safeItems = scan?.items.filter((item) => item.risk === "bajo").length ?? 0;
  const reviewItems = scan?.items.filter((item) => item.risk !== "bajo").length ?? 0;

  const filteredHistoryItems = useMemo(() => {
    const byDateRange = historyItems.filter((entry) => {
      const dateKey = epochToLocalDateKey(entry.started_at_epoch_secs);
      if (historyFromDate && dateKey < historyFromDate) {
        return false;
      }
      if (historyToDate && dateKey > historyToDate) {
        return false;
      }
      return true;
    });

    const byStatus = byDateRange.filter((entry) => {
      if (historyStatusFilter === "all") {
        return true;
      }
      return entry.status === historyStatusFilter;
    });

    const byCategory = byStatus.filter((entry) => {
      if (historyCategoryFilter === "all") {
        return true;
      }
      return entry.selected_categories.includes(historyCategoryFilter);
    });

    const sorted = [...byCategory];
    sorted.sort((a, b) => {
      if (historySort === "date_asc") {
        return a.started_at_epoch_secs - b.started_at_epoch_secs;
      }
      if (historySort === "reclaimed_desc") {
        return b.reclaimed_total_kb - a.reclaimed_total_kb;
      }
      if (historySort === "errors_desc") {
        return b.error_count - a.error_count;
      }
      return b.started_at_epoch_secs - a.started_at_epoch_secs;
    });

    return sorted;
  }, [historyItems, historyStatusFilter, historyCategoryFilter, historyFromDate, historyToDate, historySort]);

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

  async function loadHistory() {
    await runAction(() => getCleanHistory(200), (data) => {
      setHistoryItems(data);
      setHistoryLoaded(true);
    });
  }

  function toggleCategory(category: CleanCategory) {
    setSelectedCategories((current) => {
      const next = current.includes(category) ? current.filter((item) => item !== category) : [...current, category];
      return next;
    });
    setDryRun(null);
  }

  function toggleDefaultCategory(category: CleanCategory) {
    setPreferences((current) => {
      const isSelected = current.defaultCategories.includes(category);
      const next = isSelected
        ? current.defaultCategories.filter((item) => item !== category)
        : [...current.defaultCategories, category];
      return {
        ...current,
        defaultCategories: next.length > 0 ? next : current.defaultCategories,
      };
    });
  }

  function applyDefaultSelectionToCurrentScan() {
    if (!scan) {
      return;
    }
    const available = scan.items.map((item) => item.id);
    const preferred = available.filter((category) => preferences.defaultCategories.includes(category));
    setSelectedCategories(preferred.length > 0 ? preferred : available);
    setDryRun(null);
  }

  function applyScanResult(data: ScanResponse) {
    setScan(data);
    setDryRun(null);
    setOutput("");
    const available = data.items.map((item) => item.id);
    const preferred = available.filter((category) => preferences.defaultCategories.includes(category));
    setSelectedCategories(preferred.length > 0 ? preferred : available);
  }

  function runDryRunForSelection() {
    if (selectedCategories.length === 0) {
      setError("Selecciona al menos una categoría para vista previa.");
      return;
    }
    runAction(() => dryRunCleaning(selectedCategories), setDryRun);
  }

  function runNativeCleaning() {
    if (selectedCategories.length === 0) {
      setError("Selecciona al menos una categoría antes de limpiar.");
      return;
    }

    const ok = window.confirm("Se ejecutará limpieza segura solo en rutas permitidas. ¿Continuar?");
    if (!ok) {
      return;
    }

    runAction(() => runCleaning(selectedCategories), (data) => {
      setOutput(data.stdout || data.stderr);
      setHistoryLoaded(false);
    });
  }

  function exportHistoryReport() {
    runAction(() => exportCleanHistoryReport(preferences.historyExportLimit), (data) => {
      setOutput(`Reporte exportado: ${data.report_path} (runs: ${data.exported_runs})`);
    });
  }

  function applyHistoryRetentionNow() {
    runAction(() => applyCleanHistoryRetention(preferences.historyRetentionDays), (data) => {
      setOutput(`Retención aplicada: ${data.removed_runs} corridas eliminadas, ${data.kept_runs} conservadas.`);
      setHistoryLoaded(false);
    });
  }

  function resetHistoryFilters() {
    setHistoryStatusFilter("all");
    setHistoryCategoryFilter("all");
    setHistoryFromDate("");
    setHistoryToDate("");
    setHistorySort("date_desc");
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
          <a className={`nav-item ${view === "overview" ? "active" : ""}`} onClick={() => setView("overview")}>
            <Gauge size={17} /> Overview
          </a>
          <a className={`nav-item ${view === "files" ? "active" : ""}`} onClick={() => setView("files")}>
            <Files size={17} /> Archivos
          </a>
          <a className={`nav-item ${view === "history" ? "active" : ""}`} onClick={() => setView("history")}>
            <History size={17} /> Historial
          </a>
          <a className={`nav-item ${view === "settings" ? "active" : ""}`} onClick={() => setView("settings")}>
            <Settings size={17} /> Ajustes
          </a>
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
              <button className="primary-action" disabled={loading} onClick={() => runAction(scanCleanable, applyScanResult)}>
                <Search size={18} /> Escanear Mac
              </button>
              <button className="secondary-action" disabled={loading || !scan} onClick={runDryRunForSelection}>
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
          <MetricCard icon={<Database size={19} />} label="Selección activa" value={String(selectedCategories.length)} note={dryRun ? `${dryRun.candidates.length} candidatos en dry-run.` : "Define categorías antes de limpiar."} />
        </section>

        <AnimatePresence>
          {error && (
            <motion.section className="error-panel" initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }}>
              {error}
            </motion.section>
          )}
        </AnimatePresence>

        {view === "overview" && (
          <>
            <section className="command-strip">
              <button disabled={loading || !dryRun} className="danger-action" onClick={runNativeCleaning}>
                <Play size={17} /> Limpiar {selectedCategories.length > 0 ? `(${selectedCategories.length})` : ""}
              </button>
            </section>

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
                      onClick={() => toggleCategory(item.id)}
                      key={item.id}
                      initial={{ opacity: 0, y: 14 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: 10 }}
                      transition={{ duration: 0.28, delay: index * 0.035, ease: "easeOut" }}
                      data-selected={selectedCategories.includes(item.id)}
                    >
                      <div className="card-topline">
                        <span className={`risk-pill ${meta.className}`}>{meta.label}</span>
                        <ChevronRight size={17} />
                      </div>
                      <h3>{item.label}</h3>
                      <strong>{item.estimated_human}</strong>
                      <p className="mono-path">{item.path}</p>
                      <small>
                        {meta.text} · regla: más de {item.age_days} días · {selectedCategories.includes(item.id) ? "seleccionada" : "omitida"}
                      </small>
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
          </>
        )}

        {view === "files" && (
          <>
            <section className="section-heading">
              <div>
                <p className="eyebrow muted">Análisis</p>
                <h2>Archivos y carpetas</h2>
              </div>
              <span>Sin borrado, solo diagnóstico</span>
            </section>

            <section className="command-strip">
              <button disabled={loading} onClick={() => runAction(() => findLargeFiles(preferences.largeFilesThreshold), (data) => setOutput(data.stdout))}>
                Archivos &gt; {preferences.largeFilesThreshold}
              </button>
              <button disabled={loading} onClick={() => runAction(getTopDirs, (data) => setOutput(data.stdout))}>
                Top carpetas
              </button>
            </section>
          </>
        )}

        {view === "history" && (
          <>
            <section className="section-heading">
              <div>
                <p className="eyebrow muted">Trazabilidad</p>
                <h2>Historial local</h2>
              </div>
              <span>{filteredHistoryItems.length} de {historyItems.length} ejecuciones</span>
            </section>

            <section className="glass-panel history-filters-panel">
              <div className="panel-heading">
                <h2>Filtros</h2>
                <span>Orden y rango</span>
              </div>
              <div className="history-filters-grid">
                <label className="settings-field" htmlFor="historyStatusFilter">
                  <span>Estado</span>
                  <select id="historyStatusFilter" value={historyStatusFilter} onChange={(event) => setHistoryStatusFilter(event.target.value as HistoryStatusFilter)}>
                    <option value="all">Todos</option>
                    <option value="ok">OK</option>
                    <option value="partial">Parcial</option>
                    <option value="running">Running</option>
                    <option value="incomplete">Incompleto</option>
                  </select>
                </label>

                <label className="settings-field" htmlFor="historyCategoryFilter">
                  <span>Categoría</span>
                  <select id="historyCategoryFilter" value={historyCategoryFilter} onChange={(event) => setHistoryCategoryFilter(event.target.value as "all" | CleanCategory)}>
                    <option value="all">Todas</option>
                    {allCategories.map((category) => (
                      <option value={category.id} key={category.id}>{category.label}</option>
                    ))}
                  </select>
                </label>

                <label className="settings-field" htmlFor="historyFromDate">
                  <span>Desde</span>
                  <input id="historyFromDate" type="date" value={historyFromDate} onChange={(event) => setHistoryFromDate(event.target.value)} />
                </label>

                <label className="settings-field" htmlFor="historyToDate">
                  <span>Hasta</span>
                  <input id="historyToDate" type="date" value={historyToDate} onChange={(event) => setHistoryToDate(event.target.value)} />
                </label>

                <label className="settings-field" htmlFor="historySort">
                  <span>Orden</span>
                  <select id="historySort" value={historySort} onChange={(event) => setHistorySort(event.target.value as HistorySort)}>
                    <option value="date_desc">Más recientes</option>
                    <option value="date_asc">Más antiguas</option>
                    <option value="reclaimed_desc">Más espacio recuperado</option>
                    <option value="errors_desc">Más errores/omitidos</option>
                  </select>
                </label>
              </div>

              <div className="command-strip">
                <button disabled={loading} onClick={() => void loadHistory()}>
                  <History size={17} /> Recargar historial
                </button>
                <button disabled={loading} onClick={exportHistoryReport}>
                  <Download size={17} /> Exportar reporte
                </button>
                <button disabled={loading} onClick={resetHistoryFilters}>
                  Limpiar filtros
                </button>
              </div>
            </section>

            <section className="cleaner-grid history-grid">
              {filteredHistoryItems.map((entry) => (
                <article className="cleaner-card" key={entry.run_id} data-selected={false}>
                  <div className="card-topline">
                    <span className={`risk-pill ${entry.status === "ok" ? "risk-low" : "risk-medium"}`}>
                      {entry.status === "ok" ? "OK" : entry.status}
                    </span>
                    <span>{entry.reclaimed_total_human}</span>
                  </div>
                  <h3>{formatEpoch(entry.started_at_epoch_secs)}</h3>
                  <p className="mono-path">{entry.log_file}</p>
                  <small>
                    {entry.deleted_count} eliminados · {entry.error_count} omitidos/error · {entry.candidate_count} candidatos
                  </small>
                </article>
              ))}

              {filteredHistoryItems.length === 0 && (
                <div className="empty-state">
                  <History size={28} />
                  <h3>Sin resultados en historial</h3>
                  <p>Ajusta los filtros o ejecuta una limpieza nativa para registrar nuevas corridas.</p>
                </div>
              )}
            </section>
          </>
        )}

        {view === "settings" && (
          <>
            <section className="section-heading">
              <div>
                <p className="eyebrow muted">Preferencias</p>
                <h2>Limpieza por defecto</h2>
              </div>
              <span>Guardado local</span>
            </section>

            <section className="glass-panel">
              <div className="panel-heading">
                <h2>Configuración rápida</h2>
                <span>Fase 4</span>
              </div>
              <div className="settings-grid">
                <label className="settings-field" htmlFor="threshold">
                  <span>Umbral para "Archivos grandes"</span>
                  <select
                    id="threshold"
                    value={preferences.largeFilesThreshold}
                    onChange={(event) => {
                      setPreferences((current) => ({
                        ...current,
                        largeFilesThreshold: event.target.value as LargeFilesThreshold,
                      }));
                    }}
                  >
                    {allowedThresholds.map((threshold) => (
                      <option value={threshold} key={threshold}>{threshold}</option>
                    ))}
                  </select>
                </label>

                <div className="settings-field">
                  <span>Categorías por defecto para escaneo</span>
                  <div className="prefs-categories">
                    {allCategories.map((category) => (
                      <label key={category.id}>
                        <input
                          type="checkbox"
                          checked={preferences.defaultCategories.includes(category.id)}
                          onChange={() => toggleDefaultCategory(category.id)}
                        />
                        {category.label}
                      </label>
                    ))}
                  </div>
                </div>

                <label className="settings-field" htmlFor="historyRetentionDays">
                  <span>Retención de logs (días)</span>
                  <input
                    id="historyRetentionDays"
                    type="number"
                    min={1}
                    max={3650}
                    value={preferences.historyRetentionDays}
                    onChange={(event) => {
                      const parsed = Number(event.target.value);
                      setPreferences((current) => ({
                        ...current,
                        historyRetentionDays: clampNumber(parsed, 1, 3650),
                      }));
                    }}
                  />
                </label>

                <label className="settings-field" htmlFor="historyExportLimit">
                  <span>Límite de corridas exportadas</span>
                  <input
                    id="historyExportLimit"
                    type="number"
                    min={5}
                    max={200}
                    value={preferences.historyExportLimit}
                    onChange={(event) => {
                      const parsed = Number(event.target.value);
                      setPreferences((current) => ({
                        ...current,
                        historyExportLimit: clampNumber(parsed, 5, 200),
                      }));
                    }}
                  />
                </label>
              </div>

              <div className="command-strip">
                <button disabled={!scan || loading} onClick={applyDefaultSelectionToCurrentScan}>
                  Aplicar categorías al escaneo actual
                </button>
                <button disabled={loading} onClick={applyHistoryRetentionNow}>
                  Aplicar retención de logs
                </button>
              </div>
            </section>
          </>
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
