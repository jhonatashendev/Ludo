import express from "express";
import { createServer as createViteServer } from "vite";
import { Server } from "socket.io";
import http from "http";
import path from "path";
import { canPlay, getAbsolutePosition, ABSOLUTE_SAFE_SQUARES } from './src/lib/ludoEngine';

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
  const usernameToSocket = new Map();
  
  function serverNextTurn(room: any) {
    const activeColors = room.players.map((p: any) => p.color).filter(Boolean);
    const ORDER = ['RED', 'GREEN', 'YELLOW', 'BLUE'];
    const colors = ORDER.filter((c) => activeColors.includes(c));
    if (colors.length === 0) return;

    let currentIdx = colors.indexOf(room.turn);
    if (currentIdx === -1) currentIdx = 0;
    
    let nextTurn = colors[(currentIdx + 1) % colors.length];
    const finishedPlayers = room.finishedPlayers || [];
    while (finishedPlayers.includes(nextTurn)) {
        currentIdx = colors.indexOf(nextTurn);
        nextTurn = colors[(currentIdx + 1) % colors.length];
    }
    
    room.turn = nextTurn;
    room.diceValue = null;
    io.to(room.id).emit("turn_changed", { roomId: room.id, turn: nextTurn });
  }

  function serverMovePawn(room: any, pawnId: string, diceResult: number) {
    const pawns = room.pawns;
    const pawn = pawns.find((p: any) => p.id === pawnId);
    if (!pawn || !canPlay(pawn, diceResult)) {
        serverNextTurn(room);
        setTimeout(() => serverBotLoop(room.id), 1000);
        return;
    }

    let newPos = pawn.position === -1 ? 0 : pawn.position + diceResult;
    let captured = false;

    if (newPos >= 0 && newPos <= 50) {
        const clone = { ...pawn, position: newPos };
        const myAbsPos = getAbsolutePosition(clone);
        if (!ABSOLUTE_SAFE_SQUARES.includes(myAbsPos)) {
            for (let i = 0; i < pawns.length; i++) {
                let p2 = pawns[i];
                if (p2.color !== pawn.color && p2.position >= 0 && p2.position <= 50 && getAbsolutePosition(p2) === myAbsPos) {
                    p2.position = -1;
                    captured = true;
                }
            }
        }
    }
    pawn.position = newPos;

    // Check game over
    const activeColors = room.players.map((p: any) => p.color).filter(Boolean);
    const finishedPlayers = room.finishedPlayers || [];
    const currentPlayerPawns = pawns.filter((p: any) => p.color === pawn.color);
    if (currentPlayerPawns.every((p: any) => p.position === 56)) {
        if (!finishedPlayers.includes(pawn.color)) finishedPlayers.push(pawn.color);
    }
    room.finishedPlayers = finishedPlayers;

    io.to(room.id).emit("pawn_moved", { roomId: room.id, pawnId, diceValue: diceResult });

    const finishThreshold = Math.min(2, activeColors.length - 1);

    if (finishedPlayers.length >= finishThreshold && activeColors.length > 1) {
        const remaining = activeColors.filter((c: string) => !finishedPlayers.includes(c));
        remaining.sort((a: string, b: string) => {
            const pawnsA = pawns.filter((p: any) => p.color === a).reduce((acc: number, p: any) => acc + (p.position === -1 ? -1 : p.position), 0);
            const pawnsB = pawns.filter((p: any) => p.color === b).reduce((acc: number, p: any) => acc + (p.position === -1 ? -1 : p.position), 0);
            return pawnsB - pawnsA;
        });
        room.finishedPlayers = [...finishedPlayers, ...remaining];
        room.gameState = 'finished';
        room.botLoopRunning = false;
        io.to(room.id).emit("room_update", room);
        return;
    }

    if (diceResult === 6 || captured) {
        room.diceValue = null;
        setTimeout(() => serverBotLoop(room.id), 1000);
    } else {
        serverNextTurn(room);
        setTimeout(() => serverBotLoop(room.id), 1000);
    }
  }

  function serverBotLoop(roomId: string) {
    const room = rooms.get(roomId);
    if (!room || room.gameState !== 'playing') {
       if (room) room.botLoopRunning = false;
       return;
    }

    // Is there any connected human?
    const humanCount = room.players.filter((p: any) => !p.isDisconnected && !p.id.startsWith('bot_') && !p.isBot).length;
    if (humanCount > 0) {
       room.botLoopRunning = false;
       return; // If some human is here, they will manage
    }

    const botColor = room.turn;
    const isBot = room.players.find((p: any) => p.color === botColor && p.isBot);
    if (!isBot) {
        serverNextTurn(room);
        setTimeout(() => serverBotLoop(roomId), 1000);
        return;
    }

    // Roll
    const diceResult = Math.floor(Math.random() * 6) + 1;
    room.diceValue = diceResult;
    io.to(roomId).emit("dice_rolled", { roomId, result: diceResult });
    
    setTimeout(() => {
        const room = rooms.get(roomId);
        if(!room || room.gameState !== 'playing') return;
        if(room.players.filter((p: any) => !p.isDisconnected && !p.id.startsWith('bot_')).length > 0) return;

        const pawns = room.pawns || [];
        const botPawns = pawns.filter((p: any) => p.color === botColor);
        const validMoves = botPawns.filter((p: any) => canPlay(p, diceResult));

        if (validMoves.length > 0) {
            const captureMoves = validMoves.filter((p: any) => {
                let newPos = p.position === -1 ? 0 : p.position + diceResult;
                if (newPos >= 0 && newPos <= 50) {
                    const clone = { ...p, position: newPos };
                    const myAbsPos = getAbsolutePosition(clone);
                    if (!ABSOLUTE_SAFE_SQUARES.includes(myAbsPos)) {
                        return pawns.some((p2: any) => p2.color !== botColor && p2.position >= 0 && p2.position <= 50 && getAbsolutePosition(p2) === myAbsPos);
                    }
                }
                return false;
            });
            const spawningMoves = validMoves.filter((p: any) => p.position === -1);
            const finishLineMoves = validMoves.filter((p: any) => p.position !== -1 && p.position + diceResult > 50);
            const fleeingMoves = validMoves.filter((p: any) => {
                if (p.position === -1 || p.position > 50) return false;
                const myAbs = getAbsolutePosition(p);
                if (ABSOLUTE_SAFE_SQUARES.includes(myAbs)) return false;
                return pawns.some((p2: any) => {
                    if (p2.color === botColor || p2.position < 0 || p2.position > 50) return false;
                    const enemyAbs = getAbsolutePosition(p2);
                    const diff = (myAbs - enemyAbs + 52) % 52;
                    return diff > 0 && diff <= 6;
                });
            });
            const mostAdvancedMoves = [...validMoves].sort((a: any, b: any) => b.position - a.position);

            const pawnToMove = captureMoves[0] || spawningMoves[0] || finishLineMoves[0] || fleeingMoves[0] || mostAdvancedMoves[0];

            serverMovePawn(room, pawnToMove.id, diceResult);
        } else {
            if (diceResult === 6) {
                room.diceValue = null;
                setTimeout(() => serverBotLoop(roomId), 1000);
            } else {
                serverNextTurn(room);
                setTimeout(() => serverBotLoop(roomId), 1000);
            }
        }
    }, 800);
  }

  io.on("connection", (socket) => {
    console.log("Client connected:", socket.id);

    // Give default initial name, but it will be updated by client
    const initialName = `Player_${Math.floor(Math.random() * 100000)}`;
    players.set(socket.id, { id: socket.id, username: initialName, coins: 10450 });
    usernameToSocket.set(initialName, socket.id);
    
    // Send info immediately so the lobby can render
    socket.emit("player_info", players.get(socket.id));

    socket.on("update_profile", (data, callback) => {
      const existingSocketId = usernameToSocket.get(data.username);
      if (existingSocketId && existingSocketId !== socket.id) {
        // Kick the OLD socket out
        io.to(existingSocketId).emit("force_disconnect", { reason: "Você acessou de outro local." });
        const oldSocket = io.sockets.sockets.get(existingSocketId);
        if (oldSocket) {
           oldSocket.disconnect(true);
        }
      }
      
      const oldPlayer = players.get(socket.id);
      if (oldPlayer && oldPlayer.username !== data.username) {
        usernameToSocket.delete(oldPlayer.username);
        // Rename in active rooms if any
        rooms.forEach((room) => {
          const p = room.players.find((rp: any) => rp.id === socket.id);
          if (p) {
             p.name = data.username;
             io.to(room.id).emit("room_update", room);
          }
        });
      }

      usernameToSocket.set(data.username, socket.id);
      
      if (oldPlayer) {
        oldPlayer.username = data.username;
        if (data.coins !== undefined) oldPlayer.coins = data.coins;
      }

      // Check if they have a disconnected spot in a playing room
      let activeRoomId = null;
      rooms.forEach((room, roomId) => {
        const spot = room.players.find((rp: any) => rp.name === data.username && rp.isDisconnected);
        if (spot) {
          activeRoomId = roomId;
        }
      });

      if (callback) callback({ success: true, activeRoomId });
      socket.emit("player_info", players.get(socket.id));
    });

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

    socket.on("bot_roll_dice", (data) => {
      socket.to(data.roomId).emit("dice_rolled", data);
    });

    socket.on("move_pawn", (data) => {
      socket.to(data.roomId).emit("pawn_moved", data);
    });
    
    socket.on("next_turn", (data) => {
      socket.to(data.roomId).emit("turn_changed", data);
    });

    socket.on("sync_state", (data) => {
      const room = rooms.get(data.roomId);
      if (room) {
         room.pawns = data.pawns;
         room.turn = data.turn;
         room.diceValue = data.diceValue;
      }
    });

    socket.on("play_again", (roomId) => {
      const room = rooms.get(roomId);
      if (room && room.gameState === 'finished') {
         room.gameState = 'waiting';
         room.finishedPlayers = [];
         room.botLoopRunning = false;
         
         // Only keep non-forfeited humans and bots
         room.players = room.players.filter((p: any) => !p.isForfeited);
         
         io.to(roomId).emit("room_update", room);
      }
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
    
    socket.on("leave_room", (roomId) => {
      const room = rooms.get(roomId);
      if (room) {
        const playerIndex = room.players.findIndex((p: any) => p.id === socket.id);
        if (playerIndex !== -1) {
          if (room.gameState === 'playing') {
             room.players[playerIndex].isDisconnected = true;
             room.players[playerIndex].isBot = true; 
             const humanCount = room.players.filter((p: any) => !p.isDisconnected && !p.id.startsWith('bot_') && !p.isBot).length;
             if (humanCount === 0 && !room.botLoopRunning) {
                 room.botLoopRunning = true;
                 serverBotLoop(roomId);
             }
          } else {
             room.players.splice(playerIndex, 1);
             if (room.players.length === 0) {
                rooms.delete(roomId);
             }
          }
          io.to(roomId).emit("room_update", room);
          io.emit("rooms_list_update");
        }
      }
      socket.leave(roomId);
    });

    socket.on("disconnect", () => {
      const playerInfo = players.get(socket.id);
      if (playerInfo) {
        usernameToSocket.delete(playerInfo.username);
      }
      players.delete(socket.id);

      // Clean up rooms
      rooms.forEach((room, roomId) => {
        const playerIndex = room.players.findIndex((p: any) => p.id === socket.id);
        if (playerIndex !== -1) {
          if (room.gameState === 'playing') {
             room.players[playerIndex].isDisconnected = true;
             room.players[playerIndex].isBot = true; 
             const humanCount = room.players.filter((p: any) => !p.isDisconnected && !p.id.startsWith('bot_') && !p.isBot).length;
             if (humanCount === 0 && !room.botLoopRunning) {
                 room.botLoopRunning = true;
                 serverBotLoop(roomId);
             }
          } else {
             room.players = room.players.filter((p: any) => p.id !== socket.id);
             if (room.players.length === 0) {
                rooms.delete(roomId);
             }
          }
          io.to(roomId).emit("room_update", room);
        }
      });
      console.log("Client disconnected:", socket.id);
    });

    socket.on("rejoin_room", (roomId, callback) => {
       const room = rooms.get(roomId);
       if (!room) {
          if (callback) callback({ success: false, error: 'Sala não encontrada' });
          return;
       }
       const playerInfo = players.get(socket.id);
       const spotIndex = room.players.findIndex((p: any) => p.name === playerInfo.username && p.isDisconnected);
       
       if (spotIndex !== -1) {
          // Reclaim spot
          room.players[spotIndex].id = socket.id;
          room.players[spotIndex].isBot = false;
          room.players[spotIndex].isDisconnected = false;
          socket.join(roomId);
          io.to(roomId).emit("room_update", room);
          if (callback) callback({ success: true, room: { ...room, password: null } });
       } else {
          if (callback) callback({ success: false, error: 'Vaga não encontrada' });
       }
    });

    socket.on("forfeit_room", (roomId, callback) => {
       const room = rooms.get(roomId);
       if (!room) return;
       const playerInfo = players.get(socket.id);
       const spotIndex = room.players.findIndex((p: any) => p.name === playerInfo.username);
       if (spotIndex !== -1) {
          room.players[spotIndex].name = `Robô (${playerInfo.username})`;
          room.players[spotIndex].isDisconnected = false; // it's completely a bot now
          room.players[spotIndex].isBot = true;
          room.players[spotIndex].isForfeited = true;
          io.to(roomId).emit("room_update", room);
          
          const humanCount = room.players.filter((p: any) => !p.isDisconnected && !p.id.startsWith('bot_') && !p.isBot).length;
          // If no other humans are connected, and all disconnected humans in fact forfeited...
          const potentialReconnects = room.players.filter((p: any) => (!p.id.startsWith('bot_') && p.isDisconnected && !p.isForfeited)).length;
          
          if (humanCount === 0 && potentialReconnects === 0 && room.gameState === 'playing') {
             room.botLoopRunning = false;
             rooms.delete(roomId);
             io.emit("rooms_list_update");
          } else if (humanCount === 0 && room.gameState === 'playing' && !room.botLoopRunning) {
             room.botLoopRunning = true;
             serverBotLoop(roomId);
          }
       }
       socket.leave(roomId);
       if (callback) callback({ success: true });
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
