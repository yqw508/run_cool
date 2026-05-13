# Mobile Runner H5 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a mobile-first H5 three-lane parkour prototype for primary school students with basic character customization.

**Architecture:** Use a small Vite + Phaser 3 application. Keep configuration data, pure gameplay helpers, Phaser scene code, and DOM shell styling separate so the H5 prototype can later be adapted for a WeChat Mini Program.

**Tech Stack:** TypeScript, Vite, Phaser 3, Vitest, HTML/CSS.

---

## File Structure

- Create `package.json`: project scripts and dependencies.
- Create `tsconfig.json`: TypeScript compiler settings.
- Create `vite.config.ts`: Vite and Vitest configuration.
- Create `index.html`: mobile viewport shell and game mount point.
- Create `src/main.ts`: Phaser bootstrap.
- Create `src/styles.css`: portrait-first page styling and loading fallback.
- Create `src/game/config.ts`: shared constants for lanes, speed, gestures, and dimensions.
- Create `src/game/characters.ts`: character presets, shirt colors, accessories, and default selection.
- Create `src/game/progression.ts`: pure helpers for speed, score, spawn timing, and lane movement.
- Create `src/game/input.ts`: pure gesture classifier and Phaser input binding helpers.
- Create `src/game/RunnerScene.ts`: main playable Phaser scene, UI overlays, obstacle/collectible spawning, scoring, collisions, restart flow, and character customization screen.
- Create `src/game/progression.test.ts`: unit tests for pure progression helpers.
- Create `src/game/input.test.ts`: unit tests for gesture classification.
- Create `README.md`: local run, build, and mobile preview notes.

---

### Task 1: Project Scaffold

**Files:**
- Create: `package.json`
- Create: `tsconfig.json`
- Create: `vite.config.ts`
- Create: `index.html`
- Create: `src/main.ts`
- Create: `src/styles.css`
- Create: `README.md`

- [ ] **Step 1: Create project metadata and scripts**

Create `package.json`:

```json
{
  "name": "run-cool-mobile-runner",
  "version": "0.1.0",
  "private": true,
  "type": "module",
  "scripts": {
    "dev": "vite --host 0.0.0.0",
    "build": "tsc --noEmit && vite build",
    "test": "vitest run",
    "preview": "vite preview --host 0.0.0.0"
  },
  "dependencies": {
    "phaser": "^3.90.0"
  },
  "devDependencies": {
    "@vitejs/plugin-basic-ssl": "^2.1.0",
    "typescript": "^5.9.3",
    "vite": "^7.1.12",
    "vitest": "^3.2.4"
  }
}
```

- [ ] **Step 2: Create TypeScript configuration**

Create `tsconfig.json`:

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "useDefineForClassFields": true,
    "module": "ESNext",
    "lib": ["ES2022", "DOM", "DOM.Iterable"],
    "types": ["vitest/globals"],
    "skipLibCheck": true,
    "moduleResolution": "Bundler",
    "allowImportingTsExtensions": false,
    "isolatedModules": true,
    "moduleDetection": "force",
    "noEmit": true,
    "strict": true,
    "noUnusedLocals": true,
    "noUnusedParameters": true
  },
  "include": ["src", "vite.config.ts"]
}
```

- [ ] **Step 3: Create Vite configuration**

Create `vite.config.ts`:

```ts
import { defineConfig } from 'vite';

export default defineConfig({
  server: {
    port: 5173
  },
  preview: {
    port: 4173
  },
  test: {
    environment: 'jsdom',
    globals: true
  }
});
```

- [ ] **Step 4: Create mobile HTML shell**

Create `index.html`:

```html
<!doctype html>
<html lang="zh-CN">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover, user-scalable=no" />
    <meta name="theme-color" content="#65c7f7" />
    <title>酷跑小队</title>
  </head>
  <body>
    <main id="app">
      <div id="game"></div>
      <noscript>请启用 JavaScript 后再开始游戏。</noscript>
    </main>
    <script type="module" src="/src/main.ts"></script>
  </body>
</html>
```

- [ ] **Step 5: Create temporary bootstrap**

Create `src/main.ts`:

```ts
import './styles.css';

const mount = document.querySelector<HTMLDivElement>('#game');

if (mount) {
  mount.innerHTML = '<p class="loading">酷跑小队准备中...</p>';
}
```

- [ ] **Step 6: Create base mobile styles**

Create `src/styles.css`:

```css
:root {
  color: #152238;
  background: #65c7f7;
  font-family: "Microsoft YaHei", "PingFang SC", system-ui, sans-serif;
  font-synthesis: none;
  text-rendering: optimizeLegibility;
  -webkit-font-smoothing: antialiased;
  touch-action: none;
}

