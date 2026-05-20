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
  Trash2,
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
  { id: "user_cache", label: "Caché antiguo" },
  { id: "user_logs", label: "Actividad antigua" },
  { id: "trash", label: "Papelera" },
  { id: "tmp", label: "Temporales seguros" },
];

const allowedThresholds: LargeFilesThreshold[] = ["500M", "1G", "2G", "5G"];

const defaultPreferences: CleaningPreferences = {
  defaultCategories: ["user_cache", "user_logs", "trash", "tmp"],
  largeFilesThreshold: "1G",
  historyRetentionDays: 30,
  historyExportLimit: 30,
};

const riskMeta: Record<RiskLevel, { label: string; className: string; text: string }> = {
  bajo: { label: "Listo", className: "risk-low", text: "Seguro para revisar" },
  medio: { label: "Revisar", className: "risk-medium", text: "Confirmación recomendada" },
  alto: { label: "Con cuidado", className: "risk-high", text: "Revisión especial" },
};

type AppView = "overview" | "files" | "history" | "settings" | "uninstall";
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
    return "Actividad incompleta";
  }
  return new Date(epoch * 1000).toLocaleString();
}

function getCategoryLabel(category: string): string {
  return allCategories.find((item) => item.id === category)?.label ?? category;
}

function getHistoryStatusLabel(status: string): string {
  if (status === "ok") {
    return "Completado";
  }
  if (status === "partial") {
    return "Con avisos";
  }
  if (status === "running") {
    return "En curso";
  }
  if (status === "incomplete") {
    return "Incompleto";
  }
  return status;
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
      setError("Elige al menos un área para revisar antes de liberar espacio.");
      return;
    }
    runAction(() => dryRunCleaning(selectedCategories), setDryRun);
  }

  function runNativeCleaning() {
    if (selectedCategories.length === 0) {
      setError("Elige al menos un área antes de liberar espacio.");
      return;
    }

    const ok = window.confirm("Mac Cleaner liberará espacio solo en las áreas revisadas. Nada fuera de esta selección será tocado. ¿Continuar?");
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
      setOutput(`Resumen listo: ${data.report_path} (actividades incluidas: ${data.exported_runs})`);
    });
  }

  function applyHistoryRetentionNow() {
    runAction(() => applyCleanHistoryRetention(preferences.historyRetentionDays), (data) => {
      setOutput(`Actividad actualizada: ${data.removed_runs} entradas antiguas eliminadas, ${data.kept_runs} conservadas.`);
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
            <span>Cuidado local para Mac</span>
          </div>
        </div>

        <nav className="nav-stack" aria-label="Principal">
          <a className={`nav-item ${view === "overview" ? "active" : ""}`} onClick={() => setView("overview")}>
            <Gauge size={17} /> Inicio
          </a>
          <a className={`nav-item ${view === "files" ? "active" : ""}`} onClick={() => setView("files")}>
            <Files size={17} /> Espacio
          </a>
          <a className={`nav-item ${view === "history" ? "active" : ""}`} onClick={() => setView("history")}>
            <History size={17} /> Actividad
          </a>
          <a className={`nav-item ${view === "settings" ? "active" : ""}`} onClick={() => setView("settings")}>
            <Settings size={17} /> Ajustes
          </a>
          <a className={`nav-item ${view === "uninstall" ? "active" : ""}`} onClick={() => setView("uninstall")}>
            <Trash2 size={17} /> Desinstalar
          </a>
        </nav>

        <div className="engine-card">
          <span className="status-dot" />
          <div>
            <strong>Protección activa</strong>
            <p>Nada se elimina sin tu confirmación.</p>
          </div>
        </div>
      </aside>

      <section className="content-area">
        {view === "overview" && (
          <>
            <motion.section
              className="hero-panel"
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.45, ease: "easeOut" }}
            >
              <div className="hero-copy">
                <p className="eyebrow"><Activity size={15} /> Cuidado premium para macOS</p>
                <h1>Tu Mac, más ligero y en orden.</h1>
                <p className="lead">
                  Revisa espacio recuperable, confirma con calma y libera solo lo que ya fue preparado de forma segura.
                </p>
                <div className="hero-actions">
                  <button className="primary-action" disabled={loading} onClick={() => runAction(scanCleanable, applyScanResult)}>
                    <Search size={18} /> Revisar mi Mac
                  </button>
                  <button className="secondary-action" disabled={loading || !scan} onClick={runDryRunForSelection}>
                    <TerminalSquare size={18} /> Revisar antes de limpiar
                  </button>
                </div>
              </div>

              <div className="orbital-card">
                <div className="orbital-ring" />
                <span>Espacio recuperable</span>
                <strong>{totalKb > 0 ? formatGb(totalKb) : "--"}</strong>
                <small>{scan ? `${scan.items.length} áreas revisadas` : "Inicia una revisión para comenzar"}</small>
              </div>
            </motion.section>

            <section className="metrics-grid">
              <MetricCard icon={<HardDrive size={19} />} label="Espacio recuperable" value={totalKb > 0 ? formatGb(totalKb) : "0.00 GB"} note="Se libera solo después de revisar." />
              <MetricCard icon={<CheckCircle2 size={19} />} label="Áreas listas" value={String(safeItems)} note="Zonas de menor riesgo para revisar." />
              <MetricCard icon={<AlertTriangle size={19} />} label="Para mirar con calma" value={String(reviewItems)} note="Requieren una confirmación más consciente." />
              <MetricCard icon={<Database size={19} />} label="Áreas elegidas" value={String(selectedCategories.length)} note={dryRun ? `${dryRun.candidates.length} elementos preparados.` : "Elige qué quieres revisar."} />
            </section>
          </>
        )}

        {view !== "overview" && (
          <motion.section
            className="view-header"
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.3, ease: "easeOut" }}
          >
            <div>
              <p className="eyebrow muted">
                {view === "files" && "Espacio"}
                {view === "history" && "Actividad"}
                {view === "settings" && "Ajustes"}
                {view === "uninstall" && "Desinstalar"}
              </p>
              <h1>
                {view === "files" && "Encuentra lo que ocupa más."}
                {view === "history" && "Tu actividad reciente."}
                {view === "settings" && "Cuidado a tu medida."}
                {view === "uninstall" && "Retira los datos de la app con calma."}
              </h1>
            </div>
            <span>
              {view === "files" && "Solo revisión, sin borrar."}
              {view === "history" && `${historyItems.length} actividades guardadas.`}
              {view === "settings" && "Guardado en este Mac."}
              {view === "uninstall" && "Sin tocar archivos personales."}
            </span>
          </motion.section>
        )}

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
                <Play size={17} /> Liberar espacio {selectedCategories.length > 0 ? `(${selectedCategories.length})` : ""}
              </button>
            </section>

            <section className="section-heading">
              <div>
                <p className="eyebrow muted">Áreas revisadas</p>
                <h2>Recomendaciones</h2>
              </div>
              <span>{scan ? "Listo para revisar" : "Sin revisión reciente"}</span>
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
                        {meta.text} · elementos de más de {item.age_days} días · {selectedCategories.includes(item.id) ? "incluida" : "omitida"}
                      </small>
                    </motion.article>
                  );
                })}
              </AnimatePresence>

              {!scan && (
                <div className="empty-state">
                  <Sparkles size={28} />
                  <h3>Revisión pendiente</h3>
                  <p>Inicia una revisión para ver espacio recuperable y recomendaciones seguras.</p>
                </div>
              )}
            </section>

            {dryRun && (
              <section className="glass-panel">
                <div className="panel-heading">
                  <h2>Revisión antes de limpiar</h2>
                  <span>{dryRun.candidates.length} elementos listos para revisar</span>
                </div>
                <div className="dryrun-table">
                  {dryRun.candidates.slice(0, 80).map((candidate) => (
                    <div className="dryrun-row" key={`${candidate.category}-${candidate.path}`}>
                      <span>{candidate.size_human}</span>
                      <span>{getCategoryLabel(candidate.category)}</span>
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
              <span>Solo revisión</span>
            </section>

            <section className="command-strip">
              <button disabled={loading} onClick={() => runAction(() => findLargeFiles(preferences.largeFilesThreshold), (data) => setOutput(data.stdout))}>
                Archivos grandes ({preferences.largeFilesThreshold}+)
              </button>
              <button disabled={loading} onClick={() => runAction(getTopDirs, (data) => setOutput(data.stdout))}>
                Carpetas que ocupan más
              </button>
            </section>
          </>
        )}

        {view === "history" && (
          <>
            <section className="section-heading">
              <div>
                <p className="eyebrow muted">Actividad</p>
                <h2>Actividad reciente</h2>
              </div>
              <span>{filteredHistoryItems.length} de {historyItems.length} actividades</span>
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
                    <option value="all">Todo</option>
                    <option value="ok">Completado</option>
                    <option value="partial">Con avisos</option>
                    <option value="running">En curso</option>
                    <option value="incomplete">Incompleto</option>
                  </select>
                </label>

                <label className="settings-field" htmlFor="historyCategoryFilter">
                  <span>Área</span>
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
                    <option value="reclaimed_desc">Más espacio liberado</option>
                    <option value="errors_desc">Más avisos</option>
                  </select>
                </label>
              </div>

              <div className="command-strip">
                <button disabled={loading} onClick={() => void loadHistory()}>
                  <History size={17} /> Actualizar actividad
                </button>
                <button disabled={loading} onClick={exportHistoryReport}>
                  <Download size={17} /> Exportar resumen
                </button>
                <button disabled={loading} onClick={resetHistoryFilters}>
                  Restablecer filtros
                </button>
              </div>
            </section>

            <section className="cleaner-grid history-grid">
              {filteredHistoryItems.map((entry) => (
                <article className="cleaner-card" key={entry.run_id} data-selected={false}>
                  <div className="card-topline">
                    <span className={`risk-pill ${entry.status === "ok" ? "risk-low" : "risk-medium"}`}>
                      {getHistoryStatusLabel(entry.status)}
                    </span>
                    <span>{entry.reclaimed_total_human}</span>
                  </div>
                  <h3>{formatEpoch(entry.started_at_epoch_secs)}</h3>
                  <p className="mono-path">{entry.log_file}</p>
                  <small>
                    {entry.deleted_count} elementos liberados · {entry.error_count} avisos · {entry.candidate_count} revisados
                  </small>
                </article>
              ))}

              {filteredHistoryItems.length === 0 && (
                <div className="empty-state">
                  <History size={28} />
                  <h3>Sin actividad para estos filtros</h3>
                  <p>Ajusta los filtros o realiza una revisión para ver nueva actividad.</p>
                </div>
              )}
            </section>
          </>
        )}

        {view === "uninstall" && (
          <>
            <section className="section-heading">
              <div>
                <p className="eyebrow muted">Datos de Mac Cleaner</p>
                <h2>Desinstalación guiada</h2>
              </div>
              <span>Preparado para revisión segura</span>
            </section>

            <section className="uninstall-preview">
              <article className="uninstall-panel">
                <div className="metric-icon"><ShieldCheck size={19} /></div>
                <h3>Primero revisaremos datos de la app</h3>
                <p>Preferencias, actividad, resúmenes y caché propia se mostrarán por separado antes de eliminar algo.</p>
              </article>
              <article className="uninstall-panel">
                <div className="metric-icon"><Trash2 size={19} /></div>
                <h3>Tú decides qué conservar</h3>
                <p>La limpieza de datos propios llegará en el siguiente paso con confirmación y registro de resultados.</p>
              </article>
              <article className="uninstall-panel">
                <div className="metric-icon"><Files size={19} /></div>
                <h3>Tus archivos no se tocarán</h3>
                <p>La app solo podrá revisar ubicaciones propias de Mac Cleaner. Nada de otras apps ni documentos personales.</p>
              </article>
            </section>
          </>
        )}

        {view === "settings" && (
          <>
            <section className="section-heading">
              <div>
                <p className="eyebrow muted">Preferencias</p>
                <h2>Cuidado por defecto</h2>
              </div>
              <span>Guardado en este Mac</span>
            </section>

            <section className="glass-panel">
              <div className="panel-heading">
                <h2>Preferencias de cuidado</h2>
                <span>En este Mac</span>
              </div>
              <div className="settings-grid">
                <label className="settings-field" htmlFor="threshold">
                  <span>Tamaño mínimo para archivos grandes</span>
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
                  <span>Áreas incluidas por defecto</span>
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
                  <span>Conservar actividad (días)</span>
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
                  <span>Actividades incluidas en resúmenes</span>
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
                  Usar estas áreas ahora
                </button>
                <button disabled={loading} onClick={applyHistoryRetentionNow}>
                  Actualizar actividad guardada
                </button>
              </div>
            </section>
          </>
        )}

        {output && (
          <section className="glass-panel">
            <div className="panel-heading">
              <h2>Detalles</h2>
              <span>Para soporte o revisión avanzada</span>
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
