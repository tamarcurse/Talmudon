import { useEffect, useState } from 'react'
import type { BackupFile } from '../../../main/backup'
import { useCalendar } from '../../context/CalendarContext'
import { formatIsoDate } from '../../lib/hebrewDate'

type Props = {
  onClose: () => void
  /** Called after a restore that added programs, so the open view can reload. */
  onRestored: () => void
}

type Pending = { backup: BackupFile; newPrograms: number; existingPrograms: number; total: number }
type Message = { kind: 'success' | 'error'; text: string }

function localIsoDate(timestamp: string): string | null {
  const date = new Date(timestamp)
  if (Number.isNaN(date.getTime())) return null
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`
}

const FAILED = 'הפעולה נכשלה'

function BackupDialog({ onClose, onRestored }: Props) {
  const { calendarType } = useCalendar()
  const [lastBackupAt, setLastBackupAt] = useState<string | null>(null)
  const [pending, setPending] = useState<Pending | null>(null)
  const [message, setMessage] = useState<Message | null>(null)
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    let active = true
    window.talmudonBridge
      .getLastBackupAt()
      .then((value) => {
        if (active) setLastBackupAt(value)
      })
      .catch(() => undefined)
    return () => {
      active = false
    }
  }, [])

  async function run(action: () => Promise<void>) {
    setBusy(true)
    setMessage(null)
    try {
      await action()
    } catch {
      setMessage({ kind: 'error', text: FAILED })
    } finally {
      setBusy(false)
    }
  }

  const handleExport = () =>
    run(async () => {
      setPending(null)
      const result = await window.talmudonBridge.exportBackup()
      if (result.status === 'saved') {
        setLastBackupAt(result.exportedAt)
        setMessage({ kind: 'success', text: 'הגיבוי נשמר' })
      }
    })

  const handleChoose = () =>
    run(async () => {
      setPending(null)
      const result = await window.talmudonBridge.chooseBackupFile()
      if (result.status === 'invalid') {
        setMessage({ kind: 'error', text: 'הקובץ שנבחר אינו גיבוי תקין של תלמודון' })
      } else if (result.status === 'ready') {
        setPending({ backup: result.backup, ...result.preview })
      }
    })

  const handleRestore = () =>
    run(async () => {
      if (!pending) return
      const result = await window.talmudonBridge.restoreBackup(pending.backup)
      setPending(null)
      setMessage({
        kind: 'success',
        text: `נוספו ${result.added} תוכניות, ${result.skipped} דולגו (כבר קיימות)`,
      })
      if (result.added > 0) onRestored()
    })

  const lastIso = lastBackupAt ? localIsoDate(lastBackupAt) : null

  return (
    <div className="fixed inset-0 z-10 flex items-center justify-center bg-slate-900/30 p-4 backdrop-blur-sm">
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="backup-title"
        className="card w-full max-w-md space-y-4 p-6 shadow-xl"
      >
        <h2 id="backup-title" className="text-xl font-bold text-ink">
          גיבוי ושחזור
        </h2>
        <p className="text-sm text-muted">
          {lastIso ? `גיבוי אחרון: ${formatIsoDate(lastIso, calendarType)}` : 'עדיין לא בוצע גיבוי'}
        </p>

        <div className="flex gap-3">
          <button type="button" onClick={handleExport} disabled={busy} className="btn-primary">
            ייצוא גיבוי
          </button>
          <button type="button" onClick={handleChoose} disabled={busy} className="btn-secondary">
            שחזור מגיבוי
          </button>
        </div>

        {pending && (
          <div className="space-y-3 rounded-xl border border-line p-4">
            <p className="text-sm text-ink">
              {`בקובץ ${pending.total} תוכניות: ${pending.newPrograms} חדשות יתווספו, ${pending.existingPrograms} קיימות ידולגו`}
            </p>
            <div className="flex gap-3">
              <button
                type="button"
                onClick={handleRestore}
                disabled={busy || pending.newPrograms === 0}
                className="btn-primary"
              >
                שחזור
              </button>
              <button type="button" onClick={() => setPending(null)} disabled={busy} className="btn-secondary">
                ביטול
              </button>
            </div>
          </div>
        )}

        {message && (
          <p role={message.kind === 'error' ? 'alert' : 'status'} className="text-sm text-ink">
            {message.text}
          </p>
        )}

        <div className="flex justify-end">
          <button type="button" onClick={onClose} className="btn-secondary">
            סגירה
          </button>
        </div>
      </div>
    </div>
  )
}

export default BackupDialog
