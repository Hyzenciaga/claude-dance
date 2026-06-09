import { ipcMain, type BrowserWindow } from 'electron'
import { homedir } from 'node:os'
import { join } from 'node:path'
import type { Project, SessionSummary, RawEvent, IpcChatEvent, ChatStartRequest, ChatStartResponse } from '@shared/types'
import { scanProjects } from './project-scanner'
import { listSessions, readSessionEvents } from './session-reader'
import { readAppData, writeAppData } from './app-data'

const PROJECTS_DIR = join(homedir(), '.claude', 'projects')
const APP_DATA_PATH = join(homedir(), '.claudedance', 'projects.json')

export function registerIpc(_win: BrowserWindow): void {
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

  // chat.start / chat.sendMessage / chat.stop added in Task 8
  ipcMain.handle('chat.start', async (_e, _req: ChatStartRequest): Promise<ChatStartResponse> => {
    throw new Error('chat.start not implemented yet')
  })
  ipcMain.handle('chat.sendMessage', async (_e, _channelId: string, _text: string): Promise<void> => {
    throw new Error('chat.sendMessage not implemented yet')
  })
  ipcMain.handle('chat.stop', async (_e, _channelId: string): Promise<void> => {
    throw new Error('chat.stop not implemented yet')
  })
}

export function sendChatEvent(win: BrowserWindow, evt: IpcChatEvent): void {
  if (!win.isDestroyed()) win.webContents.send('chat.event', evt)
}
