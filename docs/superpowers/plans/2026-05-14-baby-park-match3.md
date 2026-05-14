# 萌娃乐园连连看 MVP 实现计划

> **给执行代理的要求：**实现本计划时必须使用 `superpowers:subagent-driven-development`（推荐）或 `superpowers:executing-plans`。请按任务逐项执行，并用 checkbox（`- [ ]`）跟踪进度。

**目标：**把当前单一“萌娃酷跑”升级为“萌娃乐园”，新增“萌娃连连看”和“诗集”，形成一个可玩的寓教于乐 MVP。

**架构：**三消棋盘、计分、诗卡解锁、收藏进度全部先做成纯 TypeScript 模块，并用 Vitest 覆盖。Phaser 层只负责首页、酷跑入口、连连看玩法界面、诗集界面和动画呈现。酷跑与连连看共享 `src/game/levels.ts` 的主题信息，保持同一个乐园世界观。

**技术栈：**Vite、TypeScript、Phaser 3、Vitest、浏览器 `localStorage`。

---

## 文件结构

- `src/main.ts`：注册 `ParkHomeScene`、现有 `RunnerScene`、新增 `Match3Scene`、新增 `PoemBookScene`，默认进入乐园首页。
- `src/game/RunnerScene.ts`：保留酷跑能力，补充从结果页返回乐园的入口，并使用统一 scene key。
- `src/scenes/sceneKeys.ts`：统一管理 Phaser scene key。
- `src/scenes/ParkHomeScene.ts`：萌娃乐园首页，提供酷跑、连连看、诗集入口。
- `src/scenes/Match3Scene.ts`：萌娃连连看主题选择、棋盘、交换、结算诗卡。
- `src/scenes/PoemBookScene.ts`：诗集页面，展示已解锁诗卡和收藏状态。
- `src/match3/types.ts`：三消棋盘、方块、匹配结果等类型。
- `src/match3/board.ts`：棋盘创建、交换、匹配检测、消除、补齐等纯逻辑。
- `src/match3/board.test.ts`：三消棋盘规则测试。
- `src/match3/scoring.ts`：计分和星级计算。
- `src/match3/scoring.test.ts`：计分和星级测试。
- `src/match3/themes.ts`：连连看主题配置，映射酷跑四个主题。
- `src/poems/poems.ts`：主题诗卡数据和查询函数。
- `src/poems/poems.test.ts`：诗卡选择与解锁测试。
- `src/poems/progress.ts`：本地进度、解锁、收藏、序列化逻辑。
- `src/poems/progress.test.ts`：本地进度测试。

---

## 任务 1：实现三消棋盘纯逻辑

**文件：**
- 新建：`src/match3/types.ts`
- 新建：`src/match3/board.ts`
- 新建：`src/match3/board.test.ts`

- [ ] **步骤 1：先写失败测试**

新建 `src/match3/board.test.ts`：

```ts
import { describe, expect, it } from 'vitest';
import {
  areAdjacent,
  collapseBoard,
  createBoardFromKinds,
  findMatches,
  refillBoard,
  swapTiles
} from './board';

const b = 'baby-brother';
const s = 'little-star';
const i = 'ice-princess';
const p = 'pudding';
const a = 'air-captain';

describe('三消棋盘规则', () => {
  it('能识别横向和纵向三个及以上相同方块', () => {
    const board = createBoardFromKinds([
      [b, b, b, p],
      [s, i, a, p],
      [s, i, a, p],
      [a, s, p, i]
    ]);

    expect(findMatches(board)).toEqual([
      { id: 'h-0-0-3-baby-brother', kind: b, tiles: [{ row: 0, col: 0 }, { row: 0, col: 1 }, { row: 0, col: 2 }] },
      { id: 'v-0-3-3-pudding', kind: p, tiles: [{ row: 0, col: 3 }, { row: 1, col: 3 }, { row: 2, col: 3 }] }
    ]);
  });

  it('只能交换相邻方块，非相邻交换会报错', () => {
    const board = createBoardFromKinds([
      [b, s],
      [i, p]
    ]);

    expect(areAdjacent({ row: 0, col: 0 }, { row: 0, col: 1 })).toBe(true);
    expect(areAdjacent({ row: 0, col: 0 }, { row: 1, col: 1 })).toBe(false);
    expect(swapTiles(board, { row: 0, col: 0 }, { row: 0, col: 1 }).tiles[0][0].kind).toBe(s);
    expect(() => swapTiles(board, { row: 0, col: 0 }, { row: 1, col: 1 })).toThrow('Tiles must be adjacent');
  });

  it('能移除匹配方块并记录空位', () => {
    const board = createBoardFromKinds([
      [b, s, i],
      [p, s, a],
      [a, s, b]
    ]);

    const collapsed = collapseBoard(board, [{ row: 0, col: 1 }, { row: 1, col: 1 }, { row: 2, col: 1 }]);

    expect(collapsed.board.tiles.map((row) => row.map((tile) => tile?.kind ?? null))).toEqual([
      [b, null, i],
      [p, null, a],
      [a, null, b]
    ]);
    expect(collapsed.emptyCells).toEqual([{ row: 0, col: 1 }, { row: 1, col: 1 }, { row: 2, col: 1 }]);
  });

  it('能用指定方块补齐空位，便于测试保持确定性', () => {
    const board = createBoardFromKinds([
      [b, s, i],
      [p, s, a],
      [a, s, b]
    ]);
    const collapsed = collapseBoard(board, [{ row: 0, col: 1 }, { row: 1, col: 1 }, { row: 2, col: 1 }]);
    const refilled = refillBoard(collapsed.board, [p, i, a]);

    expect(refilled.tiles.map((row) => row.map((tile) => tile.kind))).toEqual([
      [b, p, i],
      [p, i, a],
      [a, a, b]
    ]);
  });
});
```

- [ ] **步骤 2：运行测试，确认失败**

