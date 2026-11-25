import { useEffect, useId, useMemo, useState } from 'react'
import { useToast } from '../context/ToastContext'
import { SEARCH_COLUMNS, SEARCH_COLUMN_LABELS, DEFAULT_LIMIT } from '../api/pagination'
import { useAuth } from '../context/AuthContext'
import { loadListSnapshot, saveListSnapshot } from '../api/snapshots'
import DashCard from './DashCard'
import SearchBar from './SearchBar'
import Pagination from './Pagination'
import AddDevicePlaceholder from './AddDevicePlaceholder'
import MaskIcon from './MaskIcon'
import { colors } from '../styles/tokens'
import { useLoadGate } from '../hooks/useLoadGate'
import PageLoader from './PageLoader'
import Button from './Button'

function readCardOrder(key) {
  if (!key) return []
  try {
    const order = JSON.parse(localStorage.getItem(key))
    return Array.isArray(order) ? order.filter((id) => typeof id === 'string') : []
  } catch {
    return []
  }
}

// Переиспользуемая сворачиваемая секция устройства (камеры/выключатели/соединения).
// props:
//   title          — заголовок секции
//   type           — ключ для SEARCH_COLUMNS/SEARCH_COLUMN_LABELS ('cams' | 'switches' | 'connections')
//   load           — функция загрузки (filter) => Promise<{items,total}>
//   CardComponent  — компонент карточки элемента
//   cardProp       — имя пропа, под которым элемент передаётся в карточку ('cam' | 'switchItem' | 'connection')
//   createTo       — маршрут кнопки создания (для плейсхолдера)
//   createText     — подпись плейсхолдера ("+ Добавить …")
//   emptyText      — текст при отсутствии элементов (плейсхолдер всё равно рендерится)
//   ownerUid       — если задан, элементы фильтруются по ownuser === ownerUid (клиентский фильтр)
//   iconSrc        — путь к иконке заголовка (справа от <h2>)
//   addOptions     — [{ label, protoKey }]: если задан, плейсхолдер открывает меню
//   defaultOpen    — начально развёрнута (по умолчанию true)
//   sectionId      — id корневого DOM-элемента (для hash-based back-navigation)
//   forceOpen      — если true, секция принудительно разворачивается (для hash-скролла)
//   headerAction   — дополнительный элемент в заголовке (между title и iconSrc)
export default function DeviceSection({
  title,
  type,
  load,
  CardComponent,
  cardProp,
  createTo,
  createText,
  emptyText,
  ownerUid,
  iconSrc,
  addOptions,
  defaultOpen = true,
  sectionId,
  forceOpen,
  headerAction,
  reorderable = false,
}) {
  const toast = useToast()
  const { uid } = useAuth()
  const [open, setOpen] = useState(defaultOpen)
  const contentId = useId()
  const orderKey = reorderable && uid != null ? `zc-card-order:${uid}:${type}` : null
  const storedOrder = useMemo(() => readCardOrder(orderKey), [orderKey])
  const [cardOrder, setCardOrder] = useState(null)
  const [orderMode, setOrderMode] = useState(false)
  const [orderMessage, setOrderMessage] = useState('')
  const order = cardOrder?.key === orderKey ? cardOrder.ids : storedOrder
  const [filter, setFilter] = useState({ offset: 0, limit: DEFAULT_LIMIT })
  // Снимок прошлого ответа показывается сразу, свежие данные всё равно запрашиваются (см. api/snapshots.js).
  const [initialSnap] = useState(() => loadListSnapshot(uid, type, { offset: 0, limit: DEFAULT_LIMIT }))
  const [data, setData] = useState(initialSnap || { items: [], total: 0 })
  const [dataUid, setDataUid] = useState(uid)
  const [loading, setLoading] = useState(!initialSnap)
  const [loadError, setLoadError] = useState(null)
  const gate = useLoadGate(loading, loadError)

  // Форсированное раскрытие (по hash-навигации из детальных страниц).
  useEffect(() => {
    if (forceOpen) setOpen(true)
  }, [forceOpen])

  useEffect(() => {
    let cancelled = false
    async function run() {
      // Результаты поиска не сохраняем: снимок только для обычных страниц списка.
      const snapshottable = !filter.search
      const snap = snapshottable ? loadListSnapshot(uid, type, filter) : null
      if (snap) {
        setData(snap)
        setDataUid(uid)
        setLoading(false)
      } else {
        setLoading(true)
      }
      setLoadError(null)
      try {
        const res = await load(filter)
        if (!cancelled) {
          setData(res)
          setDataUid(uid)
          if (snapshottable) saveListSnapshot(uid, type, filter, res)
        }
      } catch (e) {
        if (!cancelled) {
          // Есть снимок — оставляем его и сообщаем тостом; нет данных — красный этап с «Повторить».
          if (snap) toast.error(e.message)
          else setLoadError(e.message)
        }
      } finally {
        if (!cancelled) setLoading(false)
      }
    }
    run()
    return () => {
      cancelled = true
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filter, uid])

  // Клиентская фильтрация по владельцу отключена - показываем все устройства
  const items = dataUid === uid ? data.items : []
  const positions = new Map(order.map((id, index) => [id, index]))
  const orderedItems = order.length ? [...items].sort((a, b) =>
    (positions.get(String(a.id)) ?? Infinity) - (positions.get(String(b.id)) ?? Infinity)) : items

  function saveOrder(ids) {
    setCardOrder({ key: orderKey, ids })
    try {
      if (ids.length) localStorage.setItem(orderKey, JSON.stringify(ids))
      else localStorage.removeItem(orderKey)
      return true
    } catch {
      return false
    }
  }

  function moveCard(index, delta, control) {
    const nextIndex = index + delta
    if (nextIndex < 0 || nextIndex >= orderedItems.length) return
    const ids = orderedItems.map((item) => String(item.id))
    const [moved] = ids.splice(index, 1)
    ids.splice(nextIndex, 0, moved)
    const current = new Set(ids)
    // Keep preferences for other pages. Changes affect only cards on the visible page.
    const saved = saveOrder([...ids, ...order.filter((id) => !current.has(id))])
    const name = orderedItems[index].name || `#${moved}`
    setOrderMessage(`${name}: позиция ${nextIndex + 1} из ${ids.length}.${saved ? '' : ' Браузер не сохранил порядок.'}`)
    requestAnimationFrame(() => { if (control.isConnected) control.focus({ preventScroll: true }) })
  }

  return (
    <DashCard style={{ marginBottom: 24 }} id={sectionId}>
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          gap: 12,
          flexWrap: 'wrap',
        }}
      >
        <button
          type="button"
          aria-expanded={open}
          aria-controls={contentId}
          onClick={() => setOpen((v) => !v)}
          style={{
            background: 'none',
            border: 'none',
            color: 'inherit',
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            gap: 10,
            padding: 0,
            fontFamily: 'inherit',
          }}
        >
          <span aria-hidden="true" style={{ fontSize: 13, color: colors.white[4], width: 14, display: 'inline-block' }}>
            {open ? '▾' : '▸'}
          </span>
          <span style={{ fontSize: '1.125rem', fontWeight: 600 }}>{title}</span>
        </button>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          {headerAction}
          {iconSrc && (
            <MaskIcon src={iconSrc} size={22} color="var(--w70)" />
          )}
        </div>
      </div>

      <div id={contentId} hidden={!open} style={{ marginTop: 20 }}>
      {open && (
        <>
          <SearchBar
            columns={SEARCH_COLUMNS[type]}
            labels={SEARCH_COLUMN_LABELS[type]}
            appliedFilter={filter}
            onSearch={(patch) => setFilter((f) => ({ ...f, offset: 0, search_method: null, ...patch }))}
          />

          {gate.busy ? (
            <PageLoader gate={gate} compact onRetry={() => setFilter((f) => ({ ...f }))} />
          ) : (
            <>
              {items.length === 0 && (
                <div style={{ fontSize: 13, color: colors.white[4], marginBottom: 12 }}>{emptyText}</div>
              )}
              {orderKey && (items.length > 1 || order.length > 0) && (
                <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 8, marginBottom: 12 }}>
                  <Button small aria-pressed={orderMode} onClick={() => setOrderMode((mode) => !mode)}>Порядок карточек</Button>
                  {orderMode && <Button small disabled={!order.length} onClick={() => {
                    const saved = saveOrder([])
                    setOrderMessage(saved ? 'Восстановлен исходный порядок.' : 'Порядок сброшен только на этой странице.')
                  }}>Сбросить порядок</Button>}
                  {orderMode && <span style={{ fontSize: '0.75rem', color: 'var(--muted-text)' }}>Перемещайте карточки на текущей странице. Порядок сохраняется в этом браузере.</span>}
                  <span role="status" className="sr-only">{orderMessage}</span>
                </div>
              )}
              <div
                style={{
                  display: 'grid',
                  gridTemplateColumns:
                    'repeat(auto-fill, minmax(min(100%, var(--card-size)), 1fr))',
                  gap: 16,
                }}
              >
                {orderedItems.map((it, index) => (
                  <div key={it.id} className="device-grid-item">
                    <CardComponent {...{ [cardProp]: it }} />
                    {orderKey && orderMode && <div role="group" aria-label={`Порядок карточки: ${it.name || `#${it.id}`}`} style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                      <Button small disabled={index === 0} onClick={(event) => moveCard(index, -1, event.currentTarget)}>Раньше</Button>
                      <Button small disabled={index === orderedItems.length - 1} onClick={(event) => moveCard(index, 1, event.currentTarget)}>Позже</Button>
                    </div>}
                  </div>
                ))}
                <AddDevicePlaceholder
                  createTo={createTo}
                  createText={createText}
                  addOptions={addOptions}
                />
              </div>
            </>
          )}

          <Pagination
            offset={filter.offset}
            limit={filter.limit}
            total={data.total}
            onChange={(patch) => setFilter((f) => ({ ...f, ...patch }))}
          />
        </>
      )}
      </div>
    </DashCard>
  )
}
