const HIGH_SCORE_KEY = 'tanviPortfolioPageSnakeHighScore';

export function readHighScore(): number {
  const stored = window.localStorage.getItem(HIGH_SCORE_KEY);
  const score = Number(stored);
  return Number.isFinite(score) ? score : 0;
}

export function writeHighScore(score: number): number {
  const nextScore = Math.max(readHighScore(), score);
  window.localStorage.setItem(HIGH_SCORE_KEY, String(nextScore));
  return nextScore;
}
