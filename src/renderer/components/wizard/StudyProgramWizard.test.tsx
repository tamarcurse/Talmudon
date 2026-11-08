import { fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import type { ProgramRecord } from '../../../main/database'
import { mockBridge, type MockBridgeOptions } from '../../../test/mockBridge'
import { CalendarProvider } from '../../context/CalendarContext'
import { formatHebrewDate } from '../../lib/hebrewDate'
import StudyProgramWizard from './StudyProgramWizard'

// 2026-11-08 is a Sunday.
const TODAY = '2026-11-08'

afterEach(() => {
  delete (window as Partial<Window>).talmudonBridge
})

async function renderWizard(
  options: MockBridgeOptions & { mode?: 'create' | 'edit'; programId?: number } = {},
) {
  const { mode = 'create', programId, ...bridgeOptions } = options
  const bridge = mockBridge(bridgeOptions)
  const onSaved = vi.fn()
  const onCancel = vi.fn()
  render(
    <CalendarProvider>
      <StudyProgramWizard
        mode={mode}
        programId={programId}
        today={TODAY}
        onSaved={onSaved}
        onCancel={onCancel}
      />
    </CalendarProvider>,
  )
  await screen.findByLabelText('חיפוש מסכת')
  return { bridge, onSaved, onCancel }
}

function pickTractate(name: string) {
  fireEvent.click(screen.getByRole('button', { name }))
}

function next() {
  fireEvent.click(screen.getByRole('button', { name: 'הבא' }))
}

function previous() {
  fireEvent.click(screen.getByRole('button', { name: 'הקודם' }))
}

function chooseRadio(name: string) {
  fireEvent.click(screen.getByRole('radio', { name }))
}

function setDate(label: string, iso: string) {
  fireEvent.change(screen.getByLabelText(label), { target: { value: iso } })
}

describe('Step 1: tractate', () => {
  it('filters tractates by free-text search', async () => {
    await renderWizard()

    expect(screen.getByRole('button', { name: 'שבת' })).toBeInTheDocument()

    fireEvent.change(screen.getByLabelText('חיפוש מסכת'), { target: { value: 'בר' } })

    expect(screen.getByRole('button', { name: 'ברכות' })).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'שבת' })).not.toBeInTheDocument()
  })

  it('also matches the English name', async () => {
    await renderWizard()

    fireEvent.change(screen.getByLabelText('חיפוש מסכת'), { target: { value: 'pesach' } })

    expect(screen.getByRole('button', { name: 'פסחים' })).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'ברכות' })).not.toBeInTheDocument()
  })

  it('fills in the program name when a tractate is picked, and the name stays editable', async () => {
    await renderWizard()

    pickTractate('ברכות')
    const nameInput = screen.getByLabelText('שם התוכנית') as HTMLInputElement
    expect(nameInput.value).toContain('ברכות')

    fireEvent.change(nameInput, { target: { value: 'הסיום שלי' } })
    pickTractate('שבת')

    expect(nameInput.value).toBe('הסיום שלי')
  })
})

describe('navigation', () => {
  it('disables Next until the current step is valid', async () => {
    await renderWizard()

    expect(screen.getByRole('button', { name: 'הבא' })).toBeDisabled()

    pickTractate('ברכות')
    expect(screen.getByRole('button', { name: 'הבא' })).toBeEnabled()

    fireEvent.change(screen.getByLabelText('שם התוכנית'), { target: { value: '  ' } })
    expect(screen.getByRole('button', { name: 'הבא' })).toBeDisabled()
  })

  it('keeps entered values when going back', async () => {
    await renderWizard()
    pickTractate('ברכות')
    fireEvent.change(screen.getByLabelText('שם התוכנית'), { target: { value: 'שם מותאם' } })
    next()

    previous()

    expect((screen.getByLabelText('שם התוכנית') as HTMLInputElement).value).toBe('שם מותאם')
    expect(screen.getByRole('button', { name: 'ברכות' })).toHaveAttribute('aria-pressed', 'true')
  })

  it('calls onCancel from the cancel button', async () => {
    const { onCancel } = await renderWizard()

    fireEvent.click(screen.getByRole('button', { name: 'ביטול' }))

    expect(onCancel).toHaveBeenCalledTimes(1)
  })
})

