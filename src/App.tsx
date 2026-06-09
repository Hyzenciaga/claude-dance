import { useEffect, useState } from 'react'
import { MessageSquarePlus } from 'lucide-react'
import { Sidebar } from './components/Sidebar'
import { ChatView } from './components/ChatView'
import { Composer } from './components/Composer'
import { useChats } from './store/chats'
import { useEvents } from './store/events'
import { useSessions } from './store/sessions'
import type { SessionSummary } from '@shared/types'

type View =
  | { mode: 'empty' }
  | { mode: 'newChat'; preselectedProject?: string; channelId?: string; sessionId?: string }
  | { mode: 'session'; session: SessionSummary; channelId?: string }

export default function App() {
  const [view, setView] = useState<View>({ mode: 'empty' })
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
  const sessionId =
    view.mode === 'session'
      ? view.session.id
      : chatState?.sessionId ?? channelId ?? ''

  return (
    <div className="flex h-full bg-bg-base">
      <Sidebar onNewChat={newChat} onOpenSession={openSession} />
      <main className="flex-1 flex flex-col min-h-0">
        {/* drag region across the top of main pane */}
        <div className="app-drag h-9 flex-shrink-0" />

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
            />
          </>
        )}

        {view.mode === 'newChat' && view.channelId && (
          <>
            <ChatView sessionId={sessionId} status={chatState?.status} error={chatState?.error} />
            <Composer
              cwdLocked={chatState?.cwd}
              onSubmit={(text, cwd) => handleNewChatSubmit(text, cwd)}
              disabled={chatState?.status !== 'running' && chatState?.status !== undefined}
            />
          </>
        )}

        {view.mode === 'session' && (
          <>
            <ChatView sessionId={view.session.id} status={chatState?.status} error={chatState?.error} />
            <Composer
              cwdLocked={view.session.projectPath}
              onSubmit={(text, cwd) => handleResumeSubmit(text, cwd, view.session)}
            />
          </>
        )}
      </main>
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
