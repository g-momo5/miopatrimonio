import { useEffect, useMemo, useState } from 'react'
import type { Session } from '@supabase/supabase-js'
import { isSupabaseConfigured, supabase } from '../lib/supabase'

interface Credentials {
  email: string
  password: string
}

export interface UseAuthResult {
  session: Session | null
  loading: boolean
  error: string | null
  isConfigured: boolean
  signIn: (credentials: Credentials) => Promise<void>
  signUp: (credentials: Credentials) => Promise<void>
  signOut: () => Promise<void>
}

export function useAuth(): UseAuthResult {
  const [session, setSession] = useState<Session | null>(null)
  const [loading, setLoading] = useState(() => Boolean(supabase))
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!supabase) {
      return
    }

    let mounted = true

    supabase.auth
      .getSession()
      .then(({ data, error: sessionError }) => {
        if (!mounted) {
          return
        }

        if (sessionError) {
          setError(sessionError.message)
        }

        setSession(data.session)
      })
      .finally(() => {
        if (mounted) {
          setLoading(false)
        }
      })

    const { data } = supabase.auth.onAuthStateChange((_event, nextSession) => {
      setSession(nextSession)
    })

    return () => {
      mounted = false
      data.subscription.unsubscribe()
    }
  }, [])

  const api = useMemo(
    () => ({
      async signIn({ email, password }: Credentials): Promise<void> {
        if (!supabase) {
          throw new Error('Supabase non configurato')
        }

        const { error: signInError } = await supabase.auth.signInWithPassword({
          email,
          password,
        })

        if (signInError) {
          throw new Error(signInError.message)
        }
      },
      async signUp({ email, password }: Credentials): Promise<void> {
        if (!supabase) {
          throw new Error('Supabase non configurato')
        }

        const { error: signUpError } = await supabase.auth.signUp({
          email,
          password,
        })

        if (signUpError) {
          throw new Error(signUpError.message)
        }
      },
      async signOut(): Promise<void> {
        if (!supabase) {
          throw new Error('Supabase non configurato')
        }

        const { error: signOutError } = await supabase.auth.signOut()

        if (signOutError) {
          throw new Error(signOutError.message)
        }
      },
    }),
    [],
  )

  return {
    session,
    loading,
    error,
    isConfigured: isSupabaseConfigured,
    signIn: api.signIn,
    signUp: api.signUp,
    signOut: api.signOut,
  }
}
