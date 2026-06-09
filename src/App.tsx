import { useState } from 'react'
import { Sidebar } from './components/Sidebar'
import { useEvents } from './store/events'
import { useSessions } from './store/sessions'
import type { SessionSummary } from '@shared/types'

type View =
  | { mode: 'empty' }
  | { mode: 'newChat'; preselectedProject?: string }
  | { mode: 'session'; session: SessionSummary }

export default function App() {
  const [view, setView] = useState<View>({ mode: 'empty' })
  const { selectSession } = useSessions()
  const { loadFromFile } = useEvents()

  function openSession(s: SessionSummary) {
    selectSession(s.id)
    loadFromFile(s.id, s.jsonlPath)
    setView({ mode: 'session', session: s })
  }

  function newChat(projectPath?: string) {
    selectSession(null)
    setView({ mode: 'newChat', preselectedProject: projectPath })
  }

  return (
    <div className="flex h-full">
      <Sidebar onNewChat={newChat} onOpenSession={openSession} />
      <main className="flex-1 flex flex-col items-center justify-center text-muted-foreground">
        {view.mode === 'empty' && <p>Select a session or start a new chat</p>}
        {view.mode === 'newChat' && (
          <p>New chat (cwd: {view.preselectedProject ?? 'unset'})</p>
        )}
        {view.mode === 'session' && (
          <p>Session: {view.session.title}</p>
        )}
      </main>
    </div>
  )
}
