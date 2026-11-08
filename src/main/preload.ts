import { contextBridge, ipcRenderer } from 'electron'
import type { PageProgressRecord, ProgramInput, ProgramRecord, ShasPageRecord } from './database.js'

contextBridge.exposeInMainWorld('talmudonBridge', {
  getVersion: () => ipcRenderer.invoke('app:get-version'),
  ping: () => 'pong',
  initializeDatabase: () => ipcRenderer.invoke('database:initialize'),
  getTractates: () => ipcRenderer.invoke('database:get-tractates'),
  getUserSetting: (settingName: string) => ipcRenderer.invoke('database:get-user-setting', settingName),
  setUserSetting: (settingName: string, value: boolean | string) =>
    ipcRenderer.invoke('database:set-user-setting', settingName, value),
  getShasPages: () => ipcRenderer.invoke('database:get-shas-pages'),
  createProgram: (input: ProgramInput) => ipcRenderer.invoke('database:create-program', input),
  updateProgram: (id: number, input: ProgramInput) => ipcRenderer.invoke('database:update-program', id, input),
  getProgram: (id: number) => ipcRenderer.invoke('database:get-program', id),
  recalculateProgram: (id: number) => ipcRenderer.invoke('database:recalculate-program', id),
  getPageProgress: (programId: number) => ipcRenderer.invoke('database:get-page-progress', programId),
  setPageCompleted: (programId: number, pageNumber: number, completed: boolean) =>
    ipcRenderer.invoke('database:set-page-completed', programId, pageNumber, completed),
})

declare global {
  interface Window {
    talmudonBridge: {
      getVersion: () => Promise<string>
      ping: () => string
      initializeDatabase: () => Promise<{ ok: boolean }>
      getTractates: () => Promise<Array<{ id: number; name_he: string; name_en: string; total_pages: number }>>
      getUserSetting: (settingName: string) => Promise<boolean | number | string | null>
      setUserSetting: (settingName: string, value: boolean | string) => Promise<void>
      getShasPages: () => Promise<ShasPageRecord[]>
      createProgram: (input: ProgramInput) => Promise<number>
      updateProgram: (id: number, input: ProgramInput) => Promise<void>
      getProgram: (id: number) => Promise<ProgramRecord | null>
      recalculateProgram: (id: number) => Promise<void>
      getPageProgress: (programId: number) => Promise<PageProgressRecord[]>
      setPageCompleted: (programId: number, pageNumber: number, completed: boolean) => Promise<void>
    }
  }
}
