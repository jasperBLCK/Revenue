import { useEffect, useRef, useState } from "react";
import { wsUrl } from "../api/client";
import type { LiveEvent } from "../api/types";

/**
 * Opens a WebSocket to the backend real-time stream and invokes `onEvent`
 * for each event. Auto-reconnects with a short backoff. Returns whether the
 * socket is currently connected (for a live indicator dot).
 */
export function useLiveFeed(
  token: string | null,
  onEvent: (event: LiveEvent) => void,
): boolean {
  const [connected, setConnected] = useState(false);
  // Keep the latest callback without re-opening the socket on every render.
  const handlerRef = useRef(onEvent);
  handlerRef.current = onEvent;

  useEffect(() => {
    if (!token) return;
    let socket: WebSocket | null = null;
    let reconnectTimer: ReturnType<typeof setTimeout> | undefined;
    let closed = false;

    const connect = () => {
      socket = new WebSocket(wsUrl(token));

      socket.onopen = () => setConnected(true);
      socket.onclose = () => {
        setConnected(false);
        if (!closed) reconnectTimer = setTimeout(connect, 1500);
      };
      socket.onerror = () => socket?.close();
      socket.onmessage = (raw) => {
        try {
          handlerRef.current(JSON.parse(raw.data) as LiveEvent);
        } catch {
          // ignore malformed frames
        }
      };
    };

    connect();

    return () => {
      closed = true;
      if (reconnectTimer) clearTimeout(reconnectTimer);
      socket?.close();
    };
  }, [token]);

  return connected;
}
