# ClaudeDance MVP Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a macOS desktop GUI client (ClaudeDance) that wraps the `claude` CLI in headless stream-json mode, organizing existing `~/.claude/projects/*.jsonl` history by project on a left sidebar and providing a chat pane on the right.

**Architecture:** Electron + React + TypeScript. Main process spawns `claude --print --output-format stream-json --input-format stream-json --include-partial-messages --include-hook-events --verbose` per chat and forwards every JSON event over IPC to the renderer; the renderer stores raw events untouched in a Zustand store and renders the MVP "A-tier" view (user text, assistant text, collapsed tool_use cards). Project & session metadata is derived by scanning `~/.claude/projects/` on launch — no fs.watch, no double-direction sync.

**Tech Stack:** Electron 32, React 18, TypeScript 5, Vite 5, electron-vite, Tailwind 3, shadcn/ui (Radix), Zustand 4, Vitest, npm.

**Reference spec:** `docs/superpowers/specs/2026-06-09-claudedance-mvp-design.md`

---

## File Structure

This plan builds the app from an empty directory. Files are grouped by responsibility, not by layer.

**Shared (used by both main and renderer):**
- `shared/types.ts` — `Project`, `SessionSummary`, `Event`, `IpcRequest`/`IpcEvent` discriminated unions
- `shared/encoding.ts` — `encodeCwd()` / `decodeCwd()` for `~/.claude/projects/` directory names

**Main process (Node):**
- `electron/main.ts` — app lifecycle, BrowserWindow, IPC wiring
- `electron/preload.ts` — contextBridge exposing `window.api.*`
- `electron/ipc.ts` — central `ipcMain.handle` + `webContents.send` registry
- `electron/project-scanner.ts` — list projects from `~/.claude/projects/` + user-added overrides
- `electron/session-reader.ts` — list sessions per project, read full event stream from one jsonl
- `electron/claude-process.ts` — spawn/manage `claude` child processes, parse stdout line-by-line, push events
- `electron/app-data.ts` — read/write `~/.claudedance/projects.json` (hidden/manual)

**Renderer (React):**
- `src/main.tsx` — React root
- `src/App.tsx` — top-level layout (Sidebar + active route)
- `src/components/Sidebar.tsx` — search box, project tree, "New Chat" button
- `src/components/ProjectItem.tsx` — collapsible project row with "+" hover button
- `src/components/SessionItem.tsx` — single session row
- `src/components/ChatView.tsx` — message stream container
- `src/components/Composer.tsx` — input box + cwd picker
- `src/components/messages/UserMessage.tsx`
- `src/components/messages/AssistantMessage.tsx`
- `src/components/messages/ToolUseCard.tsx`
- `src/store/projects.ts` — Zustand: project list, selected project
- `src/store/sessions.ts` — Zustand: session lists per project, selected session
- `src/store/events.ts` — Zustand: events keyed by sessionId (full raw history)
- `src/store/chats.ts` — Zustand: active claude child processes (channelId → status, sessionId)
- `src/lib/api.ts` — typed wrappers around `window.api.*`
- `src/lib/derive.ts` — pure functions deriving view model from raw events
- `src/lib/time.ts` — relative time + grouping helpers (Today / Yesterday / This Week / Earlier)
- `src/index.css` — Tailwind directives + shadcn theme tokens

**Tests:**
- `tests/encoding.test.ts`
- `tests/session-reader.test.ts`
- `tests/project-scanner.test.ts`
- `tests/derive.test.ts`
- `tests/time.test.ts`

**Config:**
- `package.json`, `tsconfig.json`, `tsconfig.node.json`, `electron.vite.config.ts`, `tailwind.config.js`, `postcss.config.js`, `vitest.config.ts`, `.gitignore`, `index.html`

---

## Task 1: Project scaffold (Vite + Electron + TypeScript)

**Files:**
- Create: `package.json`, `tsconfig.json`, `tsconfig.node.json`, `electron.vite.config.ts`, `index.html`, `.gitignore`, `src/main.tsx`, `src/App.tsx`, `src/index.css`, `electron/main.ts`, `electron/preload.ts`

- [ ] **Step 1: Create `package.json`**

```json
{
  "name": "claudedance",
  "version": "0.0.1",
  "description": "Claude Code desktop client",
  "main": "out/main/main.js",
  "scripts": {
    "dev": "electron-vite dev",
    "build": "electron-vite build",
    "start": "electron-vite preview",
    "test": "vitest run",
    "test:watch": "vitest",
    "typecheck": "tsc --noEmit -p tsconfig.json && tsc --noEmit -p tsconfig.node.json"
  },
  "devDependencies": {
    "@types/node": "^22.5.0",
    "@types/react": "^18.3.3",
    "@types/react-dom": "^18.3.0",
    "@vitejs/plugin-react": "^4.3.1",
    "autoprefixer": "^10.4.20",
    "electron": "^32.0.0",
    "electron-vite": "^2.3.0",
    "postcss": "^8.4.41",
    "tailwindcss": "^3.4.10",
    "typescript": "^5.5.4",
    "vite": "^5.4.2",
    "vitest": "^2.0.5"
  },
  "dependencies": {
    "react": "^18.3.1",
    "react-dom": "^18.3.1",
    "zustand": "^4.5.5"
  }
}
```

- [ ] **Step 2: Create `tsconfig.json` (renderer)**

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "lib": ["ES2022", "DOM", "DOM.Iterable"],
    "module": "ESNext",
    "moduleResolution": "Bundler",
    "jsx": "react-jsx",
    "strict": true,
    "noUnusedLocals": true,
    "noUnusedParameters": true,
    "noFallthroughCasesInSwitch": true,
    "skipLibCheck": true,
    "isolatedModules": true,
    "esModuleInterop": true,
    "resolveJsonModule": true,
    "baseUrl": ".",
    "paths": {
      "@/*": ["src/*"],
      "@shared/*": ["shared/*"]
    }
  },
  "include": ["src", "shared"],
  "references": [{ "path": "./tsconfig.node.json" }]
}
```

- [ ] **Step 3: Create `tsconfig.node.json` (main + tests)**

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "lib": ["ES2022"],
    "module": "ESNext",
    "moduleResolution": "Bundler",
    "strict": true,
    "noUnusedLocals": true,
    "noUnusedParameters": true,
    "skipLibCheck": true,
    "isolatedModules": true,
    "esModuleInterop": true,
    "resolveJsonModule": true,
    "types": ["node"],
    "baseUrl": ".",
    "paths": {
      "@shared/*": ["shared/*"]
    }
  },
  "include": ["electron", "shared", "tests", "electron.vite.config.ts", "vitest.config.ts"]
}
```

- [ ] **Step 4: Create `electron.vite.config.ts`**

```ts
import { defineConfig } from 'electron-vite'
import react from '@vitejs/plugin-react'
import { resolve } from 'node:path'

export default defineConfig({
  main: {
    build: {
      outDir: 'out/main',
      lib: { entry: 'electron/main.ts' },
    },
    resolve: {
      alias: { '@shared': resolve(__dirname, 'shared') },
    },
  },
  preload: {
    build: {
      outDir: 'out/preload',
      lib: { entry: 'electron/preload.ts' },
    },
    resolve: {
      alias: { '@shared': resolve(__dirname, 'shared') },
    },
  },
  renderer: {
    root: '.',
    build: {
      outDir: 'out/renderer',
      rollupOptions: { input: resolve(__dirname, 'index.html') },
    },
    plugins: [react()],
    resolve: {
      alias: {
        '@': resolve(__dirname, 'src'),
        '@shared': resolve(__dirname, 'shared'),
      },
    },
  },
})
```

- [ ] **Step 5: Create `index.html`**

```html
<!DOCTYPE html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <title>ClaudeDance</title>
  </head>
  <body>
    <div id="root"></div>
    <script type="module" src="/src/main.tsx"></script>
  </body>
</html>
```

- [ ] **Step 6: Create `.gitignore`**

```
node_modules/
out/
dist/
.DS_Store
.superpowers/
*.log
.vite/
```

- [ ] **Step 7: Create `src/main.tsx`**

```tsx
import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import App from './App'
import './index.css'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
```

- [ ] **Step 8: Create `src/App.tsx` (placeholder, replaced in later tasks)**

```tsx
export default function App() {
  return <div style={{ padding: 24 }}>ClaudeDance — scaffold</div>
}
```

- [ ] **Step 9: Create `src/index.css` (placeholder, Tailwind added in Task 4)**

```css
body { margin: 0; font-family: -apple-system, system-ui, sans-serif; }
```

- [ ] **Step 10: Create minimal `electron/main.ts`**

```ts
import { app, BrowserWindow } from 'electron'
import { resolve } from 'node:path'

function createWindow() {
  const win = new BrowserWindow({
    width: 1200,
    height: 800,
    webPreferences: {
      preload: resolve(__dirname, '../preload/preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
    },
  })
  const devUrl = process.env['ELECTRON_RENDERER_URL']
  if (devUrl) {
    win.loadURL(devUrl)
  } else {
    win.loadFile(resolve(__dirname, '../renderer/index.html'))
  }
}

app.whenReady().then(() => {
  createWindow()
  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow()
  })
})

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit()
})
```

- [ ] **Step 11: Create minimal `electron/preload.ts`**

```ts
// Populated in Task 5
export {}
```

- [ ] **Step 12: Install deps and verify dev start**

```bash
cd /Users/steve/CodeFiles/ClaudeCode/ClaudeDance && npm install
```

Expected: install succeeds, `node_modules/` populated.

```bash
npm run typecheck
```

Expected: no errors.

```bash
npm run dev
```

Expected: Electron window opens showing "ClaudeDance — scaffold". Close the window to stop.

- [ ] **Step 13: Commit**

```bash
cd /Users/steve/CodeFiles/ClaudeCode/ClaudeDance && git init && git add . && git commit -m "chore: scaffold electron + react + typescript"
```

---

## Task 2: Shared types and cwd encoding

**Files:**
- Create: `shared/types.ts`, `shared/encoding.ts`, `tests/encoding.test.ts`, `vitest.config.ts`

- [ ] **Step 1: Create `vitest.config.ts`**

```ts
import { defineConfig } from 'vitest/config'
import { resolve } from 'node:path'

export default defineConfig({
  resolve: {
    alias: {
      '@shared': resolve(__dirname, 'shared'),
      '@': resolve(__dirname, 'src'),
    },
  },
  test: {
    environment: 'node',
    include: ['tests/**/*.test.ts'],
  },
})
```

- [ ] **Step 2: Write failing test `tests/encoding.test.ts`**

