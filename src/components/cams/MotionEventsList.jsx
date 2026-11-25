import { useState, useEffect } from 'react'
import { listMotionEvents, deleteMotionEvent } from '../../api/motion'
import MotionEventPhoto from './MotionEventPhoto'
import { useToast } from '../../context/ToastContext'
import Button from '../Button'
import Pagination from '../Pagination'
import ConfirmDialog from '../ConfirmDialog'
import { useLoadGate } from '../../hooks/useLoadGate'
import PageLoader from '../PageLoader'

const OBJECT_TYPE_EMOJI = {
  person: '🚶',
  dog: '🐕',
  cat: '🐈',
  car: '🚗'
}

const OBJECT_TYPE_LABEL = {
  person: 'Человек',
  dog: 'Собака',
  cat: 'Кошка',
  car: 'Машина'
}

export default function MotionEventsList({ camId, canDelete }) {
  const [events, setEvents] = useState([])
  const [total, setTotal] = useState(0)
  const [offset, setOffset] = useState(0)
  const [limit, setLimit] = useState(20)
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState(null)
  const gate = useLoadGate(loading, loadError)
  const [deleteId, setDeleteId] = useState(null)
  const [objectTypeFilter, setObjectTypeFilter] = useState(null)
  const toast = useToast()

  useEffect(() => {
    loadEvents()
  }, [camId, offset, limit, objectTypeFilter])

  async function loadEvents() {
    try {
      setLoading(true)
      setLoadError(null)
      const data = await listMotionEvents(camId, {
        limit,
        offset,
        object_type: objectTypeFilter
      })
      setEvents(data.events)
      setTotal(data.total)
    } catch (err) {
      toast.error(err.message || 'Ошибка загрузки событий')
      setLoadError(err.message || 'Ошибка загрузки событий')
    } finally {
      setLoading(false)
    }
  }

  async function handleDelete(eventId) {
    if (!canDelete) return
    try {
      await deleteMotionEvent(eventId)
      toast.success('Событие удалено')
      setDeleteId(null)
      loadEvents()
    } catch (err) {
      toast.error(err.message || 'Ошибка удаления события')
    }
  }

  function formatDate(timestamp) {
    const date = new Date(timestamp * 1000)
    return date.toLocaleString('ru-RU', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit'
    })
  }

  if (gate.busy && (events.length === 0 || gate.visible)) {
    return <PageLoader gate={gate} compact onRetry={loadEvents} />
  }

  return (
    <div className="motion-events">
      <div className="motion-events-header">
        <h3>События детекции движения</h3>
        <div className="motion-events-filters">
          <select
            aria-label="Тип события движения"
            value={objectTypeFilter || ''}
            onChange={(e) => {
              setObjectTypeFilter(e.target.value || null)
              setOffset(0)
            }}
          >
            <option value="">Все типы</option>
            <option value="person">Люди</option>
            <option value="dog">Собаки</option>
            <option value="cat">Кошки</option>
            <option value="car">Машины</option>
          </select>
        </div>
      </div>

      {events.length === 0 ? (
        <div className="motion-events-empty">Событий не найдено</div>
      ) : (
        <>
          <div className="motion-events-list">
            {events.map(event => (
              <div key={event.id} className="motion-event-card">
                <div className="motion-event-photo">
                  <MotionEventPhoto
                    eventId={event.id}
                    alt={`${OBJECT_TYPE_LABEL[event.object_type]} ${formatDate(event.detected_at)}`}
                  />
                </div>
                <div className="motion-event-info">
                  <div className="motion-event-type">
                    <span className="emoji">{OBJECT_TYPE_EMOJI[event.object_type]}</span>
                    <span className="label">{OBJECT_TYPE_LABEL[event.object_type]}</span>
                  </div>
                  <div className="motion-event-time">
                    {formatDate(event.detected_at)}
                  </div>
                  <div className="motion-event-confidence">
                    Уверенность: {Math.round(event.confidence * 100)}%
                  </div>
                  {event.license_plate && (
                    <div className="motion-event-plate">
                      Номер: {event.license_plate}
                    </div>
                  )}
                </div>
                {canDelete && <div className="motion-event-actions">
                  <Button onClick={() => setDeleteId(event.id)}>
                    Удалить
                  </Button>
                </div>}
              </div>
            ))}
          </div>

          <Pagination
            total={total}
            offset={offset}
            limit={limit}
            maxLimit={200}
            onChange={(patch) => {
              if (patch.limit != null) setLimit(patch.limit)
              if (patch.offset != null) setOffset(patch.offset)
            }}
          />
        </>
      )}

      <ConfirmDialog
        open={canDelete && deleteId != null}
        title="Удалить событие?"
        message="Событие и его фото будут удалены без возможности восстановления."
        onConfirm={() => handleDelete(deleteId)}
        onCancel={() => setDeleteId(null)}
      />
    </div>
  )
}
