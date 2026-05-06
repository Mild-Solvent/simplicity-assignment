import { useEffect, useRef, useState } from 'react';
import { useWebSocket } from '../hooks/useWebSocket';

export default function NotificationToast() {
  const [toasts, setToasts] = useState([]);
  const idRef = useRef(0);

  const removeToast = (id) =>
    setToasts((prev) => prev.filter((t) => t.id !== id));

  useWebSocket((payload) => {
    if (payload.type === 'NEW_ANNOUNCEMENT') {
      const id = ++idRef.current;
      const title = payload.data?.title ?? 'Untitled';

      setToasts((prev) => [
        ...prev,
        { id, title },
      ]);

      // Auto-dismiss after 4 s
      setTimeout(() => removeToast(id), 4000);
    }
  });

  if (toasts.length === 0) return null;

  return (
    <div className="toast-container">
      {toasts.map((t) => (
        <div key={t.id} className="toast">
          <span className="toast-icon">🔔</span>
          <span>
            New announcement published:<br />
            <strong>{t.title}</strong>
          </span>
          <button className="toast-close" onClick={() => removeToast(t.id)}>×</button>
        </div>
      ))}
    </div>
  );
}
