import T from '../styles/tokens'

export default function DashCard({ children, style, ...rest }) {
  return (
    <div style={{ ...T.dashCard, ...style }} {...rest}>
      {children}
    </div>
  )
}
