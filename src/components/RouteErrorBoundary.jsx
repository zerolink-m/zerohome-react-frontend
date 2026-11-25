import { Component } from 'react'
import Button from './Button'
import DashCard from './DashCard'

export default class RouteErrorBoundary extends Component {
  state = { failed: false, pathname: this.props.pathname }

  static getDerivedStateFromError() {
    return { failed: true }
  }

  static getDerivedStateFromProps({ pathname }, state) {
    return pathname !== state.pathname ? { failed: false, pathname } : null
  }

  render() {
    if (!this.state.failed) return this.props.children
    return (
      <div className="app-main">
        <DashCard role="alert">
          <h1 style={{ fontSize: '1.25rem', marginBottom: 12 }}>Не удалось открыть страницу</h1>
          <p style={{ color: 'var(--muted-text)', marginBottom: 16 }}>Обновите страницу и попробуйте снова.</p>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
            <Button variant="accent" onClick={() => window.location.reload()}>Обновить страницу</Button>
            {this.props.pathname !== '/' && <Button to="/">К устройствам</Button>}
          </div>
        </DashCard>
      </div>
    )
  }
}
