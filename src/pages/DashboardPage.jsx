import { useCallback, useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { listCams } from '../api/cams'
import { listSwitches } from '../api/switches'
import { listConnections } from '../api/connections'
import CamCard from '../components/cams/CamCard'
import SwitchCard from '../components/switches/SwitchCard'
import ConnectionCard from '../components/connections/ConnectionCard'
import DeviceSection from '../components/DeviceSection'
import Button from '../components/Button'
import { useDashboardRefreshKey } from '../utils/dashboardRefresh'

// Tuya Cloud нельзя создавать вручную — такие выключатели появляются только
// автоматически из соединений. В форме создания оставляем только локальные
// протоколы.
const SWITCH_ADD_OPTIONS = [
  { label: 'Tuya Local', protoKey: 'tuya_local' },
  { label: 'Пользовательский HTTP', protoKey: 'custom' },
]

const SECTION_IDS = ['cams', 'switches', 'connections']

export default function DashboardPage() {
  const { uid } = useAuth()
  const navigate = useNavigate()
  // Меняется при клике по логотипу на главной: секции перемонтируются и заново грузят данные.
  const refreshKey = useDashboardRefreshKey()
  // Форсированное раскрытие секции по hash: sectionId либо null.
  const [forceOpen, setForceOpen] = useState(null)
  const scrolledForRef = useRef(null)
  const [isLargeScreen, setIsLargeScreen] = useState(false)

  // Определяем большой экран
  useEffect(() => {
    const checkScreenSize = () => {
      setIsLargeScreen(window.innerWidth >= 700)
    }

    checkScreenSize()
    window.addEventListener('resize', checkScreenSize)

    return () => window.removeEventListener('resize', checkScreenSize)
  }, [])

  const applyHash = useCallback(() => {
    const hash = (window.location.hash || '').replace(/^#/, '')
    if (!SECTION_IDS.includes(hash)) return
    setForceOpen(hash)
    // DOM может быть ещё не отрендерен (пришли с другой страницы) — ждём кадр.
    requestAnimationFrame(() => {
      const el = document.getElementById(hash)
      if (el && scrolledForRef.current !== hash) {
        el.scrollIntoView({ block: 'start', behavior: 'smooth' })
        scrolledForRef.current = hash
      }
    })
  }, [])

  useEffect(() => {
    applyHash()
    window.addEventListener('hashchange', applyHash)
    return () => window.removeEventListener('hashchange', applyHash)
  }, [applyHash])

  return (
    <div>
      <h1 style={{ fontSize: 20, marginBottom: 24 }}>Устройства</h1>

      <DeviceSection
        key={`cams-${refreshKey}`}
        sectionId="cams"
        title="Камеры"
        type="cams"
        load={listCams}
        CardComponent={CamCard}
        cardProp="cam"
        createTo="/cams/new"
        createText="+ Добавить камеру"
        emptyText="Камеры не найдены"
        iconSrc="/static-a-content/icons/cams.svg"
        forceOpen={forceOpen === 'cams'}
        headerAction={
          isLargeScreen && (
            <Button
              small
              onClick={() => navigate('/cams/multi-view')}
              style={{ fontSize: 11 }}
            >
              Multi-View
            </Button>
          )
        }
      />

      {/* Выключатели показываем ТОЛЬКО текущего пользователя (даже для admin).
          API не поддерживает серверный фильтр по владельцу — фильтруем по ownuser
          на клиенте внутри DeviceSection (см. TODO там).
          Плоская модель: и мастер, и его каналы — отдельные карточки со своим
          тумблером (мастер шлёт команду на все каналы, канал — на себя). */}
      <DeviceSection
        key={`switches-${refreshKey}`}
        sectionId="switches"
        title="Выключатели"
        type="switches"
        load={listSwitches}
        CardComponent={SwitchCard}
        cardProp="switchItem"
        createTo="/switches/new"
        createText="+ Добавить выключатель"
        emptyText="Выключатели не найдены"
        ownerUid={uid}
        iconSrc="/static-a-content/icons/switches.svg"
        addOptions={SWITCH_ADD_OPTIONS}
        forceOpen={forceOpen === 'switches'}
      />

      <DeviceSection
        key={`connections-${refreshKey}`}
        sectionId="connections"
        title="Соединения"
        type="connections"
        load={listConnections}
        CardComponent={ConnectionCard}
        cardProp="connection"
        createTo="/connections/new"
        createText="+ Добавить соединение"
        emptyText="Соединений нет"
        iconSrc="/static-a-content/icons/connections.svg"
        forceOpen={forceOpen === 'connections'}
      />
    </div>
  )
}
