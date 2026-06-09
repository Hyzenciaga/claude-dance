import type { SessionSummary } from '@shared/types'
import { relativeTime } from '../lib/time'

type Props = {
  session: SessionSummary
  active: boolean
  onClick: () => void
}

export function SessionItem({ session, active, onClick }: Props) {
  return (
    <button
      onClick={onClick}
      className={
        'block w-full text-left px-3 py-1.5 rounded text-sm truncate ' +
        (active
          ? 'bg-accent text-primary'
          : 'text-muted-foreground hover:bg-muted hover:text-primary')
      }
      title={session.title}
    >
      <div className="truncate">{session.title || '(untitled)'}</div>
      <div className="text-xs opacity-60">{relativeTime(session.lastMessageAt)}</div>
    </button>
  )
}
