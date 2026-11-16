// Дизайн-токены ZeroHome — перенос design_zl.site.style
// Значения ссылаются на CSS custom properties (см. src/styles/global.css),
// что позволяет переключать тему через data-theme на <html> без изменения компонентов.

export const colors = {
  bg: 'var(--bg)',
  text: 'var(--text)',
  accent: 'var(--accent)',
  accentText: 'var(--accent-text)',
  statuses: {
    blue: { bg: 'var(--status-blue-bg)', border: 'var(--status-blue-border)', text: 'var(--status-blue-text)' },
    yellow: { bg: 'var(--status-yellow-bg)', border: 'var(--status-yellow-border)', text: 'var(--status-yellow-text)' },
    red: { bg: 'var(--status-red-bg)', border: 'var(--status-red-border)', text: 'var(--status-red-text)' },
    green: { bg: 'var(--status-green-bg)', border: 'var(--status-green-border)', text: 'var(--status-green-text)' },
    default: { bg: 'var(--status-default-bg)', border: 'var(--status-default-border)', text: 'var(--status-default-text)' },
  },
  white: {
    5: 'var(--w05)',
    6: 'var(--w06)',
    8: 'var(--w08)',
    10: 'var(--w10)',
    15: 'var(--w15)',
    2: 'var(--w20)',
    3: 'var(--w30)',
    4: 'var(--w40)',
    55: 'var(--w55)',
    7: 'var(--w70)',
  },
}

export const orbTR = {
  position: 'fixed',
  top: '-20%',
  right: '-10%',
  width: 600,
  height: 600,
  borderRadius: '50%',
  background: 'var(--orb-1)',
  pointerEvents: 'none',
  zIndex: 0,
}

export const orbBL = {
  position: 'fixed',
  bottom: '-20%',
  left: '-10%',
  width: 500,
  height: 500,
  borderRadius: '50%',
  background: 'var(--orb-2)',
  pointerEvents: 'none',
  zIndex: 0,
}

export const fonts = {
  logo: 'Syne, sans-serif',
  mono: "'JetBrains Mono', monospace",
}

const T = {
  logo: {
    fontFamily: fonts.logo,
    fontWeight: 700,
    fontSize: 28,
    letterSpacing: '-0.02em',
    color: 'var(--text)',
  },
  logoNav: {
    fontFamily: fonts.logo,
    fontWeight: 700,
    fontSize: 20,
    letterSpacing: '-0.02em',
    color: 'var(--text)',
  },
  label: {
    fontSize: 11,
    fontFamily: fonts.mono,
    textTransform: 'uppercase',
    letterSpacing: '0.12em',
    color: colors.white[3],
    display: 'block',
    marginBottom: 8,
  },

  glassCard: {
    background: 'var(--card-bg)',
    border: `1px solid ${colors.white[8]}`,
    borderRadius: 24,
    backdropFilter: 'blur(20px)',
    boxShadow: 'var(--card-shadow)',
    padding: 48,
    maxWidth: 440,
    width: '100%',
    animation: 'fadeIn 0.8s ease',
    position: 'relative',
    zIndex: 1,
  },
  dashCard: {
    background: 'var(--card-bg)',
    border: `1px solid ${colors.white[8]}`,
    borderRadius: 24,
    backdropFilter: 'blur(20px)',
    boxShadow: 'var(--card-shadow)',
    padding: 24,
    animation: 'fadeIn 0.25s ease',
    position: 'relative',
  },

  btn: {
    background: 'var(--w06)',
    border: `1px solid ${colors.white[8]}`,
    borderRadius: 14,
    padding: 14,
    color: 'var(--text)',
    fontSize: 13,
    letterSpacing: '0.04em',
    fontFamily: fonts.mono,
    cursor: 'pointer',
    transition: '0.25s ease',
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  btnAccent: {
    background: 'var(--accent-bg)',
    border: '1px solid var(--accent-border)',
    color: colors.accentText,
  },
  btnDanger: {
    background: 'var(--status-red-bg)',
    border: '1px solid var(--status-red-border-strong)',
    color: colors.statuses.red.text,
  },
  btnHover: {
    transform: 'translateY(-2px)',
    boxShadow: 'var(--btn-hover-shadow)',
  },
  btnDisabled: {
    opacity: 0.6,
    cursor: 'default',
  },
  btnSmall: {
    padding: '8px 14px',
    fontSize: 11,
  },

  input: {
    background: 'var(--card-bg)',
    border: `1px solid ${colors.white[8]}`,
    borderRadius: 14,
    padding: '12px 16px',
    color: 'var(--text)',
    fontSize: 14,
    fontFamily: fonts.mono,
    width: '100%',
    transition: '0.25s ease',
    outline: 'none',
  },
  inputFocus: {
    border: '1px solid var(--accent-focus-border)',
    boxShadow: '0 0 0 3px var(--accent-focus-ring)',
  },
  inputError: {
    border: '1px solid var(--status-red-border-strong)',
    boxShadow: '0 0 0 3px var(--status-red-ring)',
  },
  errorText: {
    fontSize: 11,
    color: 'var(--status-red-text-strong)',
    marginTop: 6,
  },
  fieldWrap: {
    marginBottom: 20,
  },

  pill: {
    display: 'inline-flex',
    borderRadius: 8,
    padding: '4px 12px',
    fontSize: 11,
    fontFamily: fonts.mono,
    letterSpacing: '0.08em',
    whiteSpace: 'nowrap',
    alignItems: 'center',
    overflow: 'hidden',
  },

  divider: {
    height: 1,
    background: colors.white[6],
    margin: '24px 0',
    border: 'none',
    position: 'relative',
  },
  dividerLabel: {
    fontSize: 11,
    color: colors.white[2],
    letterSpacing: '0.08em',
  },

  toast: {
    borderRadius: 14,
    backdropFilter: 'blur(20px)',
    boxShadow: 'var(--toast-shadow)',
    maxWidth: 340,
    padding: '12px 16px',
    fontSize: 12,
  },

  errorBox: {
    background: 'var(--status-red-bg)',
    border: '1px solid var(--status-red-border)',
    color: 'var(--status-red-text)',
    borderRadius: 12,
    padding: '12px 16px',
    fontSize: 12,
  },
  successBox: {
    background: 'var(--success-bg)',
    border: '1px solid var(--success-border)',
    color: 'var(--success-text)',
    borderRadius: 12,
    padding: '12px 16px',
    fontSize: 12,
  },

  navbar: {
    position: 'fixed',
    top: 0,
    left: 0,
    right: 0,
    height: 60,
    background: 'var(--navbar-bg)',
    backdropFilter: 'blur(20px)',
    borderBottom: `1px solid ${colors.white[6]}`,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: '0 24px',
    zIndex: 10,
  },

  footerVersion: {
    textAlign: 'center',
    fontSize: 10,
    color: colors.white[15],
    letterSpacing: '0.06em',
    lineHeight: 1.8,
    padding: '24px 0',
  },
}

export default T
