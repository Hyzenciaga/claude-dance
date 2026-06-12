import { create } from 'zustand'
import type { RawEvent } from '@shared/types'
import { api } from '../lib/api'

type State = {
  eventsBySession: Record<string, RawEvent[]>
  loadSession: (sessionId: string, projectDir: string) => Promise<void>
  appendEvent: (sessionId: string, event: RawEvent) => void
  clear: (sessionId: string) => void
}

export const useEvents = create<State>((set, get) => ({
  eventsBySession: {},
  loadSession: async (sessionId, projectDir) => {
    if (get().eventsBySession[sessionId]) return
    const events = await api().readSession(sessionId, projectDir)
    set((s) => ({ eventsBySession: { ...s.eventsBySession, [sessionId]: events } }))
  },
  appendEvent: (sessionId, event) => {
    set((s) => ({
      eventsBySession: {
        ...s.eventsBySession,
        [sessionId]: [...(s.eventsBySession[sessionId] ?? []), event],
      },
    }))
  },
  clear: (sessionId) => {
    set((s) => {
      const copy = { ...s.eventsBySession }
      delete copy[sessionId]
      return { eventsBySession: copy }
    })
  },
}))
