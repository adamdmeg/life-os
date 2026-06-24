import { useState, useEffect } from 'react'
import { supabase } from './supabaseClient'
import { useAuth } from './AuthContext'
import { AREA_META } from './constants/areaMeta'
import Nav from './Nav'
import BackLink from './BackLink'
import { itemStats, goalRollup, gymConsistency } from './stats'

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

// Average of a numeric field across rows, ignoring nulls. Returns null when no data,
// so the UI can show "—" instead of NaN. Rounded to one decimal place.
function avg(rows, key) {
  const vals = rows.map(r => r[key]).filter(v => v != null)
  if (vals.length === 0) return null
  return Math.round((vals.reduce((a, b) => a + b, 0) / vals.length) * 10) / 10
}

export default function MonthReflectionPage({ monthNumber, onNavigate, onSprintClick }) {
  const { user } = useAuth()
  const currentYear = new Date().getFullYear()

  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [monthRow, setMonthRow] = useState(null)
  const [monthlyGoals, setMonthlyGoals] = useState([])
  const [sprints, setSprints] = useState([])
  const [retros, setRetros] = useState([])

  useEffect(() => {
    if (!user?.id) return
    let cancelled = false

    async function load() {
      setLoading(true)
      setError(null)
      try {
        const { data: yr, error: yrErr } = await supabase
          .from('years')
          .select('id, year')
          .eq('user_id', user.id)
          .eq('year', currentYear)
          .single()
        if (yrErr) throw yrErr

        const { data: mo, error: moErr } = await supabase
          .from('months')
          .select('id, month_number, month_name, intention')
          .eq('year_id', yr.id)
          .eq('user_id', user.id)
          .eq('month_number', monthNumber)
          .single()
        if (moErr) throw moErr

        const [goalsRes, sprintsRes] = await Promise.all([
          supabase
            .from('monthly_goals')
            .select('id, area, monthly_goal_text, sort_order, subtasks(id, text, done, sort_order)')
            .eq('month_id', mo.id)
            .eq('user_id', user.id)
            .order('sort_order', { ascending: true }),
          supabase
            .from('sprints')
            .select('id, sprint_number, sprint_number_in_month, start_date, end_date, mid_sprint_notes, gym_plan')
            .eq('month_id', mo.id)
            .eq('user_id', user.id)
            .order('sprint_number_in_month', { ascending: true }),
        ])
        if (goalsRes.error) throw goalsRes.error
        if (sprintsRes.error) throw sprintsRes.error

        // Retros for this month's sprints (one per sprint at most).
        const sprintIds = (sprintsRes.data || []).map(s => s.id)
        let retroRows = []
        if (sprintIds.length) {
          const { data, error: rErr } = await supabase
            .from('retros')
            .select('sprint_id, rating, energy_mind, energy_body, energy_motivation, ai_summary')
            .in('sprint_id', sprintIds)
            .eq('user_id', user.id)
          if (rErr) throw rErr
          retroRows = data || []
        }

        if (cancelled) return
        setMonthRow(mo)
        setMonthlyGoals((goalsRes.data || []).map(g => ({
          ...g,
          subtasks: (g.subtasks || []).sort((a, b) => a.sort_order - b.sort_order),
        })))
        setSprints(sprintsRes.data || [])
        setRetros(retroRows)
      } catch (err) {
        if (!cancelled) setError(err.message)
      } finally {
        if (!cancelled) setLoading(false)
      }
    }

    load()
    return () => { cancelled = true }
  }, [user?.id, monthNumber]) // eslint-disable-line react-hooks/exhaustive-deps

  // ── Loading / error ────────────────────────────────────────────────

  if (loading) {
    return (
      <>
        <Nav activePage="month" onNavigate={onNavigate} />
        <div style={{ padding: '2rem', color: 'var(--t2)', fontSize: 14 }}>Loading…</div>
      </>
    )
  }

  if (error) {
    return (
      <>
        <Nav activePage="month" onNavigate={onNavigate} />
        <div style={{ padding: '2rem', color: '#E24B4A', fontSize: 14 }}>Error: {error}</div>
      </>
    )
  }

  // ── Derived stats ──────────────────────────────────────────────────

  const monthName = monthRow?.month_name || MONTH_NAMES[monthNumber - 1]

  const totalSubtasks = monthlyGoals.reduce((n, g) => n + (g.subtasks || []).length, 0)
  const doneSubtasks = monthlyGoals.reduce((n, g) => n + (g.subtasks || []).filter(s => s.done).length, 0)
  const subtaskPct = totalSubtasks > 0 ? Math.round((doneSubtasks / totalSubtasks) * 100) : 0

  // A goal counts as completed when it has subtasks and every one is done.
  const completedGoals = monthlyGoals.filter(g => {
    const subs = g.subtasks || []
    return subs.length > 0 && subs.every(s => s.done)
  })

  const goalsRollup = goalRollup(monthlyGoals.map(g => itemStats(g.subtasks).pct))

  const gym = gymConsistency(sprints)

  const fmt = v => (v == null ? '—' : v)
  const stats = [
    { label: 'Goals', value: `${goalsRollup.completed}/${goalsRollup.total}`, sub: `${goalsRollup.inProgress} in progress` },
    { label: 'Subtasks done', value: `${subtaskPct}%`, sub: `${doneSubtasks} of ${totalSubtasks}` },
    { label: 'Avg sprint rating', value: fmt(avg(retros, 'rating')), sub: 'out of 10' },
    { label: 'Avg mind', value: fmt(avg(retros, 'energy_mind')), sub: 'out of 5' },
    { label: 'Avg body', value: fmt(avg(retros, 'energy_body')), sub: 'out of 5' },
    { label: 'Avg motivation', value: fmt(avg(retros, 'energy_motivation')), sub: 'out of 5' },
  ]

  const retroBySprint = new Map(retros.map(r => [r.sprint_id, r]))

  // ── Render helpers ─────────────────────────────────────────────────

  const sectionHeader = (icon, label) => (
    <div style={{
      display: 'flex',
      alignItems: 'center',
      gap: 6,
      fontSize: 11,
      fontWeight: 600,
      textTransform: 'uppercase',
      letterSpacing: '0.5px',
      borderBottom: '0.5px solid var(--b1)',
      paddingBottom: 8,
      marginBottom: 12,
      marginTop: 8,
      color: 'var(--t2)',
    }}>
      <i className={`ti ${icon}`} style={{ fontSize: 15 }} />
      {label}
    </div>
  )

  // ── Render ─────────────────────────────────────────────────────────

  return (
    <>
      <Nav activePage="month" onNavigate={onNavigate} />

      <div style={{ padding: '1.5rem', maxWidth: 800, margin: '0 auto' }}>
        <BackLink label="Year" onClick={() => onNavigate('year')} />
        {/* Eyebrow + title */}
        <div style={{ fontSize: 11, textTransform: 'uppercase', letterSpacing: 1, color: 'var(--t2)', marginBottom: 4 }}>
          Life OS · {currentYear} · Month
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 16 }}>
          <div style={{ fontSize: 28, fontWeight: 700 }}>
            {monthName} {currentYear}
          </div>
          <span style={{
            fontSize: 11,
            fontWeight: 600,
            padding: '3px 10px',
            borderRadius: 20,
            background: 'var(--teal-bg)',
            color: 'var(--teal-t)',
          }}>
            Complete
          </span>
        </div>

        {/* Stat grid */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 10, marginBottom: 24 }}>
          {stats.map(({ label, value, sub }) => (
            <div key={label} style={{
              background: 'var(--bg)',
              border: '0.5px solid var(--b1)',
              borderRadius: 'var(--r)',
              padding: '10px 14px',
            }}>
              <div style={{ fontSize: 11, color: 'var(--t2)', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: 2 }}>
                {label}
              </div>
              <div style={{ fontSize: 22, fontWeight: 700, lineHeight: 1 }}>{value}</div>
              <div style={{ fontSize: 12, color: 'var(--t2)', marginTop: 2 }}>{sub}</div>
            </div>
          ))}
        </div>

        {/* Gym consistency — avg workout days/week from lifts + runs across the
            month's sprints (rest and blank days excluded). */}
        {sectionHeader('ti-barbell', 'Gym consistency')}
        <div style={{
          display: 'flex',
          alignItems: 'center',
          gap: 20,
          background: 'var(--bg)',
          border: '0.5px solid var(--b1)',
          borderRadius: 'var(--rl)',
          padding: '16px 18px',
          marginBottom: 24,
        }}>
          <div>
            <div style={{ fontSize: 28, fontWeight: 700, lineHeight: 1, color: 'var(--teal-t)' }}>
              {gym.avgPerWeek == null ? '—' : gym.avgPerWeek}
            </div>
            <div style={{ fontSize: 11, color: 'var(--t2)', textTransform: 'uppercase', letterSpacing: '0.5px', marginTop: 4 }}>
              Avg workouts / week
            </div>
          </div>
          <div style={{ flex: 1, display: 'flex', gap: 24, fontSize: 12, color: 'var(--t2)' }}>
            <span>
              <strong style={{ color: 'var(--t1)', fontSize: 14 }}>{gym.workouts}</strong> workouts
              <div style={{ fontSize: 11, color: 'var(--t3)' }}>over {gym.weeks} {gym.weeks === 1 ? 'week' : 'weeks'}</div>
            </span>
            <span>
              <strong style={{ color: 'var(--teal-t)', fontSize: 14 }}>{gym.lifts}</strong> lifts
            </span>
            <span>
              <strong style={{ color: 'var(--blue-t)', fontSize: 14 }}>{gym.runs}</strong> runs
            </span>
          </div>
        </div>

        {/* Monthly intention (omitted entirely when blank) */}
        {monthRow.intention && monthRow.intention.trim() && (
          <div style={{ marginBottom: 24 }}>
            <div style={{ fontSize: 11, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.5px', color: 'var(--t2)', marginBottom: 6 }}>
              Monthly intention
            </div>
            <div style={{ borderLeft: '3px solid var(--teal)', paddingLeft: 12 }}>
              <div style={{
                fontSize: 14,
                fontStyle: 'italic',
                fontFamily: 'Georgia, serif',
                color: 'var(--t1)',
                lineHeight: 1.6,
                whiteSpace: 'pre-wrap',
              }}>
                {monthRow.intention}
              </div>
            </div>
          </div>
        )}

        {/* Completed goals */}
        {sectionHeader('ti-circle-check', 'Completed goals')}
        {completedGoals.length === 0 ? (
          <p style={{ fontSize: 14, color: 'var(--t3)', marginBottom: 32 }}>
            No goals completed this month.
          </p>
        ) : (
          <div style={{ marginBottom: 32 }}>
            {completedGoals.map(goal => {
              const m = AREA_META[goal.area]
              const subs = goal.subtasks || []
              return (
                <div key={goal.id} style={{ padding: '10px 0', borderBottom: '0.5px solid var(--b1)' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                    {m && (
                      <span style={{
                        fontSize: 10,
                        fontWeight: 600,
                        padding: '2px 8px',
                        borderRadius: 20,
                        background: m.bg,
                        color: m.text,
                        flexShrink: 0,
                      }}>
                        {goal.area}
                      </span>
                    )}
                    <span style={{ flex: 1, fontSize: 13, color: 'var(--t1)' }}>{goal.monthly_goal_text}</span>
                    <i className="ti ti-circle-check-filled" style={{ fontSize: 16, color: 'var(--teal)', flexShrink: 0 }} />
                  </div>
                  {subs.length > 0 && (
                    <div style={{ marginTop: 8, paddingLeft: 14, display: 'flex', flexDirection: 'column', gap: 5 }}>
                      {subs.map(s => (
                        <div key={s.id} style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                          <i className="ti ti-check" style={{ fontSize: 12, color: 'var(--teal)', flexShrink: 0 }} />
                          <span style={{ fontSize: 12, color: 'var(--t3)', textDecoration: 'line-through' }}>{s.text}</span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        )}

        {/* Sprints */}
        {sectionHeader('ti-layout-kanban', 'Sprints this month')}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 32 }}>
          {sprints.map(sp => {
            const r = retroBySprint.get(sp.id)
            return (
              <div key={sp.id}
                onClick={() => onSprintClick?.(sp.id)}
                style={{
                  background: 'var(--bg)',
                  border: '0.5px solid var(--b1)',
                  borderRadius: 'var(--rl)',
                  padding: '14px 16px',
                  cursor: 'pointer',
                }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 3 }}>
                  <div style={{ fontSize: 13, fontWeight: 600 }}>
                    Sprint {sp.sprint_number_in_month}
                  </div>
                  <span style={{
                    fontSize: 11,
                    fontWeight: 600,
                    padding: '2px 8px',
                    borderRadius: 20,
                    background: r?.rating ? 'var(--teal-bg)' : 'var(--bg2)',
                    color: r?.rating ? 'var(--teal-t)' : 'var(--t3)',
                  }}>
                    {r?.rating ? `Rated ${r.rating}/10` : 'No rating'}
                  </span>
                </div>
                <div style={{ fontSize: 11, color: 'var(--t3)', marginBottom: 10 }}>
                  {formatSprintRange(sp.start_date, sp.end_date)}
                </div>

                {/* Energy peek (omitted when there's no retro) */}
                {r && (
                  <div style={{ fontSize: 11, color: 'var(--t3)', marginBottom: 8 }}>
                    Mind {r.energy_mind ?? '—'} · Body {r.energy_body ?? '—'} · Motivation {r.energy_motivation ?? '—'}
                  </div>
                )}

                {/* Mid-sprint check-in peek */}
                <div style={{ marginBottom: 8 }}>
                  <div style={{ fontSize: 10, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.4px', color: 'var(--t3)', marginBottom: 2 }}>
                    Mid-sprint
                  </div>
                  {sp.mid_sprint_notes && sp.mid_sprint_notes.trim() ? (
                    <div style={{
                      fontSize: 12,
                      color: 'var(--t2)',
                      lineHeight: 1.5,
                      display: '-webkit-box',
                      WebkitLineClamp: 2,
                      WebkitBoxOrient: 'vertical',
                      overflow: 'hidden',
                    }}>
                      {sp.mid_sprint_notes}
                    </div>
                  ) : (
                    <div style={{ fontSize: 12, color: 'var(--t3)', fontStyle: 'italic' }}>No check-in written</div>
                  )}
                </div>

                {/* AI summary slot — populated later by an AI job (retros.ai_summary); blank for now */}
                {r?.ai_summary && r.ai_summary.trim() && (
                  <div style={{ fontSize: 12, color: 'var(--t2)', fontStyle: 'italic', lineHeight: 1.5, marginBottom: 8 }}>
                    {r.ai_summary}
                  </div>
                )}

                <div style={{ fontSize: 12, color: 'var(--t2)', display: 'flex', alignItems: 'center', gap: 4 }}>
                  View reflection
                  <i className="ti ti-arrow-right" style={{ fontSize: 12 }} />
                </div>
              </div>
            )
          })}
        </div>
      </div>
    </>
  )
}
