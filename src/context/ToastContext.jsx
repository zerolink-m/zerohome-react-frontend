import { createContext, useCallback, useContext, useRef, useState } from 'react'

const ToastContext = createContext(null)

let idCounter = 0

export function ToastProvider({ children }) {
  const [toasts, setToasts] = useState([])
  const timers = useRef({})

  const remove = useCallback((id) => {
    setToasts((list) => list.filter((t) => t.id !== id))
    clearTimeout(timers.current[id])
    delete timers.current[id]
  }, [])

  const show = useCallback(
    (type, message) => {
      const id = ++idCounter
      setToasts((list) => [...list, { id, type, message }])
      timers.current[id] = setTimeout(() => remove(id), 4000)
      return id
    },
    [remove]
  )

  const value = {
    toasts,
    show,
    remove,
    error: (msg) => show('error', msg),
    success: (msg) => show('success', msg),
    warning: (msg) => show('warning', msg),
    info: (msg) => show('info', msg),
  }

  return <ToastContext.Provider value={value}>{children}</ToastContext.Provider>
}

export function useToast() {
  const ctx = useContext(ToastContext)
  if (!ctx) throw new Error('useToast должен использоваться внутри ToastProvider')
  return ctx
}
