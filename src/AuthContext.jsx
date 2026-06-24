import { createContext, useContext, useEffect, useState } from 'react'
import { supabase } from './supabaseClient'
import { seedUserData } from './seedUserData'

const AuthContext = createContext()

async function maybeSeedUser(userId) {
  const year = new Date().getFullYear()
  const { data } = await supabase
    .from('years')
    .select('id')
    .eq('user_id', userId)
    .eq('year', year)
    .maybeSingle()
  if (!data) {
    await seedUserData(userId, year)
  }
}

export function AuthProvider({ children }) {
  const [session, setSession] = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session)
      setLoading(false)
    })

    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (event, session) => {
        setSession(session)
        if (event === 'SIGNED_IN' && session?.user) {
          await maybeSeedUser(session.user.id)
        }
      }
    )

    return () => subscription.unsubscribe()
  }, [])

  return (
    <AuthContext.Provider value={{ session, user: session?.user ?? null, loading }}>
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() { return useContext(AuthContext) }