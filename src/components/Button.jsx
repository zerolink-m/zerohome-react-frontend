import { useState } from 'react'
import { Link } from 'react-router'
import T from '../styles/tokens'

export default function Button({
  variant = 'default',
  loading = false,
  disabled = false,
  small = false,
  children,
  style,
  onClick,
  type = 'button',
  to,
  ...rest
}) {
  const [hover, setHover] = useState(false)
  const isDisabled = disabled || loading

  const base = {
    ...T.btn,
    ...(variant === 'accent' ? T.btnAccent : null),
    ...(variant === 'danger' ? T.btnDanger : null),
    ...(small ? T.btnSmall : null),
    ...(hover && !isDisabled ? T.btnHover : null),
    ...(isDisabled ? T.btnDisabled : null),
    ...style,
  }

  if (to != null && !isDisabled) {
    return (
      <Link to={to} style={base} onClick={onClick} onMouseEnter={() => setHover(true)} onMouseLeave={() => setHover(false)} {...rest}>
        {children}
      </Link>
    )
  }

  return (
    <button
      type={type}
      style={base}
      disabled={isDisabled}
      aria-busy={loading || undefined}
      aria-label={loading && typeof children === 'string' ? children : undefined}
      onClick={onClick}
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
      {...rest}
    >
      {loading ? '...' : children}
    </button>
  )
}