运行：`npm.cmd run test -- src/match3/board.test.ts`

预期：失败，因为 `src/match3/board.ts` 和 `src/match3/types.ts` 尚不存在。

- [ ] **步骤 3：实现最小棋盘逻辑**

新建 `src/match3/types.ts`：

```ts
export type MatchTileKind = 'baby-brother' | 'little-star' | 'ice-princess' | 'pudding' | 'air-captain';

export type BoardPosition = {
  row: number;
  col: number;
};

export type MatchTile = BoardPosition & {
  id: string;
  kind: MatchTileKind;
};

export type MatchBoard = {
  rows: number;
  cols: number;
  tiles: MatchTile[][];
};

export type CollapsedBoard = {
  board: {
    rows: number;
    cols: number;
    tiles: Array<Array<MatchTile | null>>;
  };
  emptyCells: BoardPosition[];
};

export type MatchRun = {
  id: string;
  kind: MatchTileKind;
  tiles: BoardPosition[];
};
```

新建 `src/match3/board.ts`：

```ts
import type { BoardPosition, CollapsedBoard, MatchBoard, MatchRun, MatchTile, MatchTileKind } from './types';

function tileId(row: number, col: number, kind: MatchTileKind): string {
  return `${kind}-${row}-${col}`;
}

function cloneTile(tile: MatchTile, row = tile.row, col = tile.col): MatchTile {
  return { ...tile, row, col, id: tileId(row, col, tile.kind) };
}

export function createBoardFromKinds(kinds: MatchTileKind[][]): MatchBoard {
  return {
    rows: kinds.length,
    cols: kinds[0]?.length ?? 0,
    tiles: kinds.map((row, rowIndex) =>
      row.map((kind, colIndex) => ({ row: rowIndex, col: colIndex, kind, id: tileId(rowIndex, colIndex, kind) }))
    )
  };
}

export function areAdjacent(a: BoardPosition, b: BoardPosition): boolean {
  return Math.abs(a.row - b.row) + Math.abs(a.col - b.col) === 1;
}

export function swapTiles(board: MatchBoard, a: BoardPosition, b: BoardPosition): MatchBoard {
  if (!areAdjacent(a, b)) {
    throw new Error('Tiles must be adjacent');
  }

  const tiles = board.tiles.map((row) => row.map((tile) => ({ ...tile })));
  const first = tiles[a.row][a.col];
  const second = tiles[b.row][b.col];
  tiles[a.row][a.col] = cloneTile(second, a.row, a.col);
  tiles[b.row][b.col] = cloneTile(first, b.row, b.col);
  return { ...board, tiles };
}

export function findMatches(board: MatchBoard): MatchRun[] {
  const matches: MatchRun[] = [];

  for (let row = 0; row < board.rows; row += 1) {
    let start = 0;
    for (let col = 1; col <= board.cols; col += 1) {
      const current = board.tiles[row][col]?.kind;
      const previous = board.tiles[row][start].kind;
      if (current !== previous) {
        if (col - start >= 3) {
          matches.push({
            id: `h-${row}-${start}-${col - start}-${previous}`,
            kind: previous,
            tiles: Array.from({ length: col - start }, (_, index) => ({ row, col: start + index }))
          });
        }
        start = col;
      }
    }
  }

  for (let col = 0; col < board.cols; col += 1) {
    let start = 0;
    for (let row = 1; row <= board.rows; row += 1) {
      const current = board.tiles[row]?.[col]?.kind;
      const previous = board.tiles[start][col].kind;
      if (current !== previous) {
        if (row - start >= 3) {
          matches.push({
            id: `v-${start}-${col}-${row - start}-${previous}`,
            kind: previous,
            tiles: Array.from({ length: row - start }, (_, index) => ({ row: start + index, col }))
          });
        }
        start = row;
      }
    }
  }

  return matches;
}

export function collapseBoard(board: MatchBoard, removed: BoardPosition[]): CollapsedBoard {
  const removedKeys = new Set(removed.map((position) => `${position.row}:${position.col}`));
  const tiles: Array<Array<MatchTile | null>> = board.tiles.map((row) => row.map((tile) => ({ ...tile })));

  for (const position of removed) {
    tiles[position.row][position.col] = null;
  }

  const emptyCells: BoardPosition[] = [];
  for (let row = 0; row < board.rows; row += 1) {
    for (let col = 0; col < board.cols; col += 1) {
      if (removedKeys.has(`${row}:${col}`)) {
        emptyCells.push({ row, col });
      }
    }
  }

  return { board: { rows: board.rows, cols: board.cols, tiles }, emptyCells };
}

export function refillBoard(board: CollapsedBoard['board'], nextKinds: MatchTileKind[]): MatchBoard {
  const next = [...nextKinds];
  const tiles: MatchTile[][] = board.tiles.map((row, rowIndex) =>
    row.map((tile, colIndex) => {
      if (tile) {
        return cloneTile(tile, rowIndex, colIndex);
      }
      const kind = next.shift();
      if (!kind) {
        throw new Error('Not enough tile kinds to refill board');
      }
      return { row: rowIndex, col: colIndex, kind, id: tileId(rowIndex, colIndex, kind) };
    })
  );

  return { rows: board.rows, cols: board.cols, tiles };
}
```

- [ ] **步骤 4：运行测试，确认通过**

运行：`npm.cmd run test -- src/match3/board.test.ts`

预期：通过。

- [ ] **步骤 5：提交**

```bash
git add src/match3/types.ts src/match3/board.ts src/match3/board.test.ts
git commit -m "feat: add match3 board rules"
```

---

## 任务 2：实现计分、星级和主题配置

**文件：**
- 新建：`src/match3/scoring.ts`
- 新建：`src/match3/scoring.test.ts`
- 新建：`src/match3/themes.ts`

- [ ] **步骤 1：先写失败测试**

新建 `src/match3/scoring.test.ts`：

