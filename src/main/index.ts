import { app, BrowserWindow, ipcMain } from 'electron'
import { fileURLToPath } from 'node:url'

const isDev = !app.isPackaged
const rendererUrl = 'http://localhost:5173'
const prodRendererPath = fileURLToPath(new URL('../dist/index.html', import.meta.url))

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

app.whenReady().then(() => {
  createWindow()

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow()
    }
  })
})

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit()
  }
})
