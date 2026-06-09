import { useEffect, useState, useRef, useLayoutEffect } from 'react'
import {
  PanelRightOpen, PanelRightClose,
  Plus, ArrowUp, Paperclip, Code2, Gauge, ChevronDown, Check,
} from 'lucide-react'
import { Sidebar } from './components/Sidebar'
import { ChatView } from './components/ChatView'
import { Composer } from './components/Composer'
import { NotesPanel } from './components/NotesPanel'
import { SettingsPage } from './components/SettingsPage'
import { useChats } from './store/chats'
import { useEvents } from './store/events'
import { useNotes } from './store/notes'
import { useProjects } from './store/projects'
import { useSessions } from './store/sessions'
import type { SessionSummary } from '@shared/types'

type View =
  | { mode: 'empty' }
  | { mode: 'newChat'; preselectedProject?: string; channelId?: string; sessionId?: string }
  | { mode: 'session'; session: SessionSummary; channelId?: string }
  | { mode: 'settings' }

export default function App() {
  const [view, setView] = useState<View>({ mode: 'empty' })
  const [notesOpen, setNotesOpen] = useState(false)
  const [composerPrefill, setComposerPrefill] = useState<{ text: string; nonce: number } | null>(null)
  const { selectSession } = useSessions()
  const { loadFromFile } = useEvents()
  const chats = useChats()

  useEffect(() => {
    chats.init()
  }, [chats])

  function openSession(s: SessionSummary) {
    selectSession(s.id)
    loadFromFile(s.id, s.jsonlPath)
    setView({ mode: 'session', session: s })
  }

  function newChat(projectPath?: string) {
    selectSession(null)
    setView({ mode: 'newChat', preselectedProject: projectPath })
  }

  async function handleNewChatSubmit(text: string, cwd: string) {
    const channelId = await chats.startNew(cwd, text)
    setView((v) => (v.mode === 'newChat' ? { ...v, channelId } : v))
  }

  async function handleResumeSubmit(text: string, cwd: string, session: SessionSummary) {
    const existing = chats.channelBySession[session.id]
    const existingChat = existing ? chats.chats[existing] : undefined
    if (existingChat && existingChat.status === 'running') {
      await chats.send(existing, text)
      return
    }
    const channelId = await chats.resume(cwd, session.id, text)
    setView((v) => (v.mode === 'session' ? { ...v, channelId } : v))
  }

  const channelId =
    view.mode === 'newChat'
      ? view.channelId
      : view.mode === 'session'
        ? view.channelId ?? chats.channelBySession[view.session.id]
        : undefined
  const chatState = channelId ? chats.chats[channelId] : undefined

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

  const composerCutHandler =
    notesSessionId || notesProjectPath ? handleCutToNotes : undefined

  const isRunning = chatState?.status === 'running'
  function handleStop() {
    if (channelId) chats.stop(channelId)
  }

  // Notes button is meaningful only when there's at least a project or session context
  const canShowNotes = view.mode !== 'empty' && (notesSessionId !== null || notesProjectPath !== null)
  const showNotesPanel = notesOpen && canShowNotes

  if (view.mode === 'settings') {
    return <SettingsPage onBack={() => setView({ mode: 'empty' })} />
  }

  return (
    <div className="flex h-full bg-bg-base">
      <Sidebar onNewChat={newChat} onOpenSession={openSession} onOpenSettings={() => setView({ mode: 'settings' })} />
      <main className="flex-1 flex flex-col min-h-0 min-w-0">
        {/* drag region + right-side notes toggle */}
        <div className="app-drag h-9 flex-shrink-0 flex items-center justify-end pr-2.5">
          {canShowNotes && (
            <button
              onClick={() => setNotesOpen((o) => !o)}
              className="app-no-drag h-7 w-7 flex items-center justify-center rounded
                         text-fg-subtle hover:text-fg-default hover:bg-bg-hover transition-colors"
              title={notesOpen ? 'Hide notes' : 'Show notes'}
              aria-label={notesOpen ? 'Hide notes panel' : 'Show notes panel'}
            >
              {notesOpen ? <PanelRightClose size={14} /> : <PanelRightOpen size={14} />}
            </button>
          )}
        </div>

        {(view.mode === 'empty' || (view.mode === 'newChat' && !view.channelId)) && (
          <WelcomeComposer
            initialCwd={view.mode === 'newChat' ? view.preselectedProject : undefined}
            onSubmit={(text, cwd) => {
              if (view.mode === 'empty') newChat()
              handleNewChatSubmit(text, cwd)
            }}
          />
        )}

        {view.mode === 'newChat' && view.channelId && (
          <>
            <ChatView sessionId={chatViewSessionId} status={chatState?.status} error={chatState?.error} />
            <Composer
              cwdLocked={chatState?.cwd}
              onSubmit={(text, cwd) => handleNewChatSubmit(text, cwd)}
              disabled={chatState?.status !== 'running' && chatState?.status !== undefined}
              running={isRunning}
              onStop={handleStop}
              prefill={composerPrefill}
              onCutToNotes={composerCutHandler}
            />
          </>
        )}

        {view.mode === 'session' && (
          <>
            <ChatView sessionId={view.session.id} status={chatState?.status} error={chatState?.error} />
            <Composer
              cwdLocked={view.session.projectPath}
              onSubmit={(text, cwd) => handleResumeSubmit(text, cwd, view.session)}
              running={isRunning}
              onStop={handleStop}
              prefill={composerPrefill}
              onCutToNotes={composerCutHandler}
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
    </div>
  )
}

function WelcomeComposer({
  initialCwd,
  onSubmit,
}: {
  initialCwd?: string
  onSubmit: (text: string, cwd: string) => void
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
  const taRef = useRef<HTMLTextAreaElement>(null)
  const menuRef = useRef<HTMLDivElement>(null)
  const effortRef = useRef<HTMLDivElement>(null)
  const composingRef = useRef(false)

  useEffect(() => {
    if (!initialCwd) setCwd(defaultCwd)
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
    onSubmit(text, effective)
    setText('')
  }

  const effortLabels = { low: 'Low', medium: 'Medium', high: 'High' } as const

  return (
    <div className="flex-1 flex flex-col items-center justify-center px-6">
      <div className="w-full max-w-2xl">
        <h1 className="text-[22px] font-semibold text-fg-default text-center mb-6">
          What can I help you with?
        </h1>

        <div className="rounded-xl bg-bg-inset border border-line/80 focus-within:border-line-strong transition-colors shadow-sm">
          <textarea
            ref={taRef}
            value={text}
            onChange={(e) => setText(e.target.value)}
            onCompositionStart={() => { composingRef.current = true }}
            onCompositionEnd={() => { requestAnimationFrame(() => { composingRef.current = false }) }}
            onKeyDown={(e) => {
              if (e.key !== 'Enter') return
              const native = e.nativeEvent as KeyboardEvent
              if (composingRef.current || native.isComposing || native.keyCode === 229) return
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
            {/* Left: + menu + cwd */}
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
                                  rounded-lg shadow-lg overflow-hidden z-50">
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

              {/* cwd selector */}
              <select
                value={cwd}
                onChange={(e) => setCwd(e.target.value)}
                className="text-[11.5px] font-mono text-fg-subtle bg-transparent border-none
                           cursor-pointer hover:text-fg-default max-w-[200px] truncate"
                title={cwd}
              >
                {projects.filter((p) => !p.hidden).map((p) => (
                  <option key={p.path} value={p.path}>{p.path.split('/').pop()}</option>
                ))}
              </select>
            </div>

            {/* Right: effort selector + send */}
            <div className="flex items-center gap-1.5">
              <div className="relative" ref={effortRef}>
                <button
                  onClick={() => setEffortOpen((o) => !o)}
                  className="flex items-center gap-1 px-2 py-0.5 rounded-md text-[11px] font-medium
                             text-fg-subtle hover:text-fg-default hover:bg-bg-hover transition-colors"
                >
                  <Gauge size={12} />
                  {effortLabels[effort]}
                  <ChevronDown size={10} className="opacity-60" />
                </button>
                {effortOpen && (
                  <div className="absolute bottom-full right-0 mb-2 w-36 bg-bg-inset border border-line
                                  rounded-lg shadow-lg overflow-hidden z-50">
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
      </div>
    </div>
  )
}
