import { useState } from 'react'
import MaskIcon from '../MaskIcon'

// Overlay с кнопкой управления звуком для видео плееров
export default function VideoControls({ videoRef, showControls = true }) {
  const [muted, setMuted] = useState(true)
  const [hover, setHover] = useState(false)

  function toggleMute() {
    if (videoRef.current) {
      const newMuted = !muted
      videoRef.current.muted = newMuted
      setMuted(newMuted)
    }
  }

  if (!showControls) return null

  return (
    <div
      style={{
        position: 'absolute',
        bottom: 8,
        left: 8,
        zIndex: 50,
      }}
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
    >
      <button
        onClick={toggleMute}
        style={{
          background: 'rgba(0,0,0,0.7)',
          border: '1px solid rgba(255,255,255,0.15)',
          borderRadius: 6,
          color: '#fff', // кнопка лежит поверх видео на тёмной подложке в любой теме
          fontSize: 16,
          padding: '8px',
          cursor: 'pointer',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          backdropFilter: 'blur(10px)',
          opacity: hover ? 1 : 0.7,
          transition: 'opacity 0.2s',
          width: 36,
          height: 36,
        }}
        title={muted ? 'Включить звук' : 'Выключить звук'}
      >
        <MaskIcon
          src={muted ? '/static-a-content/icons/sound-off.svg' : '/static-a-content/icons/sound-on.svg'}
          aria-label={muted ? 'Звук выключен' : 'Звук включен'}
          size={20}
          style={{ display: 'block' }}
        />
      </button>
    </div>
  )
}
