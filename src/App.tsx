import { useEffect, useState } from 'react'
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
    // Reuse existing channel if it's still running for this session
    const existing = chats.channelBySession[session.id]
    const existingChat = existing ? chats.chats[existing] : undefined
    if (existingChat && existingChat.status === 'running') {
      await chats.send(existing, text)
      // Push the user message into events immediately so it appears in the view
      useEvents.getState().appendEvent(session.id, {
        raw: { type: 'user', message: { role: 'user', content: text } },
        kind: 'user',
      })
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
    <div className="flex h-full">
      <Sidebar onNewChat={newChat} onOpenSession={openSession} />
      <main className="flex-1 flex flex-col min-h-0">
        {view.mode === 'empty' && (
          <div className="flex-1 flex items-center justify-center text-muted-foreground">
            Select a session or start a new chat
          </div>
        )}
        {view.mode === 'newChat' && !view.channelId && (
          <>
            <div className="flex-1 flex items-center justify-center text-muted-foreground">
              <p>New chat — type your first message below</p>
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
