import { useState, useRef, useEffect } from 'react'
import { Archive } from 'lucide-react'
import type { SessionSummary } from '@shared/types'
import { relativeTime } from '../lib/time'

type Props = {
  session: SessionSummary
  active: boolean
  running?: boolean
  unread?: boolean
  permission?: boolean
  onClick: () => void
  onArchive?: () => void
  onRename?: (title: string) => void
}

export function SessionItem({ session, active, running, unread, permission, onClick, onArchive, onRename }: Props) {
  const [editing, setEditing] = useState(false)
  const [editText, setEditText] = useState('')
  const inputRef = useRef<HTMLInputElement>(null)

  const dotClass = permission
    ? 'breathing-dot breathing-dot--permission'
    : running
      ? 'breathing-dot breathing-dot--thinking'
      : unread
        ? 'breathing-dot breathing-dot--unread'
        : null

  useEffect(() => {
    if (editing) inputRef.current?.focus()
  }, [editing])

  function startEdit() {
    if (!onRename) return
    setEditText(session.title || '')
    setEditing(true)
  }

  function commitEdit() {
    setEditing(false)
    const trimmed = editText.trim()
    if (trimmed && trimmed !== session.title && onRename) {
      onRename(trimmed)
    }
  }

  return (
    <button
      onClick={editing ? undefined : onClick}
      onDoubleClick={(e) => { e.preventDefault(); startEdit() }}
      className={
        'group relative flex items-center gap-1.5 w-full text-left rounded-lg px-2 py-1 mb-px transition-colors ' +
        (active
          ? 'bg-accent/15 text-fg-default'
          : 'text-fg-muted hover:bg-bg-hover/60 hover:text-fg-default')
      }
      title={session.title}
    >
      {dotClass && <span className={dotClass} />}
      {active && !dotClass && (
        <span className="absolute left-0 top-1/2 -translate-y-1/2 h-4 w-[2px] rounded-full bg-accent" />
      )}
      <div className="min-w-0 flex-1">
        {editing ? (
          <input
            ref={inputRef}
            value={editText}
            onChange={(e) => setEditText(e.target.value)}
            onBlur={commitEdit}
            onKeyDown={(e) => {
              if (e.key === 'Enter') commitEdit()
              if (e.key === 'Escape') setEditing(false)
            }}
            onClick={(e) => e.stopPropagation()}
            className="w-full text-[12.5px] leading-snug bg-transparent border-b border-accent
                       outline-none py-0"
          />
        ) : (
          <div className="truncate text-[12.5px] leading-snug">
            {session.title || '(untitled)'}
          </div>
        )}
        <div className="text-[10.5px] text-fg-faint tabular-nums">
          {relativeTime(session.lastMessageAt)}
        </div>
      </div>
      {onArchive && !editing && (
        <button
          onClick={(e) => { e.stopPropagation(); onArchive() }}
          className="absolute right-1 top-1/2 -translate-y-1/2 h-5 w-5 flex items-center justify-center rounded-md
                     text-fg-subtle hover:text-fg-default hover:bg-bg-active
                     opacity-0 group-hover:opacity-100 transition-opacity"
          title="Archive"
          aria-label="Archive session"
        >
          <Archive size={11} />
        </button>
      )}
    </button>
  )
}
