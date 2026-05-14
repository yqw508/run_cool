import { describe, expect, it } from 'vitest';
import { GAME_HEIGHT, GAME_WIDTH } from './config';
import { getLaneX, getRunSpeed, getScore, getSpawnDelay, nextLane } from './progression';

describe('progression helpers', () => {
  it('places three lanes across the playfield', () => {
    expect(getLaneX(0)).toBeCloseTo(GAME_WIDTH * 0.25);
    expect(getLaneX(1)).toBeCloseTo(GAME_WIDTH * 0.5);
    expect(getLaneX(2)).toBeCloseTo(GAME_WIDTH * 0.75);
  });

  it('clamps lane movement at both edges', () => {
    expect(nextLane(0, -1)).toBe(0);
    expect(nextLane(1, -1)).toBe(0);
    expect(nextLane(1, 1)).toBe(2);
    expect(nextLane(2, 1)).toBe(2);
  });

  it('increases speed but keeps it child-friendly', () => {
    expect(getRunSpeed(0)).toBe(230);
    expect(getRunSpeed(60_000)).toBeGreaterThan(getRunSpeed(0));
    expect(getRunSpeed(300_000)).toBe(520);
  });

  it('shortens spawn delay as time passes', () => {
    expect(getSpawnDelay(0)).toBe(1200);
    expect(getSpawnDelay(90_000)).toBeLessThan(getSpawnDelay(0));
    expect(getSpawnDelay(300_000)).toBe(620);
  });

  it('scores distance and collected coins', () => {
    expect(getScore(12.4, 3)).toBe(42);
  });

  it('scores configurable collectible values', () => {
    expect(getScore(12.4, 3, 5)).toBe(27);
  });

  it('keeps configured game height stable', () => {
    expect(GAME_HEIGHT).toBe(720);
  });
});
