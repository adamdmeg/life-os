import { useState, useEffect } from 'react'
import { supabase } from './supabaseClient'
import { useAuth } from './AuthContext'
import Nav from './Nav'
import GoalCard from './GoalCard'
import AddGoalModal from './AddGoalModal'
import MonthGrid from './MonthGrid'
import { AREA_META, AREAS } from './constants/areaMeta'
import { calcGoalProgress, itemStats, goalRollup } from './stats'

const MONTH_ABBR = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec']

export default function YearPage({ onNavigate, onMonthClick }) {
  const { user } = useAuth()
  const currentYear = new Date().getFullYear()
  const currentMonth = new Date().getMonth() + 1

  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [yearRow, setYearRow] = useState(null)
  const [goals, setGoals] = useState([])
  const [months, setMonths] = useState([])
  const [sprints, setSprints] = useState([])
  const [themeText, setThemeText] = useState('')
  const [showAddGoal, setShowAddGoal] = useState(false)
  const [collapsedAreas, setCollapsedAreas] = useState(() => new Set(AREAS))

  function toggleArea(area) {
    setCollapsedAreas(prev => {
      const next = new Set(prev)
      if (next.has(area)) next.delete(area)
      else next.add(area)
      return next
    })
  }

  useEffect(() => {
    if (!user?.id) return
    let cancelled = false

    async function load() {
      setLoading(true)
      setError(null)
      try {
        const { data: yr, error: yrErr } = await supabase
          .from('years')
          .select('id, year, theme')
          .eq('user_id', user.id)
          .eq('year', currentYear)
          .single()
        if (yrErr) throw yrErr

        const [goalsRes, monthsRes, sprintsRes] = await Promise.all([
          supabase
            .from('goals')
            .select('id, area, goal_text, progress, sort_order, milestones(id, text, done, sort_order)')
            .eq('year_id', yr.id)
            .eq('user_id', user.id)
            .order('sort_order', { ascending: true }),
          supabase
            .from('months')
            .select('id, month_number, month_name, intention, status')
            .eq('year_id', yr.id)
            .eq('user_id', user.id)
            .order('month_number', { ascending: true }),
          supabase
            .from('sprints')
            .select('id, status, month_id, sprint_number_in_month, start_date, end_date')
            .eq('year_id', yr.id)
            .eq('user_id', user.id),
        ])

        if (goalsRes.error) throw goalsRes.error
        if (monthsRes.error) throw monthsRes.error
        if (sprintsRes.error) throw sprintsRes.error

        if (cancelled) return

        setYearRow(yr)
        setThemeText(yr.theme || '')
        setGoals((goalsRes.data || []).map(g => ({
          ...g,
          milestones: (g.milestones || []).sort((a, b) => a.sort_order - b.sort_order),
        })))
        setMonths(monthsRes.data || [])
        setSprints(sprintsRes.data || [])
      } catch (err) {
        if (!cancelled) setError(err.message)
      } finally {
        if (!cancelled) setLoading(false)
      }
    }

    load()
    return () => { cancelled = true }
  }, [user?.id]) // eslint-disable-line react-hooks/exhaustive-deps

  // ── Mutation handlers ──────────────────────────────────────────────

  async function handleThemeBlur() {
    if (!yearRow || themeText === (yearRow.theme || '')) return
    await supabase.from('years').update({ theme: themeText }).eq('id', yearRow.id)
    setYearRow(prev => ({ ...prev, theme: themeText }))
  }

  async function handleGoalTextBlur(goalId, value) {
    await supabase.from('goals').update({ goal_text: value }).eq('id', goalId)
  }

  async function handleProgressClick(goalId, pct) {
    setGoals(prev => prev.map(g => g.id === goalId ? { ...g, progress: pct } : g))
    await supabase.from('goals').update({ progress: pct }).eq('id', goalId)
  }

  async function handleMilestoneToggle(goalId, milestoneId, newDone) {
    const goal = goals.find(g => g.id === goalId)
    const updatedMiles = goal.milestones.map(m => m.id === milestoneId ? { ...m, done: newDone } : m)
    const newProgress = calcGoalProgress({ ...goal, milestones: updatedMiles })

    setGoals(prev => prev.map(g =>
      g.id === goalId ? { ...g, milestones: updatedMiles, progress: newProgress } : g
    ))

    await supabase.from('milestones').update({ done: newDone }).eq('id', milestoneId)
    await supabase.from('goals').update({ progress: newProgress }).eq('id', goalId)
  }

  async function handleAddGoal({ area, goalText, milestones }) {
    const { data: goal, error } = await supabase
      .from('goals')
      .insert({
        year_id: yearRow.id,
        user_id: user.id,
        area,
        goal_text: goalText,
        progress: 0,
        sort_order: goals.length,
      })
      .select('id, area, goal_text, progress, sort_order')
      .single()
    if (error) { console.error(error); return }

    let insertedMiles = []
    if (milestones.length > 0) {
      const { data } = await supabase
        .from('milestones')
        .insert(milestones.map((text, i) => ({
          goal_id: goal.id,
          user_id: user.id,
          text,
          done: false,
          sort_order: i,
        })))
        .select('id, text, done, sort_order')
      insertedMiles = data || []
    }

    setGoals(prev => [...prev, { ...goal, milestones: insertedMiles }])
    setShowAddGoal(false)
  }

  // Remove month subtasks pulled from the given milestones, and the sprint tasks pulled
  // from those subtasks. (Pull links are ON DELETE SET NULL, so copies must be cleaned up
  // in the app to honor "delete the original → its lower-level copies go too".)
  async function cascadeMilestoneCopies(milestoneIds) {
    if (!milestoneIds.length) return
    const { data: subs } = await supabase
      .from('subtasks')
      .select('id')
      .in('milestone_source_id', milestoneIds)
    const subIds = (subs || []).map(s => s.id)
    if (subIds.length) {
      await supabase.from('tasks').delete().in('subtask_source_id', subIds)
      await supabase.from('subtasks').delete().in('id', subIds)
    }
  }

  async function handleDeleteGoal(goalId) {
    const goal = goals.find(g => g.id === goalId)
    const mileIds = (goal?.milestones || []).map(m => m.id)
    setGoals(prev => prev.filter(g => g.id !== goalId))

    // Remove subtasks pulled from this goal's milestones (in any card) + their sprint tasks.
    await cascadeMilestoneCopies(mileIds)

    // Remove the monthly-goal cards created by pulling this yearly goal (goal_id link),
    // along with sprint tasks pulled from their subtasks. goal_id is ON DELETE SET NULL,
    // so this must run before the goal is deleted.
    const { data: linkedCards } = await supabase
      .from('monthly_goals')
      .select('id')
      .eq('goal_id', goalId)
      .eq('user_id', user.id)
    const cardIds = (linkedCards || []).map(c => c.id)
    if (cardIds.length) {
      const { data: cardSubs } = await supabase.from('subtasks').select('id').in('monthly_goal_id', cardIds)
      const cardSubIds = (cardSubs || []).map(s => s.id)
      if (cardSubIds.length) await supabase.from('tasks').delete().in('subtask_source_id', cardSubIds)
      await supabase.from('monthly_goals').delete().in('id', cardIds) // subtasks cascade
    }

    await supabase.from('goals').delete().eq('id', goalId) // milestones cascade
  }

  async function handleDeleteMilestone(goalId, milestoneId) {
    const goal = goals.find(g => g.id === goalId)
    const remaining = (goal?.milestones || []).filter(m => m.id !== milestoneId)
    const newProgress = calcGoalProgress({ ...goal, milestones: remaining })

    setGoals(prev => prev.map(g =>
      g.id === goalId ? { ...g, milestones: remaining, progress: newProgress } : g
    ))

    await cascadeMilestoneCopies([milestoneId])
    await supabase.from('milestones').delete().eq('id', milestoneId)
    await supabase.from('goals').update({ progress: newProgress }).eq('id', goalId)
  }

  // Edit a milestone's text and cascade the new text down to the copies pulled from it:
  // month subtasks (milestone_source_id) and the sprint tasks pulled from those subtasks.
  async function handleEditMilestone(goalId, milestoneId, newText) {
    setGoals(prev => prev.map(g =>
      g.id === goalId
        ? { ...g, milestones: g.milestones.map(m => m.id === milestoneId ? { ...m, text: newText } : m) }
        : g
    ))
    await supabase.from('milestones').update({ text: newText }).eq('id', milestoneId)

    const { data: subs } = await supabase
      .from('subtasks')
      .update({ text: newText })
      .eq('milestone_source_id', milestoneId)
      .select('id')
    const subIds = (subs || []).map(s => s.id)
    if (subIds.length) {
      await supabase.from('tasks').update({ text: newText }).in('subtask_source_id', subIds)
    }
  }

  async function handleAddMilestone(goalId, text) {
    const goal = goals.find(g => g.id === goalId)
    const sortOrder = (goal?.milestones || []).length

    const { data: milestone, error } = await supabase
      .from('milestones')
      .insert({ goal_id: goalId, user_id: user.id, text, done: false, sort_order: sortOrder })
      .select('id, text, done, sort_order')
      .single()
    if (error) { console.error(error); return }

    setGoals(prev => prev.map(g =>
      g.id === goalId ? { ...g, milestones: [...(g.milestones || []), milestone] } : g
    ))
  }

  // ── Derived stats ──────────────────────────────────────────────────

  const goalsRollup = goalRollup(goals.map(calcGoalProgress))
  const milestones = itemStats(goals.flatMap(g => g.milestones || []))
  // A sprint is "done" once its end date has passed (the stored status field is unused).
  const now = new Date()
  const sprintsDone = sprints.filter(s => new Date(s.end_date + 'T23:59:59') < now).length
  const yearProgress = Math.round((currentMonth / 12) * 100)
  const monthAbbr = MONTH_ABBR[currentMonth - 1]

  // Group goals by life area so each category can have its own collapsible subheading.
  const goalsByArea = AREAS
    .map(area => ({ area, areaGoals: goals.filter(g => g.area === area) }))
    .filter(group => group.areaGoals.length > 0)

  // ── Render ─────────────────────────────────────────────────────────

  if (loading) {
    return (
      <>
        <Nav activePage="year" onNavigate={onNavigate} />
        <div style={{ padding: '2rem', color: 'var(--t2)', fontSize: 14 }}>Loading…</div>
      </>
    )
  }

  if (error) {
    return (
      <>
        <Nav activePage="year" onNavigate={onNavigate} />
        <div style={{ padding: '2rem', color: '#E24B4A', fontSize: 14 }}>Error: {error}</div>
      </>
    )
  }

  return (
    <>
      <Nav activePage="year" onNavigate={onNavigate} />

      <div style={{ padding: '1.5rem', maxWidth: 800, margin: '0 auto' }}>
        {/* Eyebrow + title */}
        <div style={{ fontSize: 11, textTransform: 'uppercase', letterSpacing: 1, color: 'var(--t2)', marginBottom: 4 }}>
          Life OS · Year
        </div>
        <div style={{ fontSize: 28, fontWeight: 700, marginBottom: 16 }}>
          {currentYear}
        </div>

        {/* Yearly theme */}
        <div style={{ borderLeft: '3px solid var(--teal)', paddingLeft: 12, marginBottom: 24 }}>
          <textarea
            value={themeText}
            onChange={e => setThemeText(e.target.value)}
            onBlur={handleThemeBlur}
            placeholder="What's your theme or intention for this year?"
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

        {/* Stat cards */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 10, marginBottom: 24 }}>
          {[
            { label: 'Goals', value: `${goalsRollup.completed}/${goalsRollup.total}`, sub: `${goalsRollup.inProgress} in progress` },
            { label: 'Milestones done', value: `${milestones.pct}%`, sub: `${milestones.done} of ${milestones.total}` },
            { label: 'Sprints done', value: sprintsDone, sub: 'of 26' },
            { label: 'Year progress', value: `${yearProgress}%`, sub: `${monthAbbr} of 12` },
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
              <div style={{ fontSize: 22, fontWeight: 700, lineHeight: 1 }}>
                {value}
              </div>
              <div style={{ fontSize: 12, color: 'var(--t2)', marginTop: 2 }}>
                {sub}
              </div>
            </div>
          ))}
        </div>

        {/* Goals by area */}
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
        }}>
          <i className="ti ti-target" style={{ fontSize: 15 }} />
          Goals by area
        </div>

        {goals.length === 0 && (
          <p style={{ fontSize: 14, color: 'var(--t2)', marginBottom: 12 }}>
            No goals yet — add your first one below.
          </p>
        )}

        {goalsByArea.map(({ area, areaGoals }) => {
          const meta = AREA_META[area]
          const collapsed = collapsedAreas.has(area)
          return (
            <div key={area} style={{ marginBottom: 14 }}>
              <div
                onClick={() => toggleArea(area)}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 8,
                  cursor: 'pointer',
                  userSelect: 'none',
                  padding: '6px 0',
                }}
              >
                <i
                  className={`ti ${collapsed ? 'ti-chevron-right' : 'ti-chevron-down'}`}
                  style={{ fontSize: 14, color: 'var(--t3)', width: 14 }}
                />
                <div style={{ width: 10, height: 10, borderRadius: '50%', background: meta.color, flexShrink: 0 }} />
                <span style={{ fontWeight: 600, fontSize: 14 }}>{area}</span>
                <span style={{ fontSize: 12, color: 'var(--t3)' }}>
                  · {areaGoals.length} {areaGoals.length === 1 ? 'goal' : 'goals'}
                </span>
              </div>

              {!collapsed && (
                <div style={{ marginLeft: 7, paddingLeft: 14, borderLeft: '0.5px solid var(--b1)' }}>
                  {areaGoals.map(goal => (
                    <GoalCard
                      key={goal.id}
                      goal={goal}
                      showArea={false}
                      onGoalTextBlur={handleGoalTextBlur}
                      onProgressClick={handleProgressClick}
                      onMilestoneToggle={handleMilestoneToggle}
                      onAddMilestone={handleAddMilestone}
                      onDelete={handleDeleteGoal}
                      onDeleteMilestone={handleDeleteMilestone}
                      onEditMilestone={handleEditMilestone}
                    />
                  ))}
                </div>
              )}
            </div>
          )
        })}

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
            marginBottom: 32,
            fontFamily: 'var(--font)',
          }}
        >
          <i className="ti ti-plus" style={{ fontSize: 13 }} />
          Add goal
        </button>

        {/* Months at a glance */}
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
        }}>
          <i className="ti ti-calendar-stats" style={{ fontSize: 15 }} />
          Months at a glance
        </div>

        <MonthGrid months={months} sprints={sprints} year={currentYear} currentMonthNumber={currentMonth} onMonthClick={onMonthClick} />
      </div>

      <AddGoalModal
        open={showAddGoal}
        onClose={() => setShowAddGoal(false)}
        onSave={handleAddGoal}
      />
    </>
  )
}
