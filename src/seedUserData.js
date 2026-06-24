import { supabase } from './supabaseClient'

const MONTH_NAMES = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
]
const MONTH_ABBR = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']

function pad(n) {
  return String(n).padStart(2, '0')
}

function toDateStr(d) {
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`
}

function addDays(dateStr, days) {
  const d = new Date(dateStr + 'T00:00:00')
  d.setDate(d.getDate() + days)
  return toDateStr(d)
}

// First Monday on or after Jan 1 of the given year
function firstMondayOfYear(year) {
  const jan1 = new Date(`${year}-01-01T00:00:00`)
  const dow = jan1.getDay() // 0=Sun, 1=Mon, ..., 6=Sat
  jan1.setDate(jan1.getDate() + (1 - dow + 7) % 7)
  return toDateStr(jan1)
}

function sprintName(number, startStr, endStr) {
  const s = new Date(startStr + 'T00:00:00')
  const e = new Date(endStr + 'T00:00:00')
  const sm = MONTH_ABBR[s.getMonth()]
  const em = MONTH_ABBR[e.getMonth()]
  if (sm === em) return `Sprint ${number} · ${sm} ${s.getDate()}–${e.getDate()}`
  return `Sprint ${number} · ${sm} ${s.getDate()}–${em} ${e.getDate()}`
}

export async function seedUserData(userId, year = new Date().getFullYear()) {
  // 1. Insert year
  const { data: yearRow, error: yearErr } = await supabase
    .from('years')
    .insert({ user_id: userId, year })
    .select('id')
    .single()
  if (yearErr) throw yearErr
  const yearId = yearRow.id

  // 2. Insert 12 months
  const { data: monthRows, error: monthErr } = await supabase
    .from('months')
    .insert(
      MONTH_NAMES.map((name, i) => ({
        year_id: yearId,
        user_id: userId,
        month_number: i + 1,
        month_name: name,
      }))
    )
    .select('id, month_number')
  if (monthErr) throw monthErr

  monthRows.sort((a, b) => a.month_number - b.month_number)
  const monthByNumber = Object.fromEntries(monthRows.map(m => [m.month_number, m]))

  // 3. Build 26 consecutive Mon–Sun sprints starting from the first Monday of the year.
  //    Some months end up with 3 sprints (e.g. March and August in 2026) because
  //    a Monday can fall on the 30th or 31st of a month.
  let startDate = firstMondayOfYear(year)
  const sprintInMonthCount = {}
  const sprintsToInsert = []

  for (let i = 0; i < 26; i++) {
    const endDate = addDays(startDate, 13)   // always a Sunday
    const midDate = addDays(startDate, 6)    // Sunday of week 1 (day 7)
    const sprintNumber = i + 1

    const monthNum = new Date(startDate + 'T00:00:00').getMonth() + 1
    sprintInMonthCount[monthNum] = (sprintInMonthCount[monthNum] || 0) + 1

    sprintsToInsert.push({
      month_id: monthByNumber[monthNum].id,
      year_id: yearId,
      user_id: userId,
      sprint_number: sprintNumber,
      sprint_number_in_month: sprintInMonthCount[monthNum],
      name: sprintName(sprintNumber, startDate, endDate),
      start_date: startDate,
      end_date: endDate,
      mid_sprint_date: midDate,
    })

    startDate = addDays(startDate, 14)
  }

  const { error: sprintInsertErr } = await supabase
    .from('sprints')
    .insert(sprintsToInsert)
  if (sprintInsertErr) throw sprintInsertErr

  // 4. Fetch sprints back (ordered) to get their UUIDs
  const { data: sprintRows, error: sprintFetchErr } = await supabase
    .from('sprints')
    .select('id, month_id, mid_sprint_date, end_date')
    .eq('year_id', yearId)
    .order('sprint_number')
  if (sprintFetchErr) throw sprintFetchErr

  // 5. Insert 2 auto key_dates per sprint (52 total).
  //    Assign each key_date to the month of its actual date so it shows up in the
  //    right month's view. Sprint 26's retro falls Jan 3 next year — fall back to
  //    the sprint's own month (December) since no next-year row exists.
  const keyDates = sprintRows.flatMap(s => {
    const resolveMonth = (dateStr) => {
      const d = new Date(dateStr + 'T00:00:00')
      if (d.getFullYear() !== year) return s.month_id
      return monthByNumber[d.getMonth() + 1].id
    }
    return [
      {
        user_id: userId,
        month_id: resolveMonth(s.mid_sprint_date),
        sprint_id: s.id,
        date: s.mid_sprint_date,
        event_name: 'Mid-sprint check-in',
        tag: 'auto',
        is_auto: true,
      },
      {
        user_id: userId,
        month_id: resolveMonth(s.end_date),
        sprint_id: s.id,
        date: s.end_date,
        event_name: 'Sprint retro',
        tag: 'auto',
        is_auto: true,
      },
    ]
  })

  const { error: kdErr } = await supabase.from('key_dates').insert(keyDates)
  if (kdErr) throw kdErr
}
