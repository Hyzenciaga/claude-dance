import { useEffect, useState } from 'react'
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
}

export function ProjectItem({
  project,
  expanded,
  onToggle,
  onNewChat,
  selectedSessionId,
  onSelectSession,
  query,
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

  return (
    <div
      className="mb-1"
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
    >
      <div className="flex items-center px-2 py-1 group">
        <button
          onClick={onToggle}
          className="flex-1 text-left text-sm font-medium truncate text-foreground"
          title={project.path}
        >
          <span className="inline-block w-3">{expanded ? '▾' : '▸'}</span>{' '}
          {project.path.split('/').pop() || project.path}
          <span className="text-muted-foreground ml-1 text-xs">
            ({project.sessionCount})
          </span>
          {!project.exists && (
            <span className="ml-1 text-xs text-red-500">missing</span>
          )}
        </button>
        <button
          onClick={onNewChat}
          className={
            'ml-1 px-1.5 rounded hover:bg-accent text-muted-foreground ' +
            (hover ? 'opacity-100' : 'opacity-0')
          }
          title="New chat in this project"
        >
          +
        </button>
      </div>
      {expanded && (
        <div className="pl-3">
          {groups.map((g) => (
            <div key={g.bucket} className="mb-1">
              <div className="px-3 pt-1 text-[10px] uppercase tracking-wide text-muted-foreground">
                {g.label}
              </div>
              {g.sessions.map((s) => (
                <SessionItem
                  key={s.id}
                  session={s}
                  active={s.id === selectedSessionId}
                  onClick={() => onSelectSession(s)}
                />
              ))}
            </div>
          ))}
          {sessions.length === 0 && (
            <div className="px-3 py-1 text-xs text-muted-foreground italic">
              No sessions yet
            </div>
          )}
        </div>
      )}
    </div>
  )
}
