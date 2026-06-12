import type { RawEvent } from '@shared/types'

export type SubagentInfo = {
  parentToolUseId: string
  agentType?: string
  taskDescription?: string
}

export type AnswerPair = {
  question: string
  header: string
  answer: string
}

export type DerivedMessage =
  | { kind: 'user'; text: string; key: string; messageId?: string }
  | { kind: 'assistant'; text: string; key: string; subagent?: SubagentInfo }
  | { kind: 'toolUse'; tool: string; input: unknown; id: string; key: string; subagent?: SubagentInfo }
  | { kind: 'askUserAnswer'; pairs: AnswerPair[]; response?: string; key: string }

function extractSubagent(raw: Record<string, unknown>): SubagentInfo | undefined {
  const parentId = raw['parent_tool_use_id']
  if (typeof parentId !== 'string' || !parentId) return undefined
  return {
    parentToolUseId: parentId,
    agentType: typeof raw['subagent_type'] === 'string' ? (raw['subagent_type'] as string) : undefined,
    taskDescription: typeof raw['task_description'] === 'string' ? (raw['task_description'] as string) : undefined,
  }
}

export function deriveMessages(events: RawEvent[]): DerivedMessage[] {
  const out: DerivedMessage[] = []
  let i = 0
  while (i < events.length) {
    const e = events[i]

    if (e.kind === 'user') {
      const raw = e.raw as Record<string, unknown>
      const uuid = typeof raw['uuid'] === 'string' ? (raw['uuid'] as string) : undefined
      const message = raw['message'] as Record<string, unknown> | undefined
      if (message) {
        const content = message['content']
        if (typeof content === 'string') {
          if (content.length > 0) out.push({ kind: 'user', text: content, key: String(i), messageId: uuid })
        } else if (Array.isArray(content)) {
          const texts: string[] = []
          for (const block of content) {
            if (!block || typeof block !== 'object') continue
            const type = (block as Record<string, unknown>)['type']
            if (type === 'text' && typeof (block as Record<string, unknown>)['text'] === 'string') {
              texts.push((block as Record<string, unknown>)['text'] as string)
            }
          }
          if (texts.length > 0) {
            out.push({ kind: 'user', text: texts.join('\n'), key: String(i), messageId: uuid })
          }
        }
      }
      i++
      continue
    }

    if (e.kind === 'assistant') {
      let lastIdx = i
      while (lastIdx + 1 < events.length && events[lastIdx + 1].kind === 'assistant') {
        lastIdx++
      }
      const last = events[lastIdx]
      const raw = last.raw as Record<string, unknown>
      const subagent = extractSubagent(raw)
      const message = raw['message'] as Record<string, unknown> | undefined
      if (message) {
        const content = message['content']
        if (Array.isArray(content)) {
          content.forEach((block, bIdx) => {
            if (!block || typeof block !== 'object') return
            const type = (block as Record<string, unknown>)['type']
            const key = `${lastIdx}-${bIdx}`
            if (type === 'text' && typeof (block as Record<string, unknown>)['text'] === 'string') {
              const text = (block as Record<string, unknown>)['text'] as string
              if (text.length > 0) out.push({ kind: 'assistant', text, key, subagent })
            } else if (type === 'tool_use') {
              const b = block as Record<string, unknown>
              out.push({
                kind: 'toolUse',
                tool: typeof b['name'] === 'string' ? (b['name'] as string) : 'Tool',
                input: b['input'] ?? null,
                id: typeof b['id'] === 'string' ? (b['id'] as string) : key,
                key,
                subagent,
              })
            }
          })
        }
      }
      i = lastIdx + 1
      continue
    }

    if (e.kind === 'askUserAnswer') {
      const raw = e.raw as Record<string, unknown>
      const pairs = Array.isArray(raw['pairs'])
        ? (raw['pairs'] as Array<Record<string, unknown>>).map((p) => ({
            question: String(p['question'] ?? ''),
            header: String(p['header'] ?? ''),
            answer: String(p['answer'] ?? ''),
          }))
        : []
      const response = typeof raw['response'] === 'string' ? raw['response'] : undefined
      out.push({ kind: 'askUserAnswer', pairs, response, key: String(i) })
      i++
      continue
    }

    i++
  }
  return out
}
