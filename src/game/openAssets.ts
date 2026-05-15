import type { CollectibleKind } from './config';
import type { ThemeId } from './levels';

export type OpenAsset = {
  key: string;
  url: string;
};

export const OPEN_ASSETS = {
  backgrounds: {
    garden: { key: 'kenney-bg-garden', url: new URL('../assets/open/kenney/backgrounds/garden-trees.png', import.meta.url).href },
    campus: { key: 'kenney-bg-campus', url: new URL('../assets/open/kenney/backgrounds/hills.png', import.meta.url).href },
    mall: { key: 'kenney-bg-mall', url: new URL('../assets/open/kenney/backgrounds/desert.png', import.meta.url).href },
    zoo: { key: 'kenney-bg-zoo', url: new URL('../assets/open/kenney/backgrounds/garden-trees.png', import.meta.url).href },
    amusement: { key: 'kenney-bg-amusement', url: new URL('../assets/open/kenney/backgrounds/mushrooms.png', import.meta.url).href }
  },
  collectibles: {
    star: { key: 'kenney-item-star', url: new URL('../assets/open/kenney/items/star.png', import.meta.url).href },
    coin: { key: 'kenney-item-coin', url: new URL('../assets/open/kenney/items/coin-gold.png', import.meta.url).href },
    flower: { key: 'kenney-item-flower', url: new URL('../assets/open/kenney/items/gem-blue.png', import.meta.url).href },
    bottle: { key: 'kenney-item-bottle', url: new URL('../assets/open/kenney/items/heart.png', import.meta.url).href },
    leaf: { key: 'kenney-item-leaf', url: new URL('../assets/open/kenney/items/gem-blue.png', import.meta.url).href },
    balloon: { key: 'kenney-item-balloon', url: new URL('../assets/open/kenney/items/star.png', import.meta.url).href }
  },
  obstacles: {
    rock: { key: 'kenney-obstacle-rock', url: new URL('../assets/open/kenney/obstacles/rock.png', import.meta.url).href },
    spikes: { key: 'kenney-obstacle-spikes', url: new URL('../assets/open/kenney/obstacles/spikes.png', import.meta.url).href },
    fence: { key: 'kenney-obstacle-fence', url: new URL('../assets/open/kenney/obstacles/fence.png', import.meta.url).href },
    bush: { key: 'kenney-obstacle-bush', url: new URL('../assets/open/kenney/obstacles/bush.png', import.meta.url).href },
    spring: { key: 'kenney-obstacle-spring', url: new URL('../assets/open/kenney/obstacles/spring.png', import.meta.url).href }
  }
} satisfies {
  backgrounds: Record<'garden' | ThemeId, OpenAsset>;
  collectibles: Record<CollectibleKind, OpenAsset>;
  obstacles: Record<string, OpenAsset>;
};

export const ALL_OPEN_ASSETS: OpenAsset[] = [
  ...Object.values(OPEN_ASSETS.backgrounds),
  ...Object.values(OPEN_ASSETS.collectibles),
  ...Object.values(OPEN_ASSETS.obstacles)
];
