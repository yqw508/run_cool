import { describe, expect, it } from 'vitest';
import { ART_ASSETS } from './artAssets';
import { LEVEL_THEMES } from './levels';

describe('final art assets', () => {
  it('defines lobby and map select background slots', () => {
    expect(ART_ASSETS.backgrounds.lobby.key).toBe('art-bg-lobby-garden');
    expect(ART_ASSETS.backgrounds.mapSelect.key).toBe('art-bg-map-select');
  });

  it('defines a runner background and thumbnail slot for every level theme', () => {
    for (const theme of LEVEL_THEMES) {
      expect(ART_ASSETS.runnerBackgrounds[theme.id].key).toBe(`art-bg-runner-${theme.id}`);
      expect(ART_ASSETS.mapThumbnails[theme.id].key).toBe(`art-thumb-${theme.id}`);
    }
  });
});
