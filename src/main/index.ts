import { app, BrowserWindow, ipcMain } from 'electron'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { DatabaseService, type ProgramInput } from './database.js'
import type { UnitTarget } from './progress.js'

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
    title: 'תלמודון',
    icon: fileURLToPath(new URL('../build/icon.png', import.meta.url)),
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

ipcMain.handle('database:get-shas-pages', () => databaseService.getShasPages())
ipcMain.handle('database:create-program', (_event, input: ProgramInput) =>
  databaseService.createProgram(input),
)
ipcMain.handle('database:update-program', (_event, id: number, input: ProgramInput) =>
  databaseService.updateProgram(id, input),
)
ipcMain.handle('database:get-program', (_event, id: number) => databaseService.getProgram(id))
ipcMain.handle('database:list-program-summaries', () => databaseService.listProgramSummaries())
ipcMain.handle('database:set-program-status', (_event, id: number, status: string) =>
  databaseService.setProgramStatus(id, status),
)

ipcMain.handle('database:recalculate-program', (_event, id: number) =>
  databaseService.recalculateProgram(id),
)
ipcMain.handle('database:get-page-progress', (_event, programId: number) =>
  databaseService.getPageProgress(programId),
)
ipcMain.handle(
  'database:set-units-completed',
  (_event, programId: number, targets: UnitTarget[], done: boolean) =>
    databaseService.setUnitsCompleted(programId, targets, done),
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
