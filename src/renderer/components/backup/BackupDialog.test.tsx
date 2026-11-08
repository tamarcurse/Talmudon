import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import type { BackupFile } from '../../../main/backup'
import { mockBridge, type MockBridgeOptions } from '../../../test/mockBridge'
import { CalendarProvider } from '../../context/CalendarContext'
import BackupDialog from './BackupDialog'

afterEach(() => {
  delete (window as Partial<Window>).talmudonBridge
})

const BACKUP: BackupFile = {
  format: 'talmudon-backup',
  version: 1,
  exportedAt: '2026-11-08T10:30:00.000Z',
  settings: { calendarType: 'gregorian', showHebrewDates: false },
  programs: [],
}

function renderDialog(options: MockBridgeOptions = {}) {
  const bridge = mockBridge(options)
  const onClose = vi.fn()
  const onRestored = vi.fn()
  render(
    <CalendarProvider>
      <BackupDialog onClose={onClose} onRestored={onRestored} />
    </CalendarProvider>,
  )
  return { bridge, onClose, onRestored }
}

const chooseReady = (newPrograms: number, existingPrograms: number): MockBridgeOptions => ({
  chooseResult: {
    status: 'ready',
    backup: BACKUP,
    preview: { total: newPrograms + existingPrograms, newPrograms, existingPrograms },
  },
})

describe('BackupDialog', () => {
  it('says no backup was made yet', async () => {
    renderDialog()
    expect(await screen.findByText('עדיין לא בוצע גיבוי')).toBeInTheDocument()
    expect(screen.getByRole('dialog')).toBeInTheDocument()
  })

  it('shows the last backup date', async () => {
    renderDialog({ lastBackupAt: '2026-11-08T12:00:00.000Z' })
    expect(await screen.findByText(/גיבוי אחרון:/)).toBeInTheDocument()
    expect(screen.queryByText('עדיין לא בוצע גיבוי')).not.toBeInTheDocument()
  })

  it('reports a saved export and updates the date', async () => {
    renderDialog({ exportResult: { status: 'saved', filePath: 'a.json', exportedAt: '2026-11-08T12:00:00.000Z' } })
    await screen.findByText('עדיין לא בוצע גיבוי')
    fireEvent.click(screen.getByRole('button', { name: 'ייצוא גיבוי' }))
    expect(await screen.findByText('הגיבוי נשמר')).toBeInTheDocument()
    expect(screen.getByText(/גיבוי אחרון:/)).toBeInTheDocument()
  })

  it('shows no message when the export is canceled', async () => {
    const { bridge } = renderDialog()
    await screen.findByText('עדיין לא בוצע גיבוי')
    fireEvent.click(screen.getByRole('button', { name: 'ייצוא גיבוי' }))
    await waitFor(() => expect(bridge.exportBackup).toHaveBeenCalled())
    expect(screen.queryByText('הגיבוי נשמר')).not.toBeInTheDocument()
    expect(screen.queryByRole('alert')).not.toBeInTheDocument()
  })

  it('reports an invalid file', async () => {
    renderDialog({ chooseResult: { status: 'invalid' } })
    fireEvent.click(await screen.findByRole('button', { name: 'שחזור מגיבוי' }))
    expect(await screen.findByText('הקובץ שנבחר אינו גיבוי תקין של תלמודון')).toBeInTheDocument()
  })

  it('asks for confirmation with the counts, then restores', async () => {
    const { bridge, onRestored } = renderDialog({
      ...chooseReady(2, 1),
      restoreResult: { added: 2, skipped: 1, snapshotPath: 's.json' },
    })
    fireEvent.click(await screen.findByRole('button', { name: 'שחזור מגיבוי' }))
    expect(await screen.findByText('בקובץ 3 תוכניות: 2 חדשות יתווספו, 1 קיימות ידולגו')).toBeInTheDocument()
    expect(bridge.restoreBackup).not.toHaveBeenCalled()

    fireEvent.click(screen.getByRole('button', { name: 'שחזור' }))
    expect(await screen.findByText('נוספו 2 תוכניות, 1 דולגו (כבר קיימות)')).toBeInTheDocument()
    expect(bridge.restoreBackup).toHaveBeenCalledWith(BACKUP)
    expect(onRestored).toHaveBeenCalledTimes(1)
  })

  it('can cancel the confirmation', async () => {
    const { bridge } = renderDialog(chooseReady(1, 0))
    fireEvent.click(await screen.findByRole('button', { name: 'שחזור מגיבוי' }))
    await screen.findByText(/בקובץ 1 תוכניות/)
    fireEvent.click(screen.getByRole('button', { name: 'ביטול' }))
    expect(screen.queryByText(/בקובץ 1 תוכניות/)).not.toBeInTheDocument()
    expect(bridge.restoreBackup).not.toHaveBeenCalled()
  })

  it('disables restore when nothing is new', async () => {
    renderDialog(chooseReady(0, 2))
    fireEvent.click(await screen.findByRole('button', { name: 'שחזור מגיבוי' }))
    await screen.findByText(/בקובץ 2 תוכניות/)
    expect(screen.getByRole('button', { name: 'שחזור' })).toBeDisabled()
  })

  it('shows a failure message when the bridge throws', async () => {
    const { bridge } = renderDialog(chooseReady(1, 0))
    bridge.restoreBackup.mockRejectedValueOnce(new Error('boom'))
    fireEvent.click(await screen.findByRole('button', { name: 'שחזור מגיבוי' }))
    await screen.findByText(/בקובץ 1 תוכניות/)
    fireEvent.click(screen.getByRole('button', { name: 'שחזור' }))
    expect(await screen.findByRole('alert')).toHaveTextContent('הפעולה נכשלה')
  })

  it('closes', async () => {
    const { onClose } = renderDialog()
    fireEvent.click(await screen.findByRole('button', { name: 'סגירה' }))
    expect(onClose).toHaveBeenCalled()
  })
})
