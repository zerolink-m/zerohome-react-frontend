import { useState } from 'react'
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

  return (
    <button
      type={type}
      style={base}
      disabled={isDisabled}
      onClick={onClick}
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
      {...rest}
    >
      {loading ? '...' : children}
    </button>
  )
}
