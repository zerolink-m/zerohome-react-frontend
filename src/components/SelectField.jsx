import { useId, useState } from 'react'
import T from '../styles/tokens'

export default function SelectField({ label, value, onChange, options, name, disabled, id, style: wrapperStyle, ...rest }) {
  const generatedId = useId()
  const selectId = id ?? generatedId
  const [focused, setFocused] = useState(false)

  const style = {
    ...T.input,
    ...(focused ? T.inputFocus : null),
    ...(disabled ? { opacity: 0.6 } : null),
    cursor: 'pointer',
  }

  return (
    <div style={{ ...T.fieldWrap, ...wrapperStyle }}>
      {label && <label htmlFor={selectId} style={T.label}>{label}</label>}
      <select
        {...rest}
        id={selectId}
        style={style}
        name={name}
        value={value}
        onChange={onChange}
        disabled={disabled}
        onFocus={() => setFocused(true)}
        onBlur={() => setFocused(false)}
      >
        {options.map((opt) => (
          <option key={opt.value} value={opt.value} style={{ background: 'var(--bg)' }}>
            {opt.label}
          </option>
        ))}
      </select>
    </div>
  )
}
