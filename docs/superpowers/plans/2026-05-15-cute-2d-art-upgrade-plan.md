# 萌系 2D 美术升级 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 用 3 张高质量萌系 2D 基准图验证美术方向，并把项目接入为可替换、可回退的 PNG 资产体系。

**Architecture:** 保持当前 Phaser 2D 架构，不引入 Three.js。新增最终美术资产目录和 `artAssets.ts` 映射，`RunnerScene.ts` 优先加载最终资产，缺失时回退到当前开源占位资产和程序绘制背景。

**Tech Stack:** Phaser、Vite、TypeScript、PNG 静态资源、现有 Vitest 测试。

---

## 文件结构

- Create: `src/game/artAssets.ts`  
  统一声明最终美术资产 key、url、fallback 关系。
- Create directories:
  - `src/assets/backgrounds/`
  - `src/assets/maps/thumbnails/`
  - `src/assets/obstacles/`
  - `src/assets/collectibles/`
- Modify: `src/game/RunnerScene.ts`  
  预加载最终资产；大厅、地图页、跑酷页优先使用最终背景。
- Modify: `src/game/openAssets.ts`  
  保留当前 Kenney 素材作为 fallback，不再当作最终美术。
- Test: `src/game/artAssets.test.ts`  
  验证大厅、地图、缩略图和跑酷背景映射完整。
- Docs: `docs/superpowers/specs/2026-05-15-cute-2d-art-upgrade-design.md`  
  作为美术验收依据。

---

### Task 1: 准备最终美术目录和资产映射

**Files:**
- Create: `src/game/artAssets.ts`
- Create: `src/assets/backgrounds/.gitkeep`
- Create: `src/assets/maps/thumbnails/.gitkeep`
- Create: `src/assets/obstacles/.gitkeep`
- Create: `src/assets/collectibles/.gitkeep`
- Test: `src/game/artAssets.test.ts`

- [ ] **Step 1: 创建空目录占位**

Create:

```text
src/assets/backgrounds/.gitkeep
src/assets/maps/thumbnails/.gitkeep
src/assets/obstacles/.gitkeep
src/assets/collectibles/.gitkeep
```

- [ ] **Step 2: 新增资产映射测试**

Create `src/game/artAssets.test.ts`:

```ts
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
```

- [ ] **Step 3: 运行测试确认失败**

Run: `npm.cmd run test -- src/game/artAssets.test.ts`  
Expected: FAIL，提示找不到 `./artAssets`。

- [ ] **Step 4: 新增 `artAssets.ts` 最小实现**

Create `src/game/artAssets.ts`:

```ts
import type { ThemeId } from './levels';

export type ArtAsset = {
  key: string;
  url?: string;
};

const missing = (key: string): ArtAsset => ({ key });

export const ART_ASSETS = {
  backgrounds: {
    lobby: missing('art-bg-lobby-garden'),
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
```

- [ ] **Step 5: 运行测试确认通过**

Run: `npm.cmd run test -- src/game/artAssets.test.ts`  
Expected: PASS。

- [ ] **Step 6: 提交**

```bash
git add src/game/artAssets.ts src/game/artAssets.test.ts src/assets/backgrounds/.gitkeep src/assets/maps/thumbnails/.gitkeep src/assets/obstacles/.gitkeep src/assets/collectibles/.gitkeep
git commit -m "Add final art asset slots"
```

---

### Task 2: 接入最终背景优先、占位素材回退

**Files:**
- Modify: `src/game/RunnerScene.ts`
- Modify: `src/game/artAssets.ts`

- [ ] **Step 1: 预加载最终资产**

In `src/game/RunnerScene.ts`, add import:

```ts
import { ALL_FINAL_ART_ASSETS, ART_ASSETS } from './artAssets';
```

In `preload()`, after loading character assets:

```ts
ALL_FINAL_ART_ASSETS.forEach((asset) => {
  if (asset.url) {
    this.load.image(asset.key, asset.url);
  }
});
```

- [ ] **Step 2: 大厅背景优先使用最终图**

In `drawGardenLobby()`, before Kenney fallback:

```ts
if (this.textures.exists(ART_ASSETS.backgrounds.lobby.key)) {
  this.setupLayer.add(
    this.add.image(GAME_WIDTH / 2, GAME_HEIGHT / 2, ART_ASSETS.backgrounds.lobby.key)
      .setDisplaySize(GAME_WIDTH, GAME_HEIGHT)
  );
} else if (this.textures.exists(OPEN_ASSETS.backgrounds.garden.key)) {
  this.setupLayer.add(
    this.add.image(GAME_WIDTH / 2, GAME_HEIGHT / 2, OPEN_ASSETS.backgrounds.garden.key)
      .setDisplaySize(GAME_WIDTH, GAME_HEIGHT)
      .setAlpha(0.9)
  );
} else {
  this.setupLayer.add(this.add.rectangle(GAME_WIDTH / 2, GAME_HEIGHT / 2, GAME_WIDTH, GAME_HEIGHT, 0xb9efff));
}
```

- [ ] **Step 3: 跑酷背景优先使用最终图**

In `drawWorld()`, choose asset in this order:

```ts
const finalBackground = ART_ASSETS.runnerBackgrounds[theme.id];
const fallbackBackground = OPEN_ASSETS.backgrounds[theme.id];
const backgroundKey = this.textures.exists(finalBackground.key) ? finalBackground.key : fallbackBackground.key;

if (this.textures.exists(backgroundKey)) {
  this.worldLayer.add(
    this.add.image(GAME_WIDTH / 2, GAME_HEIGHT / 2, backgroundKey)
      .setDisplaySize(GAME_WIDTH, GAME_HEIGHT)
      .setAlpha(backgroundKey === finalBackground.key ? 1 : 0.78)
  );
}
```

- [ ] **Step 4: 地图缩略图优先使用最终图**

In `addMapNode()`, choose thumbnail in this order:

```ts
const finalThumbnail = ART_ASSETS.mapThumbnails[theme.id];
const fallbackThumbnail = OPEN_ASSETS.backgrounds[theme.id];
const thumbnailKey = this.textures.exists(finalThumbnail.key) ? finalThumbnail.key : fallbackThumbnail.key;

if (this.textures.exists(thumbnailKey)) {
  node.add(this.add.image(0, 8, thumbnailKey).setDisplaySize(58, 44).setAlpha(0.82));
}
```

- [ ] **Step 5: 运行全量测试和构建**

Run: `npm.cmd run test`  
Expected: PASS。

Run: `npm.cmd run build`  
Expected: PASS。

- [ ] **Step 6: 提交**

```bash
git add src/game/RunnerScene.ts src/game/artAssets.ts
git commit -m "Prefer final art assets with fallback backgrounds"
```

---

### Task 3: 生成并接入 3 张基准图

**Files:**
- Create: `src/assets/backgrounds/lobby-garden.png`
- Create: `src/assets/backgrounds/map-select.png`
- Create: `src/assets/backgrounds/runner-garden.png`
- Create: `src/assets/maps/thumbnails/campus.png`
- Modify: `src/game/artAssets.ts`

- [ ] **Step 1: 用规格文档里的提示词生成基准图**

Use prompts from `docs/superpowers/specs/2026-05-15-cute-2d-art-upgrade-design.md`:

- 角色大厅花园背景。
- 地图选择页背景。
- 花园跑酷背景。

Reject and regenerate any map-select image that contains a phone mockup, system status bar, baked labels, buttons, cards, text, logos, or watermarks. Reject and regenerate any runner background that contains baked obstacles, collectibles, characters, UI, logos, or watermarks.

Required output:

```text
src/assets/backgrounds/lobby-garden.png
src/assets/backgrounds/map-select.png
src/assets/backgrounds/runner-garden.png
```

- [ ] **Step 2: 生成校园地图缩略图**

Create `src/assets/maps/thumbnails/campus.png` from the runner garden image using a readable center crop or separate matching generation.

- [ ] **Step 3: 更新 `artAssets.ts` URL**

Modify only the approved benchmark slots:

