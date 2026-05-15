import { useCallback, useEffect, useRef, useState } from 'react'

const DEFAULT_SECONDS = 5

export interface UseLineupConfirmRedirectOptions {
  readonly active: boolean
  readonly onRedirect: () => void
  readonly seconds?: number
}

export interface UseLineupConfirmRedirectResult {
  readonly secondsLeft: number
  readonly redirectNow: () => void
}

/**
 * Cuenta atrás para redirección post-confirmación. El dígito usa ancho fijo en UI.
 */
export function useLineupConfirmRedirect({
  active,
  onRedirect,
  seconds = DEFAULT_SECONDS,
}: UseLineupConfirmRedirectOptions): UseLineupConfirmRedirectResult {
  const onRedirectRef = useRef(onRedirect)
  onRedirectRef.current = onRedirect
  const redirectedRef = useRef(false)
  const [secondsLeft, setSecondsLeft] = useState(seconds)

  const redirectNow = useCallback(() => {
    if (redirectedRef.current) return
    redirectedRef.current = true
    onRedirectRef.current()
  }, [])

  useEffect(() => {
    if (!active) {
      redirectedRef.current = false
      return
    }
    setSecondsLeft(seconds)
    redirectedRef.current = false
    const intervalId = window.setInterval(() => {
      setSecondsLeft((prev) => {
        if (prev <= 1) {
          window.clearInterval(intervalId)
          redirectNow()
          return 0
        }
        return prev - 1
      })
    }, 1000)
    return () => {
      window.clearInterval(intervalId)
    }
  }, [active, seconds, redirectNow])

  return { secondsLeft, redirectNow }
}
