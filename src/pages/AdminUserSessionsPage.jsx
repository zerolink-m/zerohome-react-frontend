import { useEffect, useState } from 'react'
import { useNavigate, useParams } from 'react-router'
import { getUser } from '../api/users'
import { useAuth } from '../context/AuthContext'
import { listSessions, deleteSession } from '../api/sessions'
import { useToast } from '../context/ToastContext'
import { SEARCH_COLUMNS, SEARCH_COLUMN_LABELS, DEFAULT_LIMIT } from '../api/pagination'
import DashCard from '../components/DashCard'
import Button from '../components/Button'
import SearchBar from '../components/SearchBar'
import Pagination from '../components/Pagination'
import { colors } from '../styles/tokens'
import { formatSessionDate } from '../utils/format'
import { useLoadGate } from '../hooks/useLoadGate'
import PageLoader from '../components/PageLoader'

export default function AdminUserSessionsPage() {
  const { userId } = useParams()
  const { uid, sid } = useAuth()
  const toast = useToast()
  const navigate = useNavigate()
  const [user, setUser] = useState(null)
  const [filter, setFilter] = useState({ offset: 0, limit: DEFAULT_LIMIT })
  const [data, setData] = useState({ items: [], total: 0 })
  const [loading, setLoading] = useState(true)
  const gate = useLoadGate(loading)

  useEffect(() => {
    getUser(userId)
      .then(setUser)
      .catch((e) => toast.error(e.message))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userId])

  useEffect(() => {
    let cancelled = false
    async function load() {
      setLoading(true)
      try {
        const res = await listSessions(userId, filter)
        if (!cancelled) setData(res)
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
  }, [userId, filter])

  async function handleRevoke(id) {
    try {
      await deleteSession(userId, id)
      setData((d) => ({ ...d, items: d.items.filter((s) => s.id !== id), total: d.total - 1 }))
      toast.success('Сессия отозвана')
    } catch (e) {
      toast.error(e.message)
    }
  }

  return (
    <div>
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          marginBottom: 24,
          flexWrap: 'wrap',
          gap: 12,
        }}
      >
        <h1 style={{ fontSize: 20 }}>Сессии{user ? ` — ${user.name} ${user.surname}` : ''}</h1>
        <Button onClick={() => navigate('/admin/users')}>← к пользователям</Button>
      </div>

      <SearchBar
        columns={SEARCH_COLUMNS.sessions}
        labels={SEARCH_COLUMN_LABELS.sessions}
        onSearch={(patch) => setFilter((f) => ({ ...f, offset: 0, ...patch }))}
      />

      {gate.busy ? (
        <PageLoader gate={gate} />
      ) : (
        <div style={{ display: 'grid', gap: 12 }}>
          {data.items.map((s) => (
            <DashCard key={s.id} style={{ padding: 16 }}>
              <div
                style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  gap: 12,
                  alignItems: 'center',
                  flexWrap: 'wrap',
                }}
              >
                <div style={{ fontSize: 12 }}>
                  <div>{s.ua || 'неизвестный клиент'}</div>
                  <div style={{ color: colors.white[3] }}>
                    {s.ip} · активность {formatSessionDate(s.last_seen ?? s.updated_at)}
                  </div>
                </div>
                <Button small disabled={String(uid) === String(userId) && (sid == null || sid === s.id)} title={String(uid) === String(userId) && sid == null ? 'Неизвестен ID текущей сессии' : undefined} onClick={() => handleRevoke(s.id)}>
                  Отозвать
                </Button>
              </div>
            </DashCard>
          ))}
        </div>
      )}

      <Pagination
        offset={filter.offset}
        limit={filter.limit}
        total={data.total}
        onChange={(patch) => setFilter((f) => ({ ...f, ...patch }))}
      />
    </div>
  )
}
