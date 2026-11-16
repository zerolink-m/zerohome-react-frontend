export function formatUnixTs(ts) {
  if (!ts) return '—'
  const d = new Date(ts * 1000)
  return d.toLocaleString('ru-RU', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  })
}

// Сессии: границы по локальным календарным дням (сегодня — только время;
// вчера и предыдущие 6 дней — полный день недели; 7–29 дней — день/месяц;
// 30 дней и старше — день/месяц/год). Будущие даты считаем сегодняшними.
export function formatSessionDate(ts, now = new Date()) {
  if (!ts) return '—'
  const date = new Date(ts * 1000)
  if (Number.isNaN(date.getTime())) return '—'
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate())
  const day = new Date(date.getFullYear(), date.getMonth(), date.getDate())
  const days = Math.round((Date.UTC(today.getFullYear(), today.getMonth(), today.getDate()) -
    Date.UTC(day.getFullYear(), day.getMonth(), day.getDate())) / 86400000)
  if (days <= 0) return date.toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' })
  if (days < 7) {
    const name = date.toLocaleDateString('ru-RU', { weekday: 'long' })
    return name.charAt(0).toUpperCase() + name.slice(1)
  }
  return date.toLocaleDateString('ru-RU', {
    day: 'numeric', month: 'long', ...(days >= 30 ? { year: 'numeric' } : {}),
  })
}

// Для <input type="datetime-local"> — локальное время без смещения таймзоны.
export function unixTsToLocalInput(ts) {
  if (!ts) return ''
  const d = new Date(ts * 1000)
  const pad = (n) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`
}

export function localInputToUnixTs(value) {
  if (!value) return null
  const ms = new Date(value).getTime()
  return Number.isNaN(ms) ? null : Math.floor(ms / 1000)
}

export function formatBytes(n) {
  if (n == null) return '—'
  const units = ['Б', 'КБ', 'МБ', 'ГБ']
  let value = n
  let i = 0
  while (value >= 1024 && i < units.length - 1) {
    value /= 1024
    i++
  }
  return `${value.toFixed(1)} ${units[i]}`
}
