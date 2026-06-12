import { useEffect, useState, useRef, useLayoutEffect, useMemo } from 'react'
import {
  Plus, ArrowUp, Paperclip, Code2, Gauge, ChevronDown, Check,
  FolderOpen, FolderPlus, FolderSearch, Search, Clock,
} from 'lucide-react'
import logoUrl from './assets/logo.png'
import { Sidebar } from './components/Sidebar'
import { ChatView } from './components/ChatView'
import { ChatHeader } from './components/ChatHeader'
import { Composer } from './components/Composer'
import { SlashMenu } from './components/SlashMenu'
import { NotesPanel } from './components/NotesPanel'
import { SettingsPage } from './components/SettingsPage'
import { PermissionModeSelector } from './components/PermissionModeSelector'
import { RewindDialog } from './components/RewindDialog'
import { toSlashCommands, filterCommands } from './lib/slash-commands'
import { useChats } from './store/chats'
import { useEvents } from './store/events'
import { useNotes } from './store/notes'
import { useProjects } from './store/projects'
import { useSessions } from './store/sessions'
import { api } from './lib/api'
import type { SessionSummary } from '@shared/types'

type View =
  | { mode: 'empty' }
  | { mode: 'newChat'; preselectedProject?: string; channelId?: string; sessionId?: string }
  | { mode: 'session'; session: SessionSummary; channelId?: string }
  | { mode: 'settings' }

