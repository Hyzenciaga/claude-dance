import type { BrowserWindow } from 'electron'
import type { IpcChatEvent } from '@shared/types'

export function sendChatEvent(win: BrowserWindow, evt: IpcChatEvent): void {
  if (!win.isDestroyed()) win.webContents.send('chat.event', evt)
}
