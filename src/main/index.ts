import { app, BrowserWindow, dialog, ipcMain, Notification, shell } from 'electron'
import { join } from 'node:path'
import { electronApp, is, optimizer } from '@electron-toolkit/utils'
import icon from '../../resources/icon.png?asset'
import type { AppState, SessionKind, SessionLogEvent } from '../shared/types'
import { JsonStateStore } from './storage'
import { appendSessionLogEvent } from './vault-log'

let stateStore: JsonStateStore

function registerIpc(): void {
  ipcMain.handle('state:load', () => stateStore.load())
  ipcMain.handle('state:save', (_event, state: AppState) => stateStore.save(state))
  ipcMain.handle('vault:select', async () => {
    const result = await dialog.showOpenDialog({
      title: 'Choose your Obsidian vault',
      properties: ['openDirectory', 'createDirectory']
    })
    return result.canceled ? null : result.filePaths[0]
  })
  ipcMain.handle('vault:append-event', (_event, vaultPath: string, event: SessionLogEvent) =>
    appendSessionLogEvent(vaultPath, event)
  )
  ipcMain.handle('notification:surface', (_event, activity: string, kind: SessionKind) => {
    if (Notification.isSupported()) {
      new Notification({
        title: kind === 'focus' ? 'Surface reached' : 'Break complete',
        body: kind === 'focus' ? `${activity} is ready for a decision.` : 'Choose what comes next.'
      }).show()
    }
  })
  ipcMain.handle('app:info', () => ({
    version: app.getVersion(),
    dataPath: app.getPath('userData')
  }))
}

function createWindow(): void {
  const mainWindow = new BrowserWindow({
    width: 1180,
    height: 820,
    minWidth: 880,
    minHeight: 680,
    show: false,
    autoHideMenuBar: true,
    titleBarStyle: process.platform === 'darwin' ? 'hiddenInset' : 'default',
    ...(process.platform === 'linux' ? { icon } : {}),
    webPreferences: {
      preload: join(__dirname, '../preload/index.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true
    }
  })

  mainWindow.on('ready-to-show', () => mainWindow.show())
  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    if (url.startsWith('https://')) void shell.openExternal(url)
    return { action: 'deny' }
  })

  if (is.dev && process.env['ELECTRON_RENDERER_URL']) {
    void mainWindow.loadURL(process.env['ELECTRON_RENDERER_URL'])
  } else {
    void mainWindow.loadFile(join(__dirname, '../renderer/index.html'))
  }
}

app.whenReady().then(() => {
  electronApp.setAppUserModelId('com.oliwiajasionek.deepdive')
  stateStore = new JsonStateStore(join(app.getPath('userData'), 'state.json'))
  registerIpc()
  app.on('browser-window-created', (_, window) => optimizer.watchWindowShortcuts(window))
  createWindow()
  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow()
  })
})

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit()
})
