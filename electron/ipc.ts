import { ipcMain, type BrowserWindow } from 'electron'
import { homedir } from 'node:os'
import { join } from 'node:path'
import type { Project, SessionSummary, RawEvent, ChatStartRequest, ChatStartResponse } from '@shared/types'
import { scanProjects } from './project-scanner'
import { listSessions, readSessionEvents } from './session-reader'
import { readAppData, writeAppData } from './app-data'
import { startChat, sendUserMessage, stopChat } from './claude-process'
import {
  readNotes,
  writeNotes,
  notesFilePath,
  type NoteItem,
  type NoteScope,
} from './notes-store'

const PROJECTS_DIR = join(homedir(), '.claude', 'projects')
const APP_DATA_PATH = join(homedir(), '.claudedance', 'projects.json')
const NOTES_ROOT = join(homedir(), '.claudedance', 'notes')

export function registerIpc(win: BrowserWindow): void {
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

  ipcMain.handle('sessions.list', async (_e, projectPath: string): Promise<SessionSummary[]> => {
    return listSessions({ projectPath, projectsDir: PROJECTS_DIR })
  })

  ipcMain.handle('session.read', async (_e, jsonlPath: string): Promise<RawEvent[]> => {
    return readSessionEvents(jsonlPath)
  })

  ipcMain.handle('chat.start', async (_e, req: ChatStartRequest): Promise<ChatStartResponse> => {
    const channelId = startChat(win, req)
    return { channelId }
  })

  ipcMain.handle('chat.sendMessage', async (_e, channelId: string, text: string): Promise<void> => {
    sendUserMessage(channelId, text)
  })

  ipcMain.handle('chat.stop', async (_e, channelId: string): Promise<void> => {
    stopChat(channelId)
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
}
