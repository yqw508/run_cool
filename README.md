# 萌娃酷跑 H5

《萌娃酷跑》是一个面向孩子和家庭试玩的移动端三车道跑酷游戏原型。当前优先目标是部署成一个朋友能在手机微信或浏览器里点开就玩的 H5 链接，而不是立刻走微信小程序审核上线。

## 当前能力

- 角色选择。
- 关卡选择：校园、商场、动物园、游乐园。
- 三车道跑酷：左右换道、上滑跳跃、下滑滑行。
- 星星收集和障碍物躲避。
- 生命值机制：撞到未躲开的障碍物先扣血，不会立即结束。
- 受击反馈：闪烁、震动、短暂无敌和音效。
- 每个主题场景有独立的背景音乐入口。

## 本地运行

```bash
npm install
npm run dev
```

默认会启动 Vite 开发服务。手机预览时建议使用局域网或部署后的 HTTPS 链接。

## 验证命令

```bash
npm run test
npm run build
```

Windows PowerShell 如果拦截 `npm.ps1`，可以使用：

```bash
npm.cmd run test
npm.cmd run build
```

## 部署试玩

推荐先部署为 H5 公网页面，方便发给朋友试玩。

可选平台：

- Vercel（适合快速生成一个对比 GitHub Pages 速度的试玩链接）
- Netlify
- GitHub Pages

当前仓库已包含 GitHub Pages 自动部署工作流：`.github/workflows/deploy-pages.yml`。推送到 `main` 后会自动执行测试、构建并发布 `dist`。

部署配置：

- 构建命令：`npm run build`
- 输出目录：`dist`
- Node 依赖安装：`npm install`

GitHub Pages 需要到仓库设置里启用 Pages，并将 Source 设置为 GitHub Actions。当前 Vite 已在 GitHub Pages 构建时使用 `/run_cool/` 作为 `base` 路径。

当前仓库也包含 `vercel.json`，在 Vercel 导入仓库后可直接使用：

- Build Command: `npm run build`
- Output Directory: `dist`
- Install Command: `npm install`

建议同时保留 GitHub Pages 和 Vercel 两个试玩链接，发给国内朋友时对比微信内置浏览器打开速度。

## 玩法说明

- 左右滑动：切换跑道。
- 上滑：跳跃，躲避低障碍。
- 下滑：滑行，躲避高障碍。
- 每局 3 点生命值，撞到未躲开的障碍物扣 1 点。
- 生命值归零后进入结算界面。
- 首次开始会显示新手引导。
- 游戏中可点击右上角“暂停”，准备好后继续。

## 项目文档

- 版本计划：[docs/plans/2026-05-13-public-mobile-playtest-roadmap.md](docs/plans/2026-05-13-public-mobile-playtest-roadmap.md)
- 主题关卡与生命值设计：[docs/superpowers/specs/2026-05-13-themed-levels-health-design.md](docs/superpowers/specs/2026-05-13-themed-levels-health-design.md)
- 角色设计：[docs/character-design.md](docs/character-design.md)

## 下一步建议

1. 在 GitHub 仓库设置中启用 Pages，Source 选择 GitHub Actions。
2. 等待 Actions 完成部署，拿到 GitHub Pages 试玩链接。
3. 用手机微信打开试玩链接做冒烟测试。
4. 发给少量朋友和孩子试玩，收集反馈后再决定是否进入微信小游戏/小程序路线。
