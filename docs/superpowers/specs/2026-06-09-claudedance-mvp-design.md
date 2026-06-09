# ClaudeDance MVP — Design Spec

**Date:** 2026-06-09
**Status:** Draft, pending review

## 1. 目标

构建一个 Claude Code 的桌面 GUI 客户端。形态参考 Codex 客户端：左侧按"项目"维度组织会话历史，右侧是当前会话的对话区。

**核心定位（关键决策）：** 这是一个**纯 UI 壳子**。所有 agent 行为（工具调用、子 agent、permission、MCP、hook、context 管理、1M context、auto memory、plan mode……）全部由 `claude` CLI 自己跑。客户端只做两件事：

1. 通过 `claude --print --output-format stream-json --input-format stream-json` 向 CLI 喂用户输入，渲染回来的 JSON 事件流
2. 读取 `~/.claude/projects/<encoded-cwd>/<uuid>.jsonl` 中的会话历史，按项目维度展示

**不做的事（明确划界）：**

- 不自己实现 agent loop / 工具循环 / 子 agent 调度（这些是 CLI 的）
- 不实现自己的 permission 系统、MCP 管理、hook 系统（CLI 自己处理）
- 不暴露任何启动参数 UI（模型、permission mode、MCP、system prompt 等全用 CLI 默认）
- 不做双向 sync（用户表态："这个客户端做好我就不用 TUI 了"，单向读取即可）
- 不实现 rewind / fork / 自定义 title（未来扩展，MVP 不含）

## 2. 用户故事

- **打开 app**：左侧立即看到我电脑上所有已有 `claude` 会话的项目（按目录分组），点任一会话进入只读浏览模式
- **开新会话**：点左上"New Chat" → 进入空白对话页 → 输入框下方选项目目录（默认选一个），输入第一条消息回车 → spawn `claude`，开始对话
- **项目内开新会话**：左侧每个项目 hover 显示"+"按钮，点击直接在该项目下开新对话
- **找旧会话**：会话列表按时间分组（今天/昨天/本周/更早），顶部搜索框按内容/title 过滤
- **续聊旧会话**：点旧会话进入查看 → 输入框可用 → 输入消息后 `claude --resume <uuid>` 续上

## 3. 架构

```
┌────────────────────────────────────────────────────────┐
│  Electron Main Process (Node)                          │
│  ┌──────────────────────────────────────────────────┐  │
│  │  ProjectScanner  — 扫 ~/.claude/projects/        │  │
│  │  SessionReader   — 读 jsonl，解析为 events       │  │
│  │  ClaudeProcess   — spawn claude 子进程，stdio    │  │
│  │  IPC Bridge      — 与 renderer 通信              │  │
│  └──────────────────────────────────────────────────┘  │
└────────────────────────────────────────────────────────┘
                          ↕  IPC
┌────────────────────────────────────────────────────────┐
│  Electron Renderer Process (React)                     │
│  ┌──────────────────────────────────────────────────┐  │
│  │  Sidebar         — 项目列表 + 会话列表 + 搜索    │  │
│  │  ChatView        — 消息流渲染（A 阶段渲染器）    │  │
│  │  Composer        — 输入框 + 目录选择器           │  │
│  │  EventStore      — 全量事件存储（不丢信息）       │  │
│  └──────────────────────────────────────────────────┘  │
└────────────────────────────────────────────────────────┘
```

### 3.1 技术栈

- **Electron** + **React** + **TypeScript**
- **Vite** 构建
- **UI 库**：shadcn/ui（基于 Radix）+ Tailwind
- **状态**：Zustand（轻量，够用）
- **IPC**：Electron 原生 `ipcMain` / `ipcRenderer` + contextBridge
- **包管理**：pnpm

### 3.2 主进程职责

- **进程管理**：spawn `claude`，管理 stdin/stdout/stderr，监听退出
- **文件系统**：扫 `~/.claude/projects/`、读单个 jsonl
- **IPC 接口**（renderer 调用 main）：
  - `projects.list()` → 返回所有项目（含会话计数、最近活跃时间）
  - `project.add(path)` → 手动添加项目（写入 app 自己的项目记录）
  - `project.hide(path)` → 隐藏项目
  - `sessions.list(projectPath)` → 返回该项目的会话列表（含 title、时间）
  - `session.read(projectPath, sessionId)` → 返回该会话的全量事件
  - `chat.start({ cwd, sessionId?, initialMessage })` → spawn 进程，返回 channel id
  - `chat.sendMessage(channelId, text)` → 向 stdin 写入
  - `chat.stop(channelId)` → 杀进程
- **IPC 事件**（main 推送给 renderer）：
  - `chat.event` → 每收到一行 JSON 都推送
  - `chat.exit` → 进程退出
  - `chat.error` → 异常

### 3.3 Renderer 职责

- **路由**：单页应用，状态驱动
- **EventStore**：按 sessionId 存全量原始事件（数组），不做合并/转换
- **渲染层**：从 EventStore 派生视图模型，A 阶段只关心两种事件类型

### 3.4 启动 claude 的命令

