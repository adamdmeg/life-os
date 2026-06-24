import { useState } from 'react'
import { AREAS } from './constants/areaMeta'

export default function AddMonthlyGoalModal({ open, onClose, onSave }) {
  const [area, setArea] = useState('Health')
  const [goalText, setGoalText] = useState('')
  const [subtasksText, setSubtasksText] = useState('')

  if (!open) return null

  function handleSave() {
    if (!goalText.trim()) return
    // Subtasks added here are always 'monthly'. 'yearly_goal' subtasks come only from the
    // Pull from yearly goals flow, which links them to a real milestone.
    const subtasks = subtasksText
      .split('\n')
      .map(s => s.trim())
      .filter(Boolean)
      .map(text => ({ text, tag: 'monthly' }))
    onSave({ area, goalText: goalText.trim(), subtasks })
    setArea('Health')
    setGoalText('')
    setSubtasksText('')
  }

  const inputStyle = {
    width: '100%',
    fontSize: 14,
    padding: '9px 11px',
    border: '0.5px solid var(--b1)',
    borderRadius: 'var(--r)',
    fontFamily: 'var(--font)',
    outline: 'none',
    boxSizing: 'border-box',
    background: 'var(--bg)',
    color: 'var(--t1)',
  }

  const labelStyle = {
    fontSize: 12,
    fontWeight: 600,
    color: 'var(--t2)',
    display: 'block',
    marginBottom: 6,
    textTransform: 'uppercase',
    letterSpacing: '0.4px',
  }

  return (
    <div
      onClick={onClose}
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
          maxWidth: 440,
          maxHeight: '80vh',
          overflowY: 'auto',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
          <span style={{ fontWeight: 600, fontSize: 15 }}>Add monthly goal</span>
          <button
            onClick={onClose}
            style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--t2)', fontSize: 18, lineHeight: 1 }}
          >
            <i className="ti ti-x" />
          </button>
        </div>

        <label style={labelStyle}>Life area</label>
        <select value={area} onChange={e => setArea(e.target.value)} style={{ ...inputStyle, marginBottom: 12 }}>
          {AREAS.map(a => <option key={a} value={a}>{a}</option>)}
        </select>

        <label style={labelStyle}>Monthly goal <span style={{ fontWeight: 400, textTransform: 'none', letterSpacing: 0 }}>(what specifically this month?)</span></label>
        <input
          type="text"
          value={goalText}
          onChange={e => setGoalText(e.target.value)}
          placeholder="e.g. Gym 12x, increase bench by 5lbs"
          style={{ ...inputStyle, marginBottom: 12 }}
        />

        <label style={labelStyle}>Subtasks <span style={{ fontWeight: 400, textTransform: 'none', letterSpacing: 0 }}>(one per line)</span></label>
        <textarea
          value={subtasksText}
          onChange={e => setSubtasksText(e.target.value)}
          rows={4}
          placeholder={'Gym Mon/Wed/Fri\nIncrease bench by 5lbs\nTrack workouts in app'}
          style={{ ...inputStyle, resize: 'vertical', marginBottom: 16 }}
        />

        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
          <button
            onClick={onClose}
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
            onClick={handleSave}
            style={{
              fontSize: 14,
              padding: '8px 16px',
              background: 'var(--t1)',
              color: 'white',
              border: 'none',
              borderRadius: 'var(--r)',
              cursor: 'pointer',
              fontFamily: 'var(--font)',
            }}
          >
            Add goal
          </button>
        </div>
      </div>
    </div>
  )
}
