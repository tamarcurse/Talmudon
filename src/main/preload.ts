import { contextBridge, ipcRenderer } from 'electron'

contextBridge.exposeInMainWorld('talmudonBridge', {
  getVersion: () => ipcRenderer.invoke('app:get-version'),
  ping: () => 'pong',
})

declare global {
  interface Window {
    talmudonBridge: {
      getVersion: () => Promise<string>
      ping: () => string
    }
  }
}
