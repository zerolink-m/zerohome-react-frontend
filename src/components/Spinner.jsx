// Одиночный вращающийся круг с подписью под ним (компактная загрузка).
//   size       — диаметр в px
//   label      — подпись под кругом (по умолчанию «Загрузка…»)
//   inline     — маленький вариант в строку (подпись справа), для мелких мест
//   fullscreen — центрировать на весь экран (маршруты)
//   fill       — занять всю высоту родителя (оверлеи плееров, фото)
export default function Spinner({ size = 28, label = 'Загрузка…', inline = false, fullscreen = false, fill = false, style }) {
  const cls = `zc-spinner-wrap${inline ? ' is-inline' : ' is-block'}${fullscreen ? ' is-full' : ''}${fill ? ' is-fill' : ''}`
  return (
    <div className={cls} role="status" aria-live="polite" style={style}>
      <span className="zc-spinner" style={{ width: inline ? 16 : size, height: inline ? 16 : size }} aria-hidden="true" />
      <span className="zc-spinner-label">{label}</span>
    </div>
  )
}
