import { useState, useEffect, useCallback } from 'react'
import { ArrowLeft, Palette, Monitor, Sun, Moon, Archive, RotateCcw, FolderOpen, MessageSquare, Plug, Plus, Trash2, Bell } from 'lucide-react'
import { useProjects } from '../store/projects'
import { api } from '../lib/api'
import type { SessionSummary } from '@shared/types'

type Props = {
  onBack: () => void
  channelId?: string
  projectDir?: string
}

type SettingsTab = 'appearance' | 'notifications' | 'archive' | 'mcp'

export function SettingsPage({ onBack, channelId, projectDir }: Props) {
  const [tab, setTab] = useState<SettingsTab>('appearance')
  const [theme, setTheme] = useState<'light' | 'dark' | 'auto'>('light')

  return (
    <div className="flex h-full bg-bg-base">
      {/* Left: settings nav */}
      <aside className="w-[220px] h-full flex flex-col bg-bg-panel border-r border-line">
        <div className="app-drag h-9 flex-shrink-0" />
        <div className="px-3 pb-3 app-no-drag">
          <button
            onClick={onBack}
            className="flex items-center gap-1.5 text-[12.5px] text-fg-muted hover:text-fg-default
                       transition-colors mb-3"
          >
            <ArrowLeft size={13} strokeWidth={2.25} />
            Back
          </button>
          <div className="text-[13px] font-semibold text-fg-default">Settings</div>
        </div>
        <nav className="flex-1 px-2 app-no-drag">
          <NavItem
            icon={<Palette size={13} />}
            label="Appearance"
            active={tab === 'appearance'}
            onClick={() => setTab('appearance')}
          />
          <NavItem
            icon={<Bell size={13} />}
            label="Notifications"
            active={tab === 'notifications'}
            onClick={() => setTab('notifications')}
          />
          <NavItem
            icon={<Archive size={13} />}
            label="Archived"
            active={tab === 'archive'}
            onClick={() => setTab('archive')}
          />
          <NavItem
            icon={<Plug size={13} />}
            label="MCP Servers"
            active={tab === 'mcp'}
            onClick={() => setTab('mcp')}
          />
        </nav>
      </aside>

      {/* Right: settings content */}
      <main className="flex-1 flex flex-col min-h-0 bg-bg-base rounded-l-2xl z-10 panel-float">
        <div className="app-drag h-9 flex-shrink-0" />
        <div className="flex-1 overflow-y-auto px-8 py-4">
          {tab === 'appearance' && (
            <div>
              <h2 className="text-[15px] font-semibold text-fg-default mb-1">Appearance</h2>
              <p className="text-[12.5px] text-fg-muted mb-5">Customize how ClaudeDance looks.</p>

              <div className="mb-6">
                <label className="text-[12.5px] font-medium text-fg-default block mb-2.5">Theme</label>
                <div className="flex gap-3">
                  <ThemeCard
                    icon={<Sun size={18} strokeWidth={1.5} />}
                    label="Light"
                    selected={theme === 'light'}
                    onClick={() => setTheme('light')}
                  />
                  <ThemeCard
                    icon={<Moon size={18} strokeWidth={1.5} />}
                    label="Dark"
                    selected={theme === 'dark'}
                    onClick={() => setTheme('dark')}
                  />
                  <ThemeCard
                    icon={<Monitor size={18} strokeWidth={1.5} />}
                    label="Auto"
                    selected={theme === 'auto'}
                    onClick={() => setTheme('auto')}
                  />
                </div>
                <p className="text-[11px] text-fg-subtle mt-2">
                  {theme === 'auto'
                    ? 'Follows your system preference.'
                    : theme === 'dark'
                      ? 'Dark theme is coming soon.'
                      : 'Currently active.'}
                </p>
              </div>
            </div>
          )}
          {tab === 'notifications' && <NotificationSection />}
          {tab === 'archive' && <ArchiveSection />}
          {tab === 'mcp' && <McpSection channelId={channelId} projectDir={projectDir} />}
        </div>
      </main>
    </div>
  )
}

