# Themed Levels And Health Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add four recognizable themed runner environments and a forgiving health/damage loop.

**Architecture:** Keep the current single `RunnerScene` as the gameplay host. Move theme progression and health rules into small pure modules with tests, then have the Phaser scene consume those modules for drawing, HUD, audio, and collision behavior.

**Tech Stack:** TypeScript, Phaser 3, Vite, Vitest.

---

## File Structure

- Create `src/game/levels.ts`: serializable theme configuration and distance-to-theme helpers.
- Create `src/game/levels.test.ts`: pure tests for theme thresholds and lookup behavior.
- Create `src/game/health.ts`: pure health state helpers for damage and invulnerability.
- Create `src/game/health.test.ts`: pure tests for health state transitions.
- Modify `src/game/RunnerScene.ts`: draw themed backgrounds, switch theme music, render health HUD, and use damage instead of immediate game over.
- Modify `src/game/progression.test.ts`: keep existing tests stable if score label names change are not needed.
- Modify `README.md`: add the exact verification commands and local preview notes after implementation.

---

### Task 1: Add Theme Progression Data

**Files:**
- Create: `src/game/levels.ts`
- Create: `src/game/levels.test.ts`

- [ ] **Step 1: Write failing level tests**

Create `src/game/levels.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { LEVEL_THEMES, getThemeForDistance, getThemeIndexForDistance } from './levels';

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

  it('exposes visual and audio data for every theme', () => {
    for (const theme of LEVEL_THEMES) {
      expect(theme.label.length).toBeGreaterThan(0);
      expect(theme.musicKey.length).toBeGreaterThan(0);
      expect(theme.landmarks.length).toBeGreaterThanOrEqual(3);
      expect(theme.obstacles.length).toBeGreaterThanOrEqual(2);
    }
  });
});
```

- [ ] **Step 2: Run the new tests to verify they fail**

Run:

```bash
npm run test -- src/game/levels.test.ts
```

Expected: FAIL because `src/game/levels.ts` does not exist.

- [ ] **Step 3: Implement theme data and helpers**

Create `src/game/levels.ts`:

```ts
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

export type ThemeObstacle = {
  label: string;
  color: number;
  accentColor: number;
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
      { label: '书包', color: 0x2f80ed, accentColor: 0xffd447 },
      { label: '栏杆', color: 0xff6b6b, accentColor: 0xffffff }
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
      { label: '购物袋', color: 0xff87b7, accentColor: 0xffffff },
      { label: '爆米花', color: 0xffd447, accentColor: 0xe85d5d }
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
      { label: '木栅栏', color: 0x9a6a38, accentColor: 0xffe2a8 },
      { label: '草丛', color: 0x2f9e62, accentColor: 0xc6f7b2 }
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
      { label: '护栏', color: 0x7a5cff, accentColor: 0xffffff },
      { label: '气球摊', color: 0xff5a76, accentColor: 0xffd447 }
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
```

- [ ] **Step 4: Run level tests**

Run:

```bash
npm run test -- src/game/levels.test.ts
```

Expected: PASS.

---

### Task 2: Add Health State Rules

**Files:**
- Create: `src/game/health.ts`
- Create: `src/game/health.test.ts`

- [ ] **Step 1: Write failing health tests**

Create `src/game/health.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { applyDamage, createHealthState, isDefeated, isInvulnerable } from './health';

describe('health state', () => {
  it('starts with three health points and no invulnerability', () => {
    expect(createHealthState()).toEqual({ current: 3, max: 3, invulnerableUntil: 0 });
  });

  it('reduces health by one on valid damage', () => {
    expect(applyDamage(createHealthState(), 1000)).toEqual({
      current: 2,
      max: 3,
      invulnerableUntil: 2000
    });
  });

  it('ignores damage during invulnerability', () => {
    const damaged = applyDamage(createHealthState(), 1000);
    expect(applyDamage(damaged, 1500)).toBe(damaged);
  });

  it('clamps health at zero', () => {
    const first = applyDamage(createHealthState(), 1000);
    const second = applyDamage(first, 2100);
    const third = applyDamage(second, 3200);
    const fourth = applyDamage(third, 4300);
    expect(fourth.current).toBe(0);
  });

  it('reports invulnerability and defeated state', () => {
    const damaged = applyDamage(createHealthState(), 1000);
    expect(isInvulnerable(damaged, 1500)).toBe(true);
    expect(isInvulnerable(damaged, 2000)).toBe(false);

    const defeated = applyDamage(applyDamage(damaged, 2100), 3200);
    expect(isDefeated(defeated)).toBe(true);
  });
});
```

