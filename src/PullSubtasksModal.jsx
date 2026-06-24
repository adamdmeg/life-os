import { useState } from 'react'
import { AREA_META } from './constants/areaMeta'

export default function PullSubtasksModal({ open, onClose, monthlyGoals, existingSourceIds, onConfirm }) {
  const [selected, setSelected] = useState(() => new Set())

  if (!open) return null

  // Flatten subtasks across the month's goals, excluding ones already pulled into this
  // sprint and ones already completed.
  const available = []
  ;(monthlyGoals || []).forEach(g => {
    ;(g.subtasks || []).forEach(s => {
      if (!existingSourceIds.has(s.id) && !s.done) {
        available.push({ id: s.id, text: s.text, area: g.area })
      }
    })
  })

  function toggle(id) {
    setSelected(prev => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  function handleConfirm() {
    const chosen = available.filter(s => selected.has(s.id))
    onConfirm(chosen)
    setSelected(new Set())
  }

  function handleClose() {
    setSelected(new Set())
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
          maxWidth: 440,
          maxHeight: '80vh',
          overflowY: 'auto',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
          <span style={{ fontWeight: 600, fontSize: 15 }}>Pull from monthly goals</span>
          <button
            onClick={handleClose}
            style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--t2)', fontSize: 18, lineHeight: 1 }}
          >
            <i className="ti ti-x" />
          </button>
        </div>

        <p style={{ fontSize: 13, color: 'var(--t2)', marginBottom: 12 }}>
          Select subtasks from your monthly goals to add to this sprint:
        </p>

        {available.length === 0 ? (
          <p style={{ fontSize: 13, color: 'var(--t3)', padding: '8px 0' }}>
            All monthly subtasks are already in this sprint.
          </p>
        ) : (
          available.map(s => {
            const m = AREA_META[s.area] || AREA_META.Health
            return (
              <label
                key={s.id}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 8,
                  padding: '7px 0',
                  borderBottom: '0.5px solid var(--b1)',
                  fontSize: 13,
                  cursor: 'pointer',
                }}
              >
                <input
                  type="checkbox"
                  checked={selected.has(s.id)}
                  onChange={() => toggle(s.id)}
                  style={{ width: 15, height: 15, cursor: 'pointer', accentColor: '#1D9E75', flexShrink: 0 }}
                />
                <span style={{ flex: 1, color: 'var(--t1)' }}>{s.text}</span>
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
                  {s.area}
                </span>
              </label>
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
            disabled={selected.size === 0}
            style={{
              fontSize: 14,
              padding: '8px 16px',
              background: selected.size === 0 ? 'var(--b2)' : 'var(--t1)',
              color: 'white',
              border: 'none',
              borderRadius: 'var(--r)',
              cursor: selected.size === 0 ? 'default' : 'pointer',
              fontFamily: 'var(--font)',
            }}
          >
            Add selected tasks
          </button>
        </div>
      </div>
    </div>
  )
}
