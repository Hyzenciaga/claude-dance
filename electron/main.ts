import { app, BrowserWindow, dialog, nativeImage, session } from 'electron'
import { existsSync } from 'node:fs'
import { resolve } from 'node:path'
import { registerIpc, setMainWindow } from './ipc'
import { shutdownAll, resolveClaudeBinary } from './sdk-adapter'
import { hydrateShellPath } from './shell-path'

function createWindow() {
  const win = new BrowserWindow({
    width: 1280,
    height: 820,
    minWidth: 760,
    minHeight: 480,
    backgroundColor: '#fbfbfa',
    titleBarStyle: 'hiddenInset',
    trafficLightPosition: { x: 14, y: 14 },
    icon: resolveDevIcon(),
    webPreferences: {
      preload: resolve(__dirname, '../preload/preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
    },
  })
  if (process.platform === 'darwin') {
    win.on('close', (e) => {
      if (!isQuitting) {
        e.preventDefault()
        win.hide()
      }
    })
  }
  setMainWindow(win)
  const devUrl = process.env['ELECTRON_RENDERER_URL']
  if (devUrl) win.loadURL(devUrl)
  else win.loadFile(resolve(__dirname, '../renderer/index.html'))
}

function resolveDevIcon(): Electron.NativeImage | undefined {
  // Only matters in dev — packaged builds get the icon from electron-builder.
  // __dirname is .../out/main, project root is two levels up.
  const candidate = resolve(__dirname, '../../build/icon-dev.png')
  return existsSync(candidate) ? nativeImage.createFromPath(candidate) : undefined
}

let isQuitting = false

app.setName('ClaudeDance')

app.whenReady().then(() => {
  hydrateShellPath()
  const devIcon = resolveDevIcon()
  if (devIcon) app.dock?.setIcon(devIcon)
  try {
    resolveClaudeBinary()
  } catch {
    dialog.showErrorBox(
      'Claude CLI not found',
      `ClaudeDance could not locate the 'claude' command.\n\n` +
        `Resolved PATH:\n${process.env['PATH']}\n\n` +
        `If 'claude' is installed via nvm/asdf/brew, make sure your shell init ` +
        `(~/.zshrc or ~/.bash_profile) exports its location on PATH.`,
    )
    app.quit()
    return
  }
  session.defaultSession.setPermissionRequestHandler((_wc, permission, callback) => {
    callback(permission === 'notifications')
  })
  session.defaultSession.setPermissionCheckHandler((_wc, permission) => {
    return permission === 'notifications'
  })
  registerIpc()
  createWindow()
  app.on('activate', () => {
    const wins = BrowserWindow.getAllWindows()
    if (wins.length > 0) wins[0].show()
    else createWindow()
  })
})

app.on('before-quit', () => {
  isQuitting = true
  shutdownAll()
})

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit()
})