- [ ] **Step 2: Run the new tests to verify they fail**

Run:

```bash
npm run test -- src/game/health.test.ts
```

Expected: FAIL because `src/game/health.ts` does not exist.

- [ ] **Step 3: Implement health helpers**

Create `src/game/health.ts`:

```ts
export type HealthState = {
  current: number;
  max: number;
  invulnerableUntil: number;
};

export const DEFAULT_MAX_HEALTH = 3;
export const DAMAGE_INVULNERABLE_MS = 1000;

export function createHealthState(max = DEFAULT_MAX_HEALTH): HealthState {
  return {
    current: max,
    max,
    invulnerableUntil: 0
  };
}

export function isInvulnerable(state: HealthState, now: number): boolean {
  return now < state.invulnerableUntil;
}

export function applyDamage(state: HealthState, now: number): HealthState {
  if (isInvulnerable(state, now) || state.current <= 0) {
    return state;
  }

  return {
    ...state,
    current: Math.max(0, state.current - 1),
    invulnerableUntil: now + DAMAGE_INVULNERABLE_MS
  };
}

export function isDefeated(state: HealthState): boolean {
  return state.current <= 0;
}
```

- [ ] **Step 4: Run health tests**

Run:

```bash
npm run test -- src/game/health.test.ts
```

Expected: PASS.

---

### Task 3: Integrate Themes, HUD Health, And Hit Feedback

**Files:**
- Modify: `src/game/RunnerScene.ts`

- [ ] **Step 1: Update imports and scene fields**

In `src/game/RunnerScene.ts`, add imports:

```ts
import { applyDamage, createHealthState, isDefeated, type HealthState } from './health';
import { getThemeForDistance, LEVEL_THEMES, type LevelTheme, type ThemeObstacle } from './levels';
```

Add fields to `RunnerScene`:

```ts
private worldLayer!: Phaser.GameObjects.Container;
private themeLabelText!: Phaser.GameObjects.Text;
private healthText!: Phaser.GameObjects.Text;
private healthState: HealthState = createHealthState();
private currentTheme: LevelTheme = LEVEL_THEMES[0];
private activeMusicKey = '';
```

- [ ] **Step 2: Replace world drawing with a redrawable theme layer**

Change `drawWorld()` so it destroys and recreates `worldLayer`, then draws sky, landmarks, road, and title from `this.currentTheme`.

Use these helper methods inside `RunnerScene`:

```ts
private drawWorld(): void {
  this.worldLayer?.destroy(true);
  this.worldLayer = this.add.container(0, 0);
  this.worldLayer.setDepth(-10);

  const theme = this.currentTheme;
  this.worldLayer.add(this.add.rectangle(GAME_WIDTH / 2, GAME_HEIGHT / 2, GAME_WIDTH, GAME_HEIGHT, theme.skyColor));
  this.worldLayer.add(this.add.circle(68, 82, 34, 0xffe46b));
  this.drawThemeLandmarks(theme);
  this.worldLayer.add(this.add.rectangle(GAME_WIDTH / 2, 680, GAME_WIDTH, 116, theme.groundColor));
  this.drawRoad(theme);
  this.worldLayer.add(
    this.add
      .text(GAME_WIDTH / 2, 42, `${theme.label}酷跑`, {
        ...TEXT_STYLE,
        color: `#${theme.titleColor.toString(16).padStart(6, '0')}`,
        fontSize: '30px',
        fontStyle: 'bold'
      })
      .setOrigin(0.5)
  );
}
```

Add `drawRoad(theme: LevelTheme)`:

```ts
private drawRoad(theme: LevelTheme): void {
  const road = this.add.graphics();
  road.fillStyle(theme.roadColor, 1);
  road.fillPoints(
    [
      new Phaser.Geom.Point(54, 130),
      new Phaser.Geom.Point(336, 130),
      new Phaser.Geom.Point(390, 642),
      new Phaser.Geom.Point(0, 642)
    ],
    true
  );
  road.lineStyle(3, theme.laneColor, 0.34);
  road.beginPath();
  road.moveTo(145, 130);
  road.lineTo(108, 642);
  road.moveTo(245, 130);
  road.lineTo(282, 642);
  road.strokePath();
  this.worldLayer.add(road);

  for (let y = 170; y < 630; y += 92) {
    this.worldLayer.add(this.add.rectangle(GAME_WIDTH / 2, y, 92, 8, theme.laneColor, 0.18));
  }
}
```

Add `drawThemeLandmarks(theme: LevelTheme)` with explicit drawing for all four theme ids:

```ts
private drawThemeLandmarks(theme: LevelTheme): void {
  if (theme.id === 'campus') {
    this.worldLayer.add(this.add.rectangle(95, 142, 96, 74, 0xf6f1df).setStrokeStyle(3, 0xcf5d45));
    this.worldLayer.add(this.add.rectangle(95, 98, 104, 18, 0xcf5d45));
    this.worldLayer.add(this.add.text(58, 127, '教学楼', { ...TEXT_STYLE, fontSize: '14px' }));
    this.worldLayer.add(this.add.ellipse(290, 146, 110, 46, 0xe96f4f, 0.95));
    this.worldLayer.add(this.add.rectangle(286, 94, 86, 46, 0xdff2fb).setStrokeStyle(3, 0x4f9ed8));
    this.worldLayer.add(this.add.text(260, 86, '图书馆', { ...TEXT_STYLE, fontSize: '13px' }));
    return;
  }

  if (theme.id === 'mall') {
    this.worldLayer.add(this.add.rectangle(82, 126, 118, 70, 0x3d2d5c).setStrokeStyle(3, 0xffd447));
    this.worldLayer.add(this.add.text(38, 104, 'GAME', { ...TEXT_STYLE, color: '#ffd447', fontSize: '18px', fontStyle: 'bold' }));
    this.worldLayer.add(this.add.rectangle(224, 122, 96, 64, 0xfff1a8).setStrokeStyle(3, 0xe85d5d));
    this.worldLayer.add(this.add.text(196, 103, '餐厅', { ...TEXT_STYLE, fontSize: '15px' }));
    this.worldLayer.add(this.add.rectangle(326, 112, 86, 56, 0x17263a).setStrokeStyle(3, 0xffffff));
    this.worldLayer.add(this.add.text(301, 96, '影院', { ...TEXT_STYLE, color: '#ffffff', fontSize: '15px' }));
    return;
  }

  if (theme.id === 'zoo') {
    this.worldLayer.add(this.add.rectangle(78, 122, 112, 64, 0xffe2a8).setStrokeStyle(3, 0x8c5a2b));
    this.worldLayer.add(this.add.text(47, 105, '动物园', { ...TEXT_STYLE, fontSize: '16px', fontStyle: 'bold' }));
    this.worldLayer.add(this.add.circle(250, 119, 22, 0xffc66d));
    this.worldLayer.add(this.add.rectangle(250, 144, 66, 16, 0x8c5a2b));
    this.worldLayer.add(this.add.circle(312, 120, 17, 0x6f8f45));
    for (let x = 24; x < 370; x += 34) {
      this.worldLayer.add(this.add.rectangle(x, 168, 7, 44, 0x8c5a2b));
    }
    return;
  }

  this.worldLayer.add(this.add.circle(82, 124, 50, 0xffffff, 0.55).setStrokeStyle(5, 0xff5a76));
  for (let angle = 0; angle < 360; angle += 45) {
    const point = Phaser.Math.RotateAround({ x: 82, y: 74 }, 82, 124, Phaser.Math.DegToRad(angle));
    this.worldLayer.add(this.add.line(0, 0, 82, 124, point.x, point.y, 0xff5a76, 0.45).setOrigin(0));
  }
  this.worldLayer.add(this.add.arc(246, 132, 82, 195, 340, false, 0x7a5cff).setStrokeStyle(8, 0x7a5cff));
  this.worldLayer.add(this.add.triangle(326, 154, -30, 24, 30, 24, 0, -36, 0xff87b7));
  this.worldLayer.add(this.add.rectangle(326, 158, 72, 12, 0xffd447));
}
```

- [ ] **Step 3: Update HUD to show theme and health**

In `createHud()`, after `scoreText`, create and add:

```ts
this.themeLabelText = this.add.text(16, 44, '场景 校园', {
  ...TEXT_STYLE,
  color: '#ffffff',
  fontSize: '15px',
  fontStyle: 'bold'
});
this.healthText = this.add.text(16, 68, '生命 ♥♥♥', {
  ...TEXT_STYLE,
  color: '#ffffff',
  fontSize: '15px',
  fontStyle: 'bold'
});
```

Change the existing HUD add call to include `this.themeLabelText` and `this.healthText`.

Add helper:

```ts
private updateHud(): void {
  this.scoreText.setText(`得分 ${getScore(this.distanceMeters, this.stars)}  星星 ${this.stars}`);
  this.themeLabelText.setText(`场景 ${this.currentTheme.label}`);
  this.healthText.setText(`生命 ${'♥'.repeat(this.healthState.current)}${'♡'.repeat(this.healthState.max - this.healthState.current)}`);
}
```

Replace direct score text updates in `update()` and `startRun()` with `this.updateHud()`.

- [ ] **Step 4: Switch themes by distance during update**

In `update()`, after updating `distanceMeters`, add:

```ts
const nextTheme = getThemeForDistance(this.distanceMeters);
if (nextTheme.id !== this.currentTheme.id) {
  this.currentTheme = nextTheme;
  this.drawWorld();
  this.switchThemeMusic(nextTheme);
}
this.updateHud();
```

In `startRun()`, reset:

```ts
this.healthState = createHealthState();
this.currentTheme = LEVEL_THEMES[0];
this.drawWorld();
this.switchThemeMusic(this.currentTheme);
```

In `enterSetup()` and `endRun()`, call `this.stopThemeMusic()`.

- [ ] **Step 5: Spawn themed obstacles**

In `spawnObstacle(lane, kind)`, select the theme obstacle:

```ts
const themeObstacle = Phaser.Utils.Array.GetRandom(this.currentTheme.obstacles) as ThemeObstacle;
```

Use `themeObstacle.color` as the main rectangle color. Add a small text label above or inside the obstacle:

```ts
const label = this.add
  .text(obstacle.x, obstacle.y - 2, themeObstacle.label, {
    ...TEXT_STYLE,
    color: '#ffffff',
    fontSize: '12px',
    fontStyle: 'bold'
  })
  .setOrigin(0.5);
