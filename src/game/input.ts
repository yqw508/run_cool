import Phaser from 'phaser';
import { GESTURE_MIN_DISTANCE } from './config';

export type GestureDirection = 'left' | 'right' | 'up' | 'down' | 'none';

export type GesturePoints = {
  startX: number;
  startY: number;
  endX: number;
  endY: number;
};

export function classifyGesture(points: GesturePoints): GestureDirection {
  const deltaX = points.endX - points.startX;
  const deltaY = points.endY - points.startY;
  const absX = Math.abs(deltaX);
  const absY = Math.abs(deltaY);

  if (Math.max(absX, absY) < GESTURE_MIN_DISTANCE) {
    return 'none';
  }

  if (absX > absY) {
    return deltaX > 0 ? 'right' : 'left';
  }

  return deltaY > 0 ? 'down' : 'up';
}

export function bindSwipeInput(scene: Phaser.Scene, onGesture: (direction: Exclude<GestureDirection, 'none'>) => void): void {
  let startX = 0;
  let startY = 0;

  scene.input.on('pointerdown', (pointer: Phaser.Input.Pointer) => {
    startX = pointer.x;
    startY = pointer.y;
  });

  scene.input.on('pointerup', (pointer: Phaser.Input.Pointer) => {
    const direction = classifyGesture({
      startX,
      startY,
      endX: pointer.x,
      endY: pointer.y
    });

    if (direction !== 'none') {
      onGesture(direction);
    }
  });
}
