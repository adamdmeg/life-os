import { useState, useEffect } from 'react'
import { supabase } from './supabaseClient'
import { useAuth } from './AuthContext'
import { AREA_META } from './constants/areaMeta'
import Nav from './Nav'
import BackLink from './BackLink'

const MONTH_NAMES = ['January','February','March','April','May','June','July','August','September','October','November','December']
const MONTH_ABBR  = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec']

function formatSprintRange(start, end) {
  const s = new Date(start + 'T00:00:00')
  const e = new Date(end + 'T00:00:00')
  const sm = MONTH_ABBR[s.getMonth()]
  const em = MONTH_ABBR[e.getMonth()]
  if (sm === em) return `${sm} ${s.getDate()}–${e.getDate()}`
  return `${sm} ${s.getDate()} – ${em} ${e.getDate()}`
}

// The three retro reflection prompts — same labels/icons/colors as RetroPage.
const REFLECTIONS = [
  { key: 'went_well', label: 'What went well', icon: '✓', bg: 'var(--teal-bg)' },
  { key: 'improve', label: 'What to improve', icon: '△', bg: 'var(--amber-bg)' },
  { key: 'carry_forward', label: 'Carry forward', icon: '→', bg: 'var(--purple-bg)' },
]

const ENERGY = [
  { key: 'energy_mind', label: 'Mind' },
  { key: 'energy_body', label: 'Body' },
  { key: 'energy_motivation', label: 'Motivation' },
]

// Reflection pages are read-only, so dots are static — the saved value is highlighted,
// the rest are inert (no pointer cursor, no click handler).
function readonlyDot(active, size, label) {
  return (
    <div
      key={label}
      style={{
        width: size,
        height: size,
        borderRadius: '50%',
        border: active ? '0.5px solid var(--teal-t)' : `0.5px solid var(--b${size >= 30 ? 2 : 1})`,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        fontSize: size >= 30 ? 12 : 11,
        fontWeight: 500,
        color: active ? '#fff' : 'var(--t3)',
        background: active ? 'var(--teal)' : 'transparent',
      }}
    >
      {label}
    </div>
  )
}