obstacle.setData('label', label);
```

In `moveObjects()`, move the label with the obstacle and destroy it when the obstacle is destroyed:

```ts
const label = obstacle.getData('label') as Phaser.GameObjects.Text | undefined;
if (label) {
  label.setPosition(obstacle.x, obstacle.y - 2);
  label.setScale(obstacle.scale);
}
if (obstacle.y > GAME_HEIGHT + 60) {
  label?.destroy();
  obstacle.destroy();
}
```

- [ ] **Step 6: Replace immediate game over with damage**

Replace the body of `hitObstacle(obstacle)` after the `avoided` check:

```ts
if (avoided) {
  return;
}

const previousHealth = this.healthState.current;
this.healthState = applyDamage(this.healthState, this.time.now);

if (this.healthState.current === previousHealth) {
  return;
}

(obstacle.getData('label') as Phaser.GameObjects.Text | undefined)?.destroy();
obstacle.destroy();
this.playHitFeedback();
this.updateHud();

if (isDefeated(this.healthState)) {
  this.endRun();
}
```

Add `playHitFeedback()`:

```ts
private playHitFeedback(): void {
  this.playHitSound();
  this.cameras.main.shake(140, 0.006);
  this.tweens.add({
    targets: this.player,
    x: this.player.x + (this.player.x < GAME_WIDTH / 2 ? 16 : -16),
    yoyo: true,
    duration: 70,
    repeat: 1,
    ease: 'Sine.easeInOut'
  });
  this.tweens.add({
    targets: this.player,
    alpha: 0.35,
    yoyo: true,
    duration: 110,
    repeat: 5,
    onComplete: () => this.player.setAlpha(1)
  });
}
```

- [ ] **Step 7: Add lightweight audio hooks**

Add methods:

```ts
private switchThemeMusic(theme: LevelTheme): void {
  if (this.activeMusicKey === theme.musicKey) {
    return;
  }
  this.stopThemeMusic();
  this.activeMusicKey = theme.musicKey;
  this.sound.play(theme.musicKey, { loop: true, volume: 0.18 });
}