```ts
import { describe, expect, it } from 'vitest'
import { encodeCwd, decodeCwd } from '@shared/encoding'

describe('encodeCwd', () => {
  it('replaces / with -', () => {
    expect(encodeCwd('/Users/steve/CodeFiles/ClaudeCode/ClaudeDance')).toBe(
      '-Users-steve-CodeFiles-ClaudeCode-ClaudeDance',
    )
  })
  it('handles trailing slash', () => {
    expect(encodeCwd('/Users/steve/')).toBe('-Users-steve')
  })
  it('handles root', () => {
    expect(encodeCwd('/')).toBe('-')
  })
})

describe('decodeCwd', () => {
  it('replaces - with /', () => {
    expect(decodeCwd('-Users-steve-CodeFiles-ClaudeCode-ClaudeDance')).toBe(
      '/Users/steve/CodeFiles/ClaudeCode/ClaudeDance',
    )
  })
  it('round-trips', () => {
    const cwd = '/Users/steve/CodeFiles/AliCode/oh-my-evals'
    expect(decodeCwd(encodeCwd(cwd))).toBe(cwd)
  })
})
```

- [ ] **Step 3: Run test, confirm failure**

```bash
npm test -- encoding
```

Expected: FAIL with "Cannot find module '@shared/encoding'".

- [ ] **Step 4: Create `shared/encoding.ts`**

```ts
export function encodeCwd(cwd: string): string {
  const trimmed = cwd.length > 1 && cwd.endsWith('/') ? cwd.slice(0, -1) : cwd
  return trimmed.replace(/\//g, '-')
}

export function decodeCwd(encoded: string): string {
  return encoded.replace(/-/g, '/')
}
```

- [ ] **Step 5: Run test, confirm pass**

```bash
npm test -- encoding
```

Expected: PASS (5 tests).

- [ ] **Step 6: Create `shared/types.ts`**

```ts
export type Project = {
  path: string
  encodedPath: string
  exists: boolean
  sessionCount: number
  lastActiveAt: number
  source: 'scanned' | 'manual'
  hidden: boolean
}

export type SessionSummary = {
  id: string
  projectPath: string
  jsonlPath: string
  title: string
  firstMessageAt: number
  lastMessageAt: number
  messageCount: number
}

export type RawEvent = {
  raw: Record<string, unknown>
  kind: string
  sessionId?: string
  timestamp?: string
}

export type ChannelId = string

export type ChatStartRequest = {
  cwd: string
  sessionId?: string
  initialMessage: string
}

export type ChatStartResponse = {
  channelId: ChannelId
}

export type IpcChatEvent =
  | { kind: 'event'; channelId: ChannelId; event: RawEvent }
  | { kind: 'exit'; channelId: ChannelId; code: number | null }
  | { kind: 'error'; channelId: ChannelId; message: string }
```

- [ ] **Step 7: Verify typecheck**

```bash
npm run typecheck
```

Expected: no errors.

- [ ] **Step 8: Commit**

```bash
git add -A && git commit -m "feat: add shared types and cwd encoding with tests"
```

---

## Task 3: Project scanner

**Files:**
- Create: `electron/app-data.ts`, `electron/project-scanner.ts`, `tests/project-scanner.test.ts`

- [ ] **Step 1: Write failing test `tests/project-scanner.test.ts`**

```ts
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { mkdtempSync, rmSync, mkdirSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { scanProjects } from '../electron/project-scanner'

describe('scanProjects', () => {
  let root: string
  let projectsDir: string
  let appDataPath: string

  beforeEach(() => {
    root = mkdtempSync(join(tmpdir(), 'claudedance-test-'))
    projectsDir = join(root, 'projects')
    appDataPath = join(root, 'projects.json')
    mkdirSync(projectsDir, { recursive: true })
  })
  afterEach(() => rmSync(root, { recursive: true, force: true }))

  it('returns empty list when projects dir is empty', async () => {
    const result = await scanProjects({ projectsDir, appDataPath })
    expect(result).toEqual([])
  })

  it('decodes project paths and counts session files', async () => {
    const encoded = '-tmp-foo'
    mkdirSync(join(projectsDir, encoded))
    writeFileSync(join(projectsDir, encoded, 'a.jsonl'), '')
    writeFileSync(join(projectsDir, encoded, 'b.jsonl'), '')
    writeFileSync(join(projectsDir, encoded, 'ignore.txt'), '')

    const result = await scanProjects({ projectsDir, appDataPath })
    expect(result).toHaveLength(1)
    expect(result[0].path).toBe('/tmp/foo')
    expect(result[0].encodedPath).toBe(encoded)
    expect(result[0].sessionCount).toBe(2)
    expect(result[0].source).toBe('scanned')
    expect(result[0].hidden).toBe(false)
  })

  it('marks exists=false when decoded path missing on disk', async () => {
    mkdirSync(join(projectsDir, '-nonexistent-path-xyz'))
    const result = await scanProjects({ projectsDir, appDataPath })
    expect(result[0].exists).toBe(false)
  })

  it('merges manual projects from app data', async () => {
    const manualPath = join(root, 'manual-project')
    mkdirSync(manualPath)
    writeFileSync(
      appDataPath,
      JSON.stringify({ manual: [manualPath], hidden: [] }),
    )
    const result = await scanProjects({ projectsDir, appDataPath })
    expect(result).toHaveLength(1)
    expect(result[0].path).toBe(manualPath)
    expect(result[0].source).toBe('manual')
    expect(result[0].exists).toBe(true)
  })

  it('applies hidden flag from app data', async () => {
    const encoded = '-tmp-bar'
    mkdirSync(join(projectsDir, encoded))
    writeFileSync(
      appDataPath,
      JSON.stringify({ manual: [], hidden: ['/tmp/bar'] }),
    )
    const result = await scanProjects({ projectsDir, appDataPath })
    expect(result[0].hidden).toBe(true)
  })
})
```

- [ ] **Step 2: Run test, confirm failure**

```bash
npm test -- project-scanner
```

Expected: FAIL with module not found.

- [ ] **Step 3: Create `electron/app-data.ts`**

```ts
import { promises as fs } from 'node:fs'
import { dirname } from 'node:path'

export type AppData = {
  manual: string[]
  hidden: string[]
}

const DEFAULT: AppData = { manual: [], hidden: [] }

export async function readAppData(path: string): Promise<AppData> {
  try {
    const text = await fs.readFile(path, 'utf8')
    const parsed = JSON.parse(text) as Partial<AppData>
    return {
      manual: Array.isArray(parsed.manual) ? parsed.manual : [],
      hidden: Array.isArray(parsed.hidden) ? parsed.hidden : [],
    }
  } catch {
    return { ...DEFAULT }
  }
}

export async function writeAppData(path: string, data: AppData): Promise<void> {
  await fs.mkdir(dirname(path), { recursive: true })
  await fs.writeFile(path, JSON.stringify(data, null, 2), 'utf8')
}
```

- [ ] **Step 4: Create `electron/project-scanner.ts`**

```ts
import { promises as fs } from 'node:fs'
import { join } from 'node:path'
import type { Project } from '@shared/types'
import { decodeCwd, encodeCwd } from '@shared/encoding'
import { readAppData } from './app-data'

export type ScanOptions = {
  projectsDir: string
  appDataPath: string
}

export async function scanProjects(opts: ScanOptions): Promise<Project[]> {
  const appData = await readAppData(opts.appDataPath)
  const hidden = new Set(appData.hidden)

  const map = new Map<string, Project>()

  const scanned = await listScannedProjects(opts.projectsDir)
  for (const p of scanned) {
    map.set(p.path, { ...p, hidden: hidden.has(p.path) })
  }

  for (const manualPath of appData.manual) {
    if (map.has(manualPath)) {
      map.set(manualPath, { ...map.get(manualPath)!, source: 'manual' })
      continue
    }
    map.set(manualPath, {
      path: manualPath,
      encodedPath: encodeCwd(manualPath),
      exists: await dirExists(manualPath),
      sessionCount: 0,
      lastActiveAt: 0,
      source: 'manual',
      hidden: hidden.has(manualPath),
    })
  }

  return Array.from(map.values())
}

async function listScannedProjects(projectsDir: string): Promise<Project[]> {
  let entries: string[]
  try {
    entries = await fs.readdir(projectsDir)
  } catch {
    return []
  }

  const results: Project[] = []
  for (const name of entries) {
    const full = join(projectsDir, name)
    let stat
    try {
      stat = await fs.stat(full)
    } catch {
      continue
    }
    if (!stat.isDirectory()) continue
    const decoded = decodeCwd(name)
    const sessionFiles = await listSessionFiles(full)
    const lastActiveAt = await mostRecentMtime(full, sessionFiles)
    results.push({
      path: decoded,
      encodedPath: name,
      exists: await dirExists(decoded),
      sessionCount: sessionFiles.length,
      lastActiveAt,
      source: 'scanned',
      hidden: false,
    })
  }
  return results
}

async function listSessionFiles(projectDir: string): Promise<string[]> {
  const entries = await fs.readdir(projectDir).catch(() => [] as string[])
  return entries.filter((f) => f.endsWith('.jsonl'))
}

async function mostRecentMtime(dir: string, files: string[]): Promise<number> {
  let max = 0
  for (const f of files) {
    try {
      const stat = await fs.stat(join(dir, f))
      const ms = stat.mtimeMs
      if (ms > max) max = ms
    } catch {
      // ignore
    }
  }
  return max
}

async function dirExists(path: string): Promise<boolean> {
  try {
    const stat = await fs.stat(path)
    return stat.isDirectory()
  } catch {
    return false
  }
}
```

- [ ] **Step 5: Run test, confirm pass**

```bash
npm test -- project-scanner
```

Expected: PASS (5 tests).

- [ ] **Step 6: Commit**

```bash
git add -A && git commit -m "feat: project scanner with hidden/manual overrides"
```

---

## Task 4: Session reader

**Files:**
- Create: `electron/session-reader.ts`, `tests/session-reader.test.ts`

- [ ] **Step 1: Write failing test `tests/session-reader.test.ts`**

