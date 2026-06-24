import { useState, useEffect } from 'react'
import { supabase } from './supabaseClient'
import { useAuth } from './AuthContext'
import Nav from './Nav'
import MonthlyGoalCard from './MonthlyGoalCard'
import AddMonthlyGoalModal from './AddMonthlyGoalModal'
import PullYearGoalsModal from './PullYearGoalsModal'
import MonthCalendar from './MonthCalendar'
import BackLink from './BackLink'
import { itemStats, goalRollup, gymConsistency } from './stats'

const MONTH_NAMES = ['January','February','March','April','May','June','July','August','September','October','November','December']
const MONTH_ABBR  = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec']

function formatDate(dateStr) {
  const d = new Date(dateStr + 'T00:00:00')
  return `${MONTH_ABBR[d.getMonth()]} ${d.getDate()}`
}

function formatSprintRange(start, end) {
  const s = new Date(start + 'T00:00:00')
  const e = new Date(end + 'T00:00:00')
  const sm = MONTH_ABBR[s.getMonth()]
  const em = MONTH_ABBR[e.getMonth()]
  if (sm === em) return `${sm} ${s.getDate()}–${e.getDate()}`
  return `${sm} ${s.getDate()} – ${em} ${e.getDate()}`
}

function daysLeft(endDateStr) {
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  const end = new Date(endDateStr + 'T00:00:00')
  return Math.max(0, Math.ceil((end - today) / 86400000))
}

// A sprint's display status is derived from its date range rather than the stored
// `status` field, which stays at the seeded default until the (not-yet-built) Sprint
// kickoff flow advances it. This keeps the month overview honest about which sprint
// has finished, is running, or hasn't begun. `progress` is time-elapsed through the
// 14-day window; real task-completion % will replace it once the Sprint page exists.
function deriveSprintStatus(sp, today) {
  const start = new Date(sp.start_date + 'T00:00:00')
  const end = new Date(sp.end_date + 'T23:59:59')
  if (today > end) return { state: 'complete', progress: 100 }
  if (today < start) return { state: 'not_started', progress: 0 }
  const elapsed = (today - start) / (end - start)
  return { state: 'active', progress: Math.round(Math.min(1, Math.max(0, elapsed)) * 100) }
}

