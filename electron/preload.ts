import { contextBridge, ipcRenderer } from 'electron'
import type {
  Project,
  SessionSummary,
  RawEvent,
  IpcChatEvent,
  ChatStartRequest,
  ChatStartResponse,
  NoteItem,
  NoteScope,
} from '@shared/types'

const api = {
  listProjects: (): Promise<Project[]> => ipcRenderer.invoke('projects.list'),
  addProject: (path: string): Promise<Project[]> => ipcRenderer.invoke('project.add', path),
  hideProject: (path: string): Promise<Project[]> => ipcRenderer.invoke('project.hide', path),
  listSessions: (projectPath: string): Promise<SessionSummary[]> =>
    ipcRenderer.invoke('sessions.list', projectPath),
  readSession: (jsonlPath: string): Promise<RawEvent[]> =>
    ipcRenderer.invoke('session.read', jsonlPath),
  startChat: (req: ChatStartRequest): Promise<ChatStartResponse> =>
    ipcRenderer.invoke('chat.start', req),
  sendChatMessage: (channelId: string, text: string): Promise<void> =>
    ipcRenderer.invoke('chat.sendMessage', channelId, text),
  stopChat: (channelId: string): Promise<void> => ipcRenderer.invoke('chat.stop', channelId),
  onChatEvent: (cb: (evt: IpcChatEvent) => void): (() => void) => {
    const listener = (_e: Electron.IpcRendererEvent, evt: IpcChatEvent) => cb(evt)
    ipcRenderer.on('chat.event', listener)
    return () => ipcRenderer.removeListener('chat.event', listener)
  },
  readNotes: (scope: NoteScope, key: string): Promise<NoteItem[]> =>
    ipcRenderer.invoke('notes.read', scope, key),
  writeNotes: (scope: NoteScope, key: string, items: NoteItem[]): Promise<void> =>
    ipcRenderer.invoke('notes.write', scope, key, items),
}

contextBridge.exposeInMainWorld('api', api)

export type Api = typeof api
