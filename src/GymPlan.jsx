import { useState, useRef, useEffect } from 'react'

const DAY_LABELS = ['M', 'T', 'W', 'T', 'F', 'S', 'S']
const DAY_KEYS = ['mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun']
const MONTH_ABBR = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec']

function addDays(dateStr, days) {
  const d = new Date(dateStr + 'T00:00:00')
  d.setDate(d.getDate() + days)
  return d
}

function weekRangeLabel(startDate, offset) {
  const a = addDays(startDate, offset)
  const b = addDays(startDate, offset + 6)
  const am = MONTH_ABBR[a.getMonth()]
  const bm = MONTH_ABBR[b.getMonth()]
  if (am === bm) return `${am} ${a.getDate()}–${b.getDate()}`
  return `${am} ${a.getDate()} – ${bm} ${b.getDate()}`
}

// Visual style per day state (matches schema/prototype).
function dayStyle(state) {
  if (state === 'lift') return { background: 'var(--teal)', border: '0.5px solid var(--teal-t)', color: '#fff' }
  if (state === 'run') return { background: 'var(--blue-bg)', border: '0.5px solid var(--blue)', color: 'var(--blue-t)' }
  if (state === 'rest') return { background: 'var(--bg2)', border: '0.5px solid var(--b1)', color: 'var(--t3)' }
  return { background: 'var(--bg)', border: '0.5px solid var(--b1)', color: 'var(--t3)' }
}

function dayLetter(state) {
  if (state === 'lift') return 'L'
  if (state === 'run') return 'R'
  return ''
}

function GymWeek({ weekKey, label, plan, onToggle }) {
  const week = plan[weekKey] || {}
  return (
    <div style={{ marginBottom: 12 }}>
      <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--t3)', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: 6 }}>
        {label}
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: 4 }}>
        {DAY_KEYS.map((dayKey, i) => {
          const state = week[dayKey] || ''
          return (
            <div key={dayKey} style={{ textAlign: 'center', fontSize: 11 }}>
              <div style={{ color: 'var(--t3)', marginBottom: 4 }}>{DAY_LABELS[i]}</div>
              <div
                onClick={() => onToggle(weekKey, dayKey)}
                style={{
                  height: 32,
                  borderRadius: 4,
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontSize: 10,
                  fontWeight: 600,
                  transition: 'all 0.1s',
                  ...dayStyle(state),
                }}
              >
                {dayLetter(state)}
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}

export default function GymPlan({ gymPlan, startDate, onToggle, notes, onNotesBlur }) {
  const plan = gymPlan || { week1: {}, week2: {} }
  const [notesText, setNotesText] = useState(notes || '')
  const notesRef = useRef(null)

  // Keep local notes in sync if the prop changes (e.g. after sprint reload).
  useEffect(() => { setNotesText(notes || '') }, [notes])

  // Grow/shrink the notes box to fit its content (minHeight is the floor).
  useEffect(() => {
    const el = notesRef.current
    if (!el) return
    el.style.height = 'auto'
    el.style.height = el.scrollHeight + 'px'
  }, [notesText])

  const legendDot = (style) => (
    <i style={{ width: 10, height: 10, borderRadius: 2, display: 'inline-block', ...style }} />
  )

  return (
    <div>
      <GymWeek weekKey="week1" label={`Week 1 (${weekRangeLabel(startDate, 0)})`} plan={plan} onToggle={onToggle} />
      <GymWeek weekKey="week2" label={`Week 2 (${weekRangeLabel(startDate, 7)})`} plan={plan} onToggle={onToggle} />

      <div style={{ display: 'flex', gap: 12, marginTop: 4, fontSize: 11, color: 'var(--t2)' }}>
        <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
          {legendDot({ background: 'var(--teal)' })} Lift
        </span>
        <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
          {legendDot({ background: 'var(--blue-bg)', border: '0.5px solid var(--blue)' })} Run
        </span>
        <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
          {legendDot({ background: 'var(--bg2)', border: '0.5px solid var(--b2)' })} Rest
        </span>
      </div>

      <textarea
        ref={notesRef}
        value={notesText}
        onChange={e => setNotesText(e.target.value)}
        onBlur={() => onNotesBlur(notesText)}
        placeholder="Weekly plan — e.g. Mon/Wed/Fri: chest + arms · Tue/Thu: run 5K · Sat: legs"
        style={{
          width: '100%',
          border: '0.5px solid var(--b1)',
          borderRadius: 'var(--r)',
          padding: '8px 10px',
          fontSize: 13,
          fontFamily: 'var(--font)',
          color: 'var(--t1)',
          background: 'var(--bg)',
          resize: 'none',
          minHeight: 52,
          overflow: 'hidden',
          outline: 'none',
          marginTop: 8,
          lineHeight: 1.5,
          boxSizing: 'border-box',
        }}
      />
    </div>
  )
}