```bash
claude --print \
       --output-format stream-json \
       --input-format stream-json \
       --include-partial-messages \
       --include-hook-events \
       --verbose
# 新会话：不加 --session-id（让 CLI 自己生成 UUID）
# 续会话：--resume <uuid>
```

**关键参数说明：**

- `--include-partial-messages`：流式输出。MVP 不渲染打字效果，但事件全存，为未来 C 阶段准备
- `--include-hook-events`：包含 hook 生命周期。同上，存而不渲染
- `--verbose`：stream-json 模式需要 verbose 才能输出所有事件
- 不指定 `--model`、`--permission-mode`、`--mcp-config`：完全使用用户的 Claude Code 默认配置（和直接敲 `claude` 一致）

**cwd 处理：** spawn 时通过 Node 的 `child_process.spawn` 第二参数的 `cwd` 字段指定。"不选目录"分支用 `os.homedir()`。

## 4. 数据模型

### 4.1 Project

```ts
type Project = {
  path: string                  // 绝对路径，如 /Users/steve/CodeFiles/ClaudeCode/ClaudeDance
  encodedPath: string           // ~/.claude/projects/ 下的目录名
  exists: boolean               // 真实目录是否还在
  sessionCount: number
  lastActiveAt: number          // 最近会话的 timestamp
  source: 'scanned' | 'manual'  // 自动扫到的 vs 手动添加的
  hidden: boolean
}
```

**项目发现策略（混合）：**

1. 扫 `~/.claude/projects/` 反编码每个子目录名（`-` → `/`）得到 cwd
2. 加上用户通过 `project.add()` 手动添加的目录
3. 用户标记 `hidden: true` 的不展示
4. 应用自己的项目元数据（hidden、manual 添加等）存在 `~/.claudedance/projects.json`

### 4.2 Session

```ts
type SessionSummary = {
  id: string                    // UUID
  projectPath: string
  jsonlPath: string             // 完整路径
  title: string                 // 最后一条 user message 前 ~60 字（MVP 暂用）
  firstMessageAt: number
  lastMessageAt: number
  messageCount: number          // user + assistant 数量，不含 hook/attachment
}
```

**title 来源（MVP）：** 倒序扫 jsonl 找最后一条 `type: "user"` 的 message，取其文本前 60 字。未来扩展：支持 `claude -n` 设置的 display name（CLI 会把 name 写入 jsonl，待确认字段名），用户也可在 GUI 中手动重命名。

### 4.3 Event

```ts
type Event = {
  raw: object                   // 原始 JSON，一字不改
  // 派生字段，仅为快速渲染：
  kind: string                  // raw.type
  sessionId?: string
  timestamp?: string
}
```

**核心原则：原始事件永不丢失。** 任何渲染层逻辑都从 `raw` 派生。这是未来 C 阶段无需返工的基础。

## 5. UI 布局

```
┌─────────────────────────────────────────────────────────────┐
│ ☰ ClaudeDance                                          ⚙   │
├──────────────────┬──────────────────────────────────────────┤
│ + New Chat       │                                          │
│ 🔍 Search...     │   ChatView                               │
│                  │   (message stream)                       │
│ ▼ ClaudeDance  + │                                          │
│   • Build MVP    │                                          │
│   • Spec review  │                                          │
│ ▼ chatCC       + │                                          │
│   • Old chat 1   │                                          │
│ ▼ oh-my-evals  + │                                          │
│   ... 25 sessions│                                          │
│                  │                                          │
│                  ├──────────────────────────────────────────┤
│                  │ [📁 /Users/steve/.../ClaudeDance  ▾]    │
│                  │ ┌────────────────────────────────────┐  │
│                  │ │ Type a message...              ↵   │  │
│                  │ └────────────────────────────────────┘  │
└──────────────────┴──────────────────────────────────────────┘
```

**Sidebar 行为：**

- 顶部固定：New Chat 按钮 + 搜索框
- 项目列表：默认展开当前活跃项目，其他折叠
- 每个项目 hover 时右侧出现 `+` 小按钮（新会话直接选该项目）
- 项目右键菜单：Hide / Reveal in Finder
- 会话列表按时间分组：今天 / 昨天 / 本周 / 更早，每组内时间倒序

**ChatView 渲染（A 阶段）：**

- `assistant` text content blocks → 气泡（左对齐）
- `user` text → 气泡（右对齐）
- `tool_use` → 一行折叠卡片："🔧 Used Bash" / "🔧 Used Edit"，点击展开看到 input
- `tool_result` → 与对应 `tool_use_id` 关联，折叠显示
- 其他 type（hook、attachment、system init、result、thinking、partial）→ 完全不渲染（但事件存进 EventStore）

**Composer 行为：**

- 进入空白新对话页：目录选择器默认选**最近活跃的项目**（按 `lastActiveAt` 倒序第一个）
- 目录选择器下拉：所有项目 + "Browse..." + "No directory"
- 点击进入旧会话：目录选择器隐藏（用会话原始 cwd），输入消息后用 `--resume` 续上
- Cmd+Enter / Enter 发送（待定，参考 Codex）

