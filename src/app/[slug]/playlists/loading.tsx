import { RecordingsSkeleton } from "@/components/skeletons/recordings-skeleton"
import { LoadingWithNavServer } from "@/components/skeletons/loading-with-nav-server"

export default function CommunityPlaylistsLoading() {
  return (
    <LoadingWithNavServer>
      <RecordingsSkeleton />
    </LoadingWithNavServer>
  )
}

