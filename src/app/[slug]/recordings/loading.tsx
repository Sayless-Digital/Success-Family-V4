import { RecordingsSkeleton } from "@/components/skeletons/recordings-skeleton"
import { LoadingWithNavServer } from "@/components/skeletons/loading-with-nav-server"

export default function RecordingsLoading() {
  return (
    <LoadingWithNavServer>
      <RecordingsSkeleton />
    </LoadingWithNavServer>
  )
}