* {
  box-sizing: border-box;
}

html,
body,
#app,
#game {
  width: 100%;
  height: 100%;
  margin: 0;
  overflow: hidden;
}

body {
  min-width: 320px;
}

canvas {
  display: block;
  width: 100%;
  height: 100%;
}

.loading {
  display: grid;
  width: 100%;
  height: 100%;
  margin: 0;
  place-items: center;
  color: #ffffff;
  font-size: 20px;
  font-weight: 700;
}
```

- [ ] **Step 7: Create README**

Create `README.md`:

```md
# 酷跑小队

移动端 H5 三跑道跑酷原型，面向小学生，第一版用于验证核心玩法和基础角色配置。

## 本地运行

```bash
npm install
npm run dev
```

打开终端显示的本地地址，在浏览器移动端视口下预览。

## 常用命令

```bash
npm run test
npm run build
npm run preview
```

## 操作

- 手机：左右滑切换跑道，上滑跳跃，下滑滑铲。
- 电脑调试：方向键控制。
```

- [ ] **Step 8: Install dependencies**

Run: `npm install`

Expected: dependencies install and `package-lock.json` is created.

- [ ] **Step 9: Verify scaffold**

Run: `npm run build`

Expected: TypeScript and Vite build complete successfully.

- [ ] **Step 10: Commit scaffold if repository exists**

Run:

```bash
git add package.json package-lock.json tsconfig.json vite.config.ts index.html src/main.ts src/styles.css README.md
git commit -m "chore: scaffold mobile runner h5"
```

Expected: commit succeeds. If the directory is not a Git repository, record that commit was skipped.

---

### Task 2: Pure Gameplay Configuration And Tests

**Files:**
- Create: `src/game/config.ts`
- Create: `src/game/characters.ts`
- Create: `src/game/progression.ts`
- Create: `src/game/progression.test.ts`

- [ ] **Step 1: Write progression tests**

Create `src/game/progression.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { getLaneX, getRunSpeed, getScore, getSpawnDelay, nextLane } from './progression';
import { GAME_HEIGHT, GAME_WIDTH } from './config';

