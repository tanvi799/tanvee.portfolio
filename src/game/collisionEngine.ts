import type { Point, Rect } from './types';

export function createSegmentRect(point: Point, size: number): Rect {
  return {
    x: point.x,
    y: point.y,
    width: size,
    height: size,
  };
}

export function intersectsAny(rect: Rect, obstacles: Rect[]): boolean {
  return obstacles.some((obstacle) => rectsIntersect(rect, obstacle));
}

export function hitsViewport(rect: Rect): boolean {
  return (
    rect.x < 0 ||
    rect.y < 0 ||
    rect.x + rect.width > window.innerWidth ||
    rect.y + rect.height > window.innerHeight
  );
}

export function rectsIntersect(a: Rect, b: Rect): boolean {
  return (
    a.x < b.x + b.width &&
    a.x + a.width > b.x &&
    a.y < b.y + b.height &&
    a.y + a.height > b.y
  );
}

export function pointDistance(a: Point, b: Point): number {
  return Math.hypot(a.x - b.x, a.y - b.y);
}
