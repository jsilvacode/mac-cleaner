import { useEffect, useMemo, useState, type ReactNode } from "react";
import { AnimatePresence, motion } from "framer-motion";
import {
  AlertTriangle,
  CheckCircle2,
  ChevronRight,
  Database,
  Files,
  Gauge,
  HardDrive,
  Play,
  Search,
  Settings,
  ShieldCheck,
  Sparkles,
  Trash2,
} from "lucide-react";
import {
  applyCleanHistoryRetention,
  dryRunCleaning,
  exportCleanHistoryReport,
  findLargeFiles,
  getTopDirs,
  prepareAppUninstall,
  runCleaning,
  scanCleanable,
  scanInstalledApps,
  uninstallAppsToTrash,
} from "./services/cleanerApi";
import type {
  AppUninstallPlanResponse,
  CleanCategory,
  CleaningPreferences,
  DryRunResponse,
  InstalledAppItem,
  LargeFilesThreshold,
  RiskLevel,
  ScanResponse,
} from "./types/cleaner";

const formatGb = (kb: number) => `${(kb / 1024 / 1024).toFixed(2)} GB`;
const PREFERENCES_KEY = "mac_cleaner_preferences_v2";

const allCategories: Array<{ id: CleanCategory; label: string }> = [
  { id: "user_cache", label: "Caché de apps" },
  { id: "user_logs", label: "Logs antiguos" },
  { id: "trash", label: "Papelera" },
  { id: "tmp", label: "Temporales" },
];

const allowedThresholds: LargeFilesThreshold[] = ["500M", "1G", "2G", "5G"];

const defaultPreferences: CleaningPreferences = {
  defaultCategories: ["user_cache", "user_logs", "trash", "tmp"],
  largeFilesThreshold: "1G",
  historyRetentionDays: 30,
  historyExportLimit: 30,
};

const riskMeta: Record<RiskLevel, { label: string; className: string; text: string }> = {
  bajo: { label: "Bajo riesgo", className: "risk-low", text: "Listo para limpiar" },
  medio: { label: "Confirmar", className: "risk-medium", text: "Se limpia tras confirmar" },
  alto: { label: "Avanzado", className: "risk-high", text: "Requiere control manual" },
};

type AppView = "overview" | "clean" | "uninstall" | "files" | "settings";

function clampNumber(value: number, min: number, max: number): number {
  if (!Number.isFinite(value)) {
    return min;
  }
  return Math.min(max, Math.max(min, Math.trunc(value)));
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

    return {
      defaultCategories: defaultCategories.length > 0 ? defaultCategories : defaultPreferences.defaultCategories,
      largeFilesThreshold,
      historyRetentionDays: clampNumber(parsed.historyRetentionDays ?? defaultPreferences.historyRetentionDays, 1, 3650),
      historyExportLimit: clampNumber(parsed.historyExportLimit ?? defaultPreferences.historyExportLimit, 5, 200),
    };
  } catch {
    return defaultPreferences;
  }
}

function getCategoryLabel(category: string): string {
  return allCategories.find((item) => item.id === category)?.label ?? category;
}

