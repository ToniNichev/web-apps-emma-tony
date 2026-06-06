'use client';
import { useEffect, useRef, useState } from 'react';
import { useAppSocket } from './SocketProvider';

interface IncomingCall {
  from_user_id: number;
  peer_id: string;
  from_username: string;
  from_first_name: string;
}

export default function GlobalCallManager() {
  const socket = useAppSocket();
  const [incomingCall, setIncomingCall] = useState<IncomingCall | null>(null);

  useEffect(() => {
    if (!socket) return;

    function onIncomingCall(data: IncomingCall) {
      console.log('[GlobalCall] Incoming call from', data.from_username);
      setIncomingCall(data);
    }
    function onCallEnded() { setIncomingCall(null); }

    socket.on('incoming_call', onIncomingCall);
    socket.on('call_ended', onCallEnded);

    return () => {
      socket.off('incoming_call', onIncomingCall);
      socket.off('call_ended', onCallEnded);
    };
  }, [socket]);

  function acceptCall() {
    if (!incomingCall) return;
    window.open(
      `/video/${incomingCall.from_username}?incoming=1&peer=${incomingCall.peer_id}`,
      '_blank',
      'width=900,height=700'
    );
    setIncomingCall(null);
  }

  function declineCall() {
    if (!incomingCall) return;
    socket?.emit('call_rejected', { to_user_id: incomingCall.from_user_id });
    setIncomingCall(null);
  }

  if (!incomingCall) return null;

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-[200]">
      <div className="bg-white rounded-2xl shadow-2xl p-8 text-center max-w-sm w-full mx-4">
        <p className="text-5xl mb-4">📹</p>
        <p className="font-bold text-xl mb-1">{incomingCall.from_first_name} is calling…</p>
        <p className="text-gray-400 text-sm mb-6">@{incomingCall.from_username}</p>
        <div className="flex gap-3 justify-center">
          <button
            onClick={acceptCall}
            className="bg-gradient-to-r from-pink-400 to-purple-400 text-white font-semibold px-8 py-3 rounded-full text-sm hover:opacity-90 transition"
          >
            Accept
          </button>
          <button
            onClick={declineCall}
            className="bg-red-500 text-white font-semibold px-8 py-3 rounded-full text-sm hover:bg-red-600 transition"
          >
            Decline
          </button>
        </div>
      </div>
    </div>
  );
}
