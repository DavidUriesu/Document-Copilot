export function authErrorMessage(message: string): string {
  if (/invalid login credentials/i.test(message)) return 'Email or password is incorrect.'
  if (/email not confirmed/i.test(message)) return 'Confirm your email before signing in.'
  if (/already registered|already exists/i.test(message)) return 'An account already exists for this email.'
  if (/password/i.test(message)) return 'The password does not meet the account requirements.'
  if (/rate limit|too many requests/i.test(message)) return 'Too many attempts. Wait a moment and try again.'
  return 'We could not complete this request. Try again.'
}
