const MONTH_ABBR = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec']

// Month status is derived from the calendar date (and live sprint dates), not the
// month_number alone, so the "at a glance" bar reflects how far through the month we
// actually are and which sprint is currently running — even before a sprint's status
// field has been advanced to "active".
function monthStatus(monthNumber, year, sprints, today) {
  const monthStart = new Date(year, monthNumber - 1, 1)
  const monthEnd = new Date(year, monthNumber, 0) // last day of the month
  monthEnd.setHours(23, 59, 59, 999)

  if (today > monthEnd) return { progress: 100, note: 'Done' }
  if (today < monthStart) return { progress: 0, note: '—' }

  // Current month: progress = how far through the calendar month we are.
  const daysInMonth = new Date(year, monthNumber, 0).getDate()
  const progress = Math.round((today.getDate() / daysInMonth) * 100)

  // Active sprint = the one whose date range contains today.
  const active = (sprints || []).find(s => {
    if (!s.start_date || !s.end_date) return false
    const start = new Date(s.start_date + 'T00:00:00')
    const end = new Date(s.end_date + 'T23:59:59')
    return start <= today && today <= end
  })
  const note = active ? `Sprint ${active.sprint_number_in_month}` : '—'

  return { progress, note }
}

export default function MonthGrid({ months, sprints, year, currentMonthNumber, onMonthClick }) {
  const today = new Date()

  return (
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 12 }}>
      {months.map(month => {
        const isNow = month.month_number === currentMonthNumber
        const isPast = month.month_number < currentMonthNumber
        const abbr = MONTH_ABBR[month.month_number - 1]
        const { progress, note } = monthStatus(month.month_number, year, sprints, today)

        return (
          <div
            key={month.id}
            onClick={() => onMonthClick?.(month.month_number)}
            style={{
              background: isPast ? 'var(--bg2)' : 'var(--bg)',
              border: isNow ? '1px solid var(--t1)' : '0.5px solid var(--b1)',
              borderRadius: 'var(--rl)',
              padding: '16px 18px',
              cursor: 'pointer',
            }}
          >
            <div style={{ fontSize: 15, fontWeight: isNow ? 700 : 600, marginBottom: 10 }}>
              {abbr}{isNow ? ' ·' : ''}
            </div>
            <div style={{ width: '100%', height: 5, background: 'var(--bg3)', borderRadius: 3, marginBottom: 8, overflow: 'hidden' }}>
              <div style={{ height: '100%', width: `${progress}%`, background: 'var(--teal)', borderRadius: 3, transition: 'width 0.2s' }} />
            </div>
            <div style={{ fontSize: 12, color: 'var(--t2)' }}>
              {note}
            </div>
          </div>
        )
      })}
    </div>
  )
}
