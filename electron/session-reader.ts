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
