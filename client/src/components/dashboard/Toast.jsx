function Toast({ toast, onClose }) {
  if (!toast) {
    return null;
  }

  return (
    <div className={`dashboard-toast toast-${toast.type || "info"}`}>
      <div>
        <strong>{toast.title}</strong>
        {toast.message ? <p>{toast.message}</p> : null}
      </div>

      <button type="button" onClick={onClose} aria-label="Close notification">
        x
      </button>
    </div>
  );
}

export default Toast;
