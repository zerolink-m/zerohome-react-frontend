import { useEffect, useRef, useState } from 'react'

function reducedMotion() {
  try {
    return window.matchMedia('(prefers-reduced-motion: reduce)').matches
  } catch {
    return false
  }
}

// Управление показом индикатора этапов (StageProgress).
//   active — ожидание продолжается; target — реальный этап (0..total); total — число этапов.
// Возвращает { render, leaving, shown }:
//   render  — рисовать ли индикатор (false: ничего не показывать, сразу отдавать контент);
//   leaving — идёт плавное скрытие (fade-out);
//   shown   — отображаемый этап (догоняет реальный не быстрее одного шага за STEP_MS и не опережает его).
// Поведение: показ с задержкой 300 мс (быстрый ответ — индикатор не появляется вовсе); после реального
// завершения отображаемый этап доходит до финала (все круги с галочками, линия заполнена), затем пауза
// ~150 мс (но не меньше 600 мс от момента показа, без накопления поверх), затем fade-out 200 мс и только после него — контент.
export function useStagedLoader(active, target, total, { showDelay = 300, minVisible = 600, stepMs = 120, holdMs = 150, fadeMs = 200 } = {}) {
  const reduced = reducedMotion()
  const step = reduced ? 0 : stepMs
  const fade = reduced ? 0 : fadeMs
  const hold = reduced ? 0 : holdMs

  const [visible, setVisible] = useState(false)
  const [leaving, setLeaving] = useState(false)
  const [shown, setShown] = useState(0)
  const shownAt = useRef(0)
  const lastStep = useRef(Date.now())

  const goal = active ? Math.min(target, total) : total

  // Показ с задержкой / отмена скрытия при повторном ожидании.
  useEffect(() => {
    if (!active) return
    if (visible) {
      if (leaving) setLeaving(false)
      return
    }
    const t = setTimeout(() => {
      shownAt.current = Date.now()
      lastStep.current = Date.now()
      setShown(0)
      setVisible(true)
    }, showDelay)
    return () => clearTimeout(t)
  }, [active, visible, leaving, showDelay])

  // Отображаемый этап догоняет реальный (вниз — сразу, например при «Повторить»).
  useEffect(() => {
    if (!visible) return
    if (shown > goal) {
      setShown(goal)
      return
    }
    if (shown === goal) return
    const wait = Math.max(0, step - (Date.now() - lastStep.current))
    const t = setTimeout(() => {
      lastStep.current = Date.now()
      setShown((s) => Math.min(s + 1, goal))
    }, wait)
    return () => clearTimeout(t)
  }, [visible, shown, goal, step])

  // Финал: все этапы пройдены → пауза → fade-out → скрытие.
  useEffect(() => {
    if (active || !visible || leaving || shown < total) return
    const wait = Math.max(hold, minVisible - (Date.now() - shownAt.current))
    const t = setTimeout(() => setLeaving(true), wait)
    return () => clearTimeout(t)
  }, [active, visible, leaving, shown, total, hold, minVisible])

  useEffect(() => {
    if (!leaving) return
    const t = setTimeout(() => {
      setVisible(false)
      setLeaving(false)
      setShown(0)
    }, fade)
    return () => clearTimeout(t)
  }, [leaving, fade])

  return { render: active || visible, leaving, shown: visible ? shown : 0, visible }
}
