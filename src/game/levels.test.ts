import { describe, expect, it } from 'vitest';
import { LEVEL_THEMES, getThemeForDistance, getThemeForRunDistance, getThemeIndexForDistance } from './levels';

describe('level themes', () => {
  it('defines the four requested themes in play order', () => {
    expect(LEVEL_THEMES.map((theme) => theme.id)).toEqual(['campus', 'mall', 'zoo', 'amusement']);
  });

  it('maps distance to the expected theme index', () => {
    expect(getThemeIndexForDistance(0)).toBe(0);
    expect(getThemeIndexForDistance(249)).toBe(0);
    expect(getThemeIndexForDistance(250)).toBe(1);
    expect(getThemeIndexForDistance(500)).toBe(2);
    expect(getThemeIndexForDistance(750)).toBe(3);
  });

  it('keeps long runs on the final amusement theme', () => {
    expect(getThemeForDistance(2000).id).toBe('amusement');
  });

  it('uses the selected theme as the start of a run', () => {
    expect(getThemeForRunDistance(1, 0).id).toBe('mall');
    expect(getThemeForRunDistance(1, 250).id).toBe('zoo');
    expect(getThemeForRunDistance(2, 500).id).toBe('amusement');
  });

  it('exposes visual and audio data for every theme', () => {
    for (const theme of LEVEL_THEMES) {
      expect(theme.label.length).toBeGreaterThan(0);
      expect(theme.musicKey.length).toBeGreaterThan(0);
      expect(theme.landmarks.length).toBeGreaterThanOrEqual(3);
      expect(theme.obstacles.length).toBeGreaterThanOrEqual(2);
    }
  });
});
