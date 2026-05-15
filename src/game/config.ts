export const GAME_WIDTH = 390;
export const GAME_HEIGHT = 720;

export const LANES = [0, 1, 2] as const;
export type LaneIndex = (typeof LANES)[number];

export const PLAYER_Y = 595;
export const LANE_WIDTH = GAME_WIDTH / 4;
export const BASE_SPEED = 230;
export const MAX_SPEED = 520;
export const START_SPAWN_DELAY = 1200;
export const MIN_SPAWN_DELAY = 620;
export const JUMP_DURATION_MS = 620;
export const SLIDE_DURATION_MS = 560;
export const GESTURE_MIN_DISTANCE = 28;

export type CollectibleKind = 'star' | 'coin' | 'flower' | 'bottle' | 'leaf' | 'balloon';

export type CollectibleConfig = {
  id: string;
  label: string;
  kind: CollectibleKind;
  color: number;
  accentColor: number;
  scoreValue: number;
};

export const COLLECTIBLE_PRESETS: Record<string, CollectibleConfig> = {
  star: {
    id: 'star',
    label: '星星',
    kind: 'star',
    color: 0xffd447,
    accentColor: 0xffffff,
    scoreValue: 10
  },
  coin: {
    id: 'coin',
    label: '金币',
    kind: 'coin',
    color: 0xffc63a,
    accentColor: 0xffffff,
    scoreValue: 10
  },
  flower: {
    id: 'flower',
    label: '小红花',
    kind: 'flower',
    color: 0xff87b7,
    accentColor: 0xffd447,
    scoreValue: 10
  },
  bottle: {
    id: 'bottle',
    label: '水壶',
    kind: 'bottle',
    color: 0xaee6ff,
    accentColor: 0xffffff,
    scoreValue: 10
  },
  leaf: {
    id: 'leaf',
    label: '叶子',
    kind: 'leaf',
    color: 0x7ed957,
    accentColor: 0xffffff,
    scoreValue: 10
  },
  balloon: {
    id: 'balloon',
    label: '气球',
    kind: 'balloon',
    color: 0xff5a76,
    accentColor: 0xffd447,
    scoreValue: 10
  }
};

export const DEFAULT_COLLECTIBLE_CONFIG = COLLECTIBLE_PRESETS.star;

export const PLAYER_HEALTH_CONFIG = {
  maxLives: 3,
  startLives: 3
} as const;
