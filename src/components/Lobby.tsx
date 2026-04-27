import React, { useState } from 'react';
import { useGameStore } from '../store/gameStore';
import { Coins, Trophy, Users, ShoppingCart, Headset, ChevronRight, Play, Settings, X } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

export function Lobby() {
  const { player, joinRoom, createRoom, getRooms, setView, startOfflineGame, activeRoomId, rejoinRoom, forfeitRoom } = useGameStore();
  const [showOfflineModal, setShowOfflineModal] = useState(false);
  const [offlineBet, setOfflineBet] = useState(0);

  const [showOnlineModal, setShowOnlineModal] = useState(false);
  const [onlineTab, setOnlineTab] = useState<'browse' | 'create' | 'join'>('browse');
  const [roomsList, setRoomsList] = useState<any[]>([]);
  const [createBet, setCreateBet] = useState(100);
  const [createPassword, setCreatePassword] = useState('');
  const [joinRoomId, setJoinRoomId] = useState('');
  const [joinPassword, setJoinPassword] = useState('');
  const [roomError, setRoomError] = useState('');
  const [showRejoinModal, setShowRejoinModal] = useState(false);

  const handleOpenOnline = () => {
    if (activeRoomId) {
       setShowRejoinModal(true);
    } else {
       setShowOnlineModal(true);
       setOnlineTab('browse');
       loadRooms();
    }
  };

  const loadRooms = async () => {
    const list = await getRooms();
    setRoomsList(list);
  };

  const handleCreateRoom = async () => {
    setRoomError('');
    if (createBet > 0 && createBet < 100) {
      setRoomError('Aposta mínima 100'); return;
    }
    const res = await createRoom({ password: createPassword, betAmount: createBet });
    if (!res.success) {
      setRoomError(res.error || 'Erro ao criar');
    }
  };

  const handleJoinRoomId = async () => {
    setRoomError('');
    const res = await joinRoom(joinRoomId, joinPassword);
    if (!res.success) {
      setRoomError(res.error || 'Erro ao entrar');
    }
  };

  const handleJoinPublic = async (roomId: string) => {
    setRoomError('');
    const res = await joinRoom(roomId);
    if (!res.success) {
      setRoomError(res.error || 'Erro ao entrar');
    }
  };

  if (!player) {
    return (
      <div className="flex items-center justify-center h-screen bg-[#0c0a1f] text-white">
        <div className="flex flex-col items-center gap-4">
          <div className="w-12 h-12 border-4 border-pink-500 border-t-transparent rounded-full animate-spin"></div>
          <div className="font-['Anton'] tracking-widest uppercase text-pink-500 text-xl animate-pulse">Conectando...</div>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-screen bg-transparent text-white font-sans selection:bg-pink-500/30 overflow-y-auto">
      {/* Header Profile Bar */}
      <div className="sticky top-0 z-20 p-5 flex justify-between items-center">
        <div className="flex items-center gap-2">
          <div className="w-10 h-10 rounded-full bg-gradient-to-tr from-pink-500 to-yellow-500 p-1 border-2 border-white/20">
            <div className="w-full h-full rounded-full flex items-center justify-center text-sm font-bold bg-[#0c0a1f]/80 uppercase">
              {player.username.slice(0, 2)}
            </div>
          </div>
          <div>
            <div className="text-[10px] text-white/50 font-bold uppercase tracking-wide">Bem-vindo,</div>
            <div className="text-xs font-bold font-mono text-white">@{player.username}</div>
          </div>
          <button 
            onClick={() => setView('settings')}
            className="ml-2 p-2 glass rounded-full hover:bg-white/10 transition group"
          >
            <Settings size={16} className="text-white/70 group-hover:text-white transition-colors" />
          </button>
        </div>

        <button 
          onClick={() => setView('store')}
          className="flex items-center gap-2 px-3 py-1.5 glass rounded-[24px] hover:bg-white/10 transition group"
        >
          <span className="text-yellow-400 font-bold text-sm">$</span>
          <span className="font-bold text-xs text-white">{player.coins.toLocaleString()}</span>
          <div className="w-5 h-5 bg-green-500 rounded-full flex items-center justify-center text-white text-xs group-hover:bg-green-400">
            +
          </div>
        </button>
      </div>

      <div className="flex-1 px-5 pb-6 flex flex-col gap-6 max-w-lg mx-auto w-full">
        {/* Hero Banner / Board preview */}
        <div className="h-56 glass-panel relative overflow-hidden flex flex-col items-center justify-center my-2 border border-white/20">
          <div className="absolute inset-0 bg-gradient-to-tr from-[#581cff]/40 to-[#ff1c9d]/40 backdrop-blur-md"></div>
          <div className="absolute inset-0 opacity-30 mix-blend-overlay" style={{backgroundImage: 'radial-gradient(#fff 1px, transparent 1px)', backgroundSize: '16px 16px', backgroundPosition: 'center'}}></div>
          
          <div className="w-28 h-28 bg-[#0c0a1f]/80 backdrop-blur shadow-[0_0_30px_rgba(255,28,157,0.3)] border border-pink-500/30 rotate-45 flex items-center justify-center relative z-10 rounded-2xl">
            <div className="absolute top-2 left-2 w-3.5 h-3.5 rounded-full bg-red-500 shadow-[0_3px_8px_rgba(0,0,0,0.5),inset_0_-1px_3px_rgba(0,0,0,0.4)]"></div>
            <div className="absolute bottom-2 right-2 w-3.5 h-3.5 rounded-full bg-blue-500 shadow-[0_3px_8px_rgba(0,0,0,0.5),inset_0_-1px_3px_rgba(0,0,0,0.4)]"></div>
            <div className="absolute top-2 right-2 w-3.5 h-3.5 rounded-full bg-green-500 shadow-[0_3px_8px_rgba(0,0,0,0.5),inset_0_-1px_3px_rgba(0,0,0,0.4)]"></div>
            <div className="absolute bottom-2 left-2 w-3.5 h-3.5 rounded-full bg-yellow-500 shadow-[0_3px_8px_rgba(0,0,0,0.5),inset_0_-1px_3px_rgba(0,0,0,0.4)]"></div>
            <div className="text-white font-black text-xl -rotate-45 font-['Anton'] tracking-wider drop-shadow-lg">LUDO</div>
          </div>
          
          <div className="absolute bottom-3 left-3 flex gap-1 items-center px-3 py-1.5 glass rounded-[16px] z-10">
            <div className="w-2 h-2 rounded-full bg-red-500 shadow-[0_0_8px_rgba(239,68,68,0.8)] animate-pulse"></div>
            <span className="text-[10px] text-white/80 font-bold uppercase tracking-wider">Sala #0842 • 1.5k Assistindo</span>
          </div>
        </div>

        {/* Action Grid */}
        <div className="grid grid-cols-2 gap-3">
          <motion.button 
            whileTap={{ scale: 0.95 }}
            onClick={handleOpenOnline}
            className="glass-panel p-4 border-t-4 border-t-pink-500 bg-gradient-to-br from-pink-500/20 to-[#0c0a1f] flex flex-col items-center gap-2 hover:bg-white/10 transition-colors"
          >
            <div className="w-10 h-10 rounded-full bg-pink-500 flex items-center justify-center shadow-[0_0_15px_rgba(236,72,153,0.5)]">
               <Users size={18} className="text-white" />
            </div>
            <h3 className="text-white font-black text-sm tracking-widest uppercase">Jogar Online</h3>
            <p className="text-[9px] text-pink-300 uppercase tracking-widest">Multiplayer Real</p>
          </motion.button>
          
          <motion.button 
            whileTap={{ scale: 0.95 }}
            onClick={() => setShowOfflineModal(true)}
            className="glass-panel p-4 border-t-4 border-t-blue-500 bg-gradient-to-br from-blue-500/20 to-[#0c0a1f] flex flex-col items-center gap-2 hover:bg-white/10 transition-colors"
          >
            <div className="w-10 h-10 rounded-full bg-blue-500 flex items-center justify-center shadow-[0_0_15px_rgba(59,130,246,0.5)]">
               <Headset size={18} className="text-white" />
            </div>
            <h3 className="text-white font-black text-sm tracking-widest uppercase">Jogar Offline</h3>
            <p className="text-[9px] text-blue-300 uppercase tracking-widest">Contra Robôs</p>
          </motion.button>

          <motion.button 
            whileTap={{ scale: 0.95 }}
            onClick={() => setView('leaderboard')}
            className="glass-panel p-3 flex flex-col items-center justify-center gap-1 hover:bg-white/10 transition"
          >
            <p className="text-[9px] text-white/50 font-bold uppercase tracking-widest">Ranking Global</p>
            <p className="text-xl text-white font-black font-['Anton'] tracking-wider">#142</p>
          </motion.button>

          <motion.button 
            whileTap={{ scale: 0.95 }}
            className="glass-panel p-3 flex flex-col items-center justify-center gap-1 hover:bg-white/10 transition"
          >
            <p className="text-[9px] text-white/50 font-bold uppercase tracking-widest">Win Rate</p>
            <p className="text-xl text-green-400 font-black font-['Anton'] tracking-wider">68%</p>
          </motion.button>
        </div>
      </div>

      <AnimatePresence>
        {showRejoinModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="absolute inset-0 bg-black/60 backdrop-blur-sm"
            />
            <motion.div 
              initial={{ scale: 0.9, opacity: 0, y: 20 }}
              animate={{ scale: 1, opacity: 1, y: 0 }}
              exit={{ scale: 0.9, opacity: 0, y: 20 }}
              className="glass p-8 rounded-[32px] max-w-sm w-full text-center space-y-6 z-10"
            >
              <div className="text-4xl">⚠️</div>
              <div>
                 <h2 className="text-2xl font-black font-['Anton'] uppercase tracking-widest text-yellow-400 mb-2">Partida em Andamento</h2>
                 <p className="text-sm text-white/50">Você foi desconectado de uma sala ativa. Deseja retornar?</p>
              </div>
              <div className="flex flex-col gap-3">
                 <button onClick={() => { rejoinRoom(); setShowRejoinModal(false); }} className="p-4 rounded-2xl bg-gradient-to-r from-pink-500 to-yellow-500 font-bold uppercase tracking-widest hover:scale-[1.02] active:scale-[0.98] transition">Voltar para a Partida</button>
                 <button onClick={() => { forfeitRoom(); setShowRejoinModal(false); setShowOnlineModal(true); setOnlineTab('browse'); loadRooms(); }} className="p-4 rounded-2xl bg-white/5 hover:bg-red-500/20 border border-white/10 hover:border-red-500/50 text-white/80 hover:text-red-400 font-bold uppercase tracking-widest transition">Desistir (Virar Robô)</button>
              </div>
            </motion.div>
          </div>
        )}

        {showOnlineModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="absolute inset-0 bg-black/60 backdrop-blur-sm"
              onClick={() => setShowOnlineModal(false)}
            />
            <motion.div 
              initial={{ scale: 0.9, opacity: 0, y: 20 }}
              animate={{ scale: 1, opacity: 1, y: 0 }}
              exit={{ scale: 0.9, opacity: 0, y: 20 }}
              className="glass-panel w-full max-w-sm rounded-[32px] overflow-hidden z-10 flex flex-col border border-white/20"
            >
              <div className="p-5 border-b border-white/10 relative bg-gradient-to-br from-pink-500/20 to-[#0c0a1f]">
                <button 
                  onClick={() => setShowOnlineModal(false)}
                  className="absolute top-4 right-4 p-2 rounded-full hover:bg-white/10 transition"
                >
                  <X size={18} className="text-white" />
                </button>
                <div className="w-12 h-12 bg-pink-500 rounded-full flex items-center justify-center shadow-[0_0_15px_rgba(236,72,153,0.5)] mb-3">
                  <Users size={20} className="text-white" />
                </div>
                <h2 className="text-xl font-black text-white font-['Anton'] uppercase tracking-widest">Online</h2>
                
                <div className="flex gap-4 mt-4 border-b border-white/10">
                  <button 
                    onClick={() => { setOnlineTab('browse'); loadRooms(); }}
                    className={`pb-2 text-xs font-bold uppercase tracking-widest transition-colors ${onlineTab === 'browse' ? 'text-pink-400 border-b-2 border-pink-400' : 'text-white/50 hover:text-white/80'}`}
                  >Salas</button>
                  <button 
                    onClick={() => setOnlineTab('create')}
                    className={`pb-2 text-xs font-bold uppercase tracking-widest transition-colors ${onlineTab === 'create' ? 'text-pink-400 border-b-2 border-pink-400' : 'text-white/50 hover:text-white/80'}`}
                  >Criar</button>
                  <button 
                    onClick={() => setOnlineTab('join')}
                    className={`pb-2 text-xs font-bold uppercase tracking-widest transition-colors ${onlineTab === 'join' ? 'text-pink-400 border-b-2 border-pink-400' : 'text-white/50 hover:text-white/80'}`}
                  >ID</button>
                </div>
              </div>

              <div className="p-5 flex flex-col gap-4 min-h-[250px] max-h-[350px] overflow-y-auto">
                {roomError && (
                  <div className="bg-red-500/20 border border-red-500/50 rounded-xl p-3 mb-2">
                    <p className="text-xs text-red-400 font-bold uppercase tracking-widest text-center">{roomError}</p>
                  </div>
                )}

                {onlineTab === 'browse' && (
                  <div className="space-y-3">
                    <button 
                      onClick={loadRooms}
                      className="text-[10px] text-pink-300 uppercase tracking-widest px-2 hover:text-pink-200"
                    >
                      Atualizar Lista
                    </button>
                    {roomsList.length === 0 ? (
                      <p className="text-xs text-white/50 text-center py-6 font-bold uppercase tracking-widest">Nenhuma sala pública encontrada</p>
                    ) : (
                      roomsList.map((room) => (
                        <div key={room.id} className="bg-black/40 border border-white/10 rounded-2xl p-3 flex items-center justify-between">
                          <div>
                            <p className="text-sm font-bold text-white">{room.name}</p>
                            <p className="text-[10px] text-white/50 font-bold uppercase tracking-widest">
                              ID: {room.id} • Aposta: {room.betAmount} • {room.players.length}/4
                            </p>
                          </div>
                          <button
                            onClick={() => handleJoinPublic(room.id)}
                            className="w-8 h-8 rounded-full bg-pink-500 hover:bg-pink-400 flex items-center justify-center transition"
                          >
                            <Play size={10} className="fill-white font-bold" />
                          </button>
                        </div>
                      ))
                    )}
                  </div>
                )}

                {onlineTab === 'create' && (
                  <div className="space-y-4">
                    <div>
                      <p className="text-[10px] text-white/50 font-bold uppercase tracking-widest mb-2">Aposta (Min. 100)</p>
                      <div className="bg-black/40 border border-white/10 rounded-2xl p-3 flex items-center gap-2 mb-2">
                        <Coins size={16} className="text-yellow-400" />
                        <input 
                          type="number" 
                          min="100"
                          value={createBet}
                          onChange={(e) => setCreateBet(Math.max(0, parseInt(e.target.value) || 0))}
                          className="bg-transparent border-none outline-none text-base font-bold font-mono text-white w-full"
                        />
                      </div>
                    </div>
                    <div>
                      <p className="text-[10px] text-white/50 font-bold uppercase tracking-widest mb-2">Senha (Opcional para privada)</p>
                      <input 
                        type="text" 
                        value={createPassword}
                        onChange={(e) => setCreatePassword(e.target.value)}
                        placeholder="Deixe em branco para pública"
                        className="bg-black/40 border border-white/10 rounded-2xl p-3 w-full text-sm text-white"
                      />
                    </div>
                    
                    <button 
                      onClick={handleCreateRoom}
                      disabled={createBet < 100}
                      className="w-full mt-2 bg-gradient-to-r from-pink-500 to-yellow-500 text-white font-bold uppercase tracking-widest rounded-2xl py-4 shadow-[0_10px_20px_rgba(236,72,153,0.3)] hover:scale-[1.02] active:scale-[0.98] transition-all disabled:opacity-50 disabled:scale-100"
                    >
                      Criar Sala
                    </button>
                  </div>
                )}

                {onlineTab === 'join' && (
                  <div className="space-y-4">
                    <div>
                      <p className="text-[10px] text-white/50 font-bold uppercase tracking-widest mb-2">ID da Sala</p>
                      <input 
                        type="text" 
                        value={joinRoomId}
                        onChange={(e) => setJoinRoomId(e.target.value)}
                        placeholder="Ex: a1b2c3"
                        className="bg-black/40 border border-white/10 rounded-2xl p-3 w-full text-base font-mono text-white"
                      />
                    </div>
                    <div>
                      <p className="text-[10px] text-white/50 font-bold uppercase tracking-widest mb-2">Senha (Se privada)</p>
                      <input 
                        type="text" 
                        value={joinPassword}
                        onChange={(e) => setJoinPassword(e.target.value)}
                        className="bg-black/40 border border-white/10 rounded-2xl p-3 w-full text-base text-white"
                      />
                    </div>
                    
                    <button 
                      onClick={handleJoinRoomId}
                      disabled={!joinRoomId.trim()}
                      className="w-full mt-2 bg-gradient-to-r from-pink-500 to-yellow-500 text-white font-bold uppercase tracking-widest rounded-2xl py-4 shadow-[0_10px_20px_rgba(236,72,153,0.3)] hover:scale-[1.02] active:scale-[0.98] transition-all disabled:opacity-50 disabled:scale-100"
                    >
                      Entrar
                    </button>
                  </div>
                )}

              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {showOfflineModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="absolute inset-0 bg-black/60 backdrop-blur-sm"
              onClick={() => setShowOfflineModal(false)}
            />
            <motion.div 
              initial={{ scale: 0.9, opacity: 0, y: 20 }}
              animate={{ scale: 1, opacity: 1, y: 0 }}
              exit={{ scale: 0.9, opacity: 0, y: 20 }}
              className="glass-panel w-full max-w-sm rounded-[32px] overflow-hidden z-10 flex flex-col border border-white/20"
            >
              <div className="p-5 border-b border-white/10 relative bg-gradient-to-br from-blue-500/20 to-[#0c0a1f]">
                <button 
                  onClick={() => setShowOfflineModal(false)}
                  className="absolute top-4 right-4 p-2 rounded-full hover:bg-white/10 transition"
                >
                  <X size={18} className="text-white" />
                </button>
                <div className="w-12 h-12 bg-blue-500 rounded-full flex items-center justify-center shadow-[0_0_15px_rgba(59,130,246,0.5)] mb-3">
                  <Headset size={20} className="text-white" />
                </div>
                <h2 className="text-xl font-black text-white font-['Anton'] uppercase tracking-widest">Jogar com Robôs</h2>
                <p className="text-[10px] text-white/60 tracking-wider">Configure o valor da aposta da sala</p>
              </div>
              
              <div className="p-5 flex flex-col gap-4">
                <div className="grid grid-cols-2 gap-2 mb-2">
                  {[0, 100, 500, 1000].map(val => (
                    <button 
                      key={val}
                      onClick={() => setOfflineBet(val)}
                      className={`py-3 rounded-2xl flex flex-col items-center justify-center gap-1 transition-all border ${offlineBet === val ? 'bg-blue-500/20 border-blue-500 shadow-[0_0_15px_rgba(59,130,246,0.3)]' : 'bg-black/40 border-white/10 hover:bg-white/5'}`}
                    >
                      <span className={`text-[10px] font-bold uppercase tracking-widest ${offlineBet === val ? 'text-blue-300' : 'text-white/50'}`}>
                        {val === 0 ? 'Treino' : 'Apostar'}
                      </span>
                      <div className="flex items-center gap-1">
                        {val > 0 && <Coins size={12} className="text-yellow-400" />}
                        <span className={`text-base font-black ${offlineBet === val ? 'text-white' : 'text-white/80'}`}>
                          {val === 0 ? 'Grátis' : val.toLocaleString()}
                        </span>
                      </div>
                    </button>
                  ))}
                </div>

                <div className="bg-black/40 border border-white/10 rounded-2xl p-4">
                  <p className="text-[10px] text-white/50 font-bold uppercase tracking-widest mb-2">Aposta Customizada (Min. 100)</p>
                  <div className="flex items-center gap-2">
                    <Coins size={16} className="text-yellow-400" />
                    <input 
                      type="number" 
                      min="100"
                      value={offlineBet}
                      onChange={(e) => setOfflineBet(Math.max(0, parseInt(e.target.value) || 0))}
                      className="bg-transparent border-none outline-none text-xl font-bold font-mono text-white w-full"
                    />
                  </div>
                </div>
                
                {offlineBet >= 100 && (
                  <div className="bg-black/40 rounded-2xl p-4 mt-2">
                     <p className="text-[10px] text-white/50 uppercase tracking-widest mb-2 font-bold">Premiação Estimada</p>
                     <div className="flex justify-between items-center text-sm mb-1">
                       <span className="text-yellow-400 font-bold">1º Lugar (50%)</span>
                       <span className="font-mono text-white">{(offlineBet * 4 * 0.5).toLocaleString()}</span>
                     </div>
                     <div className="flex justify-between items-center text-sm mb-1">
                       <span className="text-gray-300 font-bold">2º Lugar (30%)</span>
                       <span className="font-mono text-white">{(offlineBet * 4 * 0.3).toLocaleString()}</span>
                     </div>
                     <div className="flex justify-between items-center text-sm mb-1">
                       <span className="text-orange-400 font-bold">3º Lugar (10%)</span>
                       <span className="font-mono text-white">{(offlineBet * 4 * 0.1).toLocaleString()}</span>
                     </div>
                  </div>
                )}
                
                {offlineBet > player.coins && (
                   <p className="text-xs text-red-400 text-center uppercase tracking-widest font-bold">Moedas Insuficientes</p>
                )}
                {(offlineBet > 0 && offlineBet < 100) && (
                   <p className="text-xs text-red-400 text-center uppercase tracking-widest font-bold">Aposta mínima: 100</p>
                )}

                <button 
                  disabled={offlineBet > player.coins || (offlineBet > 0 && offlineBet < 100)}
                  onClick={() => {
                    startOfflineGame(offlineBet);
                    setShowOfflineModal(false);
                  }}
                  className="w-full mt-2 bg-gradient-to-r from-blue-500 to-purple-600 text-white font-bold uppercase tracking-widest rounded-2xl py-4 shadow-[0_10px_20px_rgba(59,130,246,0.3)] hover:scale-[1.02] active:scale-[0.98] transition-all disabled:opacity-50 disabled:scale-100"
                >
                  Confirmar e Iniciar
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
