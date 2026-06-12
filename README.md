# ClaudeDance

Claude Code 的桌面 GUI 客户端。左侧按项目维度组织会话历史，右侧对话，右侧抽屉做笔记/TODO。

底层通过 `@anthropic-ai/claude-agent-sdk` 驱动系统安装的 `claude` CLI，所有工具调用、子 agent、MCP、hook 都由 Claude Code 自己跑。GUI 层提供权限审批 UI、模型切换、文件回退（rewind）、子 agent 可视化、MCP 服务器管理等增强能力。

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

## 架构

```
electron/              主进程（Node）
  main.ts              app 生命周期、窗口、启动时校验 claude 二进制
  ipc.ts               IPC handler 注册（会话、聊天、权限、模型、MCP、notes）
  sdk-adapter.ts       Agent SDK 适配层（核心）：query/streaming/权限/模型/rewind/MCP
  ipc-utils.ts         IPC 事件发送辅助
  project-scanner.ts   扫描 ~/.claude/projects/
  app-data.ts          读写 ~/.claudedance/projects.json
  notes-store.ts       notes 文件读写
  shell-path.ts        打包后恢复用户 shell PATH
  preload.ts           contextBridge API 暴露

src/                   渲染进程（React）
  App.tsx              路由 + 视图切换
  components/          UI 组件
    ChatView.tsx       对话视图（含子 agent 嵌套、权限弹窗、rewind 按钮）
    Composer.tsx       输入框 + 斜杠命令补全 + 模型选择
    PermissionDialog   工具调用权限审批
    ModelSelector      运行时模型切换
    SettingsPage       设置页（外观、归档、MCP 服务器状态）
    Sidebar.tsx        项目列表 + 会话列表
  store/               Zustand 状态
    chats.ts           聊天会话生命周期（开始、发送、停止、权限、rewind）
    events.ts          事件流存储
    sessions.ts        会话选择
    projects.ts        项目列表
    notes.ts           笔记状态
  lib/                 工具函数
    derive.ts          RawEvent[] → DerivedMessage[]（含子 agent 信息提取）
    slash-commands.ts  斜杠命令过滤（数据来自 SDK supportedCommands）
    local-commands.ts  本地命令处理（/help, /skills, /status, /config）
    api.ts             preload API 类型安全包装

shared/                主进程 + 渲染进程共用类型
tests/                 Vitest 测试
build/                 app icon 资源
docs/                  SDK 参考文档
```

## SDK 集成要点

- **底层驱动**：`@anthropic-ai/claude-agent-sdk` 的 `query()` 函数，使用 `pathToClaudeCodeExecutable` 指向系统 `claude` 二进制
- **多轮对话**：每次用户发消息调用新的 `query()`，通过 `resume: sessionId` 恢复会话上下文
- **流式输出**：SDK 的 `stream_event`（`content_block_start` / `content_block_delta`）在主进程累积为合成 assistant 事件
- **子进程预热**：`startup()` → `WarmQuery` 缓存，首次 query 更快
- **权限审批**：`canUseTool` 回调 → IPC → 渲染端弹窗 → Promise 回调
- **模型切换**：`q.supportedModels()` 获取列表，`q.setModel()` 运行时切换
- **斜杠命令**：`q.supportedCommands()` 获取完整命令+描述（含 skills、plugins）
- **文件回退**：`enableFileCheckpointing: true` + `q.rewindFiles(userMessageId)`
- **子 agent 可视化**：`forwardSubagentText: true`，按 `parent_tool_use_id` 嵌套展示
- **MCP 状态**：`q.mcpServerStatus()` 获取连接状态、工具列表
- **ESM 打包**：SDK 是纯 ESM，通过 `ssr.noExternal` 让 electron-vite 打包为 CJS

## 快捷键

| 快捷键 | 说明 |
|--------|------|
| `Enter` | 发送消息 |
| `Shift + Enter` | 换行 |
| `⌘ + Shift + Enter` | 把输入剪切到 Notes |

## 数据存储

- 会话历史：通过 SDK `listSessions()` / `getSessionMessages()` 读取（底层同 `~/.claude/projects/` 的 JSONL 文件）
- 项目配置：`~/.claudedance/projects.json`
- Notes：`~/.claudedance/notes/sessions/<sessionId>.md` 和 `~/.claudedance/notes/projects/<encoded-cwd>.md`