describe('progression helpers', () => {
  it('places three lanes across the playfield', () => {
    expect(getLaneX(0)).toBeCloseTo(GAME_WIDTH * 0.25);
    expect(getLaneX(1)).toBeCloseTo(GAME_WIDTH * 0.5);
    expect(getLaneX(2)).toBeCloseTo(GAME_WIDTH * 0.75);
  });

  it('clamps lane movement at both edges', () => {
    expect(nextLane(0, -1)).toBe(0);
    expect(nextLane(1, -1)).toBe(0);
    expect(nextLane(1, 1)).toBe(2);
    expect(nextLane(2, 1)).toBe(2);
  });

  it('increases speed but keeps it child-friendly', () => {
    expect(getRunSpeed(0)).toBe(230);
    expect(getRunSpeed(60_000)).toBeGreaterThan(getRunSpeed(0));
    expect(getRunSpeed(300_000)).toBe(520);
  });

  it('shortens spawn delay as time passes', () => {
    expect(getSpawnDelay(0)).toBe(1200);
    expect(getSpawnDelay(90_000)).toBeLessThan(getSpawnDelay(0));
    expect(getSpawnDelay(300_000)).toBe(620);
  });

  it('scores distance and collected coins', () => {
    expect(getScore(12.4, 3)).toBe(42);
  });

  it('keeps configured game height stable', () => {
    expect(GAME_HEIGHT).toBe(720);
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npm run test -- src/game/progression.test.ts`

Expected: FAIL because `src/game/progression.ts` and `src/game/config.ts` do not exist yet.

- [ ] **Step 3: Add shared game constants**

Create `src/game/config.ts`:

```ts
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
```

- [ ] **Step 4: Add character configuration data**

Create `src/game/characters.ts`:

```ts
export type CharacterPreset = {
  id: string;
  label: string;
  skinColor: number;
  hairColor: number;
};

export type ShirtColor = {
  id: string;
  label: string;
  color: number;
};

export type Accessory = {
  id: string;
  label: string;
  color: number;
};

export type CharacterSelection = {
  presetId: string;
  shirtId: string;
  accessoryId: string;
};

export const CHARACTER_PRESETS: CharacterPreset[] = [
  { id: 'spark', label: '闪闪', skinColor: 0xffc89a, hairColor: 0x4a2f22 },
  { id: 'momo', label: '沫沫', skinColor: 0xf3b27b, hairColor: 0x26354f },
  { id: 'bean', label: '豆豆', skinColor: 0xffd2a6, hairColor: 0x6f4328 }
];

export const SHIRT_COLORS: ShirtColor[] = [
  { id: 'sunny', label: '阳光黄', color: 0xffd447 },
  { id: 'mint', label: '薄荷绿', color: 0x32c48d },
  { id: 'berry', label: '莓果红', color: 0xff5a76 }
];

export const ACCESSORIES: Accessory[] = [
  { id: 'cap', label: '小帽子', color: 0x2f80ed },
  { id: 'bag', label: '小背包', color: 0x8f5cff },
  { id: 'none', label: '轻装跑', color: 0xffffff }
];

export const DEFAULT_SELECTION: CharacterSelection = {
  presetId: CHARACTER_PRESETS[0].id,
  shirtId: SHIRT_COLORS[0].id,
  accessoryId: ACCESSORIES[0].id
};

export function resolveSelection(selection: CharacterSelection) {
  return {
    preset: CHARACTER_PRESETS.find((item) => item.id === selection.presetId) ?? CHARACTER_PRESETS[0],
    shirt: SHIRT_COLORS.find((item) => item.id === selection.shirtId) ?? SHIRT_COLORS[0],
    accessory: ACCESSORIES.find((item) => item.id === selection.accessoryId) ?? ACCESSORIES[0]
  };
}
```

- [ ] **Step 5: Add progression helpers**

Create `src/game/progression.ts`:

```ts
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
```

- [ ] **Step 6: Run progression tests**

Run: `npm run test -- src/game/progression.test.ts`

Expected: PASS.

- [ ] **Step 7: Commit configuration if repository exists**

Run:

```bash
git add src/game/config.ts src/game/characters.ts src/game/progression.ts src/game/progression.test.ts
git commit -m "feat: add runner configuration helpers"
```

Expected: commit succeeds. If the directory is not a Git repository, record that commit was skipped.

---

### Task 3: Gesture Input Helpers

**Files:**
- Create: `src/game/input.ts`
- Create: `src/game/input.test.ts`

- [ ] **Step 1: Write gesture tests**

Create `src/game/input.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { classifyGesture } from './input';

describe('classifyGesture', () => {
  it('returns none for small movement', () => {
    expect(classifyGesture({ startX: 10, startY: 10, endX: 20, endY: 22 })).toBe('none');
  });

  it('classifies horizontal swipes', () => {
    expect(classifyGesture({ startX: 100, startY: 100, endX: 40, endY: 104 })).toBe('left');
    expect(classifyGesture({ startX: 40, startY: 100, endX: 100, endY: 104 })).toBe('right');
  });

  it('classifies vertical swipes', () => {
    expect(classifyGesture({ startX: 80, startY: 120, endX: 82, endY: 50 })).toBe('up');
    expect(classifyGesture({ startX: 80, startY: 50, endX: 82, endY: 120 })).toBe('down');
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npm run test -- src/game/input.test.ts`

Expected: FAIL because `src/game/input.ts` does not exist yet.

- [ ] **Step 3: Add gesture classification and binding helper**

Create `src/game/input.ts`:

```ts
import Phaser from 'phaser';
import { GESTURE_MIN_DISTANCE } from './config';

export type GestureDirection = 'left' | 'right' | 'up' | 'down' | 'none';

export type GesturePoints = {
  startX: number;
  startY: number;
  endX: number;
  endY: number;
};

export function classifyGesture(points: GesturePoints): GestureDirection {
  const deltaX = points.endX - points.startX;
  const deltaY = points.endY - points.startY;
  const absX = Math.abs(deltaX);
  const absY = Math.abs(deltaY);

  if (Math.max(absX, absY) < GESTURE_MIN_DISTANCE) {
    return 'none';
  }

  if (absX > absY) {
    return deltaX > 0 ? 'right' : 'left';
  }

  return deltaY > 0 ? 'down' : 'up';
}

export function bindSwipeInput(scene: Phaser.Scene, onGesture: (direction: Exclude<GestureDirection, 'none'>) => void): void {
  let startX = 0;
  let startY = 0;

  scene.input.on('pointerdown', (pointer: Phaser.Input.Pointer) => {
    startX = pointer.x;
    startY = pointer.y;
  });

  scene.input.on('pointerup', (pointer: Phaser.Input.Pointer) => {
    const direction = classifyGesture({
      startX,
      startY,
      endX: pointer.x,
      endY: pointer.y
    });

    if (direction !== 'none') {
      onGesture(direction);
    }
  });
}
```

- [ ] **Step 4: Run gesture tests**

Run: `npm run test -- src/game/input.test.ts`

Expected: PASS.

- [ ] **Step 5: Commit input helpers if repository exists**

Run:

```bash
git add src/game/input.ts src/game/input.test.ts
git commit -m "feat: add mobile gesture helpers"
```

Expected: commit succeeds. If the directory is not a Git repository, record that commit was skipped.

---

### Task 4: Phaser Runner Scene

**Files:**
- Create: `src/game/RunnerScene.ts`
- Modify: `src/main.ts`

- [ ] **Step 1: Add Phaser bootstrap**

Replace `src/main.ts` with:

```ts
import Phaser from 'phaser';
import './styles.css';
import { GAME_HEIGHT, GAME_WIDTH } from './game/config';
import { RunnerScene } from './game/RunnerScene';

new Phaser.Game({
  type: Phaser.AUTO,
  parent: 'game',
  backgroundColor: '#65c7f7',
  scale: {
    mode: Phaser.Scale.FIT,
    autoCenter: Phaser.Scale.CENTER_BOTH,
    width: GAME_WIDTH,
    height: GAME_HEIGHT
  },
  physics: {
    default: 'arcade',
    arcade: {
      debug: false
    }
  },
  scene: [RunnerScene]
});
```

- [ ] **Step 2: Create complete runner scene**

Create `src/game/RunnerScene.ts` with a Phaser scene that:

- Draws sky, road, lane guides, and friendly UI text.
- Shows a start/setup screen with character, shirt, and accessory choices.
- Renders the configured character from simple geometric shapes.
- Supports swipe and keyboard controls.
- Spawns obstacle blocks, overhead bars, and star collectibles.
- Tracks distance, collected stars, speed, and score.
- Ends the run on collision and shows restart.

Use these public scene methods and fields so later testing and maintenance stay predictable:

```ts
export class RunnerScene extends Phaser.Scene {
  constructor();
  create(): void;
  update(time: number, delta: number): void;
}
```

Important implementation details:

- Use `bindSwipeInput(this, this.handleGesture.bind(this))`.
- Use `nextLane`, `getLaneX`, `getRunSpeed`, `getSpawnDelay`, and `getScore` from `progression.ts`.
- Use `resolveSelection` from `characters.ts` when drawing the player.
- Represent obstacles and collectibles as Arcade physics rectangles/circles.
- Store game state as `'setup' | 'running' | 'ended'`.
- Disable player movement while in setup or ended states except restart/setup buttons.

- [ ] **Step 3: Run build to catch TypeScript and Phaser errors**

Run: `npm run build`

Expected: PASS. If TypeScript reports unused private fields or incorrect Phaser types, remove unused fields and use explicit Phaser object types.

- [ ] **Step 4: Commit scene if repository exists**

Run:

```bash
git add src/main.ts src/game/RunnerScene.ts
git commit -m "feat: implement playable runner scene"
```

Expected: commit succeeds. If the directory is not a Git repository, record that commit was skipped.

---

### Task 5: Polish, Mobile Verification, And Documentation

**Files:**
- Modify: `src/styles.css`
- Modify: `README.md`

- [ ] **Step 1: Confirm tests pass**

Run: `npm run test`

Expected: PASS for `progression.test.ts` and `input.test.ts`.

- [ ] **Step 2: Confirm production build**

Run: `npm run build`

Expected: PASS and `dist/` is generated.

- [ ] **Step 3: Start local dev server**

Run: `npm run dev`

Expected: Vite prints a local URL such as `http://localhost:5173/`.

- [ ] **Step 4: Verify mobile viewport manually**

Open the local URL in a browser with a mobile viewport around `390 x 844`. Verify:

- Start/setup controls fit on screen.
- Buttons do not overlap.
- Three lanes and player are visible.
- Swipe gestures or keyboard controls move the player.
- Collision opens the result screen.
- Restart returns to a new run.

- [ ] **Step 5: Update README with actual verification notes**

Add a `## 验证记录` section to `README.md` with the exact commands run and the local URL used.

- [ ] **Step 6: Final build after README update**

Run: `npm run build`

Expected: PASS.

- [ ] **Step 7: Commit polish if repository exists**

Run:

```bash
git add src/styles.css README.md
git commit -m "docs: add runner verification notes"
```

Expected: commit succeeds. If the directory is not a Git repository, record that commit was skipped.

---

## Self-Review

- Spec coverage: The plan covers mobile H5, three-lane forward gameplay, swipe/keyboard input, obstacles, collectibles, speed progression, scoring, restart flow, basic character customization, local run docs, and mobile viewport verification.
- Placeholder scan: No `TODO`, `TBD`, `FIXME`, or unspecified implementation placeholders remain in the plan.
- Type consistency: Helper names and imported constants are consistent across the planned tests and implementation files.
