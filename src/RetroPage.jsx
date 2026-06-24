import { useState, useEffect, useRef } from 'react'
import { supabase } from './supabaseClient'
import { useAuth } from './AuthContext'
import Nav from './Nav'

const MONTH_NAMES = ['January','February','March','April','May','June','July','August','September','October','November','December']
const MONTH_ABBR  = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec']

function formatSprintRange(start, end) {
  const s = new Date(start + 'T00:00:00')
  const e = new Date(end + 'T00:00:00')
  const sm = MONTH_ABBR[s.getMonth()]
  const em = MONTH_ABBR[e.getMonth()]
  if (sm === em) return `${sm} ${s.getDate()}–${e.getDate()}`
  return `${sm} ${s.getDate()} – ${em} ${e.getDate()}`
}

// The three reflection prompts, matching the prototype's colored circle icons.
const REFLECTIONS = [
  { key: 'went_well', label: 'What went well', icon: '✓', bg: 'var(--teal-bg)',
    placeholder: 'What are you proud of? What worked? What do you want to keep doing?' },
  { key: 'improve', label: 'What to improve', icon: '△', bg: 'var(--amber-bg)',
    placeholder: 'What got in the way? What would you do differently?' },
  { key: 'carry_forward', label: 'Carry forward', icon: '→', bg: 'var(--purple-bg)',
    placeholder: 'What tasks or habits carry into the next sprint?' },
]

const ENERGY = [
  { key: 'energy_mind', label: 'Mind', hint: 'clarity & focus' },
  { key: 'energy_body', label: 'Body', hint: 'physical energy' },
  { key: 'energy_motivation', label: 'Motivation', hint: 'drive & momentum' },
]

// Guidance so the 1–10 rating isn't arbitrary — shown as a band legend under the dots.
const RATING_BANDS = [
  { range: '1–3', label: 'Off track — little progress, low momentum' },
  { range: '4–6', label: 'Mixed — some wins, some misses' },
  { range: '7–8', label: 'Solid — hit most of what mattered' },
  { range: '9–10', label: 'Exceptional — exceeded the plan' },
]

// 1–5 energy anchors, shared across Mind / Body / Motivation.
const ENERGY_ANCHORS = ['Depleted', 'Low', 'Steady', 'Good', 'Energized']

