import { ipcMain, dialog, Notification } from 'electron'
import { homedir } from 'node:os'
import { join } from 'node:path'
import { listSessions as sdkListSessions, getSessionMessages, forkSession } from '@anthropic-ai/claude-agent-sdk'
import type { SDKSessionInfo, SessionMessage } from '@anthropic-ai/claude-agent-sdk'
import type { Project, SessionSummary, RawEvent, ChatStartRequest, ChatStartResponse } from '@shared/types'
import { scanProjects } from './project-scanner'
import { readAppData, writeAppData, type NotificationPrefs } from './app-data'
import { startChat, sendUserMessage, stopChat, respondPermission, respondQuestion, getModels, setModel, setPermissionMode, warmup, rewindFiles, getMcpStatus, renameSession, setMainWindow } from './sdk-adapter'
import type { ModelInfo, McpStatusInfo } from './sdk-adapter'
import { discoverSkills } from './skill-scanner'
import {
  readNotes,
  writeNotes,
  notesFilePath,
  type NoteItem,
  type NoteScope,
} from './notes-store'
import { listMcpConfig, addMcpServer, removeMcpServer, type McpServerEntry } from './mcp-config'

const PROJECTS_DIR = join(homedir(), '.claude', 'projects')
const APP_DATA_PATH = join(homedir(), '.claudedance', 'projects.json')
const NOTES_ROOT = join(homedir(), '.claudedance', 'notes')

function toSessionSummary(info: SDKSessionInfo, projectPath: string): SessionSummary {
  return {
    id: info.sessionId,
    projectPath,
    title: info.customTitle ?? info.summary ?? '(no messages)',
    firstMessageAt: info.createdAt ?? 0,
    lastMessageAt: info.lastModified,
    messageCount: 0,
    archived: false,
  }
}

function toRawEvent(msg: SessionMessage): RawEvent {
  return {
    raw: { type: msg.type, message: msg.message, uuid: msg.uuid } as unknown as Record<string, unknown>,
    kind: msg.type,
    sessionId: msg.session_id,
  }
}

export { setMainWindow }

