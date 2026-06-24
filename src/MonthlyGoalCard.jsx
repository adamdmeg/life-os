import { useState, useRef, useEffect } from 'react'
import { AREA_META } from './constants/areaMeta'

export default function MonthlyGoalCard({ goal, yearGoal, onGoalTextBlur, onSubtaskToggle, onAddSubtask, onAddSubtaskFromMilestone, onDelete, onDeleteSubtask, onEditSubtask }) {
  const m = AREA_META[goal.area] || AREA_META.Health
  const subtasks = goal.subtasks || []
  const done = subtasks.filter(s => s.done).length
  const total = subtasks.length
  const pct = total > 0 ? Math.round((done / total) * 100) : 0

  // A card created by pulling a yearly goal (goal_id set) can only take subtasks from that
  // goal's milestones — no manual subtasks. A plain monthly goal takes manual subtasks only.
  const isLinked = !!goal.goal_id
  const pulledMileIds = new Set(subtasks.map(s => s.milestone_source_id).filter(Boolean))
  // Only offer milestones that aren't already on the card and aren't already completed.
  const availableMiles = (yearGoal?.milestones || []).filter(mi => !pulledMileIds.has(mi.id) && !mi.done)

  const textRef = useRef(null)
  const [showAdd, setShowAdd] = useState(false)
  const [addText, setAddText] = useState('')
  const [addMileId, setAddMileId] = useState('')
  const [hoveredSub, setHoveredSub] = useState(null)
  const [editingSub, setEditingSub] = useState(null)
  const [editText, setEditText] = useState('')

  function handleAddFromMilestone() {
    const mile = availableMiles.find(mi => mi.id === addMileId)
    if (!mile) return
    onAddSubtaskFromMilestone(goal.id, { id: mile.id, text: mile.text })
    setAddMileId('')
    setShowAdd(false)
  }

  function startEditSub(sub) {
    setEditingSub(sub.id)
    setEditText(sub.text)
  }
  function commitEditSub(sub) {
    const v = editText.trim()
    if (v && v !== sub.text) onEditSubtask(goal.id, sub.id, v)
    setEditingSub(null)
    setEditText('')
  }

  useEffect(() => {
    if (textRef.current) {
      textRef.current.style.height = 'auto'
      textRef.current.style.height = textRef.current.scrollHeight + 'px'
    }
  }, [])

  function handleAddSubtask() {
    if (!addText.trim()) return
    // Manually-added subtasks are always 'monthly'. 'yearly_goal' subtasks come only from
    // the Pull from yearly goals flow (which sets milestone_source_id for real linkage).
    onAddSubtask(goal.id, addText.trim(), 'monthly')
    setAddText('')
    setShowAdd(false)
  }

  const inputStyle = {
    fontSize: 13,
    padding: '5px 8px',
    border: '0.5px solid var(--b1)',
    borderRadius: 'var(--r)',
    fontFamily: 'var(--font)',
    outline: 'none',
    background: 'var(--bg)',
    color: 'var(--t1)',
  }

  return (
    <div style={{
      background: 'var(--bg)',
      border: '0.5px solid var(--b1)',
      borderRadius: 'var(--rl)',
      padding: '14px 16px',
      marginBottom: 10,
    }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10 }}>
        <div style={{ width: 10, height: 10, borderRadius: '50%', background: m.color, flexShrink: 0 }} />
        <span style={{ fontWeight: 600, fontSize: 14 }}>{goal.area}</span>
        <span style={{
          marginLeft: 'auto',
          fontSize: 11,
          fontWeight: 600,
          padding: '2px 8px',
          borderRadius: 20,
          background: m.bg,
          color: m.text,
          whiteSpace: 'nowrap',
        }}>
          {done}/{total} done
        </span>
        {onDelete && (
          <button
            onClick={() => { if (window.confirm('Delete this monthly goal and its subtasks?')) onDelete(goal.id) }}
            title="Delete goal"
            style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--t3)', fontSize: 14, padding: 0, display: 'flex', alignItems: 'center', lineHeight: 1 }}
          >
            <i className="ti ti-trash" />
          </button>
        )}
      </div>

      {/* Yearly goal reference */}
      {yearGoal && (
        <div style={{
          display: 'flex',
          alignItems: 'center',
          gap: 6,
          padding: '5px 8px',
          background: 'var(--bg2)',
          borderRadius: 'var(--r)',
          marginBottom: 8,
          fontSize: 12,
        }}>
          <i className="ti ti-link" style={{ fontSize: 12, color: 'var(--t3)', flexShrink: 0 }} />
          <span style={{ color: 'var(--t3)' }}>Yearly:</span>
          <span style={{ color: 'var(--t2)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            {yearGoal.goal_text}
          </span>
        </div>
      )}

      {/* Monthly goal text — uncontrolled */}
      <textarea
        ref={textRef}
        defaultValue={goal.monthly_goal_text || ''}
        onInput={e => {
          e.target.style.height = 'auto'
          e.target.style.height = e.target.scrollHeight + 'px'
        }}
        onBlur={e => onGoalTextBlur(goal.id, e.target.value)}
        placeholder="What specifically are you working on this month?"
        rows={1}
        style={{
          width: '100%',
          border: 'none',
          outline: 'none',
          resize: 'none',
          fontSize: 14,
          background: 'transparent',
          fontFamily: 'var(--font)',
          color: 'var(--t1)',
          marginBottom: 10,
          boxSizing: 'border-box',
          overflow: 'hidden',
        }}
      />

      {/* Progress bar — read only, driven by subtask completion */}
      <div style={{
        width: '100%',
        height: 6,
        background: 'var(--bg2)',
        borderRadius: 4,
        overflow: 'hidden',
        marginBottom: 4,
      }}>
        <div style={{
          height: '100%',
          width: `${pct}%`,
          background: m.color,
          borderRadius: 4,
          transition: 'width 0.15s',
        }} />
      </div>
      <div style={{ fontSize: 11, color: 'var(--t2)', marginBottom: 10 }}>
        {done} of {total} subtasks · {pct}%
      </div>

      {/* Subtasks */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 6, marginBottom: 8 }}>
        {subtasks.map(sub => (
          <div
            key={sub.id}
            onMouseEnter={() => setHoveredSub(sub.id)}
            onMouseLeave={() => setHoveredSub(h => (h === sub.id ? null : h))}
            style={{ display: 'flex', alignItems: 'center', gap: 8 }}
          >
            <div
              onClick={() => onSubtaskToggle(goal.id, sub.id, !sub.done)}
              style={{
                width: 14,
                height: 14,
                borderRadius: 3,
                border: sub.done ? 'none' : '1.5px solid var(--b2)',
                background: sub.done ? '#1D9E75' : 'transparent',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                flexShrink: 0,
              }}
            >
              {sub.done && <i className="ti ti-check" style={{ fontSize: 10, color: 'white' }} />}
            </div>
            {editingSub === sub.id ? (
              <input
                autoFocus
                value={editText}
                onChange={e => setEditText(e.target.value)}
                onKeyDown={e => {
                  if (e.key === 'Enter') commitEditSub(sub)
                  if (e.key === 'Escape') { setEditingSub(null); setEditText('') }
                }}
                onBlur={() => commitEditSub(sub)}
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
              <span style={{
                fontSize: 13,
                flex: 1,
                textDecoration: sub.done ? 'line-through' : 'none',
                color: sub.done ? 'var(--t3)' : 'var(--t1)',
              }}>
                {sub.text}
              </span>
            )}
            <span style={{
              fontSize: 10,
              color: 'var(--t3)',
              background: 'var(--bg2)',
              border: '0.5px solid var(--b1)',
              borderRadius: 20,
              padding: '1px 6px',
              flexShrink: 0,
            }}>
              {sub.tag === 'yearly_goal' ? 'yearly goal' : sub.tag}
            </span>
            {/* Subtasks pulled from a yearly milestone are read-only here — edit at the year level. */}
            {onEditSubtask && !sub.milestone_source_id && editingSub !== sub.id && (
              <button
                onClick={() => startEditSub(sub)}
                title="Edit subtask"
                style={{
                  background: 'none',
                  border: 'none',
                  cursor: 'pointer',
                  color: 'var(--t3)',
                  fontSize: 13,
                  padding: 0,
                  lineHeight: 1,
                  flexShrink: 0,
                  display: 'flex',
                  alignItems: 'center',
                  visibility: hoveredSub === sub.id ? 'visible' : 'hidden',
                }}
              >
                <i className="ti ti-pencil" />
              </button>
            )}
            {onDeleteSubtask && editingSub !== sub.id && (
              <button
                onClick={() => onDeleteSubtask(goal.id, sub.id)}
                title="Delete subtask"
                style={{
                  background: 'none',
                  border: 'none',
                  cursor: 'pointer',
                  color: 'var(--t3)',
                  fontSize: 13,
                  padding: 0,
                  lineHeight: 1,
                  flexShrink: 0,
                  display: 'flex',
                  alignItems: 'center',
                  visibility: hoveredSub === sub.id ? 'visible' : 'hidden',
                }}
              >
                <i className="ti ti-trash" />
              </button>
            )}
          </div>
        ))}

        {showAdd && (
          isLinked ? (
            availableMiles.length === 0 ? (
              <p style={{ fontSize: 12, color: 'var(--t3)', paddingTop: 4 }}>
                All milestones from the linked yearly goal have been added.
              </p>
            ) : (
              <div style={{ display: 'flex', gap: 6, alignItems: 'center', paddingTop: 4, flexWrap: 'wrap' }}>
                <select
                  autoFocus
                  value={addMileId}
                  onChange={e => setAddMileId(e.target.value)}
                  style={{ ...inputStyle, flex: 1, minWidth: 120 }}
                >
                  <option value="">Select a yearly milestone…</option>
                  {availableMiles.map(mi => (
                    <option key={mi.id} value={mi.id}>{mi.text}</option>
                  ))}
                </select>
                <button
                  onClick={handleAddFromMilestone}
                  style={{
                    fontSize: 12,
                    padding: '5px 10px',
                    background: 'var(--t1)',
                    color: 'white',
                    border: 'none',
                    borderRadius: 'var(--r)',
                    cursor: 'pointer',
                    fontFamily: 'var(--font)',
                  }}
                >
                  Add
                </button>
              </div>
            )
          ) : (
            <div style={{ display: 'flex', gap: 6, alignItems: 'center', paddingTop: 4, flexWrap: 'wrap' }}>
              <input
                autoFocus
                value={addText}
                onChange={e => setAddText(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && handleAddSubtask()}
                placeholder="Add subtask…"
                style={{ ...inputStyle, flex: 1, minWidth: 120 }}
              />
              <button
                onClick={handleAddSubtask}
                style={{
                  fontSize: 12,
                  padding: '5px 10px',
                  background: 'var(--t1)',
                  color: 'white',
                  border: 'none',
                  borderRadius: 'var(--r)',
                  cursor: 'pointer',
                  fontFamily: 'var(--font)',
                }}
              >
                Add
              </button>
            </div>
          )
        )}
      </div>

      {/* Add subtask button */}
      <button
        onClick={() => setShowAdd(v => !v)}
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
        Add subtask
      </button>
    </div>
  )
}
