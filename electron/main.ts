import { app, BrowserWindow } from 'electron'
import { resolve } from 'node:path'
import { registerIpc } from './ipc'
import { shutdownAll } from './claude-process'

function createWindow() {
  const win = new BrowserWindow({
    width: 1200,
    height: 800,
    webPreferences: {
      preload: resolve(__dirname, '../preload/preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
    },
  })
  registerIpc(win)
  const devUrl = process.env['ELECTRON_RENDERER_URL']
  if (devUrl) win.loadURL(devUrl)
  else win.loadFile(resolve(__dirname, '../renderer/index.html'))
}

app.whenReady().then(() => {
  createWindow()
  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow()
  })
})

app.on('before-quit', () => shutdownAll())

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit()
})
