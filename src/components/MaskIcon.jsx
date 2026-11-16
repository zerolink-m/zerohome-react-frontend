// Иконка из SVG-файла, окрашенная в текущий цвет текста (currentColor).
// <img src="x.svg"> не наследует цвет и рисует чёрные иконки невидимыми на тёмном фоне;
// через CSS-маску цвет берётся из `color` и меняется вместе с темой.
export default function MaskIcon({ src, size = 20, color = 'currentColor', style, ...rest }) {
  const mask = `url(${src}) center / contain no-repeat`
  return (
    <span
      role="img"
      aria-hidden={rest['aria-label'] ? undefined : true}
      {...rest}
      style={{
        display: 'inline-block',
        flexShrink: 0,
        width: size,
        height: size,
        backgroundColor: color,
        WebkitMask: mask,
        mask,
        ...style,
      }}
    />
  )
}
