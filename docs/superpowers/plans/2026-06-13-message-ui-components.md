# Message UI Components Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Upgrade ClaudeDance message area with syntax-highlighted code blocks, copy buttons, collapsible sections, streaming cursor, and message entrance animations.

**Architecture:** Create standalone utility components (CodeBlock, CopyButton, Collapsible) and hooks (useCopyToClipboard), then integrate into existing message components. shiki 4.2.0 (already installed) is activated via a singleton highlighter with JavaScript engine. All auxiliary interactions use CSS + native APIs; no new dependencies needed.

**Tech Stack:** React 18, TypeScript, Tailwind CSS 3.4, shiki 4.2.0, react-markdown 10.1.0, remark-gfm 4.0.1, lucide-react

---

## File Structure

```
src/
  lib/
    shiki.ts                    [新建] shiki singleton highlighter
    useCopyToClipboard.ts       [新建] clipboard hook
  components/
    CodeBlock.tsx               [新建] 语法高亮代码块
    CopyButton.tsx              [新建] 复制按钮（Copy/Check 图标切换）
    Collapsible.tsx             [新建] 可折叠容器
    MessageActions.tsx          [新建] 消息操作条
    messages/
      AssistantMessage.tsx      [修改] 覆写 pre/code → CodeBlock，流式光标，操作条
      UserMessage.tsx           [修改] 基础 Markdown 渲染
      ToolUseCard.tsx           [修改] 状态图标
      ThinkingIndicator.tsx     [修改] 可折叠
      ChatView.tsx              [修改] 消息入场动画
  index.css                     [修改] 行号、shiki 双主题、流式光标、入场动画
tailwind.config.js              [修改] 暗色模式准备
```

---

### Task 1: Create shiki singleton highlighter

**Files:**
- Create: `src/lib/shiki.ts`

- [ ] **Step 1: Create the shiki singleton module**

```typescript
// src/lib/shiki.ts
import { createHighlighterCore } from 'shiki/core'
import { createJavaScriptRegexEngine } from 'shiki/engine/javascript'

export const highlighterPromise = createHighlighterCore({
  themes: [
    import('@shikijs/themes/github-light'),
    import('@shikijs/themes/github-dark'),
  ],
  langs: [
    import('@shikijs/langs/typescript'),
    import('@shikijs/langs/javascript'),
    import('@shikijs/langs/python'),
    import('@shikijs/langs/rust'),
    import('@shikijs/langs/go'),
    import('@shikijs/langs/bash'),
    import('@shikijs/langs/json'),
    import('@shikijs/langs/yaml'),
    import('@shikijs/langs/markdown'),
    import('@shikijs/langs/css'),
    import('@shikijs/langs/html'),
    import('@shikijs/langs/sql'),
    import('@shikijs/langs/shell'),
  ],
  engine: createJavaScriptRegexEngine(),
})

/** Resolved highlighter — call after await highlighterPromise */
export type Highlighter = Awaited<typeof highlighterPromise>
```

- [ ] **Step 2: Verify no TypeScript errors**

```bash
cd /Users/steve/CodeLib/GitHub/claude-dance
npx tsc --noEmit -p tsconfig.json 2>&1 | head -20
```

Expected: no errors related to `src/lib/shiki.ts`

- [ ] **Step 3: Commit**

```bash
git add src/lib/shiki.ts
git commit -m "feat: add shiki singleton highlighter with JS engine"
```

---

### Task 2: Create useCopyToClipboard hook

**Files:**
- Create: `src/lib/useCopyToClipboard.ts`

- [ ] **Step 1: Create the hook**

```typescript
// src/lib/useCopyToClipboard.ts
import { useState, useCallback, useRef, useEffect } from 'react'

export function useCopyToClipboard(resetDelay = 2000) {
  const [copied, setCopied] = useState(false)
  const timeoutRef = useRef<ReturnType<typeof setTimeout>>()

  const copy = useCallback(async (text: string) => {
    await navigator.clipboard.writeText(text)
    setCopied(true)
    if (timeoutRef.current) clearTimeout(timeoutRef.current)
    timeoutRef.current = setTimeout(() => setCopied(false), resetDelay)
  }, [resetDelay])

  useEffect(() => {
    return () => {
      if (timeoutRef.current) clearTimeout(timeoutRef.current)
    }
  }, [])

  return { copied, copy }
}
```

