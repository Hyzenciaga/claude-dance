import type { SessionSummary } from '@shared/types'
import { relativeTime } from '../lib/time'

type Props = {
  session: SessionSummary
  active: boolean
  running?: boolean
  onClick: () => void
}

export function SessionItem({ session, active, running, onClick }: Props) {
  return (
    <button
      onClick={onClick}
      className={
        'group relative flex items-center gap-1.5 w-full text-left rounded-md px-2 py-1 mb-px transition-colors ' +
        (active
          ? 'bg-accent/15 text-fg-default'
          : 'text-fg-muted hover:bg-bg-hover/60 hover:text-fg-default')
      }
      title={session.title}
    >
      {running && <span className="breathing-dot" />}
      {active && !running && (
        <span className="absolute left-0 top-1/2 -translate-y-1/2 h-4 w-[2px] rounded-full bg-accent" />
      )}
      <div className="min-w-0 flex-1">
        <div className="truncate text-[12.5px] leading-snug">
          {session.title || '(untitled)'}
        </div>
        <div className="text-[10.5px] text-fg-faint tabular-nums">
          {relativeTime(session.lastMessageAt)}
        </div>
      </div>
    </button>
  )
}
