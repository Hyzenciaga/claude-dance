import { useEffect, useRef, useState, useMemo, useCallback } from 'react'
import { AlertCircle, CircleSlash, ArrowDown, Undo2 } from 'lucide-react'
import { useEvents } from '../store/events'
import { deriveMessages } from '../lib/derive'
import { UserMessage } from './messages/UserMessage'
import { AssistantMessage } from './messages/AssistantMessage'
import { ToolUseCard } from './messages/ToolUseCard'
import { ThinkingIndicator } from './messages/ThinkingIndicator'
import { PermissionDialog } from './PermissionDialog'
import { AskUserDialog } from './AskUserDialog'
import { AskUserAnswerCard } from './messages/AskUserAnswerCard'
import type { PermissionRequest, AskUserQuestionRequest } from '@shared/types'

type Props = {
  sessionId: string
  status?: 'running' | 'idle' | 'exited' | 'error'
  error?: string
  pendingPermission?: PermissionRequest
  onPermissionRespond?: (allowed: boolean, mode?: string) => void
  pendingQuestion?: AskUserQuestionRequest
  onQuestionRespond?: (result: { cancelled: true } | { cancelled: false; answers: Record<string, string>; response?: string }) => void
  onRewind?: (userMessageId?: string) => void
  onEditResend?: (text: string) => void
}

const PAGE_SIZE = 40
const SCROLL_UP_THRESHOLD = 300