- [ ] **Step 2: Verify no TypeScript errors**

```bash
npx tsc --noEmit -p tsconfig.json 2>&1 | head -20
```

Expected: no errors

- [ ] **Step 3: Commit**

```bash
git add src/lib/useCopyToClipboard.ts
git commit -m "feat: add useCopyToClipboard hook"
```

---

### Task 3: Create CopyButton component

**Files:**
- Create: `src/components/CopyButton.tsx`

- [ ] **Step 1: Create the CopyButton component**

```typescript
// src/components/CopyButton.tsx
import { Copy, Check } from 'lucide-react'
import { useCopyToClipboard } from '../lib/useCopyToClipboard'

type Props = {
  text: string
  label?: string
}

export function CopyButton({ text, label }: Props) {
  const { copied, copy } = useCopyToClipboard()

  return (
    <button
      onClick={() => copy(text)}
      className="h-6 w-6 flex items-center justify-center rounded-md
                 text-fg-subtle hover:text-fg-default hover:bg-bg-hover
                 transition-colors"
      title={copied ? 'Copied!' : label ?? 'Copy'}
      aria-label={copied ? 'Copied!' : label ?? 'Copy'}
    >
      {copied ? (
        <Check size={13} strokeWidth={2.5} className="text-green-600" />
      ) : (
        <Copy size={12} strokeWidth={2} />
      )}
    </button>
  )
}
```

- [ ] **Step 2: Verify no TypeScript errors**

```bash
npx tsc --noEmit -p tsconfig.json 2>&1 | head -20
```

Expected: no errors

- [ ] **Step 3: Commit**

```bash
git add src/components/CopyButton.tsx
git commit -m "feat: add CopyButton component with checkmark feedback"
```

---

### Task 4: Create Collapsible component

**Files:**
- Create: `src/components/Collapsible.tsx`

- [ ] **Step 1: Create the Collapsible component**

```typescript
// src/components/Collapsible.tsx
import { useState, ReactNode } from 'react'
import { ChevronRight } from 'lucide-react'

type Props = {
  trigger: ReactNode
  children: ReactNode
  defaultOpen?: boolean
  className?: string
}

export function Collapsible({ trigger, children, defaultOpen = false, className }: Props) {
  const [open, setOpen] = useState(defaultOpen)

  return (
    <div className={className}>
      <button
        onClick={() => setOpen((o) => !o)}
        className="flex items-center gap-1.5 text-left w-full"
        aria-expanded={open}
      >
        <ChevronRight
          size={11}
          strokeWidth={2.5}
          className={'shrink-0 text-fg-subtle transition-transform duration-150 ' + (open ? 'rotate-90' : '')}
        />
        {trigger}
      </button>
      <div
        className="grid transition-[grid-template-rows] duration-200 ease-out"
        style={{ gridTemplateRows: open ? '1fr' : '0fr' }}
      >
        <div className="overflow-hidden">
          {children}
        </div>
      </div>
    </div>
  )
}
```

- [ ] **Step 2: Verify no TypeScript errors**

```bash
npx tsc --noEmit -p tsconfig.json 2>&1 | head -20
```

Expected: no errors

- [ ] **Step 3: Commit**

```bash
git add src/components/Collapsible.tsx
git commit -m "feat: add Collapsible component with CSS grid animation"
```

---

### Task 5: Create CodeBlock component

**Files:**
- Create: `src/components/CodeBlock.tsx`

- [ ] **Step 1: Create the CodeBlock component**

