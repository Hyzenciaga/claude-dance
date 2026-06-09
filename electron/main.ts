import { app, BrowserWindow, dialog, nativeImage } from 'electron'
import { execSync } from 'node:child_process'
import { existsSync } from 'node:fs'
import { resolve } from 'node:path'
import { registerIpc } from './ipc'
import { shutdownAll } from './claude-process'
import { hydrateShellPath } from './shell-path'

function checkClaudeBinary(): boolean {
  try {
    execSync('command -v claude', {
      stdio: 'ignore',
      shell: '/bin/sh',
      env: { ...process.env },
    })
    return true
  } catch {
    return false
  }
}

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
  registerIpc(win)
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

app.whenReady().then(() => {
  hydrateShellPath()
  const devIcon = resolveDevIcon()
  if (devIcon) app.dock?.setIcon(devIcon)
  if (!checkClaudeBinary()) {
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
  createWindow()
  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow()
  })
})

app.on('before-quit', () => shutdownAll())

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit()
})
