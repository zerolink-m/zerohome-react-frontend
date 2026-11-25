import { useEffect, useId, useState } from 'react'
import { useNavigate } from 'react-router'
import { useAuth } from '../context/AuthContext'
import { useToast } from '../context/ToastContext'
import { useTheme } from '../context/ThemeContext'
import { patchUser } from '../api/users'
import { listInvitations, acceptInvitation, declineInvitation } from '../api/invitations'
import { listSessions, deleteSession } from '../api/sessions'
import { describeApiError } from '../api/client'
import { DEFAULT_LIMIT } from '../api/pagination'
import DashCard from '../components/DashCard'
import InputField from '../components/InputField'
import Button from '../components/Button'
import Pagination from '../components/Pagination'
import Pill from '../components/Pill'
import Toggle from '../components/Toggle'
import ConfirmDialog from '../components/ConfirmDialog'
import CollapsibleSection from '../components/CollapsibleSection'
import { colors } from '../styles/tokens'
import { formatUnixTs, formatSessionDate } from '../utils/format'
import DebugConsole from '../components/DebugConsole'
import { useLoadGate } from '../hooks/useLoadGate'
import PageLoader from '../components/PageLoader'

export default function AccountPage() {
  const { profile, role, refreshProfile, uid, sid, logout } = useAuth()
  const settingsId = useId()
  const invitationEmail = profile?.email?.trim() || ''
  const navigate = useNavigate()
  const [confirmLogout, setConfirmLogout] = useState(false)
  const [loggingOut, setLoggingOut] = useState(false)

  async function handleLogout() {
    setLoggingOut(true)
    await logout()
    navigate('/login')
  }
  const toast = useToast()
  const { theme, setTheme, themeMode, setThemeMode, customTheme, setCustomTheme, performanceMode, setPerformanceMode, zoomOptimization, setZoomOptimization, preferredStreamFormat, setPreferredStreamFormat } = useTheme()

  const [form, setForm] = useState({ name: '', surname: '', password: '' })
  const [saving, setSaving] = useState(false)
  const [editingProfile, setEditingProfile] = useState(false)

  useEffect(() => {
    if (profile) setForm({ name: profile.name, surname: profile.surname, password: '' })
  }, [profile])

  const [filter, setFilter] = useState({ offset: 0, limit: DEFAULT_LIMIT })
  const [sessions, setSessions] = useState({ items: [], total: 0 })
  const [loadingSessions, setLoadingSessions] = useState(false)
  const gate = useLoadGate(loadingSessions)
  const [sessionsOpen, setSessionsOpen] = useState(false)

  const [invFilter, setInvFilter] = useState({ offset: 0, limit: DEFAULT_LIMIT })
  const [invitations, setInvitations] = useState({ items: [], total: 0 })
  const [loadingInvitations, setLoadingInvitations] = useState(false)
  const gate2 = useLoadGate(loadingInvitations)
  const [invitationsOpen, setInvitationsOpen] = useState(false)
  const [declineTarget, setDeclineTarget] = useState(null)
  const [decliding, setDeciding] = useState(false)
  const [invitationRevision, setInvitationRevision] = useState(0)
  const isRecipient = (inv) => Boolean(invitationEmail && inv?.email?.trim().toLowerCase() === invitationEmail.toLowerCase())

  const [pushEnabled, setPushEnabled] = useState(false)
  const [pushMeta, setPushMeta] = useState({ bot_token: '', telegram_id: '' })
  const [savingPush, setSavingPush] = useState(false)
  const [confirmPushOff, setConfirmPushOff] = useState(false)

  useEffect(() => {
    if (profile) setPushEnabled(profile.push === 'telegram')
  }, [profile])

  useEffect(() => {
    if (!invitationsOpen || !invitationEmail) {
      setLoadingInvitations(false)
      return
    }
    let cancelled = false
    async function load() {
      setLoadingInvitations(true)
      try {
        const data = await listInvitations({ ...invFilter, search: invitationEmail, search_column: 'email', search_method: 'equals' })
        if (!cancelled)
          setInvitations({ items: data.items || [], total: data.total ?? (data.items || []).length })
      } catch (e) {
        if (!cancelled) toast.error(describeApiError(e))
      } finally {
        if (!cancelled) setLoadingInvitations(false)
      }
    }
    load()
    return () => {
      cancelled = true
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [invFilter, invitationsOpen, invitationEmail, invitationRevision])

  // POST /v1/invitations/{id}/accept — принимает адресат (или admin).
  // POST /v1/invitations/{id}/decline — отклонение, приглашение удаляется.
  async function handleAccept(invitation) {
    if (!isRecipient(invitation)) return
    const { id } = invitation
    try {
      await acceptInvitation(id)
      setInvitations((prev) => ({
        ...prev,
        items: prev.items.map((inv) =>
          inv.id === id ? { ...inv, status: 'accepted', updated_at: Math.floor(Date.now() / 1000) } : inv,
        ),
      }))
      toast.success('Приглашение принято')
    } catch (e) {
      toast.error(describeApiError(e))
    }
  }

  async function handleDecline(invitation) {
    if (!isRecipient(invitation)) return
    setDeciding(true)
    try {
      await declineInvitation(invitation.id)
      toast.success('Приглашение отклонено')
      if (invFilter.offset > 0 && invitations.items.length === 1) {
        setInvFilter((current) => current === invFilter ? { ...current, offset: Math.max(0, current.offset - current.limit) } : current)
      }
      setInvitationRevision((current) => current + 1)
    } catch (e) {
      toast.error(describeApiError(e))
    } finally {
      setDeciding(false)
      setDeclineTarget(null)
    }
  }

  async function handleSavePush() {
    setSavingPush(true)
    try {
      // PATCH /v1/users/{id}: push_metadata.telegram = { bot_token, telegram_id }
      await patchUser(uid, {
        push: 'telegram',
        push_metadata: { telegram: { bot_token: pushMeta.bot_token, telegram_id: Number(pushMeta.telegram_id) } },
      })
      await refreshProfile()
      toast.success('Push-уведомления включены')
    } catch (e) {
      toast.error(describeApiError(e))
    } finally {
      setSavingPush(false)
    }
  }

  async function handleDisablePush() {
    setSavingPush(true)
    try {
      await patchUser(uid, { push: null, push_metadata: null })
      await refreshProfile()
      toast.success('Push-уведомления отключены')
    } catch (e) {
      toast.error(describeApiError(e))
    } finally {
      setSavingPush(false)
      setConfirmPushOff(false)
    }
  }

  useEffect(() => {
    if (!uid || !sessionsOpen) return
    let cancelled = false
    async function load() {
      setLoadingSessions(true)
      try {
        const res = await listSessions(uid, filter)
        if (!cancelled) setSessions(res)
      } catch (e) {
        if (!cancelled) toast.error(e.message)
      } finally {
        if (!cancelled) setLoadingSessions(false)
      }
    }
    load()
    return () => {
      cancelled = true
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [uid, filter, sessionsOpen])

  async function handleSave(e) {
    e.preventDefault()
    setSaving(true)
    try {
      const body = { name: form.name, surname: form.surname }
      if (form.password) body.password = form.password
      await patchUser(uid, body)
      await refreshProfile()
      setForm((f) => ({ ...f, password: '' }))
      setEditingProfile(false)
      toast.success('Профиль обновлён')
    } catch (e) {
      toast.error(e.message)
    } finally {
      setSaving(false)
    }
  }

  async function handleRevoke(id) {
    try {
      await deleteSession(uid, id)
      setSessions((s) => ({ ...s, items: s.items.filter((x) => x.id !== id), total: s.total - 1 }))
      toast.success('Сессия отозвана')
    } catch (e) {
      toast.error(e.message)
    }
  }

  return (
    <div style={{ display: 'grid', gap: 24, maxWidth: 640 }}>
      <div>
        <h1 style={{ fontSize: 20, marginBottom: 16 }}>Профиль</h1>
        <DashCard style={{ marginBottom: 16 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap', justifyContent: 'space-between' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap', minWidth: 0 }}>
              {(profile?.name || profile?.surname) && (
                <span style={{ fontSize: 14 }}>
                  {[profile.name, profile.surname].filter(Boolean).join(' ')}
                </span>
              )}
              {profile?.email && <span style={{ fontSize: 13, color: colors.white[4], overflowWrap: 'anywhere' }}>{profile.email}</span>}
              {role && <Pill variant={role === 'admin' ? 'blue' : 'default'}>{role}</Pill>}
            </div>
            <Button small onClick={() => setEditingProfile((v) => !v)}>
              {editingProfile ? 'Отмена' : 'Изменить'}
            </Button>
          </div>
        </DashCard>
        {editingProfile && (
          <DashCard>
            <form onSubmit={handleSave}>
              <InputField label="Имя" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
              <InputField
                label="Фамилия"
                value={form.surname}
                onChange={(e) => setForm({ ...form, surname: e.target.value })}
              />
              <InputField
                label="Новый пароль"
                type="password"
                value={form.password}
                onChange={(e) => setForm({ ...form, password: e.target.value })}
                placeholder="оставьте пустым, если не меняете"
              />
              <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
                <Button variant="accent" type="submit" loading={saving}>
                  Сохранить
                </Button>
              </div>
            </form>
          </DashCard>
        )}
      </div>

      {role === 'admin' && (
        <div>
            <Button
              to="/admin"
              style={{
                background: 'var(--accent-orange-bg)',
                border: '1px solid var(--accent-orange-border)',
                color: 'var(--accent-orange-text)',
              }}
            >
              Админ-панель
            </Button>
        </div>
      )}

      <CollapsibleSection
        title="Мои сессии"
        count={sessionsOpen ? sessions.total : undefined}
        onOpen={() => setSessionsOpen(true)}
      >
        {gate.busy ? (
          <PageLoader gate={gate} compact />
        ) : (
          <div style={{ display: 'grid', gap: 12 }}>
            {sessions.items.map((s) => (
              <DashCard key={s.id} style={{ padding: 16 }}>
                <div
                  style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    gap: 12,
                    alignItems: 'center',
                    flexWrap: 'wrap',
                  }}
                >
                  <div style={{ fontSize: 12, minWidth: 0 }}>
                    <div style={{ overflowWrap: 'anywhere' }}>{s.ua || 'неизвестный клиент'}</div>
                    <div style={{ color: colors.white[3], overflowWrap: 'anywhere' }}>
                      {s.ip} · {formatSessionDate(s.last_seen ?? s.updated_at)}
                    </div>
                  </div>
                  <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                    {s.id === sid && <Pill variant="green">текущая</Pill>}
                    <Button small disabled={sid == null || s.id === sid} title={sid == null ? 'API не сообщает ID текущей сессии; безопасный отзыв здесь недоступен' : undefined} onClick={() => handleRevoke(s.id)}>
                      Отозвать
                    </Button>
                  </div>
                </div>
              </DashCard>
            ))}
          </div>
        )}
        <Pagination
          offset={filter.offset}
          limit={filter.limit}
          total={sessions.total}
          onChange={(patch) => setFilter((f) => ({ ...f, ...patch }))}
        />
      </CollapsibleSection>

      <CollapsibleSection
        title="Приглашения"
        count={invitationsOpen && invitationEmail ? invitations.total : undefined}
        onOpen={() => setInvitationsOpen(true)}
      >
        {!invitationEmail ? (
          <div style={{ fontSize: '0.8125rem', color: 'var(--muted-text)' }}>Приглашения появятся после загрузки профиля.</div>
        ) : gate2.busy ? (
          <PageLoader gate={gate2} compact />
        ) : !invitations.items.some(isRecipient) ? (
          <div style={{ fontSize: 13, color: colors.white[4] }}>Нет входящих приглашений</div>
        ) : (
          <div style={{ display: 'grid', gap: 12 }}>
            {invitations.items.filter(isRecipient).map((inv) => (
              <DashCard key={inv.id} style={{ padding: 16 }}>
                <div
                  style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    gap: 12,
                    alignItems: 'center',
                    flexWrap: 'wrap',
                  }}
                >
                  <div style={{ fontSize: 12, minWidth: 0 }}>
                    <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
                      <span>#{inv.device_id}</span>
                      <Pill variant="default">
                        {inv.device_type === 'switches' ? 'Выключатель' : 'Камера'}
                      </Pill>
                      <Pill variant={inv.status === 'accepted' ? 'green' : 'yellow'}>
                        {inv.status === 'accepted' ? 'принято' : 'ожидает'}
                      </Pill>
                    </div>
                    <div style={{ color: colors.white[3], marginTop: 4 }}>
                      от #{inv.invited_by} · {formatUnixTs(inv.added_at)}
                      {inv.status === 'accepted' && inv.updated_at
                        ? ` · принято ${formatUnixTs(inv.updated_at)}`
                        : ''}
                    </div>
                  </div>
                  <div style={{ display: 'flex', gap: 8 }}>
                    {inv.status === 'pending' && (
                      <Button small onClick={() => handleAccept(inv)}>
                        Принять
                      </Button>
                    )}
                    <Button small onClick={() => setDeclineTarget(inv)}>
                      Отклонить
                    </Button>
                  </div>
                </div>
              </DashCard>
            ))}
          </div>
        )}
        {invitationEmail && <Pagination
          offset={invFilter.offset}
          limit={invFilter.limit}
          total={invitations.total}
          onChange={(patch) => setInvFilter((f) => ({ ...f, ...patch }))}
        />}
      </CollapsibleSection>

      <div>
        <h2 style={{ fontSize: 16, marginBottom: 16 }}>Push-уведомления</h2>
        <DashCard>
          <div style={{ marginBottom: 16 }}>
            <Toggle
              aria-label="Push-уведомления"
              checked={pushEnabled}
              onChange={(v) => {
                if (v) {
                  setPushEnabled(true)
                } else {
                  setConfirmPushOff(true)
                }
              }}
            />
          </div>
          {pushEnabled && profile?.push === 'telegram' && (
            <div style={{ fontSize: 12, color: colors.white[4] }}>Включено</div>
          )}
          {pushEnabled && profile?.push !== 'telegram' && (
            <>
              <InputField
                label="Telegram bot token"
                value={pushMeta.bot_token}
                onChange={(e) => setPushMeta({ ...pushMeta, bot_token: e.target.value })}
              />
              <InputField
                label="Telegram ID"
                type="number"
                value={pushMeta.telegram_id}
                onChange={(e) => setPushMeta({ ...pushMeta, telegram_id: e.target.value })}
              />
              <Button variant="accent" onClick={handleSavePush} loading={savingPush}>
                Сохранить
              </Button>
            </>
          )}
        </DashCard>
      </div>

      <div>
        <h2 style={{ fontSize: 16, marginBottom: 16 }}>Производительность</h2>
        <DashCard>
          <div style={{ marginBottom: 12 }}>
            <div style={{ fontSize: '0.8125rem', color: 'var(--muted-text)', marginBottom: 8 }}>Облегчённый режим</div>
            <Toggle
              aria-label="Облегчённый режим"
              checked={performanceMode}
              onChange={(v) => setPerformanceMode(v)}
            />
            <div style={{ fontSize: 11, color: colors.white[3], marginTop: 8 }}>
              Минимум анимаций и визуальных эффектов для повышения производительности
            </div>
          </div>
          <div style={{ marginBottom: 12 }}>
            <div style={{ fontSize: '0.8125rem', color: 'var(--muted-text)', marginBottom: 8 }}>Оптимизация увеличения</div>
            <Toggle
              aria-label="Оптимизация увеличения"
              checked={zoomOptimization}
              onChange={(v) => setZoomOptimization(v)}
            />
            <div style={{ fontSize: 11, color: colors.white[3], marginTop: 8 }}>
              Компактный навбар без лого — подходит для телефонов с повышенным увеличением экрана
            </div>
          </div>
          <div>
            <div id={`${settingsId}-protocol`} style={{ fontSize: '0.8125rem', color: 'var(--muted-text)', marginBottom: 12 }}>
              Предпочитаемый протокол потоковой передачи
            </div>
            <div role="group" aria-labelledby={`${settingsId}-protocol`} style={{ display: 'flex', gap: 12, flexWrap: 'wrap', alignItems: 'center' }}>
              <Button
                variant={preferredStreamFormat === 'webrtc' ? 'accent' : 'default'}
                aria-pressed={preferredStreamFormat === 'webrtc'}
                onClick={() => setPreferredStreamFormat('webrtc')}
              >
                WebRTC
              </Button>
              <Button
                variant={preferredStreamFormat === 'hls' ? 'accent' : 'default'}
                aria-pressed={preferredStreamFormat === 'hls'}
                onClick={() => setPreferredStreamFormat('hls')}
              >
                HLS
              </Button>
              <Button
                variant={preferredStreamFormat === 'fmp4' ? 'accent' : 'default'}
                aria-pressed={preferredStreamFormat === 'fmp4'}
                onClick={() => setPreferredStreamFormat('fmp4')}
              >
                fMP4
              </Button>
            </div>
            <div style={{ fontSize: 11, color: colors.white[3], marginTop: 8 }}>
              Выбранный протокол будет использоваться первым при воспроизведении видео
            </div>
          </div>
        </DashCard>
      </div>

      <div>
        <h2 style={{ fontSize: 16, marginBottom: 16 }}>Оформление</h2>
        <DashCard>
          <div style={{ marginBottom: 20 }}>
            <div id={`${settingsId}-theme`} style={{ fontSize: '0.8125rem', color: 'var(--muted-text)', marginBottom: 12 }}>
              Режим темы
            </div>
            <div role="group" aria-labelledby={`${settingsId}-theme`} style={{ display: 'flex', gap: 12, flexWrap: 'wrap', alignItems: 'center' }}>
              <Button variant={themeMode === 'light' ? 'accent' : 'default'} aria-pressed={themeMode === 'light'} onClick={() => setThemeMode('light')}>
                Светлая
              </Button>
              <Button variant={themeMode === 'dark' ? 'accent' : 'default'} aria-pressed={themeMode === 'dark'} onClick={() => setThemeMode('dark')}>
                Тёмная
              </Button>
              <Button variant={themeMode === 'system' ? 'accent' : 'default'} aria-pressed={themeMode === 'system'} onClick={() => setThemeMode('system')}>
                Системная
              </Button>
              <Button variant={themeMode === 'custom' ? 'accent' : 'default'} aria-pressed={themeMode === 'custom'} onClick={() => setThemeMode('custom')}>
                Своя
              </Button>
            </div>
          </div>

          {themeMode === 'custom' && (
            <div style={{ borderTop: `1px solid ${colors.white[8]}`, paddingTop: 20 }}>
              <h3 style={{ fontSize: 14, marginBottom: 16 }}>Настройка темы</h3>

              <div style={{ marginBottom: 16 }}>
                <div id={`${settingsId}-background`} style={{ fontSize: '0.75rem', color: 'var(--muted-text)', marginBottom: 8 }}>
                  Тип фона
                </div>
                <div role="group" aria-labelledby={`${settingsId}-background`} style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
                  <Button
                    small
                    variant={customTheme.bgType === 'gradient' ? 'accent' : 'default'}
                    aria-pressed={customTheme.bgType === 'gradient'}
                    onClick={() => setCustomTheme({ bgType: 'gradient' })}
                  >
                    Градиент
                  </Button>
                  <Button
                    small
                    variant={customTheme.bgType === 'solid' ? 'accent' : 'default'}
                    aria-pressed={customTheme.bgType === 'solid'}
                    onClick={() => setCustomTheme({ bgType: 'solid' })}
                  >
                    Монолит
                  </Button>
                </div>
              </div>

              {customTheme.bgType === 'gradient' ? (
                <>
                  <InputField
                    label="Цвет градиента (начало)"
                    type="color"
                    value={customTheme.bgGradientStart}
                    onChange={(e) => setCustomTheme({ bgGradientStart: e.target.value })}
                  />
                  <InputField
                    label="Цвет градиента (конец)"
                    type="color"
                    value={customTheme.bgGradientEnd}
                    onChange={(e) => setCustomTheme({ bgGradientEnd: e.target.value })}
                  />
                </>
              ) : (
                <InputField
                  label="Цвет фона"
                  type="color"
                  value={customTheme.bgColor}
                  onChange={(e) => setCustomTheme({ bgColor: e.target.value })}
                />
              )}

              <InputField
                label="Фон карточек (rgba)"
                value={customTheme.cardBg}
                onChange={(e) => setCustomTheme({ cardBg: e.target.value })}
                placeholder="rgba(255, 255, 255, 0.03)"
              />

              <InputField
                label="Цвет текста"
                type="color"
                value={customTheme.textColor}
                onChange={(e) => setCustomTheme({ textColor: e.target.value })}
              />

              <InputField
                label="Акцентный цвет"
                type="color"
                value={customTheme.accentColor}
                onChange={(e) => setCustomTheme({ accentColor: e.target.value })}
              />

              <div style={{ marginBottom: 16 }}>
                <label htmlFor={`${settingsId}-font`} style={{ fontSize: '0.75rem', color: 'var(--muted-text)', display: 'block', marginBottom: 8 }}>
                  Размер шрифта: {customTheme.fontSize}px
                </label>
                <input
                  type="range"
                  id={`${settingsId}-font`}
                  min="12"
                  max="18"
                  value={customTheme.fontSize}
                  onChange={(e) => setCustomTheme({ fontSize: Number(e.target.value) })}
                  style={{ width: '100%' }}
                />
              </div>

              <div style={{ marginBottom: 16 }}>
                <div id={`${settingsId}-size`} style={{ fontSize: '0.75rem', color: 'var(--muted-text)', marginBottom: 8 }}>
                  Размер карточек
                </div>
                <div role="group" aria-labelledby={`${settingsId}-size`} style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
                  <Button
                    small
                    variant={customTheme.cardSize === 'small' ? 'accent' : 'default'}
                    aria-pressed={customTheme.cardSize === 'small'}
                    onClick={() => setCustomTheme({ cardSize: 'small' })}
                  >
                    Малый
                  </Button>
                  <Button
                    small
                    variant={customTheme.cardSize === 'medium' ? 'accent' : 'default'}
                    aria-pressed={customTheme.cardSize === 'medium'}
                    onClick={() => setCustomTheme({ cardSize: 'medium' })}
                  >
                    Средний
                  </Button>
                  <Button
                    small
                    variant={customTheme.cardSize === 'large' ? 'accent' : 'default'}
                    aria-pressed={customTheme.cardSize === 'large'}
                    onClick={() => setCustomTheme({ cardSize: 'large' })}
                  >
                    Большой
                  </Button>
                </div>
              </div>

              <div style={{ marginBottom: 16 }}>
                <label htmlFor={`${settingsId}-radius`} style={{ fontSize: '0.75rem', color: 'var(--muted-text)', display: 'block', marginBottom: 8 }}>
                  Скругление углов: {customTheme.borderRadius}px
                </label>
                <input
                  type="range"
                  id={`${settingsId}-radius`}
                  min="0"
                  max="48"
                  value={customTheme.borderRadius}
                  onChange={(e) => setCustomTheme({ borderRadius: Number(e.target.value) })}
                  style={{ width: '100%' }}
                />
              </div>
            </div>
          )}
        </DashCard>
      </div>

      <ConfirmDialog
        open={!!declineTarget}
        title="Отклонить приглашение?"
        message="Вы потеряете доступ к этому устройству."
        confirmLabel="Отклонить"
        onCancel={() => setDeclineTarget(null)}
        onConfirm={() => handleDecline(declineTarget)}
        loading={decliding}
      />

      <ConfirmDialog
        open={confirmPushOff}
        title="Отключить push-уведомления?"
        message="Вы больше не будете получать уведомления в Telegram."
        confirmLabel="Отключить"
        onCancel={() => setConfirmPushOff(false)}
        onConfirm={handleDisablePush}
        loading={savingPush}
      />

      <div style={{ marginTop: 32, display: 'flex', justifyContent: 'center' }}>
        <Button onClick={() => navigate('/setup')}>Пройти первичную настройку заново</Button>
      </div>

      <div style={{ display: 'flex', justifyContent: 'center' }}>
        <Button variant="danger" onClick={() => setConfirmLogout(true)}>
          Выйти
        </Button>
      </div>

      <ConfirmDialog
        open={confirmLogout}
        title="Выйти из аккаунта?"
        message="Текущая сессия будет завершена, потребуется войти заново."
        confirmLabel="Выйти"
        variant="danger"
        onCancel={() => setConfirmLogout(false)}
        onConfirm={handleLogout}
        loading={loggingOut}
      />

      <DebugConsole />
    </div>
  )
}
