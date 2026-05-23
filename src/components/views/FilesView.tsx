import type { LargeFilesThreshold } from "../../types/cleaner";

type FilesViewProps = {
  loading: boolean;
  threshold: LargeFilesThreshold;
  onFindLargeFiles: () => void;
  onGetTopDirs: () => void;
};

export function FilesView({ loading, threshold, onFindLargeFiles, onGetTopDirs }: FilesViewProps) {
  return (
    <>
      <section className="section-heading">
        <div>
          <p className="eyebrow muted">Espacio</p>
          <h2>Archivos grandes y carpetas pesadas</h2>
        </div>
        <span>Complemento para recuperar espacio</span>
      </section>

      <section className="command-strip">
        <button disabled={loading} onClick={onFindLargeFiles}>
          Archivos grandes ({threshold}+)
        </button>
        <button disabled={loading} onClick={onGetTopDirs}>
          Carpetas pesadas
        </button>
      </section>
    </>
  );
}
