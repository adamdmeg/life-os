import { useState } from 'react'
import { useAuth } from './AuthContext'
import Login from './Login'
import YearPage from './YearPage'
import MonthPage from './MonthPage'
import SprintPage from './SprintPage'
import RetroPage from './RetroPage'
import MonthReflectionPage from './MonthReflectionPage'

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

  // Nav-tab navigation always means "go to the current period", so reset any drilled-into
  // month/sprint. Drill-downs (handleMonthClick/handleSprintClick) set specifics instead.
  function handleNavigate(target) {
    if (target === 'month') setActiveMonthNumber(new Date().getMonth() + 1)
    else if (target === 'sprint' || target === 'retro') setActiveSprintId(null)
    setPage(target)
  }

  if (page === 'retro') return <RetroPage sprintId={activeSprintId} onNavigate={handleNavigate} />
  if (page === 'sprint') return <SprintPage sprintId={activeSprintId} onNavigate={handleNavigate} onNavigateMonth={handleMonthClick} />
  if (page === 'month') {
    // Ended months (any month before the current one, this year) show the read-only
    // reflection view instead of the editable planning page.
    const monthEnded = activeMonthNumber < (new Date().getMonth() + 1)
    return monthEnded
      ? <MonthReflectionPage monthNumber={activeMonthNumber} onNavigate={handleNavigate} onSprintClick={handleSprintClick} />
      : <MonthPage monthNumber={activeMonthNumber} onNavigate={handleNavigate} onSprintClick={handleSprintClick} />
  }
  return <YearPage onNavigate={handleNavigate} onMonthClick={handleMonthClick} />
}
