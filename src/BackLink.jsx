// Up-navigation link shown at the top of drill-down pages (sprint → its month,
// month → year). Distinct from the nav tabs, which always jump to the current period.
export default function BackLink({ label, onClick }) {
  return (
    <button
      onClick={onClick}
      style={{
        background: 'none',
        border: 'none',
        color: 'var(--t2)',
        fontSize: 13,
        cursor: 'pointer',
        display: 'inline-flex',
        alignItems: 'center',
        gap: 4,
        fontFamily: 'var(--font)',
        padding: '4px 0',
        marginBottom: 8,
      }}
    >
      <i className="ti ti-chevron-left" style={{ fontSize: 16 }} />
      {label}
    </button>
  )
}
