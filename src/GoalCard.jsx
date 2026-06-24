import { useState, useRef, useEffect } from 'react'
import { AREA_META } from './constants/areaMeta'

function calcGoalProgress(goal) {
  const miles = goal.milestones || []
  if (miles.length === 0) return goal.progress ?? 0
  return Math.round(miles.filter(m => m.done).length / miles.length * 100)
}

export default function GoalCard({ goal, showArea = true, onGoalTextBlur, onProgressClick, onMilestoneToggle, onAddMilestone, onDelete, onDeleteMilestone, onEditMilestone }) {
  const m = AREA_META[goal.area] || AREA_META.Health
  const pct = calcGoalProgress(goal)
  const textRef = useRef(null)
  const [showAdd, setShowAdd] = useState(false)
  const [addText, setAddText] = useState('')
  const [hoveredMile, setHoveredMile] = useState(null)
  const [editingMile, setEditingMile] = useState(null)
  const [editText, setEditText] = useState('')

  function startEditMile(mile) {
    setEditingMile(mile.id)
    setEditText(mile.text)
  }
  function commitEditMile(mile) {
    const v = editText.trim()
    if (v && v !== mile.text) onEditMilestone(goal.id, mile.id, v)
    setEditingMile(null)
    setEditText('')
  }

  // Auto-resize on mount only; onInput handles resizing while typing
  useEffect(() => {
    if (textRef.current) {
      textRef.current.style.height = 'auto'
      textRef.current.style.height = textRef.current.scrollHeight + 'px'
    }
  }, [])

  function handleProgressClick(e) {
    const rect = e.currentTarget.getBoundingClientRect()
    const pct = Math.round(((e.clientX - rect.left) / rect.width) * 100)
    onProgressClick(goal.id, Math.max(0, Math.min(100, pct)))
  }

  function handleAddMilestone() {
    if (!addText.trim()) return
    onAddMilestone(goal.id, addText.trim())
    setAddText('')
    setShowAdd(false)
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
        {showArea && <div style={{ width: 10, height: 10, borderRadius: '50%', background: m.color, flexShrink: 0 }} />}
        {showArea && <span style={{ fontWeight: 600, fontSize: 14 }}>{goal.area}</span>}
        <span style={{ marginLeft: 'auto', fontSize: 14, fontWeight: 600, color: m.color }}>{pct}%</span>
        {onDelete && (
          <button
            onClick={() => { if (window.confirm('Delete this goal and its milestones?')) onDelete(goal.id) }}
            title="Delete goal"
            style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--t3)', fontSize: 14, padding: 0, display: 'flex', alignItems: 'center', lineHeight: 1 }}
          >
            <i className="ti ti-trash" />
          </button>
        )}
      </div>

      {/* Goal text — uncontrolled; onBlur reads current value from DOM */}
      <textarea
        ref={textRef}
        defaultValue={goal.goal_text || ''}
        onInput={e => {
          e.target.style.height = 'auto'
          e.target.style.height = e.target.scrollHeight + 'px'
        }}
        onBlur={e => onGoalTextBlur(goal.id, e.target.value)}
        placeholder="What's your goal?"
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
          marginBottom: 2,
          boxSizing: 'border-box',
          overflow: 'hidden',
        }}
      />

      {/* Progress bar */}
      <div
        onClick={handleProgressClick}
        style={{
          width: '100%',
          height: 8,
          background: 'var(--bg2)',
          borderRadius: 4,
          cursor: 'pointer',
          overflow: 'hidden',
          marginBottom: 6,
        }}
      >
        <div style={{
          height: '100%',
          width: `${pct}%`,
          background: m.color,
          borderRadius: 4,
          transition: 'width 0.15s',
        }} />
      </div>
      <div style={{
        display: 'flex',
        justifyContent: 'space-between',
        fontSize: 11,
        color: 'var(--t2)',
        marginBottom: 12,
      }}>
        <span>0%</span>
        <span>{pct}% complete</span>
        <span>100%</span>
      </div>

      {/* Milestones */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 6, marginBottom: 8 }}>
        {(goal.milestones || []).map(mile => (
          <div
            key={mile.id}
            onMouseEnter={() => setHoveredMile(mile.id)}
            onMouseLeave={() => setHoveredMile(h => (h === mile.id ? null : h))}
            style={{ display: 'flex', alignItems: 'center', gap: 8 }}
          >
            <div
              onClick={() => onMilestoneToggle(goal.id, mile.id, !mile.done)}
              style={{
                width: 14,
                height: 14,
                borderRadius: 3,
                border: mile.done ? 'none' : '1.5px solid var(--b2)',
                background: mile.done ? '#1D9E75' : 'transparent',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                flexShrink: 0,
              }}
            >
              {mile.done && <i className="ti ti-check" style={{ fontSize: 10, color: 'white' }} />}
            </div>
            {editingMile === mile.id ? (
              <input
                autoFocus
                value={editText}
                onChange={e => setEditText(e.target.value)}
                onKeyDown={e => {
                  if (e.key === 'Enter') commitEditMile(mile)
                  if (e.key === 'Escape') { setEditingMile(null); setEditText('') }
                }}
                onBlur={() => commitEditMile(mile)}
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
                textDecoration: mile.done ? 'line-through' : 'none',
                color: mile.done ? 'var(--t3)' : 'var(--t1)',
              }}>
                {mile.text}
              </span>
            )}
            {onEditMilestone && editingMile !== mile.id && (
              <button
                onClick={() => startEditMile(mile)}
                title="Edit milestone"
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
                  visibility: hoveredMile === mile.id ? 'visible' : 'hidden',
                }}
              >
                <i className="ti ti-pencil" />
              </button>
            )}
            {onDeleteMilestone && editingMile !== mile.id && (
              <button
                onClick={() => onDeleteMilestone(goal.id, mile.id)}
                title="Delete milestone"
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
                  visibility: hoveredMile === mile.id ? 'visible' : 'hidden',
                }}
              >
                <i className="ti ti-trash" />
              </button>
            )}
          </div>
        ))}

        {showAdd && (
          <div style={{ display: 'flex', gap: 6, alignItems: 'center', paddingTop: 4 }}>
            <input
              autoFocus
              value={addText}
              onChange={e => setAddText(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && handleAddMilestone()}
              placeholder="Add milestone…"
              style={{
                flex: 1,
                fontSize: 13,
                padding: '5px 8px',
                border: '0.5px solid var(--b1)',
                borderRadius: 'var(--r)',
                fontFamily: 'var(--font)',
                outline: 'none',
              }}
            />
            <button
              onClick={handleAddMilestone}
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
        )}
      </div>

      {/* Add milestone button */}
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
        Add milestone
      </button>
    </div>
  )
}
