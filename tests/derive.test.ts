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