private stopThemeMusic(): void {
  if (!this.activeMusicKey) {
    return;
  }
  this.sound.stopByKey(this.activeMusicKey);
  this.activeMusicKey = '';
}

private playHitSound(): void {
  this.sound.play('hit-soft', { volume: 0.35 });
}
```

If Phaser reports missing audio keys during manual testing, add generated audio in `create()` before `enterSetup()`:

```ts
this.createGeneratedAudio();
```

And add:

```ts
private createGeneratedAudio(): void {
  const audioKeys = ['music-campus', 'music-mall', 'music-zoo', 'music-amusement', 'hit-soft'];
  for (const key of audioKeys) {
    if (!this.cache.audio.exists(key)) {
      this.sound.add(key);
    }
  }
}
```

If generated audio is not viable in Phaser without loaded assets, change the audio methods to no-op with a short code comment and keep `musicKey` plumbing intact for future real assets.

- [ ] **Step 8: Run the full test suite and build**

Run:

```bash
npm run test
npm run build
```

Expected: tests PASS and build PASS.

---

### Task 4: Manual Mobile Verification And Docs

**Files:**
- Modify: `README.md`

- [ ] **Step 1: Start the dev server**

Run:

```bash
npm run dev -- --host 127.0.0.1 --port 5183 --strictPort
```

Expected: Vite serves the game at `http://127.0.0.1:5183/`.

- [ ] **Step 2: Verify the mobile viewport**

Open `http://127.0.0.1:5183/` in a browser or use the existing headless screenshot flow. Verify:

- The setup screen fits in a 390 x 844 viewport.
- Running starts from the campus theme.
- Distance progression changes the HUD theme label.
- Obstacles show theme-specific labels.
- Collision reduces health before game over.
- The player flashes or shakes after damage.
- The result screen appears when health reaches zero.

- [ ] **Step 3: Update README verification notes**

Add a Chinese verification section to `README.md`:

```md
## 验证记录

- `npm run test`
- `npm run build`
- 本地预览：`http://127.0.0.1:5183/`

手动检查：

- 手机视口下角色选择界面可用。
- 跑酷中会按距离切换校园、商场、动物园、游乐园主题。
- 障碍物碰撞会先扣生命值并播放受击反馈。
- 生命值归零后进入结算界面。
```

- [ ] **Step 4: Run final build**

Run:

```bash
npm run build
```

Expected: PASS.

---

## Self-Review

- Spec coverage: The plan covers four themes, per-theme visuals, music-key architecture, health state, hit feedback, tests, mobile verification, and README notes.
- Placeholder scan: The plan contains no `TODO`, `TBD`, or `FIXME`. The audio step explicitly defines a fallback if Phaser cannot play generated keys without assets.
- Type consistency: `LevelTheme`, `ThemeObstacle`, `HealthState`, `getThemeForDistance`, `applyDamage`, and `isDefeated` are defined before use.
