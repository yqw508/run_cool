export const GAME_WIDTH = 390;
export const GAME_HEIGHT = 720;

export const LANES = [0, 1, 2] as const;
export type LaneIndex = (typeof LANES)[number];

export const PLAYER_Y = 570;
export const LANE_WIDTH = GAME_WIDTH / 4;
export const BASE_SPEED = 230;
export const MAX_SPEED = 520;
export const START_SPAWN_DELAY = 1200;
export const MIN_SPAWN_DELAY = 620;
export const JUMP_DURATION_MS = 620;
export const SLIDE_DURATION_MS = 560;
export const GESTURE_MIN_DISTANCE = 28;
