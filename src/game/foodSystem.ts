import { createSegmentRect, intersectsAny, pointDistance } from './collisionEngine';
import type { Point, Rect } from './types';

interface SpawnFoodOptions {
  cellSize: number;
  obstacles: Rect[];
  snake: Point[];
  reservedRects: Rect[];
}

const MAX_ATTEMPTS = 260;

export function spawnFood({ cellSize, obstacles, snake, reservedRects }: SpawnFoodOptions): Point {
  const maxX = Math.max(cellSize, window.innerWidth - cellSize);
  const maxY = Math.max(cellSize, window.innerHeight - cellSize);

  for (let attempt = 0; attempt < MAX_ATTEMPTS; attempt += 1) {
    const food = {
      x: snapToGrid(randomBetween(cellSize, maxX), cellSize),
      y: snapToGrid(randomBetween(cellSize, maxY), cellSize),
    };

    if (isSafePoint(food, cellSize, obstacles, snake, reservedRects)) return food;
  }

  return findFallbackPoint(cellSize, obstacles, snake, reservedRects);
}

export function findSafeSnakeStart(cellSize: number, obstacles: Rect[], reservedRects: Rect[]): Point {
  const startCandidates: Point[] = [
    { x: cellSize * 2, y: window.innerHeight - cellSize * 4 },
    { x: cellSize * 2, y: cellSize * 5 },
    { x: window.innerWidth - cellSize * 8, y: cellSize * 5 },
    { x: window.innerWidth - cellSize * 8, y: window.innerHeight - cellSize * 4 },
    { x: Math.floor(window.innerWidth / 2 / cellSize) * cellSize, y: Math.floor(window.innerHeight / 2 / cellSize) * cellSize },
  ];

  const safe = startCandidates.find((point) => isSafePoint(point, cellSize, obstacles, [], reservedRects));
  return safe || findFallbackPoint(cellSize, obstacles, [], reservedRects);
}

function findFallbackPoint(cellSize: number, obstacles: Rect[], snake: Point[], reservedRects: Rect[]): Point {
  for (let y = cellSize; y < window.innerHeight - cellSize; y += cellSize) {
    for (let x = cellSize; x < window.innerWidth - cellSize; x += cellSize) {
      const point = { x, y };
      if (isSafePoint(point, cellSize, obstacles, snake, reservedRects)) return point;
    }
  }

  return { x: cellSize, y: cellSize };
}

function isSafePoint(point: Point, cellSize: number, obstacles: Rect[], snake: Point[], reservedRects: Rect[]): boolean {
  const rect = createSegmentRect(point, cellSize);
  const collidesWithSnake = snake.some((segment) => pointDistance(segment, point) < cellSize);
  return !collidesWithSnake && !intersectsAny(rect, obstacles) && !intersectsAny(rect, reservedRects);
}

function randomBetween(min: number, max: number): number {
  return min + Math.random() * Math.max(min, max - min);
}

function snapToGrid(value: number, cellSize: number): number {
  return Math.round(value / cellSize) * cellSize;
}
