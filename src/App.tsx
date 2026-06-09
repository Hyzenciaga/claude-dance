import { useEffect, useState } from 'react'
import { MessageSquarePlus, PanelRightOpen, PanelRightClose } from 'lucide-react'
import { Sidebar } from './components/Sidebar'
import { ChatView } from './components/ChatView'
import { Composer } from './components/Composer'
import { NotesPanel } from './components/NotesPanel'
import { SettingsPage } from './components/SettingsPage'
import { useChats } from './store/chats'
import { useEvents } from './store/events'
import { useNotes } from './store/notes'
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

        {view.mode === 'empty' && <EmptyState onNewChat={() => newChat()} />}

        {view.mode === 'newChat' && !view.channelId && (
          <>
            <div className="flex-1 flex flex-col items-center justify-center text-fg-subtle gap-2">
              <MessageSquarePlus size={32} strokeWidth={1.4} className="text-fg-faint" />
              <p className="text-[13px]">New chat — type your first message below</p>
            </div>
            <Composer
              initialCwd={view.preselectedProject}
              onSubmit={handleNewChatSubmit}
              prefill={composerPrefill}
              onCutToNotes={composerCutHandler}
            />
          </>
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

function EmptyState({ onNewChat }: { onNewChat: () => void }) {
  return (
    <div className="flex-1 flex flex-col items-center justify-center gap-4 text-fg-subtle">
      <MessageSquarePlus size={36} strokeWidth={1.3} className="text-fg-faint" />
      <p className="text-[13px]">Select a conversation, or start fresh.</p>
      <button
        onClick={onNewChat}
        className="px-3 py-1.5 rounded-md bg-bg-inset border border-line hover:bg-bg-hover
                   text-fg-default text-[12.5px] font-medium transition-colors"
      >
        New chat
      </button>
    </div>
  )
}
