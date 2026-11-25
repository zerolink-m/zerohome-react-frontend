import { useEffect, useState } from 'react'
import { useLocation, useNavigate } from 'react-router'
import { useAuth } from '../context/AuthContext'
import { useTheme } from '../context/ThemeContext'
import Button from '../components/Button'
import DashCard from '../components/DashCard'
import Spinner from '../components/Spinner'
import { markSetupComplete } from '../utils/setupStatus'

const STEPS = [
  { title: 'Облегчённый режим', description: 'Уменьшает анимации и визуальные эффекты. Подойдёт, если устройство работает медленно или вы предпочитаете спокойный интерфейс.' },
  { title: 'Оптимизация увеличения', description: 'Делает панель навигации компактной и убирает логотип. Это оставляет больше места на телефоне при увеличенном масштабе экрана.' },
  { title: 'Протокол видео', description: 'Выберите, какой протокол пробовать первым. Если он недоступен, приложение автоматически перейдёт к другому.' },
  { title: 'Оформление', description: 'Выберите удобную тему. Изменить её и другие параметры можно позже в профиле.' },
]

function Choice({ selected, onClick, children }) {
  return <button type="button" className={`setup-choice${selected ? ' setup-choice-selected' : ''}`} aria-pressed={selected} onClick={onClick}>{children}</button>
}

export default function SetupPage() {
  const { uid, refreshProfile } = useAuth()
  const { performanceMode, setPerformanceMode, zoomOptimization, setZoomOptimization, preferredStreamFormat, setPreferredStreamFormat, themeMode, setThemeMode } = useTheme()
  const [step, setStep] = useState(0)
  const location = useLocation()
  const navigate = useNavigate()
  const fromLogin = location.state?.afterLogin === true
  const target = location.state?.returnTo
  const destination = fromLogin && typeof target === 'string' && target.startsWith('/') && !target.startsWith('//') && !target.startsWith('/setup') ? target : fromLogin ? '/' : '/account'

  useEffect(() => {
    if (uid == null) refreshProfile()
  }, [uid, refreshProfile])

  const finish = () => {
    markSetupComplete(uid)
    navigate(destination, { replace: true })
  }

  if (uid == null) {
    return <div className="setup-page"><div className="setup-wait"><Spinner label="Загружаем профиль…" /><Button onClick={refreshProfile}>Повторить</Button></div></div>
  }

  return (
    <div className="setup-page">
      <div className="setup-header">
        <span className="setup-eyebrow">ПЕРВЫЙ ЗАПУСК · 4 ШАГА</span>
        <h1>Настроим приложение под вас</h1>
        <p>Только полезные параметры. Любой шаг можно изменить позже в профиле.</p>
      </div>
      <nav className="setup-progress" aria-label="Шаги первичной настройки">
        {STEPS.map((item, index) => (
          <div key={item.title} className={`setup-progress-step${index === step ? ' is-current' : ''}${index < step ? ' is-done' : ''}`} aria-current={index === step ? 'step' : undefined}>
            <span className="setup-progress-number">{index < step ? '✓' : index + 1}</span>
            <span>{item.title}</span>
          </div>
        ))}
      </nav>
      <DashCard className="setup-card">
        <span className="setup-step-count">Шаг {step + 1} из {STEPS.length}</span>
        <h2>{STEPS[step].title} {step === 2 && <strong className="setup-optional">необязательно</strong>}</h2>
        <p className="setup-description">{STEPS[step].description}</p>
        <div className="setup-options">
          {step === 0 && <Choice selected={performanceMode} onClick={() => setPerformanceMode(!performanceMode)}>{performanceMode ? 'Включён' : 'Включить облегчённый режим'}</Choice>}
          {step === 1 && <Choice selected={zoomOptimization} onClick={() => setZoomOptimization(!zoomOptimization)}>{zoomOptimization ? 'Включена' : 'Включить оптимизацию'}</Choice>}
          {step === 2 && <div className="setup-choice-grid">
            {[['webrtc', 'WebRTC', 'Минимальная задержка'], ['hls', 'HLS', 'Надёжное воспроизведение'], ['fmp4', 'fMP4', 'Прямой поток']].map(([value, title, detail]) => (
              <Choice key={value} selected={preferredStreamFormat === value} onClick={() => setPreferredStreamFormat(value)}><strong>{title}</strong><small>{detail}</small></Choice>
            ))}
          </div>}
          {step === 3 && <div className="setup-choice-grid">
            {[['system', 'Системная', 'Как на устройстве'], ['light', 'Светлая', 'Светлый интерфейс'], ['dark', 'Тёмная', 'Тёмный интерфейс']].map(([value, title, detail]) => (
              <Choice key={value} selected={themeMode === value} onClick={() => setThemeMode(value)}><strong>{title}</strong><small>{detail}</small></Choice>
            ))}
          </div>}
        </div>
        <div className="setup-actions">
          {step > 0 && <Button onClick={() => setStep(s => s - 1)}>← Назад</Button>}
          <Button variant="accent" onClick={() => step < STEPS.length - 1 ? setStep(s => s + 1) : finish()}>{step === STEPS.length - 1 ? 'Готово' : 'Далее →'}</Button>
          <button type="button" className="setup-skip" onClick={finish}>Пропустить настройку</button>
        </div>
      </DashCard>
      <p className="setup-note">Настройки сохраняются в этом браузере. Их можно изменить в профиле в любое время.</p>
    </div>
  )
}
