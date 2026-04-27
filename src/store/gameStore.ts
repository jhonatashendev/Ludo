import { create } from 'zustand';
import { io, Socket } from 'socket.io-client';
import { Pawn, PlayerColor, initializePawns, canPlay, getAbsolutePosition, ABSOLUTE_SAFE_SQUARES } from '../lib/ludoEngine';
import { User } from 'firebase/auth';
import { doc, updateDoc } from 'firebase/firestore';
import { db } from '../lib/firebase';

export type Player = {
  id: string;
  username: string;
  coins: number;
};

export type Message = {
  id: string;
  sender: string;
  text: string;
  timestamp: number;
};

export type Room = {
  id: string;
  players: any[];
  gameState: 'waiting' | 'playing' | 'finished';
  pot: number;
};

interface GameState {
  socket: Socket | null;
  firebaseUser: User | null;
  isAuthReady: boolean;
  player: Player | null;
  room: Room | null;
  messages: Message[];
  voiceEnabled: boolean;
  soundEnabled: boolean;
  view: 'lobby' | 'store' | 'room' | 'leaderboard' | 'settings';
  isOffline: boolean;
  pawns: Pawn[];
  turn: PlayerColor;
  diceValue: number | null;
  isRolling: boolean;
  activeRoomId: string | null;
  betAmount: number;
  finishedPlayers: PlayerColor[];
  gameOverMessage: string | null;
  myColor: PlayerColor;
  setFirebaseUser: (user: User | null) => void;
  setAuthReady: (ready: boolean) => void;
  connect: () => void;
  getRooms: () => Promise<any[]>;
  createRoom: (data: { name?: string; password?: string; betAmount: number }) => Promise<any>;
  joinRoom: (roomId: string, password?: string) => Promise<any>;
  addBotOnline: () => void;
  startGameOnline: () => void;
  playAgain: () => void;
  rejoinRoom: () => Promise<void>;
  forfeitRoom: () => Promise<void>;
  startOfflineGame: (bet?: number) => void;
  leaveRoom: () => void;
  sendMessage: (text: string) => void;
  setView: (view: 'lobby' | 'store' | 'room' | 'leaderboard' | 'settings') => void;
  setVoiceEnabled: (enabled: boolean) => void;
  setSoundEnabled: (enabled: boolean) => void;
  addMessage: (msg: Message) => void;
  updateRoom: (room: Room) => void;
  setPlayer: (player: Player) => void;
  rollDice: () => void;
  movePawn: (pawnId: string) => void;
  applyMoveLocally: (pawnId: string, diceResult: number) => void;
  syncState: () => void;
  shouldManageTurn: () => boolean;
  nextTurn: () => void;
  playBotTurn: (color: PlayerColor) => void;
  setCredentials: (username: string, initialCoins?: number) => void;
  updateCoins: (coins: number) => void;
}

