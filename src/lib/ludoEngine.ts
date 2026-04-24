export type PlayerColor = 'RED' | 'GREEN' | 'YELLOW' | 'BLUE';

export interface Pawn {
  id: string;
  color: PlayerColor;
  position: number; // -1: base, 0-50: path, 51-55: home run, 56: finished
  baseIndex: number;
}

export const PATH_COORDS = [
  [1,6], [2,6], [3,6], [4,6], [5,6],
  [6,5], [6,4], [6,3], [6,2], [6,1], [6,0],
  [7,0], [8,0],
  
  [8,1], [8,2], [8,3], [8,4], [8,5],
  [9,6], [10,6], [11,6], [12,6], [13,6], [14,6],
  [14,7], [14,8],
  
  [13,8], [12,8], [11,8], [10,8], [9,8],
  [8,9], [8,10], [8,11], [8,12], [8,13], [8,14],
  [7,14], [6,14],
  
  [6,13], [6,12], [6,11], [6,10], [6,9],
  [5,8], [4,8], [3,8], [2,8], [1,8], [0,8],
  [0,7], [0,6]
];

export const START_INDEX = {
  RED: 0,
  GREEN: 13,
  YELLOW: 26,
  BLUE: 39
};

export const HOME_RUN_COORDS = {
  RED: [[1,7], [2,7], [3,7], [4,7], [5,7], [6,7]],
  GREEN: [[7,1], [7,2], [7,3], [7,4], [7,5], [7,6]],
  YELLOW: [[13,7], [12,7], [11,7], [10,7], [9,7], [8,7]],
  BLUE: [[7,13], [7,12], [7,11], [7,10], [7,9], [7,8]],
};

export function getPawnCoords(pawn: Pawn): [number, number] {
  if (pawn.position === -1) {
    const bases: Record<PlayerColor, [number, number][]> = {
      RED: [[2,2], [4,2], [2,4], [4,4]],
      GREEN: [[11,2], [13,2], [11,4], [13,4]],
      YELLOW: [[11,11], [13,11], [11,13], [13,13]],
      BLUE: [[2,11], [4,11], [2,13], [4,13]],
    };
    return bases[pawn.color][pawn.baseIndex];
  }

  if (pawn.position >= 0 && pawn.position <= 50) {
    const absPos = (pawn.position + START_INDEX[pawn.color]) % 52;
    return PATH_COORDS[absPos] as [number, number];
  }

  if (pawn.position >= 51 && pawn.position <= 56) {
    return HOME_RUN_COORDS[pawn.color][pawn.position - 51] as [number, number];
  }

  return [7.5, 7.5];
}

export function initializePawns(activeColors: PlayerColor[] = ['RED', 'GREEN', 'YELLOW', 'BLUE']): Pawn[] {
  const pawns: Pawn[] = [];
  let id = 0;
  for (const color of activeColors) {
    for (let i = 0; i < 4; i++) {
      pawns.push({ id: `p_${id++}`, color, position: -1, baseIndex: i });
    }
  }
  return pawns;
}

export const ABSOLUTE_SAFE_SQUARES = [0, 8, 13, 21, 26, 34, 39, 47];

export function getAbsolutePosition(pawn: Pawn): number {
  if (pawn.position < 0 || pawn.position > 50) return -1;
  return (pawn.position + START_INDEX[pawn.color]) % 52;
}

export function canPlay(pawn: Pawn, dice: number): boolean {
  if (pawn.position === -1) return dice === 6;
  if (pawn.position + dice <= 56) return true;
  return false;
}
