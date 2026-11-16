import { snapshotUrl } from '../../api/cams'
import PhotoFrame from '../PhotoFrame'

export default function CameraSnapshot({ camId, alt = 'Camera snapshot' }) {
  return (
    <div className="camera-snapshot">
      <PhotoFrame src={snapshotUrl(camId)} alt={alt} className="snapshot-image" loadingLabel="Загрузка снимка…" />
    </div>
  )
}