```typescript
// src/components/CodeBlock.tsx
import { useState, useEffect, useRef } from 'react'
import { highlighterPromise, type Highlighter } from '../lib/shiki'
import { CopyButton } from './CopyButton'

type Props = {
  code: string
  lang: string
}

const MAX_HEIGHT = 400 // px, ~25 lines

export function CodeBlock({ code, lang }: Props) {
  const [html, setHtml] = useState<string>('')
  const [isReady, setIsReady] = useState(false)
  const [expanded, setExpanded] = useState(false)
  const [isOverflowing, setIsOverflowing] = useState(false)
  const codeRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    let cancelled = false
    highlighterPromise.then((h: Highlighter) => {
      if (cancelled) return
      try {
        const result = h.codeToHtml(code, {
          lang: lang || 'text',
          themes: { light: 'github-light', dark: 'github-dark' },
          defaultColor: false,
        })
        setHtml(result)
      } catch {
        // Language not loaded, fallback to plain text
        setHtml('')
      }
      setIsReady(true)
    })
    return () => { cancelled = true }
  }, [code, lang])

  useEffect(() => {
    if (!isReady || !codeRef.current) return
    const el = codeRef.current.querySelector('pre')
    if (el && el.scrollHeight > MAX_HEIGHT) {
      setIsOverflowing(true)
    }
  }, [isReady, html])

  const lineCount = code.split('\n').length

  return (
    <div className="code-block my-2 rounded-lg border border-line overflow-hidden group">
      {/* Header */}
      <div className="flex items-center justify-between px-3 py-1.5
                      bg-bg-panel border-b border-line">
        <span className="text-[11px] font-medium text-fg-subtle font-mono">
          {lang || 'text'}
        </span>
        <div className="flex items-center gap-1">
          {isOverflowing && (
            <button
              onClick={() => setExpanded((o) => !o)}
              className="text-[11px] text-fg-muted hover:text-fg-default
                         px-1.5 py-0.5 rounded hover:bg-bg-hover transition-colors"
            >
              {expanded ? 'Collapse' : `${lineCount} lines`}
            </button>
          )}
          <CopyButton text={code} label="Copy code" />
        </div>
      </div>

      {/* Code body */}
      <div
        ref={codeRef}
        className="relative overflow-auto bg-bg-inset"
        style={{ maxHeight: isOverflowing && !expanded ? `${MAX_HEIGHT}px` : undefined }}
      >
        {isReady && html ? (
          <div
            className="shiki-code"
            dangerouslySetInnerHTML={{ __html: html }}
          />
        ) : (
          <pre className="p-3 text-[12.5px] leading-[1.55] font-mono text-fg-muted overflow-x-auto">
            <code>{code}</code>
          </pre>
        )}

        {/* Gradient fade when collapsed */}
        {isOverflowing && !expanded && (
          <div className="absolute bottom-0 left-0 right-0 h-12
                          bg-gradient-to-t from-bg-inset to-transparent
                          pointer-events-none" />
        )}
      </div>
    </div>
  )
}
```

- [ ] **Step 2: Verify no TypeScript errors**

```bash
npx tsc --noEmit -p tsconfig.json 2>&1 | head -20
```

Expected: no errors

- [ ] **Step 3: Commit**

```bash
git add src/components/CodeBlock.tsx
git commit -m "feat: add CodeBlock with shiki highlighting, copy, and collapse"
```

---

### Task 6: Add CSS for line numbers, shiki dual theme, streaming cursor, and entrance animation

**Files:**
- Modify: `src/index.css`

- [ ] **Step 1: Append new CSS rules to index.css**

Append the following to the end of `src/index.css`:

```css
/* === Code Block: line numbers via CSS counters === */
.code-block .shiki-code pre {
  counter-reset: line;
  margin: 0;
  padding: 0.75rem;
}
.code-block .shiki-code .line {
  counter-increment: line;
  display: block;
  min-height: 1.55em;
}
.code-block .shiki-code .line::before {
  content: counter(line);
  display: inline-block;
  width: 2.5em;
  margin-right: 1em;
  text-align: right;
  color: #b3b3af;
  border-right: 1px solid rgba(0,0,0,0.08);
  padding-right: 0.75em;
  user-select: none;
  -webkit-user-select: none;
}

/* === Shiki dual theme: activate dark mode when <html class="dark"> === */
html.dark .shiki-code pre,
html.dark .shiki-code code,
html.dark .shiki-code span {
  color: var(--shiki-dark) !important;
  background-color: var(--shiki-dark-bg) !important;
  font-style: var(--shiki-dark-font-style) !important;
  font-weight: var(--shiki-dark-font-weight) !important;
  text-decoration: var(--shiki-dark-text-decoration) !important;
}

/* === Streaming cursor === */
@keyframes cursor-blink {
  0%, 100% { opacity: 1; }
  50% { opacity: 0; }
}
.streaming-cursor::after {
  content: '\2588';
  animation: cursor-blink 1s step-end infinite;
  opacity: 0.6;
  margin-left: 1px;
  color: currentColor;
}

/* === Message entrance animation === */
@keyframes message-enter {
  from {
    opacity: 0;
    transform: translateY(8px);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
}
.message-enter {
  animation: message-enter 200ms ease-out;
}
```

