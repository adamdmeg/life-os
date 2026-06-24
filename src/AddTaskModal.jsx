import { useState } from 'react'
import { AREAS } from './constants/areaMeta'

export default function AddTaskModal({ open, onClose, onSave }) {
  const [text, setText] = useState('')
  const [area, setArea] = useState('')
  const [dueDate, setDueDate] = useState('')

  if (!open) return null

  function handleSave() {
    if (!text.trim()) return
    onSave({ text: text.trim(), area: area || null, due_date: dueDate || null })
    setText('')
    setArea('')
    setDueDate('')
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
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
          <span style={{ fontWeight: 600, fontSize: 15 }}>Add task</span>
          <button
            onClick={onClose}
            style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--t2)', fontSize: 18, lineHeight: 1 }}
          >
            <i className="ti ti-x" />
          </button>
        </div>

        <label style={labelStyle}>Task</label>
        <input
          type="text"
          autoFocus
          value={text}
          onChange={e => setText(e.target.value)}
          onKeyDown={e => e.key === 'Enter' && handleSave()}
          placeholder="e.g. Update resume"
          style={{ ...inputStyle, marginBottom: 12 }}
        />

        <label style={labelStyle}>Life area</label>
        <select value={area} onChange={e => setArea(e.target.value)} style={{ ...inputStyle, marginBottom: 12 }}>
          <option value="">No area</option>
          {AREAS.map(a => <option key={a} value={a}>{a}</option>)}
        </select>

        <label style={labelStyle}>Due date <span style={{ fontWeight: 400, textTransform: 'none', letterSpacing: 0 }}>(optional)</span></label>
        <input
          type="date"
          value={dueDate}
          onChange={e => setDueDate(e.target.value)}
          style={{ ...inputStyle, marginBottom: 16 }}
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
            Add task
          </button>
        </div>
      </div>
    </div>
  )
}