```ts
import { describe, expect, it } from 'vitest';
import { calculateMatchScore, calculateStars } from './scoring';
import { MATCH3_THEMES } from './themes';

describe('连连看计分和主题', () => {
  it('按匹配数量、长连和连击计算分数', () => {
    expect(calculateMatchScore([{ tileCount: 3 }, { tileCount: 4 }], 2)).toBe(210);
  });

  it('按分数阈值计算星级', () => {
    const targetScore = { oneStar: 300, twoStars: 700, threeStars: 1100 };
    expect(calculateStars(299, targetScore)).toBe(0);
    expect(calculateStars(300, targetScore)).toBe(1);
    expect(calculateStars(700, targetScore)).toBe(2);
    expect(calculateStars(1100, targetScore)).toBe(3);
  });

  it('为酷跑四个主题配置连连看主题', () => {
    expect(MATCH3_THEMES.map((theme) => theme.id)).toEqual(['campus', 'mall', 'zoo', 'amusement']);
    for (const theme of MATCH3_THEMES) {
      expect(theme.poemLibraryId).toBe(`${theme.id}-poems`);
      expect(theme.targetScore.threeStars).toBeGreaterThan(theme.targetScore.twoStars);
    }
  });
});
```

- [ ] **步骤 2：运行测试，确认失败**

运行：`npm.cmd run test -- src/match3/scoring.test.ts`

预期：失败，因为计分和主题模块尚不存在。

- [ ] **步骤 3：实现计分和主题配置**

新建 `src/match3/scoring.ts`：

```ts
export type MatchScoreInput = {
  tileCount: number;
};

export type StarTargets = {
  oneStar: number;
  twoStars: number;
  threeStars: number;
};

export function calculateMatchScore(matches: MatchScoreInput[], combo: number): number {
  const matchPoints = matches.reduce((total, match) => {
    const base = match.tileCount * 20;
    const longMatchBonus = Math.max(0, match.tileCount - 3) * 30;
    return total + base + longMatchBonus;
  }, 0);
  const comboBonus = Math.max(0, combo - 1) * 40;
  return matchPoints + comboBonus;
}

export function calculateStars(score: number, targets: StarTargets): 0 | 1 | 2 | 3 {
  if (score >= targets.threeStars) {
    return 3;
  }
  if (score >= targets.twoStars) {
    return 2;
  }
  if (score >= targets.oneStar) {
    return 1;
  }
  return 0;
}
```

新建 `src/match3/themes.ts`：

```ts
import { LEVEL_THEMES, type ThemeId } from '../game/levels';
import type { StarTargets } from './scoring';

export type Match3Theme = {
  id: ThemeId;
  label: string;
  poemLibraryId: string;
  targetScore: StarTargets;
};

const targetScoresByTheme: Record<ThemeId, StarTargets> = {
  campus: { oneStar: 300, twoStars: 700, threeStars: 1100 },
  mall: { oneStar: 360, twoStars: 820, threeStars: 1280 },
  zoo: { oneStar: 420, twoStars: 940, threeStars: 1460 },
  amusement: { oneStar: 500, twoStars: 1100, threeStars: 1700 }
};

export const MATCH3_THEMES: Match3Theme[] = LEVEL_THEMES.map((theme) => ({
  id: theme.id,
  label: theme.label,
  poemLibraryId: `${theme.id}-poems`,
  targetScore: targetScoresByTheme[theme.id]
}));

export function getMatch3Theme(themeId: ThemeId): Match3Theme {
  return MATCH3_THEMES.find((theme) => theme.id === themeId) ?? MATCH3_THEMES[0];
}
```

- [ ] **步骤 4：运行测试，确认通过**

运行：`npm.cmd run test -- src/match3/scoring.test.ts`

预期：通过。

- [ ] **步骤 5：提交**

```bash
git add src/match3/scoring.ts src/match3/scoring.test.ts src/match3/themes.ts
git commit -m "feat: add match3 scoring config"
```

---

## 任务 3：实现诗卡和本地进度

**文件：**
- 新建：`src/poems/poems.ts`
- 新建：`src/poems/poems.test.ts`
- 新建：`src/poems/progress.ts`
- 新建：`src/poems/progress.test.ts`

- [ ] **步骤 1：先写失败测试**

新建 `src/poems/poems.test.ts`：

```ts
import { describe, expect, it } from 'vitest';
import { getPoemsForTheme, getUnlockablePoems } from './poems';

describe('主题诗卡数据', () => {
  it('每个主题至少有一张可正式展示的诗卡', () => {
    for (const themeId of ['campus', 'mall', 'zoo', 'amusement'] as const) {
      const poems = getPoemsForTheme(themeId);
      expect(poems.length).toBeGreaterThanOrEqual(1);
      expect(poems[0].title.length).toBeGreaterThan(0);
      expect(poems[0].lines.length).toBeGreaterThanOrEqual(2);
    }
  });

  it('按主题、星级和已解锁列表选择新诗卡', () => {
    expect(getUnlockablePoems('zoo', 1, []).map((poem) => poem.id)).toEqual(['zoo-yong-e']);
    expect(getUnlockablePoems('zoo', 3, ['zoo-yong-e']).map((poem) => poem.id)).toEqual(['zoo-jue-ju']);
  });
});
```

新建 `src/poems/progress.test.ts`：

