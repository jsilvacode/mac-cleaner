import { useEffect, useMemo, useState, type MouseEvent } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { Sparkles } from "lucide-react";
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
  CommandTextResponse,
  DryRunResponse,
  InstalledAppItem,
  LargeFilesThreshold,
  RiskLevel,
  ScanResponse,
} from "./types/cleaner";
import { ConfirmDialog, type ConfirmDialogState } from "./components/common/ConfirmDialog";
import { ResultPanel, type ResultPanelState } from "./components/common/ResultPanel";
import { SidebarNav } from "./components/layout/SidebarNav";
import { OverviewView } from "./components/views/OverviewView";
import { CleanerView } from "./components/views/CleanerView";
import { UninstallView } from "./components/views/UninstallView";
import { FilesView } from "./components/views/FilesView";
import { SettingsView } from "./components/views/SettingsView";
import type { AppView } from "./components/views/viewTypes";

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

function summarizeCleaningResult(data: CommandTextResponse): string {
  if (!data.stdout) {
    return "Limpieza completada con respuesta vacía.";
  }
  try {
    const parsed = JSON.parse(data.stdout) as {
      reclaimed_total_human?: string;
      items?: Array<{ deleted?: boolean }>;
      mode?: string;
    };
    if (parsed.mode && parsed.reclaimed_total_human) {
      const deletedItems = parsed.items?.filter((item) => item.deleted).length ?? 0;
      return `Limpieza completada. Espacio recuperado: ${parsed.reclaimed_total_human}. Elementos eliminados: ${deletedItems}.`;
    }
  } catch {
    // El modo shell/parity devuelve texto plano; usamos fallback.
  }
  return "Limpieza completada. Revisa el detalle técnico si necesitas soporte.";
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
  const [resultPanel, setResultPanel] = useState<ResultPanelState | null>(null);
  const [showTechnicalDetails, setShowTechnicalDetails] = useState(false);
  const [confirmDialog, setConfirmDialog] = useState<ConfirmDialogState | null>(null);
  const [scanPathDisclosure, setScanPathDisclosure] = useState<Record<string, boolean>>({});
  const [showDryRunPaths, setShowDryRunPaths] = useState(false);
  const [showUninstallPlanPaths, setShowUninstallPlanPaths] = useState(false);
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

  function pushResult(title: string, summary: string, details: string) {
    setResultPanel({ title, summary, details });
    setShowTechnicalDetails(false);
  }

  function openConfirmDialog(config: Omit<ConfirmDialogState, "onConfirm">, onConfirm: () => void) {
    setConfirmDialog({ ...config, onConfirm });
  }

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
    setResultPanel(null);
    setShowTechnicalDetails(false);
    setScanPathDisclosure({});
    const available = data.items.map((item) => item.id);
    const preferred = available.filter((category) => preferences.defaultCategories.includes(category));
    setSelectedCategories(preferred.length > 0 ? preferred : available);
  }

  function toggleCategory(category: CleanCategory) {
    setSelectedCategories((current) =>
      current.includes(category) ? current.filter((item) => item !== category) : [...current, category],
    );
    setDryRun(null);
  }

  function toggleCategoryPath(categoryId: CleanCategory, event: MouseEvent<HTMLButtonElement>) {
    event.stopPropagation();
    setScanPathDisclosure((current) => ({
      ...current,
      [categoryId]: !current[categoryId],
    }));
  }

  function toggleAppSelection(app: InstalledAppItem) {
    if (!app.removable) {
      return;
    }
    setSelectedAppIds((current) =>
      current.includes(app.id) ? current.filter((id) => id !== app.id) : [...current, app.id],
    );
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
    setShowDryRunPaths(false);
    runAction(() => dryRunCleaning(selectedCategories), setDryRun);
    setView("clean");
  }

  function runNativeCleaning() {
    if (selectedCategories.length === 0) {
      setError("Elige al menos una categoría antes de limpiar.");
      return;
    }

    openConfirmDialog(
      {
        title: "Confirmar limpieza",
        message: "Se eliminará basura preparada en cachés, logs, temporales y Papelera. No se tocarán archivos personales.",
        confirmLabel: "Limpiar ahora",
        tone: "danger",
      },
      () => {
        runAction(() => runCleaning(selectedCategories), (data) => {
          pushResult(
            "Limpieza completada",
            summarizeCleaningResult(data),
            data.stdout || data.stderr || "Sin detalle técnico.",
          );
          setDryRun(null);
          void runAction(scanCleanable, applyScanResult);
        });
      },
    );
  }

  function exportResultsReport() {
    runAction(() => exportCleanHistoryReport(preferences.historyExportLimit), (data) => {
      pushResult(
        "Resultado exportado",
        `Reporte creado con ${data.exported_runs} ejecuciones.`,
        `Ruta del archivo: ${data.report_path}`,
      );
    });
  }

  function applyResultsRetentionNow() {
    runAction(() => applyCleanHistoryRetention(preferences.historyRetentionDays), (data) => {
      pushResult(
        "Retención aplicada",
        `${data.removed_runs} resultados antiguos eliminados. ${data.kept_runs} resultados conservados.`,
        `Log actualizado en: ${data.log_file}`,
      );
    });
  }

  function prepareSelectedAppsForUninstall() {
    if (selectedAppIds.length === 0) {
      setError("Elige al menos una app para preparar la desinstalación.");
      return;
    }
    setShowUninstallPlanPaths(false);
    runAction(() => prepareAppUninstall(selectedAppIds), setAppUninstallPlan);
  }

  function runAppUninstall() {
    if (!appUninstallPlan || appUninstallPlan.items.length === 0) {
      setError("Primero prepara la desinstalación de las apps seleccionadas.");
      return;
    }

    const appNames = appUninstallPlan.items.map((item) => item.name).join(", ");
    const leftoverCount = appUninstallPlan.leftovers.length;
    openConfirmDialog(
      {
        title: "Confirmar desinstalación",
        message: `Se moverá a la Papelera: ${appNames}${leftoverCount > 0 ? ` y ${leftoverCount} residuos asociados` : ""}.`,
        confirmLabel: "Mover a la Papelera",
        tone: "warning",
      },
      () => {
        const idsToMove = appUninstallPlan.items.map((item) => item.id);
        runAction(() => uninstallAppsToTrash(idsToMove), (data) => {
          pushResult(
            "Desinstalación completada",
            `${data.moved_count} elementos movidos a la Papelera. Tamaño trasladado: ${data.moved_total_human}.`,
            `Elementos omitidos: ${data.skipped_count}.`,
          );
          setSelectedAppIds([]);
          setAppUninstallPlan(null);
          setAppsLoaded(false);
        });
      },
    );
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

        <SidebarNav view={view} onSelectView={setView} />

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
          <OverviewView
            loading={loading}
            totalKb={totalKb}
            scan={scan}
            dryRun={dryRun}
            safeItems={safeItems}
            confirmItems={confirmItems}
            onScan={() => runAction(scanCleanable, applyScanResult)}
            onPrepareCleaning={runDryRunForSelection}
          />
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
          <CleanerView
            loading={loading}
            scan={scan}
            dryRun={dryRun}
            selectedCategories={selectedCategories}
            riskMeta={riskMeta}
            scanPathDisclosure={scanPathDisclosure}
            showDryRunPaths={showDryRunPaths}
            getCategoryLabel={getCategoryLabel}
            onScan={() => runAction(scanCleanable, applyScanResult)}
            onPrepareCleaning={runDryRunForSelection}
            onRunCleaning={runNativeCleaning}
            onToggleCategory={toggleCategory}
            onToggleCategoryPath={toggleCategoryPath}
            onToggleDryRunPaths={() => setShowDryRunPaths((current) => !current)}
          />
        )}

        {view === "uninstall" && (
          <UninstallView
            loading={loading}
            installedApps={installedApps}
            removableAppsCount={removableApps.length}
            selectedAppIds={selectedAppIds}
            appUninstallPlan={appUninstallPlan}
            showUninstallPlanPaths={showUninstallPlanPaths}
            onScanApps={() => void loadInstalledApps()}
            onPrepareUninstall={prepareSelectedAppsForUninstall}
            onRunUninstall={runAppUninstall}
            onToggleAppSelection={toggleAppSelection}
            onTogglePlanPaths={() => setShowUninstallPlanPaths((current) => !current)}
          />
        )}

        {view === "files" && (
          <FilesView
            loading={loading}
            threshold={preferences.largeFilesThreshold}
            onFindLargeFiles={() =>
              runAction(() => findLargeFiles(preferences.largeFilesThreshold), (data) => {
                pushResult(
                  "Archivos grandes detectados",
                  `Búsqueda completada con umbral ${preferences.largeFilesThreshold}+ en HOME.`,
                  data.stdout || "Sin detalle técnico.",
                );
              })
            }
            onGetTopDirs={() =>
              runAction(getTopDirs, (data) => {
                pushResult(
                  "Carpetas pesadas detectadas",
                  "Análisis de las carpetas con mayor tamaño en HOME completado.",
                  data.stdout || "Sin detalle técnico.",
                );
              })
            }
          />
        )}

        {view === "settings" && (
          <SettingsView
            loading={loading}
            scan={scan}
            preferences={preferences}
            allowedThresholds={allowedThresholds}
            allCategories={allCategories}
            onThresholdChange={(value) => {
              setPreferences((current) => ({
                ...current,
                largeFilesThreshold: value,
              }));
            }}
            onToggleDefaultCategory={toggleDefaultCategory}
            onRetentionDaysChange={(value) => {
              setPreferences((current) => ({
                ...current,
                historyRetentionDays: clampNumber(value, 1, 3650),
              }));
            }}
            onExportLimitChange={(value) => {
              setPreferences((current) => ({
                ...current,
                historyExportLimit: clampNumber(value, 5, 200),
              }));
            }}
            onApplyDefaults={applyDefaultSelectionToCurrentScan}
            onApplyRetention={applyResultsRetentionNow}
            onExportReport={exportResultsReport}
          />
        )}

        <ResultPanel
          result={resultPanel}
          showTechnicalDetails={showTechnicalDetails}
          onToggleDetails={() => setShowTechnicalDetails((current) => !current)}
        />

        <ConfirmDialog dialog={confirmDialog} onClose={() => setConfirmDialog(null)} />
      </section>
    </main>
  );
}
