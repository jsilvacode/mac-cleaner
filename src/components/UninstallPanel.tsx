import type { ReactNode } from "react";

type UninstallPanelProps = {
  icon: ReactNode;
  title: string;
  body: string;
};

export function UninstallPanel({ icon, title, body }: UninstallPanelProps) {
  return (
    <article className="uninstall-panel">
      <div className="metric-icon">{icon}</div>
      <h3>{title}</h3>
      <p>{body}</p>
    </article>
  );
}
