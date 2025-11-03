import { LoadingSpinner } from "@/components/loading-spinner"

export default function CommunityLoading() {
  return (
    <div className="relative w-full overflow-x-hidden">
      <div className="relative z-10 flex items-center justify-center min-h-[60vh]">
        <div className="flex flex-col items-center gap-4">
          <LoadingSpinner />
          <p className="text-white/60 text-sm">Loading community...</p>
        </div>
      </div>
    </div>
  )
}
