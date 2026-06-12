import { useEffect, useState, useMemo } from 'react'
import { ChevronRight, Plus, Archive, ChevronDown } from 'lucide-react'
import type { Project, SessionSummary } from '@shared/types'
import type { Bucket } from '../lib/time'
import { useProjects } from '../store/projects'
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
  hasPermission?: boolean
  runningSessionIds?: Set<string>
  unreadSessionIds?: Set<string>
  permissionSessionIds?: Set<string>
}

const ALWAYS_OPEN: Bucket = 'recent'
const DEFAULT_COLLAPSED = new Set<Bucket>(['week', 'month', 'earlier'])

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
  hasPermission,
  runningSessionIds,
  unreadSessionIds,
  permissionSessionIds,
}: Props) {
  const { sessionsByProject, loadFor, archiveSession, renameSession: renameSessionAction } = useSessions()
  const [hover, setHover] = useState(false)
  const [collapsed, setCollapsed] = useState<Set<Bucket>>(new Set(DEFAULT_COLLAPSED))

  useEffect(() => {
    if (expanded) loadFor(project.path)
    else setVisibleCount(PAGE_SIZE)
  }, [expanded, project.path, loadFor])

  const PAGE_SIZE = 15
  const [visibleCount, setVisibleCount] = useState(PAGE_SIZE)

  const sessions = (sessionsByProject[project.path] ?? []).filter((s) => !s.archived)
  const filtered = query
    ? sessions.filter((s) => s.title.toLowerCase().includes(query.toLowerCase()))
    : sessions
  const paged = useMemo(() => filtered.slice(0, visibleCount), [filtered, visibleCount])
  const hasMore = filtered.length > visibleCount
  const groups = groupSessionsByTime(paged)
  const name = project.path.split('/').pop() || project.path

  const projectDotClass = hasPermission
    ? 'breathing-dot breathing-dot--permission'
    : hasRunning
      ? 'breathing-dot breathing-dot--thinking'
      : hasUnread
        ? 'breathing-dot breathing-dot--unread'
        : null

  function toggleBucket(bucket: Bucket) {
    setCollapsed((prev) => {
      const next = new Set(prev)
      if (next.has(bucket)) next.delete(bucket)
      else next.add(bucket)
      return next
    })
  }

  return (
    <div
      className="mb-0.5"
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
    >
      <div className="group flex items-center h-7 rounded-lg hover:bg-bg-hover/60">
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
          onClick={(e) => { e.stopPropagation(); useProjects.getState().archiveProject(project.path) }}
          aria-label="Archive project"
          title="Archive project"
          className={
            'h-5 w-5 flex items-center justify-center rounded-md ' +
            'text-fg-subtle hover:text-fg-default hover:bg-bg-active transition-opacity ' +
            (hover ? 'opacity-100' : 'opacity-0')
          }
        >
          <Archive size={11} />
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
          {groups.map((g) => {
            const isCollapsible = g.bucket !== ALWAYS_OPEN
            const isCollapsed = isCollapsible && collapsed.has(g.bucket)

            return (
              <div key={g.bucket} className="mb-1">
                {isCollapsible ? (
                  <button
                    onClick={() => toggleBucket(g.bucket)}
                    className="flex items-center gap-1.5 px-1 py-1 w-full
                               text-[10px] text-fg-faint hover:text-fg-subtle transition-colors"
                  >
                    <div className="flex-1 border-t border-line" />
                    <span className="uppercase tracking-[0.06em] whitespace-nowrap flex items-center gap-0.5 font-medium">
                      <ChevronDown
                        size={9}
                        className={'transition-transform ' + (isCollapsed ? '-rotate-90' : '')}
                      />
                      {g.label} ({g.sessions.length})
                    </span>
                    <div className="flex-1 border-t border-line" />
                  </button>
                ) : (
                  <div className="px-2 pt-1.5 pb-0.5 text-[10px] uppercase tracking-[0.06em] text-fg-faint font-medium">
                    {g.label}
                  </div>
                )}
                {!isCollapsed && g.sessions.map((s) => (
                  <SessionItem
                    key={s.id}
                    session={s}
                    active={s.id === selectedSessionId}
                    running={runningSessionIds?.has(s.id)}
                    unread={unreadSessionIds?.has(s.id)}
                    permission={permissionSessionIds?.has(s.id)}
                    onClick={() => onSelectSession(s)}
                    onArchive={() => archiveSession(s.id, project.path)}
                    onRename={(title) => renameSessionAction(s.id, title, project.path)}
                  />
                ))}
              </div>
            )
          })}
          {hasMore && (
            <button
              onClick={() => setVisibleCount((c) => c + PAGE_SIZE)}
              className="w-full flex items-center justify-center gap-1 px-2 py-1.5
                         text-[11px] text-fg-subtle hover:text-fg-default
                         hover:bg-bg-hover/60 rounded-lg transition-colors"
            >
              <ChevronDown size={11} />
              Show more ({filtered.length - visibleCount} remaining)
            </button>
          )}
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
