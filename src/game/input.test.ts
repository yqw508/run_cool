import { describe, expect, it } from 'vitest';
import { classifyGesture } from './input';

describe('classifyGesture', () => {
  it('returns none for small movement', () => {
    expect(classifyGesture({ startX: 10, startY: 10, endX: 20, endY: 22 })).toBe('none');
  });

  it('classifies horizontal swipes', () => {
    expect(classifyGesture({ startX: 100, startY: 100, endX: 40, endY: 104 })).toBe('left');
    expect(classifyGesture({ startX: 40, startY: 100, endX: 100, endY: 104 })).toBe('right');
  });

  it('classifies vertical swipes', () => {
    expect(classifyGesture({ startX: 80, startY: 120, endX: 82, endY: 50 })).toBe('up');
    expect(classifyGesture({ startX: 80, startY: 50, endX: 82, endY: 120 })).toBe('down');
  });
});
