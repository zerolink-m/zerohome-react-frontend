import { Link } from 'react-router-dom'
import { listCams } from '../api/cams'
import { listSwitches } from '../api/switches'
import CamCard from '../components/cams/CamCard'
import SwitchCard from '../components/switches/SwitchCard'
import DeviceSection from '../components/DeviceSection'
import DashCard from '../components/DashCard'
import Button from '../components/Button'
import { colors } from '../styles/tokens'

function AdminToolCard({ title, description, to, action = 'Настроить' }) {
  return (
    <DashCard style={{ minHeight: 150, display: 'flex', flexDirection: 'column', justifyContent: 'space-between', gap: 20 }}>
      <div>
        <div style={{ fontSize: 16, fontWeight: 600 }}>{title}</div>
        <div style={{ fontSize: 12, lineHeight: 1.6, color: colors.white[4], marginTop: 8 }}>{description}</div>
      </div>
      <Link to={to} style={{ alignSelf: 'flex-start', textDecoration: 'none' }}>
        <Button variant="accent" small>{action}</Button>
      </Link>
    </DashCard>
  )
}

export default function AdminPage() {
  return (
    <div>
      <h1 style={{ fontSize: 20, marginBottom: 24 }}>Админ-панель</h1>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: 16, marginBottom: 24 }}>
        <DashCard>
          <div
            style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              gap: 12,
              flexWrap: 'wrap',
            }}
          >
            <div>
              <div style={{ fontSize: 18, fontWeight: 600 }}>Пользователи</div>
              <div style={{ fontSize: 12, color: colors.white[4], marginTop: 4 }}>
                Управление учётными записями и сессиями
              </div>
            </div>
            <Link to="/admin/users">
              <Button variant="accent" small>
                Открыть
              </Button>
            </Link>
          </div>
        </DashCard>

        <DashCard>
          <div
            style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              gap: 12,
              flexWrap: 'wrap',
            }}
          >
            <div>
              <div style={{ fontSize: 18, fontWeight: 600 }}>Статистика</div>
              <div style={{ fontSize: 12, color: colors.white[4], marginTop: 4 }}>
                Системная статистика и метрики
              </div>
            </div>
            <Link to="/admin/stats">
              <Button variant="accent" small>
                Открыть
              </Button>
            </Link>
          </div>
        </DashCard>
      </div>

      <section aria-labelledby="admin-system-tools" style={{ marginBottom: 32 }}>
        <div style={{ marginBottom: 14 }}>
          <h2 id="admin-system-tools" style={{ fontSize: 16, margin: '0 0 5px' }}>Управление системой</h2>
          <div style={{ fontSize: 12, color: colors.white[4] }}>Настройки, конфигурация нод и состояние кластера</div>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 260px), 1fr))', gap: 16 }}>
          <AdminToolCard
            title="Настройки системы"
            description="Изменение разрешённых глобальных параметров. Чувствительные значения скрыты сервером."
            to="/admin/settings"
          />
          <AdminToolCard
            title="Ноды"
            description="Список серверных нод, доступность, локальные настройки и политики возможностей."
            to="/admin/nodes"
          />
          <AdminToolCard
            title="Кластер и назначения"
            description="Состояние кластера, распределение ресурсов и причины неназначенных задач."
            to="/admin/cluster"
            action="Открыть обзор"
          />
        </div>
      </section>

      {/* Admin видит на бэке все устройства всех пользователей — фильтр по владельцу
          не задаём (ownerUid не передаём). */}
      <DeviceSection
        title="Все камеры"
        type="cams"
        load={listCams}
        CardComponent={CamCard}
        cardProp="cam"
        createTo="/cams/new"
        createText="+ Добавить камеру"
        emptyText="Камеры не найдены"
      />

      <DeviceSection
        title="Все выключатели"
        type="switches"
        load={listSwitches}
        CardComponent={SwitchCard}
        cardProp="switchItem"
        createTo="/switches/new"
        createText="+ Добавить выключатель"
        emptyText="Выключатели не найдены"
      />
    </div>
  )
}
