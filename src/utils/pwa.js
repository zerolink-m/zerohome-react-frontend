// Определение PWA режима для iOS и других платформ

export function isPWA() {
  // Проверка для iOS Safari (standalone mode)
  if (window.navigator.standalone === true) {
    return true
  }

  // Проверка для других браузеров (display-mode: standalone)
  if (window.matchMedia('(display-mode: standalone)').matches) {
    return true
  }

  // Проверка для Android Chrome
  if (window.matchMedia('(display-mode: fullscreen)').matches) {
    return true
  }

  return false
}

export function getPWAHeader() {
  return isPWA() ? '1' : '0'
}
