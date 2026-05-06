import { useEffect, useRef } from 'react';

const WS_URL = 'ws://localhost:3001';

// ─── Module-level singleton ───────────────────────────────────────────────────
// One real WebSocket connection is shared across every hook instance (and across
// React StrictMode's double-mount). Listeners are plain callbacks stored in a Set;
// mounting/unmounting only adds or removes a callback — the socket itself is never
// duplicated.

let sharedWs = null;
const listeners = new Set();
let reconnectTimer = null;

function ensureConnected() {
  // Already connecting or open — nothing to do
  if (sharedWs && sharedWs.readyState <= WebSocket.OPEN) return;

  sharedWs = new WebSocket(WS_URL);

  sharedWs.onmessage = (event) => {
    try {
      const payload = JSON.parse(event.data);
      listeners.forEach((cb) => cb(payload));
    } catch {
      // ignore malformed messages
    }
  };

  sharedWs.onclose = () => {
    sharedWs = null;
    // Reconnect after a short delay if there are still active listeners
    if (listeners.size > 0) {
      reconnectTimer = setTimeout(ensureConnected, 3000);
    }
  };

  sharedWs.onerror = () => {
    sharedWs?.close();
  };
}

// ─── Hook ─────────────────────────────────────────────────────────────────────

/**
 * Subscribes to the shared WebSocket connection and calls onMessage with each
 * parsed payload. Safe against React StrictMode double-mounts: each mount/unmount
 * cycle only registers or removes a listener — it never opens a second socket.
 *
 * @param {(payload: {type: string, data: any}) => void} onMessage
 */
export function useWebSocket(onMessage) {
  const onMessageRef = useRef(onMessage);

  useEffect(() => {
    onMessageRef.current = onMessage;
  }, [onMessage]);

  useEffect(() => {
    // Stable callback wrapper so we can safely remove it from the Set on cleanup
    const cb = (payload) => onMessageRef.current?.(payload);

    listeners.add(cb);
    clearTimeout(reconnectTimer); // cancel any pending reconnect — we have a listener now
    ensureConnected();

    return () => {
      listeners.delete(cb);
      // If no listeners remain, let the socket close naturally on its own;
      // don't force-close — the server may still be mid-message.
    };
  }, []);
}