function NavItem({
  icon,
  label,
  active,
  onClick,
}: {
  icon: React.ReactNode
  label: string
  active: boolean
  onClick: () => void
}) {
  return (
    <button
      onClick={onClick}
      className={
        'w-full flex items-center gap-2 px-2.5 py-1.5 rounded-lg text-[12.5px] font-medium ' +
        'transition-colors mb-0.5 ' +
        (active
          ? 'bg-bg-hover text-fg-default'
          : 'text-fg-muted hover:bg-bg-hover/60 hover:text-fg-default')
      }
    >
      {icon}
      {label}
    </button>
  )
}

function ThemeCard({
  icon,
  label,
  selected,
  onClick,
}: {
  icon: React.ReactNode
  label: string
  selected: boolean
  onClick: () => void
}) {
  return (
    <button
      onClick={onClick}
      className={
        'flex flex-col items-center gap-2 px-5 py-4 rounded-xl border transition-all ' +
        (selected
          ? 'border-accent bg-accent-subtle text-fg-default shadow-sm'
          : 'border-line bg-bg-inset text-fg-muted hover:border-line-strong hover:text-fg-default')
      }
    >
      {icon}
      <span className="text-[12px] font-medium">{label}</span>
    </button>
  )
}

type NotifPrefs = { onResult: boolean; onPermission: boolean; onError: boolean }

function NotificationSection() {
  const [prefs, setPrefs] = useState<NotifPrefs>({ onResult: true, onPermission: true, onError: true })
  const [loaded, setLoaded] = useState(false)
  const [permission, setPermission] = useState(Notification.permission)

  useEffect(() => {
    api().getNotificationPrefs().then((p) => { setPrefs(p); setLoaded(true) })
  }, [])

  async function toggle(key: keyof NotifPrefs) {
    const next = { ...prefs, [key]: !prefs[key] }
    setPrefs(next)
    await api().setNotificationPrefs(next)
  }

  async function requestPermission() {
    const result = await api().requestNotificationPermission()
    setPermission(result)
  }

  if (!loaded) return <div className="text-[12px] text-fg-subtle py-4 text-center">Loading…</div>

  return (
    <div>
      <h2 className="text-[15px] font-semibold text-fg-default mb-1">Notifications</h2>
      <p className="text-[12.5px] text-fg-muted mb-5">
        System notifications when ClaudeDance is in the background.
      </p>

      {permission !== 'granted' && (
        <div className="rounded-xl border border-yellow-300/50 bg-yellow-50/50 px-4 py-3 mb-5 flex items-center justify-between">
          <div>
            <div className="text-[12.5px] font-medium text-fg-default">Notification permission required</div>
            <div className="text-[11.5px] text-fg-muted">macOS needs your permission to show notifications.</div>
          </div>
          <button
            onClick={requestPermission}
            className="px-3 py-1.5 rounded-lg text-[12px] font-medium text-white bg-accent hover:bg-accent-hover transition-colors"
          >
            Enable
          </button>
        </div>
      )}

      <div className="rounded-xl border border-line overflow-hidden">
        <ToggleRow
          label="Task completed"
          description="When Claude finishes responding"
          checked={prefs.onResult}
          onChange={() => toggle('onResult')}
        />
        <ToggleRow
          label="Permission request"
          description="When a tool needs your approval"
          checked={prefs.onPermission}
          onChange={() => toggle('onPermission')}
          border
        />
        <ToggleRow
          label="Errors"
          description="When an SDK error occurs"
          checked={prefs.onError}
          onChange={() => toggle('onError')}
          border
        />
      </div>

      <div className="mt-4">
        <button
          onClick={() => api().testNotification()}
          className="px-3 py-1.5 rounded-lg text-[12px] font-medium text-fg-muted
                     border border-line hover:bg-bg-hover hover:text-fg-default transition-colors"
        >
          Send test notification
        </button>
      </div>
    </div>
  )
}

function ToggleRow({
  label,
  description,
  checked,
  onChange,
  border,
}: {
  label: string
  description: string
  checked: boolean
  onChange: () => void
  border?: boolean
}) {
  return (
    <div
      className={'flex items-center justify-between px-4 py-3 ' + (border ? 'border-t border-line' : '')}
    >
      <div>
        <div className="text-[12.5px] font-medium text-fg-default">{label}</div>
        <div className="text-[11.5px] text-fg-muted">{description}</div>
      </div>
      <button
        onClick={onChange}
        className={
          'relative w-9 h-5 rounded-full transition-colors ' +
          (checked ? 'bg-accent' : 'bg-fg-faint/30')
        }
      >
        <span
          className={
            'absolute top-0.5 w-4 h-4 rounded-full bg-white shadow transition-transform ' +
            (checked ? 'left-[18px]' : 'left-0.5')
          }
        />
      </button>
    </div>
  )
}

