import { useEffect, useState } from 'react'
import { Link } from 'react-router'
import { getAssignment, getCluster, listAssignments } from '../api/cluster'
import Button from '../components/Button'
import DashCard from '../components/DashCard'
import PageLoader from '../components/PageLoader'
import Pill from '../components/Pill'
import { useToast } from '../context/ToastContext'
import { useLoadGate } from '../hooks/useLoadGate'
import { colors } from '../styles/tokens'

const PAGE_SIZE = 25

function secondsLabel(value) {
  if (value == null) return '—'
  const seconds = Math.max(0, Math.floor(Number(value) || 0))
  if (seconds < 60) return `${seconds} с`
  if (seconds < 3600) return `${Math.floor(seconds / 60)} мин`
  if (seconds < 86400) return `${Math.floor(seconds / 3600)} ч ${Math.floor((seconds % 3600) / 60)} мин`
  return `${Math.floor(seconds / 86400)} д ${Math.floor((seconds % 86400) / 3600)} ч`
}

function Value({ label, value }) {
  return (
    <div style={{ minWidth: 0 }}>
      <div style={{ color: colors.white[3], fontSize: 10, textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 5 }}>{label}</div>
      <div style={{ color: colors.text, fontSize: 13, overflowWrap: 'anywhere' }}>{value ?? '—'}</div>
    </div>
  )
}