- [ ] **Step 2: Verify no build errors**

```bash
npm run build 2>&1 | tail -5
```

Expected: build succeeds

- [ ] **Step 3: Commit**

```bash
git add src/index.css
git commit -m "feat: add CSS for line numbers, shiki dark theme, streaming cursor, entrance animation"
```

---

### Task 7: Modify AssistantMessage — integrate CodeBlock, streaming cursor, message actions

**Files:**
- Modify: `src/components/messages/AssistantMessage.tsx`

- [ ] **Step 1: Replace AssistantMessage.tsx content**

```typescript
// src/components/messages/AssistantMessage.tsx
import { useRef, useEffect } from 'react'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import { CodeBlock } from '../CodeBlock'
import { MessageActions } from '../MessageActions'

type Props = {
  text: string
  isStreaming?: boolean
  showActions?: boolean
}

export function AssistantMessage({ text, isStreaming, showActions }: Props) {
  const containerRef = useRef<HTMLDivElement>(null)

  // Track if this is a new message for entrance animation
  const isNew = useRef(true)
  useEffect(() => { isNew.current = false }, [])

  return (
    <div className={'px-6 py-2.5 group/msg' + (isNew.current ? ' message-enter' : '')}>
      <div className="mx-auto max-w-4xl flex justify-start">
        <div
          ref={containerRef}
          className={'w-full rounded-2xl rounded-tl-sm px-3.5 py-2 ' +
                     'bg-bubble-assistant border border-bubble-assistant-border ' +
                     'text-fg-default text-[13.5px] leading-[1.6] shadow-sm ' +
                     'markdown overflow-hidden' +
                     (isStreaming ? ' streaming-cursor' : '')}
        >
          <ReactMarkdown
            remarkPlugins={[remarkGfm]}
            components={{
              p: ({ children }) => <p className="my-1.5 first:mt-0 last:mb-0">{children}</p>,
              ul: ({ children }) => <ul className="my-2 ml-4 list-disc space-y-1">{children}</ul>,
              ol: ({ children }) => <ol className="my-2 ml-4 list-decimal space-y-1">{children}</ol>,
              li: ({ children }) => <li className="leading-[1.55]">{children}</li>,
              h1: ({ children }) => <h1 className="text-[16px] font-semibold mt-3 mb-1.5">{children}</h1>,
              h2: ({ children }) => <h2 className="text-[15px] font-semibold mt-2.5 mb-1.5">{children}</h2>,
              h3: ({ children }) => <h3 className="text-[14px] font-semibold mt-2 mb-1">{children}</h3>,
              a: ({ href, children }) => (
                <a href={href} className="text-accent hover:underline" target="_blank" rel="noreferrer">
                  {children}
                </a>
              ),
              strong: ({ children }) => <strong className="font-semibold">{children}</strong>,
              em: ({ children }) => <em className="italic">{children}</em>,
              pre: ({ children }) => {
                // Extract code and lang from the nested <code> element
                const codeEl = children as React.ReactElement<{
                  className?: string
                  children?: string
                }>
                const className = codeEl?.props?.className ?? ''
                const code = String(codeEl?.props?.children ?? '').replace(/\n$/, '')
                const lang = className.replace('language-', '') || ''
                if (code) return <CodeBlock code={code} lang={lang} />
                return <pre>{children}</pre>
              },
              code: ({ className, children }) => {
                const isBlock = /language-/.test(className ?? '')
                if (isBlock) return <code>{children}</code>
                return (
                  <code className="font-mono text-[12.5px] px-1 py-0.5 rounded
                                   bg-bg-hover text-fg-default border border-line/60">
                    {children}
                  </code>
                )
              },
              blockquote: ({ children }) => (
                <blockquote className="my-2 pl-3 border-l-2 border-line-strong text-fg-muted">
                  {children}
                </blockquote>
              ),
              hr: () => <hr className="my-3 border-line" />,
              table: ({ children }) => (
                <div className="my-2 overflow-x-auto">
                  <table className="min-w-full text-[12.5px] border-collapse">{children}</table>
                </div>
              ),
              th: ({ children }) => (
                <th className="text-left font-semibold px-2 py-1 border-b border-line">{children}</th>
              ),
              td: ({ children }) => <td className="px-2 py-1 border-b border-line/40">{children}</td>,
            }}
          >
            {text}
          </ReactMarkdown>
        </div>
      </div>

      {/* Message actions bar */}
      {showActions && (
        <div className="mx-auto max-w-4xl flex justify-start mt-1">
          <MessageActions text={text} />
        </div>
      )}
    </div>
  )
}
```

