export type DirectionName = 'up' | 'down' | 'left' | 'right';

export type GameStatus = 'idle' | 'running' | 'game-over';

export interface Point {
  x: number;
  y: number;
}

export interface Direction extends Point {
  name: DirectionName;
}

export interface Rect {
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface SnakeGameState {
  status: GameStatus;
  snake: Point[];
  food: Point;
  direction: Direction;
  pendingDirection: Direction;
  score: number;
  highScore: number;
}
