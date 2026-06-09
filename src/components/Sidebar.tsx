import { useEffect, useState, useRef } from 'react'
import { Plus, Search, Settings, LogOut } from 'lucide-react'
import { useProjects } from '../store/projects'
import { useSessions } from '../store/sessions'
import { ProjectItem } from './ProjectItem'
import type { SessionSummary } from '@shared/types'

type Props = {
  onNewChat: (projectPath?: string) => void
  onOpenSession: (s: SessionSummary) => void
  onOpenSettings: () => void
  runningSessionIds?: Set<string>
  runningProjectPaths?: Set<string>
}

export function Sidebar({ onNewChat, onOpenSession, onOpenSettings, runningSessionIds, runningProjectPaths }: Props) {
  const { projects, load } = useProjects()
  const { selectedSessionId } = useSessions()
  const [expanded, setExpanded] = useState<Set<string>>(new Set())
  const [query, setQuery] = useState('')
  const [menuOpen, setMenuOpen] = useState(false)
  const menuRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    load()
  }, [load])

  useEffect(() => {
    if (!menuOpen) return
    function onClickOutside(e: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setMenuOpen(false)
      }
    }
    document.addEventListener('mousedown', onClickOutside)
    return () => document.removeEventListener('mousedown', onClickOutside)
  }, [menuOpen])

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
    <aside className="w-[260px] h-full flex flex-col bg-bg-panel border-r border-line">
      <div className="app-drag h-9 flex-shrink-0" />

      <div className="app-no-drag px-3 pb-2 flex flex-col gap-2">
        <button
          onClick={() => onNewChat()}
          className="w-full h-8 flex items-center justify-center gap-1.5 rounded-md
                     bg-bg-inset hover:bg-bg-hover text-fg-default text-[12.5px] font-medium
                     border border-line transition-colors"
        >
          <Plus size={13} strokeWidth={2.25} />
          New chat
        </button>
        <div className="relative">
          <Search size={12} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-fg-subtle" />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search"
            className="w-full h-8 pl-7 pr-2 rounded-md bg-bg-inset border border-line
                       text-[12.5px] placeholder:text-fg-subtle"
          />
        </div>
      </div>

      <div className="flex-1 overflow-y-auto px-1.5 pb-2">
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
            hasRunning={runningProjectPaths?.has(p.path)}
            runningSessionIds={runningSessionIds}
          />
        ))}
        {visible.length === 0 && (
          <div className="px-3 py-4 text-[12px] text-fg-subtle">
            No projects found. Start a session with{' '}
            <code className="font-mono text-fg-muted">claude</code> in any directory, then return.
          </div>
        )}
      </div>

      {/* Settings footer */}
      <div className="relative border-t border-line bg-bg-panel app-no-drag" ref={menuRef}>
        {menuOpen && (
          <div className="absolute bottom-full left-2 right-2 mb-1 bg-bg-inset border border-line
                          rounded-lg shadow-lg overflow-hidden z-50">
            <button
              onClick={() => { setMenuOpen(false); onOpenSettings() }}
              className="w-full flex items-center gap-2.5 px-3 py-2 text-[12.5px] text-fg-muted
                         hover:bg-bg-hover hover:text-fg-default transition-colors text-left"
            >
              <Settings size={13} strokeWidth={2} className="text-fg-subtle" />
              Settings
            </button>
            <div className="border-t border-line" />
            <button
              className="w-full flex items-center gap-2.5 px-3 py-2 text-[12.5px] text-fg-muted
                         hover:bg-bg-hover hover:text-red-500 transition-colors text-left"
            >
              <LogOut size={13} strokeWidth={2} className="text-fg-subtle" />
              Log out
            </button>
          </div>
        )}
        <button
          onClick={() => setMenuOpen((o) => !o)}
          className="w-full flex items-center gap-2 px-3 h-10 text-[12.5px] text-fg-muted
                     hover:bg-bg-hover transition-colors"
        >
          <div className="h-6 w-6 rounded-full bg-bg-active flex items-center justify-center
                          text-[10px] font-semibold text-fg-muted uppercase">
            U
          </div>
          <span className="flex-1 text-left truncate">User</span>
          <Settings size={13} strokeWidth={2} className={'text-fg-subtle transition-transform ' + (menuOpen ? 'rotate-90' : '')} />
        </button>
      </div>
    </aside>
  )
}
