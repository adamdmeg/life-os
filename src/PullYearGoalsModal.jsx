import { useState } from 'react'
import { AREA_META } from './constants/areaMeta'

// Pull a yearly goal into the month as a whole monthly-goal card (linked via goal_id),
// choosing which of the goal's *incomplete* milestones come along as the card's subtasks.
export default function PullYearGoalsModal({ open, onClose, yearGoals, onConfirm }) {
  const [selectedGoals, setSelectedGoals] = useState(() => new Set())
  const [selectedMiles, setSelectedMiles] = useState(() => new Set())

  if (!open) return null

  function reset() {
    setSelectedGoals(new Set())
    setSelectedMiles(new Set())
  }

  function toggleGoal(goal) {
    const wasSelected = selectedGoals.has(goal.id)
    setSelectedGoals(prev => {
      const next = new Set(prev)
      if (wasSelected) next.delete(goal.id)
      else next.add(goal.id)
      return next
    })
    if (wasSelected) {
      // Deselecting the goal also drops its milestone selections.
      const mileIds = (goal.milestones || []).map(m => m.id)
      setSelectedMiles(prev => {
        const next = new Set(prev)
        mileIds.forEach(id => next.delete(id))
        return next
      })
    }
  }

  function toggleMile(goal, mileId) {
    const willSelect = !selectedMiles.has(mileId)
    setSelectedMiles(prev => {
      const next = new Set(prev)
      if (next.has(mileId)) next.delete(mileId)
      else next.add(mileId)
      return next
    })
    // Selecting a milestone implies selecting its goal.
    if (willSelect) setSelectedGoals(prev => new Set(prev).add(goal.id))
  }

  function handleConfirm() {
    const payload = yearGoals
      .filter(g => selectedGoals.has(g.id))
      .map(g => ({
        goalId: g.id,
        area: g.area,
        goalText: g.goal_text,
        milestones: (g.milestones || [])
          .filter(m => !m.done && selectedMiles.has(m.id))
          .map(m => ({ id: m.id, text: m.text })),
      }))
    onConfirm(payload)
    reset()
  }

  function handleClose() {
    reset()
    onClose()
  }

  return (
    <div
      onClick={handleClose}
      style={{
        position: 'fixed',
        inset: 0,
        background: 'rgba(0,0,0,0.3)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 200,
      }}
    >
      <div
        onClick={e => e.stopPropagation()}
        style={{
          background: 'var(--bg)',
          borderRadius: 'var(--rl)',
          padding: 20,
          width: '90%',
          maxWidth: 460,
          maxHeight: '80vh',
          overflowY: 'auto',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
          <span style={{ fontWeight: 600, fontSize: 15 }}>Pull from yearly goals</span>
          <button
            onClick={handleClose}
            style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--t2)', fontSize: 18, lineHeight: 1 }}
          >
            <i className="ti ti-x" />
          </button>
        </div>

        <p style={{ fontSize: 13, color: 'var(--t2)', marginBottom: 12 }}>
          Pick a yearly goal to work on this month, then choose which of its remaining milestones
          to bring in as subtasks.
        </p>

        {yearGoals.length === 0 ? (
          <p style={{ fontSize: 13, color: 'var(--t3)', padding: '8px 0' }}>No yearly goals yet.</p>
        ) : (
          yearGoals.map(goal => {
            const m = AREA_META[goal.area] || AREA_META.Health
            const goalSelected = selectedGoals.has(goal.id)
            const incomplete = (goal.milestones || []).filter(mi => !mi.done)
            return (
              <div key={goal.id} style={{ borderBottom: '0.5px solid var(--b1)', padding: '10px 0' }}>
                {/* Goal header (selectable) */}
                <label style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer' }}>
                  <input
                    type="checkbox"
                    checked={goalSelected}
                    onChange={() => toggleGoal(goal)}
                    style={{ width: 15, height: 15, cursor: 'pointer', accentColor: '#1D9E75', flexShrink: 0 }}
                  />
                  <div style={{ width: 9, height: 9, borderRadius: '50%', background: m.color, flexShrink: 0 }} />
                  <span style={{ flex: 1, fontSize: 13, fontWeight: 600, color: 'var(--t1)' }}>{goal.goal_text}</span>
                  <span style={{
                    fontSize: 11,
                    fontWeight: 600,
                    padding: '2px 8px',
                    borderRadius: 20,
                    background: m.bg,
                    color: m.text,
                    whiteSpace: 'nowrap',
                    flexShrink: 0,
                  }}>
                    {goal.area}
                  </span>
                </label>

                {/* Incomplete milestones (subtasks to pull) */}
                <div style={{ marginLeft: 26, marginTop: 6 }}>
                  {incomplete.length === 0 ? (
                    <p style={{ fontSize: 12, color: 'var(--t3)' }}>
                      No incomplete milestones — pull the title only.
                    </p>
                  ) : (
                    incomplete.map(mi => (
                      <label key={mi.id} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '3px 0', cursor: 'pointer' }}>
                        <input
                          type="checkbox"
                          checked={selectedMiles.has(mi.id)}
                          onChange={() => toggleMile(goal, mi.id)}
                          style={{ width: 14, height: 14, cursor: 'pointer', accentColor: '#1D9E75', flexShrink: 0 }}
                        />
                        <span style={{ fontSize: 13, color: 'var(--t2)' }}>{mi.text}</span>
                      </label>
                    ))
                  )}
                </div>
              </div>
            )
          })
        )}

        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, marginTop: 16 }}>
          <button
            onClick={handleClose}
            style={{
              fontSize: 14,
              padding: '8px 16px',
              background: 'none',
              border: '0.5px solid var(--b2)',
              borderRadius: 'var(--r)',
              cursor: 'pointer',
              fontFamily: 'var(--font)',
              color: 'var(--t1)',
            }}
          >
            Cancel
          </button>
          <button
            onClick={handleConfirm}
            disabled={selectedGoals.size === 0}
            style={{
              fontSize: 14,
              padding: '8px 16px',
              background: selectedGoals.size === 0 ? 'var(--b2)' : 'var(--t1)',
              color: 'white',
              border: 'none',
              borderRadius: 'var(--r)',
              cursor: selectedGoals.size === 0 ? 'default' : 'pointer',
              fontFamily: 'var(--font)',
            }}
          >
            Add to month
          </button>
        </div>
      </div>
    </div>
  )
}