export default function App() {
  const [view, setView] = useState<View>({ mode: 'empty' })
  const [notesOpen, setNotesOpen] = useState(false)
  const [composerPrefill, setComposerPrefill] = useState<{ text: string; nonce: number; replace?: boolean } | null>(null)
  const [rewindOpen, setRewindOpen] = useState(false)
  const [permModeByKey, setPermModeByKey] = useState<Record<string, string>>({})
  const draftsRef = useRef<Record<string, string>>({})
  const { selectSession } = useSessions()
  const { loadSession } = useEvents()
  const chats = useChats()

  useEffect(() => {
    chats.init()
  }, [chats])

  useEffect(() => {
    if (Notification.permission === 'default') {
      api().requestNotificationPermission()
    }
  }, [])

  async function openSession(s: SessionSummary) {
    selectSession(s.id)
    loadSession(s.id, s.projectPath)
    const ch = chats.channelBySession[s.id]
    if (ch) chats.markViewing(ch)
    setView({ mode: 'session', session: s })
    const storedMode = await api().getSessionPermissionMode(s.id)
    if (storedMode) setPermModeByKey((prev) => ({ ...prev, [s.id]: storedMode }))
  }

  function newChat(projectPath?: string) {
    const cwd =
      projectPath ??
      (view.mode === 'session' ? view.session.projectPath : undefined)
    selectSession(null)
    setView({ mode: 'newChat', preselectedProject: cwd })
  }

  async function handleNewChatSubmit(text: string, cwd: string, permissionMode?: string) {
    const cmd = text.trim().split(/\s/)[0].toLowerCase()
    if (cmd === '/config' || cmd === '/settings') {
      setView({ mode: 'settings' })
      return
    }
    const channelId = await chats.startNew(cwd, text, permissionMode)
    chats.markViewing(channelId)
    setView({ mode: 'newChat', channelId })
  }

  async function handleResumeSubmit(text: string, cwd: string, session: SessionSummary, permissionMode?: string) {
    const existing = chats.channelBySession[session.id]
    const existingChat = existing ? chats.chats[existing] : undefined
    if (existingChat && existingChat.status === 'running') {
      const result = await chats.send(existing, text)
      if (result?.navigate === 'settings') setView({ mode: 'settings' })
      if (result?.navigate === 'rewind') setRewindOpen(true)
      return
    }
    const channelId = await chats.resume(cwd, session.id, text, permissionMode)
    setView((v) => (v.mode === 'session' ? { ...v, channelId } : v))
  }

  const channelId =
    view.mode === 'newChat'
      ? view.channelId
      : view.mode === 'session'
        ? view.channelId ?? chats.channelBySession[view.session.id]
        : undefined
  const chatState = channelId ? chats.chats[channelId] : undefined

  const permKey = view.mode === 'session' ? view.session.id : (channelId ?? 'new')
  const activePermMode = permModeByKey[permKey] ?? chatState?.permissionMode ?? 'auto'

  // sessionId for ChatView (fallback to channelId for the brief window before CLI reveals it)
  const chatViewSessionId =
    view.mode === 'session'
      ? view.session.id
      : chatState?.sessionId ?? channelId ?? ''

  // Real sessionId for notes scope — null until CLI reveals it
  const notesSessionId =
    view.mode === 'session'
      ? view.session.id
      : chatState?.sessionId ?? null

  // Project path for notes scope
  const notesProjectPath =
    view.mode === 'session'
      ? view.session.projectPath
      : chatState?.cwd ?? null

  function handleRefill(text: string) {
    setComposerPrefill({ text, nonce: Date.now() })
  }

  // Cut current input to notes — prefers session scope, falls back to project.
  const notes = useNotes()
  function handleCutToNotes(text: string) {
    if (notesSessionId) {
      notes.addItem('session', notesSessionId, text)
    } else if (notesProjectPath) {
      notes.addItem('project', notesProjectPath, text)
    }
    if (!notesOpen && (notesSessionId || notesProjectPath)) setNotesOpen(true)
  }

  useEffect(() => {
    const hasContext = notesSessionId !== null || notesProjectPath !== null
    if (!hasContext) return
    async function check() {
      if (notesSessionId) await useNotes.getState().load('session', notesSessionId)
      if (notesProjectPath) await useNotes.getState().load('project', notesProjectPath)
      const state = useNotes.getState()
      const sItems = notesSessionId ? state.items[`session:${notesSessionId}`] ?? [] : []
      const pItems = notesProjectPath ? state.items[`project:${notesProjectPath}`] ?? [] : []
      if (sItems.some((i) => !i.done) || pItems.some((i) => !i.done)) {
        setNotesOpen(true)
      }
    }
    check()
  }, [notesSessionId, notesProjectPath])

  const composerCutHandler =
    notesSessionId || notesProjectPath ? handleCutToNotes : undefined

  const isRunning = chatState?.status === 'running'
  function handleStop() {
    if (channelId) chats.stop(channelId)
  }

  // Derive running + unread + permission sessions/projects for breathing dots
  const runningSessionIds = new Set<string>()
  const runningProjectPaths = new Set<string>()
  const unreadSessionIds = new Set<string>()
  const unreadProjectPaths = new Set<string>()
  const permissionSessionIds = new Set<string>()
  const permissionProjectPaths = new Set<string>()
  for (const c of Object.values(chats.chats)) {
    if (c.pendingPermission) {
      if (c.sessionId) permissionSessionIds.add(c.sessionId)
      if (c.cwd) permissionProjectPaths.add(c.cwd)
    }
    if (c.status === 'running') {
      if (c.sessionId) runningSessionIds.add(c.sessionId)
      if (c.cwd) runningProjectPaths.add(c.cwd)
    }
    if (c.unread) {
      if (c.sessionId) unreadSessionIds.add(c.sessionId)
      if (c.cwd) unreadProjectPaths.add(c.cwd)
    }
  }

  // Notes button is meaningful only when there's at least a project or session context
  const canShowNotes = view.mode !== 'empty' && (notesSessionId !== null || notesProjectPath !== null)
  const showNotesPanel = notesOpen && canShowNotes

  if (view.mode === 'settings') {
    return <SettingsPage onBack={() => setView({ mode: 'empty' })} channelId={channelId ?? undefined} projectDir={chatState?.cwd} />
  }

  return (
    <div className="flex h-full bg-bg-base">
      <Sidebar
        onNewChat={newChat}
        onOpenSession={openSession}
        onOpenSettings={() => setView({ mode: 'settings' })}
        runningSessionIds={runningSessionIds}
        runningProjectPaths={runningProjectPaths}
        unreadSessionIds={unreadSessionIds}
        unreadProjectPaths={unreadProjectPaths}
        permissionSessionIds={permissionSessionIds}
        permissionProjectPaths={permissionProjectPaths}
        autoExpandPath={
          view.mode === 'session' ? view.session.projectPath :
          view.mode === 'newChat' ? (chatState?.cwd ?? view.preselectedProject) :
          undefined
        }
      />
      <main className="flex-1 flex flex-col min-h-0 min-w-0 bg-bg-base rounded-l-2xl z-10 panel-float">
        {(view.mode === 'empty' || (view.mode === 'newChat' && !view.channelId)) && (
          <>
            <div className="app-drag h-9 flex-shrink-0" />
            <WelcomeComposer
              initialCwd={view.mode === 'newChat' ? view.preselectedProject : undefined}
              onSubmit={handleNewChatSubmit}
            />
          </>
        )}

        {view.mode === 'newChat' && view.channelId && (
          <>
            <ChatHeader
              projectPath={chatState?.cwd}
              notesOpen={notesOpen}
              canShowNotes={canShowNotes}
              onToggleNotes={() => setNotesOpen((o) => !o)}
            />
            <ChatView
              sessionId={chatViewSessionId}
              status={chatState?.status}
              error={chatState?.error}
              pendingPermission={chatState?.pendingPermission}
              onPermissionRespond={channelId ? (allowed, mode) => chats.respondPermission(channelId, allowed, mode) : undefined}
              pendingQuestion={chatState?.pendingQuestion}
              onQuestionRespond={channelId ? (result) => chats.respondQuestion(channelId, result) : undefined}
              onRewind={channelId ? (uid?: string) => chats.rewind(channelId, uid) : undefined}
              onEditResend={(text) => setComposerPrefill({ text, nonce: Date.now(), replace: true })}
            />
            <Composer
              key={channelId ?? 'new'}
              cwdLocked={chatState?.cwd}
              onSubmit={async (text, _cwd) => {
                if (channelId && chatState) {
                  const result = await chats.send(channelId, text)
                  if (result?.navigate === 'settings') setView({ mode: 'settings' })
                  if (result?.navigate === 'rewind') setRewindOpen(true)
                } else {
                  handleNewChatSubmit(text, _cwd)
                }
              }}
              disabled={chatState?.status === 'exited' || chatState?.status === 'error'}
              running={isRunning}
              onStop={handleStop}
              prefill={composerPrefill}
              onCutToNotes={composerCutHandler}
              availableCommands={chatState?.availableCommands ?? chats.cachedCommands}
              channelId={channelId ?? undefined}
              model={chatState?.model}
              permissionMode={activePermMode}
              onPermissionModeChange={(mode) => {
                setPermModeByKey((prev) => ({ ...prev, [permKey]: mode }))
                if (channelId && chats.chats[channelId]) {
                  useChats.setState((s) => ({
                    chats: { ...s.chats, [channelId]: { ...s.chats[channelId], permissionMode: mode } },
                  }))
                }
              }}
              initialDraft={draftsRef.current[channelId ?? 'new']}
              onDraftChange={(t) => { draftsRef.current[channelId ?? 'new'] = t }}
            />
          </>
        )}

        {view.mode === 'session' && (
          <>
            <ChatHeader
              projectPath={view.session.projectPath}
              sessionTitle={view.session.title}
              notesOpen={notesOpen}
              canShowNotes={canShowNotes}
              onToggleNotes={() => setNotesOpen((o) => !o)}
            />
            <ChatView
              sessionId={view.session.id}
              status={chatState?.status}
              error={chatState?.error}
              pendingPermission={chatState?.pendingPermission}
              onPermissionRespond={channelId ? (allowed, mode) => chats.respondPermission(channelId, allowed, mode) : undefined}
              pendingQuestion={chatState?.pendingQuestion}
              onQuestionRespond={channelId ? (result) => chats.respondQuestion(channelId, result) : undefined}
              onRewind={channelId ? (uid?: string) => chats.rewind(channelId, uid) : undefined}
              onEditResend={(text) => setComposerPrefill({ text, nonce: Date.now(), replace: true })}
            />
            <Composer
              key={view.session.id}
              cwdLocked={view.session.projectPath}
              onSubmit={async (text, cwd) => {
                if (channelId && chatState) {
                  const result = await chats.send(channelId, text)
                  if (result?.navigate === 'settings') setView({ mode: 'settings' })
                  if (result?.navigate === 'rewind') setRewindOpen(true)
                } else {
                  handleResumeSubmit(text, cwd, view.session, activePermMode !== 'default' ? activePermMode : undefined)
                }
              }}
              running={isRunning}
              onStop={handleStop}
              prefill={composerPrefill}
              onCutToNotes={composerCutHandler}
              availableCommands={chatState?.availableCommands ?? chats.cachedCommands}
              channelId={channelId ?? undefined}
              model={chatState?.model}
              permissionMode={activePermMode}
              onPermissionModeChange={(mode) => {
                setPermModeByKey((prev) => ({ ...prev, [permKey]: mode }))
                if (channelId && chats.chats[channelId]) {
                  useChats.setState((s) => ({
                    chats: { ...s.chats, [channelId]: { ...s.chats[channelId], permissionMode: mode } },
                  }))
                }
                api().setSessionPermissionMode(view.session.id, mode).catch(() => {})
              }}
              initialDraft={draftsRef.current[view.session.id]}
              onDraftChange={(t) => { draftsRef.current[view.session.id] = t }}
            />
          </>
        )}
      </main>

      {showNotesPanel && (
        <NotesPanel
          sessionId={notesSessionId}
          projectPath={notesProjectPath}
          onRefill={handleRefill}
        />
      )}

      {rewindOpen && (() => {
        const sessionId =
          view.mode === 'session' ? view.session.id :
          chatState?.sessionId ?? null
        const projectPath =
          view.mode === 'session' ? view.session.projectPath :
          chatState?.cwd ?? null
        if (!sessionId || !projectPath) {
          setRewindOpen(false)
          return null
        }
        return (
          <RewindDialog
            sessionId={sessionId}
            projectPath={projectPath}
            channelId={channelId}
            onClose={() => setRewindOpen(false)}
            onForked={(newSessionId) => {
              setRewindOpen(false)
              // The store already called selectSession + reloadFor; find the session and open it
              useSessions.getState().reloadFor(projectPath)
              // Brief delay to let reloadFor populate sidebar, then navigate
              setTimeout(() => {
                const sessions = useSessions.getState().sessionsByProject[projectPath] ?? []
                const forked = sessions.find((s) => s.id === newSessionId)
                if (forked) openSession(forked)
              }, 500)
            }}
          />
        )
      })()}
    </div>
  )
}

