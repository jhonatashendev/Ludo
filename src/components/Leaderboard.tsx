import React from 'react';
import { useGameStore, Player } from '../store/gameStore';
import { ChevronLeft, Trophy, Medal } from 'lucide-react';
import { motion } from 'motion/react';

const MOCK_LEADERBOARD = [
  { id: 'usr_1', username: 'LudoKing99', coins: 4500000 },
  { id: 'usr_2', username: 'DiceMaster', coins: 3200000 },
  { id: 'usr_3', username: 'ProGamerX', coins: 1800000 },
  { id: 'usr_4', username: 'LuckyStrike', coins: 950000 },
  { id: 'usr_5', username: 'AlexW', coins: 820000 },
  { id: 'usr_6', username: 'Shadow_1', coins: 640000 },
];

export function Leaderboard() {
  const { setView } = useGameStore();

  return (
    <div className="flex flex-col h-screen bg-transparent text-white overflow-y-auto">
      <div className="sticky top-0 z-20 p-5 flex items-center justify-between">
        <button onClick={() => setView('lobby')} className="p-2 glass rounded-[24px] hover:bg-white/10 transition">
          <ChevronLeft size={20} />
        </button>
        <div className="font-['Anton'] uppercase tracking-widest text-lg">Global Ranking</div>
        <div className="w-10"></div>
      </div>

      <div className="flex-1 p-6 max-w-2xl mx-auto w-full">
        <div className="flex justify-center mb-8">
          <div className="relative">
            <Trophy size={80} className="text-yellow-400 drop-shadow-[0_0_30px_rgba(234,179,8,0.4)]" />
            <div className="absolute inset-0 bg-yellow-400/20 blur-2xl rounded-full -z-10"></div>
          </div>
        </div>

        <div className="space-y-3">
          {MOCK_LEADERBOARD.map((user, index) => (
            <motion.div 
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: index * 0.1 }}
              key={user.id} 
              className={`flex items-center justify-between p-4 glass-panel ${
                index === 0 ? 'bg-yellow-500/10 border-yellow-500/30' : 
                index === 1 ? 'bg-slate-300/10 border-slate-300/30' :
                index === 2 ? 'bg-orange-500/10 border-orange-500/30' : 'hover:bg-white/10'
              }`}
            >
              <div className="flex items-center gap-4">
                <div className={`font-['Anton'] text-2xl w-8 text-center ${
                  index === 0 ? 'text-yellow-400 drop-shadow-[0_0_8px_rgba(234,179,8,0.5)]' : 
                  index === 1 ? 'text-slate-300' :
                  index === 2 ? 'text-orange-400' : 'text-white/50'
                }`}>
                  #{index + 1}
                </div>
                <div className="font-bold tracking-wide">{user.username}</div>
              </div>
              <div className="font-mono text-sm text-yellow-400 flex items-center gap-1.5 font-bold">
               {user.coins.toLocaleString()}
              </div>
            </motion.div>
          ))}
        </div>
      </div>
    </div>
  );
}
