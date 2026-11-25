import { useEffect, useLayoutEffect, useRef, useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router'
import { useAuth } from '../context/AuthContext'
import { listCams } from '../api/cams'
import { LIMIT_MAX } from '../api/pagination'
import { useToast } from '../context/ToastContext'
import VideoStreamUniversal from '../components/cams/VideoStreamUniversal'
import Button from '../components/Button'
import SelectField from '../components/SelectField'
import { colors } from '../styles/tokens'
import { useLoadGate } from '../hooks/useLoadGate'
import PageLoader from '../components/PageLoader'

const GRID_OPTIONS = [
  { value: '1x1', label: '1×1 (1 камера)' },
  { value: '2x2', label: '2×2 (4 камеры)' },
  { value: '3x3', label: '3×3 (9 камер)' },
]

const STORAGE_KEY = 'multiview_config'

function normalizeSlots(values, count) {
  const ids = new Set()
  return Array.from({ length: count }, (_, index) => {
    const value = values[index]
    const id = typeof value === 'number' || /^\d+$/.test(value) ? Number(value) : NaN
    if (!Number.isSafeInteger(id) || id < 1 || ids.has(id)) return null
    ids.add(id)
    return id
  })
}

function normalizeLayout(config) {
  const grid = GRID_OPTIONS.some(option => option.value === config?.grid) ? config.grid : '2x2'
  return { grid, slots: normalizeSlots(Array.isArray(config?.slots) ? config.slots : [], Number(grid[0]) ** 2) }
}

function parseQuery(searchParams) {
  return normalizeLayout({ grid: searchParams.get('grid'), slots: searchParams.get('slots')?.split(',', 9) })
}

// Загрузка конфига из localStorage
function loadFromStorage() {
  try {
    const stored = localStorage.getItem(STORAGE_KEY)
    if (stored) {
      return JSON.parse(stored)
    }
  } catch (e) {
    console.warn('Failed to load multiview config from storage', e)
  }
  return null
}

// Сохранение в localStorage
function saveToStorage(config) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(config))
  } catch (e) {
    console.warn('Failed to save multiview config to storage', e)
  }
}

// Генерация query string
function buildQueryString(grid, slots) {
  const slotsStr = slots.map(id => id === null ? 'null' : id).join(',')
  return `?grid=${grid}&slots=${slotsStr}`
}

