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