```ts
export const ART_ASSETS = {
  backgrounds: {
    lobby: { key: 'art-bg-lobby-garden', url: new URL('../assets/backgrounds/lobby-garden.png', import.meta.url).href },
    mapSelect: { key: 'art-bg-map-select', url: new URL('../assets/backgrounds/map-select.png', import.meta.url).href }
  },
  runnerBackgrounds: {
    campus: { key: 'art-bg-runner-campus', url: new URL('../assets/backgrounds/runner-garden.png', import.meta.url).href },
    mall: missing('art-bg-runner-mall'),
    zoo: missing('art-bg-runner-zoo'),
    amusement: missing('art-bg-runner-amusement')
  },
  mapThumbnails: {
    campus: { key: 'art-thumb-campus', url: new URL('../assets/maps/thumbnails/campus.png', import.meta.url).href },
    mall: missing('art-thumb-mall'),
    zoo: missing('art-thumb-zoo'),
    amusement: missing('art-thumb-amusement')
  }
};
```

- [ ] **Step 4: 运行测试和构建**

Run: `npm.cmd run test`  
Expected: PASS。

Run: `npm.cmd run build`  
Expected: PASS。

- [ ] **Step 5: 浏览器视觉验收**

Open `http://localhost:5173/` in the in-app browser.

Verify:

- 大厅看起来是精美花园，而不是简陋占位素材。
- 角色没有拉伸或散架式动作。
- 地图页 campus 缩略图可见。
- 跑酷 campus 背景中间道路可读，不挡角色、障碍和收集物。

- [ ] **Step 6: 提交**

```bash
git add src/assets/backgrounds/lobby-garden.png src/assets/backgrounds/map-select.png src/assets/backgrounds/runner-garden.png src/assets/maps/thumbnails/campus.png src/game/artAssets.ts
git commit -m "Add cute 2D art benchmark backgrounds"
```

---

### Task 4: 扩展到全量地图和道具

**Files:**
- Create: remaining PNGs under `src/assets/backgrounds/`
- Create: remaining PNGs under `src/assets/maps/thumbnails/`
- Create: PNGs under `src/assets/obstacles/`
- Create: PNGs under `src/assets/collectibles/`
- Modify: `src/game/artAssets.ts`
- Modify: `src/game/RunnerScene.ts`

- [ ] **Step 1: 基准图通过后再生成剩余地图背景**

Generate:

```text
src/assets/backgrounds/runner-mall.png
src/assets/backgrounds/runner-zoo.png
src/assets/backgrounds/runner-amusement.png
src/assets/maps/thumbnails/mall.png
src/assets/maps/thumbnails/zoo.png
src/assets/maps/thumbnails/amusement.png
```

- [ ] **Step 2: 生成收集物 PNG**

Generate or source polished cute PNGs:

```text
src/assets/collectibles/flower.png
src/assets/collectibles/coin.png
src/assets/collectibles/leaf.png
src/assets/collectibles/balloon.png
src/assets/collectibles/star.png
```

- [ ] **Step 3: 生成障碍物 PNG**

Generate or source polished cute PNGs grouped by gameplay type:

```text
src/assets/obstacles/campus-rail.png
src/assets/obstacles/campus-bag.png
src/assets/obstacles/mall-cart.png
src/assets/obstacles/mall-stand.png
src/assets/obstacles/zoo-bush.png
src/assets/obstacles/zoo-fence.png
src/assets/obstacles/amusement-gate.png
src/assets/obstacles/amusement-balloons.png
```

- [ ] **Step 4: 更新映射并替换程序绘制道具**

Add `collectibles` and `obstacles` records to `ART_ASSETS`, then update:

- `createCollectibleIcon()` to prefer final collectible PNGs.
- `drawObstacle()` to prefer final obstacle PNGs by `themeObstacle.shape`.

- [ ] **Step 5: 跑酷可读性验收**

Run `npm.cmd run test` and `npm.cmd run build`, then inspect in browser:

- 收集物长串足够清楚。
- 障碍物和背景不混在一起。
- 手机视口下 HUD、角色、障碍物不重叠。

- [ ] **Step 6: 提交**

```bash
git add src/assets/backgrounds src/assets/maps/thumbnails src/assets/collectibles src/assets/obstacles src/game/artAssets.ts src/game/RunnerScene.ts
git commit -m "Replace runner placeholders with cute 2D art"
```

---

## 自检

- 覆盖规格中的大厅、地图页、跑酷页、缩略图、障碍物、收集物要求。
- 第一阶段只做 3 张基准图，避免一次性生成全量低质量资产。
- 最终资产和开源占位资产分层清楚，后续替换不会影响玩法代码。
- 保持纯 2D PNG 方向，不重新引入 Three.js。
- 每个任务都有测试或浏览器验收步骤。