## 6. 事件流处理

### 6.1 启动新会话流程

1. 用户在 Composer 输入第一条消息 + 选好 cwd 后点发送
2. Renderer → IPC `chat.start({ cwd, initialMessage })`
3. Main spawn `claude` 子进程（参数见 3.4），cwd 设为选定目录
4. Main 立即向 stdin 写第一条消息（格式：`{"type":"user","message":{"role":"user","content":"..."}}\n`）
5. Main 按行读 stdout，每行 `JSON.parse` 后通过 `chat.event` IPC 推给 renderer
6. Renderer 把 event 推入 EventStore，触发 ChatView 重渲染
7. 从第一条 `system.init` 事件中拿到 `session_id`，记下来作为这个 channel 的会话 ID

**stdin 消息格式确认（实现时验证）：** Claude Code 的 `--input-format stream-json` 期望的具体格式以 CLI 实际行为为准。如果不是上面那样，实现时调整。

### 6.2 续聊旧会话流程

1. 用户点旧会话 → Renderer 读 jsonl 全量加载到 EventStore
2. 用户输入消息发送 → `chat.start({ cwd, sessionId: <existing>, initialMessage })`
3. Main spawn `claude --resume <sessionId> ...`（其他参数同 3.4）
4. 后续同新会话

### 6.3 进程生命周期

- 一个 ChatView 对应一个 spawn 出的子进程
- 切换到另一会话：不杀当前进程（用户可能想回来），但停止接收事件 UI 更新（事件继续存）
- MVP 上限：最多保留 3 个活跃子进程，超出 LRU 杀掉
- 关闭 app：所有子进程 SIGTERM

## 7. 错误处理

- **`claude` 进程崩溃** → ChatView 顶部显示红色 banner："Claude exited unexpectedly (code N)"，提供"Retry"按钮
- **jsonl 文件损坏**（某行不是合法 JSON）→ 跳过该行，console.warn 记录，不阻断会话加载
- **项目目录被删** → 项目列表中灰显，点击提示"Directory no longer exists"
- **stdin 写入失败** → ChatView 显示 toast 错误
- **`claude` 二进制不存在** → app 启动时检查，缺失则弹窗指引安装

## 8. 不做（明确 out of scope）

- Rewind / fork session
- 自定义 title（用户重命名）
- 双向 sync（fs.watch jsonl 实时更新）
- 启动参数 UI（模型、permission mode、MCP 等）
- 中文/多语言（先中英文都行的硬编码 label）
- 自动更新、崩溃上报、遥测
- Windows / Linux 打包测试（开发期只测 macOS，但不写 macOS-only API）
- 工具调用的专门渲染器（Bash 输出高亮、Edit diff、Read 文件预览）—— 留给 C 阶段
- 流式打字效果 —— 留给 C 阶段
- Hook 事件可视化 —— 留给 C 阶段
- 图片/PDF 附件预览 —— 留给 C 阶段

## 9. 成功标准

MVP 完成的判定：

1. 打开 app 能看到本机所有 `claude` 项目和会话历史（约 1187 个会话能加载）
2. 能开新会话，输入消息后能看到 assistant 的文字回复
3. 能看到工具调用（折叠成"🔧 Used X"）
4. 能续聊任一旧会话，回复正确续到原会话的 jsonl
5. 在 GUI 里聊完，关掉 app，终端 `claude -c` 能续上同一会话
6. 项目分组 + 时间分组 + 搜索都工作
7. 切换会话不丢前一会话的事件

## 10. 后续扩展路径（信息性，不在 MVP 范围）

- **C 阶段渲染**：写工具专门的渲染组件（Bash/Edit/Read）、启用打字效果、hook 事件可视化
- **双向 sync**：加 chokidar 监听 `~/.claude/projects/`，jsonl 增量读
- **rewind/fork**：UI 上让用户点某条消息"分支"，截断 jsonl + `--fork-session` 重 spawn
- **自定义 title**：支持 `claude -n` 的 display name + 手动重命名
- **启动参数 UI**：会话设置抽屉，暴露 model、permission mode 等
- **多 OS 打包**：Windows / Linux

## 11. 项目结构（初步）

```
ClaudeDance/
├── package.json
├── electron/                    # 主进程
│   ├── main.ts
│   ├── ipc.ts
│   ├── claude-process.ts
│   ├── project-scanner.ts
│   └── session-reader.ts
├── src/                         # Renderer
│   ├── main.tsx
│   ├── App.tsx
│   ├── components/
│   │   ├── Sidebar.tsx
│   │   ├── ChatView.tsx
│   │   ├── Composer.tsx
│   │   └── messages/
│   ├── store/
│   │   ├── projects.ts
│   │   ├── sessions.ts
│   │   └── events.ts
│   └── lib/
├── shared/                      # main + renderer 共用类型
│   └── types.ts
├── docs/superpowers/
│   ├── specs/
│   └── plans/
└── .gitignore                   # 含 .superpowers/, node_modules, dist
```
