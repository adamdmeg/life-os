import { useState, useEffect } from 'react'
import { supabase } from './supabaseClient'
import { useAuth } from './AuthContext'
import { AREA_META } from './constants/areaMeta'
import Nav from './Nav'
import GymPlan from './GymPlan'
import AddTaskModal from './AddTaskModal'
import PullSubtasksModal from './PullSubtasksModal'

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

// Sort within a kanban column: due-date tasks first (ascending), then undated tasks.
function sortTasks(list) {
  return [...list].sort((a, b) => {
    if (a.due_date && !b.due_date) return -1
    if (!a.due_date && b.due_date) return 1
    if (a.due_date && b.due_date) return a.due_date.localeCompare(b.due_date)
    return (a.sort_order ?? 0) - (b.sort_order ?? 0)
  })
}

const COLUMNS = [
  { key: 'todo', label: 'To do' },
  { key: 'in_progress', label: 'In progress' },
  { key: 'done', label: 'Done' },
]

export default function SprintPage({ sprintId, onNavigate }) {
  const { user } = useAuth()
  const currentYear = new Date().getFullYear()

  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [sprintRow, setSprintRow] = useState(null)
  const [tasks, setTasks] = useState([])
  const [keyDates, setKeyDates] = useState([])
  const [monthlyGoals, setMonthlyGoals] = useState([])
  const [months, setMonths] = useState([])
  const [goalsText, setGoalsText] = useState('')
  const [midNotesText, setMidNotesText] = useState('')
  const [showAddTask, setShowAddTask] = useState(false)
  const [showPull, setShowPull] = useState(false)
  const [draggedTaskId, setDraggedTaskId] = useState(null)
  const [dragOverCol, setDragOverCol] = useState(null)
  const [editingTaskId, setEditingTaskId] = useState(null)
  const [editTaskText, setEditTaskText] = useState('')

  // Appointment add-form state
  const [newDate, setNewDate] = useState('')
  const [newEvent, setNewEvent] = useState('')

  useEffect(() => {
    if (!user?.id) return
    let cancelled = false

    async function load() {
      setLoading(true)
      setError(null)
      try {
        // Resolve which sprint to show.
        let sprint
        if (sprintId) {
          const { data, error: e } = await supabase
            .from('sprints')
            .select('id, sprint_number, sprint_number_in_month, name, start_date, end_date, mid_sprint_date, goals, gym_plan, gym_plan_notes, mid_sprint_notes, status, month_id, year_id')
            .eq('id', sprintId)
            .eq('user_id', user.id)
            .single()
          if (e) throw e
          sprint = data
        } else {
          // No specific sprint: pick the date-active one for the current year,
          // falling back to the nearest upcoming sprint, then the most recent.
          const { data: yr, error: yrErr } = await supabase
            .from('years')
            .select('id')
            .eq('user_id', user.id)
            .eq('year', currentYear)
            .single()
          if (yrErr) throw yrErr

          const { data: allSprints, error: spErr } = await supabase
            .from('sprints')
            .select('id, sprint_number, sprint_number_in_month, name, start_date, end_date, mid_sprint_date, goals, gym_plan, gym_plan_notes, mid_sprint_notes, status, month_id, year_id')
            .eq('year_id', yr.id)
            .eq('user_id', user.id)
            .order('sprint_number', { ascending: true })
          if (spErr) throw spErr

          const today = new Date()
          today.setHours(0, 0, 0, 0)
          const t = today.getTime()
          sprint =
            allSprints.find(s => {
              const start = new Date(s.start_date + 'T00:00:00').getTime()
              const end = new Date(s.end_date + 'T23:59:59').getTime()
              return start <= t && t <= end
            }) ||
            allSprints.find(s => new Date(s.start_date + 'T00:00:00').getTime() > t) ||
            allSprints[allSprints.length - 1]
        }

        if (!sprint) throw new Error('No sprint found')

        const [tasksRes, keyDatesRes, monthlyGoalsRes, monthsRes] = await Promise.all([
          supabase
            .from('tasks')
            .select('id, text, area, status, priority, due_date, notes, sort_order, goal_id, subtask_source_id')
            .eq('sprint_id', sprint.id)
            .eq('user_id', user.id)
            .order('sort_order', { ascending: true }),
          // Fetch by date range (not sprint_id) so month-level appointments that fall
          // within the sprint window sync onto this page alongside the auto + sprint dates.
          supabase
            .from('key_dates')
            .select('id, date, event_name, tag, is_auto')
            .gte('date', sprint.start_date)
            .lte('date', sprint.end_date)
            .eq('user_id', user.id)
            .order('date', { ascending: true }),
          supabase
            .from('monthly_goals')
            .select('id, area, monthly_goal_text, subtasks(id, text, done)')
            .eq('month_id', sprint.month_id)
            .eq('user_id', user.id),
          supabase
            .from('months')
            .select('id, month_number')
            .eq('year_id', sprint.year_id)
            .eq('user_id', user.id),
        ])

        if (tasksRes.error) throw tasksRes.error
        if (keyDatesRes.error) throw keyDatesRes.error
        if (monthlyGoalsRes.error) throw monthlyGoalsRes.error
        if (monthsRes.error) throw monthsRes.error

        if (cancelled) return

        setSprintRow(sprint)
        setGoalsText(sprint.goals || '')
        setMidNotesText(sprint.mid_sprint_notes || '')
        setTasks(tasksRes.data || [])
        setKeyDates(keyDatesRes.data || [])
        setMonthlyGoals(monthlyGoalsRes.data || [])
        setMonths(monthsRes.data || [])
      } catch (err) {
        if (!cancelled) setError(err.message)
      } finally {
        if (!cancelled) setLoading(false)
      }
    }

    load()
    return () => { cancelled = true }
  }, [user?.id, sprintId]) // eslint-disable-line react-hooks/exhaustive-deps

  // ── Mutation handlers ──────────────────────────────────────────────

  async function handleGoalsBlur() {
    if (!sprintRow || goalsText === (sprintRow.goals || '')) return
    await supabase.from('sprints').update({ goals: goalsText }).eq('id', sprintRow.id)
    setSprintRow(prev => ({ ...prev, goals: goalsText }))
  }

  async function handleMidNotesBlur() {
    if (!sprintRow || midNotesText === (sprintRow.mid_sprint_notes || '')) return
    await supabase.from('sprints').update({ mid_sprint_notes: midNotesText }).eq('id', sprintRow.id)
    setSprintRow(prev => ({ ...prev, mid_sprint_notes: midNotesText }))
  }

  async function handleGymToggle(weekKey, dayKey) {
    const states = ['', 'lift', 'run', 'rest']
    const plan = sprintRow.gym_plan || { week1: {}, week2: {} }
    const cur = (plan[weekKey] && plan[weekKey][dayKey]) || ''
    const next = states[(states.indexOf(cur) + 1) % states.length]
    const newPlan = {
      week1: { ...(plan.week1 || {}) },
      week2: { ...(plan.week2 || {}) },
    }
    newPlan[weekKey][dayKey] = next
    setSprintRow(prev => ({ ...prev, gym_plan: newPlan }))
    await supabase.from('sprints').update({ gym_plan: newPlan }).eq('id', sprintRow.id)
  }

  async function handleGymNotesBlur(text) {
    if (text === (sprintRow.gym_plan_notes || '')) return
    await supabase.from('sprints').update({ gym_plan_notes: text }).eq('id', sprintRow.id)
    setSprintRow(prev => ({ ...prev, gym_plan_notes: text }))
  }

  // Shared status setter for both click-to-advance and drag-and-drop. Completion propagates
  // up the chain it was pulled through: task → source monthly subtask (so Month stats reflect
  // it) → that subtask's source yearly milestone → recalc the yearly goal's progress (so Year
  // stats reflect it). Tasks/subtasks without a source link don't propagate.
  async function applyTaskStatus(taskId, newStatus) {
    const task = tasks.find(t => t.id === taskId)
    if (!task || task.status === newStatus) return
    const done = newStatus === 'done'
    setTasks(prev => prev.map(t => t.id === taskId ? { ...t, status: newStatus } : t))
    await supabase.from('tasks').update({ status: newStatus }).eq('id', taskId)

    if (!task.subtask_source_id) return
    const { data: sub } = await supabase
      .from('subtasks')
      .update({ done })
      .eq('id', task.subtask_source_id)
      .select('milestone_source_id')
      .single()

    if (!sub?.milestone_source_id) return
    const { data: mile } = await supabase
      .from('milestones')
      .update({ done })
      .eq('id', sub.milestone_source_id)
      .select('goal_id')
      .single()

    if (!mile?.goal_id) return
    const { data: allMiles } = await supabase.from('milestones').select('done').eq('goal_id', mile.goal_id)
    if (!allMiles) return
    const total = allMiles.length
    const doneCount = allMiles.filter(m => m.done).length
    const pct = total > 0 ? Math.round((doneCount / total) * 100) : 0
    await supabase.from('goals').update({ progress: pct }).eq('id', mile.goal_id)
  }

  function handleAdvanceTask(taskId) {
    const task = tasks.find(t => t.id === taskId)
    if (!task || task.status === 'done') return
    const next = task.status === 'todo' ? 'in_progress' : 'done'
    applyTaskStatus(taskId, next)
  }

  // Drag-and-drop: move a task to any column (also allows moving backward).
  function moveTask(taskId, newStatus) {
    applyTaskStatus(taskId, newStatus)
  }

  async function handleDeleteTask(taskId) {
    setTasks(prev => prev.filter(t => t.id !== taskId))
    await supabase.from('tasks').delete().eq('id', taskId)
  }

  // Edit a task's text. Only random sprint tasks (no subtask_source_id) are editable here;
  // pulled tasks are read-only and edited at the level they came from.
  async function handleEditTask(taskId, newText) {
    setTasks(prev => prev.map(t => t.id === taskId ? { ...t, text: newText } : t))
    await supabase.from('tasks').update({ text: newText }).eq('id', taskId)
  }

  function commitEditTask(task) {
    const v = editTaskText.trim()
    if (v && v !== task.text) handleEditTask(task.id, v)
    setEditingTaskId(null)
    setEditTaskText('')
  }

  async function handleAddTask({ text, area, due_date }) {
    const { data: task, error } = await supabase
      .from('tasks')
      .insert({
        sprint_id: sprintRow.id,
        user_id: user.id,
        text,
        area,
        status: 'todo',
        due_date,
        sort_order: tasks.length,
      })
      .select('id, text, area, status, priority, due_date, notes, sort_order, goal_id, subtask_source_id')
      .single()
    if (error) { console.error(error); return }
    setTasks(prev => [...prev, task])
    setShowAddTask(false)
  }

  async function handlePullSubtasks(chosen) {
    if (chosen.length === 0) { setShowPull(false); return }
    const { data, error } = await supabase
      .from('tasks')
      .insert(chosen.map((s, i) => ({
        sprint_id: sprintRow.id,
        user_id: user.id,
        text: s.text,
        area: s.area,
        status: 'todo',
        subtask_source_id: s.id,
        sort_order: tasks.length + i,
      })))
      .select('id, text, area, status, priority, due_date, notes, sort_order, goal_id, subtask_source_id')
    if (error) { console.error(error); return }
    setTasks(prev => [...prev, ...(data || [])])
    setShowPull(false)
  }

  // Assign a new sprint date to the month it actually falls in (a sprint can span two
  // months), so it lands on the correct month's calendar — falling back to the sprint's month.
  function resolveMonthId(dateStr) {
    const monthNum = new Date(dateStr + 'T00:00:00').getMonth() + 1
    const row = months.find(m => m.month_number === monthNum)
    return row ? row.id : sprintRow.month_id
  }

  async function handleAddSprintDate() {
    if (!newDate || !newEvent.trim()) return
    const { data: kd, error } = await supabase
      .from('key_dates')
      .insert({
        user_id: user.id,
        month_id: resolveMonthId(newDate),
        sprint_id: sprintRow.id,
        date: newDate,
        event_name: newEvent.trim(),
        tag: 'Sprint',
        is_auto: false,
      })
      .select('id, date, event_name, tag, is_auto')
      .single()
    if (error) { console.error(error); return }
    setKeyDates(prev => [...prev, kd].sort((a, b) => a.date.localeCompare(b.date)))
    setNewDate('')
    setNewEvent('')
  }

  // ── Render: loading / error ────────────────────────────────────────

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

  // ── Derived values ─────────────────────────────────────────────────

  const today = new Date()
  today.setHours(0, 0, 0, 0)
  const start = new Date(sprintRow.start_date + 'T00:00:00')
  const year = start.getFullYear()
  const monthName = MONTH_NAMES[start.getMonth()]
  const title = sprintRow.name || `Sprint ${sprintRow.sprint_number} · ${formatSprintRange(sprintRow.start_date, sprintRow.end_date)}`

  const totalTasks = tasks.length
  const doneTasks = tasks.filter(t => t.status === 'done').length
  const completionPct = totalTasks > 0 ? Math.round((doneTasks / totalTasks) * 100) : 0
  const daysRemaining = daysLeft(sprintRow.end_date)
  const daysElapsedRaw = Math.floor((today - start) / 86400000)
  const dayOfSprint = Math.min(14, Math.max(1, daysElapsedRaw + 1))
  const daysElapsed = Math.min(14, Math.max(0, daysElapsedRaw))
  const expectedPct = (daysElapsed / 14) * 100
  const onTrack = completionPct >= expectedPct
  const started = today >= start

  const existingSourceIds = new Set(tasks.map(t => t.subtask_source_id).filter(Boolean))

  // ── Render helpers ─────────────────────────────────────────────────

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

  function renderTaskCard(task) {
    const m = task.area ? AREA_META[task.area] : null
    const isDone = task.status === 'done'
    const overdue = task.due_date && new Date(task.due_date + 'T00:00:00') < today && !isDone
    return (
      <div
        key={task.id}
        draggable={editingTaskId !== task.id}
        onDragStart={e => {
          setDraggedTaskId(task.id)
          e.dataTransfer.effectAllowed = 'move'
          e.dataTransfer.setData('text/plain', task.id)
        }}
        onDragEnd={() => { setDraggedTaskId(null); setDragOverCol(null) }}
        onClick={(isDone || editingTaskId === task.id) ? undefined : () => handleAdvanceTask(task.id)}
        style={{
          background: 'var(--bg)',
          border: '0.5px solid var(--b1)',
          borderRadius: 'var(--r)',
          padding: '10px 12px',
          marginBottom: 8,
          fontSize: 13,
          cursor: isDone ? 'grab' : 'pointer',
          opacity: draggedTaskId === task.id ? 0.4 : (isDone ? 0.55 : 1),
        }}
      >
        <div style={{ display: 'flex', alignItems: 'flex-start', gap: 6 }}>
          {editingTaskId === task.id ? (
            <input
              autoFocus
              value={editTaskText}
              onClick={e => e.stopPropagation()}
              onChange={e => setEditTaskText(e.target.value)}
              onKeyDown={e => {
                e.stopPropagation()
                if (e.key === 'Enter') commitEditTask(task)
                if (e.key === 'Escape') { setEditingTaskId(null); setEditTaskText('') }
              }}
              onBlur={() => commitEditTask(task)}
              style={{
                flex: 1,
                fontSize: 13,
                padding: '3px 6px',
                border: '0.5px solid var(--b2)',
                borderRadius: 'var(--r)',
                fontFamily: 'var(--font)',
                outline: 'none',
                color: 'var(--t1)',
                background: 'var(--bg)',
              }}
            />
          ) : (
            <span style={{ flex: 1, color: 'var(--t1)' }}>{task.text}</span>
          )}
          {!task.subtask_source_id && editingTaskId !== task.id && (
            <button
              onClick={e => { e.stopPropagation(); setEditingTaskId(task.id); setEditTaskText(task.text) }}
              onMouseDown={e => e.stopPropagation()}
              title="Edit task"
              style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--t3)', fontSize: 13, padding: 0, lineHeight: 1, flexShrink: 0, display: 'flex', alignItems: 'center' }}
            >
              <i className="ti ti-pencil" />
            </button>
          )}
          {editingTaskId !== task.id && (
            <button
              onClick={e => { e.stopPropagation(); handleDeleteTask(task.id) }}
              onMouseDown={e => e.stopPropagation()}
              title="Delete task"
              style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--t3)', fontSize: 13, padding: 0, lineHeight: 1, flexShrink: 0, display: 'flex', alignItems: 'center' }}
            >
              <i className="ti ti-trash" />
            </button>
          )}
        </div>
        {task.due_date && !isDone && (
          <div style={{ fontSize: 11, fontWeight: 600, marginTop: 4, color: overdue ? '#E24B4A' : 'var(--teal)' }}>
            {overdue ? 'Overdue: ' : 'Due: '}{formatDate(task.due_date)}
          </div>
        )}
        {m && (
          <div style={{ marginTop: 6 }}>
            <span style={{
              fontSize: 10,
              fontWeight: 600,
              padding: '1px 6px',
              borderRadius: 20,
              background: m.bg,
              color: m.text,
            }}>
              {task.area}
            </span>
          </div>
        )}
      </div>
    )
  }

  const inputStyle = {
    fontSize: 12,
    padding: '6px 8px',
    border: '0.5px solid var(--b1)',
    borderRadius: 'var(--r)',
    fontFamily: 'var(--font)',
    outline: 'none',
    background: 'var(--bg)',
    color: 'var(--t1)',
  }

  // ── Render ─────────────────────────────────────────────────────────

  return (
    <>
      <Nav activePage="sprint" onNavigate={onNavigate} />

      <div style={{ padding: '1.5rem', maxWidth: 800, margin: '0 auto' }}>
        {/* Eyebrow + title */}
        <div style={{ fontSize: 11, textTransform: 'uppercase', letterSpacing: 1, color: 'var(--t2)', marginBottom: 4 }}>
          Life OS · {year} · {monthName} · Sprint
        </div>
        <div style={{ fontSize: 28, fontWeight: 700, marginBottom: 16 }}>
          {title}
        </div>

        {/* Meta pills */}
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 20 }}>
          <span style={{ fontSize: 12, color: 'var(--t2)', background: 'var(--bg2)', borderRadius: 20, padding: '4px 12px', display: 'flex', alignItems: 'center', gap: 6 }}>
            <i className="ti ti-calendar" style={{ fontSize: 13 }} />
            {formatSprintRange(sprintRow.start_date, sprintRow.end_date)}
          </span>
          <span style={{ fontSize: 12, color: 'var(--t2)', background: 'var(--bg2)', borderRadius: 20, padding: '4px 12px', display: 'flex', alignItems: 'center', gap: 6 }}>
            <i className="ti ti-clock" style={{ fontSize: 13 }} />
            {started ? `Day ${dayOfSprint} of 14` : `Starts ${formatDate(sprintRow.start_date)}`}
          </span>
          {started && (
            <span style={{
              fontSize: 12,
              borderRadius: 20,
              padding: '4px 12px',
              display: 'flex',
              alignItems: 'center',
              gap: 6,
              background: onTrack ? 'var(--teal-bg)' : 'var(--bg2)',
              color: onTrack ? 'var(--teal-t)' : 'var(--t2)',
            }}>
              <i className="ti ti-trending-up" style={{ fontSize: 13 }} />
              {onTrack ? 'On track' : 'Behind'}
            </span>
          )}
        </div>

        {/* Sprint goals */}
        <div style={cardStyle}>
          <div style={cardTitleStyle}>
            <i className="ti ti-flag" style={{ fontSize: 15 }} />
            Sprint goals
          </div>
          <textarea
            value={goalsText}
            onChange={e => setGoalsText(e.target.value)}
            onBlur={handleGoalsBlur}
            placeholder="What does winning this sprint look like? Write 2–3 outcomes you're committing to."
            style={{
              width: '100%',
              border: '0.5px solid var(--b1)',
              borderRadius: 'var(--r)',
              padding: '10px 12px',
              fontSize: 13,
              fontFamily: 'var(--font)',
              color: 'var(--t1)',
              background: 'var(--bg)',
              resize: 'vertical',
              minHeight: 110,
              outline: 'none',
              lineHeight: 1.6,
              boxSizing: 'border-box',
            }}
          />
          <div style={{ height: 5, background: 'var(--bg2)', borderRadius: 3, marginTop: 12, overflow: 'hidden' }}>
            <div style={{ height: '100%', width: `${completionPct}%`, background: 'var(--teal)', borderRadius: 3, transition: 'width 0.2s' }} />
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11, color: 'var(--t3)', marginTop: 6 }}>
            <span>{doneTasks} of {totalTasks} tasks complete</span>
            <span>{daysRemaining} day{daysRemaining === 1 ? '' : 's'} remaining</span>
          </div>
        </div>

        {/* Appointments + Gym */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 12 }}>
          {/* Appointments */}
          <div style={{ ...cardStyle, marginBottom: 0 }}>
            <div style={cardTitleStyle}>
              <i className="ti ti-calendar-event" style={{ fontSize: 15 }} />
              Appointments
            </div>
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
            <div style={{ display: 'flex', gap: 6, marginTop: 10, flexWrap: 'wrap' }}>
              <input
                type="date"
                value={newDate}
                onChange={e => setNewDate(e.target.value)}
                style={{ ...inputStyle, maxWidth: 150 }}
              />
              <input
                type="text"
                value={newEvent}
                onChange={e => setNewEvent(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && handleAddSprintDate()}
                placeholder="Event"
                style={{ ...inputStyle, flex: 1, minWidth: 80 }}
              />
              <button
                onClick={handleAddSprintDate}
                style={{ ...inputStyle, cursor: 'pointer', border: '0.5px solid var(--b2)', color: 'var(--t2)', background: 'none', whiteSpace: 'nowrap' }}
              >
                Add
              </button>
            </div>
          </div>

          {/* Gym plan */}
          <div style={{ ...cardStyle, marginBottom: 0 }}>
            <div style={cardTitleStyle}>
              <i className="ti ti-barbell" style={{ fontSize: 15 }} />
              Gym plan
            </div>
            <GymPlan
              gymPlan={sprintRow.gym_plan}
              startDate={sprintRow.start_date}
              onToggle={handleGymToggle}
              notes={sprintRow.gym_plan_notes}
              onNotesBlur={handleGymNotesBlur}
            />
          </div>
        </div>

        {/* Tasks */}
        <div style={cardStyle}>
          <div style={{ ...cardTitleStyle, justifyContent: 'space-between' }}>
            <span style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <i className="ti ti-layout-kanban" style={{ fontSize: 15 }} />
              Tasks
            </span>
            <div style={{ display: 'flex', gap: 8 }}>
              <button
                onClick={() => setShowPull(true)}
                style={{ fontSize: 12, padding: '5px 10px', background: 'none', border: '0.5px solid var(--b2)', borderRadius: 'var(--r)', cursor: 'pointer', color: 'var(--t2)', fontFamily: 'var(--font)', display: 'flex', alignItems: 'center', gap: 4 }}
              >
                <i className="ti ti-download" style={{ fontSize: 12 }} />
                Pull from monthly goals
              </button>
              <button
                onClick={() => setShowAddTask(true)}
                style={{ fontSize: 12, padding: '5px 10px', background: 'none', border: '0.5px solid var(--b2)', borderRadius: 'var(--r)', cursor: 'pointer', color: 'var(--t2)', fontFamily: 'var(--font)', display: 'flex', alignItems: 'center', gap: 4 }}
              >
                <i className="ti ti-plus" style={{ fontSize: 12 }} />
                Add task
              </button>
            </div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 12 }}>
            {COLUMNS.map(col => {
              const colTasks = sortTasks(tasks.filter(t => t.status === col.key))
              const isOver = dragOverCol === col.key
              return (
                <div
                  key={col.key}
                  onDragOver={e => {
                    e.preventDefault()
                    e.dataTransfer.dropEffect = 'move'
                    if (dragOverCol !== col.key) setDragOverCol(col.key)
                  }}
                  onDragLeave={e => {
                    if (!e.currentTarget.contains(e.relatedTarget)) setDragOverCol(null)
                  }}
                  onDrop={e => {
                    e.preventDefault()
                    const id = draggedTaskId || e.dataTransfer.getData('text/plain')
                    if (id) moveTask(id, col.key)
                    setDragOverCol(null)
                    setDraggedTaskId(null)
                  }}
                  style={{
                    background: isOver ? 'var(--teal-bg)' : 'var(--bg2)',
                    borderRadius: 'var(--rl)',
                    padding: 12,
                    minHeight: 80,
                    outline: isOver ? '1.5px dashed var(--teal)' : '1.5px dashed transparent',
                    transition: 'background 0.1s',
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', fontSize: 12, fontWeight: 600, color: 'var(--t2)', marginBottom: 10 }}>
                    {col.label}
                    <span style={{ background: 'var(--bg)', border: '0.5px solid var(--b1)', borderRadius: 20, padding: '1px 7px', fontSize: 11, color: 'var(--t3)' }}>
                      {colTasks.length}
                    </span>
                  </div>
                  {colTasks.map(renderTaskCard)}
                </div>
              )
            })}
          </div>
          <p style={{ fontSize: 11, color: 'var(--t3)', marginTop: 8 }}>
            Drag a card between columns, or click to advance it · Tasks with due dates sort to top
          </p>
        </div>

        {/* Mid-sprint check-in */}
        <div style={cardStyle}>
          <div style={cardTitleStyle}>
            <i className="ti ti-clipboard-check" style={{ fontSize: 15 }} />
            Mid-sprint check-in (day 7)
          </div>
          <textarea
            value={midNotesText}
            onChange={e => setMidNotesText(e.target.value)}
            onBlur={handleMidNotesBlur}
            placeholder="How's it going halfway? What's on track, what needs to shift, anything to drop or add?"
            style={{
              width: '100%',
              border: '0.5px solid var(--b1)',
              borderRadius: 'var(--r)',
              padding: '10px 12px',
              fontSize: 13,
              fontFamily: 'var(--font)',
              color: 'var(--t1)',
              background: 'var(--bg)',
              resize: 'vertical',
              minHeight: 72,
              outline: 'none',
              lineHeight: 1.6,
              boxSizing: 'border-box',
            }}
          />
        </div>

        {/* Help button */}
        <button
          onClick={() => window.open(`https://claude.ai/new?q=${encodeURIComponent(`Help me plan my next 2-week sprint from ${formatDate(sprintRow.start_date)} to ${formatDate(sprintRow.end_date)}. Walk me through setting goals, tasks by life area, appointments, and gym targets.`)}`, '_blank')}
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
            marginTop: 4,
          }}
        >
          <i className="ti ti-wand" style={{ fontSize: 14 }} />
          Help me plan this sprint ↗
        </button>
      </div>

      <AddTaskModal
        open={showAddTask}
        onClose={() => setShowAddTask(false)}
        onSave={handleAddTask}
      />
      <PullSubtasksModal
        open={showPull}
        onClose={() => setShowPull(false)}
        monthlyGoals={monthlyGoals}
        existingSourceIds={existingSourceIds}
        onConfirm={handlePullSubtasks}
      />
    </>
  )
}