describe('Step 2: range', () => {
  async function toRangeStep() {
    const rendered = await renderWizard()
    pickTractate('ברכות')
    next()
    return rendered
  }

  it('"full tractate" covers ב\' through the last daf of the tractate', async () => {
    await toRangeStep()

    chooseRadio('מסכת שלמה')

    // Berakhot has 64 dafim: ב' .. ס"ד
    expect(screen.getByTestId('range-summary')).toHaveTextContent(`ב' – ס"ד`)
    expect(screen.getByTestId('range-summary')).toHaveTextContent('63 דפים')
  })

  it('a custom range offers Hebrew labels from the page list and validates order', async () => {
    await toRangeStep()
    chooseRadio('טווח מותאם')

    const from = screen.getByLabelText('מדף')
    const to = screen.getByLabelText('עד דף')
    expect(within(from).getByRole('option', { name: "ג'" })).toBeInTheDocument()
    expect(within(to).queryByRole('option', { name: 'ס"ה' })).not.toBeInTheDocument() // 65 > 64

    fireEvent.change(from, { target: { value: '10' } })
    fireEvent.change(to, { target: { value: '5' } })
    expect(screen.getByRole('button', { name: 'הבא' })).toBeDisabled()

    fireEvent.change(to, { target: { value: '20' } })
    expect(screen.getByRole('button', { name: 'הבא' })).toBeEnabled()
    expect(screen.getByTestId('range-summary')).toHaveTextContent('11 דפים')
  })
})

describe('Step 3: pace', () => {
  async function toPaceStep() {
    const rendered = await renderWizard()
    pickTractate('ברכות')
    next()
    chooseRadio('מסכת שלמה')
    next()
    return rendered
  }

  it('daily pace shows the computed end date', async () => {
    await toPaceStep()

    chooseRadio('לפי קצב יומי')
    fireEvent.change(screen.getByLabelText('דפים ביום'), { target: { value: '9' } })

    // 63 dafim at 9/day = 7 days starting Sunday 2026-11-08 -> Saturday 2026-11-14
    expect(screen.getByTestId('end-date-summary')).toHaveTextContent('14 בנובמבר 2026')
  })

  it('rejects a non-positive pace', async () => {
    await toPaceStep()
    chooseRadio('לפי קצב יומי')

    fireEvent.change(screen.getByLabelText('דפים ביום'), { target: { value: '0' } })

    expect(screen.getByRole('button', { name: 'הבא' })).toBeDisabled()
  })

  it('target date shown in Hebrew sends a Gregorian ISO date to createProgram', async () => {
    const { bridge } = await (async () => {
      const rendered = await renderWizard({ calendar: 'hebrew' })
      await waitFor(() => expect(rendered.bridge.getUserSetting).toHaveBeenCalled())
      return rendered
    })()
    pickTractate('ברכות')
    next()
    chooseRadio('מסכת שלמה')
    next()
    chooseRadio('לפי תאריך יעד')

    // 24 Kislev 5787 = 2026-12-04 (the day before the first day of Chanukah).
    await screen.findByLabelText('תאריך יעד – יום')
    fireEvent.change(screen.getByLabelText('תאריך יעד – שנה'), { target: { value: '5787' } })
    fireEvent.change(screen.getByLabelText('תאריך יעד – חודש'), { target: { value: '9' } })
    fireEvent.change(screen.getByLabelText('תאריך יעד – יום'), { target: { value: '24' } })

    expect(screen.getByTestId('target-date-display')).toHaveTextContent('כ״ד כסלו תשפ״ז')
    next() // rest days
    next() // summary
    fireEvent.click(screen.getByRole('button', { name: 'צור תוכנית' }))

    await waitFor(() => expect(bridge.createProgram).toHaveBeenCalledTimes(1))
    const input = bridge.createProgram.mock.calls[0][0]
    expect(input.paceMode).toBe('target_date')
    expect(input.targetEndDate).toBe('2026-12-04') // 24 Kislev 5787
    expect(input.startDate).toBe(TODAY)
    expect(formatHebrewDate(new Date(2026, 11, 4))).toBe('כ״ד כסלו תשפ״ז')
  })

  it('rejects a target date before the start date', async () => {
    await toPaceStep()
    chooseRadio('לפי תאריך יעד')

    setDate('תאריך יעד', '2026-11-01')

    expect(screen.getByRole('button', { name: 'הבא' })).toBeDisabled()
  })
})

