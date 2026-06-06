'use client';
import { useEffect, useRef, useState } from 'react';
import { io } from 'socket.io-client';
import { useSearchParams, useParams } from 'next/navigation';

export default function VideoCallPage() {
  const { username } = useParams<{ username: string }>();
  const searchParams = useSearchParams();
  const isIncoming = searchParams.get('incoming') === '1';
  const remotePeerId = searchParams.get('peer');

  const localVideoRef = useRef<HTMLVideoElement>(null);
  const remoteVideoRef = useRef<HTMLVideoElement>(null);
  const peerRef = useRef<any>(null);
  const socketRef = useRef<any>(null);
  const streamRef = useRef<MediaStream | null>(null);

  const [status, setStatus] = useState(isIncoming ? 'Connecting…' : 'Calling…');
  const [callActive, setCallActive] = useState(false);
  const [muted, setMuted] = useState(false);
  const [videoOff, setVideoOff] = useState(false);

  useEffect(() => {
    async function start() {
      // Get auth token via API (cookie is httpOnly, can't read via document.cookie)
      const tokenRes = await fetch('/api/auth/token');
      if (!tokenRes.ok) { setStatus('Not authenticated'); return; }
      const { token } = await tokenRes.json();

      let stream: MediaStream;
      try {
        stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
      } catch {
        setStatus('Camera/mic access denied');
        return;
      }
      streamRef.current = stream;
      if (localVideoRef.current) localVideoRef.current.srcObject = stream;

      const socket = io({ auth: { token }, transports: ['polling'] });
      socketRef.current = socket;

      socket.on('connect', () => console.log('[Video] Socket connected:', socket.id));
      socket.on('connect_error', (e) => console.error('[Video] Socket error:', e.message));

      const { Peer } = await import('peerjs');
      const peer = new Peer("", {
        host: window.location.hostname,
        port: window.location.port ? parseInt(window.location.port) : (window.location.protocol === "https:" ? 443 : 80),
        path: "/peerjs",
        secure: window.location.protocol === "https:",
        config: {
          iceServers: [
            { urls: 'stun:stun.l.google.com:19302' },
            { urls: 'stun:stun1.l.google.com:19302' },
            { urls: 'stun:stun2.l.google.com:19302' },
          ],
        },
      });
      peerRef.current = peer;

      peer.on('open', async (myPeerId: string) => {
        console.log('[Video] PeerJS open, my ID:', myPeerId);
        if (isIncoming && remotePeerId) {
          const call = peer.call(remotePeerId, stream);
          call.on('stream', (remoteStream: MediaStream) => {
            if (remoteVideoRef.current) remoteVideoRef.current.srcObject = remoteStream;
            setStatus('Connected ✨');
            setCallActive(true);
          });
        } else {
          const res = await fetch(`/api/users/${username}`);
          if (!res.ok) { setStatus(`User "${username}" not found`); return; }
          const targetUser = await res.json();
          console.log('[Video] Calling user:', targetUser);
          socket.emit('call_user', { to_user_id: targetUser.id, peer_id: myPeerId });
          setStatus(`Calling ${targetUser.first_name}…`);
        }
      });

      peer.on('error', (err: any) => {
        console.error('[Video] PeerJS error:', err);
        setStatus(`Connection error: ${err.type}`);
      });

      peer.on('call', (call: any) => {
        call.answer(stream);
        call.on('stream', (remoteStream: MediaStream) => {
          if (remoteVideoRef.current) remoteVideoRef.current.srcObject = remoteStream;
          setStatus('Connected ✨');
          setCallActive(true);
        });
      });

      socket.on('call_rejected', () => setStatus('Call declined'));
      socket.on('call_ended', () => { setStatus('Call ended'); setCallActive(false); });
    }

    start();

    return () => {
      streamRef.current?.getTracks().forEach(t => t.stop());
      peerRef.current?.destroy();
      socketRef.current?.disconnect();
    };
  }, []);

  function endCall() {
    socketRef.current?.disconnect();
    streamRef.current?.getTracks().forEach(t => t.stop());
    window.close();
  }

  function toggleMute() {
    streamRef.current?.getAudioTracks().forEach(t => { t.enabled = !t.enabled; });
    setMuted(m => !m);
  }

  function toggleVideo() {
    streamRef.current?.getVideoTracks().forEach(t => { t.enabled = !t.enabled; });
    setVideoOff(v => !v);
  }

  return (
    <div className="min-h-screen bg-gray-900 flex flex-col items-center justify-center p-4">
      <h1 className="text-white font-bold text-lg mb-4">
        {callActive ? `In call with ${username}` : status}
      </h1>
      <div className="relative w-full max-w-2xl aspect-video bg-black rounded-2xl overflow-hidden mb-4">
        <video ref={remoteVideoRef} autoPlay playsInline className="w-full h-full object-cover" />
        <video ref={localVideoRef} autoPlay playsInline muted className="absolute bottom-3 right-3 w-32 rounded-xl border-2 border-white shadow-lg" />
        {!callActive && (
          <div className="absolute inset-0 flex items-center justify-center">
            <p className="text-white/60 text-sm">{status}</p>
          </div>
        )}
      </div>
      <div className="flex gap-3">
        <button onClick={toggleMute} className={`w-12 h-12 rounded-full flex items-center justify-center text-xl transition ${muted ? 'bg-red-500 text-white' : 'bg-white/20 text-white hover:bg-white/30'}`}>
          {muted ? '🔇' : '🎤'}
        </button>
        <button onClick={toggleVideo} className={`w-12 h-12 rounded-full flex items-center justify-center text-xl transition ${videoOff ? 'bg-red-500 text-white' : 'bg-white/20 text-white hover:bg-white/30'}`}>
          {videoOff ? '📵' : '📹'}
        </button>
        <button onClick={endCall} className="w-12 h-12 rounded-full bg-red-500 flex items-center justify-center text-xl text-white hover:bg-red-600 transition">
          📵
        </button>
      </div>
    </div>
  );
}
