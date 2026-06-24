import { useState } from 'react'
import { supabase } from './supabaseClient'

export default function Login() {
  const [isSignUp, setIsSignUp] = useState(false)
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [fullName, setFullName] = useState('')
  const [error, setError] = useState(null)
  const [message, setMessage] = useState(null)
  const [busy, setBusy] = useState(false)

  async function handleSubmit() {
    setError(null)
    setMessage(null)
    setBusy(true)

    if (isSignUp) {
      const { error } = await supabase.auth.signUp({
        email,
        password,
        options: { data: { full_name: fullName } }, // lands in raw_user_meta_data
      })
      if (error) setError(error.message)
      else setMessage('Check your email to confirm your account.')
    } else {
      const { error } = await supabase.auth.signInWithPassword({ email, password })
      if (error) setError(error.message)
    }
    setBusy(false)
  }

  async function handleGoogle() {
    setError(null)
    const { error } = await supabase.auth.signInWithOAuth({ provider: 'google' })
    if (error) setError(error.message)
  }

  return (
    <div style={{ maxWidth: 360, margin: '8vh auto', padding: '0 1.5rem' }}>
      <h1 style={{ fontSize: 22, fontWeight: 500, marginBottom: 4 }}>
        {isSignUp ? 'Create your account' : 'Welcome back'}
      </h1>
      <p style={{ color: 'var(--t2)', fontSize: 14, marginBottom: 24 }}>
        {isSignUp ? 'Start planning your year.' : 'Sign in to Life OS.'}
      </p>

      {isSignUp && (
        <input
          placeholder="Full name"
          value={fullName}
          onChange={(e) => setFullName(e.target.value)}
          style={inputStyle}
        />
      )}
      <input
        type="email"
        placeholder="Email"
        value={email}
        onChange={(e) => setEmail(e.target.value)}
        style={inputStyle}
      />
      <input
        type="password"
        placeholder="Password"
        value={password}
        onChange={(e) => setPassword(e.target.value)}
        onKeyDown={(e) => e.key === 'Enter' && handleSubmit()}
        style={inputStyle}
      />

      {error && <p style={{ color: '#E24B4A', fontSize: 13, marginTop: 8 }}>{error}</p>}
      {message && <p style={{ color: 'var(--teal-t)', fontSize: 13, marginTop: 8 }}>{message}</p>}

      <button onClick={handleSubmit} disabled={busy} style={primaryBtn}>
        {busy ? 'Working…' : isSignUp ? 'Sign up' : 'Sign in'}
      </button>

      <button onClick={handleGoogle} style={secondaryBtn}>
        Continue with Google
      </button>

      <p style={{ fontSize: 13, color: 'var(--t2)', marginTop: 20, textAlign: 'center' }}>
        {isSignUp ? 'Already have an account?' : "Don't have an account?"}{' '}
        <span
          onClick={() => { setIsSignUp(!isSignUp); setError(null); setMessage(null) }}
          style={{ color: 'var(--teal-t)', cursor: 'pointer', fontWeight: 500 }}
        >
          {isSignUp ? 'Sign in' : 'Sign up'}
        </span>
      </p>
    </div>
  )
}

const inputStyle = {
  width: '100%', fontSize: 14, padding: '10px 12px', marginBottom: 10,
  border: '0.5px solid var(--b1)', borderRadius: 'var(--r)',
  fontFamily: 'var(--font)', outline: 'none',
}
const primaryBtn = {
  width: '100%', fontSize: 14, padding: '10px', marginTop: 6,
  background: 'var(--t1)', color: '#fff', border: 'none',
  borderRadius: 'var(--r)', cursor: 'pointer',
}
const secondaryBtn = {
  width: '100%', fontSize: 14, padding: '10px', marginTop: 8,
  background: 'none', color: 'var(--t1)', border: '0.5px solid var(--b2)',
  borderRadius: 'var(--r)', cursor: 'pointer',
}