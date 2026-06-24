import { supabase } from './supabaseClient'

const TABS = [
  { name: 'year',   icon: 'ti-calendar',         label: 'Year' },
  { name: 'month',  icon: 'ti-calendar-month',   label: 'Month' },
  { name: 'sprint', icon: 'ti-layout-kanban',    label: 'Sprint' },
  { name: 'retro',  icon: 'ti-message-circle-2', label: 'Retro' },
]

export default function Nav({ activePage = 'year', onNavigate }) {
  return (
    <nav style={{
      background: 'var(--bg)',
      borderBottom: '0.5px solid var(--b1)',
      display: 'flex',
      alignItems: 'center',
      padding: '0 1.5rem',
      height: 50,
      position: 'sticky',
      top: 0,
      zIndex: 100,
      gap: 2,
    }}>
      <div style={{ fontWeight: 700, fontSize: 15, display: 'flex', alignItems: 'center', gap: 6, marginRight: 12 }}>
        <i className="ti ti-bolt" />
        Life OS
      </div>

      <div style={{ flex: 1 }} />

      {TABS.map(tab => {
        const isActive = activePage === tab.name
        return (
          <button
            key={tab.name}
            onClick={() => onNavigate?.(tab.name)}
            style={{
              background: 'none',
              border: 'none',
              borderBottom: isActive ? '2px solid var(--t1)' : '2px solid transparent',
              color: isActive ? 'var(--t1)' : 'var(--t2)',
              fontSize: 13,
              padding: '0 10px',
              height: 50,
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: 5,
              fontFamily: 'var(--font)',
            }}
          >
            <i className={`ti ${tab.icon}`} style={{ fontSize: 15 }} />
            {tab.label}
          </button>
        )
      })}

      <button
        onClick={() => supabase.auth.signOut()}
        style={{
          background: 'none',
          border: 'none',
          color: 'var(--t3)',
          fontSize: 12,
          cursor: 'pointer',
          marginLeft: 12,
          fontFamily: 'var(--font)',
        }}
      >
        Sign out
      </button>
    </nav>
  )
}
