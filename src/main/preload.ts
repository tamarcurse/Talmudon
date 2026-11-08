import { contextBridge, ipcRenderer } from 'electron'
import type { PageProgressRecord, ProgramInput, ProgramRecord, ProgramStatus, ProgramSummary, ShasPageRecord, TodayProgramPlan } from './database.js'
import type { UnitTarget } from './progress.js'

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
  listProgramSummaries: () => ipcRenderer.invoke('database:list-program-summaries'),
  setProgramStatus: (id: number, status: ProgramStatus) =>
    ipcRenderer.invoke('database:set-program-status', id, status),
  recalculateProgram: (id: number) => ipcRenderer.invoke('database:recalculate-program', id),
  getPageProgress: (programId: number) => ipcRenderer.invoke('database:get-page-progress', programId),
  getTodayPlan: () => ipcRenderer.invoke('database:get-today-plan'),
  setUnitsCompleted: (programId: number, targets: UnitTarget[], done: boolean) =>
    ipcRenderer.invoke('database:set-units-completed', programId, targets, done),
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
      listProgramSummaries: () => Promise<ProgramSummary[]>
      setProgramStatus: (id: number, status: ProgramStatus) => Promise<void>
      recalculateProgram: (id: number) => Promise<void>
      getPageProgress: (programId: number) => Promise<PageProgressRecord[]>
      getTodayPlan: () => Promise<TodayProgramPlan[]>
      setUnitsCompleted: (programId: number, targets: UnitTarget[], done: boolean) => Promise<void>
    }
  }
}
