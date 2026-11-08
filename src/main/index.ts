import { app, BrowserWindow, ipcMain } from 'electron'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { DatabaseService } from './database.js'

const isDev = !app.isPackaged
const rendererUrl = 'http://localhost:5173'
const prodRendererPath = fileURLToPath(new URL('../dist/index.html', import.meta.url))
const databaseService = new DatabaseService(path.join(app.getPath('userData'), 'talmudon.sqlite'))

function createWindow() {
  const mainWindow = new BrowserWindow({
    width: 1400,
    height: 900,
    minWidth: 1100,
    minHeight: 700,
    backgroundColor: '#020817',
    autoHideMenuBar: !isDev,
    title: 'Talmudon',
    webPreferences: {
      preload: fileURLToPath(new URL('./preload.js', import.meta.url)),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false,
    },
  })

  mainWindow.webContents.setWindowOpenHandler(() => ({ action: 'deny' }))

  if (isDev) {
    void mainWindow.loadURL(rendererUrl)
    mainWindow.webContents.openDevTools({ mode: 'detach' })
  } else {
    void mainWindow.loadFile(prodRendererPath)
  }
}

ipcMain.handle('app:get-version', () => app.getVersion())
ipcMain.handle('database:initialize', () => {
  databaseService.initialize()
  return { ok: true }
})
ipcMain.handle('database:get-tractates', () => databaseService.getTractates())
ipcMain.handle('database:get-user-setting', (_event, settingName: string) =>
  databaseService.getUserSetting(settingName),
)
ipcMain.handle('database:set-user-setting', (_event, settingName: string, value: unknown) =>
  databaseService.setUserSetting(settingName, value),
)

app.whenReady().then(() => {
  databaseService.initialize()
  createWindow()

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow()
    }
  })
})

app.on('before-quit', () => {
  databaseService.close()
})

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit()
  }
})
