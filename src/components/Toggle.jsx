import { colors } from '../styles/tokens'

// Простой переключатель 0/1 (enabled) в стиле пилюли.
export default function Toggle({ checked, onChange, label, disabled, large = false }) {
  const active = colors.statuses.green
  const inactive = colors.statuses.default

  const scheme = checked ? active : inactive

  return (
    <button
      type="button"
      disabled={disabled}
      onClick={() => onChange(!checked)}
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: 8,
        background: scheme.bg,
        border: `1px solid ${scheme.border}`,
        color: scheme.text,
        borderRadius: 999,
        padding: large ? '18px 28px' : '6px 14px',
        minWidth: large ? 210 : undefined,
        minHeight: large ? 72 : undefined,
        justifyContent: large ? 'center' : undefined,
        fontSize: large ? 16 : 11,
        fontFamily: "'JetBrains Mono', monospace",
        letterSpacing: '0.08em',
        cursor: disabled ? 'default' : 'pointer',
        opacity: disabled ? 0.6 : 1,
        transition: '0.25s ease',
      }}
    >
      {checked ? '● включено' : '○ выключено'}
      {label ? ` — ${label}` : ''}
    </button>
  )
}