export function ChatView({ sessionId, status, error, pendingPermission, onPermissionRespond, pendingQuestion, onQuestionRespond, onRewind, onEditResend }: Props) {
  const events = useEvents((s) => s.eventsBySession[sessionId] ?? [])
  const allMessages = useMemo(() => deriveMessages(events), [events])
  const scrollRef = useRef<HTMLDivElement>(null)
  const [visibleCount, setVisibleCount] = useState(PAGE_SIZE)
  const [showScrollDown, setShowScrollDown] = useState(false)
  const loadingRef = useRef(false)
  const seenKeys = useRef(new Set<string>())

  const isInitialScroll = useRef(true)

  useEffect(() => {
    seenKeys.current.clear()
    isInitialScroll.current = true
    setVisibleCount(PAGE_SIZE)
    setShowScrollDown(false)
  }, [sessionId])

  const hasMore = allMessages.length > visibleCount
  const messages = useMemo(
    () => hasMore ? allMessages.slice(allMessages.length - visibleCount) : allMessages,
    [allMessages, visibleCount, hasMore],
  )

  const lastMsg = allMessages[allMessages.length - 1]
  const showThinking = status === 'running' && (!lastMsg || lastMsg.kind === 'user' || lastMsg.kind === 'toolUse')

  // On session open: jump instantly to bottom (no animation)
  // On new messages: smooth scroll if user hasn't scrolled up
  useEffect(() => {
    const el = scrollRef.current
    if (!el) return
    if (isInitialScroll.current) {
      if (allMessages.length > 0) {
        el.scrollTop = el.scrollHeight
        isInitialScroll.current = false
      }
      return
    }
    if (showScrollDown) return
    el.scrollTo({ top: el.scrollHeight, behavior: 'smooth' })
  }, [allMessages.length, showThinking, showScrollDown])

  // Auto-scroll during streaming (content grows within same message)
  const lastAssistantText = lastMsg?.kind === 'assistant' ? lastMsg.text : null
  useEffect(() => {
    if (!lastAssistantText) return
    const el = scrollRef.current
    if (!el || showScrollDown) return
    el.scrollTop = el.scrollHeight
  }, [lastAssistantText, showScrollDown])

  // Scroll to bottom when question dialog appears
  useEffect(() => {
    if (!pendingQuestion) return
    const el = scrollRef.current
    if (!el) return
    el.scrollTo({ top: el.scrollHeight, behavior: 'smooth' })
  }, [pendingQuestion?.requestId])

  const onScroll = useCallback(() => {
    const el = scrollRef.current
    if (!el || loadingRef.current) return

    const distFromBottom = el.scrollHeight - el.scrollTop - el.clientHeight
    setShowScrollDown(distFromBottom > SCROLL_UP_THRESHOLD)

    const loadThreshold = el.clientHeight * 1.5
    if (el.scrollTop < loadThreshold && hasMore) {
      loadingRef.current = true
      const prevTop = el.scrollTop
      const prevHeight = el.scrollHeight
      setVisibleCount((c) => c + PAGE_SIZE)
      requestAnimationFrame(() => {
        el.scrollTop = prevTop + (el.scrollHeight - prevHeight)
        loadingRef.current = false
      })
    }

    if (distFromBottom < 50) {
      setVisibleCount((c) => (c > PAGE_SIZE ? PAGE_SIZE : c))
    }
  }, [hasMore])

  function scrollToBottom() {
    const el = scrollRef.current
    if (!el) return
    el.scrollTo({ top: el.scrollHeight, behavior: 'smooth' })
  }

  return (
    <div className="flex-1 flex flex-col min-h-0 relative">
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
      <div ref={scrollRef} onScroll={onScroll} className="flex-1 overflow-y-auto overflow-x-hidden">
        {allMessages.length === 0 ? (
          <div className="h-full flex items-center justify-center text-fg-subtle text-[12.5px]">
            No messages yet
          </div>
        ) : (
          <div className="py-2">
            {hasMore && (
              <div className="flex justify-center py-3">
                <div className="text-[11px] text-fg-faint">Loading…</div>
              </div>
            )}
            {messages.map((m, idx) => {
              const subagent = 'subagent' in m ? m.subagent : undefined
              const prevMsg = messages[idx - 1]
              const prevSubagentId = prevMsg && 'subagent' in prevMsg ? prevMsg.subagent?.parentToolUseId : undefined
              const isFirstSubagent = subagent && subagent.parentToolUseId !== prevSubagentId
              const isNew = !seenKeys.current.has(m.key)
              if (isNew) seenKeys.current.add(m.key)
              const content = (() => {
                if (m.kind === 'user') return (
                  <UserMessage
                    text={m.text}
                    onRewind={status === 'idle' && m.messageId && onRewind
                      ? () => onRewind(m.messageId)
                      : undefined}
                    onEditResend={status === 'idle' && onEditResend
                      ? (t) => onEditResend(t)
                      : undefined}
                  />
                )
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
                if (m.kind === 'askUserAnswer') return <AskUserAnswerCard pairs={m.pairs} response={m.response} />
                return <ToolUseCard tool={m.tool} input={m.input} />
              })()

              if (subagent) {
                return (
                  <div key={m.key} className={'relative' + (isNew ? ' message-enter' : '')}>
                    <div className="absolute top-0 bottom-0 left-[22px] w-0.5 bg-accent/30" />
                    {isFirstSubagent && (
                      <div className="px-6 pt-1.5 pb-0.5">
                        <div className="mx-auto max-w-4xl pl-3 text-[10.5px] text-fg-faint font-medium">
                          {subagent.agentType ?? 'Subagent'}
                          {subagent.taskDescription && (
                            <span className="font-normal ml-1.5 text-fg-faint/70">— {subagent.taskDescription.length > 80 ? subagent.taskDescription.slice(0, 77) + '…' : subagent.taskDescription}</span>
                          )}
                        </div>
                      </div>
                    )}
                    {content}
                  </div>
                )
              }

              return <div key={m.key} className={isNew ? 'message-enter' : ''}>{content}</div>
            })}
            {pendingPermission && onPermissionRespond && (
              <PermissionDialog request={pendingPermission} onRespond={onPermissionRespond} />
            )}
            {pendingQuestion && onQuestionRespond && (
              <AskUserDialog request={pendingQuestion} onRespond={onQuestionRespond} />
            )}
          </div>
        )}
      </div>
      {showThinking && !pendingPermission && !pendingQuestion && <ThinkingIndicator />}
      {onRewind && status === 'idle' && allMessages.length > 0 && (
        <button
          onClick={() => onRewind()}
          className="absolute bottom-4 left-6 h-8 flex items-center gap-1.5 px-3
                     rounded-full bg-bg-panel border border-line shadow-lg
                     text-[11.5px] text-fg-muted hover:text-fg-default hover:bg-bg-hover
                     transition-all z-10"
          aria-label="Rewind files"
          title="Revert file changes to before last message"
        >
          <Undo2 size={13} strokeWidth={2} />
          <span>Rewind</span>
        </button>
      )}
      {showScrollDown && (
        <button
          onClick={scrollToBottom}
          className="absolute bottom-4 right-6 h-8 w-8 flex items-center justify-center
                     rounded-full bg-bg-panel border border-line shadow-lg
                     text-fg-muted hover:text-fg-default hover:bg-bg-hover
                     transition-all z-10"
          aria-label="Scroll to bottom"
        >
          <ArrowDown size={14} strokeWidth={2} />
        </button>
      )}
    </div>
  )
}
