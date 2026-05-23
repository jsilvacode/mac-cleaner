import { Files, Gauge, Settings, Trash2 } from "lucide-react";
import type { AppView } from "../views/viewTypes";

type SidebarNavProps = {
  view: AppView;
  onSelectView: (view: AppView) => void;
};

export function SidebarNav({ view, onSelectView }: SidebarNavProps) {
  return (
    <nav className="nav-stack" aria-label="Principal">
      <button type="button" className={`nav-item ${view === "overview" ? "active" : ""}`} onClick={() => onSelectView("overview")}>
        <Gauge size={17} /> Inicio
      </button>
      <button type="button" className={`nav-item ${view === "clean" ? "active" : ""}`} onClick={() => onSelectView("clean")}>
        <Trash2 size={17} /> Limpiar
      </button>
      <button type="button" className={`nav-item ${view === "uninstall" ? "active" : ""}`} onClick={() => onSelectView("uninstall")}>
        <Trash2 size={17} /> Desinstalar
      </button>
      <button type="button" className={`nav-item ${view === "files" ? "active" : ""}`} onClick={() => onSelectView("files")}>
        <Files size={17} /> Espacio
      </button>
      <button type="button" className={`nav-item ${view === "settings" ? "active" : ""}`} onClick={() => onSelectView("settings")}>
        <Settings size={17} /> Ajustes
      </button>
    </nav>
  );
}
