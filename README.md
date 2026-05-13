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

- Vercel
- Netlify
- GitHub Pages

部署配置：

- 构建命令：`npm run build`
- 输出目录：`dist`
- Node 依赖安装：`npm install`

如果使用 GitHub Pages，需要注意 Vite 的 `base` 路径配置；如果希望少折腾，优先使用 Vercel 或 Netlify。

## 玩法说明

- 左右滑动：切换跑道。
- 上滑：跳跃，躲避低障碍。
- 下滑：滑行，躲避高障碍。
- 每局 3 点生命值，撞到未躲开的障碍物扣 1 点。
- 生命值归零后进入结算界面。

## 项目文档

- 版本计划：[docs/plans/2026-05-13-public-mobile-playtest-roadmap.md](docs/plans/2026-05-13-public-mobile-playtest-roadmap.md)
- 主题关卡与生命值设计：[docs/superpowers/specs/2026-05-13-themed-levels-health-design.md](docs/superpowers/specs/2026-05-13-themed-levels-health-design.md)
- 角色设计：[docs/character-design.md](docs/character-design.md)

## 下一步建议

1. 初始化 Git 仓库。
2. 添加 `.gitignore`，排除 `node_modules`、`dist` 和临时文件。
3. 推送到 GitHub。
4. 使用 Vercel 或 Netlify 部署试玩链接。
5. 发给少量朋友和孩子试玩，收集反馈后再决定是否进入微信小游戏/小程序路线。
