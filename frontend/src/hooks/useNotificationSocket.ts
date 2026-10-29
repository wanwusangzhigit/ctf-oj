import { useEffect } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { useAuthStore } from '@/stores/auth';

interface NotificationEvent {
  type: string;
  payload?: { id?: number };
}

export function useNotificationSocket() {
  const qc = useQueryClient();
  const user = useAuthStore((s) => s.user);

  useEffect(() => {
    if (!user) return;

    let socket: WebSocket | null = null;
    let retry: ReturnType<typeof setTimeout> | null = null;
    let closed = false;

    const connect = () => {
      const proto = window.location.protocol === 'https:' ? 'wss' : 'ws';
      const url = `${proto}://${window.location.host}/api/v1/realtime`;
      socket = new WebSocket(url);

      socket.onmessage = (msg) => {
        try {
          const ev = JSON.parse(msg.data as string) as NotificationEvent;
          if (ev.type === 'notification') {
            qc.invalidateQueries({ queryKey: ['notifications-unread'] });
            qc.invalidateQueries({ queryKey: ['notifications-recent'] });
            qc.invalidateQueries({ queryKey: ['notifications'] });
          }
        } catch {
          // ignore malformed frames
        }
      };

      socket.onclose = () => {
        if (!closed) retry = setTimeout(connect, 5000);
      };
    };

    connect();

    return () => {
      closed = true;
      if (retry) clearTimeout(retry);
      socket?.close();
    };
  }, [user, qc]);
}
