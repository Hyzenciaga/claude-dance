# ClaudeDance

Claude Code 的桌面 GUI 客户端。左侧按项目维度组织会话历史，右侧对话，右侧抽屉做笔记/TODO。

底层不自己实现 agent——spawn `claude` CLI 的 headless stream-json 模式，所有工具调用、子 agent、MCP、hook 都由 Claude Code 自己跑。

## 前置依赖

- **Node.js** ≥ 18（推荐 22+）
- **npm**（随 Node 自带）
- **Claude Code CLI**（`claude` 命令在 PATH 上）—— [安装指南](https://docs.anthropic.com/en/docs/claude-code)

## 安装

```bash
git clone <repo-url> ClaudeDance
cd ClaudeDance
npm install
```

## 开发

```bash
npm run dev
```

Electron 窗口会自动打开，Vite HMR 热更新。改前端代码保存即刷新，改主进程代码需要重启。

## 常用命令

| 命令 | 说明 |
|------|------|
| `npm run dev` | 启动开发模式（Electron + Vite HMR） |
| `npm run build` | 构建生产版本到 `out/` |
| `npm start` | 预览已构建的生产版本 |
| `npm test` | 跑所有测试（Vitest） |
| `npm run test:watch` | 测试 watch 模式 |
| `npm run typecheck` | TypeScript 类型检查 |
| `npm run dist` | 构建 + 打包 macOS dmg（arm64 + x64） |
| `npm run dist:dir` | 构建 + 打包为 .app 目录（不生成 dmg，更快） |

## 打包

```bash
# 完整 dmg（需要能访问 GitHub 下载 electron 二进制）
npm run dist

# 只出 .app（不需要额外下载，适合内网）
npm run dist:dir

# 只打 arm64
npm run dist -- --mac --arm64
```

产出在 `release/` 目录：
- `ClaudeDance-x.x.x-arm64.dmg` — Apple Silicon
- `ClaudeDance-x.x.x.dmg` — Intel

未签名。首次打开：右键 app → 打开 → 打开。

## 项目结构

```
electron/          主进程（Node）
  main.ts          app 生命周期、窗口
  ipc.ts           IPC handler 注册
  claude-process.ts  spawn claude 子进程
  project-scanner.ts 扫描 ~/.claude/projects/
  session-reader.ts  读 jsonl 会话文件
  notes-store.ts     notes 文件读写
  shell-path.ts      打包后恢复用户 shell PATH

src/               渲染进程（React）
  App.tsx
  components/      UI 组件
  store/           Zustand 状态
  lib/             工具函数

shared/            主进程 + 渲染进程共用类型
tests/             Vitest 测试
build/             app icon 资源
```

## 快捷键

| 快捷键 | 说明 |
|--------|------|
| `Enter` | 发送消息 |
| `Shift + Enter` | 换行 |
| `⌘ + Shift + Enter` | 把输入剪切到 Notes |

## 数据存储

- 会话历史：读 `~/.claude/projects/<encoded-cwd>/<uuid>.jsonl`（Claude Code 原生格式，只读）
- 项目配置：`~/.claudedance/projects.json`
- Notes：`~/.claudedance/notes/sessions/<sessionId>.md` 和 `~/.claudedance/notes/projects/<encoded-cwd>.md`
