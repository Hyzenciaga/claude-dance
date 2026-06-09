import { useEffect, useState } from 'react'
import { ChevronRight, Plus } from 'lucide-react'
import type { Project, SessionSummary } from '@shared/types'
import { useSessions } from '../store/sessions'
import { groupSessionsByTime } from '../lib/time'
import { SessionItem } from './SessionItem'

type Props = {
  project: Project
  expanded: boolean
  onToggle: () => void
  onNewChat: () => void
  selectedSessionId: string | null
  onSelectSession: (s: SessionSummary) => void
  query: string
  hasRunning?: boolean
  hasUnread?: boolean
  runningSessionIds?: Set<string>
  unreadSessionIds?: Set<string>
}

export function ProjectItem({
  project,
  expanded,
  onToggle,
  onNewChat,
  selectedSessionId,
  onSelectSession,
  query,
  hasRunning,
  hasUnread,
  runningSessionIds,
  unreadSessionIds,
}: Props) {
  const { sessionsByProject, loadFor } = useSessions()
  const [hover, setHover] = useState(false)

  useEffect(() => {
    if (expanded) loadFor(project.path)
  }, [expanded, project.path, loadFor])

  const sessions = sessionsByProject[project.path] ?? []
  const filtered = query
    ? sessions.filter((s) => s.title.toLowerCase().includes(query.toLowerCase()))
    : sessions
  const groups = groupSessionsByTime(filtered)
  const name = project.path.split('/').pop() || project.path

  const projectDotClass = hasRunning
    ? 'breathing-dot breathing-dot--thinking'
    : hasUnread
      ? 'breathing-dot breathing-dot--unread'
      : null

  return (
    <div
      className="mb-0.5"
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
    >
      <div className="group flex items-center h-7 rounded-md hover:bg-bg-hover/60">
        <button
          onClick={onToggle}
          className="flex-1 flex items-center min-w-0 h-full px-1.5 text-left"
          title={project.path}
        >
          {projectDotClass && <span className={projectDotClass + ' mr-1.5'} />}
          <ChevronRight
            size={12}
            strokeWidth={2.5}
            className={
              'text-fg-subtle shrink-0 mr-1 transition-transform duration-150 ' +
              (expanded ? 'rotate-90' : '')
            }
          />
          <span className="text-[12.5px] font-medium text-fg-default truncate">{name}</span>
          <span className="ml-1.5 text-[11px] text-fg-subtle tabular-nums">{project.sessionCount}</span>
          {!project.exists && (
            <span className="ml-1 text-[10px] uppercase tracking-wide text-red-400/80">missing</span>
          )}
        </button>
        <button
          onClick={onNewChat}
          aria-label="New chat in this project"
          title="New chat in this project"
          className={
            'mr-1 h-5 w-5 flex items-center justify-center rounded ' +
            'text-fg-subtle hover:text-fg-default hover:bg-bg-active transition-opacity ' +
            (hover ? 'opacity-100' : 'opacity-0')
          }
        >
          <Plus size={12} strokeWidth={2.25} />
        </button>
      </div>
      {expanded && (
        <div className="pl-4 pt-0.5 pb-1">
          {groups.map((g) => (
            <div key={g.bucket} className="mb-1">
              <div className="px-2 pt-1.5 pb-0.5 text-[10px] uppercase tracking-[0.06em] text-fg-faint font-medium">
                {g.label}
              </div>
              {g.sessions.map((s) => (
                <SessionItem
                  key={s.id}
                  session={s}
                  active={s.id === selectedSessionId}
                  running={runningSessionIds?.has(s.id)}
                  unread={unreadSessionIds?.has(s.id)}
                  onClick={() => onSelectSession(s)}
                />
              ))}
            </div>
          ))}
          {sessions.length === 0 && (
            <div className="px-2 py-1 text-[11px] text-fg-faint italic">
              No sessions yet
            </div>
          )}
        </div>
      )}
    </div>
  )
}
