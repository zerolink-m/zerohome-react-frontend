import T from '../styles/tokens'

export default function GlassCard({ children, style }) {
  return <div style={{ ...T.glassCard, ...style }}>{children}</div>
}
