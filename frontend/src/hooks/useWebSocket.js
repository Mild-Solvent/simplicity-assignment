import { useEffect, useRef } from 'react';

const WS_URL = 'ws://localhost:3001';

/**
 * Connects to the WebSocket server and calls onMessage with parsed payload.
 * @param {(payload: {type: string, data: any}) => void} onMessage
 */
export function useWebSocket(onMessage) {
  const wsRef = useRef(null);
  const onMessageRef = useRef(onMessage);

  useEffect(() => {
    onMessageRef.current = onMessage;
  }, [onMessage]);

  useEffect(() => {
    let reconnectTimer;

    function connect() {
      const ws = new WebSocket(WS_URL);
      wsRef.current = ws;

      ws.onmessage = (event) => {
        try {
          const payload = JSON.parse(event.data);
          onMessageRef.current?.(payload);
        } catch {
          // ignore malformed messages
        }
      };

      ws.onclose = () => {
        // Reconnect after 3 seconds
        reconnectTimer = setTimeout(connect, 3000);
      };

      ws.onerror = () => {
        ws.close();
      };
    }

    connect();

    return () => {
      clearTimeout(reconnectTimer);
      wsRef.current?.close();
    };
  }, []);
}
