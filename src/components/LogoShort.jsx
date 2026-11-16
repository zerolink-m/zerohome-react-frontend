// Inline SVG "ZH" — короткая версия логотипа для узких экранов.
// Пиксельный логотип 88x56 (см. public/logo/logo-short.svg — тот же контент).
const RECTS = [
  [0,0],[8,0],[16,0],[24,0],[32,0],[32,8],[24,16],[16,24],[8,32],[0,40],
  [0,48],[8,48],[16,48],[24,48],[32,48],
  [48,0],[80,0],[48,8],[80,8],[48,16],[80,16],[48,24],[56,24],[64,24],[72,24],[80,24],[48,32],[80,32],[48,40],[80,40],[48,48],[80,48],
]

export default function LogoShort({ height = 24, className, style }) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 88 56"
      fill="currentColor"
      shapeRendering="crispEdges"
      role="img"
      aria-label="ZH"
      height={height}
      width="auto"
      className={className}
      style={style}
    >
      {RECTS.map(([x, y]) => (
        <rect key={`${x}-${y}`} x={x} y={y} width="8" height="8" />
      ))}
    </svg>
  )
}