- [ ] **Step 2: Verify no TypeScript errors**

```bash
npx tsc --noEmit -p tsconfig.json 2>&1 | head -20
```

Expected: no errors

- [ ] **Step 3: Commit**

```bash
git add src/components/messages/AssistantMessage.tsx
git commit -m "feat: integrate CodeBlock, streaming cursor, and actions into AssistantMessage"
```

---

### Task 8: Create MessageActions component

**Files:**
- Create: `src/components/MessageActions.tsx`

- [ ] **Step 1: Create MessageActions**

```typescript
// src/components/MessageActions.tsx
import { Copy } from 'lucide-react'
import { useCopyToClipboard } from '../lib/useCopyToClipboard'

type Props = {
  text: string
}

export function MessageActions({ text }: Props) {
  const { copied, copy } = useCopyToClipboard()

  return (
    <div className="flex items-center gap-0.5 opacity-0 group-hover/msg:opacity-100 transition-opacity">
      <button
        onClick={() => copy(text)}
        className="h-6 flex items-center gap-1 px-1.5 rounded-md
                   text-[11px] text-fg-subtle hover:text-fg-default hover:bg-bg-hover
                   transition-colors"
        title="Copy message"
      >
        <Copy size={11} strokeWidth={2} />
        {copied ? (
          <span className="text-green-600">Copied</span>
        ) : (
          <span>Copy</span>
        )}
      </button>
    </div>
  )
}
```

- [ ] **Step 2: Verify no TypeScript errors**

```bash
npx tsc --noEmit -p tsconfig.json 2>&1 | head -20
```

Expected: no errors

- [ ] **Step 3: Commit**

```bash
git add src/components/MessageActions.tsx
git commit -m "feat: add MessageActions component with copy button"
```

---

### Task 9: Modify UserMessage — basic Markdown rendering

**Files:**
- Modify: `src/components/messages/UserMessage.tsx`

- [ ] **Step 1: Replace UserMessage.tsx content**