```ts
import { describe, expect, it } from 'vitest';
import { createEmptyProgress, mergeUnlockedPoems, serializeProgress, toggleFavoritePoem } from './progress';

describe('诗卡本地进度', () => {
  it('合并新解锁诗卡，并保留主题最高分和最高星级', () => {
    const progress = mergeUnlockedPoems(createEmptyProgress(), {
      themeId: 'zoo',
      score: 900,
      stars: 2,
      poemIds: ['zoo-yong-e']
    });

    const improved = mergeUnlockedPoems(progress, {
      themeId: 'zoo',
      score: 1200,
      stars: 3,
      poemIds: ['zoo-yong-e', 'zoo-jue-ju']
    });

    expect(improved.unlockedPoemIds).toEqual(['zoo-yong-e', 'zoo-jue-ju']);
    expect(improved.bestScoreByTheme.zoo).toBe(1200);
    expect(improved.bestStarsByTheme.zoo).toBe(3);
  });

  it('收藏和取消收藏同一张诗卡时不会产生重复数据', () => {
    const first = toggleFavoritePoem(createEmptyProgress(), 'zoo-yong-e');
    expect(first.favoritePoemIds).toEqual(['zoo-yong-e']);
    expect(toggleFavoritePoem(first, 'zoo-yong-e').favoritePoemIds).toEqual([]);
  });

  it('能序列化为 localStorage 可保存的 JSON', () => {
    const progress = toggleFavoritePoem(createEmptyProgress(), 'campus-jing-ye-si');
    expect(JSON.parse(serializeProgress(progress)).favoritePoemIds).toEqual(['campus-jing-ye-si']);
  });
});
```

- [ ] **步骤 2：运行测试，确认失败**

运行：`npm.cmd run test -- src/poems/poems.test.ts src/poems/progress.test.ts`

预期：失败，因为诗卡和进度模块尚不存在。

- [ ] **步骤 3：实现诗卡和进度逻辑**

新建 `src/poems/poems.ts`：

```ts
import type { ThemeId } from '../game/levels';

export type PoemCard = {
  id: string;
  themeId: ThemeId;
  title: string;
  author: string;
  lines: string[];
  unlockStars: 1 | 2 | 3;
  audioUrl?: string;
  readAlongEnabled: boolean;
};

export const POEM_CARDS: PoemCard[] = [
  { id: 'campus-jing-ye-si', themeId: 'campus', title: '静夜思', author: '李白', lines: ['床前明月光，疑是地上霜。', '举头望明月，低头思故乡。'], unlockStars: 1, readAlongEnabled: false },
  { id: 'campus-deng-guan-que-lou', themeId: 'campus', title: '登鹳雀楼', author: '王之涣', lines: ['白日依山尽，黄河入海流。', '欲穷千里目，更上一层楼。'], unlockStars: 3, readAlongEnabled: false },
  { id: 'mall-min-nong', themeId: 'mall', title: '悯农', author: '李绅', lines: ['锄禾日当午，汗滴禾下土。', '谁知盘中餐，粒粒皆辛苦。'], unlockStars: 1, readAlongEnabled: false },
  { id: 'zoo-yong-e', themeId: 'zoo', title: '咏鹅', author: '骆宾王', lines: ['鹅，鹅，鹅，曲项向天歌。', '白毛浮绿水，红掌拨清波。'], unlockStars: 1, readAlongEnabled: false },
  { id: 'zoo-jue-ju', themeId: 'zoo', title: '绝句', author: '杜甫', lines: ['两个黄鹂鸣翠柳，一行白鹭上青天。', '窗含西岭千秋雪，门泊东吴万里船。'], unlockStars: 3, readAlongEnabled: false },
  { id: 'amusement-chun-xiao', themeId: 'amusement', title: '春晓', author: '孟浩然', lines: ['春眠不觉晓，处处闻啼鸟。', '夜来风雨声，花落知多少。'], unlockStars: 1, readAlongEnabled: false }
];

export function getPoemsForTheme(themeId: ThemeId): PoemCard[] {
  return POEM_CARDS.filter((poem) => poem.themeId === themeId);
}

export function getUnlockablePoems(themeId: ThemeId, stars: 0 | 1 | 2 | 3, alreadyUnlockedIds: string[]): PoemCard[] {
  const unlocked = new Set(alreadyUnlockedIds);
  return getPoemsForTheme(themeId).filter((poem) => poem.unlockStars <= stars && !unlocked.has(poem.id));
}
```

新建 `src/poems/progress.ts`：

```ts
import type { ThemeId } from '../game/levels';

export type BabyParkProgress = {
  unlockedPoemIds: string[];
  favoritePoemIds: string[];
  bestStarsByTheme: Partial<Record<ThemeId, 1 | 2 | 3>>;
  bestScoreByTheme: Partial<Record<ThemeId, number>>;
};

export type UnlockResult = {
  themeId: ThemeId;
  score: number;
  stars: 0 | 1 | 2 | 3;
  poemIds: string[];
};

export const PROGRESS_STORAGE_KEY = 'baby-park-progress-v1';

export function createEmptyProgress(): BabyParkProgress {
  return { unlockedPoemIds: [], favoritePoemIds: [], bestStarsByTheme: {}, bestScoreByTheme: {} };
}

export function serializeProgress(progress: BabyParkProgress): string {
  return JSON.stringify(progress);
}

export function parseProgress(raw: string | null): BabyParkProgress {
  if (!raw) {
    return createEmptyProgress();
  }
  try {
    const parsed = JSON.parse(raw) as BabyParkProgress;
    return {
      unlockedPoemIds: Array.isArray(parsed.unlockedPoemIds) ? parsed.unlockedPoemIds : [],
      favoritePoemIds: Array.isArray(parsed.favoritePoemIds) ? parsed.favoritePoemIds : [],
      bestStarsByTheme: parsed.bestStarsByTheme ?? {},
      bestScoreByTheme: parsed.bestScoreByTheme ?? {}
    };
  } catch {
    return createEmptyProgress();
  }
}

export function mergeUnlockedPoems(progress: BabyParkProgress, result: UnlockResult): BabyParkProgress {
  const unlockedPoemIds = Array.from(new Set([...progress.unlockedPoemIds, ...result.poemIds]));
  const previousScore = progress.bestScoreByTheme[result.themeId] ?? 0;
  const previousStars = progress.bestStarsByTheme[result.themeId] ?? 1;
  const nextStars = result.stars === 0 ? previousStars : (Math.max(previousStars, result.stars) as 1 | 2 | 3);

  return {
    ...progress,
    unlockedPoemIds,
    bestScoreByTheme: { ...progress.bestScoreByTheme, [result.themeId]: Math.max(previousScore, result.score) },
    bestStarsByTheme: { ...progress.bestStarsByTheme, [result.themeId]: nextStars }
  };
}

export function toggleFavoritePoem(progress: BabyParkProgress, poemId: string): BabyParkProgress {
  const favorites = new Set(progress.favoritePoemIds);
  if (favorites.has(poemId)) {
    favorites.delete(poemId);
  } else {
    favorites.add(poemId);
  }
  return { ...progress, favoritePoemIds: Array.from(favorites) };
}
```

