import { create } from 'zustand'
import type { ChannelId } from '@shared/types'
import { api } from '../lib/api'
import { useEvents } from './events'

type ChatState = {
  channelId: ChannelId
  sessionId: string | null
  status: 'running' | 'exited' | 'error'
  error?: string
  cwd: string
  unread?: boolean
}

type State = {
  chats: Record<ChannelId, ChatState>
  channelBySession: Record<string, ChannelId>
  viewingChannelId: string | null
  init: () => void
  startNew: (cwd: string, initialMessage: string) => Promise<ChannelId>
  resume: (cwd: string, sessionId: string, initialMessage: string) => Promise<ChannelId>
  send: (channelId: ChannelId, text: string) => Promise<void>
  stop: (channelId: ChannelId) => Promise<void>
  markViewing: (channelId: string | null) => void
}

let listenerInstalled = false

export const useChats = create<State>((set, get) => ({
  chats: {},
  channelBySession: {},
  viewingChannelId: null,
  init: () => {
    if (listenerInstalled) return
    listenerInstalled = true
    api().onChatEvent((evt) => {
      if (evt.kind === 'event') {
        const chat = get().chats[evt.channelId]
        let storageKey: string
        if (chat?.sessionId) {
          storageKey = chat.sessionId
        } else if (evt.event.sessionId) {
          const revealed = evt.event.sessionId
          storageKey = revealed
          const acc = useEvents.getState().eventsBySession[evt.channelId]
          if (acc && acc.length > 0) {
            useEvents.setState((s) => {
              const next = { ...s.eventsBySession }
              delete next[evt.channelId]
              next[revealed] = [...(next[revealed] ?? []), ...acc]
              return { eventsBySession: next }
            })
          }
          if (chat) {
            set((s) => ({
              chats: { ...s.chats, [evt.channelId]: { ...chat, sessionId: revealed } },
              channelBySession: { ...s.channelBySession, [revealed]: evt.channelId },
            }))
          }
        } else {
          storageKey = evt.channelId
        }
        useEvents.getState().appendEvent(storageKey, evt.event)
      } else if (evt.kind === 'exit') {
        set((s) => {
          const c = s.chats[evt.channelId]
          if (!c) return s
          const isViewing = s.viewingChannelId === evt.channelId
          return {
            chats: {
              ...s.chats,
              [evt.channelId]: { ...c, status: 'exited', unread: !isViewing },
            },
          }
        })
      } else if (evt.kind === 'error') {
        set((s) => {
          const c = s.chats[evt.channelId]
          if (!c) return s
          return {
            chats: { ...s.chats, [evt.channelId]: { ...c, status: 'error', error: evt.message } },
          }
        })
      }
    })
  },
  startNew: async (cwd, initialMessage) => {
    const { channelId } = await api().startChat({ cwd, initialMessage })
    set((s) => ({
      chats: {
        ...s.chats,
        [channelId]: { channelId, sessionId: null, status: 'running', cwd },
      },
    }))
    useEvents.getState().appendEvent(channelId, {
      raw: { type: 'user', message: { role: 'user', content: initialMessage } },
      kind: 'user',
    })
    return channelId
  },
  resume: async (cwd, sessionId, initialMessage) => {
    const { channelId } = await api().startChat({ cwd, sessionId, initialMessage })
    set((s) => ({
      chats: {
        ...s.chats,
        [channelId]: { channelId, sessionId, status: 'running', cwd },
      },
      channelBySession: { ...s.channelBySession, [sessionId]: channelId },
    }))
    useEvents.getState().appendEvent(sessionId, {
      raw: { type: 'user', message: { role: 'user', content: initialMessage } },
      kind: 'user',
    })
    return channelId
  },
  send: async (channelId, text) => {
    const chat = get().chats[channelId]
    const storageKey = chat?.sessionId ?? channelId
    useEvents.getState().appendEvent(storageKey, {
      raw: { type: 'user', message: { role: 'user', content: text } },
      kind: 'user',
    })
    await api().sendChatMessage(channelId, text)
  },
  stop: async (channelId) => {
    await api().stopChat(channelId)
    set((s) => {
      const c = s.chats[channelId]
      if (!c) return s
      return { chats: { ...s.chats, [channelId]: { ...c, status: 'exited' } } }
    })
  },
  markViewing: (channelId) => {
    set((s) => {
      const updates: Record<ChannelId, ChatState> = {}
      if (channelId) {
        const c = s.chats[channelId]
        if (c?.unread) updates[channelId] = { ...c, unread: false }
      }
      return {
        viewingChannelId: channelId,
        chats: Object.keys(updates).length > 0 ? { ...s.chats, ...updates } : s.chats,
      }
    })
  },
}))
