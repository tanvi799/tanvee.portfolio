import './SnakeGame.css';
import { createSegmentRect, hitsViewport, intersectsAny, pointDistance } from './collisionEngine';
import { findSafeSnakeStart, spawnFood } from './foodSystem';
import { detectObstacles } from './obstacleDetection';
import { readHighScore, writeHighScore } from './storage';
import type { Direction, DirectionName, Point, Rect, SnakeGameState } from './types';

const CELL_SIZE = 18;
const TICK_MS = 118;
const KEY_TO_DIRECTION: Record<string, DirectionName> = {
  ArrowUp: 'up',
  KeyW: 'up',
  ArrowDown: 'down',
  KeyS: 'down',
  ArrowLeft: 'left',
  KeyA: 'left',
  ArrowRight: 'right',
  KeyD: 'right',
};

const DIRECTIONS: Record<DirectionName, Direction> = {
  up: { name: 'up', x: 0, y: -CELL_SIZE },
  down: { name: 'down', x: 0, y: CELL_SIZE },
  left: { name: 'left', x: -CELL_SIZE, y: 0 },
  right: { name: 'right', x: CELL_SIZE, y: 0 },
};

export function useSnakeGame(toggleButton: HTMLButtonElement): { destroy: () => void } {
  const game = new PageSnakeGame(toggleButton);
  return {
    destroy: () => game.destroy(),
  };
}

class PageSnakeGame {
  private readonly toggleButton: HTMLButtonElement;
  private readonly layer = document.createElement('canvas');
  private readonly ctx: CanvasRenderingContext2D;
  private readonly scoreBadge = document.createElement('div');
  private readonly indicator = document.createElement('div');
  private readonly gameOverPopup = document.createElement('div');
  private readonly scoreText = document.createElement('span');
  private readonly highScoreText = document.createElement('span');
  private readonly restartButton = document.createElement('button');
  private state: SnakeGameState;
  private obstacles: Rect[] = [];
  private reservedRects: Rect[] = [];
  private isActive = false;
  private timer = 0;
  private obstacleTimer = 0;
  private touchStart: Point | null = null;
  private readonly disposers: Array<() => void> = [];

  constructor(toggleButton: HTMLButtonElement) {
    this.toggleButton = toggleButton;
    this.ctx = this.getContext(this.layer);
    this.state = this.createState();
    this.createUi();
    this.bindStaticEvents();
    this.draw();
  }

  destroy(): void {
    this.stop();
    this.disposers.splice(0).forEach((dispose) => dispose());
    this.layer.remove();
    this.scoreBadge.remove();
    this.indicator.remove();
    this.gameOverPopup.remove();
  }

  private bindStaticEvents(): void {
    const onToggle = () => this.toggle();
    this.toggleButton.addEventListener('click', onToggle);
    this.restartButton.addEventListener('click', () => this.restart());
    this.disposers.push(() => this.toggleButton.removeEventListener('click', onToggle));
  }

  private addActiveEvents(): void {
    const onKeyDown = (event: KeyboardEvent) => this.handleKeyDown(event);
    const onResize = () => this.handleViewportChange();
    const onScroll = () => this.refreshObstacles();
    const onTouchStart = (event: TouchEvent) => this.handleTouchStart(event);
    const onTouchEnd = (event: TouchEvent) => this.handleTouchEnd(event);
    const onTouchMove = (event: TouchEvent) => {
      if (this.state.status === 'running') event.preventDefault();
    };

    document.addEventListener('keydown', onKeyDown);
    window.addEventListener('resize', onResize);
    window.addEventListener('scroll', onScroll, { passive: true });
    window.addEventListener('touchstart', onTouchStart, { passive: true });
    window.addEventListener('touchend', onTouchEnd, { passive: true });
    window.addEventListener('touchmove', onTouchMove, { passive: false });
    this.disposers.push(
      () => document.removeEventListener('keydown', onKeyDown),
      () => window.removeEventListener('resize', onResize),
      () => window.removeEventListener('scroll', onScroll),
      () => window.removeEventListener('touchstart', onTouchStart),
      () => window.removeEventListener('touchend', onTouchEnd),
      () => window.removeEventListener('touchmove', onTouchMove),
    );
  }

  private toggle(): void {
    if (this.isActive) this.stop();
    else this.start();
  }

  private start(): void {
    if (this.isActive) return;
    this.isActive = true;
    this.toggleButton.setAttribute('aria-pressed', 'true');
    document.body.classList.add('snake-page-active');
    this.layer.classList.add('is-active');
    this.scoreBadge.classList.add('is-active');
    this.indicator.classList.add('is-active');
    this.resizeCanvas();
    this.refreshObstacles();
    this.state = this.createState();
    this.state.status = 'running';
    this.addActiveEvents();
    this.timer = window.setInterval(() => this.step(), TICK_MS);
    this.obstacleTimer = window.setInterval(() => this.refreshObstacles(), 650);
    this.updateUi();
    this.draw();
  }

