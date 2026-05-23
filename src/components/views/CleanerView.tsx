import { AnimatePresence } from "framer-motion";
import { Eye, EyeOff, Play, Search, ShieldCheck, Sparkles } from "lucide-react";
import { CleanerCard } from "../CleanerCard";
import type { CleanCategory, DryRunResponse, RiskLevel, ScanResponse } from "../../types/cleaner";
import type { MouseEvent } from "react";

type RiskMeta = { label: string; className: string; text: string };

type CleanerViewProps = {
  loading: boolean;
  scan: ScanResponse | null;
  dryRun: DryRunResponse | null;
  selectedCategories: CleanCategory[];
  riskMeta: Record<RiskLevel, RiskMeta>;
  scanPathDisclosure: Record<string, boolean>;
  showDryRunPaths: boolean;
  getCategoryLabel: (category: string) => string;
  onScan: () => void;
  onPrepareCleaning: () => void;
  onRunCleaning: () => void;
  onToggleCategory: (category: CleanCategory) => void;
  onToggleCategoryPath: (category: CleanCategory, event: MouseEvent<HTMLButtonElement>) => void;
  onToggleDryRunPaths: () => void;
};

export function CleanerView({
  loading,
  scan,
  dryRun,
  selectedCategories,
  riskMeta,
  scanPathDisclosure,
  showDryRunPaths,
  getCategoryLabel,
  onScan,
  onPrepareCleaning,
  onRunCleaning,
  onToggleCategory,
  onToggleCategoryPath,
  onToggleDryRunPaths,
}: CleanerViewProps) {
  return (
    <>
      <section className="command-strip">
        <button disabled={loading} onClick={onScan}>
          <Search size={17} /> Escanear basura
        </button>
        <button disabled={loading || !scan} onClick={onPrepareCleaning}>
          <ShieldCheck size={17} /> Preparar limpieza
        </button>
        <button disabled={loading || !dryRun} className="danger-action" onClick={onRunCleaning}>
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
        {loading && !scan && (
          <>
            {Array.from({ length: 3 }).map((_, index) => (
              <div className="skeleton-card" key={`cleaner-skeleton-${index}`}>
                <div className="skeleton-line w-30" />
                <div className="skeleton-line w-55" />
                <div className="skeleton-line w-40" />
                <div className="skeleton-line w-80" />
              </div>
            ))}
          </>
        )}

        <AnimatePresence mode="popLayout">
          {scan?.items.map((item, index) => (
            <CleanerCard
              key={item.id}
              item={item}
              index={index}
              selected={selectedCategories.includes(item.id)}
              riskMeta={riskMeta}
              showPath={Boolean(scanPathDisclosure[item.id])}
              onToggleCategory={onToggleCategory}
              onTogglePath={onToggleCategoryPath}
            />
          ))}
        </AnimatePresence>

        {!loading && !scan && (
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
          <button type="button" className="inline-link inline-link-block" onClick={onToggleDryRunPaths}>
            {showDryRunPaths ? <EyeOff size={14} /> : <Eye size={14} />}
            {showDryRunPaths ? "Ocultar rutas técnicas" : "Ver rutas técnicas"}
          </button>
          <div className="dryrun-table">
            {dryRun.candidates.slice(0, 80).map((candidate) => (
              <div className="dryrun-row" key={`${candidate.category}-${candidate.path}`}>
                <span>{candidate.size_human}</span>
                <span>{getCategoryLabel(candidate.category)}</span>
                <code>{showDryRunPaths ? candidate.path : "Ruta oculta para una vista simple"}</code>
              </div>
            ))}
          </div>
        </section>
      )}
    </>
  );
}