export default function App() {
  const [view, setView] = useState<AppView>("overview");
  const [scan, setScan] = useState<ScanResponse | null>(null);
  const [dryRun, setDryRun] = useState<DryRunResponse | null>(null);
  const [selectedCategories, setSelectedCategories] = useState<CleanCategory[]>([]);
  const [installedApps, setInstalledApps] = useState<InstalledAppItem[]>([]);
  const [appsLoaded, setAppsLoaded] = useState(false);
  const [selectedAppIds, setSelectedAppIds] = useState<string[]>([]);
  const [appUninstallPlan, setAppUninstallPlan] = useState<AppUninstallPlanResponse | null>(null);
  const [preferences, setPreferences] = useState<CleaningPreferences>(() => loadPreferences());
  const [output, setOutput] = useState<string>("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string>("");

  useEffect(() => {
    window.localStorage.setItem(PREFERENCES_KEY, JSON.stringify(preferences));
  }, [preferences]);

  useEffect(() => {
    void runAction(scanCleanable, applyScanResult);
  }, []);

  useEffect(() => {
    if (view === "uninstall" && !appsLoaded) {
      void loadInstalledApps();
    }
  }, [view, appsLoaded]);

  const totalKb = useMemo(() => scan?.items.reduce((sum, item) => sum + item.estimated_kb, 0) ?? 0, [scan]);
  const safeItems = scan?.items.filter((item) => item.risk === "bajo").length ?? 0;
  const confirmItems = scan?.items.filter((item) => item.risk !== "bajo").length ?? 0;
  const removableApps = useMemo(() => installedApps.filter((app) => app.removable), [installedApps]);
  const preparedTrashCount = dryRun?.candidates.length ?? 0;

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

  async function loadInstalledApps() {
    await runAction(scanInstalledApps, (data) => {
      setInstalledApps(data.items);
      setAppsLoaded(true);
      setAppUninstallPlan(null);
      setSelectedAppIds((current) => current.filter((id) => data.items.some((app) => app.id === id && app.removable)));
    });
  }

  function applyScanResult(data: ScanResponse) {
    setScan(data);
    setDryRun(null);
    setOutput("");
    const available = data.items.map((item) => item.id);
    const preferred = available.filter((category) => preferences.defaultCategories.includes(category));
    setSelectedCategories(preferred.length > 0 ? preferred : available);
  }

  function toggleCategory(category: CleanCategory) {
    setSelectedCategories((current) => current.includes(category)
      ? current.filter((item) => item !== category)
      : [...current, category]);
    setDryRun(null);
  }

  function toggleAppSelection(app: InstalledAppItem) {
    if (!app.removable) {
      return;
    }
    setSelectedAppIds((current) => current.includes(app.id)
      ? current.filter((id) => id !== app.id)
      : [...current, app.id]);
    setAppUninstallPlan(null);
  }

  function toggleDefaultCategory(category: CleanCategory) {
    setPreferences((current) => {
      const next = current.defaultCategories.includes(category)
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

  function runDryRunForSelection() {
    if (selectedCategories.length === 0) {
      setError("Elige al menos una categoría para preparar la limpieza.");
      return;
    }
    runAction(() => dryRunCleaning(selectedCategories), setDryRun);
    setView("clean");
  }

  function runNativeCleaning() {
    if (selectedCategories.length === 0) {
      setError("Elige al menos una categoría antes de limpiar.");
      return;
    }

    const ok = window.confirm("Mac Cleaner eliminará la basura preparada en cachés, logs, temporales y Papelera. Nada fuera de esta selección será tocado. ¿Continuar?");
    if (!ok) {
      return;
    }

    runAction(() => runCleaning(selectedCategories), (data) => {
      setOutput(data.stdout || data.stderr);
      setDryRun(null);
      void runAction(scanCleanable, applyScanResult);
    });
  }

  function exportResultsReport() {
    runAction(() => exportCleanHistoryReport(preferences.historyExportLimit), (data) => {
      setOutput(`Resultado exportado: ${data.report_path} (resultados incluidos: ${data.exported_runs})`);
    });
  }

  function applyResultsRetentionNow() {
    runAction(() => applyCleanHistoryRetention(preferences.historyRetentionDays), (data) => {
      setOutput(`Resultados actualizados: ${data.removed_runs} antiguos eliminados, ${data.kept_runs} conservados.`);
    });
  }

  function prepareSelectedAppsForUninstall() {
    if (selectedAppIds.length === 0) {
      setError("Elige al menos una app para preparar la desinstalación.");
      return;
    }
    runAction(() => prepareAppUninstall(selectedAppIds), setAppUninstallPlan);
  }

  function runAppUninstall() {
    if (!appUninstallPlan || appUninstallPlan.items.length === 0) {
      setError("Primero prepara la desinstalación de las apps seleccionadas.");
      return;
    }

    const appNames = appUninstallPlan.items.map((item) => item.name).join(", ");
    const leftoverCount = appUninstallPlan.leftovers.length;
    const ok = window.confirm(
      `Mac Cleaner moverá a la Papelera: ${appNames}${leftoverCount > 0 ? ` y ${leftoverCount} rastros residuales` : ""}. Revisa que no necesites esos datos antes de continuar. ¿Continuar?`,
    );
    if (!ok) {
      return;
    }

    const idsToMove = appUninstallPlan.items.map((item) => item.id);
    runAction(() => uninstallAppsToTrash(idsToMove), (data) => {
      setOutput(`Elementos movidos a la Papelera: ${data.moved_count}. Tamaño trasladado: ${data.moved_total_human}. Omitidos: ${data.skipped_count}.`);
      setSelectedAppIds([]);
      setAppUninstallPlan(null);
      setAppsLoaded(false);
    });
  }

  return (
    <main className="app-shell">
      <aside className="sidebar">
        <div className="brand-block">
          <div className="brand-mark"><Sparkles size={19} /></div>
          <div>
            <strong>Mac Cleaner</strong>
            <span>Limpieza profunda para Mac</span>
          </div>
        </div>

        <nav className="nav-stack" aria-label="Principal">
          <a className={`nav-item ${view === "overview" ? "active" : ""}`} onClick={() => setView("overview")}>
            <Gauge size={17} /> Inicio
          </a>
          <a className={`nav-item ${view === "clean" ? "active" : ""}`} onClick={() => setView("clean")}>
            <Trash2 size={17} /> Limpiar
          </a>
          <a className={`nav-item ${view === "uninstall" ? "active" : ""}`} onClick={() => setView("uninstall")}>
            <Trash2 size={17} /> Desinstalar
          </a>
          <a className={`nav-item ${view === "files" ? "active" : ""}`} onClick={() => setView("files")}>
            <Files size={17} /> Espacio
          </a>
          <a className={`nav-item ${view === "settings" ? "active" : ""}`} onClick={() => setView("settings")}>
            <Settings size={17} /> Ajustes
          </a>
        </nav>

        <div className="engine-card">
          <span className="status-dot" />
          <div>
            <strong>Listo para limpiar</strong>
            <p>Escanea basura técnica y recupera espacio.</p>
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
                <p className="eyebrow"><Sparkles size={15} /> Limpieza profunda para macOS</p>
                <h1>Limpia basura técnica y recupera espacio.</h1>
                <p className="lead">
                  Escanea cachés, temporales, logs y Papelera. Limpia lo que sobra y conserva el control cuando algo pueda afectar tus datos.
                </p>
                <div className="hero-actions">
                  <button className="primary-action" disabled={loading} onClick={() => runAction(scanCleanable, applyScanResult)}>
                    <Search size={18} /> Escanear basura
                  </button>
                  <button className="secondary-action" disabled={loading || !scan} onClick={runDryRunForSelection}>
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
                {view === "clean" && "Limpiar"}
                {view === "uninstall" && "Desinstalar"}
                {view === "files" && "Espacio"}
                {view === "settings" && "Ajustes"}
              </p>
              <h1>
                {view === "clean" && "Escanea y limpia basura técnica."}
                {view === "uninstall" && "Desinstala apps y elimina residuos."}
                {view === "files" && "Detecta lo que ocupa más."}
                {view === "settings" && "Configura la limpieza."}
              </h1>
            </div>
            <span>
              {view === "clean" && "Cachés, logs, temporales y Papelera."}
              {view === "uninstall" && "Apps y rastros residuales a la Papelera."}
              {view === "files" && "Archivos grandes y carpetas pesadas."}
              {view === "settings" && "Guardado en este Mac."}
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

        {view === "clean" && (
          <>
            <section className="command-strip">
              <button disabled={loading} onClick={() => runAction(scanCleanable, applyScanResult)}>
                <Search size={17} /> Escanear basura
              </button>
              <button disabled={loading || !scan} onClick={runDryRunForSelection}>
                <ShieldCheck size={17} /> Preparar limpieza
              </button>
              <button disabled={loading || !dryRun} className="danger-action" onClick={runNativeCleaning}>
                <Play size={17} /> Limpiar ahora {selectedCategories.length > 0 ? `(${selectedCategories.length})` : ""}
              </button>
            </section>

            <section className="section-heading">
              <div>
                <p className="eyebrow muted">Basura técnica</p>
                <h2>Categorías para limpiar</h2>
              </div>
              <span>{scan ? "Listo para limpiar" : "Escaneo pendiente"}</span>
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
                        {meta.text} · más de {item.age_days} días · {selectedCategories.includes(item.id) ? "incluida" : "omitida"}
                      </small>
                    </motion.article>
                  );
                })}
              </AnimatePresence>

              {!scan && (
                <div className="empty-state">
                  <Sparkles size={28} />
                  <h3>Escaneo pendiente</h3>
                  <p>Escanea cachés, temporales, logs y Papelera para preparar una limpieza real.</p>
                </div>
              )}
            </section>

            {dryRun && (
              <section className="glass-panel">
                <div className="panel-heading">
                  <h2>Archivos basura preparados</h2>
                  <span>{dryRun.candidates.length} elementos listos</span>
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

        {view === "uninstall" && (
          <>
            <section className="section-heading">
              <div>
                <p className="eyebrow muted">Apps instaladas</p>
                <h2>Desinstalador</h2>
              </div>
              <span>{removableApps.length} apps listas para desinstalar</span>
            </section>

            <section className="uninstall-preview">
              <article className="uninstall-panel">
                <div className="metric-icon"><ShieldCheck size={19} /></div>
                <h3>Apps detectadas</h3>
                <p>Mac Cleaner detecta apps instaladas en Aplicaciones del sistema y del usuario.</p>
              </article>
              <article className="uninstall-panel">
                <div className="metric-icon"><Trash2 size={19} /></div>
                <h3>Desinstalación reversible</h3>
                <p>La app seleccionada y sus residuos se mueven a la Papelera.</p>
              </article>
              <article className="uninstall-panel">
                <div className="metric-icon"><Files size={19} /></div>
                <h3>Sin archivos personales</h3>
                <p>No se tocan documentos del usuario ni rutas libres fuera de las reglas permitidas.</p>
              </article>
            </section>

            <section className="glass-panel uninstall-workspace">
              <div className="panel-heading">
                <h2>Apps detectadas</h2>
                <span>{selectedAppIds.length} seleccionadas</span>
              </div>

              <div className="command-strip">
                <button disabled={loading} onClick={() => void loadInstalledApps()}>
                  <Search size={17} /> Escanear apps
                </button>
                <button disabled={loading || selectedAppIds.length === 0} onClick={prepareSelectedAppsForUninstall}>
                  <ShieldCheck size={17} /> Preparar desinstalación
                </button>
                <button disabled={loading || !appUninstallPlan || appUninstallPlan.items.length === 0} className="danger-action" onClick={runAppUninstall}>
                  <Trash2 size={17} /> Mover a la Papelera
                </button>
              </div>

              <div className="apps-list">
                {installedApps.map((app) => (
                  <article
                    className="app-row"
                    key={app.id}
                    data-selected={selectedAppIds.includes(app.id)}
                    data-disabled={!app.removable}
                    onClick={() => toggleAppSelection(app)}
                  >
                    <div>
                      <strong>{app.name}</strong>
                      <span>{app.scope === "user" ? "Instalada para este usuario" : "En Aplicaciones"}</span>
                    </div>
                    <div className="app-row-meta">
                      <span>{app.size_human}</span>
                      <small>{app.reason}</small>
                    </div>
                  </article>
                ))}

                {installedApps.length === 0 && (
                  <div className="empty-state compact">
                    <Trash2 size={28} />
                    <h3>Sin apps escaneadas todavía</h3>
                    <p>Escanea apps instaladas para preparar una desinstalación segura.</p>
                  </div>
                )}
              </div>
            </section>

            {appUninstallPlan && (
              <section className="glass-panel">
                <div className="panel-heading">
                  <h2>Archivos que se moverán</h2>
                  <span>{appUninstallPlan.total_human} preparado para mover a la Papelera</span>
                </div>
                <div className="dryrun-table uninstall-plan">
                  {appUninstallPlan.items.map((item) => (
                    <div className="dryrun-row" key={item.id}>
                      <span>{item.size_human}</span>
                      <span>App</span>
                      <code>{item.path}</code>
                    </div>
                  ))}
                  {appUninstallPlan.leftovers.map((item) => (
                    <div className="dryrun-row" key={item.id}>
                      <span>{item.size_human}</span>
                      <span>Residuo</span>
                      <code>{item.path}</code>
                    </div>
                  ))}
                </div>

                {appUninstallPlan.skipped.length > 0 && (
                  <div className="skip-note">
                    {appUninstallPlan.skipped.length} apps fueron omitidas por seguridad.
                  </div>
                )}
              </section>
            )}
          </>
        )}

        {view === "files" && (
          <>
            <section className="section-heading">
              <div>
                <p className="eyebrow muted">Espacio</p>
                <h2>Archivos grandes y carpetas pesadas</h2>
              </div>
              <span>Complemento para recuperar espacio</span>
            </section>

            <section className="command-strip">
              <button disabled={loading} onClick={() => runAction(() => findLargeFiles(preferences.largeFilesThreshold), (data) => setOutput(data.stdout))}>
                Archivos grandes ({preferences.largeFilesThreshold}+)
              </button>
              <button disabled={loading} onClick={() => runAction(getTopDirs, (data) => setOutput(data.stdout))}>
                Carpetas pesadas
              </button>
            </section>
          </>
        )}

        {view === "settings" && (
          <>
            <section className="section-heading">
              <div>
                <p className="eyebrow muted">Ajustes</p>
                <h2>Comportamiento de limpieza</h2>
              </div>
              <span>Guardado en este Mac</span>
            </section>

            <section className="glass-panel">
              <div className="panel-heading">
                <h2>Ajustes de limpieza</h2>
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
                  <span>Categorías incluidas por defecto</span>
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
                  <span>Conservar resultados (días)</span>
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
                  <span>Resultados incluidos en soporte</span>
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
                  Usar estas categorías ahora
                </button>
                <button disabled={loading} onClick={applyResultsRetentionNow}>
                  Limpiar resultados antiguos
                </button>
                <button disabled={loading} onClick={exportResultsReport}>
                  Exportar resultado técnico
                </button>
              </div>
            </section>
          </>
        )}

        {output && (
          <section className="glass-panel">
            <div className="panel-heading">
              <h2>Resultado inmediato</h2>
              <span>Detalle técnico para soporte</span>
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
