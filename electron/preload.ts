import { contextBridge, ipcRenderer } from 'electron'
import type { Project, SessionSummary, RawEvent, IpcChatEvent, ChatStartRequest, ChatStartResponse } from '@shared/types'

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
}

contextBridge.exposeInMainWorld('api', api)

export type Api = typeof api
