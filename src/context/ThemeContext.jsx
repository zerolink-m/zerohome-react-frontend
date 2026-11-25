import { createContext, useCallback, useContext, useEffect, useState } from 'react'

const ThemeContext = createContext(null)

const STORAGE_KEY = 'zc-theme'
const STORAGE_KEY_MODE = 'zc-theme-mode'
const STORAGE_KEY_CUSTOM = 'zc-theme-custom'
const STORAGE_KEY_PERFORMANCE = 'zc-performance-mode'
const STORAGE_KEY_ZOOM = 'zc-zoom-optimization'
const STORAGE_KEY_PREFERRED_STREAM = 'zc-preferred-stream-format'

// Определяет начальную тему: сохранённая в localStorage → системная (prefers-color-scheme)
// → 'dark' по умолчанию (в т.ч. если localStorage/matchMedia недоступны).
function getInitialTheme() {
  try {
    const stored = localStorage.getItem(STORAGE_KEY)
    if (stored === 'light' || stored === 'dark') return stored
  } catch {
    // localStorage недоступен — идём дальше
  }
  try {
    if (window.matchMedia && window.matchMedia('(prefers-color-scheme: light)').matches) {
      return 'light'
    }
  } catch {
    // matchMedia недоступен
  }
  return 'dark'
}

function getInitialThemeMode() {
  try {
    const stored = localStorage.getItem(STORAGE_KEY_MODE)
    if (['light', 'dark', 'system', 'custom'].includes(stored)) return stored
  } catch {}
  return 'system'
}

const DEFAULT_CUSTOM_THEME = {
  bgType: 'gradient', // 'gradient' | 'solid'
  bgColor: '#0a0a0f',
  bgGradientStart: '#0a0a0f',
  bgGradientEnd: '#1a1a2e',
  cardBg: 'rgba(255, 255, 255, 0.03)',
  textColor: '#ffffff',
  accentColor: '#6366f1',
  fontSize: 14,
  cardSize: 'medium', // 'small' | 'medium' | 'large'
  borderRadius: 24,
}

function getInitialCustomTheme() {
  try {
    const stored = localStorage.getItem(STORAGE_KEY_CUSTOM)
    if (stored) return { ...DEFAULT_CUSTOM_THEME, ...JSON.parse(stored) }
  } catch {}
  return DEFAULT_CUSTOM_THEME
}

function getInitialPerformanceMode() {
  try {
    const stored = localStorage.getItem(STORAGE_KEY_PERFORMANCE)
    return stored === 'true'
  } catch {}
  return false
}

function getInitialZoomOptimization() {
  try {
    return localStorage.getItem(STORAGE_KEY_ZOOM) === 'true'
  } catch {}
  return false
}

function getInitialPreferredStreamFormat() {
  try {
    const stored = localStorage.getItem(STORAGE_KEY_PREFERRED_STREAM)
    if (stored === 'webrtc' || stored === 'hls' || stored === 'fmp4') {
      return stored
    }
  } catch {}
  return 'webrtc' // По умолчанию WebRTC
}

