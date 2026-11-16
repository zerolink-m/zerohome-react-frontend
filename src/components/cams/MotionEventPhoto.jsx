import { fetchMotionEventPhoto } from '../../api/motion'
import PhotoFrame from '../PhotoFrame'

// Фото события детекции: эндпоинт не принимает ?token=, поэтому грузим blob с Authorization.
// Пока грузится — спиннер с подписью, при ошибке — «Не удалось загрузить» + «Повторить».
export default function MotionEventPhoto({ eventId, alt }) {
  return (
    <PhotoFrame
      key={eventId}
      load={() => fetchMotionEventPhoto(eventId)}
      alt={alt}
      style={{ width: '100%', height: '100%' }}
    />
  )
}
