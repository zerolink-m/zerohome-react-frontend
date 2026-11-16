import { useState } from 'react'
import T from '../styles/tokens'

export default function InputField({
  label,
  error,
  type = 'text',
  value,
  onChange,
  placeholder,
  name,
  autoComplete,
  min,
  max,
  step,
  disabled,
}) {
  const [focused, setFocused] = useState(false)

  const inputStyle = {
    ...T.input,
    ...(focused ? T.inputFocus : null),
    ...(error ? T.inputError : null),
    ...(disabled ? { opacity: 0.6 } : null),
  }

  return (
    <div style={T.fieldWrap}>
      {label && <label style={T.label}>{label}</label>}
      <input
        style={inputStyle}
        type={type}
        name={name}
        value={value}
        onChange={onChange}
        placeholder={placeholder}
        autoComplete={autoComplete}
        min={min}
        max={max}
        step={step}
        disabled={disabled}
        onFocus={() => setFocused(true)}
        onBlur={() => setFocused(false)}
      />
      {error && <div style={T.errorText}>{error}</div>}
    </div>
  )
}
