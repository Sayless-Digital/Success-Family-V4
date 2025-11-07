import { CommunityPageSkeleton } from "@/components/skeletons/community-page-skeleton"
import { LoadingWithNavServer } from "@/components/skeletons/loading-with-nav-server"

export default function CommunityLoading() {
  return (
    <LoadingWithNavServer>
      <CommunityPageSkeleton />
    </LoadingWithNavServer>
  )
}
