import { forwardRef } from 'react'
import T, { colors } from '../styles/tokens'

const Pill = forwardRef(function Pill({ variant = 'default', children, style, className }, ref) {
  const scheme = colors.statuses[variant] || colors.statuses.default

  return (
    <span
      ref={ref}
      className={className}
      style={{
        ...T.pill,
        background: scheme.bg,
        border: `1px solid ${scheme.border}`,
        color: scheme.text,
        ...style,
      }}
    >
      <span style={{ display: 'inline-block' }}>{children}</span>
    </span>
  )
})

export default Pill
