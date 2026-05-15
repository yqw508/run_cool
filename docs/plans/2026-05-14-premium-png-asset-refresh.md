# Premium PNG Asset Refresh Plan

## Goal

Replace the current mixed procedural/rough visual assets with polished PNG assets across the character lobby, map selection, and runner gameplay. The first pass should prioritize visual stability and consistency over animation complexity.

## Current Context

- The game already supports separate character assets:
  - `assetUrl`: runner gameplay character image
  - `lobbyAssetUrl`: character lobby image
- The baby-brother character now proves the target direction:
  - runner: `src/assets/characters/baby-brother-run-back.png`
  - lobby: `src/assets/characters/lobby-baby-brother-v2.png`
- Procedural shapes still exist for obstacles, collectibles, map landmarks, HUD icons, and some background details.
- 3D/2.5D character limb animation is not the right fit for this project. The new direction is high-quality static PNGs with light squash/bob/scale effects only.

## Asset Rules

- Every playable character needs two final PNGs:
  - back-facing runner sprite for gameplay
  - front-facing lobby sprite for selection/lobby
- PNGs should be transparent, trimmed, and game-sized before commit.
- Target size:
  - characters: 512 px height source PNG, under 200 KB when practical
  - small props/icons: 128-256 px, under 80 KB when practical
  - background panels/landmarks: 512-1024 px depending on viewport use
- Keep generated source prompts and raw generated files out of the app bundle unless needed.
- Use consistent naming:
  - `character-id-run-back.png`
  - `lobby-character-id-v2.png`
  - `map-theme-landmark.png`
  - `obstacle-theme-kind.png`
  - `collectible-theme-kind.png`

## Game UI Design Rules

Use the installed `game-ui-design` skill for menu/HUD decisions before redesigning each screen.

Core rules for this game:

- Keep critical UI inside a 5% safe margin from screen edges.
- Runner HUD must not cover the center lane, the player, upcoming obstacles, or collectibles.
- During gameplay, show only information needed right now: score, collectible count, health, pause.
- Any text over gameplay must have a high-contrast outline, shadow, or backing panel.
- Touch controls and buttons should target at least 48x48 px at the game reference size.
- Do not communicate important state by color alone; pair color with icon shape or text.
- UI animations should be short and gentle, preferably under 300 ms, with no HUD shake.
- For mobile portrait, test readability while the road is moving, not only on static screenshots.

Screen-specific direction:

- Lobby page: playful and polished, but not cluttered. Character is the hero; buttons and stats support selection.
- Map selection page: cards should be visually distinct by theme and readable at a glance.
- Runner page: gameplay readability wins over decoration. PNG assets should enrich the scene without hiding hazards.

## Phase 1: Character Asset Baseline

| Task | Size | Dependencies | Output |
| --- | --- | --- | --- |
| Generate front/back PNGs for all five characters | M | Baby-brother style approved | 10 character PNGs |
| Update `characters.ts` asset references | S | New PNGs | correct lobby/run mapping |
| Normalize in-game display sizes per character | S | New PNGs | no oversized/undersized characters |
| Remove or demote failed layered baby runner path | S | New mapping stable | simpler runner rendering |

Files:
- `src/game/characters.ts`
- `src/game/RunnerScene.ts`
- `src/assets/characters/*`

Manual checks:
- Each character is front-facing in lobby.
- Each character is back-facing or rear 3/4 in runner.
- All characters fit the lane, do not cover obstacles, and read clearly at mobile size.

## Phase 2: Lobby Page Refresh

| Task | Size | Dependencies | Output |
| --- | --- | --- | --- |
| Replace procedural lobby character presentation with PNG-first layout | M | Phase 1 | cleaner character carousel/selection |
| Generate lobby environment PNG accents | M | visual direction approved | premium garden/playroom feel |
| Replace rough badges/buttons where useful with PNG UI elements | S | environment assets | more polished selection UI |
| Tune shadows, depth, and scale | S | integrated assets | cohesive lobby composition |

Candidate assets:
- soft playroom/garden background panel
- selection pedestal/platform
- character shadow blobs
- decorative toys/signage
- selected-character highlight
- PNG button set for start, next, back, and select actions

Manual checks:
- First screen clearly shows the selected character.
- Character cards/buttons remain readable and tappable.
- No nested-card or cluttered marketing feel.
- All interactive controls meet the 48x48 px touch target rule.

## Phase 3: Map Selection Page Refresh

