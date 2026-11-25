import { useEffect, useState } from 'react'
import { getAllStats } from '../api/stats'
import DashCard from '../components/DashCard'
import SelectField from '../components/SelectField'
import Button from '../components/Button'
import { colors } from '../styles/tokens'
import { useLoadGate } from '../hooks/useLoadGate'
import PageLoader from '../components/PageLoader'

const PERIOD_OPTIONS = [
  { value: '1', label: '1 час' },
  { value: '6', label: '6 часов' },
  { value: '24', label: '24 часа' },
  { value: '72', label: '3 дня' },
  { value: '168', label: '7 дней' },
]

export default function StatsPage() {
  const [result, setResult] = useState(null)
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState(null)
  const gate = useLoadGate(loading, loadError)
  const [period, setPeriod] = useState('24')
  const [requestVersion, setRequestVersion] = useState(0)
  const stats = result?.period === period ? result.stats : null

  useEffect(() => {
    let active = true
    let pending = false
    async function loadStats() {
      if (pending) return
      pending = true
      try {
        const data = await getAllStats(Number(period))
        if (active) {
          setResult({ period, stats: data.data || data })
          setLoadError(null)
        }
      } catch (err) {
        if (active) setLoadError(err.message || 'Ошибка загрузки статистики')
      } finally {
        pending = false
        if (active) setLoading(false)
      }
    }
    loadStats()
    const interval = setInterval(loadStats, 30000)
    return () => { active = false; clearInterval(interval) }
  }, [period, requestVersion])

  function retry() {
    setLoadError(null)
    setLoading(true)
    setRequestVersion((version) => version + 1)
  }

  function formatBytes(bytes) {
    if (bytes === 0) return '0 B'
    const k = 1024
    const sizes = ['B', 'KB', 'MB', 'GB', 'TB']
    const i = Math.floor(Math.log(bytes) / Math.log(k))
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i]
  }

  // Секунды → «1м 8с» / «2ч 5м» для коротких интервалов (ingest).
  function formatShortDuration(seconds) {
    const total = Math.max(0, Math.round(seconds || 0))
    if (total < 60) return `${total}с`
    const h = Math.floor(total / 3600)
    const m = Math.floor((total % 3600) / 60)
    if (h > 0) return `${h}ч ${m}м`
    return `${m}м ${total % 60}с`
  }

  // Состояние приёма потока: online — зелёный, остальное — красный.
  const INGEST_STATE_LABELS = { online: 'в сети', offline: 'не в сети', starting: 'запуск' }

  function formatUptime(seconds) {
    const days = Math.floor(seconds / 86400)
    const hours = Math.floor((seconds % 86400) / 3600)
    const minutes = Math.floor((seconds % 3600) / 60)
    return `${days}д ${hours}ч ${minutes}м`
  }

  return (
    <div style={{ padding: 24 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 12, marginBottom: 24 }}>
        <h1 style={{ fontSize: 24, margin: 0 }}>Статистика системы</h1>
        <SelectField
          label="Период для детекции движения"
          value={period}
          onChange={(e) => {
            setPeriod(e.target.value)
            setResult(null)
            setLoadError(null)
            setLoading(true)
          }}
          options={PERIOD_OPTIONS}
          style={{ minWidth: 180 }}
        />
      </div>

      {!stats || gate.visible ? (
        <>
          {loading && <p role="status" className="sr-only">Загружается статистика за выбранный период</p>}
          <PageLoader gate={gate} onRetry={retry} />
        </>
      ) : (
      <>
      {loadError && <div role="alert" style={{ marginBottom: 16, color: colors.statuses.red.text }}>
        {loadError} <Button small onClick={retry} loading={loading}>Повторить</Button>
      </div>}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 300px), 1fr))', gap: 20 }}>
        {/* Системные ресурсы */}
        <DashCard>
          <h3 style={{ fontSize: 16, marginBottom: 16 }}>Система</h3>
          <div style={{ fontSize: 13, color: colors.white[4], display: 'flex', flexDirection: 'column', gap: 12 }}>
            <div>
              <div style={{ marginBottom: 4 }}>CPU: {stats.system?.cpu_percent?.toFixed(1)}%</div>
              <div style={{ background: colors.white[2], height: 6, borderRadius: 3, overflow: 'hidden' }}>
                <div style={{ background: colors.accent.blue, height: '100%', width: `${stats.system?.cpu_percent}%` }} />
              </div>
            </div>
            <div>
              <div style={{ marginBottom: 4 }}>
                RAM: {stats.system?.memory?.used_mb?.toFixed(0)} / {stats.system?.memory?.total_mb?.toFixed(0)} MB ({stats.system?.memory?.percent?.toFixed(1)}%)
              </div>
              <div style={{ background: colors.white[2], height: 6, borderRadius: 3, overflow: 'hidden' }}>
                <div style={{ background: colors.accent.purple, height: '100%', width: `${stats.system?.memory?.percent}%` }} />
              </div>
            </div>
            <div>
              <div style={{ marginBottom: 4 }}>
                Диск: {stats.system?.disk?.used_gb?.toFixed(1)} / {stats.system?.disk?.total_gb?.toFixed(1)} GB ({stats.system?.disk?.percent?.toFixed(1)}%)
              </div>
              <div style={{ background: colors.white[2], height: 6, borderRadius: 3, overflow: 'hidden' }}>
                <div style={{ background: colors.accent.green, height: '100%', width: `${stats.system?.disk?.percent}%` }} />
              </div>
            </div>
            <div>
              <div>Uptime: {formatUptime(stats.system?.uptime_seconds || 0)}</div>
            </div>
            <div>
              <div>Сеть отправлено: {formatBytes(stats.system?.network?.bytes_sent || 0)}</div>
              <div>Сеть получено: {formatBytes(stats.system?.network?.bytes_recv || 0)}</div>
            </div>
          </div>
        </DashCard>

        {/* Стримы */}
        <DashCard>
          <h3 style={{ fontSize: 16, marginBottom: 16 }}>Активные стримы</h3>
          <div style={{ fontSize: 13, color: colors.white[4], display: 'flex', flexDirection: 'column', gap: 8 }}>
            {Object.entries(stats.streams?.active_streams || {}).map(([camId, n]) => (
              <div key={camId} style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span>Камера {camId}:</span>
                <strong style={{ color: colors.white[7] }}>{n}</strong>
              </div>
            ))}
            <div style={{ borderTop: `1px solid ${colors.white[2]}`, paddingTop: 8, marginTop: 8, display: 'flex', justifyContent: 'space-between' }}>
              <span>Всего:</span>
              <strong style={{ color: colors.white[7], fontSize: 16 }}>
                {Object.values(stats.streams?.active_streams || {}).reduce((sum, n) => sum + (Number(n) || 0), 0)}
              </strong>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
              <span>Клиентов:</span>
              <strong style={{ color: colors.white[7] }}>{stats.streams?.total_clients || 0}</strong>
            </div>
          </div>
        </DashCard>

        {/* Камеры */}
        <DashCard>
          <h3 style={{ fontSize: 16, marginBottom: 16 }}>Камеры</h3>
          <div style={{ fontSize: 13, color: colors.white[4], display: 'flex', flexDirection: 'column', gap: 8 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
              <span>Всего камер:</span>
              <strong style={{ color: colors.white[7], fontSize: 16 }}>{stats.cameras?.total || 0}</strong>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
              <span>Включено:</span>
              <strong style={{ color: colors.statuses.green.text }}>{stats.cameras?.enabled || 0}</strong>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
              <span>Выключено:</span>
              <strong style={{ color: colors.white[3] }}>{stats.cameras?.disabled || 0}</strong>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
              <span>ONVIF:</span>
              <strong style={{ color: colors.white[7] }}>{stats.cameras?.onvif_enabled || 0}</strong>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
              <span>PTZ:</span>
              <strong style={{ color: colors.white[7] }}>{stats.cameras?.ptz_enabled || 0}</strong>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
              <span>С записью:</span>
              <strong style={{ color: colors.white[7] }}>{stats.cameras?.recording_enabled || 0}</strong>
            </div>
          </div>
        </DashCard>

        {/* Приём потоков камер (ingest) */}
        {stats.cameras?.ingest && Object.keys(stats.cameras.ingest).length > 0 && (
          <DashCard>
            <h3 style={{ fontSize: 16, marginBottom: 16 }}>Приём потоков</h3>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              {Object.entries(stats.cameras.ingest)
                .sort(([a], [b]) => Number(a) - Number(b))
                .map(([camId, ing]) => {
                  const scheme = ing.state === 'online' && ing.running ? colors.statuses.green : colors.statuses.red
                  return (
                    <div
                      key={camId}
                      style={{
                        fontSize: 12,
                        color: colors.white[4],
                        border: `1px solid ${scheme.border}`,
                        background: scheme.bg,
                        borderRadius: 12,
                        padding: 12,
                        display: 'flex',
                        flexDirection: 'column',
                        gap: 4,
                      }}
                    >
                      <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8 }}>
                        <strong style={{ color: colors.white[7], fontSize: 13 }}>Камера {camId}</strong>
                        <strong style={{ color: scheme.text }}>
                          {INGEST_STATE_LABELS[ing.state] || ing.state}
                          {!ing.running && ' · остановлен'}
                        </strong>
                      </div>
                      <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                        <span>Последние данные:</span>
                        <span>{ing.seconds_since_data != null ? `${ing.seconds_since_data.toFixed(1)}с назад` : '—'}</span>
                      </div>
                      <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                        <span>В работе:</span>
                        <span>{formatShortDuration(ing.uptime_seconds)}</span>
                      </div>
                      <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                        <span>Перезапусков:</span>
                        <span style={{ color: ing.restarts > 0 ? colors.statuses.yellow.text : undefined }}>{ing.restarts ?? 0}</span>
                      </div>
                      <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                        <span>Зрителей:</span>
                        <span>{ing.consumers ?? 0}</span>
                      </div>
                      {(ing.has_init === false || ing.has_gop === false) && (
                        <div style={{ color: colors.statuses.yellow.text }}>
                          Нет {[ing.has_init === false && 'init-сегмента', ing.has_gop === false && 'GOP'].filter(Boolean).join(' и ')}
                        </div>
                      )}
                      {ing.last_error && (
                        <div style={{ color: colors.white[3], overflowWrap: 'anywhere' }}>
                          Последняя ошибка: {ing.last_error}
                        </div>
                      )}
                    </div>
                  )
                })}
            </div>
          </DashCard>
        )}

        {/* Записи */}
        <DashCard>
          <h3 style={{ fontSize: 16, marginBottom: 16 }}>Записи</h3>
          <div style={{ fontSize: 13, color: colors.white[4], display: 'flex', flexDirection: 'column', gap: 8 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
              <span>Всего файлов:</span>
              <strong style={{ color: colors.white[7], fontSize: 16 }}>{stats.recordings?.total_recordings || 0}</strong>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
              <span>Размер:</span>
              <strong style={{ color: colors.white[7] }}>{stats.recordings?.total_size_gb?.toFixed(2)} GB</strong>
            </div>
          </div>
        </DashCard>

        {/* Детекция движения */}
        <DashCard>
          <h3 style={{ fontSize: 16, marginBottom: 16 }}>Детекция движения</h3>
          <div style={{ fontSize: 13, color: colors.white[4], display: 'flex', flexDirection: 'column', gap: 8 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
              <span>Период:</span>
              <strong style={{ color: colors.white[7] }}>{stats.motion?.period_hours || 0} ч</strong>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
              <span>Событий:</span>
              <strong style={{ color: colors.white[7], fontSize: 16 }}>{stats.motion?.total_events || 0}</strong>
            </div>
            <div style={{ borderTop: `1px solid ${colors.white[2]}`, paddingTop: 8, marginTop: 8 }}>
              <div style={{ marginBottom: 4, color: colors.white[3], fontSize: 11 }}>По типам:</div>
              {stats.motion?.events_by_object && Object.entries(stats.motion.events_by_object).map(([type, count]) => (
                <div key={type} style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
                  <span style={{ textTransform: 'capitalize' }}>{type}:</span>
                  <strong style={{ color: colors.white[7] }}>{count}</strong>
                </div>
              ))}
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
              <span>Ср. уверенность:</span>
              <strong style={{ color: colors.white[7] }}>{stats.motion?.avg_confidence?.toFixed(1)}%</strong>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
              <span>Номеров обнаружено:</span>
              <strong style={{ color: colors.white[7] }}>{stats.motion?.license_plates_detected || 0}</strong>
            </div>
            {stats.motion?.top_cameras && stats.motion.top_cameras.length > 0 && (
              <div style={{ borderTop: `1px solid ${colors.white[2]}`, paddingTop: 8, marginTop: 8 }}>
                <div style={{ marginBottom: 4, color: colors.white[3], fontSize: 11 }}>Топ камер:</div>
                {stats.motion.top_cameras.slice(0, 3).map((cam, idx) => (
                  <div key={cam.cam_id} style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
                    <span>#{idx + 1} Камера {cam.cam_id}:</span>
                    <strong style={{ color: colors.white[7] }}>{cam.events}</strong>
                  </div>
                ))}
              </div>
            )}
          </div>
        </DashCard>

        {/* Пользователи */}
        <DashCard>
          <h3 style={{ fontSize: 16, marginBottom: 16 }}>Пользователи</h3>
          <div style={{ fontSize: 13, color: colors.white[4], display: 'flex', flexDirection: 'column', gap: 8 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
              <span>Всего пользователей:</span>
              <strong style={{ color: colors.white[7], fontSize: 16 }}>{stats.users?.total_users || 0}</strong>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
              <span>Активных сессий:</span>
              <strong style={{ color: colors.statuses.green.text }}>{stats.users?.active_sessions || 0}</strong>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
              <span>Активных расшариваний:</span>
              <strong style={{ color: colors.white[7] }}>{stats.users?.active_shares || 0}</strong>
            </div>
          </div>
        </DashCard>

        {/* Ошибки */}
        <DashCard>
          <h3 style={{ fontSize: 16, marginBottom: 16 }}>Ошибки</h3>
          <div style={{ fontSize: 13, color: colors.white[4], display: 'flex', flexDirection: 'column', gap: 8 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
              <span>HTTP 4xx:</span>
              <strong style={{ color: colors.statuses.yellow.text }}>{stats.errors?.http_4xx || 0}</strong>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
              <span>HTTP 5xx:</span>
              <strong style={{ color: colors.statuses.red.text }}>{stats.errors?.http_5xx || 0}</strong>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
              <span>RTSP ошибок:</span>
              <strong style={{ color: colors.white[7] }}>{stats.errors?.rtsp_failures || 0}</strong>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
              <span>ONVIF ошибок:</span>
              <strong style={{ color: colors.white[7] }}>{stats.errors?.onvif_failures || 0}</strong>
            </div>
            {stats.errors?.errors_by_type && Object.keys(stats.errors.errors_by_type).length > 0 && (
              <div style={{ borderTop: `1px solid ${colors.white[2]}`, paddingTop: 8, marginTop: 8 }}>
                <div style={{ marginBottom: 4, color: colors.white[3], fontSize: 11 }}>По типам:</div>
                {Object.entries(stats.errors.errors_by_type).slice(0, 5).map(([type, count]) => (
                  <div key={type} style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
                    <span style={{ fontSize: 11, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: '70%' }}>{type}:</span>
                    <strong style={{ color: colors.white[7] }}>{count}</strong>
                  </div>
                ))}
              </div>
            )}
          </div>
        </DashCard>

        {/* Производительность */}
        <DashCard>
          <h3 style={{ fontSize: 16, marginBottom: 16 }}>Производительность</h3>
          <div style={{ fontSize: 13, color: colors.white[4] }}>
            {stats.performance?.endpoints && Object.keys(stats.performance.endpoints).length > 0 && (
              <div style={{ marginBottom: 16 }}>
                <div style={{ marginBottom: 8, color: colors.white[3], fontSize: 11 }}>Топ эндпоинтов (по времени отклика):</div>
                <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr 1fr 1fr 1fr', gap: 8, fontSize: 11, color: colors.white[3], marginBottom: 8 }}>
                  <div>Эндпоинт</div>
                  <div style={{ textAlign: 'right' }}>Вызовов</div>
                  <div style={{ textAlign: 'right' }}>Средн.</div>
                  <div style={{ textAlign: 'right' }}>Мин.</div>
                  <div style={{ textAlign: 'right' }}>Макс.</div>
                </div>
                {Object.entries(stats.performance.endpoints)
                  .sort((a, b) => b[1].avg_ms - a[1].avg_ms)
                  .slice(0, 10)
                  .map(([endpoint, perf]) => (
                    <div key={endpoint} style={{ display: 'grid', gridTemplateColumns: '2fr 1fr 1fr 1fr 1fr', gap: 8, marginBottom: 4, fontSize: 12 }}>
                      <div style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{endpoint}</div>
                      <div style={{ textAlign: 'right', color: colors.white[7] }}>{perf.count}</div>
                      <div style={{ textAlign: 'right', color: colors.white[7] }}>{perf.avg_ms.toFixed(1)}ms</div>
                      <div style={{ textAlign: 'right', color: colors.white[4] }}>{perf.min_ms.toFixed(1)}ms</div>
                      <div style={{ textAlign: 'right', color: colors.statuses.red.text }}>{perf.max_ms.toFixed(1)}ms</div>
                    </div>
                  ))}
              </div>
            )}
            {stats.performance?.snapshots && (
              <div>
                <div style={{ marginBottom: 8, color: colors.white[3], fontSize: 11 }}>Снимки:</div>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 16 }}>
                  {stats.performance.snapshots.onvif && (
                    <div>
                      <div style={{ fontSize: 12, marginBottom: 4, color: colors.white[4] }}>ONVIF:</div>
                      <div style={{ fontSize: 11 }}>
                        <div>Вызовов: {stats.performance.snapshots.onvif.count}</div>
                        <div>Среднее: {stats.performance.snapshots.onvif.avg_ms.toFixed(1)}ms</div>
                        <div>Мин: {stats.performance.snapshots.onvif.min_ms.toFixed(1)}ms / Макс: {stats.performance.snapshots.onvif.max_ms.toFixed(1)}ms</div>
                      </div>
                    </div>
                  )}
                  {stats.performance.snapshots.rtsp && (
                    <div>
                      <div style={{ fontSize: 12, marginBottom: 4, color: colors.white[4] }}>RTSP:</div>
                      <div style={{ fontSize: 11 }}>
                        <div>Вызовов: {stats.performance.snapshots.rtsp.count}</div>
                        <div>Среднее: {stats.performance.snapshots.rtsp.avg_ms.toFixed(1)}ms</div>
                        <div>Мин: {stats.performance.snapshots.rtsp.min_ms.toFixed(1)}ms / Макс: {stats.performance.snapshots.rtsp.max_ms.toFixed(1)}ms</div>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>
        </DashCard>
      </div>

      <div style={{ marginTop: 16, fontSize: 11, color: colors.white[2], textAlign: 'center' }}>
        Обновляется автоматически каждые 30 секунд
      </div>
      </>
      )}
    </div>
  )
}
