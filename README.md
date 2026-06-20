# 网页版《我的世界》 · Minecraft Web

一个基于 [Three.js](https://threejs.org/) 的浏览器体素沙盒游戏（Minecraft-like）。
纯静态站点、无需任何构建步骤，打开即玩，并通过 GitHub Actions 自动部署到 GitHub Pages。

![tech](https://img.shields.io/badge/Three.js-r160-blue) ![type](https://img.shields.io/badge/build-none%20(static)-success)

## 在线游玩

仓库开启 GitHub Pages（Source 选择 **GitHub Actions**）后，推送到 `master`/`main`
会自动构建发布，地址形如：

```
https://<用户名>.github.io/<仓库名>/
```

## 玩法 / 操作

| 操作 | 按键 |
| --- | --- |
| 移动 | `W` `A` `S` `D` |
| 视角 | 鼠标（点击画面锁定指针） |
| 跳跃 / 飞行上升 | `空格` |
| 飞行下降 | `Shift` |
| 破坏方块 | 鼠标左键 |
| 放置方块 | 鼠标右键 |
| 选择方块 | 数字键 `1`–`9` / 鼠标滚轮 |
| 切换飞行模式 | `F` |
| 释放鼠标 | `Esc` |

## 功能特性

- 基于 Perlin/fBm 噪声的程序化地形（山丘、海洋、沙滩、树木）
- 区块化世界，随玩家移动动态加载/卸载
- 仅渲染暴露面的区块网格（面剔除），半透明的水 / 树叶 / 玻璃
- AABB 物理碰撞、重力、跳跃，外加创造式飞行模式
- 体素射线拾取（DDA），破坏与放置方块
- 程序化生成的像素风方块贴图（无二进制资源文件）
- 快捷栏 UI、准星、坐标 / FPS HUD

## 本地运行

游戏是静态站点，用任意静态服务器即可（因为使用了 ES Module，需经 HTTP 提供，不能直接 `file://` 打开）：

```bash
# 任选其一
python3 -m http.server 8099
# 然后浏览器打开 http://localhost:8099/
```

## 目录结构

```
index.html          页面骨架与 HUD
styles.css          UI / HUD 样式
js/
  main.js           装配渲染循环、区块流式加载、破坏/放置
  World.js          世界模型：区块存储与地形生成
  ChunkMesher.js    区块网格构建（面剔除）
  Player.js         玩家物理：碰撞 / 重力 / 跳跃 / 飞行
  Controls.js       第一人称输入（指针锁定 + 键鼠）
  blocks.js         方块定义与程序化贴图
  noise.js          Perlin / fBm 噪声
lib/
  three.module.js   内置的 Three.js（r160）
.github/workflows/
  deploy.yml        GitHub Pages 自动部署
```

## 部署说明

`/.github/workflows/deploy.yml` 使用官方 `configure-pages` / `upload-pages-artifact` /
`deploy-pages` 动作，将仓库根目录作为静态站点发布。首次使用请在仓库
**Settings → Pages → Build and deployment → Source** 中选择 **GitHub Actions**。

## 许可证

MIT
