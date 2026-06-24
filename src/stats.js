// Shared stat helpers — one source of truth for how goals, milestones, subtasks, and tasks
// are counted across the Year, Month, Sprint, and reflection pages.

// % of a goal's items done. Year goals fall back to the manually-set `progress` field when
// they have no milestones.
export function calcGoalProgress(goal) {
  const miles = goal.milestones || []
  if (miles.length === 0) return goal.progress ?? 0
  return Math.round((miles.filter(m => m.done).length / miles.length) * 100)
}

// done / total / pct for any array of completable items (subtasks, milestones, tasks with a
// `done` boolean). pct is 0 when there are no items.
export function itemStats(items) {
  const arr = items || []
  const total = arr.length
  const done = arr.filter(i => i.done).length
  return { done, total, pct: total ? Math.round((done / total) * 100) : 0 }
}

// Roll an array of goal completion percentages into headline tile numbers.
// completed = fully done (100%); inProgress = started but not finished.
export function goalRollup(pcts) {
  return {
    completed: pcts.filter(p => p >= 100).length,
    inProgress: pcts.filter(p => p > 0 && p < 100).length,
    total: pcts.length,
  }
}
