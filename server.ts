import express from "express";
import { createServer as createViteServer } from "vite";
import { Server } from "socket.io";
import http from "http";
import path from "path";

async function startServer() {
  const app = express();
  const PORT = 3000;

  const server = http.createServer(app);
  const io = new Server(server, {
    cors: {
      origin: "*",
      methods: ["GET", "POST"]
    }
  });

  // Simple in-memory state for prototype
  const rooms = new Map();
  const players = new Map();

  io.on("connection", (socket) => {
    console.log("Client connected:", socket.id);

    // Give default coins
    players.set(socket.id, { id: socket.id, username: `Player_${Math.floor(Math.random() * 1000)}`, coins: 10450 });
    
    // Send info immediately so the lobby can render
    socket.emit("player_info", players.get(socket.id));

    socket.on("get_rooms", (callback) => {
      const availableRooms = Array.from(rooms.values())
        .filter(r => r.gameState === 'waiting' && r.players.length < 4 && !r.isPrivate)
        .map(({ password, ...roomInfo }) => roomInfo);
      if (callback) callback({ rooms: availableRooms });
    });

    socket.on("create_room", (data, callback) => {
      const roomId = data.roomId || Math.random().toString(36).substring(2, 8);
      const isPrivate = !!data.password;
      const validBet = Math.max(100, Number(data.betAmount) || 0);

      rooms.set(roomId, {
        id: roomId,
        name: data.name || `Sala de ${players.get(socket.id).username}`,
        players: [{
          id: socket.id,
          name: players.get(socket.id).username,
          isBot: false
        }],
        gameState: 'waiting',
        pot: validBet * 4,
        betAmount: validBet,
        isPrivate: isPrivate,
        password: data.password || null
      });

      socket.join(roomId);
      io.to(roomId).emit("room_update", rooms.get(roomId));
      if (callback) callback({ success: true, room: { ...rooms.get(roomId), password: null } });
      
      // Notify others of new public room
      if (!isPrivate) {
        io.emit("rooms_list_update");
      }
    });

    socket.on("join_room", (data, callback) => {
      const roomId = data.roomId || data;
      // Handle simple string fallback
      const password = typeof data === 'object' ? data.password : null;

      if (!rooms.has(roomId)) {
        if (callback) callback({ success: false, error: 'Sala não encontrada' });
        return;
      }

      const room = rooms.get(roomId);
      
      if (room.isPrivate && room.password !== password) {
        if (callback) callback({ success: false, error: 'Senha incorreta' });
        return;
      }

      if (room.players.length >= 4) {
        if (callback) callback({ success: false, error: 'Sala cheia' });
        return;
      }

      socket.join(roomId);
      
      const playerInfo = players.get(socket.id);
      if (!room.players.find((p: any) => p.id === socket.id)) {
        room.players.push({
          id: socket.id,
          name: playerInfo.username,
          isBot: false
        });
      }
      
      io.to(roomId).emit("room_update", room);
      socket.emit("player_info", playerInfo);
      if (callback) callback({ success: true, room: { ...room, password: null } });
    });

    socket.on("add_bot", (roomId, callback) => {
      const room = rooms.get(roomId);
      if (!room) return;
      if (room.players[0].id !== socket.id) return; // Only host
      if (room.players.length >= 4) return;
      
      const botNames = ['Robô Alpha', 'Robô Beta', 'Robô Omega', 'Robô Delta'];
      const currentBots = room.players.filter((p: any) => p.isBot).length;
      
      room.players.push({
        id: `bot_${Math.random().toString(36).substring(7)}`,
        name: botNames[currentBots % botNames.length],
        isBot: true
      });
      io.to(roomId).emit("room_update", room);
      if (callback) callback({ success: true });
    });

    socket.on("start_game", (roomId, callback) => {
      const room = rooms.get(roomId);
      if (!room || room.players[0].id !== socket.id) {
         if (callback) callback({ success: false, error: 'Não autorizado' });
         return;
      }
      
      const humansCount = room.players.filter((p: any) => !p.isBot).length;
      if (humansCount < 2 && room.players.length < 2) {
         if (callback) callback({ success: false, error: 'Mínimo de 2 jogadores reais' });
         return;
      }
      
      if (room.players.length < 2) {
         if (callback) callback({ success: false, error: 'Mínimo de 2 jogadores' });
         return;
      }

      room.gameState = 'playing';
      
      // Assign Colors
      const colors = ['RED', 'GREEN', 'YELLOW', 'BLUE'];
      let shuffled = [...colors].sort(() => 0.5 - Math.random());
      
      room.players.forEach((p: any, index: number) => {
         p.color = shuffled[index];
      });

      // To find the first turn, we find which assigned color is first in the traditional ORDER
      const activeColors = room.players.map((p: any) => p.color);
      const firstTurn = colors.filter(c => activeColors.includes(c))[0];

      io.to(roomId).emit("game_started", { room, turn: firstTurn });
      io.emit("rooms_list_update"); // To hide from public list
      if (callback) callback({ success: true });
    });

    // Multiplayer sync events
    socket.on("roll_dice", (data) => {
      // data: { roomId, result }
      socket.to(data.roomId).emit("dice_rolled", data);
    });

    socket.on("move_pawn", (data) => {
      socket.to(data.roomId).emit("pawn_moved", data);
    });
    
    socket.on("next_turn", (data) => {
      socket.to(data.roomId).emit("turn_changed", data);
    });

    socket.on("voice_signal", (data) => {
      socket.to(data.roomId).emit("voice_signal", { senderId: socket.id, ...data });
    });

    socket.on("send_message", (data) => {
      // data: { roomId, message }
      const player = players.get(socket.id);
      io.to(data.roomId).emit("receive_message", {
        id: Date.now().toString(),
        sender: player.username,
        text: data.message,
        timestamp: Date.now()
      });
    });

    // WebRTC Signaling
    socket.on("webrtc_offer", (data) => {
      socket.to(data.roomId).emit("webrtc_offer", { sender: socket.id, offer: data.offer });
    });
    
    socket.on("webrtc_answer", (data) => {
      socket.to(data.roomId).emit("webrtc_answer", { sender: socket.id, answer: data.answer });
    });
    
    socket.on("webrtc_ice_candidate", (data) => {
      socket.to(data.roomId).emit("webrtc_ice_candidate", { sender: socket.id, candidate: data.candidate });
    });

    socket.on("disconnect", () => {
      players.delete(socket.id);
      // Clean up rooms
      rooms.forEach((room, roomId) => {
        if (room.players.find((p: any) => p.id === socket.id)) {
          room.players = room.players.filter((p: any) => p.id !== socket.id);
          io.to(roomId).emit("room_update", room);
        }
      });
      console.log("Client disconnected:", socket.id);
    });
  });

  // API Routes
  app.get("/api/health", (req, res) => {
    res.json({ status: "ok" });
  });

  // Vite middleware
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  server.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://0.0.0.0:${PORT}`);
  });
}

startServer();
