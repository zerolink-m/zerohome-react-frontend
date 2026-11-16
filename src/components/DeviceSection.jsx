import { useEffect, useState } from 'react'
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
}) {
  const toast = useToast()
  const { uid } = useAuth()
  const [open, setOpen] = useState(defaultOpen)
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
          <span style={{ fontSize: 13, color: colors.white[4], width: 14, display: 'inline-block' }}>
            {open ? '▾' : '▸'}
          </span>
          <span style={{ fontSize: 18, fontWeight: 600 }}>{title}</span>
        </button>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          {headerAction}
          {iconSrc && (
            <MaskIcon src={iconSrc} size={22} color="var(--w70)" />
          )}
        </div>
      </div>

      {open && (
        <div style={{ marginTop: 20 }}>
          <SearchBar
            columns={SEARCH_COLUMNS[type]}
            labels={SEARCH_COLUMN_LABELS[type]}
            onSearch={(patch) => setFilter((f) => ({ ...f, offset: 0, ...patch }))}
          />

          {gate.busy ? (
            <PageLoader gate={gate} compact onRetry={() => setFilter((f) => ({ ...f }))} />
          ) : (
            <>
              {items.length === 0 && (
                <div style={{ fontSize: 13, color: colors.white[4], marginBottom: 12 }}>{emptyText}</div>
              )}
              <div
                style={{
                  display: 'grid',
                  gridTemplateColumns:
                    'repeat(auto-fill, minmax(min(100%, var(--custom-card-size, 280px)), 1fr))',
                  gap: 16,
                }}
              >
                {items.map((it) => (
                  <CardComponent key={it.id} {...{ [cardProp]: it }} />
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
        </div>
      )}
    </DashCard>
  )
}
