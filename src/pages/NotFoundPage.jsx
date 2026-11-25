import DashCard from '../components/DashCard'
import Button from '../components/Button'

export default function NotFoundPage() {
  return (
    <div
      style={{
        minHeight: '100vh',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        position: 'relative',
        zIndex: 1,
      }}
    >
      <DashCard style={{ textAlign: 'center' }}>
        <h1 style={{ fontSize: 28, marginBottom: 12 }}>404</h1>
        <p style={{ fontSize: '0.8125rem', color: 'var(--muted-text)', marginBottom: 24 }}>Страница не найдена</p>
        <Button to="/" variant="accent">На главную</Button>
      </DashCard>
    </div>
  )
}