export default function SprintReflectionPage({ sprintRow, onNavigate, onNavigateMonth }) {
  const { user } = useAuth()

  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [retro, setRetro] = useState(null)
  const [taskStats, setTaskStats] = useState({ done: 0, total: 0 })
  const [sprintGoals, setSprintGoals] = useState([])
  const [tasks, setTasks] = useState([])

  useEffect(() => {
    if (!user?.id || !sprintRow?.id) return
    let cancelled = false

    async function load() {
      setLoading(true)
      setError(null)
      try {
        const [retroRes, tasksRes, sprintGoalsRes] = await Promise.all([
          supabase
            .from('retros')
            .select('rating, went_well, improve, carry_forward, energy_mind, energy_body, energy_motivation, one_insight')
            .eq('sprint_id', sprintRow.id)
            .eq('user_id', user.id)
            .maybeSingle(),
          supabase
            .from('tasks')
            .select('status, sprint_goal_id')
            .eq('sprint_id', sprintRow.id)
            .eq('user_id', user.id),
          supabase
            .from('sprint_goals')
            .select('id, area, sprint_goal_text, sort_order')
            .eq('sprint_id', sprintRow.id)
            .eq('user_id', user.id)
            .order('sort_order', { ascending: true }),
        ])
        if (retroRes.error) throw retroRes.error
        if (tasksRes.error) throw tasksRes.error
        if (sprintGoalsRes.error) throw sprintGoalsRes.error

        if (cancelled) return
        const taskRows = tasksRes.data || []
        setRetro(retroRes.data || null)
        setTasks(taskRows)
        setSprintGoals(sprintGoalsRes.data || [])
        setTaskStats({ done: taskRows.filter(t => t.status === 'done').length, total: taskRows.length })
      } catch (err) {
        if (!cancelled) setError(err.message)
      } finally {
        if (!cancelled) setLoading(false)
      }
    }

    load()
    return () => { cancelled = true }
  }, [user?.id, sprintRow?.id])

  // ── Loading / error ────────────────────────────────────────────────

  if (loading) {
    return (
      <>
        <Nav activePage="sprint" onNavigate={onNavigate} />
        <div style={{ padding: '2rem', color: 'var(--t2)', fontSize: 14 }}>Loading…</div>
      </>
    )
  }

  if (error) {
    return (
      <>
        <Nav activePage="sprint" onNavigate={onNavigate} />
        <div style={{ padding: '2rem', color: '#E24B4A', fontSize: 14 }}>Error: {error}</div>
      </>
    )
  }

  // ── Derived ────────────────────────────────────────────────────────

  const start = new Date(sprintRow.start_date + 'T00:00:00')
  const year = start.getFullYear()
  const monthName = MONTH_NAMES[start.getMonth()]
  const completionPct = taskStats.total > 0 ? Math.round((taskStats.done / taskStats.total) * 100) : 0

  // ── Shared styles ──────────────────────────────────────────────────

  const cardStyle = {
    background: 'var(--bg)',
    border: '0.5px solid var(--b1)',
    borderRadius: 'var(--rl)',
    padding: '14px 16px',
    marginBottom: 12,
  }

  const cardTitleStyle = {
    display: 'flex',
    alignItems: 'center',
    gap: 8,
    fontSize: 14,
    fontWeight: 600,
    marginBottom: 12,
  }

  const pillStyle = {
    fontSize: 12,
    color: 'var(--t2)',
    background: 'var(--bg2)',
    borderRadius: 20,
    padding: '4px 12px',
    display: 'flex',
    alignItems: 'center',
    gap: 6,
  }

  // Read-only text block: shows saved prose, or a muted placeholder when blank.
  function readonlyText(value, emptyLabel) {
    if (value && value.trim()) {
      return <div style={{ fontSize: 13, color: 'var(--t1)', lineHeight: 1.6, whiteSpace: 'pre-wrap' }}>{value}</div>
    }
    return <div style={{ fontSize: 13, color: 'var(--t3)', fontStyle: 'italic' }}>{emptyLabel}</div>
  }

  // ── Render ─────────────────────────────────────────────────────────

  return (
    <>
      <Nav activePage="sprint" onNavigate={onNavigate} />

      <div style={{ padding: '1.5rem', maxWidth: 800, margin: '0 auto' }}>
        <BackLink label={monthName} onClick={() => onNavigateMonth?.(start.getMonth() + 1)} />
        {/* Eyebrow + title */}
        <div style={{ fontSize: 11, textTransform: 'uppercase', letterSpacing: 1, color: 'var(--t2)', marginBottom: 4 }}>
          Life OS · {year} · {monthName} · Sprint
        </div>
        <div style={{ fontSize: 28, fontWeight: 700, marginBottom: 16 }}>
          Sprint {sprintRow.sprint_number} Reflection
        </div>

        {/* Meta pills */}
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 20 }}>
          <span style={pillStyle}>
            <i className="ti ti-calendar" style={{ fontSize: 13 }} />
            {formatSprintRange(sprintRow.start_date, sprintRow.end_date)}
          </span>
          <span style={{ ...pillStyle, background: 'var(--teal-bg)', color: 'var(--teal-t)' }}>
            <i className="ti ti-circle-check" style={{ fontSize: 13 }} />
            Complete
          </span>
          {taskStats.total > 0 && (
            <span style={pillStyle}>
              <i className="ti ti-layout-kanban" style={{ fontSize: 13 }} />
              {taskStats.done} of {taskStats.total} tasks done ({completionPct}%)
            </span>
          )}
        </div>

        {/* Sprint intention (overall free-text) */}
        <div style={cardStyle}>
          <div style={cardTitleStyle}>
            <i className="ti ti-flag" style={{ fontSize: 15 }} />
            Sprint intention
          </div>
          {readonlyText(sprintRow.goals, 'No sprint intention was written.')}
        </div>

        {/* Sprint goals (read-only, with task completion) */}
        {sprintGoals.length > 0 && (
          <div style={cardStyle}>
            <div style={cardTitleStyle}>
              <i className="ti ti-target" style={{ fontSize: 15 }} />
              Sprint goals
            </div>
            {sprintGoals.map(goal => {
              const gm = AREA_META[goal.area] || AREA_META.Health
              const gtasks = tasks.filter(t => t.sprint_goal_id === goal.id)
              const done = gtasks.filter(t => t.status === 'done').length
              const total = gtasks.length
              const pct = total ? Math.round((done / total) * 100) : 0
              return (
                <div key={goal.id} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '8px 0', borderBottom: '0.5px solid var(--b1)' }}>
                  <div style={{ width: 10, height: 10, borderRadius: '50%', background: gm.color, flexShrink: 0 }} />
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 13, color: 'var(--t1)', marginBottom: 6 }}>{goal.sprint_goal_text}</div>
                    <div style={{ height: 5, background: 'var(--bg2)', borderRadius: 3, overflow: 'hidden' }}>
                      <div style={{ height: '100%', width: `${pct}%`, background: gm.color, borderRadius: 3 }} />
                    </div>
                  </div>
                  <span style={{ fontSize: 11, color: 'var(--t3)', whiteSpace: 'nowrap', flexShrink: 0 }}>
                    {done}/{total}{total > 0 ? ` (${pct}%)` : ''} done
                  </span>
                </div>
              )
            })}
          </div>
        )}

        {/* Mid-sprint check-in */}
        <div style={cardStyle}>
          <div style={cardTitleStyle}>
            <i className="ti ti-clipboard-check" style={{ fontSize: 15 }} />
            Mid-sprint check-in (day 7)
          </div>
          {readonlyText(sprintRow.mid_sprint_notes, 'No check-in was written.')}
        </div>

        {/* Retro */}
        {retro ? (
          <>
            {/* Overall rating */}
            <div style={cardStyle}>
              <div style={cardTitleStyle}>
                <i className="ti ti-chart-bar" style={{ fontSize: 15 }} />
                Overall rating
              </div>
              {retro.rating ? (
                <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                  {Array.from({ length: 10 }, (_, i) => i + 1).map(n =>
                    readonlyDot(retro.rating === n, 30, n)
                  )}
                </div>
              ) : (
                <div style={{ fontSize: 13, color: 'var(--t3)', fontStyle: 'italic' }}>Not rated.</div>
              )}
            </div>

            {/* Reflections */}
            <div style={cardStyle}>
              {REFLECTIONS.map((r, idx) => (
                <div key={r.key} style={{ marginBottom: idx === REFLECTIONS.length - 1 ? 0 : '1.25rem' }}>
                  <div style={{ fontSize: 13, fontWeight: 500, marginBottom: 6, display: 'flex', alignItems: 'center', gap: 8 }}>
                    <div style={{
                      width: 20,
                      height: 20,
                      borderRadius: '50%',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      fontSize: 12,
                      flexShrink: 0,
                      background: r.bg,
                    }}>
                      {r.icon}
                    </div>
                    {r.label}
                  </div>
                  {readonlyText(retro[r.key], 'Nothing written.')}
                </div>
              ))}
            </div>

            {/* Energy check */}
            <div style={cardStyle}>
              <div style={cardTitleStyle}>
                <i className="ti ti-heart" style={{ fontSize: 15 }} />
                Energy check
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 12 }}>
                {ENERGY.map(e => (
                  <div key={e.key}>
                    <div style={{ fontSize: 12, color: 'var(--t2)', marginBottom: 8 }}>{e.label}</div>
                    <div style={{ display: 'flex', gap: 4 }}>
                      {[1, 2, 3, 4, 5].map(n => readonlyDot(retro[e.key] === n, 24, n))}
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* One insight */}
            <div style={cardStyle}>
              <div style={cardTitleStyle}>
                <i className="ti ti-bulb" style={{ fontSize: 15 }} />
                One insight
              </div>
              {readonlyText(retro.one_insight, 'Nothing written.')}
            </div>
          </>
        ) : (
          <div style={cardStyle}>
            <div style={{ fontSize: 13, color: 'var(--t3)', fontStyle: 'italic' }}>
              No retro recorded for this sprint.
            </div>
          </div>
        )}
      </div>
    </>
  )
}
