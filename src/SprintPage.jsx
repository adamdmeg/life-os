import { useState, useEffect } from 'react'
import { supabase } from './supabaseClient'
import { useAuth } from './AuthContext'
import { AREA_META, AREAS } from './constants/areaMeta'
import Nav from './Nav'
import GymPlan from './GymPlan'
import AddTaskModal from './AddTaskModal'
import PullSubtasksModal from './PullSubtasksModal'
import SprintReflectionPage from './SprintReflectionPage'
import BackLink from './BackLink'
import { itemStats } from './stats'

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

export default function SprintPage({ sprintId, onNavigate, onNavigateMonth }) {
  const { user } = useAuth()
  const currentYear = new Date().getFullYear()

  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [ended, setEnded] = useState(false)
  const [sprintRow, setSprintRow] = useState(null)
  const [tasks, setTasks] = useState([])
  const [sprintGoals, setSprintGoals] = useState([])
  const [keyDates, setKeyDates] = useState([])
  const [monthlyGoals, setMonthlyGoals] = useState([])
  const [months, setMonths] = useState([])
  const [goalsText, setGoalsText] = useState('')
  const [notesText, setNotesText] = useState('')
  const [midNotesText, setMidNotesText] = useState('')
  const [activeTab, setActiveTab] = useState('plan') // 'plan' | 'board'
  const [showAddTask, setShowAddTask] = useState(false)
  const [showPull, setShowPull] = useState(false)
  const [draggedTaskId, setDraggedTaskId] = useState(null)
  const [dragOverCol, setDragOverCol] = useState(null)
  const [editingTaskId, setEditingTaskId] = useState(null)
  const [editTaskText, setEditTaskText] = useState('')
  const [editTaskArea, setEditTaskArea] = useState('')

  // Appointment add-form state
  const [newDate, setNewDate] = useState('')
  const [newEvent, setNewEvent] = useState('')

  // Sprint-goal add-form state
  const [newGoalArea, setNewGoalArea] = useState('')
  const [newGoalText, setNewGoalText] = useState('')

  useEffect(() => {
    if (!user?.id) return
    let cancelled = false

    async function load() {
      setLoading(true)
      setError(null)
      setEnded(false)
      try {
        // Resolve which sprint to show.
        let sprint
        if (sprintId) {
          const { data, error: e } = await supabase
            .from('sprints')
            .select('id, sprint_number, sprint_number_in_month, name, start_date, end_date, mid_sprint_date, goals, notes, gym_plan, gym_plan_notes, mid_sprint_notes, status, month_id, year_id')
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
            .select('id, sprint_number, sprint_number_in_month, name, start_date, end_date, mid_sprint_date, goals, notes, gym_plan, gym_plan_notes, mid_sprint_notes, status, month_id, year_id')
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

        // An ended sprint (strictly past its end date) shows the read-only reflection
        // view instead of the editable kanban — skip the planning fetch entirely.
        const today = new Date()
        today.setHours(0, 0, 0, 0)
        if (new Date(sprint.end_date + 'T23:59:59') < today) {
          if (cancelled) return
          setSprintRow(sprint)
          setEnded(true)
          setLoading(false)
          return
        }

        const [tasksRes, sprintGoalsRes, keyDatesRes, monthlyGoalsRes, monthsRes] = await Promise.all([
          supabase
            .from('tasks')
            .select('id, text, area, status, priority, due_date, notes, sort_order, goal_id, subtask_source_id, sprint_goal_id')
            .eq('sprint_id', sprint.id)
            .eq('user_id', user.id)
            .order('sort_order', { ascending: true }),
          supabase
            .from('sprint_goals')
            .select('id, area, sprint_goal_text, sort_order')
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
            .select('id, area, monthly_goal_text, subtasks(id, text, done, area, due_date)')
            .eq('month_id', sprint.month_id)
            .eq('user_id', user.id),
          supabase
            .from('months')
            .select('id, month_number')
            .eq('year_id', sprint.year_id)
            .eq('user_id', user.id),
        ])

        if (tasksRes.error) throw tasksRes.error
        if (sprintGoalsRes.error) throw sprintGoalsRes.error
        if (keyDatesRes.error) throw keyDatesRes.error
        if (monthlyGoalsRes.error) throw monthlyGoalsRes.error
        if (monthsRes.error) throw monthsRes.error

        if (cancelled) return

        setSprintRow(sprint)
        setGoalsText(sprint.goals || '')
        setNotesText(sprint.notes || '')
        setMidNotesText(sprint.mid_sprint_notes || '')
        setTasks(tasksRes.data || [])
        setSprintGoals(sprintGoalsRes.data || [])
        setKeyDates(keyDatesRes.data || [])
        setMonthlyGoals(monthlyGoalsRes.data || [])
        setMonths(monthsRes.data || [])
        // Open a started sprint straight to the board (you're executing); a not-yet-started
        // sprint opens to Plan so you set it up first.
        setActiveTab(new Date(sprint.start_date + 'T00:00:00') <= today ? 'board' : 'plan')
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

  async function handleNotesBlur() {
    if (!sprintRow || notesText === (sprintRow.notes || '')) return
    await supabase.from('sprints').update({ notes: notesText }).eq('id', sprintRow.id)
    setSprintRow(prev => ({ ...prev, notes: notesText }))
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
    await supabase.from('goals').update({ progress: itemStats(allMiles).pct }).eq('id', mile.goal_id)
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

  // Edit a task's fields (text / area). Only non-pulled tasks (no subtask_source_id) are
  // editable here; pulled tasks are edited at the level they came from. `patch` may contain
  // text and/or area.
  async function handleEditTask(taskId, patch) {
    setTasks(prev => prev.map(t => t.id === taskId ? { ...t, ...patch } : t))
    await supabase.from('tasks').update(patch).eq('id', taskId)
  }

  function startEditTask(task) {
    setEditingTaskId(task.id)
    setEditTaskText(task.text)
    setEditTaskArea(task.area || '')
  }
  function cancelEditTask() {
    setEditingTaskId(null)
    setEditTaskText('')
    setEditTaskArea('')
  }
  function commitEditTask(task) {
    // Area is only editable for standalone tasks (not pulled from a subtask, not filed under
    // a sprint goal); those inherit their area from the goal/subtask they belong to.
    const standalone = !task.subtask_source_id && !task.sprint_goal_id
    const patch = {}
    const v = editTaskText.trim()
    if (v && v !== task.text) patch.text = v
    if (standalone && (editTaskArea || null) !== (task.area || null)) patch.area = editTaskArea || null
    if (Object.keys(patch).length > 0) handleEditTask(task.id, patch)
    cancelEditTask()
  }

  async function handleAddTask({ text, area, due_date, sprint_goal_id }) {
    const { data: task, error } = await supabase
      .from('tasks')
      .insert({
        sprint_id: sprintRow.id,
        user_id: user.id,
        text,
        area,
        status: 'todo',
        due_date,
        sprint_goal_id: sprint_goal_id || null,
        sort_order: tasks.length,
      })
      .select('id, text, area, status, priority, due_date, notes, sort_order, goal_id, subtask_source_id, sprint_goal_id')
      .single()
    if (error) { console.error(error); return }
    setTasks(prev => [...prev, task])
    setShowAddTask(false)
  }

  // ── Sprint-goal handlers ───────────────────────────────────────────

  async function handleAddSprintGoal() {
    if (!newGoalArea || !newGoalText.trim()) return
    const { data: goal, error } = await supabase
      .from('sprint_goals')
      .insert({
        sprint_id: sprintRow.id,
        user_id: user.id,
        area: newGoalArea,
        sprint_goal_text: newGoalText.trim(),
        sort_order: sprintGoals.length,
      })
      .select('id, area, sprint_goal_text, sort_order')
      .single()
    if (error) { console.error(error); return }
    setSprintGoals(prev => [...prev, goal])
    setNewGoalArea('')
    setNewGoalText('')
  }

  async function handleSprintGoalTextBlur(goalId, value) {
    const goal = sprintGoals.find(g => g.id === goalId)
    if (!goal || value === goal.sprint_goal_text) return
    setSprintGoals(prev => prev.map(g => g.id === goalId ? { ...g, sprint_goal_text: value } : g))
    await supabase.from('sprint_goals').update({ sprint_goal_text: value }).eq('id', goalId)
  }

  // Deleting a sprint goal leaves its tasks on the board (FK is ON DELETE SET NULL); clear
  // the link in local task state so their chips disappear without a refetch.
  async function handleDeleteSprintGoal(goalId) {
    setSprintGoals(prev => prev.filter(g => g.id !== goalId))
    setTasks(prev => prev.map(t => t.sprint_goal_id === goalId ? { ...t, sprint_goal_id: null } : t))
    await supabase.from('sprint_goals').delete().eq('id', goalId)
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
        due_date: s.due_date || null,
        status: 'todo',
        subtask_source_id: s.id,
        sort_order: tasks.length + i,
      })))
      .select('id, text, area, status, priority, due_date, notes, sort_order, goal_id, subtask_source_id, sprint_goal_id')
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

  // Ended sprints render the read-only reflection (mid-sprint + retro) instead of the board.
  if (ended) return <SprintReflectionPage sprintRow={sprintRow} onNavigate={onNavigate} onNavigateMonth={onNavigateMonth} />

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

  // Once the sprint hits its midpoint, nudge the user to write the mid-sprint check-in.
  // The nudge clears as soon as the check-in has content (still editable while active).
  const midDate = sprintRow.mid_sprint_date ? new Date(sprintRow.mid_sprint_date + 'T00:00:00') : null
  const checkinDue = started && midDate && today >= midDate && !midNotesText.trim()

  const existingSourceIds = new Set(tasks.map(t => t.subtask_source_id).filter(Boolean))

  // Sprint-goal lookups: a goal's progress is derived from its tasks' completion.
  const sprintGoalById = new Map(sprintGoals.map(g => [g.id, g]))
  function goalProgress(goalId) {
    const gtasks = tasks.filter(t => t.sprint_goal_id === goalId)
    const done = gtasks.filter(t => t.status === 'done').length
    return { done, total: gtasks.length, pct: gtasks.length ? Math.round((done / gtasks.length) * 100) : 0 }
  }

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
        {editingTaskId === task.id ? (
          <div onClick={e => e.stopPropagation()} style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            <input
              autoFocus
              value={editTaskText}
              onChange={e => setEditTaskText(e.target.value)}
              onKeyDown={e => {
                e.stopPropagation()
                if (e.key === 'Enter') commitEditTask(task)
                if (e.key === 'Escape') cancelEditTask()
              }}
              style={{
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
            {!task.subtask_source_id && !task.sprint_goal_id && (
              <select
                value={editTaskArea}
                onChange={e => setEditTaskArea(e.target.value)}
                style={{ fontSize: 12, padding: '4px 6px', border: '0.5px solid var(--b2)', borderRadius: 'var(--r)', fontFamily: 'var(--font)', outline: 'none', color: 'var(--t1)', background: 'var(--bg)' }}
              >
                <option value="">No area</option>
                {AREAS.map(a => <option key={a} value={a}>{a}</option>)}
              </select>
            )}
            <div style={{ display: 'flex', gap: 6 }}>
              <button
                onClick={() => commitEditTask(task)}
                style={{ fontSize: 12, padding: '4px 10px', background: 'var(--t1)', color: 'white', border: 'none', borderRadius: 'var(--r)', cursor: 'pointer', fontFamily: 'var(--font)' }}
              >
                Save
              </button>
              <button
                onClick={cancelEditTask}
                style={{ fontSize: 12, padding: '4px 10px', background: 'none', color: 'var(--t2)', border: '0.5px solid var(--b2)', borderRadius: 'var(--r)', cursor: 'pointer', fontFamily: 'var(--font)' }}
              >
                Cancel
              </button>
            </div>
          </div>
        ) : (
          <div style={{ display: 'flex', alignItems: 'flex-start', gap: 6 }}>
            <span style={{ flex: 1, color: 'var(--t1)' }}>{task.text}</span>
            {!task.subtask_source_id && (
              <button
                onClick={e => { e.stopPropagation(); startEditTask(task) }}
                onMouseDown={e => e.stopPropagation()}
                title="Edit task"
                style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--t3)', fontSize: 13, padding: 0, lineHeight: 1, flexShrink: 0, display: 'flex', alignItems: 'center' }}
              >
                <i className="ti ti-pencil" />
              </button>
            )}
            <button
              onClick={e => { e.stopPropagation(); handleDeleteTask(task.id) }}
              onMouseDown={e => e.stopPropagation()}
              title="Delete task"
              style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--t3)', fontSize: 13, padding: 0, lineHeight: 1, flexShrink: 0, display: 'flex', alignItems: 'center' }}
            >
              <i className="ti ti-trash" />
            </button>
          </div>
        )}
        {task.due_date && !isDone && (
          <div style={{ fontSize: 11, fontWeight: 600, marginTop: 4, color: overdue ? '#E24B4A' : 'var(--teal)' }}>
            {overdue ? 'Overdue: ' : 'Due: '}{formatDate(task.due_date)}
          </div>
        )}
        {(m || task.sprint_goal_id) && (
          <div style={{ marginTop: 6, display: 'flex', flexWrap: 'wrap', gap: 4 }}>
            {m && (
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
            )}
            {task.sprint_goal_id && sprintGoalById.has(task.sprint_goal_id) && (
              <span style={{
                fontSize: 10,
                fontWeight: 600,
                padding: '1px 6px',
                borderRadius: 20,
                background: 'var(--bg2)',
                color: 'var(--t2)',
                display: 'inline-flex',
                alignItems: 'center',
                gap: 3,
                maxWidth: '100%',
              }}>
                <i className="ti ti-flag" style={{ fontSize: 10 }} />
                <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {sprintGoalById.get(task.sprint_goal_id).sprint_goal_text}
                </span>
              </span>
            )}
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
        <BackLink label={monthName} onClick={() => onNavigateMonth?.(start.getMonth() + 1)} />
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
          {checkinDue && (
            <span style={{
              fontSize: 12,
              borderRadius: 20,
              padding: '4px 12px',
              display: 'flex',
              alignItems: 'center',
              gap: 6,
              background: 'var(--amber-bg)',
              color: 'var(--amber-t)',
            }}>
              <i className="ti ti-alert-triangle" style={{ fontSize: 13 }} />
              Mid-sprint check-in due
            </span>
          )}
        </div>

        {/* Plan / Board tabs — keeps the kanban one click away instead of below all the
            planning blocks. Plan holds setup (goals, intention, notes, appointments, gym);
            Board holds the kanban + mid-sprint check-in. */}
        <div style={{ display: 'flex', gap: 4, marginBottom: 16, borderBottom: '0.5px solid var(--b1)' }}>
          {[
            { key: 'plan', label: 'Plan', icon: 'ti-flag' },
            { key: 'board', label: 'Board', icon: 'ti-layout-kanban' },
          ].map(t => {
            const active = activeTab === t.key
            return (
              <button
                key={t.key}
                onClick={() => setActiveTab(t.key)}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 6,
                  background: 'none',
                  border: 'none',
                  cursor: 'pointer',
                  fontFamily: 'var(--font)',
                  fontSize: 14,
                  fontWeight: 600,
                  padding: '8px 14px',
                  marginBottom: -1,
                  color: active ? 'var(--teal-t)' : 'var(--t2)',
                  borderBottom: active ? '2px solid var(--teal)' : '2px solid transparent',
                }}
              >
                <i className={`ti ${t.icon}`} style={{ fontSize: 15 }} />
                {t.label}
                {t.key === 'board' && totalTasks > 0 && (
                  <span style={{
                    fontSize: 11,
                    fontWeight: 600,
                    color: active ? 'var(--teal-t)' : 'var(--t3)',
                    background: active ? 'var(--teal-bg)' : 'var(--bg2)',
                    borderRadius: 20,
                    padding: '1px 7px',
                  }}>
                    {doneTasks}/{totalTasks}
                  </span>
                )}
              </button>
            )
          })}
        </div>

        {activeTab === 'plan' && (
        <>
        {/* Monthly goals peek — read-only reminder of the month's goals so they stay in
            view while planning the sprint. Progress is derived from each goal's subtasks. */}
        {monthlyGoals.length > 0 && (
          <div style={cardStyle}>
            <div style={{ ...cardTitleStyle, justifyContent: 'space-between', marginBottom: 10 }}>
              <span style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <i className="ti ti-calendar-month" style={{ fontSize: 15 }} />
                This month's goals
              </span>
              <button
                onClick={() => onNavigateMonth?.(start.getMonth() + 1)}
                style={{
                  background: 'none',
                  border: 'none',
                  cursor: 'pointer',
                  fontFamily: 'var(--font)',
                  fontSize: 12,
                  color: 'var(--t2)',
                  display: 'flex',
                  alignItems: 'center',
                  gap: 3,
                  padding: 0,
                }}
              >
                View month
                <i className="ti ti-arrow-right" style={{ fontSize: 12 }} />
              </button>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 7 }}>
              {monthlyGoals.map(g => {
                const m = AREA_META[g.area]
                const { done, total } = itemStats(g.subtasks)
                const complete = total > 0 && done === total
                return (
                  <div key={g.id} style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13 }}>
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
                        {g.area}
                      </span>
                    )}
                    <span style={{
                      flex: 1,
                      color: complete ? 'var(--t3)' : 'var(--t1)',
                      textDecoration: complete ? 'line-through' : 'none',
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                      whiteSpace: 'nowrap',
                    }}>
                      {g.monthly_goal_text}
                    </span>
                    <span style={{ fontSize: 11, color: 'var(--t3)', flexShrink: 0, display: 'flex', alignItems: 'center', gap: 4 }}>
                      {complete && <i className="ti ti-circle-check-filled" style={{ fontSize: 13, color: 'var(--teal)' }} />}
                      {total > 0 ? `${done}/${total}` : '—'}
                    </span>
                  </div>
                )
              })}
            </div>
          </div>
        )}

        {/* Intention + Notes, side by side to keep the planning zone compact. */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 12 }}>
        {/* Sprint intention (overall free-text) */}
        <div style={{ ...cardStyle, marginBottom: 0 }}>
          <div style={cardTitleStyle}>
            <i className="ti ti-flag" style={{ fontSize: 15 }} />
            Sprint intention
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

        {/* Notes — open scratchpad for sprint planning thoughts (persists to sprints.notes). */}
        <div style={{ ...cardStyle, marginBottom: 0 }}>
          <div style={cardTitleStyle}>
            <i className="ti ti-notes" style={{ fontSize: 15 }} />
            Notes
          </div>
          <textarea
            value={notesText}
            onChange={e => setNotesText(e.target.value)}
            onBlur={handleNotesBlur}
            placeholder="Anything else on your mind for this sprint — reminders, ideas, blockers…"
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
        </div>
        </div>

        {/* Sprint goals (structured; tasks are filed under these) */}
        <div style={cardStyle}>
          <div style={cardTitleStyle}>
            <i className="ti ti-target" style={{ fontSize: 15 }} />
            Sprint goals
          </div>

          {sprintGoals.length === 0 && (
            <p style={{ fontSize: 13, color: 'var(--t3)', marginBottom: 10 }}>
              No sprint goals yet — add one below, then file tasks under it.
            </p>
          )}

          {sprintGoals.map(goal => {
            const gm = AREA_META[goal.area] || AREA_META.Health
            const { done, total, pct } = goalProgress(goal.id)
            return (
              <div key={goal.id} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '8px 0', borderBottom: '0.5px solid var(--b1)' }}>
                <div style={{ width: 10, height: 10, borderRadius: '50%', background: gm.color, flexShrink: 0 }} />
                <div style={{ flex: 1, minWidth: 0 }}>
                  <input
                    defaultValue={goal.sprint_goal_text}
                    onBlur={e => handleSprintGoalTextBlur(goal.id, e.target.value.trim())}
                    style={{
                      width: '100%',
                      border: 'none',
                      outline: 'none',
                      background: 'transparent',
                      fontSize: 13,
                      fontFamily: 'var(--font)',
                      color: 'var(--t1)',
                      padding: 0,
                      marginBottom: 6,
                    }}
                  />
                  <div style={{ height: 5, background: 'var(--bg2)', borderRadius: 3, overflow: 'hidden' }}>
                    <div style={{ height: '100%', width: `${pct}%`, background: gm.color, borderRadius: 3, transition: 'width 0.2s' }} />
                  </div>
                </div>
                <span style={{ fontSize: 11, color: 'var(--t3)', whiteSpace: 'nowrap', flexShrink: 0 }}>
                  {done}/{total}{total > 0 ? ` (${pct}%)` : ''} done
                </span>
                <button
                  onClick={() => { if (window.confirm('Delete this sprint goal? Its tasks stay on the board, ungrouped.')) handleDeleteSprintGoal(goal.id) }}
                  title="Delete sprint goal"
                  style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--t3)', fontSize: 13, padding: 0, lineHeight: 1, flexShrink: 0, display: 'flex', alignItems: 'center' }}
                >
                  <i className="ti ti-trash" />
                </button>
              </div>
            )
          })}

          {/* Inline add row */}
          <div style={{ display: 'flex', gap: 6, marginTop: 10, flexWrap: 'wrap' }}>
            <select
              value={newGoalArea}
              onChange={e => setNewGoalArea(e.target.value)}
              style={{ ...inputStyle, maxWidth: 130 }}
            >
              <option value="">Area…</option>
              {AREAS.map(a => <option key={a} value={a}>{a}</option>)}
            </select>
            <input
              type="text"
              value={newGoalText}
              onChange={e => setNewGoalText(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && handleAddSprintGoal()}
              placeholder="Sprint goal"
              style={{ ...inputStyle, flex: 1, minWidth: 100 }}
            />
            <button
              onClick={handleAddSprintGoal}
              style={{ ...inputStyle, cursor: 'pointer', border: '0.5px solid var(--b2)', color: 'var(--t2)', background: 'none', whiteSpace: 'nowrap' }}
            >
              Add goal
            </button>
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
        </>
        )}

        {activeTab === 'board' && (
        <>
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
        </>
        )}

        {/* Help + retro buttons */}
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginTop: 4 }}>
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
            }}
          >
            <i className="ti ti-wand" style={{ fontSize: 14 }} />
            Help me plan this sprint ↗
          </button>
          <button
            onClick={() => onNavigate?.('retro')}
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
            <i className="ti ti-message-circle-2" style={{ fontSize: 14 }} />
            Go to retro ↗
          </button>
        </div>
      </div>

      <AddTaskModal
        open={showAddTask}
        onClose={() => setShowAddTask(false)}
        onSave={handleAddTask}
        sprintGoals={sprintGoals}
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
