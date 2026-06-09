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
