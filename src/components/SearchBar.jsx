import { useState } from 'react'
import Button from './Button'

const selectStyle = {
  background: 'var(--w05)',
  border: '1px solid var(--w10)',
  borderRadius: 10,
  color: 'var(--text)',
  fontSize: 12,
  padding: '8px 10px',
  fontFamily: "'JetBrains Mono', monospace",
}

const inputStyle = {
  ...selectStyle,
  minWidth: 120,
  flex: 1,
}

// columns — whitelist доступных полей поиска для конкретного эндпоинта (users/sessions/cams)
// labels — необязательная карта {column: человекочитаемое название} для этих же колонок
export default function SearchBar({ columns, labels, onSearch }) {
  const [column, setColumn] = useState(columns[0])
  const [value, setValue] = useState('')
  const [method, setMethod] = useState('include')

  function submit(e) {
    e.preventDefault()
    if (!value.trim()) {
      onSearch({ search: null, search_column: null })
      return
    }
    onSearch({ search: value.trim(), search_column: column, search_method: method })
  }

  function clear() {
    setValue('')
    onSearch({ search: null, search_column: null })
  }

  return (
    <form onSubmit={submit} style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 16 }}>
      <select value={column} onChange={(e) => setColumn(e.target.value)} style={selectStyle}>
        {columns.map((c) => (
          <option key={c} value={c} style={{ background: 'var(--bg)' }}>
            {labels?.[c] ?? c}
          </option>
        ))}
      </select>
      <select value={method} onChange={(e) => setMethod(e.target.value)} style={selectStyle}>
        <option value="include" style={{ background: 'var(--bg)' }}>
          содержит
        </option>
        <option value="equals" style={{ background: 'var(--bg)' }}>
          равно
        </option>
      </select>
      <input
        value={value}
        onChange={(e) => setValue(e.target.value)}
        placeholder="Поиск..."
        style={inputStyle}
      />
      <Button small type="submit">
        Найти
      </Button>
      {value && (
        <Button small onClick={clear} type="button">
          Сбросить
        </Button>
      )}
    </form>
  )
}