function WelcomeComposer({
  initialCwd,
  onSubmit,
}: {
  initialCwd?: string
  onSubmit: (text: string, cwd: string, permissionMode?: string) => void
}) {
  const { projects } = useProjects()
  const defaultCwd =
    initialCwd ??
    projects.filter((p) => !p.hidden && p.exists).sort((a, b) => b.lastActiveAt - a.lastActiveAt)[0]
      ?.path ??
    ''
  const [cwd, setCwd] = useState(defaultCwd)
  const [text, setText] = useState('')
  const [menuOpen, setMenuOpen] = useState(false)
  const [effort, setEffort] = useState<'low' | 'medium' | 'high'>('high')
  const [effortOpen, setEffortOpen] = useState(false)
  const [devMode, setDevMode] = useState(false)
  const [permMode, setPermMode] = useState<string>('default')
  const [slashQuery, setSlashQuery] = useState<string | null>(null)
  const [slashIndex, setSlashIndex] = useState(0)
  const taRef = useRef<HTMLTextAreaElement>(null)
  const menuRef = useRef<HTMLDivElement>(null)
  const effortRef = useRef<HTMLDivElement>(null)
  const composingRef = useRef(false)

  const { cachedCommands } = useChats()
  const allCommands = useMemo(() => toSlashCommands(cachedCommands), [cachedCommands])
  const slashResults = useMemo(
    () => (slashQuery !== null ? filterCommands(slashQuery, allCommands) : []),
    [slashQuery, allCommands],
  )
  const slashOpen = slashQuery !== null && slashResults.length > 0

  useEffect(() => {
    setCwd(defaultCwd)
  }, [initialCwd, defaultCwd])

  useLayoutEffect(() => {
    const el = taRef.current
    if (!el) return
    el.style.height = 'auto'
    el.style.height = Math.min(el.scrollHeight, 180) + 'px'
  }, [text])

  useEffect(() => {
    if (!menuOpen && !effortOpen) return
    function onClick(e: MouseEvent) {
      if (menuOpen && menuRef.current && !menuRef.current.contains(e.target as Node)) setMenuOpen(false)
      if (effortOpen && effortRef.current && !effortRef.current.contains(e.target as Node)) setEffortOpen(false)
    }
    document.addEventListener('mousedown', onClick)
    return () => document.removeEventListener('mousedown', onClick)
  }, [menuOpen, effortOpen])

  function submit() {
    if (!text.trim()) return
    const effective = cwd || defaultCwd
    if (!effective) return
    onSubmit(text, effective, permMode !== 'default' ? permMode : undefined)
    setText('')
  }

  const effortLabels = { low: 'Low', medium: 'Medium', high: 'High' } as const

  return (
    <div className="flex-1 flex flex-col items-center justify-center px-6">
      <div className="w-full max-w-2xl">
        <div className="flex flex-col items-center mb-6">
          {/* Logo with ambient symbols */}
          <div className="relative mb-4">
            {/* ✦ top-right */}
            <span
              className="symbol-a absolute -top-3 -right-4 text-[16px] select-none pointer-events-none"
              style={{ color: 'var(--color-accent, #f97316)' }}
            >✦</span>
            {/* ♪ bottom-left */}
            <span
              className="symbol-b absolute -bottom-2 -left-5 text-[14px] select-none pointer-events-none"
              style={{ color: 'var(--color-accent, #f97316)', opacity: 0.6 }}
            >♪</span>
            {/* ✧ top-left */}
            <span
              className="symbol-c absolute -top-1 -left-4 text-[14px] leading-none select-none pointer-events-none"
              style={{ color: 'var(--color-accent, #f97316)', opacity: 0.5 }}
            >✧</span>
            <img
              src={logoUrl}
              alt="ClaudeDance"
              className="logo-float w-16 h-16 rounded-2xl"
              draggable={false}
            />
          </div>
          <h1 className="text-[22px] font-semibold text-fg-default text-center">
            What can I help you with?
          </h1>
        </div>

        <div className="relative rounded-2xl bg-bg-inset border border-line/80 focus-within:border-line-strong transition-colors shadow-sm">
          {slashOpen && (
            <SlashMenu
              commands={slashResults}
              activeIndex={slashIndex}
              onSelect={(cmd) => {
                setText(cmd.command + ' ')
                setSlashQuery(null)
                taRef.current?.focus()
              }}
            />
          )}
          <textarea
            ref={taRef}
            value={text}
            onChange={(e) => {
              const val = e.target.value
              setText(val)
              if (val.startsWith('/')) {
                const q = val.slice(1).split(/\s/)[0]
                if (val.indexOf(' ') === -1) {
                  setSlashQuery(q)
                  setSlashIndex(0)
                } else {
                  setSlashQuery(null)
                }
              } else {
                setSlashQuery(null)
              }
            }}
            onCompositionStart={() => { composingRef.current = true }}
            onCompositionEnd={() => { requestAnimationFrame(() => { composingRef.current = false }) }}
            onKeyDown={(e) => {
              if (slashOpen) {
                if (e.key === 'ArrowDown') {
                  e.preventDefault()
                  setSlashIndex((i) => (i + 1) % slashResults.length)
                  return
                }
                if (e.key === 'ArrowUp') {
                  e.preventDefault()
                  setSlashIndex((i) => (i - 1 + slashResults.length) % slashResults.length)
                  return
                }
                if (e.key === 'Tab') {
                  e.preventDefault()
                  const cmd = slashResults[slashIndex]
                  if (cmd) { setText(cmd.command + ' '); setSlashQuery(null) }
                  return
                }
                if (e.key === 'Escape') {
                  e.preventDefault()
                  setSlashQuery(null)
                  return
                }
              }
              if (e.key !== 'Enter') return
              const native = e.nativeEvent as KeyboardEvent
              if (composingRef.current || native.isComposing || native.keyCode === 229) return
              if (slashOpen) {
                e.preventDefault()
                const cmd = slashResults[slashIndex]
                if (cmd) { setText(cmd.command + ' '); setSlashQuery(null) }
                return
              }
              if (e.shiftKey) return
              e.preventDefault()
              submit()
            }}
            rows={1}
            placeholder="Ask anything…"
            className="w-full resize-none bg-transparent px-4 pt-4 pb-2
                       text-[14px] leading-[1.55] placeholder:text-fg-subtle"
          />

          <div className="flex items-center justify-between px-3 py-2 border-t border-line/50">
            {/* Left: + menu + permission mode */}
            <div className="flex items-center gap-2">
              <div className="relative" ref={menuRef}>
                <button
                  onClick={() => setMenuOpen((o) => !o)}
                  className={'h-7 w-7 flex items-center justify-center rounded-full border transition-all ' +
                    (menuOpen
                      ? 'bg-bg-active border-line-strong text-fg-default rotate-45'
                      : 'border-line text-fg-subtle hover:text-fg-default hover:border-line-strong')}
                >
                  <Plus size={14} strokeWidth={2.25} />
                </button>
                {menuOpen && (
                  <div className="absolute bottom-full left-0 mb-2 w-52 bg-bg-inset border border-line
                                  rounded-xl shadow-lg overflow-hidden z-50">
                    <button className="w-full flex items-center gap-2.5 px-3 py-2 text-[12.5px]
                                       text-fg-muted hover:bg-bg-hover hover:text-fg-default text-left transition-colors">
                      <Paperclip size={13} className="text-fg-subtle" />
                      Attach file
                    </button>
                    <div className="border-t border-line" />
                    <button
                      onClick={() => setDevMode((d) => !d)}
                      className="w-full flex items-center justify-between px-3 py-2 text-[12.5px]
                                 text-fg-muted hover:bg-bg-hover hover:text-fg-default text-left transition-colors"
                    >
                      <span className="flex items-center gap-2.5">
                        <Code2 size={13} className="text-fg-subtle" />
                        Developer mode
                      </span>
                      <span className={'text-[11px] font-medium ' + (devMode ? 'text-accent' : 'text-fg-faint')}>
                        {devMode ? 'ON' : 'OFF'}
                      </span>
                    </button>
                  </div>
                )}
              </div>
              <PermissionModeSelector
                currentMode={permMode}
                onLocalChange={setPermMode}
              />
            </div>

            {/* Right: effort selector + send */}
            <div className="flex items-center gap-1.5">
              <div className="relative" ref={effortRef}>
                <button
                  onClick={() => setEffortOpen((o) => !o)}
                  className="flex items-center gap-1 px-2 py-0.5 rounded-lg text-[11px] font-medium
                             text-fg-subtle hover:text-fg-default hover:bg-bg-hover transition-colors"
                >
                  <Gauge size={12} />
                  {effortLabels[effort]}
                  <ChevronDown size={10} className="opacity-60" />
                </button>
                {effortOpen && (
                  <div className="absolute top-full right-0 mt-2 w-36 bg-bg-inset border border-line
                                  rounded-xl shadow-lg overflow-hidden z-50">
                    {(['low', 'medium', 'high'] as const).map((e) => (
                      <button
                        key={e}
                        onClick={() => { setEffort(e); setEffortOpen(false) }}
                        className={'w-full flex items-center justify-between px-3 py-1.5 text-[12px] ' +
                          'hover:bg-bg-hover transition-colors text-left ' +
                          (effort === e ? 'text-fg-default font-medium' : 'text-fg-muted')}
                      >
                        {effortLabels[e]}
                        {effort === e && <Check size={11} className="text-accent" />}
                      </button>
                    ))}
                  </div>
                )}
              </div>

              <button
                onClick={submit}
                disabled={!text.trim()}
                className="h-7 w-7 flex items-center justify-center rounded-full
                           bg-fg-default text-bg-base hover:bg-fg-muted
                           disabled:bg-bg-active disabled:text-fg-faint disabled:cursor-not-allowed
                           transition-colors"
                aria-label="Send"
              >
                <ArrowUp size={14} strokeWidth={2.5} />
              </button>
            </div>
          </div>
        </div>

        {/* Project selector below the input box */}
        <ProjectPicker
          cwd={cwd}
          projects={projects.filter((p) => !p.hidden && !p.archived)}
          onSelect={(path) => setCwd(path)}
        />
      </div>
    </div>
  )
}

