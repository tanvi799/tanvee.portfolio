import type { Rect } from './types';

const OBSTACLE_SELECTOR = [
  'nav a',
  'nav button',
  'h1',
  'h2',
  'h3',
  'p',
  '.btn',
  '.hero-card',
  '.hero-badge',
  '.info-card',
  '.skill-group',
  '.timeline-item',
  '.project-row',
  '.contact-link',
  '.cta-card',
  '.footer-links a',
  'img',
  'button',
  'a',
].join(',');

const EDGE_PADDING = 4;

export function detectObstacles(): Rect[] {
  const elements = [...document.querySelectorAll<HTMLElement>(OBSTACLE_SELECTOR)];

  return elements
    .filter((element) => shouldUseElement(element))
    .map((element) => element.getBoundingClientRect())
    .filter((rect) => rect.width > 4 && rect.height > 4)
    .map((rect) => ({
      x: rect.left - EDGE_PADDING,
      y: rect.top - EDGE_PADDING,
      width: rect.width + EDGE_PADDING * 2,
      height: rect.height + EDGE_PADDING * 2,
    }));
}

function shouldUseElement(element: HTMLElement): boolean {
  if (element.closest('[data-snake-ui="true"]')) return false;
  if (element.closest('.snake-page-layer')) return false;
  if (element.id === 'scrollProgress') return false;
  if (element.classList.contains('cursor-dot') || element.classList.contains('cursor-ring')) return false;

  const style = window.getComputedStyle(element);
  if (style.display === 'none' || style.visibility === 'hidden' || Number(style.opacity) === 0) return false;

  const rect = element.getBoundingClientRect();
  const inViewport = rect.bottom >= 0 && rect.right >= 0 && rect.top <= window.innerHeight && rect.left <= window.innerWidth;
  return inViewport;
}