- [ ] **步骤 4：运行测试，确认通过**

运行：`npm.cmd run test -- src/poems/poems.test.ts src/poems/progress.test.ts`

预期：通过。

- [ ] **步骤 5：提交**

```bash
git add src/poems/poems.ts src/poems/poems.test.ts src/poems/progress.ts src/poems/progress.test.ts
git commit -m "feat: add poem card progress rules"
```

---

## 任务 4：新增萌娃乐园首页和场景导航

**文件：**
- 新建：`src/scenes/sceneKeys.ts`
- 新建：`src/scenes/ParkHomeScene.ts`
- 修改：`src/main.ts`
- 修改：`src/game/RunnerScene.ts`

- [ ] **步骤 1：新增 scene key**

新建 `src/scenes/sceneKeys.ts`：

```ts
export const SceneKeys = {
  ParkHome: 'ParkHomeScene',
  Runner: 'RunnerScene',
  Match3: 'Match3Scene',
  PoemBook: 'PoemBookScene'
} as const;
```

- [ ] **步骤 2：让酷跑场景使用统一 key，并补充返回乐园按钮**

在 `src/game/RunnerScene.ts` 增加导入：

```ts
import { SceneKeys } from '../scenes/sceneKeys';
```

修改构造函数：

```ts
constructor() {
  super(SceneKeys.Runner);
}
```

在 `endRun()` 结果页按钮区域增加返回乐园按钮：

```ts
const home = this.createButton(GAME_WIDTH / 2, 544, 220, 46, '返回乐园', 0xeaf7d8, () => this.scene.start(SceneKeys.ParkHome));
this.resultLayer.add([panel, title, scoreText, detail, retry, setup, home]);
```

- [ ] **步骤 3：新增乐园首页场景**

新建 `src/scenes/ParkHomeScene.ts`：

```ts
import Phaser from 'phaser';
import { GAME_HEIGHT, GAME_WIDTH } from '../game/config';
import { SceneKeys } from './sceneKeys';

const TEXT_STYLE = {
  fontFamily: '"Microsoft YaHei", "PingFang SC", Arial, sans-serif',
  color: '#17263a'
};

export class ParkHomeScene extends Phaser.Scene {
  constructor() {
    super(SceneKeys.ParkHome);
  }

  create(): void {
    document.getElementById('boot-loading')?.remove();
    this.add.rectangle(GAME_WIDTH / 2, GAME_HEIGHT / 2, GAME_WIDTH, GAME_HEIGHT, 0xbfefff);
    this.add.circle(66, 78, 32, 0xffe46b, 0.95);
    this.add.rectangle(GAME_WIDTH / 2, 620, GAME_WIDTH, 220, 0x74c973);
    this.add.ellipse(GAME_WIDTH / 2, 520, 320, 120, 0x9be27d, 0.9);

    this.add
      .text(GAME_WIDTH / 2, 78, '萌娃乐园', { ...TEXT_STYLE, fontSize: '34px', fontStyle: 'bold' })
      .setOrigin(0.5)
      .setStroke('#ffffff', 5);
    this.add
      .text(GAME_WIDTH / 2, 122, '酷跑、连连看和诗集都在这里', { ...TEXT_STYLE, color: '#527084', fontSize: '16px' })
      .setOrigin(0.5);

    this.addMenuButton(195, 230, '萌娃酷跑', '继续挑战反应力', 0xffd447, () => this.scene.start(SceneKeys.Runner));
    this.addMenuButton(195, 350, '萌娃连连看', '三消合成解锁诗卡', 0xff87b7, () => this.scene.start(SceneKeys.Match3));
    this.addMenuButton(195, 470, '诗集', '查看收藏的古诗卡', 0xdff2fb, () => this.scene.start(SceneKeys.PoemBook));
  }

  private addMenuButton(x: number, y: number, title: string, subtitle: string, color: number, onClick: () => void): void {
    const button = this.add.container(x, y);
    button.add(this.add.rectangle(0, 0, 290, 86, color, 0.96).setStrokeStyle(3, 0xffffff));
    button.add(this.add.text(-116, -24, title, { ...TEXT_STYLE, fontSize: '24px', fontStyle: 'bold' }));
    button.add(this.add.text(-116, 10, subtitle, { ...TEXT_STYLE, color: '#527084', fontSize: '15px' }));
    button.add(this.add.text(112, 0, '>', { ...TEXT_STYLE, fontSize: '28px', fontStyle: 'bold' }).setOrigin(0.5));
    button.setSize(290, 86);
    button.setInteractive({ useHandCursor: true });
    button.on('pointerup', onClick);
  }
}
```

- [ ] **步骤 4：在 main 中注册首页和酷跑场景**

修改 `src/main.ts`：

```ts
import Phaser from 'phaser';
import './styles.css';
import { GAME_HEIGHT, GAME_WIDTH } from './game/config';
import { RunnerScene } from './game/RunnerScene';
import { ParkHomeScene } from './scenes/ParkHomeScene';

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
  scene: [ParkHomeScene, RunnerScene]
});
```

保留现有 `ThreeTechPreview` 动态导入逻辑，不要删除。

- [ ] **步骤 5：构建验证**

运行：`npm.cmd run build`

预期：通过。

- [ ] **步骤 6：提交**