```ts
import { describe, expect, it, beforeEach, afterEach } from 'vitest'
import { mkdtempSync, rmSync, writeFileSync, mkdirSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { listSessions, readSessionEvents } from '../electron/session-reader'

function makeJsonl(lines: object[]): string {
  return lines.map((l) => JSON.stringify(l)).join('\n') + '\n'
}

describe('listSessions', () => {
  let root: string
  beforeEach(() => {
    root = mkdtempSync(join(tmpdir(), 'cd-sess-'))
  })
  afterEach(() => rmSync(root, { recursive: true, force: true }))

  it('returns empty list when project dir missing', async () => {
    const result = await listSessions({
      projectPath: '/tmp/whatever',
      projectsDir: join(root, 'nope'),
    })
    expect(result).toEqual([])
  })

  it('summarises one session with last user message as title', async () => {
    const projectsDir = join(root, 'projects')
    const encoded = '-tmp-foo'
    mkdirSync(join(projectsDir, encoded), { recursive: true })
    const sessionId = 'aaaa-bbbb'
    writeFileSync(
      join(projectsDir, encoded, `${sessionId}.jsonl`),
      makeJsonl([
        {
          type: 'user',
          message: { role: 'user', content: 'hello' },
          timestamp: '2026-06-09T10:00:00.000Z',
          sessionId,
        },
        {
          type: 'assistant',
          message: { role: 'assistant', content: [{ type: 'text', text: 'hi' }] },
          timestamp: '2026-06-09T10:00:05.000Z',
          sessionId,
        },
        {
          type: 'user',
          message: { role: 'user', content: 'second prompt is the title' },
          timestamp: '2026-06-09T10:01:00.000Z',
          sessionId,
        },
      ]),
    )

    const result = await listSessions({
      projectPath: '/tmp/foo',
      projectsDir,
    })
    expect(result).toHaveLength(1)
    expect(result[0].id).toBe(sessionId)
    expect(result[0].title).toBe('second prompt is the title')
    expect(result[0].messageCount).toBe(3)
    expect(result[0].firstMessageAt).toBe(Date.parse('2026-06-09T10:00:00.000Z'))
    expect(result[0].lastMessageAt).toBe(Date.parse('2026-06-09T10:01:00.000Z'))
  })

  it('falls back to "(no messages)" when only non-user events exist', async () => {
    const projectsDir = join(root, 'projects')
    const encoded = '-tmp-bar'
    mkdirSync(join(projectsDir, encoded), { recursive: true })
    writeFileSync(
      join(projectsDir, encoded, `s.jsonl`),
      makeJsonl([{ type: 'attachment', timestamp: '2026-06-09T10:00:00.000Z' }]),
    )
    const result = await listSessions({
      projectPath: '/tmp/bar',
      projectsDir,
    })
    expect(result[0].title).toBe('(no messages)')
  })

  it('truncates title to 60 chars', async () => {
    const projectsDir = join(root, 'projects')
    const encoded = '-tmp-baz'
    mkdirSync(join(projectsDir, encoded), { recursive: true })
    const long = 'a'.repeat(120)
    writeFileSync(
      join(projectsDir, encoded, `s.jsonl`),
      makeJsonl([
        {
          type: 'user',
          message: { role: 'user', content: long },
          timestamp: '2026-06-09T10:00:00.000Z',
        },
      ]),
    )
    const result = await listSessions({
      projectPath: '/tmp/baz',
      projectsDir,
    })
    expect(result[0].title.length).toBe(60)
  })
})

describe('readSessionEvents', () => {
  let root: string
  beforeEach(() => {
    root = mkdtempSync(join(tmpdir(), 'cd-read-'))
  })
  afterEach(() => rmSync(root, { recursive: true, force: true }))

  it('parses every line of a jsonl into raw events', async () => {
    const file = join(root, 's.jsonl')
    writeFileSync(
      file,
      makeJsonl([
        { type: 'user', message: { role: 'user', content: 'a' } },
        { type: 'assistant', message: { role: 'assistant', content: [] } },
        { type: 'attachment' },
      ]),
    )
    const events = await readSessionEvents(file)
    expect(events).toHaveLength(3)
    expect(events[0].kind).toBe('user')
    expect(events[1].kind).toBe('assistant')
    expect(events[2].kind).toBe('attachment')
    expect(events[0].raw).toMatchObject({ type: 'user' })
  })

  it('skips malformed lines without throwing', async () => {
    const file = join(root, 's.jsonl')
    writeFileSync(file, '{"type":"user"}\nnot-json\n{"type":"assistant"}\n')
    const events = await readSessionEvents(file)
    expect(events.map((e) => e.kind)).toEqual(['user', 'assistant'])
  })
})
```

- [ ] **Step 2: Run test, confirm failure**

```bash
npm test -- session-reader
```

Expected: FAIL with module not found.

- [ ] **Step 3: Create `electron/session-reader.ts`**

```ts
import { promises as fs } from 'node:fs'
import { join } from 'node:path'
import type { RawEvent, SessionSummary } from '@shared/types'
import { encodeCwd } from '@shared/encoding'

export type ListOptions = {
  projectPath: string
  projectsDir: string
}

export async function listSessions(opts: ListOptions): Promise<SessionSummary[]> {
  const encoded = encodeCwd(opts.projectPath)
  const dir = join(opts.projectsDir, encoded)
  let entries: string[]
  try {
    entries = await fs.readdir(dir)
  } catch {
    return []
  }
  const out: SessionSummary[] = []
  for (const name of entries) {
    if (!name.endsWith('.jsonl')) continue
    const full = join(dir, name)
    const summary = await summariseSession(full, opts.projectPath)
    if (summary) out.push(summary)
  }
  return out.sort((a, b) => b.lastMessageAt - a.lastMessageAt)
}

async function summariseSession(
  jsonlPath: string,
  projectPath: string,
): Promise<SessionSummary | null> {
  const events = await readSessionEvents(jsonlPath)
  if (events.length === 0) {
    const id = idFromPath(jsonlPath)
    return {
      id,
      projectPath,
      jsonlPath,
      title: '(no messages)',
      firstMessageAt: 0,
      lastMessageAt: 0,
      messageCount: 0,
    }
  }

  let firstTs = Infinity
  let lastTs = 0
  let messageCount = 0
  let lastUserText: string | null = null

  for (const e of events) {
    if (e.kind === 'user' || e.kind === 'assistant') messageCount++
    const ts = parseTs(e.timestamp)
    if (ts !== null) {
      if (ts < firstTs) firstTs = ts
      if (ts > lastTs) lastTs = ts
    }
    if (e.kind === 'user') {
      const text = extractUserText(e.raw)
      if (text) lastUserText = text
    }
  }

  const title = lastUserText
    ? truncate(lastUserText.trim(), 60)
    : '(no messages)'

  return {
    id: idFromPath(jsonlPath),
    projectPath,
    jsonlPath,
    title,
    firstMessageAt: firstTs === Infinity ? 0 : firstTs,
    lastMessageAt: lastTs,
    messageCount,
  }
}

export async function readSessionEvents(jsonlPath: string): Promise<RawEvent[]> {
  let text: string
  try {
    text = await fs.readFile(jsonlPath, 'utf8')
  } catch {
    return []
  }
  const out: RawEvent[] = []
  for (const line of text.split('\n')) {
    if (!line.trim()) continue
    try {
      const raw = JSON.parse(line) as Record<string, unknown>
      out.push({
        raw,
        kind: typeof raw['type'] === 'string' ? (raw['type'] as string) : 'unknown',
        sessionId: typeof raw['sessionId'] === 'string' ? (raw['sessionId'] as string) : undefined,
        timestamp: typeof raw['timestamp'] === 'string' ? (raw['timestamp'] as string) : undefined,
      })
    } catch {
      // skip malformed line
    }
  }
  return out
}

function idFromPath(p: string): string {
  const base = p.split('/').pop() ?? ''
  return base.replace(/\.jsonl$/, '')
}

function parseTs(ts: string | undefined): number | null {
  if (!ts) return null
  const n = Date.parse(ts)
  return Number.isNaN(n) ? null : n
}

function extractUserText(raw: Record<string, unknown>): string | null {
  const message = raw['message'] as Record<string, unknown> | undefined
  if (!message) return null
  const content = message['content']
  if (typeof content === 'string') return content
  if (Array.isArray(content)) {
    for (const block of content) {
      if (
        block &&
        typeof block === 'object' &&
        (block as Record<string, unknown>)['type'] === 'text' &&
        typeof (block as Record<string, unknown>)['text'] === 'string'
      ) {
        return (block as Record<string, unknown>)['text'] as string
      }
    }
  }
  return null
}

function truncate(s: string, n: number): string {
  return s.length > n ? s.slice(0, n) : s
}
```

- [ ] **Step 4: Run test, confirm pass**

```bash
npm test -- session-reader
```

Expected: PASS (6 tests).

- [ ] **Step 5: Commit**

```bash
git add -A && git commit -m "feat: session reader with title extraction"
```

---

## Task 5: Tailwind + shadcn theme scaffolding

**Files:**
- Modify: `src/index.css`, `package.json` (only if Tailwind not installed by Task 1)
- Create: `tailwind.config.js`, `postcss.config.js`

- [ ] **Step 1: Create `tailwind.config.js`**

```js
/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        background: 'hsl(0 0% 100%)',
        foreground: 'hsl(240 10% 3.9%)',
        muted: 'hsl(240 4.8% 95.9%)',
        'muted-foreground': 'hsl(240 3.8% 46.1%)',
        border: 'hsl(240 5.9% 90%)',
        accent: 'hsl(240 4.8% 95.9%)',
        primary: 'hsl(240 5.9% 10%)',
        'primary-foreground': 'hsl(0 0% 98%)',
      },
    },
  },
  plugins: [],
}
```

- [ ] **Step 2: Create `postcss.config.js`**

```js
export default {
  plugins: {
    tailwindcss: {},
    autoprefixer: {},
  },
}
```

- [ ] **Step 3: Replace `src/index.css`**

```css
@tailwind base;
@tailwind components;
@tailwind utilities;

html, body, #root { height: 100%; }
body {
  margin: 0;
  font-family: -apple-system, system-ui, sans-serif;
  background: hsl(0 0% 100%);
  color: hsl(240 10% 3.9%);
}
```

- [ ] **Step 4: Verify dev still runs**

```bash
npm run dev
```

Expected: window opens, no console errors. Close.

- [ ] **Step 5: Commit**

```bash
git add -A && git commit -m "feat: add tailwind"
```

---

## Task 6: IPC contract + preload bridge (no claude spawn yet)

**Files:**
- Modify: `electron/main.ts`, `electron/preload.ts`
- Create: `electron/ipc.ts`, `src/lib/api.ts`

- [ ] **Step 1: Create `electron/ipc.ts`**

