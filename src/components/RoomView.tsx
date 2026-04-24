import React, { useEffect, useRef, useState } from 'react';
import { useGameStore } from '../store/gameStore';
import { Mic, MicOff, Send, LogOut, Coins, Users, MessageSquare, X, Dices, Play } from 'lucide-react';
import { Board2D } from './Board2D';
import { motion, AnimatePresence } from 'motion/react';

export function RoomView() {
  const { room, player, messages, sendMessage, leaveRoom, voiceEnabled, setVoiceEnabled, isOffline } = useGameStore();
  const rollDice = useGameStore(state => state.rollDice);
  const addBotOnline = useGameStore(state => state.addBotOnline);
  const startGameOnline = useGameStore(state => state.startGameOnline);
  const diceValue = useGameStore(state => state.diceValue);
  const isRolling = useGameStore(state => state.isRolling);
  const turn = useGameStore(state => state.turn);
  const myColor = useGameStore(state => state.myColor);
  const gameOverMessage = useGameStore(state => state.gameOverMessage);
  const [input, setInput] = React.useState('');
  const [isChatOpen, setIsChatOpen] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (isChatOpen) {
      messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }
  }, [messages, isChatOpen]);

  if (!room || !player) return null;

  const unreadCount = isChatOpen ? 0 : messages.length; // Simplified unread logic

  return (
    <div className="fixed inset-0 bg-[#0c0a1f] text-white overflow-hidden">
      {/* Top Header */}
      <div className="absolute top-0 left-0 right-0 p-4 flex justify-between items-center z-10 pointer-events-none">
        <div className="flex gap-4 pointer-events-auto">
          <button onClick={leaveRoom} className="p-2 glass rounded-full hover:bg-white/20 transition">
            <LogOut size={20} />
          </button>
          <div className="flex items-center gap-2 px-4 py-2 glass rounded-[24px]">
            <Coins size={16} className="text-yellow-400 drop-shadow-[0_0_8px_rgba(234,179,8,0.5)]" />
            <span className="font-mono font-bold text-sm text-yellow-400">Pot: {room.pot || 0}</span>
          </div>
        </div>

        <div className="flex items-center gap-2 pointer-events-auto">
          <div className="px-3 py-2 glass rounded-[24px] flex items-center gap-2">
            <Users size={16} className="text-white/80" />
            <span className="font-mono font-bold text-sm tracking-wide text-white">{room.players.length}/4</span>
          </div>
          {!isOffline && (
            <button 
              onClick={() => setVoiceEnabled(!voiceEnabled)}
              className={`p-2 rounded-full glass transition ${voiceEnabled ? 'bg-green-500/20 text-green-400 border border-green-500/50 shadow-[0_0_15px_rgba(74,222,128,0.3)]' : 'hover:bg-white/10 text-white/50'}`}
            >
              {voiceEnabled ? <Mic size={20} /> : <MicOff size={20} />}
            </button>
          )}
        </div>
      </div>

      {room.gameState === 'waiting' && !isOffline && (
        <div className="absolute inset-0 z-30 bg-black/80 backdrop-blur-md flex items-center justify-center p-4">
          <motion.div 
            initial={{ scale: 0.9, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            className="w-full max-w-sm rounded-[32px] glass-panel border border-white/20 p-6 flex flex-col"
          >
             <h2 className="text-2xl font-black text-white font-['Anton'] uppercase tracking-widest text-center mb-6">Aguardando Jogadores</h2>
             
             <div className="space-y-2 mb-6">
               {[0, 1, 2, 3].map(i => {
                  const p = room.players[i] as any;
                  return (
                    <div key={i} className={`p-3 rounded-xl border flex items-center gap-3 ${p ? 'bg-white/10 border-white/20' : 'bg-black/30 border-white/5 border-dashed'}`}>
                       <div className={`w-8 h-8 rounded-full flex items-center justify-center font-bold text-sm ${p ? 'bg-gradient-to-r from-blue-400 to-indigo-500 text-white shadow-lg' : 'bg-white/5 text-white/20'}`}>
                          {i + 1}
                       </div>
                       <div className="font-bold text-sm">
                          {p ? (p.isBot ? <span className="text-pink-400">{p.name} (Bot)</span> : p.name) : <span className="text-white/30 italic">Livre...</span>}
                       </div>
                    </div>
                  );
               })}
             </div>

             {room.players[0] && room.players[0].id === useGameStore.getState().socket?.id ? (
               <div className="flex flex-col gap-2">
                 {room.players.length < 4 && (
                   <button 
                     onClick={addBotOnline}
                     className="p-3 rounded-2xl bg-white/5 hover:bg-white/10 border border-white/10 text-white/80 font-bold text-sm uppercase tracking-widest transition"
                   >
                     Adicionar Robô
                   </button>
                 )}
                 <button 
                   onClick={startGameOnline}
                   disabled={room.players.length < 2 || room.players.filter((p:any) => !p.isBot).length < 2 && room.players.length < 2}
                   className="p-4 rounded-2xl bg-gradient-to-r from-pink-500 to-yellow-500 text-white font-black text-lg uppercase tracking-widest shadow-[0_0_20px_rgba(236,72,153,0.4)] hover:scale-[1.02] active:scale-[0.98] transition disabled:opacity-50 disabled:scale-100 flex items-center justify-center gap-2"
                 >
                   Iniciar Partida <Play size={18} className="fill-white" />
                 </button>
               </div>
             ) : (
               <div className="p-4 text-center text-white/50 font-bold uppercase tracking-widest text-sm bg-black/40 rounded-2xl border border-white/5">
                 Aguardando o host iniciar...
               </div>
             )}
          </motion.div>
        </div>
      )}

      {/* 2D Crisp Board Area */}
      <div className={`absolute inset-0 top-16 bottom-[140px] flex items-center justify-center p-2 sm:p-4 z-0 pointer-events-none transition-all ${room.gameState === 'waiting' ? 'blur-md opacity-50' : ''}`}>
        <div className="pointer-events-auto flex items-center justify-center w-full h-full">
           <div style={{ width: 'min(100vw - 32px, 100% - 32px, 400px)', height: 'min(100vw - 32px, 100% - 32px, 400px)' }}>
             <Board2D />
           </div>
        </div>
      </div>

      {/* Play Controls / Dice Area (Bottom Center) */}
      {room.gameState === 'playing' && (
        <div className="absolute bottom-6 left-0 right-0 flex flex-col items-center justify-end z-10 h-32 px-4 pointer-events-none">
          <div className="pointer-events-auto relative flex flex-col items-center gap-3">
            <div className="flex gap-2 items-center">
              <div className={`px-4 py-1.5 rounded-full font-bold text-sm uppercase tracking-widest bg-black/40 border border-white/20 backdrop-blur shadow-lg ${turn === 'RED' ? 'text-red-400' : turn === 'GREEN' ? 'text-green-400' : turn === 'YELLOW' ? 'text-yellow-400' : 'text-blue-400'}`}>
                Turno: {turn === myColor ? 'Seu Turno' : turn}
              </div>
              
              {!isOffline && (
                <div className={`px-3 py-1.5 rounded-full font-bold text-xs uppercase tracking-widest bg-black/40 border border-white/20 backdrop-blur shadow-lg text-white/80`}>
                  Você: <span className={`${myColor === 'RED' ? 'text-red-400' : myColor === 'GREEN' ? 'text-green-400' : myColor === 'YELLOW' ? 'text-yellow-400' : 'text-blue-400'}`}>{myColor}</span>
                </div>
              )}
            </div>

            {diceValue && !isRolling && (
               <motion.div 
                 initial={{ scale: 0, rotate: -180 }}
                 animate={{ scale: 1, rotate: 0 }}
                 className={`w-16 h-16 bg-white rounded-2xl shadow-[0_10px_30px_rgba(255,255,255,0.3)] flex items-center justify-center border-4 border-slate-200 outline outline-4 outline-offset-2 ${turn === 'RED' ? 'outline-red-500' : turn === 'GREEN' ? 'outline-green-500' : turn === 'YELLOW' ? 'outline-yellow-500' : 'outline-blue-500'}`}
               >
                 <span className={`text-4xl font-black ${turn === 'RED' ? 'text-red-500' : turn === 'GREEN' ? 'text-green-500' : turn === 'YELLOW' ? 'text-yellow-500' : 'text-blue-500'}`}>{diceValue}</span>
               </motion.div>
            )}
            
            {isRolling && (
              <div className="w-16 h-16 bg-white rounded-2xl shadow-lg border-4 border-slate-200 animate-spin flex items-center justify-center">
                 <Dices className="text-slate-400 w-8 h-8" />
              </div>
            )}

            {turn === myColor && !diceValue && !isRolling && (
              <button 
                onClick={rollDice}
                className="px-6 py-3 sm:px-8 sm:py-4 bg-gradient-to-r from-red-500 to-rose-600 rounded-[28px] font-black text-lg sm:text-xl tracking-widest uppercase shadow-[0_0_20px_rgba(244,63,94,0.5)] border border-white/20 hover:scale-105 active:scale-95 transition-all text-white flex gap-2 items-center"
              >
                ROLAR DADO
                <Dices size={24} />
              </button>
            )}
          </div>
        </div>
      )}

      {/* Floating Chat Button */}
      {!isChatOpen && (
        <div className="absolute bottom-6 right-4 md:right-8 z-20">
          <button 
            onClick={() => setIsChatOpen(true)}
            className="w-12 h-12 md:w-14 md:h-14 rounded-full bg-gradient-to-r from-pink-500 to-purple-600 shadow-[0_0_20px_rgba(236,72,153,0.5)] flex items-center justify-center hover:scale-105 transition-transform relative"
          >
            <MessageSquare size={20} className="text-white" />
            
            {messages.length > 0 && (
              <div className="absolute top-0 right-0 w-3 h-3 bg-red-500 rounded-full border-2 border-[#1a1a3a] animate-pulse"></div>
            )}
          </button>
        </div>
      )}

      {/* Floating Chat Panel overlayed cleanly */}
      <AnimatePresence>
        {isChatOpen && (
          <>
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setIsChatOpen(false)}
              className="absolute inset-0 z-40 bg-[#0c0a1f]/60 backdrop-blur-sm"
            />
            <motion.div 
              initial={{ opacity: 0, y: "100%" }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: "100%" }}
              transition={{ type: "spring", damping: 25, stiffness: 200 }}
              className="absolute bottom-0 left-0 right-0 h-[400px] max-h-[80vh] md:h-[500px] md:bottom-6 md:left-auto md:right-8 md:w-[380px] rounded-t-[32px] md:rounded-[32px] glass-panel z-50 flex flex-col shadow-2xl border-t border-x md:border-b border-white/20 overflow-hidden bg-[#151232]/95"
            >
              <div className="p-4 border-b border-white/10 bg-white/5 flex justify-between items-center shrink-0">
                <span className="font-bold uppercase tracking-widest text-xs text-white/90">Chat da Sala</span>
                <button onClick={() => setIsChatOpen(false)} className="p-1.5 hover:bg-white/10 rounded-full text-white/50 hover:text-white transition-colors bg-black/20">
                  <X size={16} />
                </button>
              </div>
              <div className="flex-1 overflow-y-auto p-4 space-y-3">
                {messages.length === 0 && (
                  <div className="text-center text-white/30 text-xs mt-10">Use o chat para falar com a mesa</div>
                )}
                {messages.map((msg) => (
                  <div key={msg.id} className={`flex ${msg.sender === player.username ? 'justify-end' : 'justify-start'}`}>
                    <div className={`max-w-[85%] rounded-[16px] px-3 py-2 ${msg.sender === player.username ? 'bg-gradient-to-r from-pink-500/80 to-purple-600/80 text-white shadow-lg border border-pink-400/30' : 'bg-black/40 border border-white/10 text-white'}`}>
                      {msg.sender !== player.username && (
                        <div className="text-[9px] uppercase font-bold tracking-wider text-pink-400 mb-1">{msg.sender}</div>
                      )}
                      <div className="text-sm font-sans break-words">{msg.text}</div>
                    </div>
                  </div>
                ))}
                <div ref={messagesEndRef} />
              </div>
              
              <form 
                onSubmit={(e) => {
                  e.preventDefault();
                  if (input.trim()) {
                    sendMessage(input.trim());
                    setInput('');
                  }
                }}
                className="p-3 border-t border-white/10 bg-black/30 flex gap-2 items-center shrink-0"
              >
                <input 
                  type="text" 
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  placeholder="Mensagem..."
                  className="flex-1 min-w-0 bg-white/5 rounded-full px-4 py-2 text-sm text-white placeholder-white/30 border border-white/10 focus:outline-none focus:border-pink-500/50 transition-all focus:bg-white/10"
                />
                <button type="submit" className="p-1.5 bg-gradient-to-r from-pink-500 to-purple-600 rounded-full text-white shadow-lg transition-opacity flex items-center justify-center w-10 h-10 shrink-0 hover:scale-105 active:scale-95">
                  <Send size={16} />
                </button>
              </form>
            </motion.div>
          </>
        )}
      </AnimatePresence>

      {/* Game Over Modal */}
      <AnimatePresence>
        {gameOverMessage && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="absolute inset-0 bg-black/80 backdrop-blur-md"
            />
            <motion.div 
              initial={{ scale: 0.9, opacity: 0, y: 20 }}
              animate={{ scale: 1, opacity: 1, y: 0 }}
              exit={{ scale: 0.9, opacity: 0, y: 20 }}
              className="glass-panel w-full max-w-sm rounded-[32px] overflow-hidden z-10 flex flex-col border border-white/20 p-8 items-center text-center relative"
            >
              <div className="absolute inset-0 bg-gradient-to-tr from-pink-500/10 to-yellow-500/10 z-0"></div>
              
              <div className="w-20 h-20 bg-gradient-to-tr from-pink-500 to-yellow-500 rounded-full flex items-center justify-center shadow-[0_0_30px_rgba(236,72,153,0.5)] mb-6 z-10 relative">
                 <Dices size={36} className="text-white" />
              </div>
              
              <h2 className="text-2xl font-black text-white font-['Anton'] uppercase tracking-widest mb-2 z-10">Partida Encerrada</h2>
              <p className="text-white/80 font-bold mb-8 z-10">{gameOverMessage}</p>

              <button 
                onClick={leaveRoom}
                className="w-full bg-white/10 hover:bg-white/20 text-white font-bold uppercase tracking-widest rounded-2xl py-4 transition-all z-10 border border-white/20"
              >
                Voltar ao Lobby
              </button>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
