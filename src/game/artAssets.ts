import type { ThemeId } from './levels';

export type ArtAsset = {
  key: string;
  url?: string;
};

const missing = (key: string): ArtAsset => ({ key });

export const ART_ASSETS = {
  backgrounds: {
    lobby: { key: 'art-bg-lobby-garden', url: new URL('../assets/backgrounds/lobby-garden.png', import.meta.url).href },
    mapSelect: missing('art-bg-map-select')
  },
  runnerBackgrounds: {
    campus: missing('art-bg-runner-campus'),
    mall: missing('art-bg-runner-mall'),
    zoo: missing('art-bg-runner-zoo'),
    amusement: missing('art-bg-runner-amusement')
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