| Task | Size | Dependencies | Output |
| --- | --- | --- | --- |
| Generate theme map cards for campus, mall, zoo, amusement | M | theme list stable | four premium map thumbnails |
| Replace procedural landmark clusters with PNG thumbnails | M | map cards | more legible map selection |
| Generate theme-specific lock/selected/completed state accents if needed | S | map card layout | richer state feedback |
| Update map selection layout and sizing | S | assets integrated | mobile-safe map page |

Candidate assets:
- `map-campus-card.png`
- `map-mall-card.png`
- `map-zoo-card.png`
- `map-amusement-card.png`
- small theme badges and route markers
- selected-state frame and locked/completed variants if needed

Manual checks:
- Each map card is visually distinct.
- Selected map state is obvious.
- Text labels do not overlap art.
- Cards remain easy to compare on a small portrait screen.

## Phase 4: Runner Page Refresh

| Task | Size | Dependencies | Output |
| --- | --- | --- | --- |
| Generate theme-specific road/background PNG layers | L | theme visual direction | polished runner scenery |
| Generate obstacles as PNGs per theme | M | obstacle list stable | consistent obstacle style |
| Generate collectibles as PNGs per theme | S | collectible list stable | clearer reward items |
| Replace procedural obstacle/collectible drawing with image factories | M | PNG assets | simpler, prettier gameplay objects |
| Tune sizing, collision body offsets, and shadows | M | image factories | fair gameplay hitboxes |
| Add fallback paths for missing textures | S | image factories | resilience during iteration |

Candidate runner assets:
- road texture or lane overlays
- campus: rail, cone, school cart, flower collectible
- mall: shopping cart, arch/gate, coin collectible
- zoo: wooden fence, leaf collectible
- amusement: small gate, balloon collectible
- general obstacle cue icons
- refreshed HUD frames/icons for score, health, collectibles, and pause

Manual checks:
- Obstacles are readable before collision.
- Collectibles are visible against each theme.
- Hitboxes still feel fair after visual replacement.
- Runner page keeps stable FPS on mobile.
- HUD does not obscure the player lane or upcoming hazards.
- Text and numbers are readable over the moving road.

## Phase 5: Asset Pipeline & Cleanup

| Task | Size | Dependencies | Output |
| --- | --- | --- | --- |
| Document image generation prompt templates | S | first batch accepted | repeatable asset style |
| Add asset review checklist | S | prompt templates | consistent QA |
| Remove unused old/generated intermediate assets | S | final references confirmed | smaller bundle |
| Optional: split large Three/game chunks later | M | visual refresh stable | bundle warning reduction |

Automated verification:
- `npm.cmd run test`
- `npm.cmd run build`
- Optional asset audit script for missing files referenced by `characters.ts` and level config.

Manual verification:
- Character lobby on mobile viewport.
- Map selection on mobile viewport.
- Runner page with each theme and each character.
- At least one full run with collision, jump, slide, pause, result.

## Risks

| Risk | Impact | Mitigation |
| --- | --- | --- |
| Asset style drifts between generations | High | generate in batches from approved references and reuse prompt templates |
| PNGs inflate bundle size | Medium | resize to display-appropriate dimensions and optimize PNGs |
| Pretty obstacles hurt gameplay readability | High | test lane visibility and hitbox fairness after each obstacle batch |
| Replacing too many systems at once causes churn | Medium | land one page at a time: characters, lobby, map, runner |

## Rollback Strategy

- Keep old assets until new references are stable.
- Each phase should be a separate commit.
- If a page refresh fails visually, revert only that page's asset references and rendering changes.
- Do not delete old PNGs until the build has passed and manual viewport checks are accepted.

## Suggested Execution Order

1. Finish all character front/back PNGs.
2. Commit character asset mapping.
3. Refresh lobby page.
4. Refresh map selection page.
5. Refresh runner page assets theme by theme.
6. Clean unused assets and optimize bundle size.

---

## 附录：详细资产清单 (中文)

### 📁 目录结构

