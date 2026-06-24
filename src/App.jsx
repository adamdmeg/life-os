import { useState } from 'react'
import { useAuth } from './AuthContext'
import Login from './Login'
import YearPage from './YearPage'
import MonthPage from './MonthPage'
import SprintPage from './SprintPage'

export default function App() {
  const { user, loading } = useAuth()
  const [page, setPage] = useState('year')
  const [activeMonthNumber, setActiveMonthNumber] = useState(new Date().getMonth() + 1)
  const [activeSprintId, setActiveSprintId] = useState(null)

  if (loading) return <div style={{ padding: '2rem', color: 'var(--t2)' }}>Loading…</div>
  if (!user) return <Login />

  function handleMonthClick(monthNumber) {
    setActiveMonthNumber(monthNumber)
    setPage('month')
  }

  function handleSprintClick(sprintId) {
    setActiveSprintId(sprintId)
    setPage('sprint')
  }

  if (page === 'sprint') return <SprintPage sprintId={activeSprintId} onNavigate={setPage} />
  if (page === 'month') return <MonthPage monthNumber={activeMonthNumber} onNavigate={setPage} onSprintClick={handleSprintClick} />
  return <YearPage onNavigate={setPage} onMonthClick={handleMonthClick} />
}
