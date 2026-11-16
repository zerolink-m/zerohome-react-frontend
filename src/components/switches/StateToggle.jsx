import { useEffect, useState } from 'react'
import { getSwitchState, setSwitchState } from '../../api/switches'
import { ApiError } from '../../api/client'
import { CODES } from '../../api/codes'
import { useToast } from '../../context/ToastContext'
import Toggle from '../Toggle'
import { colors } from '../../styles/tokens'
import Spinner from '../Spinner'

export default function StateToggle({ switchId, authToken, large = false }) {
  const toast = useToast()
  const [state, setState] = useState(null)
  const [loading, setLoading] = useState(true)
  const [sending, setSending] = useState(false)
  const opts = authToken ? { shareToken: authToken } : undefined

  useEffect(() => {
    let cancelled = false
    async function load() {
      setLoading(true)
      try {
        const data = await getSwitchState(switchId, opts)
        if (!cancelled) setState(data.state)
      } catch (e) {
        if (!cancelled) toast.error(e.message)
      } finally {
        if (!cancelled) setLoading(false)
      }
    }
    load()
    return () => {
      cancelled = true
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [switchId, authToken])

  async function handleChange(next) {
    if (sending) return
    setSending(true)
    try {
      const data = await setSwitchState(switchId, next ? 1 : 0, opts)
      setState(data.state)
    } catch (e) {
      if (e instanceof ApiError && e.code === CODES.SERVER_ERROR) {
        toast.error('Устройство не отвечает')
      } else {
        toast.error(e.message)
      }
    } finally {
      setSending(false)
    }
  }

  if (loading) {
    return <Spinner inline label="Загрузка состояния…" />
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8 }}>
      <Toggle checked={!!state} onChange={handleChange} disabled={sending} large={large} />
      {sending && <div style={{ fontSize: 11, color: colors.white[3] }}>Отправка команды...</div>}
    </div>
  )
}
