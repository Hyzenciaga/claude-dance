import { useEffect, useRef } from 'react'
import { AlertCircle, CircleSlash } from 'lucide-react'
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
    const el = scrollRef.current
    if (!el) return
    el.scrollTo({ top: el.scrollHeight, behavior: 'smooth' })
  }, [messages.length])

  return (
    <div className="flex-1 flex flex-col min-h-0">
      {status === 'error' && (
        <div className="flex items-center gap-2 px-6 py-2 bg-red-500/10 text-red-300/90
                        text-[12px] border-b border-red-500/20">
          <AlertCircle size={13} />
          <span className="truncate">Claude error: {error}</span>
        </div>
      )}
      {status === 'exited' && (
        <div className="flex items-center gap-2 px-6 py-1.5 bg-bg-inset text-fg-subtle
                        text-[11.5px] border-b border-line">
          <CircleSlash size={11} />
          Claude process exited
        </div>
      )}
      <div ref={scrollRef} className="flex-1 overflow-y-auto">
        {messages.length === 0 ? (
          <div className="h-full flex items-center justify-center text-fg-subtle text-[12.5px]">
            No messages yet
          </div>
        ) : (
          <div className="py-2">
            {messages.map((m) => {
              if (m.kind === 'user') return <UserMessage key={m.key} text={m.text} />
              if (m.kind === 'assistant') return <AssistantMessage key={m.key} text={m.text} />
              return <ToolUseCard key={m.key} tool={m.tool} input={m.input} />
            })}
          </div>
        )}
      </div>
    </div>
  )
}
