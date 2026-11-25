import { useLayoutEffect, useRef } from 'react'
import { createPortal } from 'react-dom'

const FOCUSABLE = 'a[href], button, input, select, textarea, video[controls], [tabindex]'
const stack = []

function focusableElements(panel) {
  return [...panel.querySelectorAll(FOCUSABLE)].filter((element) =>
    element.tabIndex >= 0 && !element.matches(':disabled, [data-dialog-guard]') && element.getClientRects().length > 0)
}

function makeInaccessible(element) {
  if (!element) return () => {}
  const previousAria = element.getAttribute('aria-hidden')
  const previousInert = element.hasAttribute('inert')
  element.setAttribute('aria-hidden', 'true')
  element.setAttribute('inert', '')
  return () => {
    if (previousAria == null) element.removeAttribute('aria-hidden')
    else element.setAttribute('aria-hidden', previousAria)
    if (!previousInert) element.removeAttribute('inert')
  }
}

export default function Dialog({ open, title, onClose, blockClose = false, descriptionId, style, children }) {
  const panelRef = useRef(null)
  const closeRef = useRef(null)
  closeRef.current = () => { if (!blockClose) onClose?.() }

  useLayoutEffect(() => {
    if (!open) return
    const panel = panelRef.current
    const opener = document.activeElement
    const previous = stack[stack.length - 1]
    stack.push(panel)
    const isTop = () => stack[stack.length - 1] === panel
    const firstTarget = () => focusableElements(panel)[0] ?? panel
    const initial = panel.querySelector('[data-dialog-initial-focus]')
    const target = initial?.matches(':disabled') ? firstTarget() : (initial || firstTarget())
    target.focus()
    const restoreBackground = makeInaccessible(previous || document.getElementById('root'))
    const previousOverflow = document.body.style.overflow
    if (!previous) document.body.style.overflow = 'hidden'

    function onKeyDown(event) {
      if (!isTop() || event.defaultPrevented) return
      if (event.key === 'Escape') {
        event.preventDefault()
        event.stopPropagation()
        closeRef.current()
      }
    }
    function onFocus(event) {
      if (isTop() && !panel.contains(event.target)) firstTarget().focus()
    }
    document.addEventListener('keydown', onKeyDown, true)
    document.addEventListener('focusin', onFocus)
    return () => {
      document.removeEventListener('keydown', onKeyDown, true)
      document.removeEventListener('focusin', onFocus)
      const wasTop = isTop()
      stack.splice(stack.indexOf(panel), 1)
      restoreBackground()
      if (!previous) document.body.style.overflow = previousOverflow
      if (wasTop) {
        const next = stack[stack.length - 1]
        const fallback = document.querySelector('[data-route-content]')
        const focus = opener instanceof HTMLElement && opener.isConnected && (!next || next.contains(opener)) ? opener : (next ?? fallback)
        focus?.focus({ preventScroll: true })
      }
    }
  }, [open])

  if (!open) return null

  function loopFocus(backwards) {
    const panel = panelRef.current
    const elements = focusableElements(panel)
    const target = backwards ? elements[elements.length - 1] : elements[0]
    if (target) target.focus()
    else panel.focus()
  }

  return createPortal(
    <div className="app-dialog-overlay" onClick={(event) => {
      event.stopPropagation()
      if (event.target === event.currentTarget) closeRef.current()
    }}>
      <div ref={panelRef} className="app-dialog" role="dialog" aria-modal="true" aria-label={title} aria-describedby={descriptionId} tabIndex={-1} style={style}>
        <span className="sr-only" tabIndex={0} data-dialog-guard onFocus={() => loopFocus(true)} />
        {children}
        <span className="sr-only" tabIndex={0} data-dialog-guard onFocus={() => loopFocus(false)} />
      </div>
    </div>,
    document.body,
  )
}
