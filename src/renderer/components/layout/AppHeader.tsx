import type { ReactNode } from 'react'
import CalendarToggle from '../dashboard/CalendarToggle'

type Props = {
  children: ReactNode
  onHome: () => void
  onAllPrograms?: () => void
  onStats?: () => void
  onBackup?: () => void
}

/** Shared page shell: thin top bar (app name + calendar toggle) and a centered content area. */
function AppHeader({ children, onHome, onAllPrograms, onStats, onBackup }: Props) {
  return (
    <main className="min-h-screen bg-canvas text-ink" dir="rtl" lang="he">
      <div className="border-b border-line bg-surface">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-6 py-3">
          <button
            type="button"
            onClick={onHome}
            aria-label="תלמודון – מסך הבית"
            className="flex cursor-pointer items-center gap-3 rounded-xl p-1 transition-opacity hover:opacity-80 focus-visible:outline focus-visible:outline-2 focus-visible:outline-brand"
          >
            <svg aria-hidden="true" viewBox="0 0 48 48" className="h-11 w-11 shrink-0">
              <defs>
                <linearGradient id="logo-bg" x1="0" y1="0" x2="1" y2="1">
                  <stop offset="0" stopColor="#0ea5e9" />
                  <stop offset="1" stopColor="#2563eb" />
                </linearGradient>
              </defs>
              <rect width="48" height="48" rx="12" fill="url(#logo-bg)" />
              <path
                d="M24 15c-3-2.2-7-3-11-2.5v18c4-.5 8 .3 11 2.5 3-2.2 7-3 11-2.5v-18c-4-.5-8 .3-11 2.5z"
                fill="#fff"
              />
              <path d="M24 15v18" stroke="#2563eb" strokeWidth="1.8" strokeLinecap="round" />
              <path
                d="M16 19.5c2-.2 4 .1 5.5.9M16 23.5c2-.2 4 .1 5.5.9M32 19.5c-2-.2-4 .1-5.5.9M32 23.5c-2-.2-4 .1-5.5.9"
                stroke="#93c5fd"
                strokeWidth="1.5"
                strokeLinecap="round"
                fill="none"
              />
            </svg>
            <span className="bg-gradient-to-l from-brand to-sky bg-clip-text text-4xl font-extrabold tracking-tight text-transparent">
              תלמודון
            </span>
          </button>
          <div className="flex items-center gap-3">
            {onAllPrograms && (
              <button type="button" onClick={onAllPrograms} className="btn-ghost">
                כל התוכניות
              </button>
            )}
            {onStats && (
              <button type="button" onClick={onStats} className="btn-ghost">
                סטטיסטיקה
              </button>
            )}
            {onBackup && (
              <button type="button" onClick={onBackup} className="btn-ghost">
                גיבוי ושחזור
              </button>
            )}
            <CalendarToggle />
          </div>
        </div>
      </div>
      <div className="mx-auto max-w-6xl px-6 py-8">{children}</div>
    </main>
  )
}

export default AppHeader
