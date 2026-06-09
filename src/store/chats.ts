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
}

type State = {
  chats: Record<ChannelId, ChatState>
  channelBySession: Record<string, ChannelId>
  init: () => void
  startNew: (cwd: string, initialMessage: string) => Promise<ChannelId>
  resume: (cwd: string, sessionId: string, initialMessage: string) => Promise<ChannelId>
  send: (channelId: ChannelId, text: string) => Promise<void>
  stop: (channelId: ChannelId) => Promise<void>
}

let listenerInstalled = false

export const useChats = create<State>((set, get) => ({
  chats: {},
  channelBySession: {},
  init: () => {
    if (listenerInstalled) return
    listenerInstalled = true
    api().onChatEvent((evt) => {
      if (evt.kind === 'event') {
        const chat = get().chats[evt.channelId]
        const sessionId = evt.event.sessionId ?? chat?.sessionId ?? evt.channelId
        if (chat && evt.event.sessionId && !chat.sessionId) {
          set((s) => ({
            chats: { ...s.chats, [evt.channelId]: { ...chat, sessionId: evt.event.sessionId! } },
            channelBySession: { ...s.channelBySession, [evt.event.sessionId!]: evt.channelId },
          }))
        }
        useEvents.getState().appendEvent(sessionId, evt.event)
      } else if (evt.kind === 'exit') {
        set((s) => {
          const c = s.chats[evt.channelId]
          if (!c) return s
          return { chats: { ...s.chats, [evt.channelId]: { ...c, status: 'exited' } } }
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
    return channelId
  },
  send: async (channelId, text) => {
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
}))