```typescript
// src/components/messages/UserMessage.tsx
import { useState, useRef, useEffect } from 'react'
import { Pencil, RotateCcw } from 'lucide-react'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'

type Props = {
  text: string
  onRewind?: () => void
  onEditResend?: (text: string) => void
}

export function UserMessage({ text, onRewind, onEditResend }: Props) {
  const [menuOpen, setMenuOpen] = useState(false)
  const menuRef = useRef<HTMLDivElement>(null)
  const hasActions = onRewind || onEditResend

  // Entrance animation
  const isNew = useRef(true)
  useEffect(() => { isNew.current = false }, [])

  useEffect(() => {
    if (!menuOpen) return
    function onClickOutside(e: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setMenuOpen(false)
      }
    }
    document.addEventListener('mousedown', onClickOutside)
    return () => document.removeEventListener('mousedown', onClickOutside)
  }, [menuOpen])

  return (
    <div className={'px-6 py-2.5 group/user' + (isNew.current ? ' message-enter' : '')}>
      <div className="mx-auto max-w-4xl flex items-start justify-end gap-1.5">
        {/* Action menu anchor */}
        {hasActions && (
          <div className="relative mt-1.5 shrink-0" ref={menuRef}>
            <button
              onClick={() => setMenuOpen((o) => !o)}
              className="h-6 w-6 flex items-center justify-center rounded-md
                         text-fg-subtle hover:text-fg-default hover:bg-bg-active
                         opacity-0 group-hover/user:opacity-100 transition-opacity"
              title="Message actions"
              aria-label="Message actions"
            >
              <Pencil size={11} strokeWidth={2} />
            </button>

            {menuOpen && (
              <div className="absolute right-0 top-full mt-1 w-40 bg-bg-panel border border-line
                              rounded-xl shadow-xl overflow-hidden z-50">
                {onEditResend && (
                  <button
                    onClick={() => {
                      setMenuOpen(false)
                      onEditResend(text)
                    }}
                    className="w-full flex items-center gap-2 px-3 py-2 text-[12px]
                               text-fg-muted hover:bg-bg-hover hover:text-fg-default
                               text-left transition-colors"
                  >
                    <Pencil size={12} className="text-fg-subtle shrink-0" />
                    Edit &amp; resend
                  </button>
                )}
                {onRewind && (
                  <button
                    onClick={() => {
                      setMenuOpen(false)
                      onRewind()
                    }}
                    className="w-full flex items-center gap-2 px-3 py-2 text-[12px]
                               text-fg-muted hover:bg-bg-hover hover:text-fg-default
                               text-left transition-colors"
                  >
                    <RotateCcw size={12} className="text-fg-subtle shrink-0" />
                    Revert files
                  </button>
                )}
              </div>
            )}
          </div>
        )}

        <div className="max-w-[85%] rounded-2xl rounded-tr-sm px-3.5 py-2
                        bg-bubble-user text-bubble-user-fg text-[13.5px]
                        leading-[1.55] shadow-sm user-markdown">
          <ReactMarkdown
            remarkPlugins={[remarkGfm]}
            components={{
              p: ({ children }) => <p className="my-0.5 first:mt-0 last:mb-0">{children}</p>,
              code: ({ className, children }) => {
                const isBlock = /language-/.test(className ?? '')
                if (isBlock) return <code className="block font-mono text-[12px]">{children}</code>
                return (
                  <code className="font-mono text-[12px] px-1 py-0.5 rounded
                                   bg-white/10 text-inherit">
                    {children}
                  </code>
                )
              },
              a: ({ href, children }) => (
                <a href={href} className="underline decoration-white/30 hover:decoration-white/60"
                   target="_blank" rel="noreferrer">
                  {children}
                </a>
              ),
              strong: ({ children }) => <strong className="font-semibold">{children}</strong>,
              em: ({ children }) => <em className="italic">{children}</em>,
            }}
          >
            {text}
          </ReactMarkdown>
        </div>
      </div>
    </div>
  )
}
```

- [ ] **Step 2: Verify no TypeScript errors**

```bash
npx tsc --noEmit -p tsconfig.json 2>&1 | head -20
```

Expected: no errors

- [ ] **Step 3: Commit**

```bash
git add src/components/messages/UserMessage.tsx
git commit -m "feat: add Markdown rendering and entrance animation to UserMessage"
```

---

### Task 10: Modify ToolUseCard — add status icons

**Files:**
- Modify: `src/components/messages/ToolUseCard.tsx`

- [ ] **Step 1: Replace ToolUseCard.tsx content**