export default function CamMultiViewPage() {
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const { accessToken } = useAuth()
  const toast = useToast()
  // toast-объект пересоздаётся при каждом показе уведомления — через ref, чтобы это не перезагружало камеры.
  const toastRef = useRef(toast)
  toastRef.current = toast

  const [cams, setCams] = useState([])
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState(null)
  const [retry, setRetry] = useState(0)
  const gate = useLoadGate(loading, loadError)
  const [sidebarOpen, setSidebarOpen] = useState(true)
  const [isFullscreen, setIsFullscreen] = useState(false)

  const [{ grid, slots }, setLayout] = useState(() => (
    searchParams.has('grid') || searchParams.has('slots') ? parseQuery(searchParams) : normalizeLayout(loadFromStorage())
  ))
  const setSlots = (update) => setLayout(current => ({ ...current, slots: update(current.slots) }))
  const [targetSlot, setTargetSlot] = useState('')
  const [sourceSlot, setSourceSlot] = useState('')
  const [draggedCamId, setDraggedCamId] = useState(null)
  const [draggedFromSlot, setDraggedFromSlot] = useState(null)

  const gridSize = Number(grid[0])
  const totalSlots = gridSize * gridSize

  // Загрузка списка камер
  useEffect(() => {
    let cancelled = false
    async function load() {
      setLoading(true)
      setLoadError(null)
      try {
        const all = new Map()
        let offset = 0
        while (!cancelled) {
          const { items, total } = await listCams({ limit: LIMIT_MAX, offset, sort_by: 'id', order: 'asc' })
          if (cancelled) return
          for (const cam of items) all.set(cam.id, cam)
          offset += items.length
          if (!items.length || offset >= total) break
        }
        if (!cancelled) setCams([...all.values()])
      } catch (e) {
        if (!cancelled) setLoadError(e.message || 'Не удалось загрузить список камер')
      } finally {
        if (!cancelled) setLoading(false)
      }
    }
    load()
    return () => { cancelled = true }
  }, [retry])

  function changeGrid(value) {
    setLayout(current => normalizeLayout({ grid: value, slots: current.slots }))
    setSourceSlot('')
    setTargetSlot('')
  }

  // Сохранение и обновление URL
  useEffect(() => {
    const config = { grid, slots }
    saveToStorage(config)

    // Обновляем URL без перезагрузки страницы
    const newQuery = buildQueryString(grid, slots)
    if (window.location.search !== newQuery) {
      navigate(`/cams/multi-view${newQuery}`, { replace: true })
    }
  }, [grid, slots, navigate])

  // Размер сетки подгоняется под область просмотра: ячейки всегда 16:9 и целиком помещаются
  // (без растягивания и прокрутки), в том числе в полноэкранном режиме.
  const areaRef = useRef(null)
  const [areaSize, setAreaSize] = useState({ w: 0, h: 0 })
  useLayoutEffect(() => {
    const el = areaRef.current
    if (!el) return
    const update = () => setAreaSize({ w: el.clientWidth, h: el.clientHeight })
    update()
    if (typeof ResizeObserver !== 'undefined') {
      const ro = new ResizeObserver(update)
      ro.observe(el)
      return () => ro.disconnect()
    }
    window.addEventListener('resize', update)
    return () => window.removeEventListener('resize', update)
  }, [gate.busy, sidebarOpen, isFullscreen])

  const gap = isFullscreen ? 0 : 16
  const cellW = Math.max(
    0,
    Math.min(
      (areaSize.w - gap * (gridSize - 1)) / gridSize,
      ((areaSize.h - gap * (gridSize - 1)) / gridSize) * (16 / 9),
    ),
  )
  const cellH = (cellW * 9) / 16
  const gridW = Math.floor(cellW * gridSize + gap * (gridSize - 1))
  const gridH = Math.floor(cellH * gridSize + gap * (gridSize - 1))

  // Камеры, которые уже используются в слотах
  const usedCamIds = new Set(slots.filter(id => id !== null))

  // Доступные камеры (не используются в слотах)
  const availableCams = cams.filter(cam => cam.enabled === 1 && !usedCamIds.has(cam.id))
  const slotOptions = slots.map((camId, index) => ({
    value: String(index),
    label: `Слот ${index + 1}${camId != null ? ` · ${cams.find(cam => cam.id === camId)?.name || `Камера ${camId}`}` : ''}`,
  }))

  // Drag & Drop handlers
  function handleDragStartFromList(camId) {
    setDraggedCamId(camId)
    setDraggedFromSlot(null)
  }

  function handleDragStartFromSlot(slotIndex, camId) {
    setDraggedCamId(camId)
    setDraggedFromSlot(slotIndex)
  }

  function clearDrag() {
    setDraggedCamId(null)
    setDraggedFromSlot(null)
  }

  function placeCamera(camId, target, source = null) {
    if (source === target) return
    setSlots(prev => {
      const next = [...prev]
      if (source !== null) next[source] = prev[target]
      next[target] = camId
      return next
    })
    setSourceSlot('')
  }

  function handleDrop(slotIndex) {
    if (draggedCamId !== null) placeCamera(draggedCamId, slotIndex, draggedFromSlot)
    clearDrag()
  }

  function handleAddCamera(camId) {
    const free = targetSlot === '' ? slots.findIndex(id => id == null) : Number(targetSlot)
    if (free === -1) {
      toastRef.current.warning('Нет свободных слотов: увеличьте сетку или уберите камеру')
      return
    }
    placeCamera(camId, free)
  }

  function handleRemoveFromSlot(slotIndex) {
    if (sourceSlot === String(slotIndex)) setSourceSlot('')
    setSlots(prev => {
      const newSlots = [...prev]
      newSlots[slotIndex] = null
      return newSlots
    })
  }

  function toggleFullscreen() {
    if (!document.fullscreenElement) {
      document.documentElement.requestFullscreen().then(() => {
        setIsFullscreen(true)
      }).catch(err => {
        toast.error('Не удалось войти в полноэкранный режим')
      })
    } else {
      document.exitFullscreen().then(() => {
        setIsFullscreen(false)
      })
    }
  }

  // Отслеживаем выход из fullscreen по ESC
  useEffect(() => {
    function handleFullscreenChange() {
      setIsFullscreen(!!document.fullscreenElement)
    }

    document.addEventListener('fullscreenchange', handleFullscreenChange)
    return () => document.removeEventListener('fullscreenchange', handleFullscreenChange)
  }, [])

  if (gate.busy) {
    return (
      <PageLoader gate={gate} onRetry={() => setRetry(value => value + 1)} />
    )
  }

  return (
    <div style={{ padding: isFullscreen ? 0 : 24, display: 'flex', flexDirection: 'column', gap: isFullscreen ? 0 : 24, height: '100vh', overflow: 'hidden' }}>
      {/* Заголовок и настройки - скрываем в fullscreen */}
      {!isFullscreen && (
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 16 }}>
          <h1 style={{ fontSize: 24, margin: 0 }}>Multi-View</h1>
          <div style={{ display: 'flex', gap: 12, alignItems: 'center', flexWrap: 'wrap' }}>
            <SelectField
              label="Сетка"
              value={grid}
              onChange={(e) => changeGrid(e.target.value)}
              options={GRID_OPTIONS}
              style={{ minWidth: 150 }}
            />
            <Button onClick={toggleFullscreen}>
              Полный экран
            </Button>
            <Button onClick={() => navigate('/')}>Назад</Button>
          </div>
        </div>
      )}

      {!isFullscreen && <div style={{ display: 'flex', flexWrap: 'wrap', gap: 12, alignItems: 'center' }}>
        <SelectField label="Куда поставить камеру" value={targetSlot} onChange={(event) => setTargetSlot(event.target.value)} options={[{ value: '', label: 'Первый свободный слот' }, ...slotOptions]} />
        <SelectField label="Какую камеру переставить" value={sourceSlot} onChange={(event) => setSourceSlot(event.target.value)} options={[{ value: '', label: 'Выберите слот' }, ...slotOptions.filter((_, index) => slots[index] != null)]} />
        <Button small disabled={sourceSlot === '' || targetSlot === '' || sourceSlot === targetSlot} onClick={() => placeCamera(slots[Number(sourceSlot)], Number(targetSlot), Number(sourceSlot))}>
          Переставить
        </Button>
      </div>}

      {/* Основной контент */}
      <div style={{ display: 'flex', gap: isFullscreen ? 0 : 24, flex: 1, overflow: 'hidden', position: 'relative' }}>
        {/* Список доступных камер - скрываем в fullscreen */}
        {!isFullscreen && (sidebarOpen ? (
          <div
            style={{
              width: "clamp(200px, 28vw, 280px)",
              background: 'var(--card-bg)',
              border: '1px solid var(--card-border)',
              borderRadius: 16,
              padding: 16,
              overflowY: 'auto',
              display: 'flex',
              flexDirection: 'column',
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
              <h3 style={{ fontSize: 14, margin: 0, color: 'var(--text)' }}>
                Доступные камеры
              </h3>
              <button
                type="button"
                aria-label="Свернуть список камер"
                onClick={() => setSidebarOpen(false)}
                style={{
                  background: 'none',
                  border: 'none',
                  color: 'var(--w70)',
                  cursor: 'pointer',
                  fontSize: 16,
                  padding: 4,
                }}
              >
                ◀
              </button>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {availableCams.map(cam => (
                <button
                  key={cam.id}
                  type="button"
                  draggable
                  title="Добавить камеру в выбранный слот или перетащить"
                  onClick={() => handleAddCamera(cam.id)}
                  onDragStart={() => handleDragStartFromList(cam.id)}
                  onDragEnd={clearDrag}
                  style={{
                    padding: 12,
                    background: 'var(--w05)',
                    borderRadius: 10,
                    cursor: 'pointer',
                    fontSize: 13,
                    textAlign: 'start',
                    color: 'var(--text)',
                    border: '1px solid var(--w15)',
                    transition: 'all 0.2s',
                  }}
                  onMouseEnter={(e) => (e.currentTarget.style.background = 'var(--w10)')}
                  onMouseLeave={(e) => (e.currentTarget.style.background = 'var(--w05)')}
                >
                  {cam.name || `Камера ${cam.id}`}
                </button>
              ))}
              {availableCams.length === 0 && (
                <div style={{ fontSize: 12, color: 'var(--w70)', textAlign: 'center', padding: 16 }}>
                  Все камеры использованы
                </div>
              )}
            </div>
          </div>
        ) : (
          <button
            type="button"
            aria-label="Раскрыть список камер"
            onClick={() => setSidebarOpen(true)}
            style={{
              width: 40,
              background: 'var(--card-bg)',
              borderRadius: 16,
              border: '1px solid var(--card-border)',
              color: 'var(--w70)',
              cursor: 'pointer',
              fontSize: 16,
              padding: 8,
            }}
          >
            ▶
          </button>
        ))}

        {/* Плавающая кнопка выхода из fullscreen */}
        {isFullscreen && (
          <button
            onClick={toggleFullscreen}
            style={{
              position: 'fixed',
              top: 16,
              right: 16,
              zIndex: 100,
              background: 'rgba(0,0,0,0.8)',
              border: '1px solid rgba(255,255,255,0.35)',
              borderRadius: 8,
              color: '#fff', // кнопка на тёмной подложке поверх видео в любой теме
              fontSize: 12,
              padding: '8px 16px',
              cursor: 'pointer',
              backdropFilter: 'blur(10px)',
            }}
          >
            Выйти из полного экрана (ESC)
          </button>
        )}

        {/* Сетка просмотра */}
        <div
          ref={areaRef}
          style={{
            flex: 1,
            minWidth: 0,
            minHeight: 0,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            overflow: 'hidden',
          }}
        >
        <div
          style={{
            width: gridW,
            height: gridH,
            display: 'grid',
            gridTemplateColumns: `repeat(${gridSize}, minmax(0, 1fr))`,
            gridTemplateRows: `repeat(${gridSize}, minmax(0, 1fr))`,
            gap,
          }}
        >
          {Array.from({ length: totalSlots }).map((_, index) => {
            const camId = slots[index]
            const cam = cams.find(c => c.id === camId)

            return (
              <div
                key={index}
                onDragOver={(e) => e.preventDefault()}
                onDrop={() => handleDrop(index)}
                style={{
                  background: 'var(--card-bg)',
                  borderRadius: isFullscreen ? 0 : 14,
                  border: isFullscreen && cam ? 'none' : `2px dashed ${cam ? colors.white[2] : colors.white[15]}`,
                  position: 'relative',
                  minWidth: 0,
                  minHeight: 0,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  overflow: 'hidden',
                }}
              >
                {cam ? (
                  <>
                    <div
                      draggable
                      onDragStart={() => handleDragStartFromSlot(index, camId)}
                      onDragEnd={clearDrag}
                      style={{
                        position: 'absolute',
                        inset: 0,
                        cursor: 'grab',
                      }}
                      onMouseDown={(e) => e.currentTarget.style.cursor = 'grabbing'}
                      onMouseUp={(e) => e.currentTarget.style.cursor = 'grab'}
                    >
                      <VideoStreamUniversal key={camId} camId={camId} authToken={accessToken} latencyOverlay />
                    </div>
                    <button
                      type="button"
                      aria-label={`Убрать камеру из слота ${index + 1}`}
                      onClick={() => handleRemoveFromSlot(index)}
                      style={{
                        position: 'absolute',
                        top: 8,
                        right: 8,
                        background: 'rgba(0,0,0,0.7)',
                        border: '1px solid rgba(255,255,255,0.15)',
                        borderRadius: 6,
                        color: colors.statuses.red.text,
                        fontSize: 11,
                        padding: '4px 8px',
                        cursor: 'pointer',
                        zIndex: 10,
                      }}
                    >
                      ✕
                    </button>
                  </>
                ) : (
                  <div style={{ fontSize: 12, color: 'var(--w55)', textAlign: 'center', padding: 16 }}>
                    Слот {index + 1}. Выберите его и нажмите на камеру в списке.
                  </div>
                )}
              </div>
            )
          })}
        </div>
        </div>
      </div>
    </div>
  )
}
