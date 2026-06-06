const { createServer } = require('http');
const { parse } = require('url');
const next = require('next');
const { Server } = require('socket.io');
const jwt = require('jsonwebtoken');
const { ExpressPeerServer } = require('peer');
const express = require('express');

const dev = process.env.NODE_ENV !== 'production';
const app = next({ dev });
const handle = app.getRequestHandler();

app.prepare().then(() => {
  const expressApp = express();

  const httpServer = createServer((req, res) => {
    const url = req.url || '';
    if (url.startsWith('/peerjs')) {
      // PeerJS HTTP requests → Express
      expressApp(req, res);
    } else if (!url.startsWith('/socket.io')) {
      // Everything except /socket.io → Next.js
      // Socket.io's own 'request' listener handles /socket.io polling requests
      const parsedUrl = parse(url, true);
      handle(req, res, parsedUrl);
    }
    // /socket.io paths: do nothing here — Socket.io handles via its own listener
  });

  // Create Socket.io BEFORE PeerJS so its WebSocket upgrade handler registers first,
  // preventing PeerJS from intercepting /socket.io WebSocket upgrades.
  const io = new Server(httpServer, {
    cors: { origin: '*', methods: ['GET', 'POST'] },
  });

  // Mount PeerJS AFTER Socket.io
  const peerServer = ExpressPeerServer(httpServer, { path: '/' });
  expressApp.use('/peerjs', peerServer);

  io.use((socket, next) => {
    const token = socket.handshake.auth.token;
    if (!token) return next(new Error('Unauthorized'));
    try {
      const payload = jwt.verify(token, process.env.JWT_SECRET);
      socket.user = payload;
      next();
    } catch {
      next(new Error('Invalid token'));
    }
  });

  io.on('connection', (socket) => {
    const userId = socket.user.id;
    socket.join(`user:${userId}`);
    console.log(`[SOCKET] Connected: ${socket.user.username} (id:${userId}) via ${socket.conn.transport.name}`);

    socket.on('send_message', ({ to_user_id, conversation_id, content }) => {
      io.to(`user:${to_user_id}`).emit('new_message', {
        conversation_id, sender_id: userId, sender: socket.user,
        content, created_at: new Date().toISOString(),
      });
      io.to(`user:${to_user_id}`).emit('notification', {
        type: 'message',
        actor_first_name: socket.user.first_name,
        actor_username: socket.user.username,
        actor_profile_picture: socket.user.profile_picture,
        message_preview: content.substring(0, 60),
        read_at: null,
        created_at: new Date().toISOString(),
      });
    });

    socket.on('call_user', ({ to_user_id, peer_id }) => {
      console.log(`[CALL] ${socket.user.username} calling user:${to_user_id} peer:${peer_id}`);
      const room = `user:${to_user_id}`;
      const sockets = io.sockets.adapter.rooms.get(room);
      console.log(`[CALL] Room ${room} has ${sockets ? sockets.size : 0} socket(s)`);
      io.to(room).emit('incoming_call', {
        from_user_id: userId, peer_id,
        from_username: socket.user.username,
        from_first_name: socket.user.first_name,
      });
    });

    socket.on('call_accepted', ({ to_user_id, peer_id }) => {
      io.to(`user:${to_user_id}`).emit('call_accepted', { peer_id });
    });
    socket.on('call_rejected', ({ to_user_id }) => {
      io.to(`user:${to_user_id}`).emit('call_rejected');
    });
    socket.on('call_ended', ({ to_user_id }) => {
      io.to(`user:${to_user_id}`).emit('call_ended');
    });
    socket.on('disconnect', () => {
      console.log(`[SOCKET] Disconnected: ${socket.user.username}`);
    });
  });

  const port = parseInt(process.env.PORT || '3006', 10);
  httpServer.listen(port, () => {
    console.log(`> Emma's Space ready on port ${port}`);
    console.log(`> PeerJS server at /peerjs`);
  });
});
