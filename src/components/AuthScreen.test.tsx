import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import { AuthScreen } from './AuthScreen'

describe('AuthScreen', () => {
  it('invoca signIn in modalità accesso', async () => {
    const user = userEvent.setup()
    const signIn = vi.fn().mockResolvedValue(undefined)
    const signUp = vi.fn().mockResolvedValue(undefined)

    render(<AuthScreen onSignIn={signIn} onSignUp={signUp} />)

    await user.type(screen.getByLabelText('Email'), 'mario@example.com')
    await user.type(screen.getByLabelText('Password'), 'password123')
    await user.click(screen.getByRole('button', { name: 'Entra' }))

    expect(signIn).toHaveBeenCalledWith({
      email: 'mario@example.com',
      password: 'password123',
    })
    expect(signUp).not.toHaveBeenCalled()
  })

  it('invoca signUp in modalità registrazione', async () => {
    const user = userEvent.setup()
    const signIn = vi.fn().mockResolvedValue(undefined)
    const signUp = vi.fn().mockResolvedValue(undefined)

    render(<AuthScreen onSignIn={signIn} onSignUp={signUp} />)

    await user.click(screen.getByRole('button', { name: 'Registrati' }))
    await user.type(screen.getByLabelText('Email'), 'new@example.com')
    await user.type(screen.getByLabelText('Password'), 'newpassword')
    await user.click(screen.getByRole('button', { name: 'Crea account' }))

    expect(signUp).toHaveBeenCalledWith({
      email: 'new@example.com',
      password: 'newpassword',
    })
  })
})
