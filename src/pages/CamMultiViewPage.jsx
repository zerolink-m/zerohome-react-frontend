import { useEffect, useLayoutEffect, useRef, useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { listCams } from '../api/cams'
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

// Парсинг query string формата: grid=2x2&slots=id1,id2,id3,id4
function parseQuery(searchParams) {
  const grid = searchParams.get('grid') || '2x2'
  const slotsParam = searchParams.get('slots')
  const slots = slotsParam ? slotsParam.split(',').map(id => id === 'null' ? null : parseInt(id)) : []
  return { grid, slots }
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
  const gate = useLoadGate(loading)
  const [sidebarOpen, setSidebarOpen] = useState(true)
  const [isFullscreen, setIsFullscreen] = useState(false)

  // Query имеет приоритет над storage
  const queryConfig = parseQuery(searchParams)
  const hasQueryConfig = searchParams.has('grid') || searchParams.has('slots')
  const storageConfig = loadFromStorage()

  const initialConfig = hasQueryConfig ? queryConfig : (storageConfig || { grid: '2x2', slots: [] })

  const [grid, setGrid] = useState(initialConfig.grid)
  const [slots, setSlots] = useState(initialConfig.slots)
  const [draggedCamId, setDraggedCamId] = useState(null)
  const [draggedFromSlot, setDraggedFromSlot] = useState(null)

  const gridSize = parseInt(grid.split('x')[0])
  const totalSlots = gridSize * gridSize

  // Загрузка списка камер
  useEffect(() => {
    async function load() {
      try {
        setLoading(true)
        const data = await listCams()
        setCams(data.items || [])
      } catch (e) {
        toastRef.current.error(e.message)
      } finally {
        setLoading(false)
      }
    }
    load()
  }, [])

  // Обновление slots при изменении grid
  useEffect(() => {
    const newTotalSlots = gridSize * gridSize
    setSlots(prev => {
      const newSlots = [...prev]
      // Обрезаем или дополняем null
      if (newSlots.length > newTotalSlots) {
        return newSlots.slice(0, newTotalSlots)
      }
      while (newSlots.length < newTotalSlots) {
        newSlots.push(null)
      }
      return newSlots
    })
  }, [gridSize])

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
    const ro = new ResizeObserver(update)
    ro.observe(el)
    return () => ro.disconnect()
  }, [loading])

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

  // Drag & Drop handlers
  function handleDragStartFromList(camId) {
    setDraggedCamId(camId)
    setDraggedFromSlot(null)
  }

  function handleDragStartFromSlot(slotIndex, camId) {
    setDraggedCamId(camId)
    setDraggedFromSlot(slotIndex)
  }

  function handleDrop(slotIndex) {
    if (draggedCamId === null) return

    setSlots(prev => {
      const newSlots = [...prev]

      // Если перетащили из другого слота, очищаем старый слот
      if (draggedFromSlot !== null) {
        newSlots[draggedFromSlot] = null
      }

      // Если в целевом слоте уже есть камера, меняем их местами
      if (draggedFromSlot !== null && newSlots[slotIndex] !== null) {
        newSlots[draggedFromSlot] = newSlots[slotIndex]
      }

      newSlots[slotIndex] = draggedCamId
      return newSlots
    })

    setDraggedCamId(null)
    setDraggedFromSlot(null)
  }

  // Клик по камере в списке: ставим в первый свободный слот.
  function handleAddToFirstFreeSlot(camId) {
    const free = Array.from({ length: totalSlots }).findIndex((_, i) => slots[i] == null)
    if (free === -1) {
      toastRef.current.warning('Нет свободных слотов: увеличьте сетку или уберите камеру')
      return
    }
    setSlots(prev => {
      const next = [...prev]
      while (next.length < totalSlots) next.push(null)
      next[free] = camId
      return next
    })
  }

  function handleRemoveFromSlot(slotIndex) {
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
      <PageLoader gate={gate} />
    )
  }

  return (
    <div style={{ padding: isFullscreen ? 0 : 24, display: 'flex', flexDirection: 'column', gap: isFullscreen ? 0 : 24, height: '100vh', overflow: 'hidden' }}>
      {/* Заголовок и настройки - скрываем в fullscreen */}
      {!isFullscreen && (
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 16 }}>
          <h1 style={{ fontSize: 24, margin: 0 }}>Multi-View</h1>
          <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
            <SelectField
              label="Сетка"
              value={grid}
              onChange={(e) => setGrid(e.target.value)}
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
                <div
                  key={cam.id}
                  draggable
                  role="button"
                  tabIndex={0}
                  title="Нажмите, чтобы добавить в свободный слот, или перетащите"
                  onClick={() => handleAddToFirstFreeSlot(cam.id)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' || e.key === ' ') {
                      e.preventDefault()
                      handleAddToFirstFreeSlot(cam.id)
                    }
                  }}
                  onDragStart={() => handleDragStartFromList(cam.id)}
                  style={{
                    padding: 12,
                    background: 'var(--w05)',
                    borderRadius: 10,
                    cursor: 'pointer',
                    fontSize: 13,
                    color: 'var(--text)',
                    border: '1px solid var(--w15)',
                    transition: 'all 0.2s',
                  }}
                  onMouseEnter={(e) => (e.currentTarget.style.background = 'var(--w10)')}
                  onMouseLeave={(e) => (e.currentTarget.style.background = 'var(--w05)')}
                >
                  {cam.name || `Камера ${cam.id}`}
                </div>
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
                      style={{
                        position: 'absolute',
                        inset: 0,
                        cursor: 'grab',
                      }}
                      onMouseDown={(e) => e.currentTarget.style.cursor = 'grabbing'}
                      onMouseUp={(e) => e.currentTarget.style.cursor = 'grab'}
                    >
                      <VideoStreamUniversal camId={camId} authToken={accessToken} latencyOverlay />
                    </div>
                    <button
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
                    Перетащите камеру сюда или нажмите на неё в списке
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