```
src/assets/
├── backgrounds/
│   ├── lobby-garden.png          ✓ (done)
│   ├── map-select.png            ✓ (done)
│   ├── runner-campus.png
│   ├── runner-mall.png
│   ├── runner-zoo.png
│   └── runner-amusement.png
├── landmarks/
│   ├── campus/
│   │   ├── school-building.png
│   │   ├── playground.png
│   │   └── tree.png
│   ├── mall/
│   │   ├── shop.png
│   │   ├── shopping-cart.png
│   │   └── sale-sign.png
│   ├── zoo/
│   │   ├── elephant.png
│   │   ├── giraffe.png
│   │   └── fence.png
│   └── amusement/
│       ├── ferris-wheel.png
│       ├── roller-coaster.png
│       └── balloon.png
├── obstacles/
│   ├── campus/
│   │   ├── backpack.png
│   │   ├── book-pile.png
│   │   └── desk.png
│   ├── mall/
│   │   ├── shopping-bag.png
│   │   ├── mannequin.png
│   │   └── display-rack.png
│   ├── zoo/
│   │   ├── animal-crate.png
│   │   ├── sign-post.png
│   │   └── fence-section.png
│   └── amusement/
│       ├── ticket-booth.png
│       ├── popcorn-machine.png
│       └── game-booth.png
├── collectibles/
│   ├── campus/
│   │   ├── apple.png
│   │   ├── star.png
│   │   └── notebook.png
│   ├── mall/
│   │   ├── coin.png
│   │   ├── gem.png
│   │   └── coupon.png
│   ├── zoo/
│   │   ├── leaf.png
│   │   ├── paw-print.png
│   │   └── acorn.png
│   └── amusement/
│       ├── balloon.png
│       ├── ticket.png
│       └── lollipop.png
└── ui/
    ├── health-heart.png
    ├── score-badge.png
    └── speed-meter.png
```

---

### 🎨 按主题资产清单

#### 🎓 校园 (Campus)

| 资产类型 | 文件名 | 提示词 (Prompt) | 尺寸 |
|---------|--------|----------------|------|
| **背景** | `runner-campus.png` | "卡通风格垂直跑酷游戏背景，校园主题，伪三维透视效果，三条跑道从上方远处延伸到下方近处，两侧有粉色教学楼、绿色操场、樱花树，色彩明亮可爱，适合手机游戏，竖版9:16，1440x2562" | 390x720 |
| **地标1** | `landmarks/campus/school-building.png` | "可爱卡通风格教学楼，粉色屋顶，白色墙壁，透明背景PNG" | ~120x100 |
| **地标2** | `landmarks/campus/playground.png` | "卡通操场，带秋千和滑梯，透明背景PNG" | ~100x80 |
| **地标3** | `landmarks/campus/tree.png` | "可爱卡通樱花树，粉色花朵，透明背景PNG" | ~80x100 |
| **障碍物1** | `obstacles/campus/backpack.png` | "可爱卡通书包，蓝色或红色，透明背景PNG" | ~60x50 |
| **障碍物2** | `obstacles/campus/book-pile.png` | "一堆卡通书籍，透明背景PNG" | ~70x50 |
| **障碍物3** | `obstacles/campus/desk.png` | "卡通课桌，透明背景PNG" | ~80x40 |
| **收集物1** | `collectibles/campus/apple.png` | "可爱卡通红苹果，带绿叶，透明背景PNG" | ~30x30 |
| **收集物2** | `collectibles/campus/star.png` | "金色星星，透明背景PNG" | ~25x25 |
| **收集物3** | `collectibles/campus/notebook.png` | "卡通笔记本，蓝色封面，透明背景PNG" | ~35x30 |

---

#### 🛍️ 商场 (Mall)

| 资产类型 | 文件名 | 提示词 (Prompt) | 尺寸 |
|---------|--------|----------------|------|
| **背景** | `runner-mall.png` | "卡通风格垂直跑酷游戏背景，商场主题，伪三维透视效果，三条购物通道从上方远处延伸到下方近处，两侧有明亮的商店、自动扶梯、彩灯，色彩丰富可爱，适合手机游戏，竖版9:16，1440x2562" | 390x720 |
| **地标1** | `landmarks/mall/shop.png` | "可爱卡通商店门面，带橱窗，透明背景PNG" | ~120x90 |
| **地标2** | `landmarks/mall/shopping-cart.png` | "卡通购物车，透明背景PNG" | ~90x70 |
| **地标3** | `landmarks/mall/sale-sign.png` | "卡通促销标志 SALE，透明背景PNG" | ~70x60 |
| **障碍物1** | `obstacles/mall/shopping-bag.png` | "彩色卡通购物袋，透明背景PNG" | ~50x60 |
| **障碍物2** | `obstacles/mall/mannequin.png` | "卡通服装模特，透明背景PNG" | ~40x80 |
| **障碍物3** | `obstacles/mall/display-rack.png` | "卡通商品展示架，透明背景PNG" | ~80x60 |
| **收集物1** | `collectibles/mall/coin.png` | "金色卡通硬币，透明背景PNG" | ~28x28 |
| **收集物2** | `collectibles/mall/gem.png` | "紫色宝石，透明背景PNG" | ~25x25 |
| **收集物3** | `collectibles/mall/coupon.png` | "卡通优惠券，透明背景PNG" | ~40x25 |