```typescript
// src/components/messages/ToolUseCard.tsx
import { ChevronRight, Wrench, Loader2, Check, X } from 'lucide-react'
import { Collapsible } from '../Collapsible'

type Props = {
  tool: string
  input: unknown
  status?: 'pending' | 'running' | 'done' | 'error'
}

function summariseInput(input: unknown): string {
  if (!input || typeof input !== 'object') return ''
  const obj = input as Record<string, unknown>
  const candidates = ['command', 'file_path', 'path', 'pattern', 'query', 'url', 'description']
  for (const k of candidates) {
    const v = obj[k]
    if (typeof v === 'string' && v.length > 0) return v
  }
  for (const v of Object.values(obj)) {
    if (typeof v === 'string' && v.length > 0) return v
  }
  return ''
}

function StatusIcon({ status }: { status?: string }) {
  switch (status) {
    case 'running':
      return <Loader2 size={11} className="shrink-0 text-blue-500 animate-spin" />
    case 'done':
      return <Check size={11} className="shrink-0 text-green-600" />
    case 'error':
      return <X size={11} className="shrink-0 text-red-500" />
    default:
      return <Wrench size={11} className="shrink-0 text-fg-subtle" />
  }
}

export function ToolUseCard({ tool, input, status }: Props) {
  const summary = summariseInput(input)

  return (
    <div className="px-6 py-1.5">
      <div className="mx-auto max-w-4xl pl-9">
        <Collapsible
          trigger={
            <div className="flex items-center gap-2 text-[12px] text-fg-muted
                            hover:text-fg-default transition-colors min-w-0">
              <StatusIcon status={status} />
              <span className="font-medium">{tool}</span>
              {summary && (
                <span className="font-mono text-fg-subtle truncate min-w-0">
                  · {summary}
                </span>
              )}
            </div>
          }
        >
          <pre
            className="mt-1.5 ml-4 p-2.5 rounded-md bg-bg-inset border border-line/60
                       text-[11.5px] font-mono leading-[1.5] text-fg-muted
                       overflow-x-auto whitespace-pre-wrap break-all"
          >
            {JSON.stringify(input, null, 2)}
          </pre>
        </Collapsible>
      </div>
    </div>
  )
}
```

- [ ] **Step 2: Verify no TypeScript errors**

```bash
npx tsc --noEmit -p tsconfig.json 2>&1 | head -20
```

Expected: no errors

- [ ] **Step 3: Commit**

```bash
git add src/components/messages/ToolUseCard.tsx
git commit -m "feat: add status icons and Collapsible to ToolUseCard"
```

---

### Task 11: Modify ThinkingIndicator — make collapsible

**Files:**
- Modify: `src/components/messages/ThinkingIndicator.tsx`

- [ ] **Step 1: Replace ThinkingIndicator.tsx content**

```typescript
// src/components/messages/ThinkingIndicator.tsx
import { useState, useEffect } from 'react'
import { ChevronRight } from 'lucide-react'

export function ThinkingIndicator() {
  const [elapsed, setElapsed] = useState(0)
  const [expanded, setExpanded] = useState(false)

  useEffect(() => {
    const t = setInterval(() => setElapsed((s) => s + 1), 1000)
    return () => clearInterval(t)
  }, [])

  return (
    <div className="px-6 py-2 pb-1">
      <div className="mx-auto max-w-4xl">
        <button
          onClick={() => setExpanded((o) => !o)}
          className="flex items-center gap-2.5 text-fg-subtle hover:text-fg-default transition-colors"
        >
          <ChevronRight
            size={11}
            strokeWidth={2.5}
            className={'shrink-0 text-fg-subtle transition-transform duration-150 ' +
                        (expanded ? 'rotate-90' : '')}
          />
          <span className="thinking-star text-[15px] leading-none select-none">✢</span>
          <span className="text-[12.5px]">
            Thinking…{' '}
            <span className="text-fg-faint">({elapsed}s)</span>
          </span>
        </button>

        {/* Collapsible area for future thinking content */}
        <div
          className="grid transition-[grid-template-rows] duration-200 ease-out"
          style={{ gridTemplateRows: expanded ? '1fr' : '0fr' }}
        >
          <div className="overflow-hidden">
            <div className="ml-6 mt-1 text-[12px] text-fg-muted italic">
              Thinking process will appear here when available…
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
```

- [ ] **Step 2: Verify no TypeScript errors**

```bash
npx tsc --noEmit -p tsconfig.json 2>&1 | head -20
```

Expected: no errors

- [ ] **Step 3: Commit**

```bash
git add src/components/messages/ThinkingIndicator.tsx
git commit -m "feat: make ThinkingIndicator collapsible with chevron toggle"
```

---

### Task 12: Modify ChatView — pass streaming state and entrance animation

**Files:**
- Modify: `src/components/ChatView.tsx`

- [ ] **Step 1: Update ChatView to pass isStreaming to AssistantMessage and track seen messages**

In `src/components/ChatView.tsx`, make the following changes:

1. Add a `useRef` to track seen message keys for entrance animation:

```typescript
const seenKeys = useRef(new Set<string>())
```

2. In the message rendering loop, mark keys as seen:

```typescript
// Inside the messages.map callback, before the return:
const isNew = !seenKeys.current.has(m.key)
if (isNew) seenKeys.current.add(m.key)
```

3. Pass `isStreaming` and `showActions` to `AssistantMessage`:

Replace:
```typescript
if (m.kind === 'assistant') return <AssistantMessage text={m.text} />
```

With:
```typescript
if (m.kind === 'assistant') {
  const isLast = idx === messages.length - 1
  return (
    <AssistantMessage
      text={m.text}
      isStreaming={isLast && status === 'running'}
      showActions={status === 'idle'}
    />
  )
}
```

4. Reset `seenKeys` when session changes. Add near the existing `useEffect` that resets on session change:

```typescript
useEffect(() => {
  seenKeys.current.clear()
  // ... existing reset logic
}, [sessionId])
```

5. Add entrance animation class to message wrappers. Replace:

```typescript
return <div key={m.key}>{content}</div>
```

With:

```typescript
return <div key={m.key} className={isNew ? 'message-enter' : ''}>{content}</div>
```

And for subagent messages, replace:

```typescript
return (
  <div key={m.key} className="relative">
```

With:

```typescript
return (
  <div key={m.key} className={'relative' + (isNew ? ' message-enter' : '')}>
```

- [ ] **Step 2: Verify no TypeScript errors**

```bash
npx tsc --noEmit -p tsconfig.json 2>&1 | head -20
```

Expected: no errors

- [ ] **Step 3: Commit**

```bash
git add src/components/ChatView.tsx
git commit -m "feat: pass streaming state to AssistantMessage and add entrance animations"
```

---

### Task 13: Update tailwind.config.js — prepare for dark mode

**Files:**
- Modify: `tailwind.config.js`

- [ ] **Step 1: Add darkMode config**

In `tailwind.config.js`, add `darkMode: 'class'` at the top level of the config object:

```javascript
/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  darkMode: 'class',  // <-- add this line
  theme: {
    // ... existing theme unchanged
  },
  plugins: [],
}
```

- [ ] **Step 2: Verify build works**

```bash
npm run build 2>&1 | tail -5
```

Expected: build succeeds

- [ ] **Step 3: Commit**

```bash
git add tailwind.config.js
git commit -m "feat: add darkMode class strategy to tailwind config"
```

---

### Task 14: Verify full build and type check

**Files:** None (verification only)

- [ ] **Step 1: Run type check**

```bash
cd /Users/steve/CodeLib/GitHub/claude-dance
npx tsc --noEmit -p tsconfig.json && npx tsc --noEmit -p tsconfig.node.json
```

Expected: no errors

- [ ] **Step 2: Run build**

```bash
npm run build
```

Expected: build succeeds, output in `out/`

- [ ] **Step 3: Run tests**

```bash
npm test
```

Expected: all tests pass

- [ ] **Step 4: Commit any fixes if needed**

If any fixes were needed, commit them:

```bash
git add -A
git commit -m "fix: resolve build/type issues from message UI upgrade"
```

---

### Task 15: Final integration commit

- [ ] **Step 1: Review all changes**

```bash
git log --oneline origin/feat/message-render-upgrade..HEAD
```

Expected: all commits from Tasks 1-14 visible

- [ ] **Step 2: Create a summary of changes**

Verify these features work:
- [ ] Code blocks show syntax highlighting (shiki)
- [ ] Code blocks have language label in header
- [ ] Code blocks have copy button (hover visible, click → checkmark 2s)
- [ ] Long code blocks (>25 lines) show expand/collapse
- [ ] Line numbers display via CSS counters
- [ ] Streaming cursor blinks on last assistant message during streaming
- [ ] New messages have fade-in + slide-up animation
- [ ] Tool use cards have status icons (Wrench/Loader2/Check/X)
- [ ] Thinking indicator has collapsible chevron
- [ ] User messages render basic Markdown (inline code, links, bold, italic)
- [ ] Assistant messages show copy button on hover
