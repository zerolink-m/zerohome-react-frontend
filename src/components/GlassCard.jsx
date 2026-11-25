import T from '../styles/tokens'

export default function GlassCard({ children, style }) {
  return <div className="glass-card" style={{ ...T.glassCard, ...style }}>{children}</div>
}