describe('Step 4 and 5: rest days and summary', () => {
  async function toRestStep() {
    const rendered = await renderWizard()
    pickTractate('ברכות')
    next()
    chooseRadio('מסכת שלמה')
    next()
    chooseRadio('לפי קצב יומי')
    fireEvent.change(screen.getByLabelText('דפים ביום'), { target: { value: '1' } })
    next()
    return rendered
  }

  it('weekday and specific rest days reach createProgram', async () => {
    const { bridge } = await toRestStep()

    fireEvent.click(screen.getByRole('checkbox', { name: 'שישי' }))
    fireEvent.click(screen.getByRole('checkbox', { name: 'שבת' }))
    setDate('תאריך מנוחה', '2026-12-25')
    fireEvent.click(screen.getByRole('button', { name: 'הוסף תאריך' }))
    next()
    fireEvent.click(screen.getByRole('button', { name: 'צור תוכנית' }))

    await waitFor(() => expect(bridge.createProgram).toHaveBeenCalledTimes(1))
    const input = bridge.createProgram.mock.calls[0][0]
    expect([...input.restWeekdays].sort()).toEqual([5, 6])
    expect(input.restDates).toEqual(['2026-12-25'])
  })

  it('removes a specific rest date', async () => {
    const { bridge } = await toRestStep()
    setDate('תאריך מנוחה', '2026-12-25')
    fireEvent.click(screen.getByRole('button', { name: 'הוסף תאריך' }))

    fireEvent.click(screen.getByRole('button', { name: /הסר/ }))
    next()
    fireEvent.click(screen.getByRole('button', { name: 'צור תוכנית' }))

    await waitFor(() => expect(bridge.createProgram).toHaveBeenCalled())
    expect(bridge.createProgram.mock.calls[0][0].restDates).toEqual([])
  })

  it('ticking Chanukah moves the end date and reaches createProgram', async () => {
    const { bridge } = await toRestStep()
    next()
    const before = screen.getByTestId('program-summary').textContent
    previous()

    fireEvent.click(screen.getByRole('checkbox', { name: 'חנוכה' }))
    next()

    expect(screen.getByTestId('program-summary').textContent).not.toBe(before)
    expect(screen.getByTestId('program-summary')).toHaveTextContent('חגים')
    expect(screen.getByTestId('program-summary')).toHaveTextContent('חנוכה')
    fireEvent.click(screen.getByRole('button', { name: 'צור תוכנית' }))

    await waitFor(() => expect(bridge.createProgram).toHaveBeenCalledTimes(1))
    expect([...bridge.createProgram.mock.calls[0][0].restHolidays].sort()).toEqual(
      Array.from({ length: 8 }, (_, i) => `chanukah-${i + 1}`).sort(),
    )
  })

  it('expands Pesach to show a single Chol HaMoed item and a partial group state', async () => {
    await toRestStep()
    fireEvent.click(screen.getByRole('button', { name: 'פתח פסח' }))

    expect(screen.getAllByRole('checkbox', { name: /פסח –/ })).toHaveLength(3)
    expect(screen.getByRole('checkbox', { name: 'פסח – חול המועד' })).toBeInTheDocument()

    const group = screen.getByRole('checkbox', { name: 'פסח' }) as HTMLInputElement
    fireEvent.click(group)
    expect(group.checked).toBe(true)
    fireEvent.click(screen.getByRole('checkbox', { name: 'פסח – חול המועד' }))
    expect(group.checked).toBe(false)
    expect(group.indeterminate).toBe(true)

    next()
    expect(screen.getByTestId('program-summary')).toHaveTextContent('פסח (יום טוב ראשון, שביעי של פסח)')
  })

  it('summary says אין when no holidays are chosen', async () => {
    await toRestStep()
    next()
    const dt = screen.getByText('חגים')
    expect(dt.nextElementSibling).toHaveTextContent('אין')
  })

  it('blocks Next when every weekday is a rest day', async () => {
    await toRestStep()

    for (const day of ['ראשון', 'שני', 'שלישי', 'רביעי', 'חמישי', 'שישי', 'שבת']) {
      fireEvent.click(screen.getByRole('checkbox', { name: day }))
    }

    expect(screen.getByRole('button', { name: 'הבא' })).toBeDisabled()
  })

  it('summary shows tractate, Hebrew range, pace and end date, and saves the full input', async () => {
    const { bridge, onSaved } = await toRestStep()
    fireEvent.click(screen.getByRole('checkbox', { name: 'שבת' }))
    next()

    const summary = screen.getByTestId('program-summary')
    expect(summary).toHaveTextContent('ברכות')
    expect(summary).toHaveTextContent(`ב' – ס"ד`)
    expect(summary).toHaveTextContent('דף אחד ביום')
    // 63 dafim at 1/day with Saturdays off, starting Sunday 2026-11-08: 10 full weeks (60 days) + Sun/Mon/Tue
    expect(summary).toHaveTextContent('19 בינואר 2027')

    fireEvent.click(screen.getByRole('button', { name: 'צור תוכנית' }))

    await waitFor(() => expect(onSaved).toHaveBeenCalledWith(1))
    expect(bridge.createProgram).toHaveBeenCalledWith({
      tractateId: 1,
      programName: expect.stringContaining('ברכות'),
      startPage: 2,
      endPage: 64,
      startDate: TODAY,
      paceMode: 'daily_pace',
      pagesPerDay: 1,
      targetEndDate: '2027-01-19',
      restWeekdays: [6],
      restDates: [],
      restHolidays: [],
    })
  })

  it('shows an error and stays on the page when saving fails', async () => {
    const { bridge, onSaved } = await toRestStep()
    bridge.createProgram.mockRejectedValueOnce(new Error('boom'))
    next()

    fireEvent.click(screen.getByRole('button', { name: 'צור תוכנית' }))

    expect(await screen.findByRole('alert')).toHaveTextContent('השמירה נכשלה')
    expect(onSaved).not.toHaveBeenCalled()
  })
})

