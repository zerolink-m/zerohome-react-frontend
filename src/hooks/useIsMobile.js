import { useEffect, useState } from 'react'

// Простой хук: следит за matchMedia и переключает флаг мобильного макета.
// SSR-safe: при отсутствии window возвращает false.
export function useIsMobile(query = '(max-width: 600px)') {
  const [matches, setMatches] = useState(() =>
    typeof window !== 'undefined' && window.matchMedia ? window.matchMedia(query).matches : false,
  )
  useEffect(() => {
    if (typeof window === 'undefined' || !window.matchMedia) return
    const mql = window.matchMedia(query)
    const handler = (e) => setMatches(e.matches)
    mql.addEventListener('change', handler)
    return () => mql.removeEventListener('change', handler)
  }, [query])
  return matches
}
