import { useEffect, useState } from 'react'
import { getRecordingSettings, patchRecordingSettings } from '../../api/cams'
import { useToast } from '../../context/ToastContext'
import Button from '../Button'
import Toggle from '../Toggle'
import InputField from '../InputField'
import ConfirmDialog from '../ConfirmDialog'
import { colors } from '../../styles/tokens'
import { useLoadGate } from '../../hooks/useLoadGate'
import PageLoader from '../PageLoader'

export default function RecordingSettings({ camId, onSaved }) {
  const toast = useToast()
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState(null)
  const [retry, setRetry] = useState(0)
  const [loadedCam, setLoadedCam] = useState(null)
  const gate = useLoadGate(loading || (!loadError && loadedCam !== camId), loadError)
  const [saving, setSaving] = useState(false)
  const [record, setRecord] = useState(0)
  const [recordType, setRecordType] = useState('')
  const [localPath, setLocalPath] = useState('')
  const [confirmSave, setConfirmSave] = useState(false)

  useEffect(() => {
    let cancelled = false
    async function load() {
      setLoading(true)
      setLoadError(null)
      try {
        const data = await getRecordingSettings(camId)
        if (cancelled) return
        setRecord(data.record ? 1 : 0)
        setRecordType(data.record_type || '')
        setLocalPath(data.record_metadata?.local?.path || '')
        setLoadedCam(camId)
      } catch (e) {
        if (!cancelled) setLoadError(e.message || 'Не удалось загрузить настройки записи')
      } finally {
        if (!cancelled) setLoading(false)
      }
    }
    load()
    return () => {
      cancelled = true
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [camId, retry])

  async function handleSave() {
    if (gate.busy || loadedCam !== camId || saving) return
    setSaving(true)
    try {
      const body = {
        record: Number(record),
        record_type: record === 1 ? recordType || null : null,
        record_metadata: record === 1 && recordType === 'local' ? { local: { path: localPath } } : null,
      }
      const data = await patchRecordingSettings(camId, body)
      setRecord(data.record ? 1 : 0)
      setRecordType(data.record_type || '')
      setLocalPath(data.record_metadata?.local?.path || '')
      onSaved?.(data)
      toast.success('Настройки записи обновлены')
    } catch (e) {
      toast.error(e.message)
    } finally {
      setSaving(false)
    }
  }

  if (gate.busy) return <PageLoader gate={gate} compact onRetry={() => setRetry(value => value + 1)} />

  return (
    <div>
      <form
        onSubmit={(e) => {
          e.preventDefault()
          setConfirmSave(true)
        }}
      >
        <div style={{ marginBottom: 16 }}>
          <label style={{ display: 'block', fontSize: 12, color: colors.white[4], marginBottom: 6 }}>Запись</label>
          <Toggle checked={record === 1} onChange={(v) => setRecord(v ? 1 : 0)} />
        </div>
        <div style={{ marginBottom: 16 }}>
          <label style={{ display: 'block', fontSize: 12, color: colors.white[4], marginBottom: 6 }}>
            Локальное хранилище
          </label>
          <Toggle checked={recordType === 'local'} onChange={(v) => setRecordType(v ? 'local' : '')} />
        </div>
        {recordType === 'local' && (
          <InputField
            label="Путь хранения (local)"
            value={localPath}
            onChange={(e) => setLocalPath(e.target.value)}
            placeholder="/mnt/record/cam-1"
          />
        )}
        <Button variant="accent" type="submit" loading={saving}>
          Сохранить
        </Button>
      </form>

      <ConfirmDialog
        open={confirmSave}
        title="Изменить настройки записи?"
        message="Настройки записи для камеры будут обновлены."
        confirmLabel="Сохранить"
        onCancel={() => setConfirmSave(false)}
        onConfirm={async () => {
          setConfirmSave(false)
          await handleSave()
        }}
        loading={saving}
      />
    </div>
  )
}