```bash
git add src/main.ts src/game/RunnerScene.ts src/scenes/sceneKeys.ts src/scenes/ParkHomeScene.ts
git commit -m "feat: add baby park home"
```

---

## 任务 5：新增萌娃连连看场景 MVP

**文件：**
- 新建：`src/scenes/Match3Scene.ts`
- 修改：`src/main.ts`

- [ ] **步骤 1：新增连连看场景**

新建 `src/scenes/Match3Scene.ts`：

```ts
import Phaser from 'phaser';
import { CHARACTER_PRESETS } from '../game/characters';
import { GAME_HEIGHT, GAME_WIDTH } from '../game/config';
import { createBoardFromKinds, findMatches, swapTiles } from '../match3/board';
import { calculateMatchScore, calculateStars } from '../match3/scoring';
import { MATCH3_THEMES } from '../match3/themes';
import type { BoardPosition, MatchBoard, MatchTileKind } from '../match3/types';
import { getUnlockablePoems } from '../poems/poems';
import { createEmptyProgress, mergeUnlockedPoems, parseProgress, PROGRESS_STORAGE_KEY, serializeProgress } from '../poems/progress';
import { SceneKeys } from './sceneKeys';

const TEXT_STYLE = {
  fontFamily: '"Microsoft YaHei", "PingFang SC", Arial, sans-serif',
  color: '#17263a'
};

const BOARD_SIZE = 6;
const TILE_SIZE = 50;
const TILE_GAP = 6;
const BOARD_X = 36;
const BOARD_Y = 190;
const TILE_KINDS = CHARACTER_PRESETS.map((preset) => preset.id) as MatchTileKind[];

export class Match3Scene extends Phaser.Scene {
  private themeIndex = 0;
  private board!: MatchBoard;
  private selected?: BoardPosition;
  private score = 0;
  private movesLeft = 20;
  private scoreText!: Phaser.GameObjects.Text;
  private movesText!: Phaser.GameObjects.Text;
  private boardLayer!: Phaser.GameObjects.Container;

  constructor() {
    super(SceneKeys.Match3);
  }

  create(): void {
    this.themeIndex = 0;
    this.showThemeSelect();
  }

  private showThemeSelect(): void {
    this.children.removeAll();
    this.add.rectangle(GAME_WIDTH / 2, GAME_HEIGHT / 2, GAME_WIDTH, GAME_HEIGHT, 0xbfefff);
    this.add.text(GAME_WIDTH / 2, 72, '萌娃连连看', { ...TEXT_STYLE, fontSize: '30px', fontStyle: 'bold' }).setOrigin(0.5).setStroke('#ffffff', 5);
    MATCH3_THEMES.forEach((theme, index) => {
      const button = this.add.container(GAME_WIDTH / 2, 168 + index * 96);
      button.add(this.add.rectangle(0, 0, 292, 70, 0xffffff, 0.94).setStrokeStyle(3, 0xffd447));
      button.add(this.add.text(-120, -18, theme.label, { ...TEXT_STYLE, fontSize: '22px', fontStyle: 'bold' }));
      button.add(this.add.text(-120, 12, `目标 ${theme.targetScore.oneStar}/${theme.targetScore.twoStars}/${theme.targetScore.threeStars}`, { ...TEXT_STYLE, color: '#527084', fontSize: '14px' }));
      button.setSize(292, 70).setInteractive({ useHandCursor: true });
      button.on('pointerup', () => this.startTheme(index));
    });
    this.addTextButton(195, 650, '返回乐园', 0xeaf7d8, () => this.scene.start(SceneKeys.ParkHome));
  }

  private startTheme(index: number): void {
    this.themeIndex = index;
    this.score = 0;
    this.movesLeft = 20;
    this.selected = undefined;
    this.board = this.createInitialBoard();
    this.drawGame();
  }

  private createInitialBoard(): MatchBoard {
    const rows = Array.from({ length: BOARD_SIZE }, (_, row) =>
      Array.from({ length: BOARD_SIZE }, (_, col) => TILE_KINDS[(row * 2 + col * 3 + row + col) % TILE_KINDS.length])
    );
    return createBoardFromKinds(rows);
  }

  private drawGame(): void {
    this.children.removeAll();
    const theme = MATCH3_THEMES[this.themeIndex];
    this.add.rectangle(GAME_WIDTH / 2, GAME_HEIGHT / 2, GAME_WIDTH, GAME_HEIGHT, 0xf8fbff);
    this.add.text(GAME_WIDTH / 2, 42, theme.label, { ...TEXT_STYLE, fontSize: '28px', fontStyle: 'bold' }).setOrigin(0.5);
    this.scoreText = this.add.text(28, 82, `得分 ${this.score}`, { ...TEXT_STYLE, fontSize: '18px', fontStyle: 'bold' });
    this.movesText = this.add.text(260, 82, `步数 ${this.movesLeft}`, { ...TEXT_STYLE, fontSize: '18px', fontStyle: 'bold' });
    this.boardLayer = this.add.container(0, 0);
    this.drawBoard();
    this.addTextButton(104, 650, '选关', 0xdff2fb, () => this.showThemeSelect());
    this.addTextButton(286, 650, '结束', 0xffd447, () => this.finishRound());
  }

  private drawBoard(): void {
    this.boardLayer.destroy(true);
    this.boardLayer = this.add.container(0, 0);
    for (const row of this.board.tiles) {
      for (const tile of row) {
        const x = BOARD_X + tile.col * (TILE_SIZE + TILE_GAP) + TILE_SIZE / 2;
        const y = BOARD_Y + tile.row * (TILE_SIZE + TILE_GAP) + TILE_SIZE / 2;
        const preset = CHARACTER_PRESETS.find((item) => item.id === tile.kind) ?? CHARACTER_PRESETS[0];
        const isSelected = this.selected?.row === tile.row && this.selected.col === tile.col;
        const cell = this.add.container(x, y);
        cell.add(this.add.rectangle(0, 0, TILE_SIZE, TILE_SIZE, preset.accentColor, 0.95).setStrokeStyle(isSelected ? 4 : 2, isSelected ? 0x17263a : 0xffffff));
        cell.add(this.add.image(0, 2, preset.assetKey).setDisplaySize(38, 42));
        cell.setSize(TILE_SIZE, TILE_SIZE).setInteractive({ useHandCursor: true });
        cell.on('pointerup', () => this.handleTileTap({ row: tile.row, col: tile.col }));
        this.boardLayer.add(cell);
      }
    }
  }

  private handleTileTap(position: BoardPosition): void {
    if (!this.selected) {
      this.selected = position;
      this.drawBoard();
      return;
    }
    try {
      const swapped = swapTiles(this.board, this.selected, position);
      const matches = findMatches(swapped);
      if (matches.length > 0) {
        this.board = swapped;
        this.score += calculateMatchScore(matches.map((match) => ({ tileCount: match.tiles.length })), 1);
        this.movesLeft -= 1;
        this.playMatchAnimation(matches[0].kind);
      }
    } catch {
      this.cameras.main.shake(80, 0.004);
    }
    this.selected = undefined;
    this.scoreText.setText(`得分 ${this.score}`);
    this.movesText.setText(`步数 ${this.movesLeft}`);
    this.drawBoard();
    if (this.movesLeft <= 0) {
      this.finishRound();
    }
  }

  private playMatchAnimation(kind: MatchTileKind): void {
    const textByKind: Record<MatchTileKind, string> = {
      'baby-brother': '喝奶瓶',
      'little-star': '大西瓜',
      'ice-princess': '钻石闪闪',
      pudding: '布丁果冻',
      'air-captain': '飞机飞过'
    };
    const banner = this.add.text(GAME_WIDTH / 2, 570, textByKind[kind], { ...TEXT_STYLE, fontSize: '24px', fontStyle: 'bold' }).setOrigin(0.5);
    this.tweens.add({ targets: banner, y: 538, alpha: 0, duration: 820, onComplete: () => banner.destroy() });
  }

  private finishRound(): void {
    const theme = MATCH3_THEMES[this.themeIndex];
    const stars = calculateStars(this.score, theme.targetScore);
    const progress = parseProgress(window.localStorage?.getItem(PROGRESS_STORAGE_KEY));
    const unlocked = getUnlockablePoems(theme.id, stars, progress.unlockedPoemIds);
    const nextProgress = mergeUnlockedPoems(progress ?? createEmptyProgress(), {
      themeId: theme.id,
      score: this.score,
      stars,
      poemIds: unlocked.map((poem) => poem.id)
    });
    window.localStorage?.setItem(PROGRESS_STORAGE_KEY, serializeProgress(nextProgress));
    const poemTitle = unlocked[0]?.title ?? '继续挑战，解锁新诗卡';
    this.children.removeAll();
    this.add.rectangle(GAME_WIDTH / 2, GAME_HEIGHT / 2, GAME_WIDTH, GAME_HEIGHT, 0xfff8e8);
    this.add.text(GAME_WIDTH / 2, 180, `得分 ${this.score}`, { ...TEXT_STYLE, fontSize: '30px', fontStyle: 'bold' }).setOrigin(0.5);
    this.add.text(GAME_WIDTH / 2, 230, `${'★'.repeat(stars)}${'☆'.repeat(3 - stars)}`, { ...TEXT_STYLE, color: '#ff9f1c', fontSize: '30px' }).setOrigin(0.5);
    this.add.text(GAME_WIDTH / 2, 306, `诗卡：${poemTitle}`, { ...TEXT_STYLE, fontSize: '22px', align: 'center', wordWrap: { width: 300 } }).setOrigin(0.5);
    this.addTextButton(105, 520, '再玩', 0x7ed957, () => this.startTheme(this.themeIndex));
    this.addTextButton(285, 520, '诗集', 0xdff2fb, () => this.scene.start(SceneKeys.PoemBook));
    this.addTextButton(195, 600, '返回乐园', 0xeaf7d8, () => this.scene.start(SceneKeys.ParkHome));
  }

  private addTextButton(x: number, y: number, label: string, color: number, onClick: () => void): void {
    const button = this.add.container(x, y);
    button.add(this.add.rectangle(0, 0, 138, 48, color, 0.96).setStrokeStyle(2, 0xffffff));
    button.add(this.add.text(0, 0, label, { ...TEXT_STYLE, fontSize: '18px', fontStyle: 'bold' }).setOrigin(0.5));
    button.setSize(138, 48).setInteractive({ useHandCursor: true });
    button.on('pointerup', onClick);
  }
}
```

