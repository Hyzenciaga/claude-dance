import { useEffect, useState, useMemo, useRef } from 'react'
import { Plus, Search, Settings, LogOut, FolderPlus } from 'lucide-react'
import { useProjects } from '../store/projects'
import { api } from '../lib/api'
import { useSessions } from '../store/sessions'
import { ProjectItem } from './ProjectItem'
import { groupByTime, type Bucket } from '../lib/time'
import type { SessionSummary } from '@shared/types'

type Props = {
  onNewChat: (projectPath?: string) => void
  onOpenSession: (s: SessionSummary) => void
  onOpenSettings: () => void
  runningSessionIds?: Set<string>
  runningProjectPaths?: Set<string>
  unreadSessionIds?: Set<string>
  unreadProjectPaths?: Set<string>
  permissionSessionIds?: Set<string>
  permissionProjectPaths?: Set<string>
  autoExpandPath?: string
}

export function Sidebar({ onNewChat, onOpenSession, onOpenSettings, runningSessionIds, runningProjectPaths, unreadSessionIds, unreadProjectPaths, permissionSessionIds, permissionProjectPaths, autoExpandPath }: Props) {
  const { projects, load } = useProjects()
  const { selectedSessionId } = useSessions()
  const [expanded, setExpanded] = useState<Set<string>>(new Set())
  const [query, setQuery] = useState('')
  const [menuOpen, setMenuOpen] = useState(false)
  const menuRef = useRef<HTMLDivElement>(null)
  const listRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    load()
  }, [load])

  useEffect(() => {
    if (!autoExpandPath) return
    setExpanded((prev) => {
      if (prev.has(autoExpandPath)) return prev
      const next = new Set(prev)
      next.add(autoExpandPath)
      return next
    })
    // scroll the project item into view after expand renders
    requestAnimationFrame(() => {
      const el = listRef.current?.querySelector(`[data-path="${CSS.escape(autoExpandPath)}"]`)
      el?.scrollIntoView({ block: 'nearest', behavior: 'smooth' })
    })
  }, [autoExpandPath])

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
    .filter((p) => !p.hidden && !p.archived)
    .sort((a, b) => b.lastActiveAt - a.lastActiveAt)

  const ALWAYS_OPEN: Bucket = 'recent'
  const [collapsedBuckets, setCollapsedBuckets] = useState<Set<Bucket>>(
    new Set<Bucket>(['week', 'month', 'earlier']),
  )
  const projectGroups = useMemo(
    () => groupByTime(visible, (p) => p.lastActiveAt),
    [visible],
  )

  function toggleBucket(bucket: Bucket) {
    setCollapsedBuckets((prev) => {
      const next = new Set(prev)
      if (next.has(bucket)) next.delete(bucket)
      else next.add(bucket)
      return next
    })
  }

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
          className="w-full h-8 flex items-center justify-center gap-1.5 rounded-lg
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
            className="w-full h-8 pl-7 pr-2 rounded-lg bg-bg-inset border border-line
                       text-[12.5px] placeholder:text-fg-subtle"
          />
        </div>
      </div>

      <div className="app-no-drag flex items-center justify-between px-3 pb-1">
        <span className="text-[10.5px] uppercase tracking-[0.06em] text-fg-faint font-medium">Projects</span>
        <div className="flex items-center gap-0.5">
          <button
            onClick={async () => {
              const path = await api().pickFolder()
              if (!path) return
              await api().addProject(path)
              useProjects.getState().load()
            }}
            title="Add project folder"
            aria-label="Add project folder"
            className="h-5 w-5 flex items-center justify-center rounded-md
                       text-fg-subtle hover:text-fg-default hover:bg-bg-active transition-colors"
          >
            <FolderPlus size={11} />
          </button>
        </div>
      </div>

      <div ref={listRef} className="flex-1 overflow-y-auto overflow-x-hidden px-1.5 pb-2">
        {projectGroups.map((g) => {
          const isCollapsible = g.bucket !== ALWAYS_OPEN
          const isCollapsed = isCollapsible && collapsedBuckets.has(g.bucket)

          return (
            <div key={g.bucket} className="mb-0.5">
              {projectGroups.length > 1 && (
                <button
                  onClick={isCollapsible ? () => toggleBucket(g.bucket) : undefined}
                  className={'w-full text-left px-2 pt-1.5 pb-0.5 text-[10px] uppercase tracking-[0.06em] text-fg-faint font-medium' +
                    (isCollapsible ? ' hover:text-fg-subtle cursor-pointer transition-colors' : '')}
                >
                  {g.label}{isCollapsible ? ` (${g.items.length})` : ''}
                </button>
              )}
              {!isCollapsed && g.items.map((p) => (
                <div key={p.path} data-path={p.path}>
                <ProjectItem
                  project={p}
                  expanded={expanded.has(p.path)}
                  onToggle={() => toggle(p.path)}
                  onNewChat={() => onNewChat(p.path)}
                  selectedSessionId={selectedSessionId}
                  onSelectSession={onOpenSession}
                  query={query}
                  hasRunning={runningProjectPaths?.has(p.path)}
                  hasUnread={unreadProjectPaths?.has(p.path)}
                  hasPermission={permissionProjectPaths?.has(p.path)}
                  runningSessionIds={runningSessionIds}
                  unreadSessionIds={unreadSessionIds}
                  permissionSessionIds={permissionSessionIds}
                />
                </div>
              ))}
            </div>
          )
        })}
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
                          rounded-xl shadow-lg overflow-hidden z-50">
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
