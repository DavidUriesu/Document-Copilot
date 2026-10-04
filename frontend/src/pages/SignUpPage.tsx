import { CheckCircle2 } from 'lucide-react'
import { type FormEvent, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'

import { AuthShell } from '@/components/auth/AuthShell'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { authErrorMessage } from '@/lib/auth-errors'
import { supabase } from '@/lib/supabase'

export function SignUpPage() {
  const navigate = useNavigate()
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [errorMessage, setErrorMessage] = useState<string | null>(null)
  const [confirmationSent, setConfirmationSent] = useState(false)

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setErrorMessage(null)
    setIsSubmitting(true)

    const formData = new FormData(event.currentTarget)
    const { data, error } = await supabase.auth.signUp({
      email: String(formData.get('email')).trim(),
      password: String(formData.get('password')),
      options: { emailRedirectTo: window.location.origin },
    })

    setIsSubmitting(false)
    if (error) {
      setErrorMessage(authErrorMessage(error.message))
      return
    }
    if (data.session) {
      navigate('/', { replace: true })
      return
    }
    setConfirmationSent(true)
  }

  return (
    <AuthShell
      description="Create an analyst account with your approved work email."
      footer={
        <p>
          Already have access?{' '}
          <Link className="font-medium text-foreground underline underline-offset-4" to="/signin">
            Sign in
          </Link>
        </p>
      }
      title="Request access"
    >
      {confirmationSent ? (
        <div className="border-l-2 border-foreground bg-muted/60 px-4 py-4">
          <CheckCircle2 className="size-5" />
          <p className="mt-3 font-medium">Check your inbox</p>
          <p className="mt-1 text-sm leading-6 text-muted-foreground">
            Open the confirmation email to finish creating your account.
          </p>
        </div>
      ) : (
        <form className="space-y-5" onSubmit={handleSubmit}>
          <div className="space-y-2">
            <Label htmlFor="email">Work email</Label>
            <Input id="email" name="email" type="email" autoComplete="email" placeholder="analyst@company.com" required />
          </div>
          <div className="space-y-2">
            <Label htmlFor="password">Password</Label>
            <Input id="password" name="password" type="password" autoComplete="new-password" minLength={8} required />
            <p className="text-xs text-muted-foreground">Use at least 8 characters.</p>
          </div>
          {errorMessage ? (
            <p className="border-l-2 border-destructive bg-destructive/5 px-3 py-2 text-sm text-destructive" role="alert">
              {errorMessage}
            </p>
          ) : null}
          <Button className="h-10 w-full" size="lg" type="submit" disabled={isSubmitting}>
            {isSubmitting ? 'Creating account…' : 'Create account'}
          </Button>
        </form>
      )}
    </AuthShell>
  )
}