```ts
import { ipcMain, type BrowserWindow } from 'electron'
import { homedir } from 'node:os'
import { join } from 'node:path'
import type { Project, SessionSummary, RawEvent, IpcChatEvent, ChatStartRequest, ChatStartResponse } from '@shared/types'
import { scanProjects } from './project-scanner'
import { listSessions, readSessionEvents } from './session-reader'
import { readAppData, writeAppData } from './app-data'

const PROJECTS_DIR = join(homedir(), '.claude', 'projects')
const APP_DATA_PATH = join(homedir(), '.claudedance', 'projects.json')

export function registerIpc(_win: BrowserWindow): void {
  ipcMain.handle('projects.list', async (): Promise<Project[]> => {
    return scanProjects({ projectsDir: PROJECTS_DIR, appDataPath: APP_DATA_PATH })
  })

  ipcMain.handle('project.add', async (_e, path: string): Promise<Project[]> => {
    const data = await readAppData(APP_DATA_PATH)
    if (!data.manual.includes(path)) data.manual.push(path)
    data.hidden = data.hidden.filter((p) => p !== path)
    await writeAppData(APP_DATA_PATH, data)
    return scanProjects({ projectsDir: PROJECTS_DIR, appDataPath: APP_DATA_PATH })
  })

  ipcMain.handle('project.hide', async (_e, path: string): Promise<Project[]> => {
    const data = await readAppData(APP_DATA_PATH)
    if (!data.hidden.includes(path)) data.hidden.push(path)
    await writeAppData(APP_DATA_PATH, data)
    return scanProjects({ projectsDir: PROJECTS_DIR, appDataPath: APP_DATA_PATH })
  })

  ipcMain.handle('sessions.list', async (_e, projectPath: string): Promise<SessionSummary[]> => {
    return listSessions({ projectPath, projectsDir: PROJECTS_DIR })
  })

  ipcMain.handle('session.read', async (_e, jsonlPath: string): Promise<RawEvent[]> => {
    return readSessionEvents(jsonlPath)
  })

  // chat.start / chat.sendMessage / chat.stop added in Task 8
  ipcMain.handle('chat.start', async (_e, _req: ChatStartRequest): Promise<ChatStartResponse> => {
    throw new Error('chat.start not implemented yet')
  })
  ipcMain.handle('chat.sendMessage', async (_e, _channelId: string, _text: string): Promise<void> => {
    throw new Error('chat.sendMessage not implemented yet')
  })
  ipcMain.handle('chat.stop', async (_e, _channelId: string): Promise<void> => {
    throw new Error('chat.stop not implemented yet')
  })
}

export function sendChatEvent(win: BrowserWindow, evt: IpcChatEvent): void {
  if (!win.isDestroyed()) win.webContents.send('chat.event', evt)
}
```

- [ ] **Step 2: Replace `electron/preload.ts`**

```ts
import { contextBridge, ipcRenderer } from 'electron'
import type { Project, SessionSummary, RawEvent, IpcChatEvent, ChatStartRequest, ChatStartResponse } from '@shared/types'

const api = {
  listProjects: (): Promise<Project[]> => ipcRenderer.invoke('projects.list'),
  addProject: (path: string): Promise<Project[]> => ipcRenderer.invoke('project.add', path),
  hideProject: (path: string): Promise<Project[]> => ipcRenderer.invoke('project.hide', path),
  listSessions: (projectPath: string): Promise<SessionSummary[]> =>
    ipcRenderer.invoke('sessions.list', projectPath),
  readSession: (jsonlPath: string): Promise<RawEvent[]> =>
    ipcRenderer.invoke('session.read', jsonlPath),
  startChat: (req: ChatStartRequest): Promise<ChatStartResponse> =>
    ipcRenderer.invoke('chat.start', req),
  sendChatMessage: (channelId: string, text: string): Promise<void> =>
    ipcRenderer.invoke('chat.sendMessage', channelId, text),
  stopChat: (channelId: string): Promise<void> => ipcRenderer.invoke('chat.stop', channelId),
  onChatEvent: (cb: (evt: IpcChatEvent) => void): (() => void) => {
    const listener = (_e: Electron.IpcRendererEvent, evt: IpcChatEvent) => cb(evt)
    ipcRenderer.on('chat.event', listener)
    return () => ipcRenderer.removeListener('chat.event', listener)
  },
}

contextBridge.exposeInMainWorld('api', api)

export type Api = typeof api
```

- [ ] **Step 3: Update `electron/main.ts` to register IPC**

```ts
import { app, BrowserWindow } from 'electron'
import { resolve } from 'node:path'
import { registerIpc } from './ipc'

function createWindow() {
  const win = new BrowserWindow({
    width: 1200,
    height: 800,
    webPreferences: {
      preload: resolve(__dirname, '../preload/preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
    },
  })
  registerIpc(win)
  const devUrl = process.env['ELECTRON_RENDERER_URL']
  if (devUrl) win.loadURL(devUrl)
  else win.loadFile(resolve(__dirname, '../renderer/index.html'))
}

app.whenReady().then(() => {
  createWindow()
  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow()
  })
})

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit()
})
```

- [ ] **Step 4: Create `src/lib/api.ts`**

```ts
import type { Api } from '../../electron/preload'

declare global {
  interface Window {
    api: Api
  }
}

export const api = (): Api => window.api
```

- [ ] **Step 5: Smoke test from renderer**

Replace `src/App.tsx` temporarily to verify IPC works:

```tsx
import { useEffect, useState } from 'react'
import { api } from './lib/api'
import type { Project } from '@shared/types'

export default function App() {
  const [projects, setProjects] = useState<Project[]>([])
  useEffect(() => {
    api().listProjects().then(setProjects)
  }, [])
  return (
    <div style={{ padding: 24 }}>
      <h1>ClaudeDance</h1>
      <p>Found {projects.length} projects</p>
      <ul>
        {projects.slice(0, 10).map((p) => (
          <li key={p.path}>
            {p.path} — {p.sessionCount} sessions
          </li>
        ))}
      </ul>
    </div>
  )
}
```

- [ ] **Step 6: Run dev and verify**

```bash
npm run dev
```

Expected: window shows "Found N projects" where N > 0 (you have ~20 projects), and a list of paths with session counts. Close.

- [ ] **Step 7: Commit**

```bash
git add -A && git commit -m "feat: ipc bridge for project and session listing"
```

---

## Task 7: Sidebar UI (projects + sessions, no chat yet)

**Files:**
- Create: `src/store/projects.ts`, `src/store/sessions.ts`, `src/store/events.ts`, `src/lib/time.ts`, `src/components/Sidebar.tsx`, `src/components/ProjectItem.tsx`, `src/components/SessionItem.tsx`, `tests/time.test.ts`
- Modify: `src/App.tsx`

- [ ] **Step 1: Write failing test `tests/time.test.ts`**

```ts
import { describe, expect, it } from 'vitest'
import { groupSessionsByTime, type Bucket } from '../src/lib/time'

const day = 24 * 60 * 60 * 1000

describe('groupSessionsByTime', () => {
  const now = Date.parse('2026-06-09T12:00:00.000Z')

  it('classifies today', () => {
    const sessions = [{ id: '1', lastMessageAt: now - 60_000 }]
    const groups = groupSessionsByTime(sessions, now)
    expect(groups[0].bucket).toBe<Bucket>('today')
    expect(groups[0].sessions).toHaveLength(1)
  })

  it('classifies yesterday', () => {
    const yesterday = Date.parse('2026-06-08T20:00:00.000Z')
    const groups = groupSessionsByTime([{ id: '1', lastMessageAt: yesterday }], now)
    expect(groups.find((g) => g.bucket === 'yesterday')!.sessions).toHaveLength(1)
  })

  it('classifies this week', () => {
    const groups = groupSessionsByTime([{ id: '1', lastMessageAt: now - 4 * day }], now)
    expect(groups.find((g) => g.bucket === 'thisWeek')!.sessions).toHaveLength(1)
  })

  it('classifies earlier', () => {
    const groups = groupSessionsByTime([{ id: '1', lastMessageAt: now - 30 * day }], now)
    expect(groups.find((g) => g.bucket === 'earlier')!.sessions).toHaveLength(1)
  })

  it('omits empty buckets', () => {
    const groups = groupSessionsByTime([{ id: '1', lastMessageAt: now }], now)
    expect(groups.map((g) => g.bucket)).toEqual(['today'])
  })
})
```

- [ ] **Step 2: Run test, confirm failure**

```bash
npm test -- time
```

Expected: FAIL.

- [ ] **Step 3: Create `src/lib/time.ts`**

```ts
export type Bucket = 'today' | 'yesterday' | 'thisWeek' | 'earlier'

export type HasLastMessageAt = { id: string; lastMessageAt: number }

const labelByBucket: Record<Bucket, string> = {
  today: 'Today',
  yesterday: 'Yesterday',
  thisWeek: 'This Week',
  earlier: 'Earlier',
}

const order: Bucket[] = ['today', 'yesterday', 'thisWeek', 'earlier']

export function groupSessionsByTime<T extends HasLastMessageAt>(
  sessions: T[],
  now: number = Date.now(),
): { bucket: Bucket; label: string; sessions: T[] }[] {
  const startOfToday = startOfDay(now)
  const startOfYesterday = startOfToday - 24 * 60 * 60 * 1000
  const startOfWeek = startOfToday - 7 * 24 * 60 * 60 * 1000

  const buckets: Record<Bucket, T[]> = { today: [], yesterday: [], thisWeek: [], earlier: [] }
  for (const s of sessions) {
    if (s.lastMessageAt >= startOfToday) buckets.today.push(s)
    else if (s.lastMessageAt >= startOfYesterday) buckets.yesterday.push(s)
    else if (s.lastMessageAt >= startOfWeek) buckets.thisWeek.push(s)
    else buckets.earlier.push(s)
  }
  return order
    .filter((b) => buckets[b].length > 0)
    .map((b) => ({ bucket: b, label: labelByBucket[b], sessions: buckets[b] }))
}

function startOfDay(ts: number): number {
  const d = new Date(ts)
  d.setHours(0, 0, 0, 0)
  return d.getTime()
}

export function relativeTime(ts: number, now: number = Date.now()): string {
  const diff = now - ts
  const min = 60_000
  const hour = 60 * min
  const day = 24 * hour
  if (diff < min) return 'just now'
  if (diff < hour) return `${Math.floor(diff / min)}m ago`
  if (diff < day) return `${Math.floor(diff / hour)}h ago`
  return `${Math.floor(diff / day)}d ago`
}
```

- [ ] **Step 4: Run test, confirm pass**

```bash
npm test -- time
```

Expected: PASS (5 tests).

- [ ] **Step 5: Create `src/store/projects.ts`**

```ts
import { create } from 'zustand'
import type { Project } from '@shared/types'
import { api } from '../lib/api'

type State = {
  projects: Project[]
  selectedProjectPath: string | null
  load: () => Promise<void>
  selectProject: (path: string | null) => void
  addProject: (path: string) => Promise<void>
  hideProject: (path: string) => Promise<void>
}

export const useProjects = create<State>((set) => ({
  projects: [],
  selectedProjectPath: null,
  load: async () => {
    const projects = await api().listProjects()
    set({ projects })
  },
  selectProject: (path) => set({ selectedProjectPath: path }),
  addProject: async (path) => {
    const projects = await api().addProject(path)
    set({ projects })
  },
  hideProject: async (path) => {
    const projects = await api().hideProject(path)
    set({ projects })
  },
}))
```

- [ ] **Step 6: Create `src/store/sessions.ts`**

