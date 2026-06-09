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
