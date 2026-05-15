import type { ThemeId } from './levels';

export type ArtAsset = {
  key: string;
  url?: string;
};

const missing = (key: string): ArtAsset => ({ key });

export const ART_ASSETS = {
  backgrounds: {
    lobby: { key: 'art-bg-lobby-garden', url: new URL('../assets/backgrounds/lobby-garden.png', import.meta.url).href },
    mapSelect: { key: 'art-bg-map-select', url: new URL('../assets/backgrounds/map-select.png', import.meta.url).href }
  },
  runnerBackgrounds: {
    campus: { key: 'art-bg-runner-campus', url: new URL('../assets/backgrounds/runner-campus.png', import.meta.url).href },
    mall: { key: 'art-bg-runner-mall', url: new URL('../assets/backgrounds/runner-mall.png', import.meta.url).href },
    zoo: { key: 'art-bg-runner-zoo', url: new URL('../assets/backgrounds/runner-zoo.png', import.meta.url).href },
    amusement: { key: 'art-bg-runner-amusement', url: new URL('../assets/backgrounds/runner-amusement.png', import.meta.url).href }
  },
  mapThumbnails: {
    campus: missing('art-thumb-campus'),
    mall: missing('art-thumb-mall'),
    zoo: missing('art-thumb-zoo'),
    amusement: missing('art-thumb-amusement')
  }
} satisfies {
  backgrounds: Record<'lobby' | 'mapSelect', ArtAsset>;
  runnerBackgrounds: Record<ThemeId, ArtAsset>;
  mapThumbnails: Record<ThemeId, ArtAsset>;
};

export const ALL_FINAL_ART_ASSETS: ArtAsset[] = [
  ...Object.values(ART_ASSETS.backgrounds),
  ...Object.values(ART_ASSETS.runnerBackgrounds),
  ...Object.values(ART_ASSETS.mapThumbnails)
].filter((asset) => Boolean(asset.url));