```ts
import { create } from 'zustand'
import type { SessionSummary } from '@shared/types'
import { api } from '../lib/api'

type State = {
  sessionsByProject: Record<string, SessionSummary[]>
  selectedSessionId: string | null
  loadFor: (projectPath: string) => Promise<void>
  selectSession: (sessionId: string | null) => void
}

export const useSessions = create<State>((set, get) => ({
  sessionsByProject: {},
  selectedSessionId: null,
  loadFor: async (projectPath) => {
    if (get().sessionsByProject[projectPath]) return
    const sessions = await api().listSessions(projectPath)
    set((s) => ({ sessionsByProject: { ...s.sessionsByProject, [projectPath]: sessions } }))
  },
  selectSession: (sessionId) => set({ selectedSessionId: sessionId }),
}))
```

- [ ] **Step 7: Create `src/store/events.ts`**

```ts
import { create } from 'zustand'
import type { RawEvent } from '@shared/types'
import { api } from '../lib/api'

type State = {
  eventsBySession: Record<string, RawEvent[]>
  loadFromFile: (sessionId: string, jsonlPath: string) => Promise<void>
  appendEvent: (sessionId: string, event: RawEvent) => void
  clear: (sessionId: string) => void
}

export const useEvents = create<State>((set, get) => ({
  eventsBySession: {},
  loadFromFile: async (sessionId, jsonlPath) => {
    if (get().eventsBySession[sessionId]) return
    const events = await api().readSession(jsonlPath)
    set((s) => ({ eventsBySession: { ...s.eventsBySession, [sessionId]: events } }))
  },
  appendEvent: (sessionId, event) => {
    set((s) => ({
      eventsBySession: {
        ...s.eventsBySession,
        [sessionId]: [...(s.eventsBySession[sessionId] ?? []), event],
      },
    }))
  },
  clear: (sessionId) => {
    set((s) => {
      const copy = { ...s.eventsBySession }
      delete copy[sessionId]
      return { eventsBySession: copy }
    })
  },
}))
```

- [ ] **Step 8: Create `src/components/SessionItem.tsx`**

```tsx
import type { SessionSummary } from '@shared/types'
import { relativeTime } from '../lib/time'

type Props = {
  session: SessionSummary
  active: boolean
  onClick: () => void
}

export function SessionItem({ session, active, onClick }: Props) {
  return (
    <button
      onClick={onClick}
      className={
        'block w-full text-left px-3 py-1.5 rounded text-sm truncate ' +
        (active
          ? 'bg-accent text-primary'
          : 'text-muted-foreground hover:bg-muted hover:text-primary')
      }
      title={session.title}
    >
      <div className="truncate">{session.title || '(untitled)'}</div>
      <div className="text-xs opacity-60">{relativeTime(session.lastMessageAt)}</div>
    </button>
  )
}
```

- [ ] **Step 9: Create `src/components/ProjectItem.tsx`**

```tsx
import { useEffect, useState } from 'react'
import type { Project, SessionSummary } from '@shared/types'
import { useSessions } from '../store/sessions'
import { groupSessionsByTime } from '../lib/time'
import { SessionItem } from './SessionItem'

type Props = {
  project: Project
  expanded: boolean
  onToggle: () => void
  onNewChat: () => void
  selectedSessionId: string | null
  onSelectSession: (s: SessionSummary) => void
  query: string
}

export function ProjectItem({
  project,
  expanded,
  onToggle,
  onNewChat,
  selectedSessionId,
  onSelectSession,
  query,
}: Props) {
  const { sessionsByProject, loadFor } = useSessions()
  const [hover, setHover] = useState(false)

  useEffect(() => {
    if (expanded) loadFor(project.path)
  }, [expanded, project.path, loadFor])

  const sessions = sessionsByProject[project.path] ?? []
  const filtered = query
    ? sessions.filter((s) => s.title.toLowerCase().includes(query.toLowerCase()))
    : sessions
  const groups = groupSessionsByTime(filtered)

  return (
    <div
      className="mb-1"
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
    >
      <div className="flex items-center px-2 py-1 group">
        <button
          onClick={onToggle}
          className="flex-1 text-left text-sm font-medium truncate text-foreground"
          title={project.path}
        >
          <span className="inline-block w-3">{expanded ? '▾' : '▸'}</span>{' '}
          {project.path.split('/').pop() || project.path}
          <span className="text-muted-foreground ml-1 text-xs">
            ({project.sessionCount})
          </span>
          {!project.exists && (
            <span className="ml-1 text-xs text-red-500">missing</span>
          )}
        </button>
        <button
          onClick={onNewChat}
          className={
            'ml-1 px-1.5 rounded hover:bg-accent text-muted-foreground ' +
            (hover ? 'opacity-100' : 'opacity-0')
          }
          title="New chat in this project"
        >
          +
        </button>
      </div>
      {expanded && (
        <div className="pl-3">
          {groups.map((g) => (
            <div key={g.bucket} className="mb-1">
              <div className="px-3 pt-1 text-[10px] uppercase tracking-wide text-muted-foreground">
                {g.label}
              </div>
              {g.sessions.map((s) => (
                <SessionItem
                  key={s.id}
                  session={s}
                  active={s.id === selectedSessionId}
                  onClick={() => onSelectSession(s)}
                />
              ))}
            </div>
          ))}
          {sessions.length === 0 && (
            <div className="px-3 py-1 text-xs text-muted-foreground italic">
              No sessions yet
            </div>
          )}
        </div>
      )}
    </div>
  )
}
```

- [ ] **Step 10: Create `src/components/Sidebar.tsx`**

```tsx
import { useEffect, useState } from 'react'
import { useProjects } from '../store/projects'
import { useSessions } from '../store/sessions'
import { ProjectItem } from './ProjectItem'
import type { SessionSummary } from '@shared/types'

type Props = {
  onNewChat: (projectPath?: string) => void
  onOpenSession: (s: SessionSummary) => void
}

export function Sidebar({ onNewChat, onOpenSession }: Props) {
  const { projects, load } = useProjects()
  const { selectedSessionId } = useSessions()
  const [expanded, setExpanded] = useState<Set<string>>(new Set())
  const [query, setQuery] = useState('')

  useEffect(() => {
    load()
  }, [load])

  const visible = projects
    .filter((p) => !p.hidden)
    .sort((a, b) => b.lastActiveAt - a.lastActiveAt)

  function toggle(path: string) {
    setExpanded((prev) => {
      const next = new Set(prev)
      if (next.has(path)) next.delete(path)
      else next.add(path)
      return next
    })
  }

  return (
    <aside className="w-72 h-full border-r border-border flex flex-col bg-muted/30">
      <div className="p-3 border-b border-border flex flex-col gap-2">
        <button
          onClick={() => onNewChat()}
          className="w-full px-3 py-1.5 rounded bg-primary text-primary-foreground text-sm font-medium hover:opacity-90"
        >
          + New Chat
        </button>
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search…"
          className="w-full px-3 py-1.5 rounded border border-border bg-background text-sm"
        />
      </div>
      <div className="flex-1 overflow-y-auto p-2">
        {visible.map((p) => (
          <ProjectItem
            key={p.path}
            project={p}
            expanded={expanded.has(p.path)}
            onToggle={() => toggle(p.path)}
            onNewChat={() => onNewChat(p.path)}
            selectedSessionId={selectedSessionId}
            onSelectSession={onOpenSession}
            query={query}
          />
        ))}
        {visible.length === 0 && (
          <div className="px-3 py-2 text-xs text-muted-foreground">
            No projects found. Start a session with <code>claude</code> in any directory, then return.
          </div>
        )}
      </div>
    </aside>
  )
}
```

- [ ] **Step 11: Replace `src/App.tsx`**

```tsx
import { useState } from 'react'
import { Sidebar } from './components/Sidebar'
import { useEvents } from './store/events'
import { useSessions } from './store/sessions'
import type { SessionSummary } from '@shared/types'

type View =
  | { mode: 'empty' }
  | { mode: 'newChat'; preselectedProject?: string }
  | { mode: 'session'; session: SessionSummary }

export default function App() {
  const [view, setView] = useState<View>({ mode: 'empty' })
  const { selectSession } = useSessions()
  const { loadFromFile } = useEvents()

  function openSession(s: SessionSummary) {
    selectSession(s.id)
    loadFromFile(s.id, s.jsonlPath)
    setView({ mode: 'session', session: s })
  }

  function newChat(projectPath?: string) {
    selectSession(null)
    setView({ mode: 'newChat', preselectedProject: projectPath })
  }

  return (
    <div className="flex h-full">
      <Sidebar onNewChat={newChat} onOpenSession={openSession} />
      <main className="flex-1 flex flex-col items-center justify-center text-muted-foreground">
        {view.mode === 'empty' && <p>Select a session or start a new chat</p>}
        {view.mode === 'newChat' && (
          <p>New chat (cwd: {view.preselectedProject ?? 'unset'})</p>
        )}
        {view.mode === 'session' && (
          <p>Session: {view.session.title}</p>
        )}
      </main>
    </div>
  )
}
```

- [ ] **Step 12: Verify in browser**

```bash
npm run dev
```

Expected: window opens with left sidebar showing project list, each project expandable, sessions grouped by time, search box filters by title. Clicking a session shows its title in the right pane. Close.

- [ ] **Step 13: Commit**

```bash
git add -A && git commit -m "feat: sidebar with project tree, sessions, search"
```

---

## Task 8: Claude process manager (main process)

**Files:**
- Create: `electron/claude-process.ts`
- Modify: `electron/ipc.ts`

- [ ] **Step 1: Create `electron/claude-process.ts`**

