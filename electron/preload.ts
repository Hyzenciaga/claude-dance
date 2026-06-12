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
import type { NotificationPrefs } from './app-data'

const api = {
  listProjects: (): Promise<Project[]> => ipcRenderer.invoke('projects.list'),
  addProject: (path: string): Promise<Project[]> => ipcRenderer.invoke('project.add', path),
  hideProject: (path: string): Promise<Project[]> => ipcRenderer.invoke('project.hide', path),
  archiveProject: (path: string): Promise<Project[]> => ipcRenderer.invoke('project.archive', path),
  unarchiveProject: (path: string): Promise<Project[]> => ipcRenderer.invoke('project.unarchive', path),
  listSessions: (projectPath: string): Promise<SessionSummary[]> =>
    ipcRenderer.invoke('sessions.list', projectPath),
  archiveSession: (sessionId: string): Promise<void> => ipcRenderer.invoke('session.archive', sessionId),
  renameSession: (sessionId: string, title: string, dir?: string): Promise<void> =>
    ipcRenderer.invoke('session.rename', sessionId, title, dir),
  unarchiveSession: (sessionId: string): Promise<void> => ipcRenderer.invoke('session.unarchive', sessionId),
  listArchivedSessions: (): Promise<SessionSummary[]> => ipcRenderer.invoke('sessions.listArchived'),
  readSession: (sessionId: string, projectDir: string): Promise<RawEvent[]> =>
    ipcRenderer.invoke('session.read', sessionId, projectDir),
  startChat: (req: ChatStartRequest): Promise<ChatStartResponse> =>
    ipcRenderer.invoke('chat.start', req),
  sendChatMessage: (channelId: string, text: string): Promise<void> =>
    ipcRenderer.invoke('chat.sendMessage', channelId, text),
  stopChat: (channelId: string): Promise<void> => ipcRenderer.invoke('chat.stop', channelId),
  respondPermission: (requestId: string, allowed: boolean, message?: string): Promise<void> =>
    ipcRenderer.invoke('chat.permissionResponse', requestId, allowed, message),
  respondQuestion: (requestId: string, result: { cancelled: true } | { cancelled: false; answers: Record<string, string>; response?: string }): Promise<void> =>
    ipcRenderer.invoke('chat.questionResponse', requestId, result),
  getModels: (channelId: string): Promise<{ id: string; name: string }[]> =>
    ipcRenderer.invoke('chat.models', channelId),
  setModel: (channelId: string, model: string): Promise<void> =>
    ipcRenderer.invoke('chat.setModel', channelId, model),
  setPermissionMode: (channelId: string, mode: string): Promise<void> =>
    ipcRenderer.invoke('chat.setPermissionMode', channelId, mode),
  warmup: (cwd: string): Promise<void> =>
    ipcRenderer.invoke('chat.warmup', cwd),
  rewindFiles: (channelId: string, userMessageId?: string): Promise<{ canRewind: boolean; error?: string; filesChanged?: string[]; insertions?: number; deletions?: number }> =>
    ipcRenderer.invoke('chat.rewind', channelId, userMessageId),
  forkSession: (sessionId: string, upToMessageId: string, dir: string): Promise<{ sessionId: string }> =>
    ipcRenderer.invoke('session.fork', sessionId, upToMessageId, dir),
  readUserMessages: (sessionId: string, projectDir: string): Promise<{ uuid: string; text: string }[]> =>
    ipcRenderer.invoke('session.readUserMessages', sessionId, projectDir),
  getMcpStatus: (channelId: string): Promise<{ name: string; status: string; error?: string; toolCount: number; scope?: string }[]> =>
    ipcRenderer.invoke('chat.mcpStatus', channelId),
  getCachedCommands: (): Promise<{ name: string; description: string }[]> =>
    ipcRenderer.invoke('commands.cached'),
  onChatEvent: (cb: (evt: IpcChatEvent) => void): (() => void) => {
    const listener = (_e: Electron.IpcRendererEvent, evt: IpcChatEvent) => cb(evt)
    ipcRenderer.on('chat.event', listener)
    return () => ipcRenderer.removeListener('chat.event', listener)
  },
  readNotes: (scope: NoteScope, key: string): Promise<NoteItem[]> =>
    ipcRenderer.invoke('notes.read', scope, key),
  writeNotes: (scope: NoteScope, key: string, items: NoteItem[]): Promise<void> =>
    ipcRenderer.invoke('notes.write', scope, key, items),
  listMcpConfig: (projectDir?: string): Promise<{ name: string; type?: string; url?: string; command?: string; args?: string[]; scope: 'global' | 'project' }[]> =>
    ipcRenderer.invoke('mcp.list', projectDir),
  addMcpServer: (name: string, config: Record<string, unknown>, scope: 'global' | 'project', projectDir?: string): Promise<void> =>
    ipcRenderer.invoke('mcp.add', name, config, scope, projectDir),
  removeMcpServer: (name: string, scope: 'global' | 'project', projectDir?: string): Promise<void> =>
    ipcRenderer.invoke('mcp.remove', name, scope, projectDir),
  getSessionPermissionMode: (sessionId: string): Promise<string | null> =>
    ipcRenderer.invoke('session.getPermissionMode', sessionId),
  setSessionPermissionMode: (sessionId: string, mode: string): Promise<void> =>
    ipcRenderer.invoke('session.setPermissionMode', sessionId, mode),
  pickFolder: (): Promise<string | null> =>
    ipcRenderer.invoke('dialog.pickFolder'),
  requestNotificationPermission: (): Promise<NotificationPermission> =>
    Notification.requestPermission(),
  testNotification: (): Promise<boolean> =>
    ipcRenderer.invoke('notification.test'),
  getNotificationPrefs: (): Promise<NotificationPrefs> =>
    ipcRenderer.invoke('notification.getPrefs'),
  setNotificationPrefs: (prefs: NotificationPrefs): Promise<void> =>
    ipcRenderer.invoke('notification.setPrefs', prefs),
}

contextBridge.exposeInMainWorld('api', api)

export type Api = typeof api
