import { useSnakeGame } from './useSnakeGame';

const toggleButton = document.getElementById('gameModeToggle');

if (toggleButton instanceof HTMLButtonElement) {
  useSnakeGame(toggleButton);
}
