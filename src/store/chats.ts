import { create } from 'zustand'
import type { ChannelId, CommandInfo, PermissionRequest, AskUserQuestionRequest } from '@shared/types'
import { api } from '../lib/api'
import { useEvents } from './events'
import { useSessions } from './sessions'
import { handleLocalCommand } from '../lib/local-commands'

type ChatState = {
  channelId: ChannelId
  sessionId: string | null
  status: 'running' | 'idle' | 'exited' | 'error'
  error?: string
  cwd: string
  unread?: boolean
  availableCommands?: CommandInfo[]
  model?: string
  version?: string
  permissionMode?: string
  pendingPermission?: PermissionRequest
  pendingQuestion?: AskUserQuestionRequest
}

type State = {
  chats: Record<ChannelId, ChatState>
  channelBySession: Record<string, ChannelId>
  viewingChannelId: string | null
  cachedCommands?: CommandInfo[]
  init: () => void
  startNew: (cwd: string, initialMessage: string, permissionMode?: string) => Promise<ChannelId>
  resume: (cwd: string, sessionId: string, initialMessage: string, permissionMode?: string) => Promise<ChannelId>
  send: (channelId: ChannelId, text: string) => Promise<{ navigate?: string } | void>
  stop: (channelId: ChannelId) => Promise<void>
  markViewing: (channelId: string | null) => void
  respondPermission: (channelId: ChannelId, allowed: boolean, mode?: string) => void
  respondQuestion: (channelId: ChannelId, result: { cancelled: true } | { cancelled: false; answers: Record<string, string>; response?: string }) => void
  rewind: (channelId: ChannelId, userMessageId?: string) => Promise<{ canRewind: boolean; error?: string; filesChanged?: string[] }>
  forkAndResume: (sessionId: string, upToMessageId: string, cwd: string, rewindChannelId?: string, rewindMessageId?: string) => Promise<string>
}

function tryLocalCommand(text: string) {
  if (!text.trim().startsWith('/')) return null
  const result = handleLocalCommand(text, {})
  return result.handled ? result : null
}

let listenerInstalled = false