```ts
import { spawn, type ChildProcessWithoutNullStreams } from 'node:child_process'
import { randomUUID } from 'node:crypto'
import type { BrowserWindow } from 'electron'
import type { ChannelId, ChatStartRequest, IpcChatEvent, RawEvent } from '@shared/types'
import { sendChatEvent } from './ipc-utils'

type Channel = {
  id: ChannelId
  proc: ChildProcessWithoutNullStreams
  buffer: string
  sessionId?: string
}

const MAX_CHANNELS = 3
const channels = new Map<ChannelId, Channel>()

export function startChat(win: BrowserWindow, req: ChatStartRequest): ChannelId {
  evictIfNeeded(win)

  const args = [
    '--print',
    '--output-format', 'stream-json',
    '--input-format', 'stream-json',
    '--include-partial-messages',
    '--include-hook-events',
    '--verbose',
  ]
  if (req.sessionId) args.push('--resume', req.sessionId)

  const proc = spawn('claude', args, {
    cwd: req.cwd,
    env: { ...process.env },
  })

  const id = randomUUID()
  const channel: Channel = { id, proc, buffer: '', sessionId: req.sessionId }
  channels.set(id, channel)

  proc.stdout.setEncoding('utf8')
  proc.stdout.on('data', (chunk: string) => {
    channel.buffer += chunk
    let nl: number
    while ((nl = channel.buffer.indexOf('\n')) !== -1) {
      const line = channel.buffer.slice(0, nl)
      channel.buffer = channel.buffer.slice(nl + 1)
      if (!line.trim()) continue
      try {
        const raw = JSON.parse(line) as Record<string, unknown>
        const event: RawEvent = {
          raw,
          kind: typeof raw['type'] === 'string' ? (raw['type'] as string) : 'unknown',
          sessionId:
            typeof raw['session_id'] === 'string'
              ? (raw['session_id'] as string)
              : typeof raw['sessionId'] === 'string'
                ? (raw['sessionId'] as string)
                : undefined,
          timestamp: typeof raw['timestamp'] === 'string' ? (raw['timestamp'] as string) : undefined,
        }
        if (!channel.sessionId && event.sessionId) channel.sessionId = event.sessionId
        sendChatEvent(win, { kind: 'event', channelId: id, event })
      } catch (err) {
        sendChatEvent(win, {
          kind: 'error',
          channelId: id,
          message: `Failed to parse line: ${String(err)}`,
        })
      }
    }
  })

  proc.stderr.setEncoding('utf8')
  proc.stderr.on('data', (chunk: string) => {
    sendChatEvent(win, { kind: 'error', channelId: id, message: chunk })
  })

  proc.on('exit', (code) => {
    sendChatEvent(win, { kind: 'exit', channelId: id, code })
    channels.delete(id)
  })

  proc.on('error', (err) => {
    sendChatEvent(win, { kind: 'error', channelId: id, message: err.message })
  })

  sendUserMessage(id, req.initialMessage)
  return id
}

export function sendUserMessage(channelId: ChannelId, text: string): void {
  const channel = channels.get(channelId)
  if (!channel) throw new Error(`Unknown channel ${channelId}`)
  const payload = {
    type: 'user',
    message: { role: 'user', content: text },
  }
  channel.proc.stdin.write(JSON.stringify(payload) + '\n')
}

export function stopChat(channelId: ChannelId): void {
  const channel = channels.get(channelId)
  if (!channel) return
  channel.proc.kill('SIGTERM')
  channels.delete(channelId)
}

export function shutdownAll(): void {
  for (const c of channels.values()) c.proc.kill('SIGTERM')
  channels.clear()
}

function evictIfNeeded(_win: BrowserWindow): void {
  if (channels.size < MAX_CHANNELS) return
  const oldest = channels.keys().next().value
  if (oldest) stopChat(oldest)
}

// Re-export for IPC import convenience
export type { IpcChatEvent }
```

- [ ] **Step 2: Extract `sendChatEvent` into `electron/ipc-utils.ts`**

This avoids circular import between `ipc.ts` and `claude-process.ts`.

```ts
// electron/ipc-utils.ts
import type { BrowserWindow } from 'electron'
import type { IpcChatEvent } from '@shared/types'

export function sendChatEvent(win: BrowserWindow, evt: IpcChatEvent): void {
  if (!win.isDestroyed()) win.webContents.send('chat.event', evt)
}
```

- [ ] **Step 3: Update `electron/ipc.ts` to wire chat handlers**

Remove the placeholder throws and remove the local `sendChatEvent` (now in `ipc-utils.ts`):

```ts
import { ipcMain, type BrowserWindow } from 'electron'
import { homedir } from 'node:os'
import { join } from 'node:path'
import type { Project, SessionSummary, RawEvent, ChatStartRequest, ChatStartResponse } from '@shared/types'
import { scanProjects } from './project-scanner'
import { listSessions, readSessionEvents } from './session-reader'
import { readAppData, writeAppData } from './app-data'
import { startChat, sendUserMessage, stopChat } from './claude-process'

const PROJECTS_DIR = join(homedir(), '.claude', 'projects')
const APP_DATA_PATH = join(homedir(), '.claudedance', 'projects.json')

export function registerIpc(win: BrowserWindow): void {
  ipcMain.handle('projects.list', async (): Promise<Project[]> => {
    return scanProjects({ projectsDir: PROJECTS_DIR, appDataPath: APP_DATA_PATH })
  })

  ipcMain.handle('project.add', async (_e, path: string): Promise<Project[]> => {
    const data = await readAppData(APP_DATA_PATH)
    if (!data.manual.includes(path)) data.manual.push(path)
    data.hidden = data.hidden.filter((p) => p !== path)
    await writeAppData(APP_DATA_PATH, data)
    return scanProjects({ projectsDir: PROJECTS_DIR, appDataPath: APP_DATA_PATH })
  })

  ipcMain.handle('project.hide', async (_e, path: string): Promise<Project[]> => {
    const data = await readAppData(APP_DATA_PATH)
    if (!data.hidden.includes(path)) data.hidden.push(path)
    await writeAppData(APP_DATA_PATH, data)
    return scanProjects({ projectsDir: PROJECTS_DIR, appDataPath: APP_DATA_PATH })
  })

  ipcMain.handle('sessions.list', async (_e, projectPath: string): Promise<SessionSummary[]> => {
    return listSessions({ projectPath, projectsDir: PROJECTS_DIR })
  })

  ipcMain.handle('session.read', async (_e, jsonlPath: string): Promise<RawEvent[]> => {
    return readSessionEvents(jsonlPath)
  })

  ipcMain.handle('chat.start', async (_e, req: ChatStartRequest): Promise<ChatStartResponse> => {
    const channelId = startChat(win, req)
    return { channelId }
  })

  ipcMain.handle('chat.sendMessage', async (_e, channelId: string, text: string): Promise<void> => {
    sendUserMessage(channelId, text)
  })

  ipcMain.handle('chat.stop', async (_e, channelId: string): Promise<void> => {
    stopChat(channelId)
  })
}
```

- [ ] **Step 4: Hook shutdown into `electron/main.ts`**

Add to `electron/main.ts`:

```ts
import { app, BrowserWindow } from 'electron'
import { resolve } from 'node:path'
import { registerIpc } from './ipc'
import { shutdownAll } from './claude-process'

function createWindow() {
  const win = new BrowserWindow({
    width: 1200,
    height: 800,
    webPreferences: {
      preload: resolve(__dirname, '../preload/preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
    },
  })
  registerIpc(win)
  const devUrl = process.env['ELECTRON_RENDERER_URL']
  if (devUrl) win.loadURL(devUrl)
  else win.loadFile(resolve(__dirname, '../renderer/index.html'))
}

app.whenReady().then(() => {
  createWindow()
  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow()
  })
})

app.on('before-quit', () => shutdownAll())

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit()
})
```

- [ ] **Step 5: Verify typecheck**

```bash
npm run typecheck
```

Expected: no errors.

- [ ] **Step 6: Smoke test (manual)**

```bash
npm run dev
```

Open DevTools (Cmd+Opt+I) and in console run:

```js
const off = window.api.onChatEvent((evt) => console.log('EVT', evt))
const { channelId } = await window.api.startChat({
  cwd: '/tmp',
  initialMessage: 'say hello in one word',
})
console.log('channel', channelId)
```

Expected: console logs a stream of `EVT` entries, ending with `{ kind: 'exit', code: 0 }`. If `claude` CLI is missing or errors, you'll see `kind: 'error'`. Close window.

- [ ] **Step 7: Commit**

```bash
git add -A && git commit -m "feat: spawn claude child process and forward events"
```

---

## Task 9: Chat store + derive function

**Files:**
- Create: `src/store/chats.ts`, `src/lib/derive.ts`, `tests/derive.test.ts`

- [ ] **Step 1: Write failing test `tests/derive.test.ts`**

```ts
import { describe, expect, it } from 'vitest'
import { deriveMessages, type DerivedMessage } from '../src/lib/derive'
import type { RawEvent } from '@shared/types'

function ev(raw: Record<string, unknown>): RawEvent {
  return {
    raw,
    kind: typeof raw['type'] === 'string' ? (raw['type'] as string) : 'unknown',
  }
}

describe('deriveMessages (MVP A-tier)', () => {
  it('extracts user text from string content', () => {
    const result = deriveMessages([
      ev({ type: 'user', message: { role: 'user', content: 'hello' } }),
    ])
    expect(result).toEqual<DerivedMessage[]>([
      { kind: 'user', text: 'hello', key: '0' },
    ])
  })

  it('extracts user text from content blocks', () => {
    const result = deriveMessages([
      ev({
        type: 'user',
        message: {
          role: 'user',
          content: [{ type: 'text', text: 'block-text' }],
        },
      }),
    ])
    expect(result[0]).toMatchObject({ kind: 'user', text: 'block-text' })
  })

  it('extracts assistant text blocks', () => {
    const result = deriveMessages([
      ev({
        type: 'assistant',
        message: {
          role: 'assistant',
          content: [{ type: 'text', text: 'reply' }],
        },
      }),
    ])
    expect(result[0]).toMatchObject({ kind: 'assistant', text: 'reply' })
  })

  it('extracts tool_use as collapsed card', () => {
    const result = deriveMessages([
      ev({
        type: 'assistant',
        message: {
          role: 'assistant',
          content: [
            { type: 'tool_use', id: 'tu_1', name: 'Bash', input: { command: 'ls' } },
          ],
        },
      }),
    ])
    expect(result[0]).toMatchObject({
      kind: 'toolUse',
      tool: 'Bash',
      input: { command: 'ls' },
      id: 'tu_1',
    })
  })

  it('mixes text and tool_use blocks in one assistant message', () => {
    const result = deriveMessages([
      ev({
        type: 'assistant',
        message: {
          role: 'assistant',
          content: [
            { type: 'text', text: 'running command' },
            { type: 'tool_use', id: 'tu_2', name: 'Bash', input: { command: 'pwd' } },
          ],
        },
      }),
    ])
    expect(result.map((m) => m.kind)).toEqual(['assistant', 'toolUse'])
  })

  it('ignores hook, attachment, system, result, thinking, partial events', () => {
    const result = deriveMessages([
      ev({ type: 'attachment' }),
      ev({ type: 'system', subtype: 'init' }),
      ev({ type: 'hook' }),
      ev({ type: 'result' }),
      ev({ type: 'thinking' }),
      ev({ type: 'stream_event' }),
      ev({ type: 'user', message: { role: 'user', content: 'visible' } }),
    ])
    expect(result).toHaveLength(1)
    expect(result[0].kind).toBe('user')
  })

  it('skips user messages whose content is a tool_result block', () => {
    const result = deriveMessages([
      ev({
        type: 'user',
        message: {
          role: 'user',
          content: [
            { type: 'tool_result', tool_use_id: 'tu_1', content: 'output' },
          ],
        },
      }),
    ])
    expect(result).toEqual([])
  })
})
```

- [ ] **Step 2: Run test, confirm failure**

```bash
npm test -- derive
```

Expected: FAIL.

- [ ] **Step 3: Create `src/lib/derive.ts`**

