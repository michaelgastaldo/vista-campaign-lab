import * as React from 'react'
import { createFileRoute, Link } from '@tanstack/react-router'
import { BRAND } from '@/lib/brand'

type Status = 'loading' | 'valid' | 'already' | 'invalid' | 'done' | 'error'

function UnsubscribePage() {
  const search = typeof window !== 'undefined' ? window.location.search : ''
  const token = React.useMemo(
    () => new URLSearchParams(search).get('token') || '',
    [search],
  )

  const [status, setStatus] = React.useState<Status>('loading')
  const [submitting, setSubmitting] = React.useState(false)

  React.useEffect(() => {
    if (!token) {
      setStatus('invalid')
      return
    }
    let cancelled = false
    ;(async () => {
      try {
        const res = await fetch(
          `/email/unsubscribe?token=${encodeURIComponent(token)}`,
        )
        const data = await res.json()
        if (cancelled) return
        if (!res.ok) {
          setStatus('invalid')
        } else if (data.valid) {
          setStatus('valid')
        } else if (data.reason === 'already_unsubscribed') {
          setStatus('already')
        } else {
          setStatus('invalid')
        }
      } catch {
        if (!cancelled) setStatus('error')
      }
    })()
    return () => {
      cancelled = true
    }
  }, [token])

  const handleConfirm = async () => {
    setSubmitting(true)
    try {
      const res = await fetch('/email/unsubscribe', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token }),
      })
      if (res.ok) {
        setStatus('done')
      } else {
        setStatus('error')
      }
    } catch {
      setStatus('error')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center px-6 py-16 bg-background text-foreground">
      <div className="w-full max-w-md rounded-2xl border border-border bg-card/60 backdrop-blur p-8 shadow-xl">
        <div className="flex items-center gap-2 mb-6">
          <span className="inline-block h-2 w-2 rounded-full bg-primary" />
          <span className="font-display text-lg tracking-tight">
            {BRAND.name}
          </span>
        </div>

        {status === 'loading' && (
          <>
            <h1 className="font-display text-2xl tracking-tight mb-2">
              Checking your link…
            </h1>
            <p className="text-muted-foreground text-sm">One moment.</p>
          </>
        )}

        {status === 'valid' && (
          <>
            <h1 className="font-display text-2xl tracking-tight mb-3">
              Unsubscribe from {BRAND.name} emails?
            </h1>
            <p className="text-muted-foreground text-sm mb-6 leading-relaxed">
              You'll stop receiving notification emails from us at this
              address. Critical account emails (security alerts, password
              resets) will still be delivered.
            </p>
            <button
              type="button"
              onClick={handleConfirm}
              disabled={submitting}
              className="w-full rounded-xl bg-primary text-primary-foreground font-medium py-3 px-4 transition hover:opacity-90 disabled:opacity-50"
            >
              {submitting ? 'Unsubscribing…' : 'Confirm unsubscribe'}
            </button>
          </>
        )}

        {status === 'already' && (
          <>
            <h1 className="font-display text-2xl tracking-tight mb-2">
              You're already unsubscribed
            </h1>
            <p className="text-muted-foreground text-sm">
              No action needed — this address won't receive notification
              emails from {BRAND.name}.
            </p>
          </>
        )}

        {status === 'done' && (
          <>
            <h1 className="font-display text-2xl tracking-tight mb-2">
              You've been unsubscribed
            </h1>
            <p className="text-muted-foreground text-sm">
              Thanks — we won't send notification emails to this address
              anymore.
            </p>
          </>
        )}

        {status === 'invalid' && (
          <>
            <h1 className="font-display text-2xl tracking-tight mb-2">
              This link isn't valid
            </h1>
            <p className="text-muted-foreground text-sm">
              The unsubscribe link is expired or incorrect. If you keep
              receiving unwanted emails, contact support.
            </p>
          </>
        )}

        {status === 'error' && (
          <>
            <h1 className="font-display text-2xl tracking-tight mb-2">
              Something went wrong
            </h1>
            <p className="text-muted-foreground text-sm">
              Please try again in a moment.
            </p>
          </>
        )}

        <div className="mt-8 pt-6 border-t border-border text-xs text-muted-foreground">
          <Link to="/" className="hover:text-foreground transition">
            ← Back to {BRAND.name}
          </Link>
        </div>
      </div>
    </div>
  )
}

export const Route = createFileRoute('/unsubscribe')({
  component: UnsubscribePage,
})
