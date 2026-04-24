import React from 'react';
import { useGameStore } from '../store/gameStore';
import { ChevronLeft, Coins, CreditCard } from 'lucide-react';
import { motion } from 'motion/react';

const PACKS = [
  { id: 'starter', coins: 5000, price: 0.99, bonus: 0, pop: false },
  { id: 'popular', coins: 15000, price: 2.99, bonus: 10, pop: true },
  { id: 'pro', coins: 50000, price: 8.99, bonus: 25, pop: false },
  { id: 'whale', coins: 200000, price: 29.99, bonus: 50, pop: false },
];

export function CoinStore() {
  const { setView, player } = useGameStore();

  return (
    <div className="flex flex-col h-screen bg-transparent text-white overflow-y-auto">
      <div className="sticky top-0 z-20 p-5 flex items-center justify-between">
        <button onClick={() => setView('lobby')} className="p-2 glass rounded-full hover:bg-white/10 transition">
          <ChevronLeft size={20} />
        </button>
        <div className="font-['Anton'] uppercase tracking-widest text-lg">Bank</div>
        <div className="w-10"></div>
      </div>

      <div className="p-6">
        <div className="text-center mb-10 mt-6">
          <div className="inline-flex items-center justify-center p-4 bg-yellow-500/10 rounded-full mb-4">
            <Coins size={48} className="text-yellow-500 drop-shadow-[0_0_15px_rgba(234,179,8,0.5)]" />
          </div>
          <h1 className="text-2xl font-bold mb-2">Moedas Digitais</h1>
          <p className="text-white/50 text-sm">Compre moedas e entre em salas de alto nível.</p>
          <div className="mt-4 inline-block px-4 py-2 glass rounded-[24px] text-sm font-mono text-yellow-400 font-bold">
            Saldo: {player?.coins.toLocaleString()}
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 max-w-2xl mx-auto">
          {PACKS.map((pack) => (
            <motion.div 
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
              key={pack.id} 
              className={`relative cursor-pointer glass-panel ${pack.pop ? 'border-yellow-500/50 shadow-[0_0_20px_rgba(234,179,8,0.2)] bg-gradient-to-br from-yellow-500/10 to-transparent' : 'hover:bg-white/10'} transition-all`}
              onClick={() => {
                alert('Mock payment initiated for ' + pack.coins + ' coins.');
              }}
            >
              {pack.bonus > 0 && pack.pop && (
                <div className="absolute -top-3 right-6 bg-yellow-500 text-black text-[10px] uppercase font-bold tracking-wider px-2 py-1 rounded shadow-md transform rotate-3">
                  +{pack.bonus}% Bonus
                </div>
              )}
              <div className="p-6 h-full flex items-center justify-between relative overflow-hidden">
                <div className="absolute -right-4 -bottom-4 opacity-5">
                  <Coins size={100} />
                </div>
                <div>
                  <div className="flex items-center gap-2 mb-1">
                    <Coins size={20} className="text-yellow-400 drop-shadow-[0_0_8px_rgba(234,179,8,0.5)]" />
                    <span className="text-2xl font-bold font-mono">{pack.coins.toLocaleString()}</span>
                  </div>
                  {pack.bonus > 0 && !pack.pop && (
                    <div className="text-xs text-green-400 font-bold mb-2">+{pack.bonus}% Extra</div>
                  )}
                </div>
                <div className={`px-4 py-2 rounded-[24px] font-bold text-sm ${pack.pop ? 'bg-yellow-500 text-black shadow-[0_0_15px_rgba(234,179,8,0.5)]' : 'glass'}`}>
                  ${pack.price}
                </div>
              </div>
            </motion.div>
          ))}
        </div>
        
        <div className="mt-12 p-6 glass-panel flex flex-col sm:flex-row items-center sm:items-start gap-4 max-w-2xl mx-auto">
          <CreditCard className="text-white/40 shrink-0 mt-1" />
          <div className="text-xs text-white/50 leading-relaxed text-center sm:text-left">
            Todas as compras são processadas com segurança. As moedas digitais não possuem valor monetário real e são usadas exclusivamente para participar em torneios da comunidade.
          </div>
        </div>
      </div>
    </div>
  );
}