```ts
import type { RawEvent } from '@shared/types'

export type DerivedMessage =
  | { kind: 'user'; text: string; key: string }
  | { kind: 'assistant'; text: string; key: string }
  | { kind: 'toolUse'; tool: string; input: unknown; id: string; key: string }

export function deriveMessages(events: RawEvent[]): DerivedMessage[] {
  const out: DerivedMessage[] = []
  events.forEach((e, idx) => {
    if (e.kind === 'user') {
      const message = (e.raw as Record<string, unknown>)['message'] as
        | Record<string, unknown>
        | undefined
      if (!message) return
      const content = message['content']
      if (typeof content === 'string') {
        if (content.length > 0) out.push({ kind: 'user', text: content, key: String(idx) })
        return
      }
      if (Array.isArray(content)) {
        const texts: string[] = []
        let hasNonTextOnly = true
        for (const block of content) {
          if (!block || typeof block !== 'object') continue
          const type = (block as Record<string, unknown>)['type']
          if (type === 'text' && typeof (block as Record<string, unknown>)['text'] === 'string') {
            texts.push((block as Record<string, unknown>)['text'] as string)
            hasNonTextOnly = false
          }
        }
        if (texts.length > 0) {
          out.push({ kind: 'user', text: texts.join('\n'), key: String(idx) })
        } else if (hasNonTextOnly) {
          // pure tool_result or other non-text: skip
        }
      }
      return
    }

    if (e.kind === 'assistant') {
      const message = (e.raw as Record<string, unknown>)['message'] as
        | Record<string, unknown>
        | undefined
      if (!message) return
      const content = message['content']
      if (!Array.isArray(content)) return
      content.forEach((block, bIdx) => {
        if (!block || typeof block !== 'object') return
        const type = (block as Record<string, unknown>)['type']
        const key = `${idx}-${bIdx}`
        if (type === 'text' && typeof (block as Record<string, unknown>)['text'] === 'string') {
          const text = (block as Record<string, unknown>)['text'] as string
          if (text.length > 0) out.push({ kind: 'assistant', text, key })
        } else if (type === 'tool_use') {
          const b = block as Record<string, unknown>
          out.push({
            kind: 'toolUse',
            tool: typeof b['name'] === 'string' ? (b['name'] as string) : 'Tool',
            input: b['input'] ?? null,
            id: typeof b['id'] === 'string' ? (b['id'] as string) : key,
            key,
          })
        }
      })
    }
    // All other kinds intentionally ignored in MVP A-tier
  })
  return out
}
```

- [ ] **Step 4: Run test, confirm pass**

```bash
npm test -- derive
```

Expected: PASS (7 tests).

- [ ] **Step 5: Create `src/store/chats.ts`**

```ts
import { create } from 'zustand'
import type { ChannelId } from '@shared/types'
import { api } from '../lib/api'
import { useEvents } from './events'

type ChatState = {
  channelId: ChannelId
  sessionId: string | null
  status: 'running' | 'exited' | 'error'
  error?: string
  cwd: string
}

type State = {
  chats: Record<ChannelId, ChatState>
  channelBySession: Record<string, ChannelId>
  init: () => void
  startNew: (cwd: string, initialMessage: string) => Promise<ChannelId>
  resume: (cwd: string, sessionId: string, initialMessage: string) => Promise<ChannelId>
  send: (channelId: ChannelId, text: string) => Promise<void>
  stop: (channelId: ChannelId) => Promise<void>
}

let listenerInstalled = false

export const useChats = create<State>((set, get) => ({
  chats: {},
  channelBySession: {},
  init: () => {
    if (listenerInstalled) return
    listenerInstalled = true
    api().onChatEvent((evt) => {
      if (evt.kind === 'event') {
        const chat = get().chats[evt.channelId]
        const sessionId = evt.event.sessionId ?? chat?.sessionId ?? evt.channelId
        if (chat && evt.event.sessionId && !chat.sessionId) {
          set((s) => ({
            chats: { ...s.chats, [evt.channelId]: { ...chat, sessionId: evt.event.sessionId! } },
            channelBySession: { ...s.channelBySession, [evt.event.sessionId!]: evt.channelId },
          }))
        }
        useEvents.getState().appendEvent(sessionId, evt.event)
      } else if (evt.kind === 'exit') {
        set((s) => {
          const c = s.chats[evt.channelId]
          if (!c) return s
          return { chats: { ...s.chats, [evt.channelId]: { ...c, status: 'exited' } } }
        })
      } else if (evt.kind === 'error') {
        set((s) => {
          const c = s.chats[evt.channelId]
          if (!c) return s
          return {
            chats: { ...s.chats, [evt.channelId]: { ...c, status: 'error', error: evt.message } },
          }
        })
      }
    })
  },
  startNew: async (cwd, initialMessage) => {
    const { channelId } = await api().startChat({ cwd, initialMessage })
    set((s) => ({
      chats: {
        ...s.chats,
        [channelId]: { channelId, sessionId: null, status: 'running', cwd },
      },
    }))
    return channelId
  },
  resume: async (cwd, sessionId, initialMessage) => {
    const { channelId } = await api().startChat({ cwd, sessionId, initialMessage })
    set((s) => ({
      chats: {
        ...s.chats,
        [channelId]: { channelId, sessionId, status: 'running', cwd },
      },
      channelBySession: { ...s.channelBySession, [sessionId]: channelId },
    }))
    return channelId
  },
  send: async (channelId, text) => {
    await api().sendChatMessage(channelId, text)
  },
  stop: async (channelId) => {
    await api().stopChat(channelId)
    set((s) => {
      const c = s.chats[channelId]
      if (!c) return s
      return { chats: { ...s.chats, [channelId]: { ...c, status: 'exited' } } }
    })
  },
}))
```

- [ ] **Step 6: Commit**

```bash
git add -A && git commit -m "feat: chat store and message derivation"
```

---

## Task 10: ChatView + message components

**Files:**
- Create: `src/components/messages/UserMessage.tsx`, `src/components/messages/AssistantMessage.tsx`, `src/components/messages/ToolUseCard.tsx`, `src/components/ChatView.tsx`

- [ ] **Step 1: Create `src/components/messages/UserMessage.tsx`**

```tsx
type Props = { text: string }
export function UserMessage({ text }: Props) {
  return (
    <div className="flex justify-end mb-3">
      <div className="max-w-[75%] rounded-2xl px-4 py-2 bg-primary text-primary-foreground whitespace-pre-wrap">
        {text}
      </div>
    </div>
  )
}
```

- [ ] **Step 2: Create `src/components/messages/AssistantMessage.tsx`**

```tsx
type Props = { text: string }
export function AssistantMessage({ text }: Props) {
  return (
    <div className="flex justify-start mb-3">
      <div className="max-w-[75%] rounded-2xl px-4 py-2 bg-muted text-foreground whitespace-pre-wrap">
        {text}
      </div>
    </div>
  )
}
```

- [ ] **Step 3: Create `src/components/messages/ToolUseCard.tsx`**

```tsx
import { useState } from 'react'

type Props = { tool: string; input: unknown }

export function ToolUseCard({ tool, input }: Props) {
  const [open, setOpen] = useState(false)
  return (
    <div className="flex justify-start mb-3">
      <div className="max-w-[75%] w-full">
        <button
          onClick={() => setOpen((o) => !o)}
          className="text-xs text-muted-foreground hover:text-foreground border border-border rounded px-2 py-1 bg-muted/50"
        >
          🔧 Used {tool} {open ? '▾' : '▸'}
        </button>
        {open && (
          <pre className="mt-1 text-xs bg-muted/30 border border-border rounded p-2 overflow-x-auto whitespace-pre-wrap break-all">
            {JSON.stringify(input, null, 2)}
          </pre>
        )}
      </div>
    </div>
  )
}
```

- [ ] **Step 4: Create `src/components/ChatView.tsx`**

```tsx
import { useEffect, useRef } from 'react'
import { useEvents } from '../store/events'
import { deriveMessages } from '../lib/derive'
import { UserMessage } from './messages/UserMessage'
import { AssistantMessage } from './messages/AssistantMessage'
import { ToolUseCard } from './messages/ToolUseCard'

type Props = {
  sessionId: string
  status?: 'running' | 'exited' | 'error'
  error?: string
}

export function ChatView({ sessionId, status, error }: Props) {
  const events = useEvents((s) => s.eventsBySession[sessionId] ?? [])
  const messages = deriveMessages(events)
  const scrollRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight })
  }, [messages.length])

  return (
    <div className="flex-1 flex flex-col min-h-0">
      {status === 'error' && (
        <div className="bg-red-100 text-red-800 text-sm px-4 py-2 border-b border-red-200">
          Claude error: {error}
        </div>
      )}
      {status === 'exited' && (
        <div className="bg-amber-50 text-amber-800 text-xs px-4 py-1.5 border-b border-amber-200">
          Claude process exited.
        </div>
      )}
      <div ref={scrollRef} className="flex-1 overflow-y-auto px-6 py-6">
        {messages.length === 0 && (
          <div className="text-center text-muted-foreground text-sm mt-8">
            No messages yet
          </div>
        )}
        {messages.map((m) => {
          if (m.kind === 'user') return <UserMessage key={m.key} text={m.text} />
          if (m.kind === 'assistant') return <AssistantMessage key={m.key} text={m.text} />
          return <ToolUseCard key={m.key} tool={m.tool} input={m.input} />
        })}
      </div>
    </div>
  )
}
```

- [ ] **Step 5: Commit**

```bash
git add -A && git commit -m "feat: chat view with user/assistant/tooluse renderers"
```

---

## Task 11: Composer + wire new chat + resume

**Files:**
- Create: `src/components/Composer.tsx`
- Modify: `src/App.tsx`

- [ ] **Step 1: Create `src/components/Composer.tsx`**

```tsx
import { useState, useEffect } from 'react'
import { useProjects } from '../store/projects'

type Props = {
  // If cwdLocked is set, hide the picker and use that cwd
  cwdLocked?: string
  // If unlocked, optional preselected project from sidebar "+" click
  initialCwd?: string
  onSubmit: (text: string, cwd: string) => void
  disabled?: boolean
}

export function Composer({ cwdLocked, initialCwd, onSubmit, disabled }: Props) {
  const { projects } = useProjects()
  const defaultCwd =
    cwdLocked ??
    initialCwd ??
    projects
      .filter((p) => !p.hidden && p.exists)
      .sort((a, b) => b.lastActiveAt - a.lastActiveAt)[0]?.path ??
    ''
  const [cwd, setCwd] = useState(defaultCwd)
  const [text, setText] = useState('')

  useEffect(() => {
    if (!cwdLocked) setCwd(defaultCwd)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [defaultCwd])

  function submit() {
    if (!text.trim()) return
    const effective = cwdLocked ?? cwd
    if (!effective) return
    onSubmit(text, effective)
    setText('')
  }

  return (
    <div className="border-t border-border p-3 bg-background">
      {!cwdLocked && (
        <div className="mb-2 flex items-center gap-2 text-xs text-muted-foreground">
          <span>📁</span>
          <select
            value={cwd}
            onChange={(e) => setCwd(e.target.value)}
            className="border border-border rounded px-2 py-1 bg-background text-xs flex-1 max-w-md"
          >
            {projects
              .filter((p) => !p.hidden)
              .map((p) => (
                <option key={p.path} value={p.path}>
                  {p.path}
                </option>
              ))}
          </select>
        </div>
      )}
      <div className="flex gap-2">
        <textarea
          value={text}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && !e.shiftKey) {
              e.preventDefault()
              submit()
            }
          }}
          disabled={disabled}
          rows={3}
          placeholder="Type a message — Enter to send, Shift+Enter for newline"
          className="flex-1 border border-border rounded px-3 py-2 text-sm resize-none bg-background"
        />
        <button
          onClick={submit}
          disabled={disabled || !text.trim()}
          className="self-end px-4 py-2 rounded bg-primary text-primary-foreground text-sm font-medium disabled:opacity-50"
        >
          Send
        </button>
      </div>
    </div>
  )
}
```

