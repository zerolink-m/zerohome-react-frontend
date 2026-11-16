import T from '../styles/tokens'

export default function Divider({ label }) {
  if (!label) return <hr style={T.divider} />

  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 12, margin: '24px 0' }}>
      <div style={{ flex: 1, height: 1, background: T.divider.background }} />
      <span style={T.dividerLabel}>{label}</span>
      <div style={{ flex: 1, height: 1, background: T.divider.background }} />
    </div>
  )
}