---

#### 🦁 动物园 (Zoo)

| 资产类型 | 文件名 | 提示词 (Prompt) | 尺寸 |
|---------|--------|----------------|------|
| **背景** | `runner-zoo.png` | "卡通风格垂直跑酷游戏背景，动物园主题，伪三维透视效果，三条参观路径从上方远处延伸到下方近处，两侧有绿色草地、动物围栏、树木，色彩自然可爱，适合手机游戏，竖版9:16，1440x2562" | 390x720 |
| **地标1** | `landmarks/zoo/elephant.png` | "可爱卡通大象，透明背景PNG" | ~100x80 |
| **地标2** | `landmarks/zoo/giraffe.png` | "可爱卡通长颈鹿，透明背景PNG" | ~90x120 |
| **地标3** | `landmarks/zoo/fence.png` | "卡通动物园围栏，透明背景PNG" | ~80x40 |
| **障碍物1** | `obstacles/zoo/animal-crate.png` | "卡通动物运输箱，透明背景PNG" | ~60x50 |
| **障碍物2** | `obstacles/zoo/sign-post.png` | "卡通指示牌，透明背景PNG" | ~40x70 |
| **障碍物3** | `obstacles/zoo/fence-section.png` | "围栏段障碍物，透明背景PNG" | ~70x40 |
| **收集物1** | `collectibles/zoo/leaf.png` | "绿色卡通树叶，透明背景PNG" | ~30x30 |
| **收集物2** | `collectibles/zoo/paw-print.png` | "动物爪印，棕色，透明背景PNG" | ~28x28 |
| **收集物3** | `collectibles/zoo/acorn.png` | "卡通橡果，透明背景PNG" | ~25x28 |

---

#### 🎡 游乐园 (Amusement)

| 资产类型 | 文件名 | 提示词 (Prompt) | 尺寸 |
|---------|--------|----------------|------|
| **背景** | `runner-amusement.png` | "卡通风格垂直跑酷游戏背景，游乐园主题，伪三维透视效果，三条人行道从上方远处延伸到下方近处，两侧有摩天轮、过山车、旋转木马、彩色气球，色彩鲜艳欢快可爱，适合手机游戏，竖版9:16，1440x2562" | 390x720 |
| **地标1** | `landmarks/amusement/ferris-wheel.png` | "卡通摩天轮，透明背景PNG" | ~120x120 |
| **地标2** | `landmarks/amusement/roller-coaster.png` | "卡通过山车局部，透明背景PNG" | ~110x80 |
| **地标3** | `landmarks/amusement/balloon.png` | "一束彩色气球，透明背景PNG" | ~70x90 |
| **障碍物1** | `obstacles/amusement/ticket-booth.png` | "卡通售票亭，透明背景PNG" | ~70x80 |
| **障碍物2** | `obstacles/amusement/popcorn-machine.png` | "卡通爆米花机，透明背景PNG" | ~55x65 |
| **障碍物3** | `obstacles/amusement/game-booth.png` | "卡通游戏摊位，透明背景PNG" | ~80x70 |
| **收集物1** | `collectibles/amusement/balloon.png` | "单个彩色气球，透明背景PNG" | ~30x40 |
| **收集物2** | `collectibles/amusement/ticket.png` | "游乐园门票，透明背景PNG" | ~35x25 |
| **收集物3** | `collectibles/amusement/lollipop.png` | "彩色棒棒糖，透明背景PNG" | ~25x35 |

---

### 🎯 生成说明

1. **所有图像**使用透明背景 PNG 格式
2. **背景图**先生成 1440x2562，再用 `sharp` 脚本优化到 390x720
3. **障碍物、收集物、地标**尺寸为大致建议，可根据视觉效果调整
4. **风格统一**：所有资产使用与现有 lobby/map-select 相同的可爱卡通风格
5. **保存位置**：先生成到 `img/draft/` 文件夹，优化后放到 `src/assets/`

---

### 📋 优化脚本

准备好资产后，使用 `scripts/optimize-*.cjs` 脚本进行压缩优化
