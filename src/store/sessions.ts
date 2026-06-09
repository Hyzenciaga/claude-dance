import { create } from 'zustand'
import type { SessionSummary } from '@shared/types'
import { api } from '../lib/api'

type State = {
  sessionsByProject: Record<string, SessionSummary[]>
  selectedSessionId: string | null
  loadFor: (projectPath: string) => Promise<void>
  selectSession: (sessionId: string | null) => void
}

export const useSessions = create<State>((set, get) => ({
  sessionsByProject: {},
  selectedSessionId: null,
  loadFor: async (projectPath) => {
    if (get().sessionsByProject[projectPath]) return
    const sessions = await api().listSessions(projectPath)
    set((s) => ({ sessionsByProject: { ...s.sessionsByProject, [projectPath]: sessions } }))
  },
  selectSession: (sessionId) => set({ selectedSessionId: sessionId }),
}))