export function registerIpc(): void {
  ipcMain.handle('projects.list', async (): Promise<Project[]> => {
    return scanProjects({ projectsDir: PROJECTS_DIR, appDataPath: APP_DATA_PATH })
  })

  ipcMain.handle('project.add', async (_e, path: string): Promise<Project[]> => {
    const data = await readAppData(APP_DATA_PATH)
    if (!data.manual.includes(path)) data.manual.push(path)
    data.hidden = data.hidden.filter((p) => p !== path)
    await writeAppData(APP_DATA_PATH, data)
    return scanProjects({ projectsDir: PROJECTS_DIR, appDataPath: APP_DATA_PATH })
  })

  ipcMain.handle('project.hide', async (_e, path: string): Promise<Project[]> => {
    const data = await readAppData(APP_DATA_PATH)
    if (!data.hidden.includes(path)) data.hidden.push(path)
    await writeAppData(APP_DATA_PATH, data)
    return scanProjects({ projectsDir: PROJECTS_DIR, appDataPath: APP_DATA_PATH })
  })

  ipcMain.handle('project.archive', async (_e, path: string): Promise<Project[]> => {
    const data = await readAppData(APP_DATA_PATH)
    if (!data.archived.includes(path)) data.archived.push(path)
    await writeAppData(APP_DATA_PATH, data)
    return scanProjects({ projectsDir: PROJECTS_DIR, appDataPath: APP_DATA_PATH })
  })

  ipcMain.handle('project.unarchive', async (_e, path: string): Promise<Project[]> => {
    const data = await readAppData(APP_DATA_PATH)
    data.archived = data.archived.filter((p) => p !== path)
    await writeAppData(APP_DATA_PATH, data)
    return scanProjects({ projectsDir: PROJECTS_DIR, appDataPath: APP_DATA_PATH })
  })

  ipcMain.handle('sessions.list', async (_e, projectPath: string): Promise<SessionSummary[]> => {
    const data = await readAppData(APP_DATA_PATH)
    const archivedSet = new Set(data.archivedSessions)
    const infos = await sdkListSessions({ dir: projectPath })
    return infos.map((info) => ({
      ...toSessionSummary(info, projectPath),
      archived: archivedSet.has(info.sessionId),
    }))
  })

  ipcMain.handle('session.archive', async (_e, sessionId: string): Promise<void> => {
    const data = await readAppData(APP_DATA_PATH)
    if (!data.archivedSessions.includes(sessionId)) data.archivedSessions.push(sessionId)
    await writeAppData(APP_DATA_PATH, data)
  })

  ipcMain.handle('session.unarchive', async (_e, sessionId: string): Promise<void> => {
    const data = await readAppData(APP_DATA_PATH)
    data.archivedSessions = data.archivedSessions.filter((id) => id !== sessionId)
    await writeAppData(APP_DATA_PATH, data)
  })

  ipcMain.handle('sessions.listArchived', async (): Promise<SessionSummary[]> => {
    const data = await readAppData(APP_DATA_PATH)
    const archivedSet = new Set(data.archivedSessions)
    if (archivedSet.size === 0) return []
    const projects = await scanProjects({ projectsDir: PROJECTS_DIR, appDataPath: APP_DATA_PATH })
    const results: SessionSummary[] = []
    for (const project of projects) {
      const infos = await sdkListSessions({ dir: project.path })
      for (const info of infos) {
        if (archivedSet.has(info.sessionId)) {
          results.push({ ...toSessionSummary(info, project.path), archived: true })
        }
      }
    }
    return results
  })

  ipcMain.handle('session.read', async (_e, sessionId: string, projectDir: string): Promise<RawEvent[]> => {
    const messages = await getSessionMessages(sessionId, { dir: projectDir, includeSystemMessages: true })
    return messages.map(toRawEvent)
  })

  ipcMain.handle('chat.start', async (_e, req: ChatStartRequest): Promise<ChatStartResponse> => {
    const channelId = startChat(req)
    return { channelId }
  })

  ipcMain.handle('chat.sendMessage', async (_e, channelId: string, text: string): Promise<void> => {
    sendUserMessage(channelId, text)
  })

  ipcMain.handle('chat.stop', async (_e, channelId: string): Promise<void> => {
    stopChat(channelId)
  })

  ipcMain.handle(
    'chat.permissionResponse',
    async (_e, requestId: string, allowed: boolean, message?: string): Promise<void> => {
      respondPermission(requestId, allowed, message)
    },
  )

  ipcMain.handle(
    'chat.questionResponse',
    async (_e, requestId: string, result: { cancelled: true } | { cancelled: false; answers: Record<string, string>; response?: string }): Promise<void> => {
      respondQuestion(requestId, result)
    },
  )

  ipcMain.handle('chat.models', async (_e, channelId: string): Promise<ModelInfo[]> => {
    return getModels(channelId)
  })

  ipcMain.handle('chat.setModel', async (_e, channelId: string, model: string): Promise<void> => {
    await setModel(channelId, model)
  })

  ipcMain.handle('chat.setPermissionMode', async (_e, channelId: string, mode: string): Promise<void> => {
    await setPermissionMode(channelId, mode)
  })

  ipcMain.handle('chat.warmup', async (_e, cwd: string): Promise<void> => {
    await warmup(cwd)
  })

  ipcMain.handle(
    'chat.rewind',
    async (_e, channelId: string, userMessageId?: string) => {
      return rewindFiles(channelId, userMessageId)
    },
  )

  // Fork session up to a specific user message — creates a new branch session
  ipcMain.handle(
    'session.fork',
    async (_e, sessionId: string, upToMessageId: string, dir: string): Promise<{ sessionId: string }> => {
      return forkSession(sessionId, { upToMessageId, dir })
    },
  )

  // Read user messages only (for rewind picker)
  ipcMain.handle(
    'session.readUserMessages',
    async (_e, sessionId: string, projectDir: string): Promise<{ uuid: string; text: string }[]> => {
      const messages = await getSessionMessages(sessionId, { dir: projectDir })
      return messages
        .filter((m) => m.type === 'user')
        .map((m) => {
          const msg = m.message as Record<string, unknown>
          const content = msg['content']
          let text = ''
          if (typeof content === 'string') {
            text = content
          } else if (Array.isArray(content)) {
            text = (content as Array<Record<string, unknown>>)
              .filter((b) => b['type'] === 'text')
              .map((b) => String(b['text'] ?? ''))
              .join(' ')
          }
          return { uuid: m.uuid, text: text.slice(0, 200) }
        })
        .filter((m) => m.text.trim().length > 0)
    },
  )

  ipcMain.handle(
    'chat.mcpStatus',
    async (_e, channelId: string): Promise<McpStatusInfo[]> => {
      return getMcpStatus(channelId)
    },
  )

  ipcMain.handle('session.rename', async (_e, sessionId: string, title: string, dir?: string): Promise<void> => {
    await renameSession(sessionId, title, dir)
  })

  ipcMain.handle('session.getPermissionMode', async (_e, sessionId: string): Promise<string | null> => {
    const data = await readAppData(APP_DATA_PATH)
    return data.sessionPermissionModes[sessionId] ?? null
  })

  ipcMain.handle('session.setPermissionMode', async (_e, sessionId: string, mode: string): Promise<void> => {
    const data = await readAppData(APP_DATA_PATH)
    data.sessionPermissionModes[sessionId] = mode
    await writeAppData(APP_DATA_PATH, data)
  })

  ipcMain.handle('commands.cached', async (): Promise<{ name: string; description: string }[]> => {
    return discoverSkills()
  })

  ipcMain.handle(
    'notes.read',
    async (_e, scope: NoteScope, key: string): Promise<NoteItem[]> => {
      return readNotes(notesFilePath({ root: NOTES_ROOT, scope, key }))
    },
  )

  ipcMain.handle(
    'notes.write',
    async (_e, scope: NoteScope, key: string, items: NoteItem[]): Promise<void> => {
      await writeNotes(notesFilePath({ root: NOTES_ROOT, scope, key }), items)
    },
  )

  ipcMain.handle(
    'mcp.list',
    async (_e, projectDir?: string): Promise<McpServerEntry[]> => {
      return listMcpConfig(projectDir)
    },
  )

  ipcMain.handle(
    'mcp.add',
    async (_e, name: string, config: Record<string, unknown>, scope: 'global' | 'project', projectDir?: string): Promise<void> => {
      await addMcpServer(name, config, scope, projectDir)
    },
  )

  ipcMain.handle(
    'mcp.remove',
    async (_e, name: string, scope: 'global' | 'project', projectDir?: string): Promise<void> => {
      await removeMcpServer(name, scope, projectDir)
    },
  )

  ipcMain.handle('dialog.pickFolder', async (): Promise<string | null> => {
    const result = await dialog.showOpenDialog({ properties: ['openDirectory'] })
    if (result.canceled || result.filePaths.length === 0) return null
    return result.filePaths[0]
  })

  ipcMain.handle('notification.test', async (): Promise<boolean> => {
    if (!Notification.isSupported()) return false
    const n = new Notification({ title: 'ClaudeDance', body: 'Notifications are working!', silent: false })
    n.show()
    return true
  })

  ipcMain.handle('notification.getPrefs', async (): Promise<NotificationPrefs> => {
    const data = await readAppData(APP_DATA_PATH)
    return data.notifications
  })

  ipcMain.handle('notification.setPrefs', async (_e, prefs: NotificationPrefs): Promise<void> => {
    const data = await readAppData(APP_DATA_PATH)
    data.notifications = prefs
    await writeAppData(APP_DATA_PATH, data)
  })

}