export default function RetroPage({ sprintId, onNavigate }) {
  const { user } = useAuth()
  const currentYear = new Date().getFullYear()

  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [sprintRow, setSprintRow] = useState(null)
  const [nextSprint, setNextSprint] = useState(null)
  const [retroId, setRetroId] = useState(null)

  // Reflection + insight textareas (saved on blur).
  const [wentWell, setWentWell] = useState('')
  const [improve, setImprove] = useState('')
  const [carryForward, setCarryForward] = useState('')
  const [oneInsight, setOneInsight] = useState('')

  // Rating + energy dots (saved on click).
  const [rating, setRating] = useState(null)
  const [energyMind, setEnergyMind] = useState(null)
  const [energyBody, setEnergyBody] = useState(null)
  const [energyMotivation, setEnergyMotivation] = useState(null)

  // Carry-forward push feedback.
  const [pushMsg, setPushMsg] = useState('')

  // Last-persisted text values, so blur only writes when the field actually changed.
  const savedText = useRef({ went_well: '', improve: '', carry_forward: '', one_insight: '' })

  useEffect(() => {
    if (!user?.id) return
    let cancelled = false

    async function load() {
      setLoading(true)
      setError(null)
      try {
        // Resolve which sprint to retro on — same logic as SprintPage so the Retro
        // tab and the Sprint page agree on which sprint is "current".
        const SPRINT_COLS = 'id, sprint_number, name, start_date, end_date, mid_sprint_date, mid_sprint_notes, month_id, year_id'
        let sprint
        if (sprintId) {
          const { data, error: e } = await supabase
            .from('sprints')
            .select(SPRINT_COLS)
            .eq('id', sprintId)
            .eq('user_id', user.id)
            .single()
          if (e) throw e
          sprint = data
        } else {
          const { data: yr, error: yrErr } = await supabase
            .from('years')
            .select('id')
            .eq('user_id', user.id)
            .eq('year', currentYear)
            .single()
          if (yrErr) throw yrErr

          const { data: allSprints, error: spErr } = await supabase
            .from('sprints')
            .select(SPRINT_COLS)
            .eq('year_id', yr.id)
            .eq('user_id', user.id)
            .order('sprint_number', { ascending: true })
          if (spErr) throw spErr

          const today = new Date()
          today.setHours(0, 0, 0, 0)
          const t = today.getTime()
          sprint =
            allSprints.find(s => {
              const start = new Date(s.start_date + 'T00:00:00').getTime()
              const end = new Date(s.end_date + 'T23:59:59').getTime()
              return start <= t && t <= end
            }) ||
            allSprints.find(s => new Date(s.start_date + 'T00:00:00').getTime() > t) ||
            allSprints[allSprints.length - 1]
        }

        if (!sprint) throw new Error('No sprint found')

        const [retroRes, nextRes] = await Promise.all([
          supabase
            .from('retros')
            .select('id, rating, went_well, improve, carry_forward, energy_mind, energy_body, energy_motivation, one_insight')
            .eq('sprint_id', sprint.id)
            .eq('user_id', user.id)
            .maybeSingle(),
          supabase
            .from('sprints')
            .select('id, sprint_number')
            .eq('user_id', user.id)
            .eq('sprint_number', sprint.sprint_number + 1)
            .maybeSingle(),
        ])

        if (retroRes.error) throw retroRes.error
        if (nextRes.error) throw nextRes.error

        if (cancelled) return

        const r = retroRes.data
        setSprintRow(sprint)
        setNextSprint(nextRes.data || null)
        setRetroId(r?.id ?? null)
        setWentWell(r?.went_well || '')
        setImprove(r?.improve || '')
        setCarryForward(r?.carry_forward || '')
        setOneInsight(r?.one_insight || '')
        savedText.current = {
          went_well: r?.went_well || '',
          improve: r?.improve || '',
          carry_forward: r?.carry_forward || '',
          one_insight: r?.one_insight || '',
        }
        setRating(r?.rating ?? null)
        setEnergyMind(r?.energy_mind ?? null)
        setEnergyBody(r?.energy_body ?? null)
        setEnergyMotivation(r?.energy_motivation ?? null)
      } catch (err) {
        if (!cancelled) setError(err.message)
      } finally {
        if (!cancelled) setLoading(false)
      }
    }

    load()
    return () => { cancelled = true }
  }, [user?.id, sprintId]) // eslint-disable-line react-hooks/exhaustive-deps

  // ── Mutations ──────────────────────────────────────────────────────

  // Lazy create-or-update: the retros row is created on first edit and reused after
  // (unique(sprint_id) guarantees one per sprint).
  async function saveRetro(patch) {
    if (!sprintRow) return
    const { data, error: e } = await supabase
      .from('retros')
      .upsert(
        { sprint_id: sprintRow.id, user_id: user.id, id: retroId ?? undefined, ...patch },
        { onConflict: 'sprint_id' }
      )
      .select('id')
      .single()
    if (e) { console.error(e); return }
    if (!retroId && data) setRetroId(data.id)
  }

  function saveTextOnBlur(field, value) {
    if (value === savedText.current[field]) return
    savedText.current[field] = value
    saveRetro({ [field]: value })
  }

  function pickRating(n) {
    setRating(n)
    saveRetro({ rating: n })
  }

  function pickEnergy(field, setter, n) {
    setter(n)
    saveRetro({ [field]: n })
  }

  // Push each non-empty carry-forward line into the next sprint as a todo task.
  // Idempotent: lines already present as tasks in the next sprint are skipped, so
  // re-pushing doesn't duplicate.
  async function handlePushCarryForward() {
    if (!nextSprint) return
    const lines = carryForward
      .split('\n')
      .map(l => l.trim())
      .filter(Boolean)
    if (lines.length === 0) {
      setPushMsg('Nothing to push — add carry-forward items first.')
      return
    }

    const { data: existing, error: exErr } = await supabase
      .from('tasks')
      .select('text, sort_order')
      .eq('sprint_id', nextSprint.id)
      .eq('user_id', user.id)
    if (exErr) { console.error(exErr); setPushMsg('Could not push — try again.'); return }

    const existingTexts = new Set((existing || []).map(t => t.text))
    const toAdd = [...new Set(lines)].filter(l => !existingTexts.has(l))
    if (toAdd.length === 0) {
      setPushMsg('Nothing new to add — already in the next sprint.')
      return
    }

    const baseOrder = (existing || []).length
    const { error: insErr } = await supabase
      .from('tasks')
      .insert(toAdd.map((text, i) => ({
        sprint_id: nextSprint.id,
        user_id: user.id,
        text,
        status: 'todo',
        area: null,
        sort_order: baseOrder + i,
      })))
    if (insErr) { console.error(insErr); setPushMsg('Could not push — try again.'); return }

    setPushMsg(`Added ${toAdd.length} task${toAdd.length === 1 ? '' : 's'} to Sprint ${nextSprint.sprint_number}.`)
  }

  // ── Loading / error ────────────────────────────────────────────────

  if (loading) {
    return (
      <>
        <Nav activePage="retro" onNavigate={onNavigate} />
        <div style={{ padding: '2rem', color: 'var(--t2)', fontSize: 14 }}>Loading…</div>
      </>
    )
  }

  if (error) {
    return (
      <>
        <Nav activePage="retro" onNavigate={onNavigate} />
        <div style={{ padding: '2rem', color: '#E24B4A', fontSize: 14 }}>Error: {error}</div>
      </>
    )
  }

  // ── Derived ────────────────────────────────────────────────────────

  const start = new Date(sprintRow.start_date + 'T00:00:00')
  const year = start.getFullYear()
  const monthName = MONTH_NAMES[start.getMonth()]
  const title = `Sprint ${sprintRow.sprint_number} Retro`

  // The mid-sprint check-in (written on the Sprint page) surfaces here read-only, but only
  // once the mid-sprint day has fully passed.
  const midDate = sprintRow.mid_sprint_date ? new Date(sprintRow.mid_sprint_date + 'T23:59:59') : null
  const showMidCheckin = midDate ? new Date() > midDate : false

  // ── Shared styles ──────────────────────────────────────────────────

  const cardStyle = {
    background: 'var(--bg)',
    border: '0.5px solid var(--b1)',
    borderRadius: 'var(--rl)',
    padding: '14px 16px',
    marginBottom: 12,
  }

  const cardTitleStyle = {
    display: 'flex',
    alignItems: 'center',
    gap: 8,
    fontSize: 14,
    fontWeight: 600,
    marginBottom: 12,
  }

  const pillStyle = {
    fontSize: 12,
    color: 'var(--t2)',
    background: 'var(--bg2)',
    borderRadius: 20,
    padding: '4px 12px',
    display: 'flex',
    alignItems: 'center',
    gap: 6,
  }

  const taStyle = {
    width: '100%',
    border: '0.5px solid var(--b1)',
    borderRadius: 'var(--r)',
    padding: '10px 12px',
    fontSize: 13,
    fontFamily: 'var(--font)',
    color: 'var(--t1)',
    background: 'var(--bg)',
    resize: 'vertical',
    minHeight: 72,
    outline: 'none',
    lineHeight: 1.6,
    boxSizing: 'border-box',
  }

  function dot(active, size, label, onClick) {
    return (
      <div
        key={label}
        onClick={onClick}
        style={{
          width: size,
          height: size,
          borderRadius: '50%',
          border: active ? '0.5px solid var(--teal-t)' : `0.5px solid var(--b${size >= 30 ? 2 : 1})`,
          cursor: 'pointer',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          fontSize: size >= 30 ? 12 : 11,
          fontWeight: 500,
          color: active ? '#fff' : 'var(--t2)',
          background: active ? 'var(--teal)' : 'transparent',
          transition: 'all .1s',
        }}
      >
        {label}
      </div>
    )
  }

  // ── Render ─────────────────────────────────────────────────────────

  return (
    <>
      <Nav activePage="retro" onNavigate={onNavigate} />

      <div style={{ padding: '1.5rem', maxWidth: 800, margin: '0 auto' }}>
        {/* Eyebrow + title */}
        <div style={{ fontSize: 11, textTransform: 'uppercase', letterSpacing: 1, color: 'var(--t2)', marginBottom: 4 }}>
          Life OS · {year} · {monthName} · Retro
        </div>
        <div style={{ fontSize: 28, fontWeight: 700, marginBottom: 16 }}>
          {title}
        </div>

        {/* Meta pills */}
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 20 }}>
          <span style={pillStyle}>
            <i className="ti ti-calendar" style={{ fontSize: 13 }} />
            {formatSprintRange(sprintRow.start_date, sprintRow.end_date)}
          </span>
          <span style={pillStyle}>
            <i className="ti ti-message-circle-2" style={{ fontSize: 13 }} />
            End-of-sprint retro
          </span>
        </div>

        {/* Mid-sprint check-in — read-only, surfaced once the mid-sprint day has passed */}
        {showMidCheckin && (
          <div style={cardStyle}>
            <div style={cardTitleStyle}>
              <i className="ti ti-clipboard-check" style={{ fontSize: 15 }} />
              Mid-sprint check-in (day 7)
            </div>
            {sprintRow.mid_sprint_notes && sprintRow.mid_sprint_notes.trim() ? (
              <div style={{ fontSize: 13, color: 'var(--t1)', lineHeight: 1.6, whiteSpace: 'pre-wrap' }}>
                {sprintRow.mid_sprint_notes}
              </div>
            ) : (
              <div style={{ fontSize: 13, color: 'var(--t3)', fontStyle: 'italic' }}>
                No check-in was written.
              </div>
            )}
          </div>
        )}

        {/* Overall rating */}
        <div style={cardStyle}>
          <div style={cardTitleStyle}>
            <i className="ti ti-chart-bar" style={{ fontSize: 15 }} />
            Overall rating
          </div>
          <p style={{ fontSize: 13, color: 'var(--t2)', marginBottom: 10 }}>
            How would you rate this sprint? (1–10)
          </p>
          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
            {Array.from({ length: 10 }, (_, i) => i + 1).map(n =>
              dot(rating === n, 30, n, () => pickRating(n))
            )}
          </div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '4px 16px', marginTop: 12 }}>
            {RATING_BANDS.map(b => (
              <div key={b.range} style={{ display: 'flex', alignItems: 'baseline', gap: 6, fontSize: 11, color: 'var(--t3)' }}>
                <span style={{ fontWeight: 600, color: 'var(--t2)', minWidth: 28 }}>{b.range}</span>
                <span>{b.label}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Reflection prompts */}
        <div style={cardStyle}>
          {REFLECTIONS.map((r, idx) => {
            const value = r.key === 'went_well' ? wentWell : r.key === 'improve' ? improve : carryForward
            const setValue = r.key === 'went_well' ? setWentWell : r.key === 'improve' ? setImprove : setCarryForward
            return (
              <div key={r.key} style={{ marginBottom: idx === REFLECTIONS.length - 1 ? 0 : '1.25rem' }}>
                <div style={{ fontSize: 13, fontWeight: 500, marginBottom: 6, display: 'flex', alignItems: 'center', gap: 8 }}>
                  <div style={{
                    width: 20,
                    height: 20,
                    borderRadius: '50%',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontSize: 12,
                    flexShrink: 0,
                    background: r.bg,
                  }}>
                    {r.icon}
                  </div>
                  {r.label}
                </div>
                <textarea
                  value={value}
                  onChange={e => setValue(e.target.value)}
                  onBlur={() => saveTextOnBlur(r.key, value)}
                  placeholder={r.placeholder}
                  style={taStyle}
                />
                {r.key === 'carry_forward' && (
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginTop: 8, flexWrap: 'wrap' }}>
                    <button
                      onClick={handlePushCarryForward}
                      disabled={!nextSprint}
                      title={nextSprint ? undefined : 'No next sprint'}
                      style={{
                        fontSize: 12,
                        padding: '5px 10px',
                        background: 'none',
                        border: '0.5px solid var(--b2)',
                        borderRadius: 'var(--r)',
                        cursor: nextSprint ? 'pointer' : 'not-allowed',
                        color: nextSprint ? 'var(--t2)' : 'var(--t3)',
                        opacity: nextSprint ? 1 : 0.6,
                        fontFamily: 'var(--font)',
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: 4,
                      }}
                    >
                      <i className="ti ti-arrow-right" style={{ fontSize: 12 }} />
                      Push to next sprint
                    </button>
                    {pushMsg && <span style={{ fontSize: 12, color: 'var(--t3)' }}>{pushMsg}</span>}
                  </div>
                )}
              </div>
            )
          })}
        </div>

        {/* Energy check */}
        <div style={cardStyle}>
          <div style={cardTitleStyle}>
            <i className="ti ti-heart" style={{ fontSize: 15 }} />
            Energy check
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 12 }}>
            {ENERGY.map(e => {
              const value = e.key === 'energy_mind' ? energyMind : e.key === 'energy_body' ? energyBody : energyMotivation
              const setter = e.key === 'energy_mind' ? setEnergyMind : e.key === 'energy_body' ? setEnergyBody : setEnergyMotivation
              return (
                <div key={e.key}>
                  <div style={{ fontSize: 12, color: 'var(--t2)', marginBottom: 2 }}>{e.label}</div>
                  <div style={{ fontSize: 11, color: 'var(--t3)', marginBottom: 8 }}>{e.hint}</div>
                  <div style={{ display: 'flex', gap: 4 }}>
                    {[1, 2, 3, 4, 5].map(n =>
                      dot(value === n, 24, n, () => pickEnergy(e.key, setter, n))
                    )}
                  </div>
                </div>
              )
            })}
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11, color: 'var(--t3)', marginTop: 12 }}>
            <span>1 · {ENERGY_ANCHORS[0]}</span>
            <span>3 · {ENERGY_ANCHORS[2]}</span>
            <span>5 · {ENERGY_ANCHORS[4]}</span>
          </div>
        </div>

        {/* One insight */}
        <div style={cardStyle}>
          <div style={cardTitleStyle}>
            <i className="ti ti-bulb" style={{ fontSize: 15 }} />
            One insight
          </div>
          <textarea
            value={oneInsight}
            onChange={e => setOneInsight(e.target.value)}
            onBlur={() => saveTextOnBlur('one_insight', oneInsight)}
            placeholder="What's one thing you learned about yourself this sprint?"
            style={{ ...taStyle, minHeight: 52 }}
          />
        </div>

        {/* Help button */}
        <button
          onClick={() => window.open(`https://claude.ai/new?q=${encodeURIComponent(`Guide me through my sprint retrospective for Sprint ${sprintRow.sprint_number}. Ask me reflective questions about what went well, what to improve, and what to carry forward into the next sprint.`)}`, '_blank')}
          style={{
            fontSize: 13,
            color: 'var(--t2)',
            background: 'none',
            border: '0.5px solid var(--b1)',
            borderRadius: 'var(--r)',
            padding: '8px 16px',
            cursor: 'pointer',
            display: 'inline-flex',
            alignItems: 'center',
            gap: 6,
            fontFamily: 'var(--font)',
            marginTop: 4,
          }}
        >
          <i className="ti ti-wand" style={{ fontSize: 14 }} />
          Guide me through my retro ↗
        </button>
      </div>
    </>
  )
}
