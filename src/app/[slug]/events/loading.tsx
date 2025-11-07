import { EventsSkeleton } from "@/components/skeletons/events-skeleton"
import { LoadingWithNavServer } from "@/components/skeletons/loading-with-nav-server"

export default function EventsLoading() {
  return (
    <LoadingWithNavServer>
      <EventsSkeleton />
    </LoadingWithNavServer>
  )
}
