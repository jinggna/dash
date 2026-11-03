export type GameState = 'READY' | 'PLAYING' | 'PAUSED' | 'GAMEOVER';

export type ObstacleType = 'POLICE' | 'TRUCK' | 'TAXI' | 'BARRIER';

export interface Point {
  x: number;
  y: number;
}

export type Polygon = Point[];

export interface GameStats {
  score: number;
  timeRemaining: number;
  totalTime: number;
  nitro: number; // 0 - 100
  isFever: boolean;
  feverTimeLeft: number;
  combo: number;
  maxCombo: number;
  nearMissCount: number;
  crashCount: number;
  smashCount: number;
  highScore: number;
  currentSpeed: number;
}
