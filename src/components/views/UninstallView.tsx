import { Files, Search, ShieldCheck, Trash2 } from "lucide-react";
import type { AppUninstallPlanResponse, InstalledAppItem } from "../../types/cleaner";
import { UninstallPanel } from "../UninstallPanel";

type UninstallViewProps = {
  loading: boolean;
  installedApps: InstalledAppItem[];
  removableAppsCount: number;
  selectedAppIds: string[];
  appUninstallPlan: AppUninstallPlanResponse | null;
  showUninstallPlanPaths: boolean;
  onScanApps: () => void;
  onPrepareUninstall: () => void;
  onRunUninstall: () => void;
  onToggleAppSelection: (app: InstalledAppItem) => void;
  onTogglePlanPaths: () => void;
};

export function UninstallView({
  loading,
  installedApps,
  removableAppsCount,
  selectedAppIds,
  appUninstallPlan,
  showUninstallPlanPaths,
  onScanApps,
  onPrepareUninstall,
  onRunUninstall,
  onToggleAppSelection,
  onTogglePlanPaths,
}: UninstallViewProps) {
  return (
    <>
      <section className="section-heading">
        <div>
          <p className="eyebrow muted">Apps instaladas</p>
          <h2>Desinstalador</h2>
        </div>
        <span>{removableAppsCount} apps listas para desinstalar</span>
      </section>

      <section className="uninstall-preview">
        <UninstallPanel icon={<ShieldCheck size={19} />} title="Apps detectadas" body="Mac Cleaner detecta apps instaladas en Aplicaciones del sistema y del usuario." />
        <UninstallPanel icon={<Trash2 size={19} />} title="Desinstalación reversible" body="La app seleccionada y sus residuos se mueven a la Papelera." />
        <UninstallPanel icon={<Files size={19} />} title="Sin archivos personales" body="No se tocan documentos del usuario ni rutas libres fuera de las reglas permitidas." />
      </section>

      <section className="glass-panel uninstall-workspace">
        <div className="panel-heading">
          <h2>Apps detectadas</h2>
          <span>{selectedAppIds.length} seleccionadas</span>
        </div>

        <div className="command-strip">
          <button disabled={loading} onClick={onScanApps}>
            <Search size={17} /> Escanear apps
          </button>
          <button disabled={loading || selectedAppIds.length === 0} onClick={onPrepareUninstall}>
            <ShieldCheck size={17} /> Preparar desinstalación
          </button>
          <button disabled={loading || !appUninstallPlan || appUninstallPlan.items.length === 0} className="danger-action" onClick={onRunUninstall}>
            <Trash2 size={17} /> Mover a la Papelera
          </button>
        </div>

        <div className="apps-list">
          {loading && installedApps.length === 0 && (
            <>
              {Array.from({ length: 5 }).map((_, index) => (
                <div className="skeleton-row" key={`apps-skeleton-${index}`}>
                  <div className="skeleton-line w-45" />
                  <div className="skeleton-line w-30" />
                </div>
              ))}
            </>
          )}

          {installedApps.map((app) => (
            <article
              className="app-row"
              key={app.id}
              data-selected={selectedAppIds.includes(app.id)}
              data-disabled={!app.removable}
              onClick={() => onToggleAppSelection(app)}
              onKeyDown={(event) => {
                if (event.key === "Enter" || event.key === " ") {
                  event.preventDefault();
                  onToggleAppSelection(app);
                }
              }}
              role="button"
              tabIndex={app.removable ? 0 : -1}
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

          {!loading && installedApps.length === 0 && (
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
          <button type="button" className="inline-link inline-link-block" onClick={onTogglePlanPaths}>
            {showUninstallPlanPaths ? "Ocultar rutas técnicas" : "Ver rutas técnicas"}
          </button>
          <div className="dryrun-table uninstall-plan">
            {appUninstallPlan.items.map((item) => (
              <div className="dryrun-row" key={item.id}>
                <span>{item.size_human}</span>
                <span>App</span>
                <code>{showUninstallPlanPaths ? item.path : "Ruta oculta para una vista simple"}</code>
              </div>
            ))}
            {appUninstallPlan.leftovers.map((item) => (
              <div className="dryrun-row" key={item.id}>
                <span>{item.size_human}</span>
                <span>Residuo</span>
                <code>{showUninstallPlanPaths ? item.path : "Ruta oculta para una vista simple"}</code>
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
  );
}