export const useChats = create<State>((set, get) => ({
  chats: {},
  channelBySession: {},
  viewingChannelId: null,
  init: () => {
    if (listenerInstalled) return
    listenerInstalled = true
    api().getCachedCommands().then((cmds) => {
      if (cmds.length > 0) set({ cachedCommands: cmds })
    }).catch(() => {})
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
            // Optimistically insert placeholder so sidebar shows it immediately.
            // reloadFor on result replaces it with the real title from disk.
            if (chat.cwd) {
              const now = Date.now()
              const placeholder = {
                id: revealed,
                projectPath: chat.cwd,
                title: 'New conversation',
                firstMessageAt: now,
                lastMessageAt: now,
                messageCount: 1,
                archived: false,
              }
              useSessions.setState((s) => {
                const existing = s.sessionsByProject[chat.cwd] ?? []
                if (existing.some((ss) => ss.id === revealed)) return s
                return {
                  sessionsByProject: {
                    ...s.sessionsByProject,
                    [chat.cwd]: [placeholder, ...existing],
                  },
                }
              })
            }
            useSessions.getState().selectSession(revealed)
          }
        } else {
          storageKey = evt.channelId
        }
        useEvents.getState().appendEvent(storageKey, evt.event)
        if (evt.event.kind === 'result') {
          set((s) => {
            const c = s.chats[evt.channelId]
            if (!c || c.status !== 'running') return s
            return { chats: { ...s.chats, [evt.channelId]: { ...c, status: 'idle' } } }
          })
          // Reload sessions now that the session file has been written with a real title
          const cwd = get().chats[evt.channelId]?.cwd
          if (cwd) useSessions.getState().reloadFor(cwd)
        }
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
      } else if (evt.kind === 'slashCommands') {
        set((s) => {
          const c = s.chats[evt.channelId]
          if (!c) return s
          return {
            cachedCommands: evt.commands.length > 0 ? evt.commands : s.cachedCommands,
            chats: {
              ...s.chats,
              [evt.channelId]: {
              ...c,
              availableCommands: evt.commands,
              model: evt.model ?? c.model,
              version: evt.version ?? c.version,
            },
            },
          }
        })
      } else if (evt.kind === 'permissionRequest') {
        set((s) => {
          const c = s.chats[evt.channelId]
          if (!c) return s
          return {
            chats: { ...s.chats, [evt.channelId]: { ...c, pendingPermission: evt.request } },
          }
        })
      } else if (evt.kind === 'askUserQuestion') {
        set((s) => {
          const c = s.chats[evt.channelId]
          if (!c) return s
          return {
            chats: { ...s.chats, [evt.channelId]: { ...c, pendingQuestion: evt.request } },
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
  startNew: async (cwd, initialMessage, permissionMode) => {
    const localResult = tryLocalCommand(initialMessage)
    const skipInitialMessage = localResult?.handled && !localResult.navigate
    const pm = permissionMode as import('@shared/types').PermissionMode | undefined
    const { channelId } = await api().startChat({ cwd, initialMessage, skipInitialMessage, permissionMode: pm })
    set((s) => ({
      chats: {
        ...s.chats,
        [channelId]: { channelId, sessionId: null, status: skipInitialMessage ? 'idle' : 'running', cwd, permissionMode },
      },
    }))
    useEvents.getState().appendEvent(channelId, {
      raw: { type: 'user', message: { role: 'user', content: initialMessage } },
      kind: 'user',
    })
    if (skipInitialMessage && localResult?.response) {
      useEvents.getState().appendEvent(channelId, {
        raw: {
          type: 'assistant',
          message: { role: 'assistant', content: [{ type: 'text', text: localResult.response }] },
        },
        kind: 'assistant',
      })
    }
    return channelId
  },
  resume: async (cwd, sessionId, initialMessage, permissionMode) => {
    const localResult = tryLocalCommand(initialMessage)
    const skipInitialMessage = localResult?.handled && !localResult.navigate
    const pm = permissionMode as import('@shared/types').PermissionMode | undefined
    const { channelId } = await api().startChat({ cwd, sessionId, initialMessage, skipInitialMessage, permissionMode: pm })
    set((s) => ({
      chats: {
        ...s.chats,
        [channelId]: { channelId, sessionId, status: skipInitialMessage ? 'idle' : 'running', cwd, permissionMode },
      },
      channelBySession: { ...s.channelBySession, [sessionId]: channelId },
    }))
    useEvents.getState().appendEvent(sessionId, {
      raw: { type: 'user', message: { role: 'user', content: initialMessage } },
      kind: 'user',
    })
    if (skipInitialMessage && localResult?.response) {
      useEvents.getState().appendEvent(sessionId, {
        raw: {
          type: 'assistant',
          message: { role: 'assistant', content: [{ type: 'text', text: localResult.response }] },
        },
        kind: 'assistant',
      })
    }
    return channelId
  },
  send: async (channelId, text) => {
    const chat = get().chats[channelId]
    const storageKey = chat?.sessionId ?? channelId

    const localResult = handleLocalCommand(text, {
      availableCommands: chat?.availableCommands,
      model: chat?.model,
      version: chat?.version,
      sessionId: chat?.sessionId ?? undefined,
    })

    if (localResult.handled) {
      useEvents.getState().appendEvent(storageKey, {
        raw: { type: 'user', message: { role: 'user', content: text } },
        kind: 'user',
      })
      if (localResult.response) {
        useEvents.getState().appendEvent(storageKey, {
          raw: {
            type: 'assistant',
            message: {
              role: 'assistant',
              content: [{ type: 'text', text: localResult.response }],
            },
          },
          kind: 'assistant',
        })
      }
      if (localResult.navigate) return { navigate: localResult.navigate }
      return
    }

    useEvents.getState().appendEvent(storageKey, {
      raw: { type: 'user', message: { role: 'user', content: text } },
      kind: 'user',
    })
    if (chat && chat.status !== 'running') {
      set((s) => ({
        chats: { ...s.chats, [channelId]: { ...s.chats[channelId], status: 'running' } },
      }))
    }
    await api().sendChatMessage(channelId, text)
  },
  stop: async (channelId) => {
    const chat = get().chats[channelId]
    if (chat?.pendingPermission) {
      api().respondPermission(chat.pendingPermission.requestId, false)
    }
    await api().stopChat(channelId)
    set((s) => {
      const c = s.chats[channelId]
      if (!c) return s
      return { chats: { ...s.chats, [channelId]: { ...c, status: 'exited', pendingPermission: undefined, pendingQuestion: undefined } } }
    })
  },
  respondPermission: (channelId, allowed, mode) => {
    const chat = get().chats[channelId]
    if (!chat?.pendingPermission) return
    const msg = mode === 'always' ? '__always__' : undefined
    api().respondPermission(chat.pendingPermission.requestId, allowed, msg)
    set((s) => {
      const c = s.chats[channelId]
      if (!c) return s
      return {
        chats: { ...s.chats, [channelId]: { ...c, pendingPermission: undefined } },
      }
    })
  },
  respondQuestion: (channelId, result) => {
    const chat = get().chats[channelId]
    if (!chat?.pendingQuestion) return
    const { pendingQuestion } = chat
    api().respondQuestion(pendingQuestion.requestId, result)

    if (!result.cancelled) {
      const pairs = pendingQuestion.questions.map((q) => ({
        question: q.question,
        header: q.header,
        answer: result.answers[q.question] ?? '',
      }))
      const storageKey = chat.sessionId ?? channelId
      useEvents.getState().appendEvent(storageKey, {
        raw: { pairs, response: result.response ?? undefined } as unknown as Record<string, unknown>,
        kind: 'askUserAnswer',
      })
    }

    set((s) => {
      const c = s.chats[channelId]
      if (!c) return s
      return {
        chats: { ...s.chats, [channelId]: { ...c, pendingQuestion: undefined } },
      }
    })
  },
  rewind: async (channelId, userMessageId) => {
    return api().rewindFiles(channelId, userMessageId)
  },
  forkAndResume: async (sessionId, upToMessageId, cwd, rewindChannelId, rewindMessageId) => {
    // 1. Fork the session up to the chosen message
    const { sessionId: newSessionId } = await api().forkSession(sessionId, upToMessageId, cwd)

    // 2. Optionally rewind files on the old channel before switching
    if (rewindChannelId && rewindMessageId) {
      await api().rewindFiles(rewindChannelId, rewindMessageId).catch(() => {})
    }

    // 3. Start a new channel resuming the forked session (empty prompt, skip initial)
    const { channelId: newChannelId } = await api().startChat({
      cwd,
      sessionId: newSessionId,
      initialMessage: '',
      skipInitialMessage: true,
    })

    set((s) => ({
      chats: {
        ...s.chats,
        [newChannelId]: {
          channelId: newChannelId,
          sessionId: newSessionId,
          status: 'idle',
          cwd,
        },
      },
      channelBySession: { ...s.channelBySession, [newSessionId]: newChannelId },
    }))

    // 4. Load the forked session events and register it in sidebar
    const { loadSession } = (await import('./events')).useEvents.getState()
    loadSession(newSessionId, cwd)
    useSessions.getState().reloadFor(cwd)
    useSessions.getState().selectSession(newSessionId)

    return newSessionId
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