function ProjectPicker({
  cwd,
  projects,
  onSelect,
}: {
  cwd: string
  projects: { path: string; lastActiveAt: number }[]
  onSelect: (path: string) => void
}) {
  const [open, setOpen] = useState(false)
  const [search, setSearch] = useState('')
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!open) return
    function onClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', onClick)
    return () => document.removeEventListener('mousedown', onClick)
  }, [open])

  const cwdLabel = cwd.split('/').pop() || cwd || 'Select project'
  const recent = [...projects].sort((a, b) => b.lastActiveAt - a.lastActiveAt).slice(0, 3)

  return (
    <div className="relative mt-1" ref={ref}>
      {/* Trigger button — sits in a subtle shadow strip */}
      <div className="rounded-b-2xl bg-gradient-to-b from-transparent to-bg-panel/60 px-1 pt-1.5 pb-1">
        <button
          onClick={() => { setOpen((o) => !o); setSearch('') }}
          className="flex items-center gap-1.5 px-2 py-1 rounded-md
                     text-[12px] text-fg-subtle hover:text-fg-default hover:bg-bg-hover
                     transition-colors"
        >
          <FolderOpen size={12} className="shrink-0" />
          <span className="font-mono truncate max-w-[240px]">{cwdLabel}</span>
          <ChevronDown size={10} className={'opacity-60 transition-transform ' + (open ? 'rotate-180' : '')} />
        </button>
      </div>

      {/* Dropdown */}
      {open && (
        <div className="absolute left-0 top-full mt-1 w-72 bg-bg-inset border border-line
                        rounded-xl shadow-xl overflow-hidden z-50">
          {/* Search */}
          <div className="px-2 py-2 border-b border-line">
            <div className="relative">
              <Search size={12} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-fg-subtle" />
              <input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search projects..."
                autoFocus
                className="w-full h-7 pl-7 pr-2 rounded-lg bg-bg-base border border-line
                           text-[12px] placeholder:text-fg-subtle"
              />
            </div>
          </div>

          {/* Recent projects */}
          <div className="px-1.5 py-1.5">
            <div className="flex items-center gap-1.5 px-2 py-1 text-[10px] uppercase tracking-[0.06em] text-fg-faint font-medium">
              <Clock size={10} />
              Recent
            </div>
            {recent
              .filter((p) => !search || p.path.toLowerCase().includes(search.toLowerCase()))
              .map((p) => (
                <button
                  key={p.path}
                  onClick={() => { onSelect(p.path); setOpen(false) }}
                  className={'w-full flex items-center gap-2 px-2 py-1.5 rounded-lg text-left ' +
                    'text-[12px] transition-colors ' +
                    (p.path === cwd
                      ? 'bg-accent-subtle text-fg-default'
                      : 'text-fg-muted hover:bg-bg-hover hover:text-fg-default')}
                >
                  <FolderOpen size={11} className="text-fg-subtle shrink-0" />
                  <span className="font-mono truncate">{p.path.split('/').pop()}</span>
                  {p.path === cwd && <Check size={11} className="ml-auto text-accent shrink-0" />}
                </button>
              ))}
            {recent.length === 0 && (
              <div className="px-2 py-2 text-[11px] text-fg-faint">No recent projects</div>
            )}
          </div>

          {/* Add new project */}
          <div className="border-t border-line px-1.5 py-1.5">
            <div className="flex items-center gap-1.5 px-2 py-1 text-[10px] uppercase tracking-[0.06em] text-fg-faint font-medium">
              <FolderPlus size={10} />
              Add project
            </div>
            <button
              className="w-full flex items-center gap-2 px-2 py-1.5 rounded-lg text-left
                         text-[12px] text-fg-muted hover:bg-bg-hover hover:text-fg-default transition-colors"
            >
              <Plus size={11} className="text-fg-subtle" />
              New blank project
            </button>
            <button
              onClick={async () => {
                const path = await api().pickFolder()
                if (!path) return
                await api().addProject(path)
                useProjects.getState().load()
                onSelect(path)
                setOpen(false)
              }}
              className="w-full flex items-center gap-2 px-2 py-1.5 rounded-lg text-left
                         text-[12px] text-fg-muted hover:bg-bg-hover hover:text-fg-default transition-colors"
            >
              <FolderSearch size={11} className="text-fg-subtle" />
              Choose existing folder
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