export const useGameStore = create<GameState>((set, get) => ({
  socket: null,
  firebaseUser: null,
  isAuthReady: false,
  player: null,
  room: null,
  messages: [],
  voiceEnabled: false,
  soundEnabled: true,
  view: 'lobby',
  isOffline: false,
  pawns: [],
  turn: 'RED',
  diceValue: null,
  isRolling: false,
  activeRoomId: null,
  betAmount: 0,
  finishedPlayers: [],
  gameOverMessage: null,
  myColor: 'RED',

  setFirebaseUser: (user) => set({ firebaseUser: user }),
  setAuthReady: (ready) => set({ isAuthReady: ready }),

  setCredentials: (username, initialCoins = 10000) => {
    // Override socket's mocked player if they log in via Firebase
    set((state) => ({
      player: state.player ? { ...state.player, username, coins: initialCoins } : { id: 'local', username, coins: initialCoins }
    }));
    const { socket } = get();
    if (socket) {
      socket.emit('update_profile', { username, coins: initialCoins }, (res: any) => {
         if (res && res.success && res.activeRoomId) {
            set({ activeRoomId: res.activeRoomId });
         }
      });
    }
  },

  updateCoins: (newCoins) => {
    const { firebaseUser, player } = get();
    if (firebaseUser && player && player.coins !== newCoins) {
       updateDoc(doc(db, 'users', firebaseUser.uid), { coins: newCoins }).catch(console.error);
    }
    set((state) => ({
      player: state.player ? { ...state.player, coins: newCoins } : null
    }));
  },

  connect: () => {
    if (get().socket) return;
    const isDev = (import.meta as any).env.DEV;
    const socketUrl = isDev ? `http://${window.location.hostname}:3000` : window.location.origin;
    
    // Fallback to relative socket connection
    const socket = io('/', { transports: ['websocket', 'polling'] });
    
    socket.on('player_info', (player: Player) => {
       const existingPlayer = get().player;
       // We keep the existing username if we already authenticated and have a player state
       if (existingPlayer && existingPlayer.username && existingPlayer.id === 'local') {
          set({ player: { ...player, username: existingPlayer.username } });
          socket.emit('update_profile', { username: existingPlayer.username, coins: existingPlayer.coins }, (res: any) => {
             if (res.success && res.activeRoomId) {
                // Let the user decide to rejoin or not (we'll store it in state)
                set({ activeRoomId: res.activeRoomId });
             }
          });
       } else {
          set({ player });
       }
    });
    
    socket.on('force_disconnect', (data: any) => {
       alert(data.reason || "Desconectado pelo servidor.");
       window.location.reload();
    });
    socket.on('room_update', (room: Room) => {
       if (!get().isOffline) {
           const updates: Partial<GameState> = { room };
           if (room.gameState === 'waiting') {
              updates.gameOverMessage = null;
              updates.finishedPlayers = [];
           }
           set(updates);

           const { turn, isRolling } = get();
           if (room.gameState === 'playing' && !isRolling) {
               const roomPlayers = room.players || [];
               const firstHuman = roomPlayers.find((p: any) => !p.isDisconnected && !p.id.startsWith('bot_') && p.id);
               const isHost = firstHuman?.id === socket.id;
               const isBotTurn = roomPlayers.find((p: any) => p.color === turn && p.isBot);
               
               if (isHost && isBotTurn) {
                  // Trigger bot turn if a player just disconnected and we inherited host duties
                  set({ isRolling: true });
                  setTimeout(() => get().playBotTurn(turn), 1500);
               }
           }
       }
    });
    socket.on('receive_message', (msg: Message) => {
       if (!get().isOffline) {
          set((state) => ({ messages: [...state.messages, msg] }));
       }
    });
    
    socket.on('game_started', (data: any) => {
       if (!get().isOffline) {
          const myPlayer = data.room.players.find((p: any) => p.id === socket.id);
          const activeColors = data.room.players.map((p: any) => p.color).filter(Boolean);
          set({ 
            room: data.room, 
            turn: data.turn,
            view: 'room',
            pawns: initializePawns(activeColors),
            diceValue: null,
            isRolling: false,
            betAmount: data.room.betAmount || 0,
            finishedPlayers: [],
            gameOverMessage: null,
            myColor: myPlayer?.color || 'RED'
          });

          const firstHuman = data.room.players.find((p: any) => !p.isDisconnected && !p.id.startsWith('bot_') && p.id);
          const isHost = firstHuman?.id === socket.id;
          const isBotTurn = data.room.players.find((p: any) => p.color === data.turn && p.isBot);
          if (isHost) get().syncState();
          if (isHost && isBotTurn) {
             setTimeout(() => get().playBotTurn(data.turn), 1500);
          }
       }
    });

    socket.on('dice_rolled', (data: any) => {
       if (!get().isOffline) {
          set({ diceValue: data.result });
          if (get().soundEnabled) {
             import('../lib/sounds').then(({ playSound }) => playSound('roll'));
          }
       }
    });

    socket.on('pawn_moved', (data: any) => {
       if (!get().isOffline) {
          get().applyMoveLocally(data.pawnId, data.diceValue);
       }
    });

    socket.on('turn_changed', (data: any) => {
       if (!get().isOffline) {
          set({ turn: data.turn, diceValue: null, isRolling: false });
          
          const roomPlayers = get().room?.players || [];
          const firstHuman = roomPlayers.find((p: any) => !p.isDisconnected && !p.id.startsWith('bot_') && p.id);
          const isHost = firstHuman?.id === socket.id;
          const isBotTurn = roomPlayers.find((p: any) => p.color === data.turn && p.isBot);
          
          if (isHost && isBotTurn) {
             setTimeout(() => get().playBotTurn(data.turn), 1000);
          }
       }
    });

    set({ socket });
  },

  getRooms: () => {
    return new Promise((resolve) => {
      const { socket } = get();
      if (!socket) return resolve([]);
      socket.emit('get_rooms', (res: any) => resolve(res.rooms || []));
    });
  },

  createRoom: (data) => {
    return new Promise((resolve) => {
      const { socket, player, updateCoins } = get();
      if (!socket || !player) return resolve({ success: false });
      
      if (data.betAmount > 0 && player.coins < data.betAmount) {
        return resolve({ success: false, error: 'Moedas insuficientes' });
      }

      set({ isOffline: false });
      socket.emit('create_room', data, (res: any) => {
        if (res.success) {
          if (data.betAmount > 0) {
            updateCoins(player.coins - data.betAmount);
          }
          set({ 
            view: 'room', 
            // pawns: initializePawns(), // Removed
            // turn: 'RED', 
            // diceValue: null,
            // isRolling: false,
            betAmount: data.betAmount,
            finishedPlayers: [],
            gameOverMessage: null
          });
        }
        resolve(res);
      });
    });
  },

  joinRoom: (roomId: string, password?: string) => {
    return new Promise((resolve) => {
      const { socket, player, updateCoins } = get();
      if (!socket || !player) return resolve({ success: false });
      set({ isOffline: false });
      socket.emit('join_room', { roomId, password }, (res: any) => {
        if (res.success) {
          const betAmount = res.room.betAmount || 0;
          if (betAmount > 0) {
            if (player.coins < betAmount) {
              return resolve({ success: false, error: 'Moedas insuficientes' });
            }
            updateCoins(player.coins - betAmount);
          }
          set({ 
            view: 'room', 
            betAmount,
            finishedPlayers: [],
            gameOverMessage: null
          });
        }
        resolve(res);
      });
    });
  },

  addBotOnline: () => {
    const { socket, room } = get();
    if (socket && room) {
      socket.emit('add_bot', room.id);
    }
  },
  
  startGameOnline: () => {
    const { socket, room } = get();
    if (socket && room) {
      socket.emit('start_game', room.id);
    }
  },

  playAgain: () => {
     const { isOffline, room, socket, startOfflineGame, betAmount, myColor } = get();
     if (isOffline) {
        startOfflineGame(betAmount);
     } else if (socket && room) {
        // If they choose play again online, they emit this to server
        socket.emit('play_again', room.id);
     }
  },

  rejoinRoom: () => {
    return new Promise((resolve) => {
       const { socket, activeRoomId } = get();
       if (!socket || !activeRoomId) return resolve();
       socket.emit('rejoin_room', activeRoomId, (res: any) => {
          if (res.success) {
            const myPlayer = res.room.players.find((p: any) => p.name === get().player?.username);
            set({ 
              activeRoomId: null, 
              view: 'room', 
              room: res.room,
              isOffline: false,
              myColor: myPlayer?.color || 'RED',
              pawns: (res.room.pawns && res.room.pawns.length > 0) ? res.room.pawns : initializePawns(res.room.players.map((p: any) => p.color).filter(Boolean)),
              turn: res.room.turn || 'RED',
              diceValue: res.room.diceValue || null,
            });
            setTimeout(() => {
                const { turn, isRolling, room } = get();
                if (!isRolling && get().shouldManageTurn()) {
                   const isBotTurn = room?.players.find((p: any) => p.color === turn && p.isBot);
                   if (isBotTurn) {
                       get().playBotTurn(turn);
                   }
                }
            }, 1000);
          }
          resolve();
       });
    });
  },

  forfeitRoom: () => {
    return new Promise((resolve) => {
       const { socket, activeRoomId } = get();
       if (!socket || !activeRoomId) return resolve();
       socket.emit('forfeit_room', activeRoomId, () => {
          set({ activeRoomId: null });
          resolve();
       });
    });
  },

  startOfflineGame: (bet = 0) => {
    const { player, updateCoins } = get();
    if (!player) return;
    
    if (bet > 0) {
      updateCoins(player.coins - bet);
      // Ideally we would sync the bet deduction to firestore here, 
      // but for demonstration we'll just let it reside locally until end game.
    }

    set({
      isOffline: true,
      view: 'room',
      pawns: initializePawns(),
      myColor: 'RED',
      turn: 'RED',
      diceValue: null,
      isRolling: false,
      betAmount: bet,
      finishedPlayers: [],
      gameOverMessage: null,
      room: {
        id: 'offline_mode',
        players: [
          { id: 'human', name: player.username, isBot: false, color: 'RED' },
          { id: 'bot1', name: 'Robô Alpha', isBot: true, color: 'GREEN' },
          { id: 'bot2', name: 'Robô Beta', isBot: true, color: 'YELLOW' },
          { id: 'bot3', name: 'Robô Omega', isBot: true, color: 'BLUE' }
        ],
        gameState: 'playing',
        pot: bet * 4
      },
      messages: [{
        id: 'system_msg',
        sender: 'Sistema',
        text: bet > 0 ? `Modo Offline (Apostando ${bet} moedas). Você está jogando contra a inteligência artificial.` : 'Modo Offline: Treino grátis contra a inteligência artificial.',
        timestamp: Date.now()
      }]
    });
  },

  leaveRoom: () => {
    const { socket, room, isOffline, player } = get();
    if (isOffline) {
      set({ room: null, view: 'lobby', messages: [], isOffline: false });
    } else if (socket && room) {
      socket.emit('leave_room', room.id);
      let newActiveRoomId = get().activeRoomId;
      if (room.gameState === 'playing' && player && room.players.find((p: any) => p.id === socket.id)) {
        newActiveRoomId = room.id;
      }
      set({ room: null, view: 'lobby', messages: [], isOffline: false, activeRoomId: newActiveRoomId });
    }
  },

  sendMessage: (text: string) => {
    const { socket, room, player, isOffline } = get();
    if (isOffline && player) {
       // Simulate local only message
       const newMsg: Message = {
         id: Date.now().toString(),
         sender: player.username,
         text,
         timestamp: Date.now()
       };
       set((state) => ({ messages: [...state.messages, newMsg] }));
       
       // Bot reply logic optionally
       if (text.toLowerCase().includes('olá')) {
          setTimeout(() => {
             set((state) => ({ messages: [...state.messages, {
                id: Date.now().toString() + 'bot',
                sender: 'Robô Alpha',
                text: 'Olá humano! Acha que pode me vencer?',
                timestamp: Date.now()
             }]}));
          }, 1000);
       }
    } else if (socket && room) {
      socket.emit('send_message', { roomId: room.id, message: text });
    }
  },

  rollDice: () => {
    const { isRolling, diceValue, turn, myColor, isOffline, room, socket } = get();
    if (isRolling || diceValue !== null || turn !== myColor) return;
    
    if (get().soundEnabled) {
      import('../lib/sounds').then(({ playSound }) => playSound('roll'));
    }

    set({ isRolling: true });
    
    setTimeout(() => {
      const result = Math.floor(Math.random() * 6) + 1;
      set({ diceValue: result, isRolling: false });
      
      if (!isOffline && socket && room) {
        socket.emit('roll_dice', { roomId: room.id, result });
      }
      get().syncState();

      const { pawns } = get();
      const myPawns = pawns.filter(p => p.color === turn);
      const validMoves = myPawns.filter(p => canPlay(p, result));
      
      if (validMoves.length === 0) {
        if (result === 6) {
          setTimeout(() => {
             set({ diceValue: null });
             if (get().shouldManageTurn()) {
                 const isBot = (!isOffline && room?.players.find((p: any) => p.color === turn && p.isBot)) || (isOffline && turn !== get().myColor);
                 if (isBot) get().playBotTurn(turn);
             }
          }, 1000);
        } else {
          if (get().shouldManageTurn()) {
             setTimeout(() => get().nextTurn(), 1000);
          }
        }
      } else if (validMoves.length === 1 && myPawns.filter(p => p.position !== -1).length === 1 && validMoves[0].position !== -1) {
         if (get().shouldManageTurn()) {
             setTimeout(() => get().movePawn(validMoves[0].id), 500);
         }
       }
    }, 600);
  },

  syncState: () => {
    const { isOffline, socket, room, pawns, turn, diceValue } = get();
    if (!isOffline && socket && room && room.players.length > 0) {
       const firstHuman = room.players.find((p: any) => !p.isDisconnected && !p.id.startsWith('bot_') && p.id);
       if (firstHuman?.id === socket.id) {
          socket.emit('sync_state', { roomId: room.id, pawns, turn, diceValue });
       }
    }
  },

  shouldManageTurn: () => {
    const { isOffline, myColor, turn, room, socket } = get();
    if (isOffline) return true;
    if (turn === myColor) return true;
    const isBot = room?.players.find((p: any) => p.color === turn && p.isBot);
    // Find the first player who is NOT disconnected (which means they are a real human client in the room)
    const connectedPlayers = room?.players.filter((p: any) => !p.isDisconnected && (p.id === socket?.id || typeof p.id === 'string')); // A bit hacky, but better to check if it's the current client who should act as host
    // Actually, any bot that was added as bot has NO socket id, it has id like `bot_${id}`.
    // Disconnected humans have isDisconnected = true.
    // So connected humans are those where `!p.isDisconnected && !p.id.startsWith('bot_')` OR just rely on isDisconnected.
    const firstHuman = room?.players.find((p: any) => !p.isDisconnected && !p.id.startsWith('bot_') && p.id);
    const isHost = firstHuman?.id === socket?.id;
    return !!(isBot && isHost);
  },

  applyMoveLocally: (pawnId: string, diceResult: number) => {
    const { pawns, turn, soundEnabled, isOffline, socket, room } = get();
    
    const pawn = pawns.find(p => p.id === pawnId);
    if (!pawn || pawn.color !== turn || !canPlay(pawn, diceResult)) return;

    if (soundEnabled) {
       import('../lib/sounds').then(({ playSound }) => playSound('move'));
    }

    let newPawns = [...pawns];
    let newPos = pawn.position === -1 ? 0 : pawn.position + diceResult;
    
    // Check capture
    let captured = false;
    if (newPos >= 0 && newPos <= 50) {
      const clone = { ...pawn, position: newPos };
      const myAbsPos = getAbsolutePosition(clone);
      
      if (!ABSOLUTE_SAFE_SQUARES.includes(myAbsPos)) {
        newPawns = newPawns.map(p2 => {
          if (p2.color !== turn && p2.position >= 0 && p2.position <= 50 && getAbsolutePosition(p2) === myAbsPos) {
            captured = true;
            if (soundEnabled) {
               import('../lib/sounds').then(({ playSound }) => playSound('capture'));
            }
            return { ...p2, position: -1 };
          }
          return p2;
        });
      }
    }

    newPawns = newPawns.map(p => p.id === pawnId ? { ...p, position: newPos } : p);

    const { finishedPlayers, betAmount, player, updateCoins, gameOverMessage } = get();
    let newFinishedPlayers = [...finishedPlayers];
    
    // Check if current player finished
    const currentPlayerPawns = newPawns.filter(p => p.color === turn);
    const hasFinished = currentPlayerPawns.every(p => p.position === 56);
    
    if (hasFinished && !newFinishedPlayers.includes(turn)) {
      newFinishedPlayers.push(turn);
      if (soundEnabled) {
         import('../lib/sounds').then(({ playSound }) => playSound('win'));
      }
    }

    let newGameOverMessage = gameOverMessage;

    const activeColors: PlayerColor[] = (!isOffline && room) 
       ? room.players.map((p: any) => p.color).filter(Boolean) 
       : ['RED', 'GREEN', 'YELLOW', 'BLUE'];
    const ORDER: PlayerColor[] = ['RED', 'GREEN', 'YELLOW', 'BLUE'];
    const gameColors = ORDER.filter(c => activeColors.includes(c));

    const finishThreshold = Math.min(2, gameColors.length - 1);

    // Check if game over
    if (gameColors.length > 1 && newFinishedPlayers.length >= finishThreshold && gameOverMessage === null) {
      const remaining = gameColors.filter(c => !newFinishedPlayers.includes(c));
      remaining.sort((a, b) => {
         const getProgress = (color: PlayerColor) => newPawns.filter(p => p.color === color).reduce((acc, p) => acc + (p.position === -1 ? -1 : p.position), 0);
         return getProgress(b) - getProgress(a);
      });
      newFinishedPlayers.push(...remaining);
      
      const humanPos = newFinishedPlayers.indexOf(get().myColor) + 1;
      let wonAmount = 0;
      let actualPot = betAmount * gameColors.length;
      if (!isOffline && room && room.pot) actualPot = room.pot;

      if (humanPos === 1) { // 1st wins the whole pot
         wonAmount = actualPot;
      }
      
      if (wonAmount > 0 && player) {
          updateCoins((player.coins || 0) + wonAmount);
      }

      if (humanPos === 1) {
          newGameOverMessage = (actualPot > 0)
            ? `VOCÊ VENCEU! 1º Lugar! Ganhou ${actualPot.toLocaleString()} moedas!` 
            : `VOCÊ VENCEU! 1º Lugar!`;
      } else {
          newGameOverMessage = (actualPot > 0)
            ? `Fim de Jogo! Você ficou em ${humanPos}º lugar. O 1º lugar levou ${actualPot.toLocaleString()} moedas.` 
            : `Fim de Jogo! Você ficou em ${humanPos}º lugar!`;
      }
    }

    set({ pawns: newPawns, finishedPlayers: newFinishedPlayers, gameOverMessage: newGameOverMessage });

    if (newGameOverMessage) return; // Stop playing if game over

    // If rolled 6 or captured, extra turn, else nextTurn
    if ((diceResult === 6 || captured) && !hasFinished) {
       set({ diceValue: null, isRolling: false });
       get().syncState();
       if (get().shouldManageTurn()) {
         const isBot = (!isOffline && room?.players.find((p: any) => p.color === turn && p.isBot)) || (isOffline && turn !== get().myColor);
         if (isBot) {
           setTimeout(() => get().playBotTurn(turn), 1000);
         }
       }
    } else {
       if (get().shouldManageTurn()) {
         setTimeout(() => get().nextTurn(), 500);
       }
    }
  },

  movePawn: (pawnId: string) => {
    const { diceValue, isOffline, socket, room } = get();
    if (!diceValue) return;
    
    if (!isOffline && socket && room) {
       socket.emit('move_pawn', { roomId: room.id, pawnId, diceValue });
    }
    
    get().applyMoveLocally(pawnId, diceValue);
  },

  nextTurn: () => {
    if (!get().shouldManageTurn()) return;

    const { finishedPlayers, isOffline, room, socket, myColor } = get();
    // Default to all colors in offline or if room doesn't specify
    const activeColors: PlayerColor[] = (!isOffline && room) 
       ? room.players.map((p: any) => p.color).filter(Boolean) 
       : ['RED', 'GREEN', 'YELLOW', 'BLUE'];
    
    // Sort original order RED, GREEN, YELLOW, BLUE
    const ORDER: PlayerColor[] = ['RED', 'GREEN', 'YELLOW', 'BLUE'];
    const colors = ORDER.filter(c => activeColors.includes(c));
    
    if (colors.length === 0) return;

    let currentIdx = colors.indexOf(get().turn);
    if (currentIdx === -1) currentIdx = 0; // fallback if turn not in colors
    
    let nextTurn = colors[(currentIdx + 1) % colors.length];
    
    // Skip finished players
    while (finishedPlayers.includes(nextTurn)) {
      currentIdx = colors.indexOf(nextTurn);
      nextTurn = colors[(currentIdx + 1) % colors.length];
    }
    
    set({ turn: nextTurn, diceValue: null, isRolling: false });
    get().syncState();
    
    if (!isOffline && socket && room) {
       socket.emit('next_turn', { roomId: room.id, turn: nextTurn });
    }

    const nextIsBot = (!isOffline && room?.players.find((p: any) => p.color === nextTurn && p.isBot)) || (isOffline && nextTurn !== myColor);
    
    let nextCanManage = isOffline;
    if (!isOffline && socket && room) {
       const firstHuman = room.players.find((p: any) => !p.isDisconnected && !p.id.startsWith('bot_') && p.id);
       if (firstHuman?.id === socket.id) {
          nextCanManage = true;
       }
    }
    
    if (nextCanManage && nextIsBot) {
       setTimeout(() => get().playBotTurn(nextTurn), 1000);
    }
  },
  
  playBotTurn: (botColor: PlayerColor) => {
    if (!get().shouldManageTurn()) return;
    
    const executeMove = (result: number) => {
      setTimeout(() => {
        const { pawns } = get();
        const botPawns = pawns.filter(p => p.color === botColor);
        const validMoves = botPawns.filter(p => canPlay(p, result));
        
        if (validMoves.length > 0) {
          // 1. Capture enemy
          const captureMoves = validMoves.filter(p => {
             let newPos = p.position === -1 ? 0 : p.position + result;
             if (newPos >= 0 && newPos <= 50) {
                const clone = { ...p, position: newPos };
                const myAbsPos = getAbsolutePosition(clone);
                if (!ABSOLUTE_SAFE_SQUARES.includes(myAbsPos)) {
                   return pawns.some(p2 => p2.color !== botColor && p2.position >= 0 && p2.position <= 50 && getAbsolutePosition(p2) === myAbsPos);
                }
             }
             return false;
          });

          // 2. Spawn a pawn out of the base (priority if 6)
          const spawningMoves = validMoves.filter(p => p.position === -1);

          // 3. Flee from danger or enter finish line
          const finishLineMoves = validMoves.filter(p => p.position !== -1 && p.position + result > 50);
          const fleeingMoves = validMoves.filter(p => {
             if (p.position === -1 || p.position > 50) return false;
             const myAbs = getAbsolutePosition(p);
             if (ABSOLUTE_SAFE_SQUARES.includes(myAbs)) return false;
             return pawns.some(p2 => {
                if (p2.color === botColor || p2.position < 0 || p2.position > 50) return false;
                const enemyAbs = getAbsolutePosition(p2);
                const diff = (myAbs - enemyAbs + 52) % 52;
                return diff > 0 && diff <= 6;
             });
          });

          // 4. Move the most advanced piece
          const mostAdvancedMoves = [...validMoves].sort((a, b) => b.position - a.position);

          const pawnToMove = captureMoves[0] || spawningMoves[0] || finishLineMoves[0] || fleeingMoves[0] || mostAdvancedMoves[0];

          get().movePawn(pawnToMove.id);
        } else {
          if (result === 6) {
             set({ diceValue: null });
             get().playBotTurn(botColor);
          } else {
             get().nextTurn();
          }
        }
      }, 800);
    };

    if (get().diceValue !== null) {
      // Already rolled
      set({ isRolling: false });
      executeMove(get().diceValue!);
    } else {
      set({ isRolling: true });
      setTimeout(() => {
        const result = Math.floor(Math.random() * 6) + 1;
        set({ diceValue: result, isRolling: false });
        
        const { socket, room, isOffline } = get();
        if (!isOffline && socket && room) {
           socket.emit('roll_dice', { roomId: room.id, result });
        }
        get().syncState();
        
        executeMove(result);
      }, 600);
    }
  },

  setView: (view) => set({ view }),
  setVoiceEnabled: (enabled) => set({ voiceEnabled: enabled }),
  setSoundEnabled: (enabled) => set({ soundEnabled: enabled }),
  addMessage: (msg) => set((state) => ({ messages: [...state.messages, msg] })),
  updateRoom: (room) => set({ room }),
  setPlayer: (player) => set({ player }),
}));
