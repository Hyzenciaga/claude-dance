import { create } from 'zustand'
import type { NoteItem, NoteScope } from '@shared/types'
import { api } from '../lib/api'

type Key = string // `${scope}:${key}`

function makeKey(scope: NoteScope, key: string): Key {
  return `${scope}:${key}`
}

type State = {
  items: Record<Key, NoteItem[]>
  loaded: Record<Key, boolean>
  loading: Record<Key, boolean>

  load: (scope: NoteScope, key: string) => Promise<void>
  setItems: (scope: NoteScope, key: string, items: NoteItem[]) => void
  addItem: (scope: NoteScope, key: string, text: string) => NoteItem
  toggle: (scope: NoteScope, key: string, id: string) => void
  remove: (scope: NoteScope, key: string, id: string) => void
  promoteToProject: (sessionKey: string, projectKey: string, id: string) => void
}

const persistTimers = new Map<Key, ReturnType<typeof setTimeout>>()
const PERSIST_DEBOUNCE_MS = 400

function schedulePersist(scope: NoteScope, key: string, items: NoteItem[]) {
  const k = makeKey(scope, key)
  const existing = persistTimers.get(k)
  if (existing) clearTimeout(existing)
  const t = setTimeout(() => {
    persistTimers.delete(k)
    api().writeNotes(scope, key, items).catch((err) => {
      console.error('[notes] persist failed', err)
    })
  }, PERSIST_DEBOUNCE_MS)
  persistTimers.set(k, t)
}

function genId(): string {
  return 'n' + Math.random().toString(36).slice(2, 10)
}

export const useNotes = create<State>((set, get) => ({
  items: {},
  loaded: {},
  loading: {},

  load: async (scope, key) => {
    const k = makeKey(scope, key)
    if (get().loaded[k] || get().loading[k]) return
    set((s) => ({ loading: { ...s.loading, [k]: true } }))
    try {
      const items = await api().readNotes(scope, key)
      set((s) => ({
        items: { ...s.items, [k]: items },
        loaded: { ...s.loaded, [k]: true },
        loading: { ...s.loading, [k]: false },
      }))
    } catch (err) {
      console.error('[notes] load failed', err)
      set((s) => ({ loading: { ...s.loading, [k]: false } }))
    }
  },

  setItems: (scope, key, items) => {
    const k = makeKey(scope, key)
    set((s) => ({ items: { ...s.items, [k]: items }, loaded: { ...s.loaded, [k]: true } }))
    schedulePersist(scope, key, items)
  },

  addItem: (scope, key, text) => {
    const trimmed = text.trim()
    const item: NoteItem = { id: genId(), done: false, text: trimmed }
    const k = makeKey(scope, key)
    const current = get().items[k] ?? []
    const next = [...current, item]
    set((s) => ({ items: { ...s.items, [k]: next }, loaded: { ...s.loaded, [k]: true } }))
    schedulePersist(scope, key, next)
    return item
  },

  toggle: (scope, key, id) => {
    const k = makeKey(scope, key)
    const current = get().items[k] ?? []
    const next = current.map((i) => (i.id === id ? { ...i, done: !i.done } : i))
    set((s) => ({ items: { ...s.items, [k]: next } }))
    schedulePersist(scope, key, next)
  },

  remove: (scope, key, id) => {
    const k = makeKey(scope, key)
    const current = get().items[k] ?? []
    const next = current.filter((i) => i.id !== id)
    set((s) => ({ items: { ...s.items, [k]: next } }))
    schedulePersist(scope, key, next)
  },

  promoteToProject: (sessionKey, projectKey, id) => {
    const sk = makeKey('session', sessionKey)
    const pk = makeKey('project', projectKey)
    const sessionItems = get().items[sk] ?? []
    const target = sessionItems.find((i) => i.id === id)
    if (!target) return
    const newSession = sessionItems.filter((i) => i.id !== id)
    const projectItems = get().items[pk] ?? []
    const newProject = [...projectItems, { ...target, id: genId() }]
    set((s) => ({
      items: {
        ...s.items,
        [sk]: newSession,
        [pk]: newProject,
      },
      loaded: { ...s.loaded, [sk]: true, [pk]: true },
    }))
    schedulePersist('session', sessionKey, newSession)
    schedulePersist('project', projectKey, newProject)
  },
}))
