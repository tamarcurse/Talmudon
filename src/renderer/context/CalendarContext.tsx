import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import type { CalendarType } from '../lib/hebrewDate'

const CALENDAR_SETTING_NAME = 'calendar_type'

type CalendarContextValue = {
  calendarType: CalendarType
  setCalendarType: (calendarType: CalendarType) => void
}

const CalendarContext = createContext<CalendarContextValue | null>(null)

function isCalendarType(value: unknown): value is CalendarType {
  return value === 'gregorian' || value === 'hebrew'
}

export function CalendarProvider({ children }: { children: ReactNode }) {
  const [calendarType, setCalendarTypeState] = useState<CalendarType>('gregorian')
  const userHasChosen = useRef(false)

  useEffect(() => {
    const bridge = window.talmudonBridge
    if (!bridge?.getUserSetting) {
      return
    }

    let cancelled = false
    bridge
      .getUserSetting(CALENDAR_SETTING_NAME)
      .then((persisted) => {
        if (!cancelled && !userHasChosen.current && isCalendarType(persisted)) {
          setCalendarTypeState(persisted)
        }
      })
      .catch((error: unknown) => console.error('Failed to load calendar setting', error))

    return () => {
      cancelled = true
    }
  }, [])

  const setCalendarType = useCallback((next: CalendarType) => {
    userHasChosen.current = true
    setCalendarTypeState(next)
    window.talmudonBridge
      ?.setUserSetting?.(CALENDAR_SETTING_NAME, next)
      .catch((error: unknown) => console.error('Failed to persist calendar setting', error))
  }, [])

  const value = useMemo(() => ({ calendarType, setCalendarType }), [calendarType, setCalendarType])

  return <CalendarContext.Provider value={value}>{children}</CalendarContext.Provider>
}

// eslint-disable-next-line react-refresh/only-export-components
export function useCalendar(): CalendarContextValue {
  const context = useContext(CalendarContext)
  if (!context) {
    throw new Error('useCalendar must be used within a CalendarProvider')
  }
  return context
}
