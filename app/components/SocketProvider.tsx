'use client';
import { createContext, useContext, useEffect, useState } from 'react';
import { io, Socket } from 'socket.io-client';

const SocketContext = createContext<Socket | null>(null);

export function useAppSocket() {
  return useContext(SocketContext);
}

export default function SocketProvider({ token, children }: { token: string; children: React.ReactNode }) {
  const [socket, setSocket] = useState<Socket | null>(null);

  useEffect(() => {
    if (!token) return;

    // Use polling only — PeerJS occupies the shared httpServer WebSocket upgrade
    // handler and causes frame corruption when Socket.io also uses WebSocket.
    // Long-polling has sub-100ms latency and is perfectly suitable here.
    const s = io({ auth: { token }, transports: ['polling'] });

    s.on('connect', () => console.log('[Socket] Connected:', s.id));
    s.on('connect_error', (e) => console.warn('[Socket] Error:', e.message));

    setSocket(s);

    return () => {
      s.disconnect();
      setSocket(null);
    };
  }, [token]);

  return <SocketContext.Provider value={socket}>{children}</SocketContext.Provider>;
}