export function ThemeProvider({ children }) {
  const [theme, setThemeState] = useState(getInitialTheme)
  const [themeMode, setThemeModeState] = useState(getInitialThemeMode)
  const [customTheme, setCustomThemeState] = useState(getInitialCustomTheme)
  const [performanceMode, setPerformanceModeState] = useState(getInitialPerformanceMode)
  const [zoomOptimization, setZoomOptimizationState] = useState(getInitialZoomOptimization)
  const [preferredStreamFormat, setPreferredStreamFormatState] = useState(getInitialPreferredStreamFormat)

  // Слушатель системной темы
  useEffect(() => {
    if (themeMode !== 'system') return

    const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)')
    const updateSystemTheme = () => {
      setThemeState(mediaQuery.matches ? 'dark' : 'light')
    }

    updateSystemTheme()
    mediaQuery.addEventListener('change', updateSystemTheme)
    return () => mediaQuery.removeEventListener('change', updateSystemTheme)
  }, [themeMode])

  // Применение темы к DOM
  useEffect(() => {
    if (themeMode === 'custom') {
      // Применяем кастомные CSS переменные
      const root = document.documentElement
      const custom = customTheme

      if (custom.bgType === 'gradient') {
        root.style.setProperty('--custom-bg', `linear-gradient(135deg, ${custom.bgGradientStart}, ${custom.bgGradientEnd})`)
      } else {
        root.style.setProperty('--custom-bg', custom.bgColor)
      }

      root.style.setProperty('--custom-card-bg', custom.cardBg)
      root.style.setProperty('--custom-text', custom.textColor)
      root.style.setProperty('--custom-accent', custom.accentColor)
      root.style.setProperty('--custom-font-size', `${custom.fontSize}px`)
      root.style.setProperty('--custom-border-radius', `${custom.borderRadius}px`)

      // Размеры карточек
      const cardSizes = { small: '200px', medium: '280px', large: '360px' }
      root.style.setProperty('--custom-card-size', cardSizes[custom.cardSize] || cardSizes.medium)

      root.setAttribute('data-theme', 'custom')
    } else {
      document.documentElement.setAttribute('data-theme', theme)
    }

    // Применение режима производительности
    if (performanceMode) {
      document.documentElement.classList.add('performance-mode')
    } else {
      document.documentElement.classList.remove('performance-mode')
    }

    // Оптимизация под увеличенный масштаб («Оптимизация увелечения»):
    // компактный навбар без лого — класс вешается только по настройке,
    // без авто-детекта ширины экрана.
    if (zoomOptimization) {
      document.documentElement.classList.add('compact-navbar')
    } else {
      document.documentElement.classList.remove('compact-navbar')
    }

    // Сохранение в localStorage
    try {
      localStorage.setItem(STORAGE_KEY, theme)
      localStorage.setItem(STORAGE_KEY_MODE, themeMode)
      localStorage.setItem(STORAGE_KEY_CUSTOM, JSON.stringify(customTheme))
      localStorage.setItem(STORAGE_KEY_PERFORMANCE, performanceMode.toString())
      localStorage.setItem(STORAGE_KEY_ZOOM, zoomOptimization.toString())
      localStorage.setItem(STORAGE_KEY_PREFERRED_STREAM, preferredStreamFormat)
    } catch {
      // запись недоступна — тема всё равно применена к DOM
    }
  }, [theme, themeMode, customTheme, performanceMode, zoomOptimization, preferredStreamFormat])

  const setTheme = useCallback((next) => {
    setThemeState(next === 'light' ? 'light' : 'dark')
  }, [])

  const toggleTheme = useCallback(() => {
    setThemeState((t) => (t === 'dark' ? 'light' : 'dark'))
  }, [])

  const setThemeMode = useCallback((mode) => {
    setThemeModeState(mode)
    if (mode === 'light' || mode === 'dark') {
      setThemeState(mode)
    } else if (mode === 'system') {
      const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)')
      setThemeState(mediaQuery.matches ? 'dark' : 'light')
    }
  }, [])

  const setCustomTheme = useCallback((updates) => {
    setCustomThemeState((prev) => ({ ...prev, ...updates }))
  }, [])

  const setPerformanceMode = useCallback((enabled) => {
    setPerformanceModeState(enabled)
  }, [])

  const setZoomOptimization = useCallback((enabled) => {
    setZoomOptimizationState(enabled)
  }, [])

  const setPreferredStreamFormat = useCallback((format) => {
    setPreferredStreamFormatState(format)
  }, [])

  const value = {
    theme,
    setTheme,
    toggleTheme,
    themeMode,
    setThemeMode,
    customTheme,
    setCustomTheme,
    performanceMode,
    setPerformanceMode,
    zoomOptimization,
    setZoomOptimization,
    preferredStreamFormat,
    setPreferredStreamFormat
  }

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>
}

export function useTheme() {
  const ctx = useContext(ThemeContext)
  if (!ctx) throw new Error('useTheme должен использоваться внутри ThemeProvider')
  return ctx
}
