import { contextBridge, ipcRenderer } from 'electron'
import type { BackupFile, BackupPreview } from './backup.js'
import type { PageProgressRecord, ProgramInput, ProgramRecord, ProgramSummary, SettableProgramStatus, ShasPageRecord, TodayProgramPlan } from './database.js'
import type { UnitTarget } from './progress.js'
import type { StudyStats } from './stats.js'

export type ExportBackupResult = { status: 'canceled' } | { status: 'saved'; filePath: string; exportedAt: string }
export type ChooseBackupResult =
  | { status: 'canceled' }
  | { status: 'invalid' }
  | { status: 'ready'; backup: BackupFile; preview: BackupPreview }
export type RestoreBackupResult = { added: number; skipped: number; snapshotPath: string }

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
  setProgramStatus: (id: number, status: SettableProgramStatus) =>
    ipcRenderer.invoke('database:set-program-status', id, status),
  deleteProgram: (id: number) => ipcRenderer.invoke('database:delete-program', id),
  recalculateProgram: (id: number) => ipcRenderer.invoke('database:recalculate-program', id),
  getPageProgress: (programId: number) => ipcRenderer.invoke('database:get-page-progress', programId),
  getTodayPlan: () => ipcRenderer.invoke('database:get-today-plan'),
  getStudyStats: () => ipcRenderer.invoke('database:get-study-stats'),
  setUnitsCompleted: (programId: number, targets: UnitTarget[], done: boolean) =>
    ipcRenderer.invoke('database:set-units-completed', programId, targets, done),
  exportBackup: () => ipcRenderer.invoke('backup:export'),
  chooseBackupFile: () => ipcRenderer.invoke('backup:choose-file'),
  restoreBackup: (backup: BackupFile) => ipcRenderer.invoke('backup:restore', backup),
  getLastBackupAt: () => ipcRenderer.invoke('backup:get-last-backup-at'),
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
      setProgramStatus: (id: number, status: SettableProgramStatus) => Promise<void>
      deleteProgram: (id: number) => Promise<void>
      recalculateProgram: (id: number) => Promise<void>
      getPageProgress: (programId: number) => Promise<PageProgressRecord[]>
      getTodayPlan: () => Promise<TodayProgramPlan[]>
      getStudyStats: () => Promise<StudyStats>
      setUnitsCompleted: (programId: number, targets: UnitTarget[], done: boolean) => Promise<void>
      exportBackup: () => Promise<ExportBackupResult>
      chooseBackupFile: () => Promise<ChooseBackupResult>
      restoreBackup: (backup: BackupFile) => Promise<RestoreBackupResult>
      getLastBackupAt: () => Promise<string | null>
    }
  }
}
