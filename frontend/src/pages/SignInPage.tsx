import { type FormEvent, useState } from 'react'
import { Link, useLocation, useNavigate } from 'react-router-dom'

import { AuthShell } from '@/components/auth/AuthShell'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { authErrorMessage } from '@/lib/auth-errors'
import { supabase } from '@/lib/supabase'

function destination(state: unknown): string {
  if (
    typeof state === 'object' &&
    state !== null &&
    'from' in state &&
    typeof state.from === 'string' &&
    state.from.startsWith('/')
  ) {
    return state.from
  }
  return '/'
}

export function SignInPage() {
  const navigate = useNavigate()
  const location = useLocation()
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [errorMessage, setErrorMessage] = useState<string | null>(null)

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setErrorMessage(null)
    setIsSubmitting(true)

    const formData = new FormData(event.currentTarget)
    const { error } = await supabase.auth.signInWithPassword({
      email: String(formData.get('email')).trim(),
      password: String(formData.get('password')),
    })

    setIsSubmitting(false)
    if (error) {
      setErrorMessage(authErrorMessage(error.message))
      return
    }

    navigate(destination(location.state), { replace: true })
  }

  return (
    <AuthShell
      description="Use your Driftwood email to continue to the filing research workspace."
      footer={
        <p>
          Need an account?{' '}
          <Link className="font-medium text-foreground underline underline-offset-4" to="/signup">
            Request access
          </Link>
        </p>
      }
      title="Welcome back"
    >
      <form className="space-y-5" onSubmit={handleSubmit}>
        <div className="space-y-2">
          <Label htmlFor="email">Work email</Label>
          <Input id="email" name="email" type="email" autoComplete="email" required />
        </div>
        <div className="space-y-2">
          <Label htmlFor="password">Password</Label>
          <Input id="password" name="password" type="password" autoComplete="current-password" required />
        </div>
        {errorMessage ? (
          <p className="border-l-2 border-destructive bg-destructive/5 px-3 py-2 text-sm text-destructive" role="alert">
            {errorMessage}
          </p>
        ) : null}
        <Button className="h-10 w-full" size="lg" type="submit" disabled={isSubmitting}>
          {isSubmitting ? 'Signing in…' : 'Sign in'}
        </Button>
      </form>
    </AuthShell>
  )
}
