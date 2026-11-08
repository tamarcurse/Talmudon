import { fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import type { ProgramRecord } from '../../../main/database'
import { mockBridge, type MockBridgeOptions } from '../../../test/mockBridge'
import { CalendarProvider } from '../../context/CalendarContext'
import { formatHebrewDate, formatIsoDate } from '../../lib/hebrewDate'
import { hebrewMonthEndDate } from '../../../main/templates'
import StudyProgramWizard from './StudyProgramWizard'

// 2026-11-08 is a Sunday.
const TODAY = '2026-11-08'

afterEach(() => {
  delete (window as Partial<Window>).talmudonBridge
})

async function renderWizard(
  options: MockBridgeOptions & {
    mode?: 'create' | 'edit'
    programId?: number
    /** Template to pick after loading (create mode); null stays on the template step. */
    template?: string | null
  } = {},
) {
  const { mode = 'create', programId, template = 'תוכנית מותאמת אישית', ...bridgeOptions } = options
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
  if (mode === 'create' && template === null) {
    await screen.findByRole('button', { name: /תוכנית מותאמת אישית/ })
  } else if (mode === 'create') {
    chooseTemplate(await screen.findByRole('button', { name: new RegExp(template) }))
  }
  if (template !== null || mode === 'edit') await screen.findByLabelText('חיפוש מסכת')
  return { bridge, onSaved, onCancel }
}

function chooseTemplate(button: HTMLElement) {
  fireEvent.click(button)
  next()
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

describe('Step 4: pace', () => {
  async function toPaceStep() {
    const rendered = await renderWizard()
    pickTractate('ברכות')
    next()
    chooseRadio('מסכת שלמה')
    next()
    next() // rest days
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
    next() // rest days
    chooseRadio('לפי תאריך יעד')

    // 24 Kislev 5787 = 2026-12-04 (the day before the first day of Chanukah).
    await screen.findByLabelText('תאריך יעד – יום')
    fireEvent.change(screen.getByLabelText('תאריך יעד – שנה'), { target: { value: '5787' } })
    fireEvent.change(screen.getByLabelText('תאריך יעד – חודש'), { target: { value: '9' } })
    fireEvent.change(screen.getByLabelText('תאריך יעד – יום'), { target: { value: '24' } })

    expect(screen.getByTestId('target-date-display')).toHaveTextContent('כ״ד כסלו תשפ״ז')
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

describe('wizard order: rest days before pace', () => {
  it('step 3 is rest days and step 4 is pace', async () => {
    await renderWizard()
    pickTractate('ברכות')
    next()
    next()

    expect(screen.getByRole('checkbox', { name: 'שבת' })).toBeInTheDocument()
    expect(screen.queryByLabelText('דפים ביום')).not.toBeInTheDocument()

    next()

    expect(screen.getByLabelText('דפים ביום')).toBeInTheDocument()
  })

  it('the pace preview already counts the rest days chosen before it', async () => {
    const { bridge } = await renderWizard()
    pickTractate('ברכות')
    next()
    next()
    fireEvent.click(screen.getByRole('checkbox', { name: 'שבת' }))
    next()
    fireEvent.change(screen.getByLabelText('דפים ביום'), { target: { value: '1' } })

    expect(screen.getByTestId('end-date-summary')).toHaveTextContent('19 בינואר 2027')

    next()
    expect(screen.getByTestId('program-summary')).toHaveTextContent('19 בינואר 2027')
    fireEvent.click(screen.getByRole('button', { name: 'צור תוכנית' }))

    await waitFor(() => expect(bridge.createProgram).toHaveBeenCalledTimes(1))
    expect(bridge.createProgram.mock.calls[0][0].targetEndDate).toBe('2027-01-19')
  })

  it('a holiday ticked before the pace step moves the previewed end date', async () => {
    await renderWizard()
    pickTractate('ברכות')
    next()
    next()
    next()
    const without = screen.getByTestId('end-date-summary').textContent
    previous()

    fireEvent.click(screen.getByRole('checkbox', { name: 'חנוכה' }))
    next()

    expect(screen.getByTestId('end-date-summary').textContent).not.toBe(without)
  })

  it('the default target date already accounts for rest days', async () => {
    await renderWizard()
    pickTractate('ברכות')
    next()
    next()
    fireEvent.click(screen.getByRole('checkbox', { name: 'שבת' }))
    next()

    chooseRadio('לפי תאריך יעד')

    expect(screen.getByTestId('target-date-display')).toHaveTextContent('19 בינואר 2027')
  })
})

describe('Step 3 and 5: rest days and summary', () => {
  async function toRestStep() {
    const rendered = await renderWizard()
    pickTractate('ברכות')
    next()
    chooseRadio('מסכת שלמה')
    next()
    return rendered
  }

  // Passes the rest step and the pace step (default: 1 page per day) to reach the summary.
  function toSummary() {
    next() // rest days -> pace
    next() // pace -> summary
  }

  it('weekday and specific rest days reach createProgram', async () => {
    const { bridge } = await toRestStep()

    fireEvent.click(screen.getByRole('checkbox', { name: 'שישי' }))
    fireEvent.click(screen.getByRole('checkbox', { name: 'שבת' }))
    setDate('תאריך מנוחה', '2026-12-25')
    fireEvent.click(screen.getByRole('button', { name: 'הוסף תאריך' }))
    toSummary()
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
    toSummary()
    fireEvent.click(screen.getByRole('button', { name: 'צור תוכנית' }))

    await waitFor(() => expect(bridge.createProgram).toHaveBeenCalled())
    expect(bridge.createProgram.mock.calls[0][0].restDates).toEqual([])
  })

  it('ticking Chanukah moves the end date and reaches createProgram', async () => {
    const { bridge } = await toRestStep()
    toSummary()
    const before = screen.getByTestId('program-summary').textContent
    previous()
    previous()

    fireEvent.click(screen.getByRole('checkbox', { name: 'חנוכה' }))
    toSummary()

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

    toSummary()
    expect(screen.getByTestId('program-summary')).toHaveTextContent('פסח (יום טוב ראשון, שביעי של פסח)')
  })

  it('summary says אין when no holidays are chosen', async () => {
    await toRestStep()
    toSummary()
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
    toSummary()

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
    toSummary()

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
    status: 'active',
    completedAt: null,
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

    // Step 3: rest days restored
    expect(screen.getByRole('checkbox', { name: 'שישי' })).toBeChecked()
    expect(screen.getByRole('checkbox', { name: 'שבת' })).toBeChecked()
    expect(screen.getByRole('checkbox', { name: 'ראשון' })).not.toBeChecked()
    expect(screen.getByText('1 בדצמבר 2026')).toBeInTheDocument()
    next()

    // Step 4: target-date mode and date restored
    expect(screen.getByRole('radio', { name: 'לפי תאריך יעד' })).toBeChecked()
    expect((screen.getByLabelText('תאריך יעד') as HTMLInputElement).value).toBe('2026-12-20')
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
    next()

    expect(screen.getByRole('radio', { name: 'לפי קצב יומי' })).toBeChecked()
    expect((screen.getByLabelText('דפים ביום') as HTMLInputElement).value).toBe('2')
  })
})

describe('templates', () => {
  // On 2026-11-08 the worldwide cycle is at Bechorot 51; Bechorot runs 2026-09-20 .. 2026-11-18.
  const bechorotToday = {
    tractateId: 6,
    programName: 'דף יומי – מסכת בכורות',
    startPage: 51,
    endPage: 61,
    startDate: TODAY,
    paceMode: 'daily_pace',
    pagesPerDay: 1,
    targetEndDate: '2026-11-18',
    restWeekdays: [],
    restDates: [],
    restHolidays: [],
  }

  function chooseCard(name: RegExp) {
    fireEvent.click(screen.getByRole('button', { name }))
  }

  it('offers the three templates, and the custom one continues to the usual first step', async () => {
    await renderWizard({ template: null })
    expect(screen.getByRole('button', { name: /דף יומי/ })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /מסכת בחודש/ })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /תוכנית מותאמת אישית/ })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'הבא' })).toBeDisabled()

    chooseCard(/תוכנית מותאמת אישית/)
    next()
    expect(screen.getByLabelText('חיפוש מסכת')).toBeInTheDocument()
  })

  it('does not show the template step when editing', async () => {
    await renderWizard({
      mode: 'edit',
      programId: 7,
      program: { ...bechorotToday, id: 7, status: 'active', completedAt: null } as ProgramRecord,
    })
    expect(screen.queryByText('תבנית')).not.toBeInTheDocument()
  })

  it("daf yomi: shows today's daf and goes from today to the summary", async () => {
    const { bridge, onSaved } = await renderWizard({ template: null })
    chooseCard(/דף יומי/)
    expect(screen.getByTestId('daf-yomi-today')).toHaveTextContent('הדף היום: בכורות נ"א')

    next()

    const summary = screen.getByTestId('program-summary')
    expect(summary).toHaveTextContent('בכורות')
    expect(summary).toHaveTextContent('נ"א – ס"א')
    expect(summary).toHaveTextContent('11 דפים')
    expect(summary).toHaveTextContent('8 בנובמבר 2026')
    expect(summary).toHaveTextContent('18 בנובמבר 2026')
    expect(summary).toHaveTextContent('דף אחד ביום')

    fireEvent.click(screen.getByRole('button', { name: 'צור תוכנית' }))
    await waitFor(() => expect(onSaved).toHaveBeenCalledWith(1))
    expect(bridge.createProgram).toHaveBeenCalledWith(bechorotToday)
  })

  it('daf yomi from the start of the tractate begins in the past', async () => {
    const { bridge } = await renderWizard({ template: null })
    chooseCard(/דף יומי/)
    chooseRadio('מתחילת המסכת')
    next()

    expect(screen.getByTestId('program-summary')).toHaveTextContent('20 בספטמבר 2026')
    fireEvent.click(screen.getByRole('button', { name: 'צור תוכנית' }))
    await waitFor(() => expect(bridge.createProgram).toHaveBeenCalled())
    expect(bridge.createProgram).toHaveBeenCalledWith({
      ...bechorotToday,
      startPage: 2,
      startDate: '2026-09-20',
    })
  })

  it('a future tractate starts on the day the cycle reaches it', async () => {
    const { bridge } = await renderWizard({ template: null })
    chooseCard(/דף יומי/)
    fireEvent.change(screen.getByLabelText('מסכת'), { target: { value: 'Berakhot' } })
    next()

    expect(screen.getByTestId('program-summary')).toHaveTextContent('8 ביוני 2027')
    fireEvent.click(screen.getByRole('button', { name: 'צור תוכנית' }))
    await waitFor(() => expect(bridge.createProgram).toHaveBeenCalled())
    expect(bridge.createProgram).toHaveBeenCalledWith(
      expect.objectContaining({ tractateId: 1, startPage: 2, endPage: 64, startDate: '2027-06-08' }),
    )
  })

  it('whole Shas creates every program to the end of the cycle in one call', async () => {
    const names: Array<[string, string, number, number]> = [
      ['Bechorot', 'בכורות', 2, 61],
      ['Arachin', 'ערכין', 2, 34],
      ['Temurah', 'תמורה', 2, 34],
      ['Keritot', 'כריתות', 2, 28],
      ['Meilah', 'מעילה', 2, 22],
      ['Kinnim', 'קינים', 22, 25],
      ['Tamid', 'תמיד', 25, 33],
      ['Middot', 'מידות', 34, 37],
      ['Niddah', 'נדה', 2, 73],
    ]
    const tractates = names.map(([name_en, name_he, first_page, total_pages], index) => ({
      id: index + 1,
      name_en,
      name_he,
      first_page,
      total_pages,
    }))
    const { bridge, onSaved } = await renderWizard({ template: null, tractates, createdProgramIds: [11, 12] })
    chooseCard(/דף יומי/)
    chooseRadio('כל הש"ס')
    next()

    const summary = screen.getByTestId('program-summary')
    expect(summary).toHaveTextContent('9')
    expect(summary).toHaveTextContent('8 בנובמבר 2026')
    expect(summary).toHaveTextContent('7 ביוני 2027')

    fireEvent.click(screen.getByRole('button', { name: 'צור תוכנית' }))
    await waitFor(() => expect(onSaved).toHaveBeenCalledWith(11))
    expect(bridge.createProgram).not.toHaveBeenCalled()
    const inputs = bridge.createPrograms.mock.calls[0][0]
    expect(inputs).toHaveLength(9)
    expect(inputs[0]).toMatchObject({ ...bechorotToday, tractateId: 1 })
    expect(inputs.at(-1)).toMatchObject({ tractateId: 9, startPage: 2, endPage: 73, targetEndDate: '2027-06-07' })
  })

  it('whole Shas is blocked when tractates are missing from the list', async () => {
    await renderWizard({ template: null })
    chooseCard(/דף יומי/)
    chooseRadio('כל הש"ס')
    expect(screen.getByText(/חסרות מסכתות/)).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'הבא' })).toBeDisabled()
  })

  it('daf yomi can be edited by going back; the cycle just stops being aligned', async () => {
    const { bridge } = await renderWizard({ template: null })
    chooseCard(/דף יומי/)
    next()

    previous() // pace
    expect(screen.getByLabelText('דפים ביום')).toHaveValue(1)
    previous() // rest days
    fireEvent.click(screen.getByRole('checkbox', { name: 'שבת' }))
    next()
    next()

    fireEvent.click(screen.getByRole('button', { name: 'צור תוכנית' }))
    await waitFor(() => expect(bridge.createProgram).toHaveBeenCalled())
    // 11 dafim from Sunday 2026-11-08 with Saturdays off: ends Wednesday 2026-11-19
    expect(bridge.createProgram).toHaveBeenCalledWith({
      ...bechorotToday,
      restWeekdays: [6],
      targetEndDate: '2026-11-19',
    })
  })

  describe('tractate a month', () => {
    const monthEnd = hebrewMonthEndDate(TODAY)

    async function toPaceStep() {
      const rendered = await renderWizard({ template: null })
      chooseCard(/מסכת בחודש/)
      next()
      pickTractate('ברכות')
      next() // range
      next() // rest
      next() // pace
      return rendered
    }

    it('selects "by target date" with the end of the Hebrew month', async () => {
      const { bridge } = await toPaceStep()
      expect(screen.getByRole('radio', { name: 'לפי תאריך יעד' })).toBeChecked()

      next()
      fireEvent.click(screen.getByRole('button', { name: 'צור תוכנית' }))
      await waitFor(() => expect(bridge.createProgram).toHaveBeenCalled())
      expect(bridge.createProgram).toHaveBeenCalledWith(
        expect.objectContaining({
          tractateId: 1,
          startPage: 2,
          endPage: 64,
          paceMode: 'target_date',
          targetEndDate: monthEnd,
        }),
      )
    })

    it('recomputes the target when the start date changes, until it is changed by hand', async () => {
      const { bridge } = await toPaceStep()

      setDate('תאריך התחלה', '2026-11-20')
      expect(screen.getByTestId('target-date-display')).toHaveTextContent(
        formatIsoDate(hebrewMonthEndDate('2026-11-20'), 'gregorian'),
      )

      setDate('תאריך יעד', '2027-01-31')
      setDate('תאריך התחלה', '2026-11-25')
      next()
      fireEvent.click(screen.getByRole('button', { name: 'צור תוכנית' }))
      await waitFor(() => expect(bridge.createProgram).toHaveBeenCalled())
      expect(bridge.createProgram).toHaveBeenCalledWith(
        expect.objectContaining({ startDate: '2026-11-25', targetEndDate: '2027-01-31' }),
      )
    })
  })
})
