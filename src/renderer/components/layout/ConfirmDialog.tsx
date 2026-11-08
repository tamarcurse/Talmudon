type Props = {
  title: string
  message: string
  confirmLabel: string
  cancelLabel: string
  onConfirm: () => void
  onCancel: () => void
}

function ConfirmDialog({ title, message, confirmLabel, cancelLabel, onConfirm, onCancel }: Props) {
  return (
    <div className="fixed inset-0 z-10 flex items-center justify-center bg-slate-900/30 p-4 backdrop-blur-sm">
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="confirm-title"
        className="card w-full max-w-md space-y-4 p-6 shadow-xl"
      >
        <h2 id="confirm-title" className="text-xl font-bold text-ink">
          {title}
        </h2>
        <p className="text-sm text-muted">{message}</p>
        <div className="flex justify-end gap-3">
          <button type="button" onClick={onCancel} className="btn-secondary">
            {cancelLabel}
          </button>
          <button type="button" onClick={onConfirm} className="btn-primary">
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  )
}

export default ConfirmDialog