function ArchiveSection() {
  const { projects, unarchiveProject } = useProjects()
  const archivedProjects = projects.filter((p) => p.archived)
  const [archivedSessions, setArchivedSessions] = useState<SessionSummary[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    api().listArchivedSessions().then((s) => {
      setArchivedSessions(s)
      setLoading(false)
    })
  }, [])

  async function restoreProject(path: string) {
    await unarchiveProject(path)
  }

  async function restoreSession(s: SessionSummary) {
    await api().unarchiveSession(s.id)
    setArchivedSessions((prev) => prev.filter((x) => x.id !== s.id))
  }

  const empty = archivedProjects.length === 0 && archivedSessions.length === 0 && !loading

  return (
    <div>
      <h2 className="text-[15px] font-semibold text-fg-default mb-1">Archived</h2>
      <p className="text-[12.5px] text-fg-muted mb-5">
        Archived projects and sessions are hidden from the sidebar. You can restore them here.
      </p>

      {empty && (
        <div className="text-[12.5px] text-fg-subtle py-8 text-center">
          No archived items.
        </div>
      )}

      {archivedProjects.length > 0 && (
        <div className="mb-6">
          <label className="text-[12.5px] font-medium text-fg-default block mb-2.5">Projects</label>
          <div className="rounded-xl border border-line overflow-hidden">
            {archivedProjects.map((p, i) => (
              <div
                key={p.path}
                className={'flex items-center gap-2.5 px-3 py-2.5 ' +
                  (i > 0 ? 'border-t border-line ' : '') +
                  'hover:bg-bg-hover/50 transition-colors'}
              >
                <FolderOpen size={13} className="text-fg-subtle shrink-0" />
                <div className="flex-1 min-w-0">
                  <div className="text-[12.5px] text-fg-default font-medium truncate">
                    {p.path.split('/').pop()}
                  </div>
                  <div className="text-[11px] text-fg-faint font-mono truncate">{p.path}</div>
                </div>
                <button
                  onClick={() => restoreProject(p.path)}
                  className="flex items-center gap-1 px-2 py-1 rounded-lg text-[11px] font-medium
                             text-fg-muted hover:text-fg-default hover:bg-bg-active transition-colors shrink-0"
                >
                  <RotateCcw size={11} />
                  Restore
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      {archivedSessions.length > 0 && (
        <div className="mb-6">
          <label className="text-[12.5px] font-medium text-fg-default block mb-2.5">Sessions</label>
          <div className="rounded-xl border border-line overflow-hidden">
            {archivedSessions.map((s, i) => (
              <div
                key={s.id}
                className={'flex items-center gap-2.5 px-3 py-2.5 ' +
                  (i > 0 ? 'border-t border-line ' : '') +
                  'hover:bg-bg-hover/50 transition-colors'}
              >
                <MessageSquare size={13} className="text-fg-subtle shrink-0" />
                <div className="flex-1 min-w-0">
                  <div className="text-[12.5px] text-fg-default truncate">
                    {s.title || '(untitled)'}
                  </div>
                  <div className="text-[11px] text-fg-faint font-mono truncate">
                    {s.projectPath.split('/').pop()}
                  </div>
                </div>
                <button
                  onClick={() => restoreSession(s)}
                  className="flex items-center gap-1 px-2 py-1 rounded-lg text-[11px] font-medium
                             text-fg-muted hover:text-fg-default hover:bg-bg-active transition-colors shrink-0"
                >
                  <RotateCcw size={11} />
                  Restore
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      {loading && (
        <div className="text-[12px] text-fg-subtle py-4 text-center">Loading…</div>
      )}
    </div>
  )
}

type McpStatus = { name: string; status: string; error?: string; toolCount: number; scope?: string }
type McpConfigEntry = { name: string; type?: string; url?: string; command?: string; args?: string[]; scope: 'global' | 'project' }

const STATUS_COLORS: Record<string, string> = {
  connected: 'bg-green-500',
  failed: 'bg-red-500',
  'needs-auth': 'bg-yellow-500',
  pending: 'bg-blue-400',
  disabled: 'bg-fg-faint',
}

function McpSection({ channelId, projectDir }: { channelId?: string; projectDir?: string }) {
  const [runtimeServers, setRuntimeServers] = useState<McpStatus[]>([])
  const [configServers, setConfigServers] = useState<McpConfigEntry[]>([])
  const [loading, setLoading] = useState(true)
  const [showAdd, setShowAdd] = useState(false)
  const [addName, setAddName] = useState('')
  const [addType, setAddType] = useState<'streamable-http' | 'command'>('streamable-http')
  const [addUrl, setAddUrl] = useState('')
  const [addCommand, setAddCommand] = useState('')
  const [addScope, setAddScope] = useState<'global' | 'project'>('global')

  const loadConfig = useCallback(() => {
    api().listMcpConfig(projectDir).then(setConfigServers).catch(() => {})
  }, [projectDir])

  useEffect(() => {
    setLoading(true)
    const promises: Promise<void>[] = [
      api().listMcpConfig(projectDir).then(setConfigServers).catch(() => {}),
    ]
    if (channelId) {
      promises.push(api().getMcpStatus(channelId).then(setRuntimeServers).catch(() => {}))
    }
    Promise.all(promises).then(() => setLoading(false))
  }, [channelId, projectDir, loadConfig])

  const runtimeByName = new Map(runtimeServers.map((s) => [s.name, s]))

  const merged = configServers.map((cfg) => ({
    ...cfg,
    runtime: runtimeByName.get(cfg.name),
  }))
  for (const rt of runtimeServers) {
    if (!configServers.some((c) => c.name === rt.name)) {
      merged.push({ name: rt.name, scope: 'global' as const, runtime: rt })
    }
  }

  async function handleAdd() {
    const name = addName.trim()
    if (!name) return
    const config: Record<string, unknown> = addType === 'streamable-http'
      ? { type: 'streamable-http', url: addUrl.trim() }
      : { command: addCommand.trim() }
    const scope = addScope === 'project' && projectDir ? 'project' : 'global'
    await api().addMcpServer(name, config, scope, projectDir)
    setShowAdd(false)
    setAddName('')
    setAddUrl('')
    setAddCommand('')
    loadConfig()
  }

  async function handleRemove(name: string, scope: 'global' | 'project') {
    await api().removeMcpServer(name, scope, projectDir)
    loadConfig()
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-1">
        <h2 className="text-[15px] font-semibold text-fg-default">MCP Servers</h2>
        <button
          onClick={() => setShowAdd(!showAdd)}
          className="flex items-center gap-1 px-2 py-1 rounded-md text-[12px]
                     text-fg-muted hover:text-fg-default hover:bg-bg-hover transition-colors"
        >
          <Plus size={12} />
          Add
        </button>
      </div>
      <p className="text-[12.5px] text-fg-muted mb-4">
        Configured in <code className="text-[11px]">.mcp.json</code>. Changes take effect on next session.
      </p>

      {showAdd && (
        <div className="rounded-xl border border-line p-3 mb-4 space-y-2.5">
          <input
            value={addName}
            onChange={(e) => setAddName(e.target.value)}
            placeholder="Server name"
            className="w-full h-8 px-2.5 rounded-lg bg-bg-inset border border-line
                       text-[12.5px] placeholder:text-fg-subtle"
          />
          <div className="flex gap-2">
            <button
              onClick={() => setAddType('streamable-http')}
              className={'px-2.5 py-1 rounded-md text-[11.5px] border transition-colors ' +
                (addType === 'streamable-http'
                  ? 'border-accent bg-accent/10 text-accent'
                  : 'border-line text-fg-muted hover:text-fg-default')}
            >
              HTTP URL
            </button>
            <button
              onClick={() => setAddType('command')}
              className={'px-2.5 py-1 rounded-md text-[11.5px] border transition-colors ' +
                (addType === 'command'
                  ? 'border-accent bg-accent/10 text-accent'
                  : 'border-line text-fg-muted hover:text-fg-default')}
            >
              Command
            </button>
          </div>
          {addType === 'streamable-http' ? (
            <input
              value={addUrl}
              onChange={(e) => setAddUrl(e.target.value)}
              placeholder="https://..."
              className="w-full h-8 px-2.5 rounded-lg bg-bg-inset border border-line
                         text-[12.5px] font-mono placeholder:text-fg-subtle"
            />
          ) : (
            <input
              value={addCommand}
              onChange={(e) => setAddCommand(e.target.value)}
              placeholder="npx -y @some/mcp-server"
              className="w-full h-8 px-2.5 rounded-lg bg-bg-inset border border-line
                         text-[12.5px] font-mono placeholder:text-fg-subtle"
            />
          )}
          <div className="flex items-center justify-between">
            <div className="flex gap-2">
              <button
                onClick={() => setAddScope('global')}
                className={'px-2.5 py-1 rounded-md text-[11px] border transition-colors ' +
                  (addScope === 'global'
                    ? 'border-accent bg-accent/10 text-accent'
                    : 'border-line text-fg-muted hover:text-fg-default')}
              >
                Global
              </button>
              {projectDir && (
                <button
                  onClick={() => setAddScope('project')}
                  className={'px-2.5 py-1 rounded-md text-[11px] border transition-colors ' +
                    (addScope === 'project'
                      ? 'border-accent bg-accent/10 text-accent'
                      : 'border-line text-fg-muted hover:text-fg-default')}
                >
                  Project
                </button>
              )}
            </div>
            <div className="flex gap-2">
              <button
                onClick={() => setShowAdd(false)}
                className="px-3 py-1 rounded-md text-[12px] text-fg-muted hover:text-fg-default
                           bg-bg-base hover:bg-bg-hover border border-line transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleAdd}
                disabled={!addName.trim() || (addType === 'streamable-http' ? !addUrl.trim() : !addCommand.trim())}
                className="px-3 py-1 rounded-md text-[12px] text-white bg-accent hover:bg-accent-hover
                           disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
              >
                Add Server
              </button>
            </div>
          </div>
        </div>
      )}

      {loading && (
        <div className="text-[12px] text-fg-subtle py-4 text-center">Loading…</div>
      )}

      {!loading && merged.length === 0 && (
        <div className="text-[12.5px] text-fg-subtle py-8 text-center">
          No MCP servers configured.
        </div>
      )}

      {!loading && merged.length > 0 && (
        <div className="rounded-xl border border-line overflow-hidden">
          {merged.map((s, i) => {
            const rt = s.runtime
            const statusDot = rt
              ? STATUS_COLORS[rt.status] ?? 'bg-fg-faint'
              : 'bg-fg-faint/40'
            const detail = s.url ?? s.command ?? ''
            return (
              <div
                key={s.name + s.scope}
                className={'group flex items-center gap-3 px-3 py-2.5 ' +
                  (i > 0 ? 'border-t border-line ' : '') +
                  'hover:bg-bg-hover/50 transition-colors'}
              >
                <span className={`w-2 h-2 rounded-full shrink-0 ${statusDot}`} />
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-1.5">
                    <span className="text-[12.5px] text-fg-default font-medium truncate">{s.name}</span>
                    <span className="text-[10px] px-1.5 py-px rounded-full bg-bg-active text-fg-faint">
                      {s.scope}
                    </span>
                  </div>
                  <div className="text-[11px] text-fg-faint truncate">
                    {rt ? rt.status : 'not running'}
                    {rt && rt.toolCount > 0 ? ` · ${rt.toolCount} tool${rt.toolCount > 1 ? 's' : ''}` : ''}
                    {detail ? ` · ${detail}` : ''}
                  </div>
                </div>
                {rt?.error && (
                  <div className="text-[11px] text-red-500 truncate max-w-[150px]" title={rt.error}>
                    {rt.error}
                  </div>
                )}
                {!s.runtime && (
                  <button
                    onClick={() => handleRemove(s.name, s.scope)}
                    className="h-6 w-6 flex items-center justify-center rounded-md
                               text-fg-subtle hover:text-red-500 hover:bg-bg-active
                               opacity-0 group-hover:opacity-100 transition-opacity"
                    title="Remove server"
                  >
                    <Trash2 size={12} />
                  </button>
                )}
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
