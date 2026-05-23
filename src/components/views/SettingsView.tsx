import type { ChangeEvent } from "react";
import type { CleanCategory, CleaningPreferences, LargeFilesThreshold, ScanResponse } from "../../types/cleaner";

type CategoryOption = {
  id: CleanCategory;
  label: string;
};

type SettingsViewProps = {
  loading: boolean;
  scan: ScanResponse | null;
  preferences: CleaningPreferences;
  allowedThresholds: LargeFilesThreshold[];
  allCategories: CategoryOption[];
  onThresholdChange: (value: LargeFilesThreshold) => void;
  onToggleDefaultCategory: (category: CleanCategory) => void;
  onRetentionDaysChange: (value: number) => void;
  onExportLimitChange: (value: number) => void;
  onApplyDefaults: () => void;
  onApplyRetention: () => void;
  onExportReport: () => void;
};

export function SettingsView({
  loading,
  scan,
  preferences,
  allowedThresholds,
  allCategories,
  onThresholdChange,
  onToggleDefaultCategory,
  onRetentionDaysChange,
  onExportLimitChange,
  onApplyDefaults,
  onApplyRetention,
  onExportReport,
}: SettingsViewProps) {
  return (
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
              onChange={(event) => onThresholdChange(event.target.value as LargeFilesThreshold)}
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
                    onChange={() => onToggleDefaultCategory(category.id)}
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
              onChange={(event: ChangeEvent<HTMLInputElement>) => onRetentionDaysChange(Number(event.target.value))}
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
              onChange={(event: ChangeEvent<HTMLInputElement>) => onExportLimitChange(Number(event.target.value))}
            />
          </label>
        </div>

        <div className="command-strip">
          <button disabled={!scan || loading} onClick={onApplyDefaults}>
            Usar estas categorías ahora
          </button>
          <button disabled={loading} onClick={onApplyRetention}>
            Limpiar resultados antiguos
          </button>
          <button disabled={loading} onClick={onExportReport}>
            Exportar resultado técnico
          </button>
        </div>
      </section>
    </>
  );
}
