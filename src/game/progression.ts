import {
  BASE_SPEED,
  GAME_WIDTH,
  LANE_WIDTH,
  MAX_SPEED,
  MIN_SPAWN_DELAY,
  START_SPAWN_DELAY,
  type LaneIndex
} from './config';

export function getLaneX(lane: LaneIndex): number {
  return LANE_WIDTH * (lane + 1);
}

export function nextLane(currentLane: LaneIndex, direction: -1 | 1): LaneIndex {
  const next = Math.max(0, Math.min(2, currentLane + direction));
  return next as LaneIndex;
}

export function getRunSpeed(elapsedMs: number): number {
  const speed = BASE_SPEED + Math.floor(elapsedMs / 1000) * 6;
  return Math.min(MAX_SPEED, speed);
}

export function getSpawnDelay(elapsedMs: number): number {
  const delay = START_SPAWN_DELAY - Math.floor(elapsedMs / 1000) * 8;
  return Math.max(MIN_SPAWN_DELAY, delay);
}

export function getScore(distanceMeters: number, coins: number): number {
  return Math.floor(distanceMeters) + coins * 10;
}

export function getRoadPerspectiveY(row: number): number {
  return 170 + row * 92;
}

export function getLaneGuideX(lane: LaneIndex): number {
  return getLaneX(lane) - GAME_WIDTH / 2;
}
