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

export type GameMode = 'classic' | 'powers';

export type Room = {
  id: string;
  players: any[];
  gameState: 'waiting' | 'playing' | 'finished';
  pot: number;
  betAmount?: number;
  gameMode?: GameMode;
  traps?: number[];
  powerEffects?: Record<string, {
     shield?: number;
     turbo?: number;
     curse?: number;
     diceBlock?: number;
     doubleRoll?: number;
  }>;
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
  diceChoices: [number, number] | null;
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
  createRoom: (data: { name?: string; password?: string; betAmount: number; gameMode?: 'classic' | 'powers' }) => Promise<any>;
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
  executeDiceResult: (result: number, isBot: boolean) => void;
  selectDiceChoice: (choice: number) => void;
  movePawn: (pawnId: string) => void;
  applyMoveLocally: (pawnId: string, diceResult: number) => void;
  syncState: () => void;
  shouldManageTurn: () => boolean;
  nextTurn: () => void;
  playBotTurn: (color: PlayerColor) => void;
  triggerPower: (color: PlayerColor) => void;
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
  diceChoices: null,
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
            diceChoices: null,
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
      if (room.gameState === 'playing' && player && room.players.find((p: any) => p.id === socket.id && !p.isForfeited)) {
        newActiveRoomId = room.id;
      }
      if (room.gameState === 'finished' || room.gameState === 'waiting') {
        newActiveRoomId = null;
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

  executeDiceResult: (result: number, isBot: boolean) => {
      const { isOffline, socket, room, turn } = get();
      set({ diceValue: result, isRolling: false, diceChoices: null });
      
      if (!isOffline && socket && room) {
        socket.emit('roll_dice', { roomId: room.id, result });
      }

      // Decrement/handle power effects before resolving moves
      const effects = room?.powerEffects?.[turn];
      let didTriggerPower = false;

      if (room?.gameMode === 'powers' && result === 1) {
         if (effects?.diceBlock && effects.diceBlock > 0) {
            // "se esse jogador tirar 1 ele não ganha poder"
         } else {
            get().triggerPower(turn);
            didTriggerPower = true;
         }
      }

      // Consume roll-based effects
      if (effects) {
         let newEffects = { ...room!.powerEffects };
         if (newEffects[turn].diceBlock && newEffects[turn].diceBlock! > 0) {
             newEffects[turn].diceBlock! -= 1;
         }
         if (newEffects[turn].curse && newEffects[turn].curse! > 0) {
             newEffects[turn].curse! -= 1;
             // Curse forces result to 1 (or 1 move). But wait, do we override result? 
             // "escolhe 1 jogador para anda sempre 1 casa por 1 rodadas" -> they already rolled, let's treat curse as overriding their roll to 1! 
             // Wait, if it forces 1, they would trigger powers again? No, curse shouldn't chain powers usually... but maybe it does. Let's just override result.
         }
         if (newEffects[turn].turbo && newEffects[turn].turbo! > 0) {
             newEffects[turn].turbo! -= 1;
         }
         if (newEffects[turn].shield && newEffects[turn].shield! > 0) {
             newEffects[turn].shield! -= 1;
         }
         if (newEffects[turn].doubleRoll && newEffects[turn].doubleRoll! > 0) {
             newEffects[turn].doubleRoll! -= 1;
         }
         
         if (room && socket) socket.emit('sync_state', { roomId: room.id, powerEffects: newEffects });
         set({ room: { ...room!, powerEffects: newEffects } });
      }

      let moveResult = result;
      if (effects?.curse && effects.curse > 0) moveResult = 1;
      if (effects?.turbo && effects.turbo > 0) moveResult = result * 2;
      
      set({ diceValue: moveResult });
      get().syncState();

      const { pawns } = get();
      const myPawns = pawns.filter(p => p.color === turn);
      const validMoves = myPawns.filter(p => canPlay(p, moveResult));
      
      if (validMoves.length === 0) {
        if (moveResult === 6) {
          setTimeout(() => {
             set({ diceValue: null });
             if (get().shouldManageTurn()) {
                 const isBotTurn = (!isOffline && room?.players.find((p: any) => p.color === turn && p.isBot)) || (isOffline && turn !== get().myColor);
                 if (isBotTurn) get().playBotTurn(turn);
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
       } else if (isBot) {
          // 1. Capture enemy
          const captureMoves = validMoves.filter(p => {
             let newPos = p.position === -1 ? 0 : p.position + moveResult;
             if (newPos >= 0 && newPos <= 50) {
                const clone = { ...p, position: newPos };
                const myAbsPos = getAbsolutePosition(clone);
                if (!ABSOLUTE_SAFE_SQUARES.includes(myAbsPos)) {
                   return pawns.some(p2 => p2.color !== turn && p2.position >= 0 && p2.position <= 50 && getAbsolutePosition(p2) === myAbsPos);
                }
             }
             return false;
          });

          // 2. Spawn a pawn out of the base (priority if 6)
          const spawningMoves = validMoves.filter(p => p.position === -1);

          // 3. Flee from danger or enter finish line
          const finishLineMoves = validMoves.filter(p => p.position !== -1 && p.position + moveResult > 50);
          const fleeingMoves = validMoves.filter(p => {
             if (p.position === -1 || p.position > 50) return false;
             const myAbs = getAbsolutePosition(p);
             if (ABSOLUTE_SAFE_SQUARES.includes(myAbs)) return false;
             return pawns.some(p2 => {
                if (p2.color === turn || p2.position < 0 || p2.position > 50) return false;
                const enemyAbs = getAbsolutePosition(p2);
                const diff = (myAbs - enemyAbs + 52) % 52;
                return diff > 0 && diff <= 6;
             });
          });

          // 4. Move the most advanced piece
          const mostAdvancedMoves = [...validMoves].sort((a, b) => b.position - a.position);

          const pawnToMove = captureMoves[0] || spawningMoves[0] || finishLineMoves[0] || fleeingMoves[0] || mostAdvancedMoves[0];
          setTimeout(() => get().movePawn(pawnToMove.id), 500);
       }
  },

  rollDice: () => {
    const { isRolling, diceValue, turn, myColor, room } = get();
    if (isRolling || diceValue !== null || turn !== myColor) return;
    
    if (get().soundEnabled) {
      import('../lib/sounds').then(({ playSound }) => playSound('roll'));
    }

    set({ isRolling: true });
    
    setTimeout(() => {
      let maxRoll = 6;
      if (room?.gameMode === 'powers' && room?.powerEffects?.[turn]?.diceBlock && room.powerEffects[turn].diceBlock! > 0) {
         maxRoll = 3;
      }
      const result = Math.floor(Math.random() * maxRoll) + 1;
      
      // If doubleRoll is active and room is powers
      const doubleRollData = room?.powerEffects?.[turn]?.doubleRoll;
      if (room && room.gameMode === 'powers' && doubleRollData && doubleRollData > 0) {
         const result2 = Math.floor(Math.random() * maxRoll) + 1;
         set({ diceChoices: [result, result2], isRolling: false });
         return;
      }
      
      get().executeDiceResult(result, false);
    }, 600);
  },

  selectDiceChoice: (choice: number) => {
    get().executeDiceResult(choice, false);
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
    
    // Check Traps first so newPos is final
    if (newPos >= 0 && newPos <= 50) {
       const clone = { ...pawn, position: newPos };
       const myAbsPos = getAbsolutePosition(clone);
       if (room?.gameMode === 'powers' && room.traps && room.traps.includes(myAbsPos)) {
           const triggeredTrapIndex = room.traps.indexOf(myAbsPos);
           const spacesBack = Math.floor(Math.random() * 10) + 1;
           newPos = Math.max(0, Math.min(newPos - spacesBack, 50)); // Don't allow it to go negative. Start is 0 (first square outside base)
           if (!isOffline && socket) {
              const msg = `Armadilha! A peça de ${turn} caiu numa armadilha e voltou ${Math.min(spacesBack, pawn.position + diceResult - newPos)} casas.`;
              socket.emit('send_message', { roomId: room.id, message: msg, sender: 'Poderes' });
              get().addMessage({ id: Date.now().toString(), sender: 'Poderes', text: msg, timestamp: Date.now() });
           }
           // Generating new trap
           let newTrapPos = Math.floor(Math.random() * 52);
           while (ABSOLUTE_SAFE_SQUARES.includes(newTrapPos) || room.traps.includes(newTrapPos)) {
              newTrapPos = Math.floor(Math.random() * 52);
           }
           const newTraps = [...room.traps];
           newTraps[triggeredTrapIndex] = newTrapPos;
           if (!isOffline && socket) {
              socket.emit('sync_state', { roomId: room.id, traps: newTraps });
           }
           set({ room: { ...room, traps: newTraps } });
       }
    }

    // Check capture
    let captured = false;
    if (newPos >= 0 && newPos <= 50) {
      const clone = { ...pawn, position: newPos };
      const myAbsPos = getAbsolutePosition(clone);
      
      if (!ABSOLUTE_SAFE_SQUARES.includes(myAbsPos)) {
        newPawns = newPawns.map(p2 => {
          if (p2.color !== turn && p2.position >= 0 && p2.position <= 50 && getAbsolutePosition(p2) === myAbsPos) {
             const targetEffects = room?.powerEffects?.[p2.color];
             if (room?.gameMode === 'powers' && targetEffects?.shield && targetEffects.shield > 0) {
                 return p2; // Shielded!
             }
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
  
  triggerPower: (color: PlayerColor) => {
    const { room, socket, isOffline, pawns } = get();
    if (!room) return;

    const powers = ['EMPURRAO', 'BLOQUEIO_DE_DADO', 'ESCUDO', 'MODO_TURBO', 'MALDICAO', 'ROLAGEM_DUPLA'];
    const randomPower = powers[Math.floor(Math.random() * powers.length)];

    let newEffects = { ...room.powerEffects };
    if (!newEffects[color]) newEffects[color] = {};
    
    let messageText = '';
    const activeColors = room.players.map((p: any) => p.color).filter(Boolean);
    const enemies = activeColors.filter(c => c !== color);
    const randomEnemy = enemies[Math.floor(Math.random() * enemies.length)];

    if (randomPower === 'EMPURRAO') {
        const enemyPawns = pawns.filter(p => enemies.includes(p.color) && p.position > 0 && p.position <= 50);
        if (enemyPawns.length > 0) {
            const target = enemyPawns[Math.floor(Math.random() * enemyPawns.length)];
            const spacesBack = Math.floor(Math.random() * 5) + 1;
            const newPos = Math.max(1, target.position - spacesBack);
            messageText = `Empurrão! A peça inimiga de ${target.color} voltou ${target.position - newPos} casas.`;
            get().applyMoveLocally(target.id, -(target.position - newPos)); // A bit hacky but works for position change
            // we will need to update position explicitly
            setTimeout(() => {
                const p = get().pawns;
                const cloned = [...p];
                const pt = cloned.find(px => px.id === target.id);
                if (pt) pt.position = newPos;
                set({ pawns: cloned });
                get().syncState();
            }, 100);
        } else {
            messageText = `Empurrão! Mas não havia peças inimigas no tabuleiro.`;
        }
    } else if (randomPower === 'BLOQUEIO_DE_DADO') {
        if (!newEffects[randomEnemy]) newEffects[randomEnemy] = {};
        newEffects[randomEnemy].diceBlock = 1;
        messageText = `Bloqueio de Dado! O jogador ${randomEnemy} só poderá tirar até 3 na próxima rodada.`;
    } else if (randomPower === 'ESCUDO') {
        newEffects[color].shield = 1;
        messageText = `Escudo! O jogador ${color} está imune a capturas por 1 rodada.`;
    } else if (randomPower === 'MODO_TURBO') {
        newEffects[color].turbo = 1;
        messageText = `Modo Turbo! O jogador ${color} andará o dobro no seu próximo turno.`;
    } else if (randomPower === 'MALDICAO') {
        if (!newEffects[randomEnemy]) newEffects[randomEnemy] = {};
        newEffects[randomEnemy].curse = 1;
        messageText = `Maldição! O jogador ${randomEnemy} irá parar e andar apenas 1 casa.`;
    } else if (randomPower === 'ROLAGEM_DUPLA') {
        newEffects[color].doubleRoll = 1;
        messageText = `Rolagem Dupla! O jogador ${color} vai rolar dois dados no próximo turno.`;
    }

    if (!isOffline && socket) {
      socket.emit('send_message', { roomId: room.id, message: messageText, sender: 'Poderes' });
      socket.emit('sync_state', { roomId: room.id, powerEffects: newEffects });
    }
    set({ room: { ...room, powerEffects: newEffects } });
    get().addMessage({ id: Date.now().toString(), sender: 'Poderes', text: messageText, timestamp: Date.now() });
  },

  playBotTurn: (botColor: PlayerColor) => {
    if (!get().shouldManageTurn()) return;
    
    if (get().diceValue !== null) {
      get().executeDiceResult(get().diceValue!, true);
    } else {
      set({ isRolling: true });
      setTimeout(() => {
        const { room } = get();
        let maxRoll = 6;
        if (room?.gameMode === 'powers' && room?.powerEffects?.[botColor]?.diceBlock && room.powerEffects[botColor].diceBlock! > 0) {
           maxRoll = 3;
        }

        let result = Math.floor(Math.random() * maxRoll) + 1;
        
        const doubleRollData = room?.powerEffects?.[botColor]?.doubleRoll;
        if (room && room.gameMode === 'powers' && doubleRollData && doubleRollData > 0) {
           const result2 = Math.floor(Math.random() * maxRoll) + 1;
           result = Math.max(result, result2); 
        }
        
        get().executeDiceResult(result, true);
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
