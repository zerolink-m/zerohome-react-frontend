import T from '../styles/tokens'

export default function DashCard({ children, style, className = '', ...rest }) {
  return (
    <div className={`dash-card ${className}`.trim()} style={{ ...T.dashCard, ...style }} {...rest}>
      {children}
    </div>
  )
}
