import { useState } from 'react'
import { AREAS } from './constants/areaMeta'

export default function AddGoalModal({ open, onClose, onSave }) {
  const [area, setArea] = useState('Health')
  const [goalText, setGoalText] = useState('')
  const [milestonesText, setMilestonesText] = useState('')

  if (!open) return null

  function handleSave() {
    if (!goalText.trim()) return
    const milestones = milestonesText
      .split('\n')
      .map(s => s.trim())
      .filter(Boolean)
    onSave({ area, goalText: goalText.trim(), milestones })
    setArea('Health')
    setGoalText('')
    setMilestonesText('')
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
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
          <span style={{ fontWeight: 600, fontSize: 15 }}>Add goal</span>
          <button
            onClick={onClose}
            style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--t2)', fontSize: 18, lineHeight: 1 }}
          >
            <i className="ti ti-x" />
          </button>
        </div>

        <label style={{ fontSize: 12, fontWeight: 600, color: 'var(--t2)', display: 'block', marginBottom: 6, textTransform: 'uppercase', letterSpacing: '0.4px' }}>
          Life area
        </label>
        <select
          value={area}
          onChange={e => setArea(e.target.value)}
          style={{ ...inputStyle, marginBottom: 12 }}
        >
          {AREAS.map(a => <option key={a} value={a}>{a}</option>)}
        </select>

        <label style={{ fontSize: 12, fontWeight: 600, color: 'var(--t2)', display: 'block', marginBottom: 6, textTransform: 'uppercase', letterSpacing: '0.4px' }}>
          Goal
        </label>
        <input
          type="text"
          value={goalText}
          onChange={e => setGoalText(e.target.value)}
          placeholder="e.g. Run a 5K by September"
          style={{ ...inputStyle, marginBottom: 12 }}
        />

        <label style={{ fontSize: 12, fontWeight: 600, color: 'var(--t2)', display: 'block', marginBottom: 6, textTransform: 'uppercase', letterSpacing: '0.4px' }}>
          Milestones <span style={{ fontWeight: 400, textTransform: 'none', letterSpacing: 0 }}>(one per line)</span>
        </label>
        <textarea
          value={milestonesText}
          onChange={e => setMilestonesText(e.target.value)}
          rows={4}
          placeholder={'Sign up for a race\nRun 3x/week for 4 weeks\nComplete a 5K'}
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
