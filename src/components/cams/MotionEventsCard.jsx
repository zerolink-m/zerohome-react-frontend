import DashCard from '../DashCard'
import MotionEventsList from './MotionEventsList'

export default function MotionEventsCard({ camId, canDelete }) {
  return (
    <DashCard>
      <MotionEventsList key={camId} camId={camId} canDelete={canDelete} />
    </DashCard>
  )
}
