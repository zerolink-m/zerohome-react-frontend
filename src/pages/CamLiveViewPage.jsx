import { useEffect, useState } from 'react'
import { useNavigate, useParams } from 'react-router'
import { getCam } from '../api/cams'
import { useToast } from '../context/ToastContext'
import { useAuth } from '../context/AuthContext'
import Button from '../components/Button'
import DashCard from '../components/DashCard'
import VideoStreamUniversal from '../components/cams/VideoStreamUniversal'
import PTZControl from '../components/cams/PTZControl'
import ShareLinkDialog from '../components/cams/ShareLinkDialog'
import { useIsMobile } from '../hooks/useIsMobile'
import { colors } from '../styles/tokens'
import { useLoadGate } from '../hooks/useLoadGate'
import PageLoader from '../components/PageLoader'

export default function CamLiveViewPage() {
  const { id } = useParams()
  const toast = useToast()
  const navigate = useNavigate()
  const isMobile = useIsMobile()
  const { uid, role } = useAuth()

  const [cam, setCam] = useState(null)
  const [loading, setLoading] = useState(true)
  const gate = useLoadGate(loading)
  const [sharing, setSharing] = useState(false)
  const [ptzUnsupported, setPtzUnsupported] = useState(false)

  useEffect(() => {
    let cancelled = false
    setSharing(false)
    setPtzUnsupported(false)
    async function load() {
      setLoading(true)
      try {
        const data = await getCam(id)
        if (!cancelled) setCam(data)
      } catch (e) {
        if (cancelled) return
        toast.error(e.message)
        navigate('/')
      } finally {
        if (!cancelled) setLoading(false)
      }
    }
    load()
    return () => {
      cancelled = true
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id])

  if (gate.busy) return <PageLoader gate={gate} />
  if (!cam || String(cam.id) !== String(id)) return null
  const canShare = role === 'admin' || (uid != null && String(cam.owner) === String(uid))

  return (
    <div>
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'flex-start',
          marginBottom: 24,
          gap: 12,
          flexWrap: 'wrap',
        }}
      >
        <h1 style={{ fontSize: 20, wordBreak: 'break-all' }}>
          {cam.name || `${cam.address}:${cam.port}${cam.path || ''}`}
        </h1>
        <div style={{ display: 'flex', gap: 12 }}>
          {canShare && <Button onClick={() => setSharing(true)}>Поделиться</Button>}
          <Button onClick={() => navigate(`/cams/${cam.id}`)}>← к камере</Button>
        </div>
      </div>

      <div style={{ display: 'grid', gap: 24 }}>
        <VideoStreamUniversal camId={cam.id}>
          {!isMobile && cam.control_protocol && <PTZControl camId={cam.id} onUnsupported={() => setPtzUnsupported(true)} />}
        </VideoStreamUniversal>
        {isMobile && cam.control_protocol && !ptzUnsupported && (
          <DashCard>
            <PTZControl camId={cam.id} onUnsupported={() => setPtzUnsupported(true)} />
          </DashCard>
        )}
      </div>

      {canShare && <ShareLinkDialog open={sharing} camId={cam.id} deviceType="cams" type="stream" onClose={() => setSharing(false)} />}
    </div>
  )
}
