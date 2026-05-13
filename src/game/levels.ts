export type ThemeId = 'campus' | 'mall' | 'zoo' | 'amusement';

export type LandmarkKind =
  | 'school'
  | 'track'
  | 'library'
  | 'arcade'
  | 'restaurant'
  | 'cinema'
  | 'zooGate'
  | 'animal'
  | 'fence'
  | 'ferrisWheel'
  | 'rollerCoaster'
  | 'carousel';

export type ObstacleShape =
  | 'schoolRail'
  | 'schoolBag'
  | 'cart'
  | 'shopStand'
  | 'woodFence'
  | 'bush'
  | 'parkGate'
  | 'balloons';

export type ThemeObstacle = {
  label: string;
  color: number;
  accentColor: number;
  shape: ObstacleShape;
};

export type LevelTheme = {
  id: ThemeId;
  label: string;
  startsAtMeters: number;
  skyColor: number;
  groundColor: number;
  roadColor: number;
  laneColor: number;
  titleColor: number;
  musicKey: string;
  landmarks: LandmarkKind[];
  obstacles: ThemeObstacle[];
};

export const LEVEL_SEGMENT_METERS = 250;

export const LEVEL_THEMES: LevelTheme[] = [
  {
    id: 'campus',
    label: '校园',
    startsAtMeters: 0,
    skyColor: 0x74d4ff,
    groundColor: 0x65c970,
    roadColor: 0x526c7a,
    laneColor: 0xffffff,
    titleColor: 0xffffff,
    musicKey: 'music-campus',
    landmarks: ['school', 'track', 'library'],
    obstacles: [
      { label: '栏杆', color: 0x2f80ed, accentColor: 0xffd447, shape: 'schoolRail' },
      { label: '书包', color: 0xff6b6b, accentColor: 0xffffff, shape: 'schoolBag' }
    ]
  },
  {
    id: 'mall',
    label: '商场',
    startsAtMeters: LEVEL_SEGMENT_METERS,
    skyColor: 0xffc6d9,
    groundColor: 0xf6a85f,
    roadColor: 0x6a5b7c,
    laneColor: 0xfff1a8,
    titleColor: 0x17263a,
    musicKey: 'music-mall',
    landmarks: ['arcade', 'restaurant', 'cinema'],
    obstacles: [
      { label: '购物车', color: 0xff87b7, accentColor: 0xffffff, shape: 'cart' },
      { label: '甜品摊', color: 0xffd447, accentColor: 0xe85d5d, shape: 'shopStand' }
    ]
  },
  {
    id: 'zoo',
    label: '动物园',
    startsAtMeters: LEVEL_SEGMENT_METERS * 2,
    skyColor: 0xa7e7c7,
    groundColor: 0x58b368,
    roadColor: 0x7a6b4f,
    laneColor: 0xf8fbff,
    titleColor: 0x17263a,
    musicKey: 'music-zoo',
    landmarks: ['zooGate', 'animal', 'fence'],
    obstacles: [
      { label: '木栅栏', color: 0x9a6a38, accentColor: 0xffe2a8, shape: 'woodFence' },
      { label: '灌木丛', color: 0x2f9e62, accentColor: 0xc6f7b2, shape: 'bush' }
    ]
  },
  {
    id: 'amusement',
    label: '游乐园',
    startsAtMeters: LEVEL_SEGMENT_METERS * 3,
    skyColor: 0x8fd7ff,
    groundColor: 0xffd166,
    roadColor: 0x5e7bb8,
    laneColor: 0xffffff,
    titleColor: 0x17263a,
    musicKey: 'music-amusement',
    landmarks: ['ferrisWheel', 'rollerCoaster', 'carousel'],
    obstacles: [
      { label: '小拱门', color: 0x7a5cff, accentColor: 0xffffff, shape: 'parkGate' },
      { label: '气球串', color: 0xff5a76, accentColor: 0xffd447, shape: 'balloons' }
    ]
  }
];

export function getThemeIndexForDistance(distanceMeters: number): number {
  const index = Math.floor(Math.max(0, distanceMeters) / LEVEL_SEGMENT_METERS);
  return Math.min(index, LEVEL_THEMES.length - 1);
}

export function getThemeForDistance(distanceMeters: number): LevelTheme {
  return LEVEL_THEMES[getThemeIndexForDistance(distanceMeters)];
}

export function getThemeForRunDistance(startThemeIndex: number, distanceMeters: number): LevelTheme {
  const normalizedStart = Math.max(0, Math.min(LEVEL_THEMES.length - 1, startThemeIndex));
  const progressedIndex = normalizedStart + getThemeIndexForDistance(distanceMeters);
  return LEVEL_THEMES[Math.min(progressedIndex, LEVEL_THEMES.length - 1)];
}