- [ ] **Step 2: Replace `src/App.tsx`**

```tsx
import { useEffect, useState } from 'react'
import { Sidebar } from './components/Sidebar'
import { ChatView } from './components/ChatView'
import { Composer } from './components/Composer'
import { useChats } from './store/chats'
import { useEvents } from './store/events'
import { useSessions } from './store/sessions'
import type { SessionSummary } from '@shared/types'

type View =
  | { mode: 'empty' }
  | { mode: 'newChat'; preselectedProject?: string; channelId?: string; sessionId?: string }
  | { mode: 'session'; session: SessionSummary; channelId?: string }

export default function App() {
  const [view, setView] = useState<View>({ mode: 'empty' })
  const { selectSession } = useSessions()
  const { loadFromFile } = useEvents()
  const chats = useChats()

  useEffect(() => {
    chats.init()
  }, [chats])

  function openSession(s: SessionSummary) {
    selectSession(s.id)
    loadFromFile(s.id, s.jsonlPath)
    setView({ mode: 'session', session: s })
  }

  function newChat(projectPath?: string) {
    selectSession(null)
    setView({ mode: 'newChat', preselectedProject: projectPath })
  }

  async function handleNewChatSubmit(text: string, cwd: string) {
    const channelId = await chats.startNew(cwd, text)
    setView((v) => (v.mode === 'newChat' ? { ...v, channelId } : v))
  }

  async function handleResumeSubmit(text: string, cwd: string, session: SessionSummary) {
    // Reuse existing channel if it's still running for this session
    const existing = chats.channelBySession[session.id]
    const existingChat = existing ? chats.chats[existing] : undefined
    if (existingChat && existingChat.status === 'running') {
      await chats.send(existing, text)
      // Push the user message into events immediately so it appears in the view
      useEvents.getState().appendEvent(session.id, {
        raw: { type: 'user', message: { role: 'user', content: text } },
        kind: 'user',
      })
      return
    }
    const channelId = await chats.resume(cwd, session.id, text)
    setView((v) => (v.mode === 'session' ? { ...v, channelId } : v))
  }

  const channelId =
    view.mode === 'newChat'
      ? view.channelId
      : view.mode === 'session'
        ? view.channelId ?? chats.channelBySession[view.session.id]
        : undefined
  const chatState = channelId ? chats.chats[channelId] : undefined
  const sessionId =
    view.mode === 'session'
      ? view.session.id
      : chatState?.sessionId ?? channelId ?? ''

  return (
    <div className="flex h-full">
      <Sidebar onNewChat={newChat} onOpenSession={openSession} />
      <main className="flex-1 flex flex-col min-h-0">
        {view.mode === 'empty' && (
          <div className="flex-1 flex items-center justify-center text-muted-foreground">
            Select a session or start a new chat
          </div>
        )}
        {view.mode === 'newChat' && !view.channelId && (
          <>
            <div className="flex-1 flex items-center justify-center text-muted-foreground">
              <p>New chat — type your first message below</p>
            </div>
            <Composer
              initialCwd={view.preselectedProject}
              onSubmit={handleNewChatSubmit}
            />
          </>
        )}
        {view.mode === 'newChat' && view.channelId && (
          <>
            <ChatView sessionId={sessionId} status={chatState?.status} error={chatState?.error} />
            <Composer
              cwdLocked={chatState?.cwd}
              onSubmit={(text, cwd) => handleNewChatSubmit(text, cwd)}
              disabled={chatState?.status !== 'running' && chatState?.status !== undefined}
            />
          </>
        )}
        {view.mode === 'session' && (
          <>
            <ChatView sessionId={view.session.id} status={chatState?.status} error={chatState?.error} />
            <Composer
              cwdLocked={view.session.projectPath}
              onSubmit={(text, cwd) => handleResumeSubmit(text, cwd, view.session)}
            />
          </>
        )}
      </main>
    </div>
  )
}
```

- [ ] **Step 3: Verify typecheck**

```bash
npm run typecheck
```

Expected: no errors.

- [ ] **Step 4: Smoke test — new chat**

```bash
npm run dev
```

1. Click "+ New Chat"
2. Pick a project from the cwd dropdown (or accept default)
3. Type "say hello in one word" and press Enter
4. **Expected:** assistant bubble appears with reply; if tool use happens you see "🔧 Used X" cards; status bar shows when process exits.

- [ ] **Step 5: Smoke test — open existing session**

1. Expand any project in the sidebar
2. Click any old session
3. **Expected:** full message history loads, scrollable, no errors.

- [ ] **Step 6: Smoke test — resume session**

1. Open an old session
2. Type a message and press Enter
3. **Expected:** new exchange appears in same view. After app close, `~/.claude/projects/<encoded>/<same uuid>.jsonl` has the new lines appended. Verify with:

```bash
tail -5 ~/.claude/projects/<encoded>/<session-id>.jsonl
```

- [ ] **Step 7: Commit**

```bash
git add -A && git commit -m "feat: composer wired to new chat and resume flows"
```

---

## Task 12: Error handling polish + claude binary check

**Files:**
- Modify: `electron/main.ts`, `electron/claude-process.ts`

- [ ] **Step 1: Add binary check to `electron/main.ts`**

Add before `createWindow`:

```ts
import { execSync } from 'node:child_process'
import { dialog } from 'electron'

function checkClaudeBinary(): boolean {
  try {
    execSync('command -v claude', { stdio: 'ignore' })
    return true
  } catch {
    return false
  }
}
```

In `app.whenReady().then(...)` replace the body with:

```ts
app.whenReady().then(() => {
  if (!checkClaudeBinary()) {
    dialog.showErrorBox(
      'Claude CLI not found',
      'ClaudeDance needs the `claude` command on PATH. Install Claude Code first: https://docs.claude.com/en/docs/claude-code',
    )
    app.quit()
    return
  }
  createWindow()
  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow()
  })
})
```

- [ ] **Step 2: Harden `electron/claude-process.ts` spawn error**

Replace the `spawn('claude', ...)` block with try/catch:

```ts
let proc: ChildProcessWithoutNullStreams
try {
  proc = spawn('claude', args, { cwd: req.cwd, env: { ...process.env } })
} catch (err) {
  const id = randomUUID()
  sendChatEvent(win, {
    kind: 'error',
    channelId: id,
    message: `Failed to spawn claude: ${String(err)}`,
  })
  sendChatEvent(win, { kind: 'exit', channelId: id, code: null })
  return id
}
```

(Place this in the function body where `proc` is created; everything else remains unchanged.)

- [ ] **Step 3: Verify**

```bash
npm run typecheck && npm test
```

Expected: typecheck clean, all tests pass.

```bash
npm run dev
```

Manual: rename `claude` temporarily on PATH (e.g., `sudo mv $(which claude) /tmp/claude.bak`), run `npm run dev` → expect error dialog. Restore: `sudo mv /tmp/claude.bak $(which claude)`.

- [ ] **Step 4: Commit**

```bash
git add -A && git commit -m "feat: claude binary check on startup and spawn error handling"
```

---

## Task 13: Final verification against success criteria

**Files:** (no code changes; this task confirms the MVP works end-to-end)

- [ ] **Step 1: Run all tests**

```bash
npm test
```

Expected: ALL PASS (4 test files, ~23 tests).

- [ ] **Step 2: Run typecheck**

```bash
npm run typecheck
```

Expected: no errors.

- [ ] **Step 3: Build**

```bash
npm run build
```

Expected: succeeds, `out/main/`, `out/preload/`, `out/renderer/` populated.

- [ ] **Step 4: Walk the success criteria from the spec**

Open `npm run dev` and verify each:

1. **Project list populated** — sidebar shows your ~20 projects with session counts. ✓
2. **New session works** — click "+ New Chat", send "say hi", get assistant reply. ✓
3. **Tool use folds** — ask "list the files in this directory"; see `🔧 Used Bash` card; click to expand. ✓
4. **Resume works** — open old session, send new message, reply continues thread. ✓
5. **CLI interop** — close app, run `claude -c` in the cwd you just chatted in; expect to see the same session continuing. ✓
6. **Grouping + search** — sessions split into Today / Yesterday / This Week / Earlier; search box filters by title. ✓
7. **Switching preserves events** — open session A, send message, switch to session B, switch back to A → see previous reply still there. ✓

- [ ] **Step 5: Commit verification log**

If anything failed in Step 4, fix and re-run the relevant earlier task. Otherwise:

```bash
git tag mvp-v0.1.0
git log --oneline | head -20
```

Tag MVP and move on.

---

## Self-Review Notes

- **Spec coverage:** Each spec section maps to tasks — scaffold (1), shared utils + encoding (2), scanner (3), session reader (4), Tailwind (5), IPC (6), Sidebar UI (7), claude process (8), chat store + derive (9), ChatView (10), Composer wire-up (11), error handling (12), final verify (13). Successcriteria #1–7 are explicitly checked in Task 13.
- **Out of scope confirmed unbuilt:** No rewind/fork code, no fs.watch, no custom title editor, no startup-param UI, no specialized Bash/Edit/Read renderers, no partial-message streaming UI, no hook-event visualization. Each is listed as "not in MVP" in the spec.
- **Type consistency:** `RawEvent`, `Project`, `SessionSummary`, `IpcChatEvent`, `ChannelId`, `ChatStartRequest`, `ChatStartResponse` are all defined once in `shared/types.ts` and referenced consistently. The `deriveMessages` / `DerivedMessage` types are renderer-only.
- **stdin format assumption:** Task 8 writes `{"type":"user","message":{"role":"user","content":"..."}}\n`. This mirrors the assistant-side jsonl shape and is the most likely format `--input-format stream-json` expects. If smoke test (Task 8 Step 6) shows the format is wrong, adjust the `payload` shape in `sendUserMessage`; no other code change needed.
- **Process eviction:** `MAX_CHANNELS = 3`, LRU is the insertion order via `Map.keys().next()`. Simple and matches spec.
- **No placeholders** in code blocks; every step contains runnable content.