describe('edit mode', () => {
  const program: ProgramRecord = {
    id: 7,
    tractateId: 3,
    programName: 'עירובין בקצב שלי',
    startPage: 5,
    endPage: 30,
    startDate: '2026-11-08',
    paceMode: 'target_date',
    pagesPerDay: 1.2,
    targetEndDate: '2026-12-20',
    restWeekdays: [5, 6],
    restDates: ['2026-12-01'],
    restHolidays: [],
  }

  it('loads every field from getProgram and updates instead of creating', async () => {
    const { bridge, onSaved } = await renderWizard({ mode: 'edit', programId: 7, program })
    expect(bridge.getProgram).toHaveBeenCalledWith(7)

    // Step 1
    expect((screen.getByLabelText('שם התוכנית') as HTMLInputElement).value).toBe('עירובין בקצב שלי')
    expect(screen.getByRole('button', { name: 'עירובין' })).toHaveAttribute('aria-pressed', 'true')
    next()

    // Step 2: custom range 5..30
    expect(screen.getByRole('radio', { name: 'טווח מותאם' })).toBeChecked()
    expect((screen.getByLabelText('מדף') as HTMLSelectElement).value).toBe('5')
    expect((screen.getByLabelText('עד דף') as HTMLSelectElement).value).toBe('30')
    next()

    // Step 3: target-date mode and date restored
    expect(screen.getByRole('radio', { name: 'לפי תאריך יעד' })).toBeChecked()
    expect((screen.getByLabelText('תאריך יעד') as HTMLInputElement).value).toBe('2026-12-20')
    next()

    // Step 4: rest days restored
    expect(screen.getByRole('checkbox', { name: 'שישי' })).toBeChecked()
    expect(screen.getByRole('checkbox', { name: 'שבת' })).toBeChecked()
    expect(screen.getByRole('checkbox', { name: 'ראשון' })).not.toBeChecked()
    expect(screen.getByText('1 בדצמבר 2026')).toBeInTheDocument()
    next()

    // Step 5
    expect(screen.queryByRole('button', { name: 'צור תוכנית' })).not.toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: 'עדכן תוכנית' }))

    await waitFor(() => expect(bridge.updateProgram).toHaveBeenCalledTimes(1))
    expect(bridge.createProgram).not.toHaveBeenCalled()
    const [id, input] = bridge.updateProgram.mock.calls[0]
    expect(id).toBe(7)
    expect(input).toMatchObject({
      tractateId: 3,
      programName: 'עירובין בקצב שלי',
      startPage: 5,
      endPage: 30,
      startDate: '2026-11-08',
      paceMode: 'target_date',
      targetEndDate: '2026-12-20',
      restDates: ['2026-12-01'],
      restHolidays: [],
    })
    expect([...input.restWeekdays].sort()).toEqual([5, 6])
    expect(onSaved).toHaveBeenCalledWith(7)
  })

  it('loads saved holidays', async () => {
    await renderWizard({
      mode: 'edit',
      programId: 7,
      program: { ...program, restHolidays: ['purim', 'shushan-purim'] },
    })
    next()
    next()
    next()

    expect(screen.getByRole('checkbox', { name: 'פורים' })).toBeChecked()
  })

  it('restores daily pace mode and the saved pace', async () => {
    await renderWizard({
      mode: 'edit',
      programId: 7,
      program: { ...program, paceMode: 'daily_pace', pagesPerDay: 2, restWeekdays: [], restDates: [] },
    })
    next()
    next()

    expect(screen.getByRole('radio', { name: 'לפי קצב יומי' })).toBeChecked()
    expect((screen.getByLabelText('דפים ביום') as HTMLInputElement).value).toBe('2')
  })
})
