import { useLayoutEffect, useRef, useState } from 'react'
import Pill from './Pill'

const WIDTH_LIMIT = 150

// Пилюли одной группы получают равную ширину (максимум натуральных ширин, не длиннее WIDTH_LIMIT).
// Если контент шире лимита — вместо обрезки применяется горизонтальный marquee-скролл.
export default function PillGroup({ items }) {
  const innerRefs = useRef([])
  const [widths, setWidths] = useState({})

  useLayoutEffect(() => {
    const naturals = innerRefs.current.map((el) => (el ? el.scrollWidth : 0))
    const maxNatural = Math.max(0, ...naturals)
    const targetWidth = Math.min(maxNatural, WIDTH_LIMIT)
    const next = {}
    naturals.forEach((natural, i) => {
      const overflow = natural - targetWidth
      if (overflow > 2) {
        const dist = overflow
        const duration = Math.min(8, Math.max(3, dist / 25))
        next[i] = { width: targetWidth, marquee: true, dist, duration }
      } else {
        next[i] = { width: targetWidth || undefined, marquee: false }
      }
    })
    setWidths(next)
  }, [items])

  return (
    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
      {items.map((item, i) => {
        const w = widths[i]
        return (
          <Pill key={item.key ?? i} variant={item.variant} className={w?.marquee ? 'pill-overflow' : undefined} style={w?.width ? { width: w.width } : undefined}>
            <span
              ref={(el) => { innerRefs.current[i] = el }}
              className={w?.marquee ? 'pill-marquee' : undefined}
              style={{
                display: 'inline-block',
                whiteSpace: 'nowrap',
                ...(w?.marquee
                  ? { '--pill-scroll-dist': `${w.dist}px`, '--pill-scroll-duration': `${w.duration}s` }
                  : null),
              }}
            >
              {item.label}
            </span>
          </Pill>
        )
      })}
    </div>
  )
}
