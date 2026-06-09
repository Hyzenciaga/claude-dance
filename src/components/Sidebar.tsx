import { useEffect, useState } from 'react'
import { useProjects } from '../store/projects'
import { useSessions } from '../store/sessions'
import { ProjectItem } from './ProjectItem'
import type { SessionSummary } from '@shared/types'

type Props = {
  onNewChat: (projectPath?: string) => void
  onOpenSession: (s: SessionSummary) => void
}

export function Sidebar({ onNewChat, onOpenSession }: Props) {
  const { projects, load } = useProjects()
  const { selectedSessionId } = useSessions()
  const [expanded, setExpanded] = useState<Set<string>>(new Set())
  const [query, setQuery] = useState('')

  useEffect(() => {
    load()
  }, [load])

  const visible = projects
    .filter((p) => !p.hidden)
    .sort((a, b) => b.lastActiveAt - a.lastActiveAt)

  function toggle(path: string) {
    setExpanded((prev) => {
      const next = new Set(prev)
      if (next.has(path)) next.delete(path)
      else next.add(path)
      return next
    })
  }

  return (
    <aside className="w-72 h-full border-r border-border flex flex-col bg-muted/30">
      <div className="p-3 border-b border-border flex flex-col gap-2">
        <button
          onClick={() => onNewChat()}
          className="w-full px-3 py-1.5 rounded bg-primary text-primary-foreground text-sm font-medium hover:opacity-90"
        >
          + New Chat
        </button>
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search…"
          className="w-full px-3 py-1.5 rounded border border-border bg-background text-sm"
        />
      </div>
      <div className="flex-1 overflow-y-auto p-2">
        {visible.map((p) => (
          <ProjectItem
            key={p.path}
            project={p}
            expanded={expanded.has(p.path)}
            onToggle={() => toggle(p.path)}
            onNewChat={() => onNewChat(p.path)}
            selectedSessionId={selectedSessionId}
            onSelectSession={onOpenSession}
            query={query}
          />
        ))}
        {visible.length === 0 && (
          <div className="px-3 py-2 text-xs text-muted-foreground">
            No projects found. Start a session with <code>claude</code> in any directory, then return.
          </div>
        )}
      </div>
    </aside>
  )
}
