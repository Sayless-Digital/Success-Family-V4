import { FeedSkeleton } from "@/components/skeletons/feed-skeleton"
import { LoadingWithNavServer } from "@/components/skeletons/loading-with-nav-server"

export default function FeedLoading() {
  return (
    <LoadingWithNavServer>
      <FeedSkeleton />
    </LoadingWithNavServer>
  )
}
