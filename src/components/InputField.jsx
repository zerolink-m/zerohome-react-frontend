import { useId, useState } from 'react'
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
  id,
  'aria-describedby': describedBy,
  ...rest
}) {
  const generatedId = useId()
  const inputId = id ?? generatedId
  const errorId = `${inputId}-error`
  const [focused, setFocused] = useState(false)

  const inputStyle = {
    ...T.input,
    ...(focused ? T.inputFocus : null),
    ...(error ? T.inputError : null),
    ...(disabled ? { opacity: 0.6 } : null),
  }

  return (
    <div style={T.fieldWrap}>
      {label && <label htmlFor={inputId} style={T.label}>{label}</label>}
      <input
        {...rest}
        id={inputId}
        aria-invalid={error ? true : rest['aria-invalid']}
        aria-describedby={[describedBy, error ? errorId : null].filter(Boolean).join(' ') || undefined}
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
      {error && <div id={errorId} role="alert" style={T.errorText}>{error}</div>}
    </div>
  )
}