export default function AdminClusterPage() {
  const toast = useToast()
  const [cluster, setCluster] = useState(null)
  const [assignments, setAssignments] = useState([])
  const [total, setTotal] = useState(0)
  const [offset, setOffset] = useState(0)
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState(null)
  const [detail, setDetail] = useState(null)
  const [detailLoading, setDetailLoading] = useState(false)
  const gate = useLoadGate(loading, loadError)

  async function load() {
    setLoading(true)
    setLoadError(null)
    try {
      const [clusterResult, assignmentResult] = await Promise.all([
        getCluster(),
        listAssignments({ limit: PAGE_SIZE, offset }),
      ])
      setCluster(clusterResult.cluster)
      setAssignments(assignmentResult.items)
      setTotal(assignmentResult.total)
    } catch (error) {
      setLoadError(error.message || 'Не удалось загрузить состояние кластера')
      toast.error(error.message || 'Не удалось загрузить состояние кластера')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { load() }, [offset])

  async function openAssignment(item) {
    setDetailLoading(true)
    setDetail(null)
    try {
      const result = await getAssignment(item.function, item.resource_id)
      setDetail(result.assignment)
    } catch (error) {
      toast.error(error.message || 'Не удалось загрузить назначение')
    } finally {
      setDetailLoading(false)
    }
  }

  const page = Math.floor(offset / PAGE_SIZE) + 1
  const pages = Math.max(1, Math.ceil(total / PAGE_SIZE))

  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap', marginBottom: 20 }}>
        <div>
          <Link to="/admin" style={{ color: colors.white[4], fontSize: 12, textDecoration: 'none' }}>← Админ-панель</Link>
          <h1 style={{ fontSize: 20, margin: '10px 0 0' }}>Кластер и назначения</h1>
        </div>
        <Button onClick={load} loading={loading}>Обновить</Button>
      </div>

      {gate.busy ? <PageLoader gate={gate} onRetry={load} /> : !cluster ? (
        <DashCard><div style={{ color: colors.white[4], fontSize: 13 }}>Сведения о кластере недоступны.</div></DashCard>
      ) : (
        <div style={{ display: 'grid', gap: 16 }}>
          <DashCard style={{ padding: 18 }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap', marginBottom: 16 }}>
              <div>
                <h2 style={{ fontSize: 16, margin: 0 }}>Состояние кластера</h2>
                <div style={{ fontSize: 12, color: colors.white[4], marginTop: 5 }}>Текущее состояние узлов и распределения задач</div>
              </div>
              <Pill variant={cluster.cluster_enabled ? 'green' : 'yellow'}>{cluster.cluster_enabled ? 'кластер включён' : 'кластер отключён'}</Pill>
            </div>
            {!cluster.cluster_enabled && <p style={{ color: colors.white[4], fontSize: 13, lineHeight: 1.5, margin: '0 0 16px' }}>Кластерная координация выключена. Список узлов и назначений может быть пустым.</p>}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 150px), 1fr))', gap: 12 }}>
              <Value label="Текущая нода" value={cluster.node_id || '—'} />
              <Value label="Ноды" value={cluster.nodes?.length ?? 0} />
              <Value label="Назначения" value={cluster.assignments?.length ?? 0} />
              <Value label="Без назначения" value={cluster.unassigned?.length ?? 0} />
            </div>
          </DashCard>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 360px), 1fr))', gap: 16, alignItems: 'start' }}>
            <DashCard style={{ padding: 18 }}>
              <h2 style={{ fontSize: 15, margin: '0 0 12px' }}>Ноды кластера</h2>
              {!cluster.nodes?.length ? <div style={{ color: colors.white[4], fontSize: 13 }}>Нет зарегистрированных нод.</div> : (
                <div style={{ display: 'grid', gap: 10 }}>
                  {cluster.nodes.map((node) => (
                    <div key={node.node_id} style={{ padding: 12, border: `1px solid ${colors.white[8]}`, borderRadius: 12, background: 'var(--card-bg)' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                        <strong style={{ fontSize: 13, overflowWrap: 'anywhere' }}>{node.node_id}</strong>
                        <Pill variant={node.alive ? 'green' : 'red'}>{node.alive ? 'доступна' : 'недоступна'}</Pill>
                      </div>
                      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 120px), 1fr))', gap: 10, marginTop: 11 }}>
                        <Value label="Адрес" value={node.address || '—'} />
                        <Value label="Heartbeat" value={node.heartbeat_age_seconds == null ? '—' : `${secondsLabel(node.heartbeat_age_seconds)} назад`} />
                        <Value label="Версия" value={node.version || '—'} />
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </DashCard>

            <DashCard style={{ padding: 18 }}>
              <h2 style={{ fontSize: 15, margin: '0 0 12px' }}>Неназначенные задачи</h2>
              {!cluster.unassigned?.length ? <div style={{ color: colors.white[4], fontSize: 13 }}>Неназначенных задач нет.</div> : (
                <div style={{ display: 'grid', gap: 8 }}>
                  {cluster.unassigned.map((item, index) => (
                    <div key={`${item.function}:${item.resource_id}:${index}`} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12, flexWrap: 'wrap', padding: 11, borderRadius: 12, background: colors.statuses.yellow.bg, border: `1px solid ${colors.statuses.yellow.border}` }}>
                      <span style={{ fontSize: 12, overflowWrap: 'anywhere' }}>{item.function} · ресурс {item.resource_id}</span>
                      <Pill variant="yellow">{item.reason === 'no_capable_node' ? 'нет подходящей ноды' : 'нет владельца'}</Pill>
                    </div>
                  ))}
                </div>
              )}
            </DashCard>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 360px), 1fr))', gap: 16, alignItems: 'start' }}>
            <DashCard style={{ padding: 18 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 10, marginBottom: 12, flexWrap: 'wrap' }}>
                <h2 style={{ fontSize: 15, margin: 0 }}>Назначения</h2>
                <span style={{ color: colors.white[4], fontSize: 12 }}>{total} всего</span>
              </div>
              {assignments.length === 0 ? <div style={{ color: colors.white[4], fontSize: 13 }}>Назначений нет.</div> : (
                <div style={{ display: 'grid', gap: 8 }}>
                  {assignments.map((item) => (
                    <button key={`${item.function}:${item.resource_id}`} type="button" onClick={() => openAssignment(item)} style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1fr) auto', alignItems: 'center', gap: 12, textAlign: 'left', cursor: 'pointer', padding: 12, color: colors.text, background: 'var(--card-bg)', border: `1px solid ${colors.white[8]}`, borderRadius: 12 }}>
                      <span style={{ minWidth: 0 }}>
                        <strong style={{ display: 'block', fontSize: 12, overflowWrap: 'anywhere' }}>{item.function}</strong>
                        <span style={{ display: 'block', marginTop: 4, fontSize: 11, color: colors.white[4] }}>Ресурс {item.resource_id} · нода {item.owner_node_id || '—'}</span>
                      </span>
                      <Pill variant={item.expired ? 'red' : 'green'}>{item.expired ? 'истекло' : secondsLabel(item.expires_in_seconds)}</Pill>
                    </button>
                  ))}
                </div>
              )}
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, marginTop: 14 }}>
                <Button small onClick={() => setOffset((value) => Math.max(0, value - PAGE_SIZE))} disabled={offset === 0 || loading}>Назад</Button>
                <span style={{ color: colors.white[4], fontSize: 11 }}>Страница {page} / {pages}</span>
                <Button small onClick={() => setOffset((value) => value + PAGE_SIZE)} disabled={offset + PAGE_SIZE >= total || loading}>Далее</Button>
              </div>
            </DashCard>

            <DashCard style={{ padding: 18, minWidth: 0 }}>
              <h2 style={{ fontSize: 15, margin: '0 0 12px' }}>Детали назначения</h2>
              {detailLoading ? <div role="status" style={{ color: colors.white[4], fontSize: 13 }}>Загружаем назначение…</div> : !detail ? (
                <div style={{ color: colors.white[4], fontSize: 13 }}>Выберите назначение, чтобы посмотреть его актуальные данные.</div>
              ) : (
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 130px), 1fr))', gap: 14 }}>
                  <Value label="Функция" value={detail.function} />
                  <Value label="Ресурс" value={detail.resource_id} />
                  <Value label="Владелец нода" value={detail.owner_node_id || '—'} />
                  <Value label="Поколение" value={detail.generation} />
                  <Value label="Истекает" value={detail.expires_at == null ? '—' : new Date(Number(detail.expires_at) * 1000).toLocaleString()} />
                  <Value label="Обновлено" value={detail.updated_at == null ? '—' : new Date(Number(detail.updated_at) * 1000).toLocaleString()} />
                </div>
              )}
            </DashCard>
          </div>
        </div>
      )}
    </div>
  )
}
