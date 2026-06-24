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

// Workout consistency across a set of sprints. Each sprint's gym_plan holds two weeks
// of seven days; only 'lift' and 'run' days count as workouts (rest and blank days are
// ignored). Weeks counted = 2 per sprint, so avgPerWeek = workouts / weeks.
//
// Pass `asOf` (a Date) to get a *running* average for an in-progress month: only weeks
// that have fully ended count toward both the workout tally and the week denominator. A
// still-in-progress week is excluded entirely, so the average never dips mid-week as
// planned-but-not-yet-done days sit empty. Omit `asOf` (completed months) to count every
// planned week. avgPerWeek is null when no weeks count, so the UI can show "—".
export function gymConsistency(sprints, asOf = null) {
  let lifts = 0, runs = 0, weeks = 0
  for (const sp of sprints || []) {
    const plan = sp.gym_plan || {}
    for (const [weekKey, offset] of [['week1', 0], ['week2', 7]]) {
      if (asOf && sp.start_date) {
        // The week spans days offset..offset+6; it has fully ended once asOf reaches the
        // following day (offset+7 at midnight).
        const weekEnd = new Date(sp.start_date + 'T00:00:00')
        weekEnd.setDate(weekEnd.getDate() + offset + 7)
        if (asOf < weekEnd) continue // week hasn't fully ended yet
      }
      weeks += 1
      for (const v of Object.values(plan[weekKey] || {})) {
        if (v === 'lift') lifts += 1
        else if (v === 'run') runs += 1
      }
    }
  }
  const workouts = lifts + runs
  return {
    lifts,
    runs,
    workouts,
    weeks,
    avgPerWeek: weeks > 0 ? Math.round((workouts / weeks) * 10) / 10 : null,
  }
}
