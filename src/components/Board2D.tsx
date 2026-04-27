import React from 'react';
import { useGameStore } from '../store/gameStore';
import { getPawnCoords, canPlay } from '../lib/ludoEngine';

const colors = {
  RED: '#F43F5E',
  GREEN: '#10B981',
  YELLOW: '#F59E0B',
  BLUE: '#3B82F6',
  WHITE: '#FFFFFF',
  BORDER: '#1F2937',
  TRACK: '#F3F4F6'
};

export function Board2D() {
  const pawns = useGameStore(state => state.pawns);
  const movePawn = useGameStore(state => state.movePawn);
  const turn = useGameStore(state => state.turn);
  const diceValue = useGameStore(state => state.diceValue);
  const room = useGameStore(state => state.room);

  const getPlayerName = (color: string) => {
    const player = room?.players?.find((p: any) => p.color === color);
    return player ? player.name.substring(0, 8) : '';
  };

  return (
    <div className="w-full h-full bg-[#1e1b4b] rounded-[32px] shadow-[0_0_40px_rgba(88,28,255,0.4)] p-3 md:p-5 relative transition-transform ring-4 ring-[#1e1b4b]">
       <svg viewBox="0 0 15 15" className="w-full h-full drop-shadow-xl z-10 relative bg-white rounded-xl overflow-hidden shadow-inner" style={{ stroke: colors.BORDER, strokeWidth: 0.05, strokeLinejoin: 'round' }}>
         <g id="tracks">
           {Array.from({length: 15}).map((_, y) => 
             Array.from({length: 15}).map((_, x) => {
               // Skip corners (house sections)
               if ((x < 6 && y < 6) || (x > 8 && y < 6) || (x < 6 && y > 8) || (x > 8 && y > 8)) return null;
               // Skip center area
               if (x >= 6 && x <= 8 && y >= 6 && y <= 8) return null;
               
               // Determine cell color
               let fill = colors.TRACK;
               
               // Home columns (safe zones)
               if (x === 7 && y > 0 && y < 6) fill = colors.GREEN;
               if (x === 7 && y > 8 && y < 14) fill = colors.BLUE;
               if (y === 7 && x > 0 && x < 6) fill = colors.RED;
               if (y === 7 && x > 8 && x < 14) fill = colors.YELLOW;
               
               // Starting squares
               if (x === 1 && y === 6) fill = colors.RED;
               if (x === 8 && y === 1) fill = colors.GREEN;
               if (x === 13 && y === 8) fill = colors.YELLOW;
               if (x === 6 && y === 13) fill = colors.BLUE;
               
               // Other safe spots (stars usually)
               let isStar = false;
               if ((x === 2 && y === 8) || (x === 6 && y === 2) || (x === 12 && y === 6) || (x === 8 && y === 12)) {
                  fill = '#e5e7eb';
                  isStar = true;
               }

               return (
                 <g key={`c-${x}-${y}`}>
                   <rect x={x} y={y} width={1} height={1} fill={fill} />
                   {isStar && (
                     <polygon 
                       points={`${x + 0.5},${y + 0.1} ${x + 0.6},${y + 0.4} ${x + 0.9},${y + 0.4} ${x + 0.65},${y + 0.6} ${x + 0.75},${y + 0.9} ${x + 0.5},${y + 0.7} ${x + 0.25},${y + 0.9} ${x + 0.35},${y + 0.6} ${x + 0.1},${y + 0.4} ${x + 0.4},${y + 0.4}`} 
                       fill="#9ca3af" 
                     />
                   )}
                   {/* Start squares also have safe zone stars conventionally */}
                   {((x === 1 && y === 6) || (x === 8 && y === 1) || (x === 13 && y === 8) || (x === 6 && y === 13)) && (
                     <polygon 
                       points={`${x + 0.5},${y + 0.1} ${x + 0.6},${y + 0.4} ${x + 0.9},${y + 0.4} ${x + 0.65},${y + 0.6} ${x + 0.75},${y + 0.9} ${x + 0.5},${y + 0.7} ${x + 0.25},${y + 0.9} ${x + 0.35},${y + 0.6} ${x + 0.1},${y + 0.4} ${x + 0.4},${y + 0.4}`} 
                       fill="rgba(255,255,255,0.5)" 
                     />
                   )}
                 </g>
               )
             })
           )}
         </g>
         
         {/* Top Left Base: RED */}
         <g id="base-red">
           <rect x="0" y="0" width="6" height="6" fill={colors.RED} />
           <text x="3" y="0.6" fontSize="0.6" fill="white" textAnchor="middle" fontWeight="bold" stroke="black" strokeWidth="0.05">{getPlayerName('RED')}</text>
           <rect x="1" y="1" width="4" height="4" fill={colors.WHITE} rx="0.5" />
           <circle cx="2" cy="2" r="0.6" fill={colors.RED} />
           <circle cx="4" cy="2" r="0.6" fill={colors.RED} />
           <circle cx="2" cy="4" r="0.6" fill={colors.RED} />
           <circle cx="4" cy="4" r="0.6" fill={colors.RED} />
         </g>

         {/* Top Right Base: GREEN */}
         <g id="base-green" transform="translate(9,0)">
           <rect x="0" y="0" width="6" height="6" fill={colors.GREEN} />
           <text x="3" y="0.6" fontSize="0.6" fill="white" textAnchor="middle" fontWeight="bold" stroke="black" strokeWidth="0.05">{getPlayerName('GREEN')}</text>
           <rect x="1" y="1" width="4" height="4" fill={colors.WHITE} rx="0.5" />
           <circle cx="2" cy="2" r="0.6" fill={colors.GREEN} />
           <circle cx="4" cy="2" r="0.6" fill={colors.GREEN} />
           <circle cx="2" cy="4" r="0.6" fill={colors.GREEN} />
           <circle cx="4" cy="4" r="0.6" fill={colors.GREEN} />
         </g>
         
         {/* Bottom Right Base: YELLOW */}
         <g id="base-yellow" transform="translate(9,9)">
           <rect x="0" y="0" width="6" height="6" fill={colors.YELLOW} />
           <text x="3" y="0.6" fontSize="0.6" fill="white" textAnchor="middle" fontWeight="bold" stroke="black" strokeWidth="0.05">{getPlayerName('YELLOW')}</text>
           <rect x="1" y="1" width="4" height="4" fill={colors.WHITE} rx="0.5" />
           <circle cx="2" cy="2" r="0.6" fill={colors.YELLOW} />
           <circle cx="4" cy="2" r="0.6" fill={colors.YELLOW} />
           <circle cx="2" cy="4" r="0.6" fill={colors.YELLOW} />
           <circle cx="4" cy="4" r="0.6" fill={colors.YELLOW} />
         </g>

         {/* Bottom Left Base: BLUE */}
         <g id="base-blue" transform="translate(0,9)">
           <rect x="0" y="0" width="6" height="6" fill={colors.BLUE} />
           <text x="3" y="0.6" fontSize="0.6" fill="white" textAnchor="middle" fontWeight="bold" stroke="black" strokeWidth="0.05">{getPlayerName('BLUE')}</text>
           <rect x="1" y="1" width="4" height="4" fill={colors.WHITE} rx="0.5" />
           <circle cx="2" cy="2" r="0.6" fill={colors.BLUE} />
           <circle cx="4" cy="2" r="0.6" fill={colors.BLUE} />
           <circle cx="2" cy="4" r="0.6" fill={colors.BLUE} />
           <circle cx="4" cy="4" r="0.6" fill={colors.BLUE} />
         </g>
         
         {/* Central Home Arrow Triangles */}
         <g id="center-home">
           <polygon points="6,6 9,6 7.5,7.5" fill={colors.GREEN} />
           <polygon points="9,6 9,9 7.5,7.5" fill={colors.YELLOW} />
           <polygon points="6,9 9,9 7.5,7.5" fill={colors.BLUE} />
           <polygon points="6,6 6,9 7.5,7.5" fill={colors.RED} />
         </g>

         {/* Dynamic Pawns */}
         <g id="pawns">
           {pawns.map(p => {
             const [x, y] = getPawnCoords(p);
             const isTurn = turn === p.color;
             const isMyPawn = useGameStore.getState().myColor === p.color;
             const isPlayable = isTurn && isMyPawn && diceValue !== null && canPlay(p, diceValue);
             
             // Offset to prevent exact overlap (simplified)
             const overlapping = pawns.filter(o => o.id !== p.id && o.position === p.position && o.position !== -1 && o.color === p.color);
             const offset = overlapping.length > 0 ? (p.baseIndex * 0.15) - 0.15 : 0;

             return (
               <g 
                 key={p.id} 
                 transform={`translate(${x + 0.5 + offset}, ${y + 0.5 + offset})`}
                 onClick={() => isPlayable && movePawn(p.id)}
                 style={{ cursor: isPlayable ? 'pointer' : 'default', transition: 'transform 0.3s cubic-bezier(0.34, 1.56, 0.64, 1)' }}
                 pointerEvents={isPlayable ? 'all' : 'none'}
               >
                 <circle cx="0" cy="0" r="0.4" fill={colors[p.color]} strokeWidth="0.1" stroke={colors.BORDER} />
                 <circle cx="0" cy="0" r="0.15" fill={colors.WHITE} />
                 {isPlayable && (
                   <circle cx="0" cy="0" r="0.6" fill="none" stroke="white" strokeWidth="0.08" className="animate-ping" />
                 )}
               </g>
             );
           })}
         </g>
       </svg>
    </div>
  );
}
