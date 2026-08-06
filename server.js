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

  // Draw & Guess game routes (running in this same process) need to push
  // socket events after a DB write — e.g. privately telling the drawer the
  // secret word. Sharing `io` via globalThis is the standard way a custom
  // Next.js server exposes its long-lived socket instance to API routes.
  globalThis.__gameIO = io;

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

  // Hangout Room presence: roomId -> Map<userId, {x,y,facing,first_name,profile_picture}>.
  // hangout:move is a pure relay with no server-side memory, so a client that
  // joins a room only learns where OTHER players are once those players next
  // move — someone standing still (e.g. chatting) stays invisible to anyone
  // who joins after them. Tracking last-known position here lets a joining
  // client be sent an immediate snapshot instead of waiting on movement.
  const hangoutPresence = new Map();

  io.on('connection', (socket) => {
    const userId = socket.user.id;
    socket.join(`user:${userId}`);
    // Family Chat is a single shared room, not per-conversation like DMs —
    // every authenticated connection with the family flag just joins it, no
    // explicit join/leave event needed. Posting goes through the REST route
    // (app/api/family-chat/route.ts), which pushes here after persisting.
    // Gating on socket.user.family (baked into the JWT at login) rather than
    // a DB check here — this file has no DB access of its own. Tokens signed
    // before this field existed decode with family === undefined, not 1, so
    // this fails open (only an explicit 0 excludes) instead of locking out
    // everyone with a pre-existing login.
    if (socket.user.family !== 0) socket.join('family_chat');
    socket.hangoutRooms = new Set();
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

    // Draw & Guess — ephemeral relay only. Turn state (who's currently
    // drawing) lives in app/lib/draw-guess.ts, written by the Next.js API
    // routes that own the actual game logic; this just checks the sender's
    // JWT-verified identity against it before re-broadcasting.
    //
    // Strokes themselves were pure relay too (no server memory), so anyone
    // who joined mid-round, refreshed, or reconnected saw a blank canvas and
    // only picked up strokes drawn after they (re)connected — the drawing
    // looked like it was arriving "late" or missing entirely. gameStrokes
    // keeps the current round's strokes in memory (shared with
    // app/lib/draw-guess.ts via globalThis, which clears it on each new
    // round) so a joining client can be replayed the round so far.
    if (!globalThis.__gameStrokes) globalThis.__gameStrokes = new Map();
    const gameStrokes = globalThis.__gameStrokes;

    socket.on('game:join_room', ({ room_id }) => {
      socket.join(`game:${room_id}`);
      const history = gameStrokes.get(room_id);
      if (history && history.length > 0) socket.emit('game:stroke_history', { strokes: history });
    });
    socket.on('game:leave_room', ({ room_id }) => {
      socket.leave(`game:${room_id}`);
    });
    socket.on('game:draw_stroke', ({ room_id, stroke }) => {
      const state = globalThis.__gameRoomState?.get(room_id);
      if (!state || state.drawerId !== userId) return;
      if (!gameStrokes.has(room_id)) gameStrokes.set(room_id, []);
      gameStrokes.get(room_id).push(stroke);
      socket.to(`game:${room_id}`).emit('game:draw_stroke', { stroke });
    });
    socket.on('game:clear_canvas', ({ room_id }) => {
      const state = globalThis.__gameRoomState?.get(room_id);
      if (!state || state.drawerId !== userId) return;
      gameStrokes.set(room_id, []);
      socket.to(`game:${room_id}`).emit('game:clear_canvas');
    });

    // Rock-Paper-Scissors — just room membership. Picks are never relayed
    // client-to-client (that would leak a move to the opponent before they've
    // locked in their own) — they go through the pick API route, which
    // resolves the round and pushes the reveal via this same shared `io`.
    socket.on('rps:join_room', ({ room_id }) => {
      socket.join(`rps:${room_id}`);
    });
    socket.on('rps:leave_room', ({ room_id }) => {
      socket.leave(`rps:${room_id}`);
    });

    // Trivia Duel — same shape as RPS: just room membership, no relayed
    // client data. Round state and reveals are entirely server-authoritative
    // (app/lib/trivia-game.ts), reached from the answer API route; a
    // reconnecting client gets the in-progress question replayed via the
    // room's GET route rather than a socket event, since it's naturally
    // request/response (no push needed for a one-time catch-up read).
    socket.on('trivia:join_room', ({ room_id }) => {
      socket.join(`trivia:${room_id}`);
    });
    socket.on('trivia:leave_room', ({ room_id }) => {
      socket.leave(`trivia:${room_id}`);
    });

    // Hangout Room — pure relays. A client reports its own position; there is
    // no secrecy/fairness problem with movement in a low-stakes shared space,
    // so unlike game:draw_stroke there is no authorization check here.
    // Decoration placement/removal and background changes are NOT raw socket
    // events — they go through validated Next.js API routes (allowlist check,
    // bounds check, host-only gate), which then push the resulting event via
    // this same shared `io`, exactly like hangout:room_updated does below.
    socket.on('hangout:join_room', ({ room_id }) => {
      socket.join(`hangout:${room_id}`);
      socket.hangoutRooms.add(room_id);
      const present = hangoutPresence.get(room_id);
      if (present && present.size > 0) {
        const snapshot = [...present.entries()]
          .filter(([uid]) => uid !== userId)
          .map(([uid, p]) => ({ user_id: uid, ...p }));
        if (snapshot.length > 0) socket.emit('hangout:room_snapshot', snapshot);
      }
    });
    socket.on('hangout:leave_room', ({ room_id }) => {
      socket.to(`hangout:${room_id}`).emit('hangout:user_left', { user_id: userId });
      socket.leave(`hangout:${room_id}`);
      socket.hangoutRooms.delete(room_id);
      hangoutPresence.get(room_id)?.delete(userId);
    });
    socket.on('hangout:move', ({ room_id, x, y, facing }) => {
      // Basic input hygiene, not anti-cheat: drop malformed payloads so they
      // can't crash another client's render loop downstream.
      if (typeof x !== 'number' || typeof y !== 'number') return;
      // Include name/picture from the verified JWT so receiving clients never
      // need to cross-reference a possibly-stale local player list to label
      // a newly-joined mover.
      const facingVal = facing ?? null;
      if (!hangoutPresence.has(room_id)) hangoutPresence.set(room_id, new Map());
      hangoutPresence.get(room_id).set(userId, {
        x, y, facing: facingVal,
        first_name: socket.user.first_name, profile_picture: socket.user.profile_picture,
      });
      socket.to(`hangout:${room_id}`).emit('hangout:move', {
        user_id: userId, x, y, facing: facingVal, t: Date.now(),
        first_name: socket.user.first_name, profile_picture: socket.user.profile_picture,
      });
    });

    socket.on('disconnect', () => {
      console.log(`[SOCKET] Disconnected: ${socket.user.username}`);
      // hangout:leave_room only fires on an explicit "Leave room" click —
      // closing the tab or losing connection never sends it, so without this
      // the player's avatar would just sit there for other clients until the
      // opacity fade eventually hides it.
      for (const room_id of socket.hangoutRooms) {
        hangoutPresence.get(room_id)?.delete(userId);
        socket.to(`hangout:${room_id}`).emit('hangout:user_left', { user_id: userId });
      }
    });
  });

  const port = parseInt(process.env.PORT || '3006', 10);
  httpServer.listen(port, () => {
    console.log(`> Emma's Space ready on port ${port}`);
    console.log(`> PeerJS server at /peerjs`);
  });
});