export default function MonthPage({ monthNumber, onNavigate, onSprintClick }) {
  const { user } = useAuth()
  const currentYear = new Date().getFullYear()

  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [monthRow, setMonthRow] = useState(null)
  const [monthlyGoals, setMonthlyGoals] = useState([])
  const [keyDates, setKeyDates] = useState([])
  const [sprints, setSprints] = useState([])
  const [yearGoals, setYearGoals] = useState([])
  const [intentionText, setIntentionText] = useState('')
  const [showAddGoal, setShowAddGoal] = useState(false)
  const [showPullYear, setShowPullYear] = useState(false)
  const [keyDatesView, setKeyDatesView] = useState('list') // 'list' | 'calendar'

  // Add key date form state
  const [newDate, setNewDate] = useState('')
  const [newEvent, setNewEvent] = useState('')
  const [newTag, setNewTag] = useState('')

  useEffect(() => {
    if (!user?.id) return
    let cancelled = false

    async function load() {
      setLoading(true)
      setError(null)
      try {
        // 1. Get year row
        const { data: yr, error: yrErr } = await supabase
          .from('years')
          .select('id, year')
          .eq('user_id', user.id)
          .eq('year', currentYear)
          .single()
        if (yrErr) throw yrErr

        // 2. Get month row
        const { data: mo, error: moErr } = await supabase
          .from('months')
          .select('id, month_number, month_name, intention, status')
          .eq('year_id', yr.id)
          .eq('user_id', user.id)
          .eq('month_number', monthNumber)
          .single()
        if (moErr) throw moErr

        // 3. Parallel fetch related data
        const [goalsRes, keyDatesRes, sprintsRes, yearGoalsRes] = await Promise.all([
          supabase
            .from('monthly_goals')
            .select('id, area, monthly_goal_text, sort_order, goal_id, subtasks(id, text, done, tag, area, due_date, sort_order, milestone_source_id)')
            .eq('month_id', mo.id)
            .eq('user_id', user.id)
            .order('sort_order', { ascending: true }),
          supabase
            .from('key_dates')
            .select('id, date, event_name, tag, is_auto')
            .eq('month_id', mo.id)
            .eq('user_id', user.id)
            .order('date', { ascending: true }),
          supabase
            .from('sprints')
            .select('id, sprint_number_in_month, sprint_number, start_date, end_date, status, name, gym_plan')
            .eq('month_id', mo.id)
            .eq('user_id', user.id)
            .order('sprint_number_in_month', { ascending: true }),
          supabase
            .from('goals')
            .select('id, area, goal_text, milestones(id, text, done, sort_order)')
            .eq('year_id', yr.id)
            .eq('user_id', user.id),
        ])

        if (goalsRes.error) throw goalsRes.error
        if (keyDatesRes.error) throw keyDatesRes.error
        if (sprintsRes.error) throw sprintsRes.error
        if (yearGoalsRes.error) throw yearGoalsRes.error

        if (cancelled) return

        setMonthRow(mo)
        setIntentionText(mo.intention || '')
        setMonthlyGoals((goalsRes.data || []).map(g => ({
          ...g,
          subtasks: (g.subtasks || []).sort((a, b) => a.sort_order - b.sort_order),
        })))
        setKeyDates(keyDatesRes.data || [])
        setSprints(sprintsRes.data || [])
        setYearGoals((yearGoalsRes.data || []).map(g => ({
          ...g,
          milestones: (g.milestones || []).sort((a, b) => a.sort_order - b.sort_order),
        })))
      } catch (err) {
        if (!cancelled) setError(err.message)
      } finally {
        if (!cancelled) setLoading(false)
      }
    }

    load()
    return () => { cancelled = true }
  }, [user?.id, monthNumber]) // eslint-disable-line react-hooks/exhaustive-deps

  // ── Mutation handlers ──────────────────────────────────────────────

  async function handleIntentionBlur() {
    if (!monthRow || intentionText === (monthRow.intention || '')) return
    await supabase.from('months').update({ intention: intentionText }).eq('id', monthRow.id)
    setMonthRow(prev => ({ ...prev, intention: intentionText }))
  }

  async function handleMonthlyGoalTextBlur(goalId, value) {
    await supabase.from('monthly_goals').update({ monthly_goal_text: value }).eq('id', goalId)
  }

  // Recalculate a yearly goal's progress from its milestones (matches YearPage logic),
  // so propagated milestone completions keep the year stats accurate.
  async function recalcGoalProgress(yearGoalId) {
    const { data } = await supabase.from('milestones').select('done').eq('goal_id', yearGoalId)
    if (!data) return
    await supabase.from('goals').update({ progress: itemStats(data).pct }).eq('id', yearGoalId)
  }

  async function handleSubtaskToggle(goalId, subtaskId, newDone) {
    const goal = monthlyGoals.find(g => g.id === goalId)
    const sub = goal?.subtasks.find(s => s.id === subtaskId)

    setMonthlyGoals(prev => prev.map(g =>
      g.id !== goalId ? g : {
        ...g,
        subtasks: g.subtasks.map(s => s.id === subtaskId ? { ...s, done: newDone } : s),
      }
    ))
    await supabase.from('subtasks').update({ done: newDone }).eq('id', subtaskId)

    // Propagate upward: a subtask pulled from a yearly milestone updates that milestone
    // and the parent goal's progress. (goal.goal_id is the milestone's yearly goal.)
    if (sub?.milestone_source_id) {
      await supabase.from('milestones').update({ done: newDone }).eq('id', sub.milestone_source_id)
      if (goal.goal_id) await recalcGoalProgress(goal.goal_id)
    }
  }

  async function handleAddSubtask(goalId, text, tag) {
    const goal = monthlyGoals.find(g => g.id === goalId)
    const sortOrder = (goal?.subtasks || []).length

    const { data: sub, error } = await supabase
      .from('subtasks')
      .insert({ monthly_goal_id: goalId, user_id: user.id, text, done: false, tag, sort_order: sortOrder })
      .select('id, text, done, tag, area, due_date, sort_order, milestone_source_id')
      .single()
    if (error) { console.error(error); return }

    setMonthlyGoals(prev => prev.map(g =>
      g.id === goalId ? { ...g, subtasks: [...(g.subtasks || []), sub] } : g
    ))
  }

  // Add a subtask to a yearly-linked card by pulling one of the yearly goal's milestones,
  // keeping the milestone_source_id link so completion/edits propagate.
  async function handleAddSubtaskFromMilestone(goalId, mile) {
    const goal = monthlyGoals.find(g => g.id === goalId)
    const sortOrder = (goal?.subtasks || []).length

    const { data: sub, error } = await supabase
      .from('subtasks')
      .insert({
        monthly_goal_id: goalId,
        user_id: user.id,
        text: mile.text,
        done: false,
        tag: 'yearly_goal',
        milestone_source_id: mile.id,
        sort_order: sortOrder,
      })
      .select('id, text, done, tag, area, due_date, sort_order, milestone_source_id')
      .single()
    if (error) { console.error(error); return }

    setMonthlyGoals(prev => prev.map(g =>
      g.id === goalId ? { ...g, subtasks: [...(g.subtasks || []), sub] } : g
    ))
  }

  async function handleDeleteMonthlyGoal(goalId) {
    const goal = monthlyGoals.find(g => g.id === goalId)
    const subIds = (goal?.subtasks || []).map(s => s.id)
    setMonthlyGoals(prev => prev.filter(g => g.id !== goalId))
    // Remove sprint tasks pulled from this goal's subtasks, then the goal (subtasks cascade).
    if (subIds.length) await supabase.from('tasks').delete().in('subtask_source_id', subIds)
    await supabase.from('monthly_goals').delete().eq('id', goalId)
  }

  // Edit a monthly subtask (text / area / due_date) and cascade the same fields to sprint
  // tasks pulled from it, so the month subtask stays the source of truth for its copies.
  // `patch` may contain any of: text, area, due_date.
  async function handleEditSubtask(goalId, subtaskId, patch) {
    setMonthlyGoals(prev => prev.map(g =>
      g.id === goalId
        ? { ...g, subtasks: g.subtasks.map(s => s.id === subtaskId ? { ...s, ...patch } : s) }
        : g
    ))
    await supabase.from('subtasks').update(patch).eq('id', subtaskId)
    await supabase.from('tasks').update(patch).eq('subtask_source_id', subtaskId)
  }

  async function handleDeleteSubtask(goalId, subtaskId) {
    setMonthlyGoals(prev => prev.map(g =>
      g.id === goalId ? { ...g, subtasks: g.subtasks.filter(s => s.id !== subtaskId) } : g
    ))
    // Remove sprint task copies pulled from this subtask, then the subtask itself.
    await supabase.from('tasks').delete().eq('subtask_source_id', subtaskId)
    await supabase.from('subtasks').delete().eq('id', subtaskId)
  }

  async function handleAddMonthlyGoal({ area, goalText, subtasks }) {
    const { data: goal, error } = await supabase
      .from('monthly_goals')
      .insert({
        month_id: monthRow.id,
        user_id: user.id,
        area,
        monthly_goal_text: goalText,
        sort_order: monthlyGoals.length,
      })
      .select('id, area, monthly_goal_text, sort_order, goal_id')
      .single()
    if (error) { console.error(error); return }

    let insertedSubs = []
    if (subtasks.length > 0) {
      const { data } = await supabase
        .from('subtasks')
        .insert(subtasks.map((s, i) => ({
          monthly_goal_id: goal.id,
          user_id: user.id,
          text: s.text,
          done: false,
          tag: s.tag,
          sort_order: i,
        })))
        .select('id, text, done, tag, area, due_date, sort_order, milestone_source_id')
      insertedSubs = data || []
    }

    setMonthlyGoals(prev => [...prev, { ...goal, subtasks: insertedSubs }])
    setShowAddGoal(false)
  }

  // Pull selected yearly goals into the month: each becomes a monthly_goal card linked
  // via goal_id, with the chosen incomplete milestones inserted as 'yearly_goal' subtasks.
  async function handlePullYearGoals(payload) {
    if (!payload.length) { setShowPullYear(false); return }
    const newCards = []
    for (let i = 0; i < payload.length; i++) {
      const entry = payload[i]
      const { data: goal, error } = await supabase
        .from('monthly_goals')
        .insert({
          month_id: monthRow.id,
          user_id: user.id,
          area: entry.area,
          monthly_goal_text: entry.goalText,
          goal_id: entry.goalId,
          sort_order: monthlyGoals.length + i,
        })
        .select('id, area, monthly_goal_text, sort_order, goal_id')
        .single()
      if (error) { console.error(error); continue }

      let insertedSubs = []
      if (entry.milestones.length > 0) {
        const { data } = await supabase
          .from('subtasks')
          .insert(entry.milestones.map((mile, j) => ({
            monthly_goal_id: goal.id,
            user_id: user.id,
            text: mile.text,
            done: false,
            tag: 'yearly_goal',
            milestone_source_id: mile.id,
            sort_order: j,
          })))
          .select('id, text, done, tag, area, due_date, sort_order, milestone_source_id')
        insertedSubs = data || []
      }
      newCards.push({ ...goal, subtasks: insertedSubs })
    }
    setMonthlyGoals(prev => [...prev, ...newCards])
    setShowPullYear(false)
  }

  async function handleAddKeyDate() {
    if (!newDate || !newEvent.trim()) return
    const tag = newTag.trim() || 'Other'

    const { data: kd, error } = await supabase
      .from('key_dates')
      .insert({
        user_id: user.id,
        month_id: monthRow.id,
        date: newDate,
        event_name: newEvent.trim(),
        tag,
        is_auto: false,
      })
      .select('id, date, event_name, tag, is_auto')
      .single()
    if (error) { console.error(error); return }

    setKeyDates(prev => [...prev, kd].sort((a, b) => a.date.localeCompare(b.date)))
    setNewDate('')
    setNewEvent('')
    setNewTag('')
  }

  // ── Derived stats ──────────────────────────────────────────────────

  const subtasks = itemStats(monthlyGoals.flatMap(g => g.subtasks || []))
  const goalsRollup = goalRollup(monthlyGoals.map(g => itemStats(g.subtasks).pct))
  const today = new Date()
  // Running gym consistency: only fully-ended weeks count, so the average never dips mid-week.
  const gym = gymConsistency(sprints, today)

  // ── Render ─────────────────────────────────────────────────────────

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

  const monthName = monthRow?.month_name || MONTH_NAMES[monthNumber - 1]

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

  return (
    <>
      <Nav activePage="month" onNavigate={onNavigate} />

      <div style={{ padding: '1.5rem', maxWidth: 800, margin: '0 auto' }}>
        <BackLink label="Year" onClick={() => onNavigate('year')} />
        {/* Eyebrow + title */}
        <div style={{ fontSize: 11, textTransform: 'uppercase', letterSpacing: 1, color: 'var(--t2)', marginBottom: 4 }}>
          Life OS · {currentYear} · Month
        </div>
        <div style={{ fontSize: 28, fontWeight: 700, marginBottom: 16 }}>
          {monthName} {currentYear}
        </div>

        {/* Stat cards */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 10, marginBottom: 20 }}>
          {[
            { label: 'Subtasks done', value: `${subtasks.pct}%`, sub: `${subtasks.done} of ${subtasks.total}` },
            { label: 'Goals', value: `${goalsRollup.completed}/${goalsRollup.total}`, sub: `${goalsRollup.inProgress} in progress` },
            { label: 'Sprints', value: sprints.length, sub: 'this month' },
            { label: 'Key dates', value: keyDates.length, sub: 'this month' },
          ].map(({ label, value, sub }) => (
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

        {/* Monthly intention */}
        <div style={{ borderLeft: '3px solid var(--teal)', paddingLeft: 12, marginBottom: 24 }}>
          <textarea
            value={intentionText}
            onChange={e => setIntentionText(e.target.value)}
            onBlur={handleIntentionBlur}
            placeholder={`What do you want ${monthName} to feel like? What would make this month a win?`}
            rows={2}
            style={{
              width: '100%',
              border: 'none',
              outline: 'none',
              resize: 'none',
              fontSize: 14,
              fontStyle: 'italic',
              fontFamily: 'Georgia, serif',
              background: 'transparent',
              color: 'var(--t1)',
              boxSizing: 'border-box',
            }}
          />
        </div>

        {/* Goals this month */}
        {sectionHeader('ti-target', 'Goals this month')}

        {monthlyGoals.length === 0 && (
          <p style={{ fontSize: 14, color: 'var(--t2)', marginBottom: 12 }}>
            No monthly goals yet — add your first one below.
          </p>
        )}

        {monthlyGoals.map(goal => {
          const yearGoal = goal.goal_id ? yearGoals.find(yg => yg.id === goal.goal_id) : null
          return (
            <MonthlyGoalCard
              key={goal.id}
              goal={goal}
              yearGoal={yearGoal}
              onGoalTextBlur={handleMonthlyGoalTextBlur}
              onSubtaskToggle={handleSubtaskToggle}
              onAddSubtask={handleAddSubtask}
              onAddSubtaskFromMilestone={handleAddSubtaskFromMilestone}
              onDelete={handleDeleteMonthlyGoal}
              onDeleteSubtask={handleDeleteSubtask}
              onEditSubtask={handleEditSubtask}
            />
          )
        })}

        <div style={{ display: 'flex', gap: 16, marginBottom: 32 }}>
          <button
            onClick={() => setShowAddGoal(true)}
            style={{
              background: 'none',
              border: 'none',
              color: 'var(--t2)',
              fontSize: 13,
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: 4,
              padding: '4px 0',
              fontFamily: 'var(--font)',
            }}
          >
            <i className="ti ti-plus" style={{ fontSize: 13 }} />
            Add monthly goal
          </button>
          <button
            onClick={() => setShowPullYear(true)}
            style={{
              background: 'none',
              border: 'none',
              color: 'var(--t2)',
              fontSize: 13,
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: 4,
              padding: '4px 0',
              fontFamily: 'var(--font)',
            }}
          >
            <i className="ti ti-download" style={{ fontSize: 13 }} />
            Pull from yearly goals
          </button>
        </div>

        {/* Key dates — header with list/calendar toggle */}
        <div style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          borderBottom: '0.5px solid var(--b1)',
          paddingBottom: 8,
          marginBottom: 12,
          marginTop: 8,
        }}>
          <div style={{
            display: 'flex',
            alignItems: 'center',
            gap: 6,
            fontSize: 11,
            fontWeight: 600,
            textTransform: 'uppercase',
            letterSpacing: '0.5px',
            color: 'var(--t2)',
          }}>
            <i className="ti ti-calendar-event" style={{ fontSize: 15 }} />
            Key dates & appointments
          </div>
          <div style={{ display: 'flex', gap: 2, background: 'var(--bg2)', borderRadius: 'var(--r)', padding: 2 }}>
            {[
              { v: 'list', icon: 'ti-list' },
              { v: 'calendar', icon: 'ti-calendar' },
            ].map(({ v, icon }) => {
              const active = keyDatesView === v
              return (
                <button
                  key={v}
                  onClick={() => setKeyDatesView(v)}
                  style={{
                    fontSize: 11,
                    padding: '4px 10px',
                    border: 'none',
                    borderRadius: 6,
                    cursor: 'pointer',
                    fontFamily: 'var(--font)',
                    textTransform: 'capitalize',
                    background: active ? 'var(--bg)' : 'transparent',
                    color: active ? 'var(--t1)' : 'var(--t2)',
                    boxShadow: active ? '0 1px 2px rgba(0,0,0,0.06)' : 'none',
                    fontWeight: active ? 600 : 400,
                    display: 'flex',
                    alignItems: 'center',
                    gap: 4,
                  }}
                >
                  <i className={`ti ${icon}`} style={{ fontSize: 12 }} />
                  {v}
                </button>
              )
            })}
          </div>
        </div>

        <div style={{
          background: 'var(--bg)',
          border: '0.5px solid var(--b1)',
          borderRadius: 'var(--rl)',
          padding: '10px 16px',
          marginBottom: 32,
        }}>
          {keyDatesView === 'list' ? (
            <>
              {keyDates.length === 0 && (
                <p style={{ fontSize: 13, color: 'var(--t3)', paddingBottom: 8 }}>No dates yet.</p>
              )}

              {keyDates.map(kd => (
                <div key={kd.id} style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 10,
                  padding: '7px 0',
                  borderBottom: '0.5px solid var(--b1)',
                  fontSize: 13,
                }}>
                  <span style={{
                    fontSize: 11,
                    fontWeight: 600,
                    padding: '2px 8px',
                    borderRadius: 20,
                    background: kd.is_auto ? 'var(--teal-bg)' : 'var(--bg2)',
                    color: kd.is_auto ? 'var(--teal-t)' : 'var(--t2)',
                    minWidth: 54,
                    textAlign: 'center',
                    whiteSpace: 'nowrap',
                    flexShrink: 0,
                  }}>
                    {formatDate(kd.date)}
                  </span>
                  <span style={{ flex: 1, color: 'var(--t1)' }}>{kd.event_name}</span>
                  <span style={{ fontSize: 11, color: 'var(--t3)' }}>{kd.is_auto ? 'auto' : kd.tag}</span>
                </div>
              ))}
            </>
          ) : (
            <MonthCalendar year={currentYear} monthNumber={monthNumber} keyDates={keyDates} today={today} />
          )}

          {/* Add key date form */}
          <div style={{ display: 'flex', gap: 6, marginTop: 10, flexWrap: 'wrap' }}>
            <input
              type="date"
              value={newDate}
              onChange={e => setNewDate(e.target.value)}
              style={{
                fontSize: 12,
                padding: '6px 8px',
                border: '0.5px solid var(--b1)',
                borderRadius: 'var(--r)',
                fontFamily: 'var(--font)',
                outline: 'none',
                background: 'var(--bg)',
                color: 'var(--t1)',
                maxWidth: 150,
              }}
            />
            <input
              type="text"
              value={newEvent}
              onChange={e => setNewEvent(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && handleAddKeyDate()}
              placeholder="Event name"
              style={{
                flex: 1,
                fontSize: 12,
                padding: '6px 8px',
                border: '0.5px solid var(--b1)',
                borderRadius: 'var(--r)',
                fontFamily: 'var(--font)',
                outline: 'none',
                background: 'var(--bg)',
                color: 'var(--t1)',
                minWidth: 100,
              }}
            />
            <input
              type="text"
              value={newTag}
              onChange={e => setNewTag(e.target.value)}
              placeholder="Tag"
              style={{
                fontSize: 12,
                padding: '6px 8px',
                border: '0.5px solid var(--b1)',
                borderRadius: 'var(--r)',
                fontFamily: 'var(--font)',
                outline: 'none',
                background: 'var(--bg)',
                color: 'var(--t1)',
                maxWidth: 90,
              }}
            />
            <button
              onClick={handleAddKeyDate}
              style={{
                fontSize: 12,
                padding: '6px 12px',
                background: 'none',
                border: '0.5px solid var(--b2)',
                borderRadius: 'var(--r)',
                cursor: 'pointer',
                fontFamily: 'var(--font)',
                color: 'var(--t2)',
                whiteSpace: 'nowrap',
              }}
            >
              Add
            </button>
          </div>
        </div>

        {/* Sprints this month */}
        {sectionHeader('ti-layout-kanban', 'Sprints this month')}

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 32 }}>
          {sprints.map(sp => {
            const { state, progress } = deriveSprintStatus(sp, today)
            const isActive = state === 'active'
            const isComplete = state === 'complete'
            const left = isActive ? daysLeft(sp.end_date) : null

            let statusLabel = 'Not started'
            let statusBg = 'var(--bg2)'
            let statusColor = 'var(--t3)'
            if (isActive) { statusLabel = 'Active'; statusBg = 'var(--teal-bg)'; statusColor = 'var(--teal-t)' }
            if (isComplete) { statusLabel = 'Complete'; statusBg = 'var(--teal-bg)'; statusColor = 'var(--teal-t)' }

            return (
              <div key={sp.id}
                onClick={() => onSprintClick?.(sp.id)}
                style={{
                  background: 'var(--bg)',
                  border: isActive ? '1px solid var(--teal)' : '0.5px solid var(--b1)',
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
                    background: statusBg,
                    color: statusColor,
                  }}>
                    {statusLabel}
                  </span>
                </div>
                <div style={{ fontSize: 11, color: 'var(--t3)', marginBottom: 10 }}>
                  {formatSprintRange(sp.start_date, sp.end_date)}
                </div>
                <div style={{ width: '100%', height: 4, background: 'var(--bg2)', borderRadius: 2, marginBottom: 4 }}>
                  <div style={{ height: '100%', width: `${progress}%`, background: 'var(--teal)', borderRadius: 2, transition: 'width 0.2s' }} />
                </div>
                <div style={{ fontSize: 11, color: 'var(--t3)' }}>
                  {isActive && left !== null ? `${left} day${left === 1 ? '' : 's'} left` : null}
                  {!isActive && !isComplete ? `Kickoff ${formatDate(sp.start_date)}` : null}
                  {isComplete ? 'Completed' : null}
                </div>
              </div>
            )
          })}
        </div>

        {/* Gym consistency — running avg workout days/week from lifts + runs across the
            month's sprints (rest and blank days excluded; only fully-ended weeks count). */}
        {sectionHeader('ti-barbell', 'Gym consistency')}
        <div style={{
          display: 'flex',
          alignItems: 'center',
          gap: 20,
          background: 'var(--bg)',
          border: '0.5px solid var(--b1)',
          borderRadius: 'var(--rl)',
          padding: '16px 18px',
          marginBottom: 32,
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
              <div style={{ fontSize: 11, color: 'var(--t3)' }}>
                {gym.weeks === 0 ? 'no weeks yet' : `over ${gym.weeks} ${gym.weeks === 1 ? 'week' : 'weeks'} so far`}
              </div>
            </span>
            <span>
              <strong style={{ color: 'var(--teal-t)', fontSize: 14 }}>{gym.lifts}</strong> lifts
            </span>
            <span>
              <strong style={{ color: 'var(--blue-t)', fontSize: 14 }}>{gym.runs}</strong> runs
            </span>
          </div>
        </div>

        {/* Help button */}
        <button
          onClick={() => window.open(`https://claude.ai/new?q=${encodeURIComponent(`Help me plan my ${monthName} ${currentYear} month. Walk me through setting my monthly intention, goals for each life area broken down into subtasks, and key dates.`)}`, '_blank')}
          style={{
            fontSize: 13,
            color: 'var(--t2)',
            background: 'none',
            border: '0.5px solid var(--b1)',
            borderRadius: 'var(--r)',
            padding: '8px 16px',
            cursor: 'pointer',
            display: 'inline-flex',
            alignItems: 'center',
            gap: 6,
            fontFamily: 'var(--font)',
          }}
        >
          <i className="ti ti-wand" style={{ fontSize: 14 }} />
          Help me plan this month ↗
        </button>
      </div>

      <AddMonthlyGoalModal
        open={showAddGoal}
        onClose={() => setShowAddGoal(false)}
        onSave={handleAddMonthlyGoal}
      />
      <PullYearGoalsModal
        open={showPullYear}
        onClose={() => setShowPullYear(false)}
        yearGoals={yearGoals}
        onConfirm={handlePullYearGoals}
      />
    </>
  )
}
