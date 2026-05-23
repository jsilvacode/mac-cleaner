import { AnimatePresence, motion } from "framer-motion";
import { X } from "lucide-react";

export type ConfirmTone = "warning" | "danger";

export type ConfirmDialogState = {
  title: string;
  message: string;
  confirmLabel: string;
  tone: ConfirmTone;
  onConfirm: () => void;
};

type ConfirmDialogProps = {
  dialog: ConfirmDialogState | null;
  onClose: () => void;
};

export function ConfirmDialog({ dialog, onClose }: ConfirmDialogProps) {
  return (
    <AnimatePresence>
      {dialog && (
        <motion.div
          className="modal-overlay"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          onClick={onClose}
        >
          <motion.section
            className="confirm-modal"
            initial={{ opacity: 0, y: 18, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 12, scale: 0.98 }}
            transition={{ duration: 0.2, ease: "easeOut" }}
            onClick={(event) => event.stopPropagation()}
            role="dialog"
            aria-modal="true"
            aria-labelledby="confirm-modal-title"
          >
            <div className="confirm-header">
              <h2 id="confirm-modal-title">{dialog.title}</h2>
              <button type="button" className="icon-only" onClick={onClose} aria-label="Cerrar">
                <X size={16} />
              </button>
            </div>
            <p>{dialog.message}</p>
            <div className="confirm-actions">
              <button type="button" onClick={onClose}>
                Cancelar
              </button>
              <button
                type="button"
                className={dialog.tone === "danger" ? "danger-action" : "warning-action"}
                onClick={() => {
                  const action = dialog.onConfirm;
                  onClose();
                  action();
                }}
              >
                {dialog.confirmLabel}
              </button>
            </div>
          </motion.section>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
