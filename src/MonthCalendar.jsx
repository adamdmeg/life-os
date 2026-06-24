const WEEKDAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']

// Calendar (grid) view of a single month's key dates. Renders a standard Sunday-first
// month grid and drops each key_date into its day cell. Auto-generated dates (mid-sprint
// check-ins, retros) use the teal accent; user-added dates use the neutral chip.
export default function MonthCalendar({ year, monthNumber, keyDates, today }) {
  const monthIndex = monthNumber - 1
  const firstWeekday = new Date(year, monthIndex, 1).getDay() // 0 = Sun
  const daysInMonth = new Date(year, monthNumber, 0).getDate()

  // Group key dates by day-of-month (only those that actually fall in this month).
  const eventsByDay = {}
  keyDates.forEach(kd => {
    const d = new Date(kd.date + 'T00:00:00')
    if (d.getFullYear() === year && d.getMonth() === monthIndex) {
      const day = d.getDate()
      ;(eventsByDay[day] ||= []).push(kd)
    }
  })

  // Build cells: leading blanks, then each day, then trailing blanks to complete the week.
  const cells = []
  for (let i = 0; i < firstWeekday; i++) cells.push(null)
  for (let day = 1; day <= daysInMonth; day++) cells.push(day)
  while (cells.length % 7 !== 0) cells.push(null)

  const isToday = day =>
    today.getFullYear() === year && today.getMonth() === monthIndex && today.getDate() === day

  return (
    <div>
      {/* Weekday header */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: 4, marginBottom: 4 }}>
        {WEEKDAYS.map(w => (
          <div key={w} style={{
            fontSize: 10,
            fontWeight: 600,
            textTransform: 'uppercase',
            letterSpacing: '0.4px',
            color: 'var(--t3)',
            textAlign: 'center',
            paddingBottom: 2,
          }}>
            {w}
          </div>
        ))}
      </div>

      {/* Day grid */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: 4 }}>
        {cells.map((day, i) => {
          if (day === null) {
            return <div key={`blank-${i}`} style={{ minHeight: 64 }} />
          }
          const events = eventsByDay[day] || []
          const todayCell = isToday(day)
          return (
            <div key={day} style={{
              minHeight: 64,
              border: todayCell ? '1px solid var(--t1)' : '0.5px solid var(--b1)',
              borderRadius: 'var(--r)',
              padding: 4,
              background: 'var(--bg)',
              display: 'flex',
              flexDirection: 'column',
              gap: 2,
            }}>
              <div style={{
                fontSize: 11,
                fontWeight: todayCell ? 700 : 500,
                color: todayCell ? 'var(--t1)' : 'var(--t2)',
                textAlign: 'right',
                lineHeight: 1.2,
              }}>
                {day}
              </div>
              {events.map(ev => (
                <div
                  key={ev.id}
                  title={ev.event_name}
                  style={{
                    fontSize: 9,
                    lineHeight: 1.3,
                    padding: '1px 4px',
                    borderRadius: 3,
                    background: ev.is_auto ? 'var(--teal-bg)' : 'var(--bg2)',
                    color: ev.is_auto ? 'var(--teal-t)' : 'var(--t2)',
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                    whiteSpace: 'nowrap',
                  }}
                >
                  {ev.event_name}
                </div>
              ))}
            </div>
          )
        })}
      </div>
    </div>
  )
}