- [ ] **步骤 2：在 main 中注册 Match3Scene**

修改 `src/main.ts` 导入：

```ts
import { Match3Scene } from './scenes/Match3Scene';
```

修改 scene 列表：

```ts
scene: [ParkHomeScene, RunnerScene, Match3Scene]
```

- [ ] **步骤 3：构建验证**

运行：`npm.cmd run build`

预期：通过。

- [ ] **步骤 4：提交**

```bash
git add src/main.ts src/scenes/Match3Scene.ts
git commit -m "feat: add match3 scene"
```

---

## 任务 6：新增诗集页面和收藏能力

**文件：**
- 新建：`src/scenes/PoemBookScene.ts`
- 修改：`src/main.ts`

- [ ] **步骤 1：新增诗集场景**

新建 `src/scenes/PoemBookScene.ts`：

```ts
import Phaser from 'phaser';
import { GAME_HEIGHT, GAME_WIDTH } from '../game/config';
import { MATCH3_THEMES } from '../match3/themes';
import { POEM_CARDS } from '../poems/poems';
import { parseProgress, PROGRESS_STORAGE_KEY, serializeProgress, toggleFavoritePoem } from '../poems/progress';
import { SceneKeys } from './sceneKeys';

const TEXT_STYLE = {
  fontFamily: '"Microsoft YaHei", "PingFang SC", Arial, sans-serif',
  color: '#17263a'
};

export class PoemBookScene extends Phaser.Scene {
  constructor() {
    super(SceneKeys.PoemBook);
  }

  create(): void {
    this.drawBook();
  }

  private drawBook(): void {
    this.children.removeAll();
    const progress = parseProgress(window.localStorage?.getItem(PROGRESS_STORAGE_KEY));
    this.add.rectangle(GAME_WIDTH / 2, GAME_HEIGHT / 2, GAME_WIDTH, GAME_HEIGHT, 0xfff8e8);
    this.add.text(GAME_WIDTH / 2, 54, '萌娃诗集', { ...TEXT_STYLE, fontSize: '30px', fontStyle: 'bold' }).setOrigin(0.5).setStroke('#ffffff', 5);

    let y = 116;
    for (const theme of MATCH3_THEMES) {
      this.add.text(30, y, theme.label, { ...TEXT_STYLE, fontSize: '18px', fontStyle: 'bold' });
      y += 34;
      for (const poem of POEM_CARDS.filter((item) => item.themeId === theme.id)) {
        const unlocked = progress.unlockedPoemIds.includes(poem.id);
        const favorite = progress.favoritePoemIds.includes(poem.id);
        const row = this.add.container(GAME_WIDTH / 2, y);
        row.add(this.add.rectangle(0, 0, 330, 58, unlocked ? 0xffffff : 0xe8e0d2, 0.96).setStrokeStyle(2, favorite ? 0xff9f1c : 0xffffff));
        row.add(this.add.text(-145, -17, unlocked ? poem.title : `需 ${poem.unlockStars} 星解锁`, { ...TEXT_STYLE, fontSize: '17px', fontStyle: 'bold' }));
        row.add(this.add.text(-145, 8, unlocked ? poem.lines[0] : '继续挑战主题关卡', { ...TEXT_STYLE, color: '#527084', fontSize: '13px' }));
        row.add(this.add.text(126, 0, favorite ? '已藏' : '收藏', { ...TEXT_STYLE, color: unlocked ? '#17263a' : '#8a8a8a', fontSize: '14px', fontStyle: 'bold' }).setOrigin(0.5));
        if (unlocked) {
          row.setSize(330, 58).setInteractive({ useHandCursor: true });
          row.on('pointerup', () => {
            const nextProgress = toggleFavoritePoem(progress, poem.id);
            window.localStorage?.setItem(PROGRESS_STORAGE_KEY, serializeProgress(nextProgress));
            this.drawBook();
          });
        }
        y += 70;
      }
      y += 10;
    }

    this.addTextButton(195, 666, '返回乐园', 0xeaf7d8, () => this.scene.start(SceneKeys.ParkHome));
  }

  private addTextButton(x: number, y: number, label: string, color: number, onClick: () => void): void {
    const button = this.add.container(x, y);
    button.add(this.add.rectangle(0, 0, 170, 48, color, 0.96).setStrokeStyle(2, 0xffffff));
    button.add(this.add.text(0, 0, label, { ...TEXT_STYLE, fontSize: '18px', fontStyle: 'bold' }).setOrigin(0.5));
    button.setSize(170, 48).setInteractive({ useHandCursor: true });
    button.on('pointerup', onClick);
  }
}
```

