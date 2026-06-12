import { create } from 'zustand'
import type { SessionSummary } from '@shared/types'
import { api } from '../lib/api'

type State = {
  sessionsByProject: Record<string, SessionSummary[]>
  selectedSessionId: string | null
  loadFor: (projectPath: string) => Promise<void>
  reloadFor: (projectPath: string) => Promise<void>
  selectSession: (sessionId: string | null) => void
  optimisticAdd: (session: SessionSummary) => void
  archiveSession: (sessionId: string, projectPath: string) => Promise<void>
  unarchiveSession: (sessionId: string, projectPath: string) => Promise<void>
  renameSession: (sessionId: string, title: string, projectPath: string) => Promise<void>
}

export const useSessions = create<State>((set, get) => ({
  sessionsByProject: {},
  selectedSessionId: null,
  loadFor: async (projectPath) => {
    if (get().sessionsByProject[projectPath]) return
    const sessions = await api().listSessions(projectPath)
    set((s) => ({ sessionsByProject: { ...s.sessionsByProject, [projectPath]: sessions } }))
  },
  reloadFor: async (projectPath) => {
    const sessions = await api().listSessions(projectPath)
    set((s) => ({ sessionsByProject: { ...s.sessionsByProject, [projectPath]: sessions } }))
  },
  selectSession: (sessionId) => set({ selectedSessionId: sessionId }),
  optimisticAdd: (session) => {
    set((s) => {
      const existing = s.sessionsByProject[session.projectPath] ?? []
      // avoid duplicates
      if (existing.some((ss) => ss.id === session.id)) return s
      return {
        sessionsByProject: {
          ...s.sessionsByProject,
          [session.projectPath]: [session, ...existing],
        },
      }
    })
  },
  archiveSession: async (sessionId, projectPath) => {
    await api().archiveSession(sessionId)
    await get().reloadFor(projectPath)
  },
  unarchiveSession: async (sessionId, projectPath) => {
    await api().unarchiveSession(sessionId)
    await get().reloadFor(projectPath)
  },
  renameSession: async (sessionId, title, projectPath) => {
    await api().renameSession(sessionId, title, projectPath)
    set((s) => {
      const sessions = s.sessionsByProject[projectPath]
      if (!sessions) return s
      return {
        sessionsByProject: {
          ...s.sessionsByProject,
          [projectPath]: sessions.map((ss) =>
            ss.id === sessionId ? { ...ss, title } : ss,
          ),
        },
      }
    })
  },
}))