  private stop(): void {
    if (!this.isActive) return;
    this.isActive = false;
    window.clearInterval(this.timer);
    window.clearInterval(this.obstacleTimer);
    this.timer = 0;
    this.obstacleTimer = 0;
    document.body.classList.remove('snake-page-active', 'snake-page-game-over');
    this.layer.classList.remove('is-active');
    this.scoreBadge.classList.remove('is-active');
    this.indicator.classList.remove('is-active');
    this.gameOverPopup.classList.remove('is-visible');
    this.gameOverPopup.setAttribute('aria-hidden', 'true');
    this.toggleButton.setAttribute('aria-pressed', 'false');
    this.clearActiveDisposers();
    this.draw();
  }

  private restart(): void {
    document.body.classList.remove('snake-page-game-over');
    this.gameOverPopup.classList.remove('is-visible');
    this.gameOverPopup.setAttribute('aria-hidden', 'true');
    this.refreshObstacles();
    this.state = this.createState();
    this.state.status = 'running';
    window.clearInterval(this.timer);
    this.timer = window.setInterval(() => this.step(), TICK_MS);
    this.updateUi();
    this.draw();
  }

  private step(): void {
    if (this.state.status !== 'running') return;

    const direction = this.state.pendingDirection;
    const head = this.state.snake[0];
    const nextHead = {
      x: head.x + direction.x,
      y: head.y + direction.y,
    };
    const willEat = pointDistance(nextHead, this.state.food) < CELL_SIZE;
    const bodyToCheck = willEat ? this.state.snake : this.state.snake.slice(0, -1);
    const headRect = createSegmentRect(nextHead, CELL_SIZE);
    const hitsBody = bodyToCheck.some((segment) => pointDistance(segment, nextHead) < CELL_SIZE / 2);
    const hitsObstacle = intersectsAny(headRect, this.obstacles);

    if (hitsViewport(headRect) || hitsBody || hitsObstacle) {
      this.endGame();
      return;
    }

    const snake = [nextHead, ...this.state.snake];
    if (willEat) {
      this.state.score += 10;
      this.state.food = spawnFood({
        cellSize: CELL_SIZE,
        obstacles: this.obstacles,
        snake,
        reservedRects: this.reservedRects,
      });
    } else {
      snake.pop();
    }

    this.state = {
      ...this.state,
      snake,
      direction,
    };
    this.updateUi();
    this.draw();
  }

  private endGame(): void {
    window.clearInterval(this.timer);
    this.timer = 0;
    this.state.status = 'game-over';
    this.state.highScore = writeHighScore(this.state.score);
    document.body.classList.add('snake-page-game-over');
    this.gameOverPopup.classList.add('is-visible');
    this.gameOverPopup.setAttribute('aria-hidden', 'false');
    this.updateUi();
    this.draw();
    this.restartButton.focus({ preventScroll: true });
  }

  private handleKeyDown(event: KeyboardEvent): void {
    const directionName = KEY_TO_DIRECTION[event.code];
    if (directionName) {
      event.preventDefault();
      this.queueDirection(directionName);
      return;
    }

    if (event.code === 'Escape') {
      event.preventDefault();
      this.stop();
    }
  }

  private handleTouchStart(event: TouchEvent): void {
    const touch = event.changedTouches[0];
    if (!touch) return;
    this.touchStart = { x: touch.clientX, y: touch.clientY };
  }

  private handleTouchEnd(event: TouchEvent): void {
    if (!this.touchStart) return;
    const touch = event.changedTouches[0];
    if (!touch) return;

    const dx = touch.clientX - this.touchStart.x;
    const dy = touch.clientY - this.touchStart.y;
    this.touchStart = null;

    if (Math.max(Math.abs(dx), Math.abs(dy)) < 28) return;
    if (Math.abs(dx) > Math.abs(dy)) this.queueDirection(dx > 0 ? 'right' : 'left');
    else this.queueDirection(dy > 0 ? 'down' : 'up');
  }

  private queueDirection(directionName: DirectionName): void {
    const next = DIRECTIONS[directionName];
    const current = this.state.direction;
    const reversing = next.x + current.x === 0 && next.y + current.y === 0;
    if (!reversing) this.state.pendingDirection = next;
  }

  private createState(): SnakeGameState {
    const start = findSafeSnakeStart(CELL_SIZE, this.obstacles, this.reservedRects);
    const snake = [
      start,
      { x: start.x - CELL_SIZE, y: start.y },
      { x: start.x - CELL_SIZE * 2, y: start.y },
    ];

    return {
      status: 'idle',
      snake,
      food: spawnFood({
        cellSize: CELL_SIZE,
        obstacles: this.obstacles,
        snake,
        reservedRects: this.reservedRects,
      }),
      direction: DIRECTIONS.right,
      pendingDirection: DIRECTIONS.right,
      score: 0,
      highScore: readHighScore(),
    };
  }

