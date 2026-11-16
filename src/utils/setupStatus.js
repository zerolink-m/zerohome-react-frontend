const PREFIX = 'zc-setup-complete:'

export function isSetupComplete(uid) {
  if (uid == null) return false
  try { return localStorage.getItem(`${PREFIX}${uid}`) === '1' } catch { return false }
}

export function markSetupComplete(uid) {
  if (uid == null) return
  try { localStorage.setItem(`${PREFIX}${uid}`, '1') } catch { /* Настройки всё равно применены в текущей вкладке. */ }
}
