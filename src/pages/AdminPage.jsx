import { Link } from 'react-router-dom'
import { listCams } from '../api/cams'
import { listSwitches } from '../api/switches'
import CamCard from '../components/cams/CamCard'
import SwitchCard from '../components/switches/SwitchCard'
import DeviceSection from '../components/DeviceSection'
import DashCard from '../components/DashCard'
import Button from '../components/Button'
import { colors } from '../styles/tokens'

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