  private createUi(): void {
    this.layer.className = 'snake-page-layer';
    this.layer.setAttribute('aria-hidden', 'true');

    this.scoreBadge.className = 'snake-score-badge';
    this.scoreBadge.dataset.snakeUi = 'true';
    this.scoreBadge.innerHTML = '<span>Score</span>';
    this.scoreBadge.append(this.scoreText);

    this.indicator.className = 'snake-mode-indicator';
    this.indicator.dataset.snakeUi = 'true';
    this.indicator.textContent = 'Game Mode';

    this.restartButton.className = 'snake-popup-button';
    this.restartButton.type = 'button';
    this.restartButton.textContent = 'Restart';

    this.gameOverPopup.className = 'snake-game-over-popup';
    this.gameOverPopup.dataset.snakeUi = 'true';
    this.gameOverPopup.setAttribute('role', 'dialog');
    this.gameOverPopup.setAttribute('aria-modal', 'true');
    this.gameOverPopup.setAttribute('aria-hidden', 'true');
    this.gameOverPopup.setAttribute('aria-labelledby', 'snakeGameOverTitle');
    this.gameOverPopup.innerHTML = `
      <div class="snake-popup-kicker">Snake stopped</div>
      <h2 id="snakeGameOverTitle">Game Over</h2>
      <p class="snake-popup-score"></p>
      <p class="snake-popup-help">Avoid text, cards, buttons, images, and the edge of the screen.</p>
    `;
    this.gameOverPopup.append(this.restartButton);

    document.body.append(this.layer, this.scoreBadge, this.indicator, this.gameOverPopup);
    this.updateUi();
  }

  private refreshObstacles(): void {
    this.reservedRects = [this.scoreBadge, this.indicator, this.gameOverPopup]
      .filter((element) => element.classList.contains('is-active') || element.classList.contains('is-visible'))
      .map((element) => {
        const rect = element.getBoundingClientRect();
        return { x: rect.left, y: rect.top, width: rect.width, height: rect.height };
      });
    this.obstacles = detectObstacles();
  }

  private handleViewportChange(): void {
    this.resizeCanvas();
    this.refreshObstacles();
    this.draw();
  }

  private resizeCanvas(): void {
    const scale = window.devicePixelRatio || 1;
    this.layer.width = Math.round(window.innerWidth * scale);
    this.layer.height = Math.round(window.innerHeight * scale);
    this.ctx.setTransform(scale, 0, 0, scale, 0, 0);
  }

  private draw(): void {
    this.ctx.clearRect(0, 0, window.innerWidth, window.innerHeight);
    if (!this.isActive) return;

    this.drawFood(this.state.food);
    this.state.snake.forEach((segment, index) => this.drawSegment(segment, index === 0));
  }

  private drawSegment(segment: Point, isHead: boolean): void {
    this.ctx.fillStyle = isHead ? '#5ac8fa' : '#0a84ff';
    this.ctx.shadowColor = 'rgba(10, 132, 255, 0.32)';
    this.ctx.shadowBlur = isHead ? 14 : 8;
    this.ctx.beginPath();
    this.ctx.roundRect(segment.x, segment.y, CELL_SIZE, CELL_SIZE, 5);
    this.ctx.fill();
    this.ctx.shadowBlur = 0;
  }

  private drawFood(food: Point): void {
    this.ctx.fillStyle = '#ff375f';
    this.ctx.shadowColor = 'rgba(255, 55, 95, 0.36)';
    this.ctx.shadowBlur = 14;
    this.ctx.beginPath();
    this.ctx.arc(food.x + CELL_SIZE / 2, food.y + CELL_SIZE / 2, CELL_SIZE / 2.6, 0, Math.PI * 2);
    this.ctx.fill();
    this.ctx.shadowBlur = 0;
  }

  private updateUi(): void {
    this.scoreText.textContent = String(this.state.score);
    this.highScoreText.textContent = String(this.state.highScore);
    const popupScore = this.gameOverPopup.querySelector<HTMLElement>('.snake-popup-score');
    if (popupScore) popupScore.textContent = `Score ${this.state.score} · High score ${this.state.highScore}`;
  }

  private clearActiveDisposers(): void {
    const staticToggleDisposer = this.disposers.shift();
    this.disposers.splice(0).forEach((dispose) => dispose());
    if (staticToggleDisposer) this.disposers.push(staticToggleDisposer);
  }

  private getContext(canvas: HTMLCanvasElement): CanvasRenderingContext2D {
    const context = canvas.getContext('2d');
    if (!context) throw new Error('Canvas 2D context is unavailable.');
    return context;
  }
}