- [ ] **步骤 2：在 main 中注册 PoemBookScene**

修改 `src/main.ts` 导入：

```ts
import { PoemBookScene } from './scenes/PoemBookScene';
```

修改 scene 列表：

```ts
scene: [ParkHomeScene, RunnerScene, Match3Scene, PoemBookScene]
```

- [ ] **步骤 3：构建验证**

运行：`npm.cmd run build`

预期：通过。

- [ ] **步骤 4：提交**

```bash
git add src/main.ts src/scenes/PoemBookScene.ts
git commit -m "feat: add poem book scene"
```

---

## 任务 7：最终验证和体验打磨

**文件：**
- 只修改验证过程中发现必须修复的文件。

- [ ] **步骤 1：运行完整测试**

运行：`npm.cmd run test`

预期：所有现有酷跑测试、新增三消测试、新增诗卡测试全部通过。

- [ ] **步骤 2：运行生产构建**

运行：`npm.cmd run build`

预期：构建通过并生成 `dist/`。

- [ ] **步骤 3：启动本地开发服务**

运行：`npm.cmd run dev`

预期：Vite 输出本地访问地址，例如 `http://localhost:5173/`。

- [ ] **步骤 4：浏览器手动冒烟验证**

打开 Vite 地址，验证：

- 首页显示“萌娃乐园”。
- 点击“萌娃酷跑”能进入现有酷跑。
- 酷跑结算页能返回乐园首页。
- 点击“萌娃连连看”能进入主题选择。
- 四个主题都能开始连连看棋盘。
- 点击相邻方块，在形成匹配时能加分。
- 结束连连看后能展示星级和诗卡结果。
- 点击“诗集”能看到已解锁诗卡。
- 已解锁诗卡可以收藏/取消收藏。
- 手机尺寸下首页按钮、棋盘、诗卡行不重叠。

- [ ] **步骤 5：如有修复则提交**

如果验证时做了修复：

```bash
git add <fixed-files>
git commit -m "fix: polish baby park match3 mvp"
```

如果没有修复，不创建空提交。

---

## 自检结果

- 已覆盖 spec：乐园首页、保留酷跑入口、五角色三消、四主题关卡、计分星级、主题诗卡解锁、本地收藏、诗集。
- 已控制范围：第一版不做账号、云同步、朗读音频、跟读评分、家长端和复杂成长系统。
- 测试策略明确：三消、计分、诗卡、进度先用纯逻辑单测覆盖，再接 Phaser 场景。
- 类型命名一致：`ThemeId`、`MatchTileKind`、`PoemCard`、`BabyParkProgress`、`SceneKeys` 在使用前定义并复用。
