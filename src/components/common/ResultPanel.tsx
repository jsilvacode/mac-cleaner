import { Eye, EyeOff } from "lucide-react";

export type ResultPanelState = {
  title: string;
  summary: string;
  details: string;
};

type ResultPanelProps = {
  result: ResultPanelState | null;
  showTechnicalDetails: boolean;
  onToggleDetails: () => void;
};

export function ResultPanel({ result, showTechnicalDetails, onToggleDetails }: ResultPanelProps) {
  if (!result) {
    return null;
  }

  return (
    <section className="glass-panel">
      <div className="panel-heading">
        <h2>{result.title}</h2>
        <span>Resumen claro</span>
      </div>
      <p>{result.summary}</p>
      <button type="button" className="inline-link inline-link-block" onClick={onToggleDetails}>
        {showTechnicalDetails ? <EyeOff size={14} /> : <Eye size={14} />}
        {showTechnicalDetails ? "Ocultar detalle técnico" : "Ver detalle técnico"}
      </button>
      {showTechnicalDetails && <pre>{result.details}</pre>}
    </section>
  );
}
