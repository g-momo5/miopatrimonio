import { useState } from 'react'
import type { FormEvent } from 'react'

interface AuthScreenProps {
  onSignIn: (input: { email: string; password: string }) => Promise<void>
  onSignUp: (input: { email: string; password: string }) => Promise<void>
}

export function AuthScreen({ onSignIn, onSignUp }: AuthScreenProps) {
  const [mode, setMode] = useState<'signin' | 'signup'>('signin')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [busy, setBusy] = useState(false)
  const [message, setMessage] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  async function handleSubmit(event: FormEvent<HTMLFormElement>): Promise<void> {
    event.preventDefault()
    setBusy(true)
    setError(null)
    setMessage(null)

    try {
      if (mode === 'signin') {
        await onSignIn({ email, password })
      } else {
        await onSignUp({ email, password })
        setMessage('Registrazione inviata. Se richiesto, conferma la tua email.')
      }
    } catch (submitError) {
      setError(
        submitError instanceof Error
          ? submitError.message
          : 'Errore autenticazione',
      )
    } finally {
      setBusy(false)
    }
  }

  return (
    <main className="auth-shell">
      <section className="auth-card">
        <h1>Mio Patrimonio</h1>
        <p className="muted">PWA personale per monitorare conti e investimenti.</p>

        <div className="auth-switch">
          <button
            type="button"
            className={mode === 'signin' ? 'active' : ''}
            onClick={() => setMode('signin')}
          >
            Accedi
          </button>
          <button
            type="button"
            className={mode === 'signup' ? 'active' : ''}
            onClick={() => setMode('signup')}
          >
            Registrati
          </button>
        </div>

        <form className="stack" onSubmit={handleSubmit}>
          <label className="stack">
            Email
            <input
              type="email"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              autoComplete="email"
              required
            />
          </label>
          <label className="stack">
            Password
            <input
              type="password"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              autoComplete={mode === 'signin' ? 'current-password' : 'new-password'}
              minLength={8}
              required
            />
          </label>
          <button type="submit" disabled={busy}>
            {busy ? 'Attendi...' : mode === 'signin' ? 'Entra' : 'Crea account'}
          </button>
        </form>

        {message ? <p className="success">{message}</p> : null}
        {error ? <p className="error">{error}</p> : null}
      </section>
    </main>
  )
}
