import { LoadingSpinner } from "@/components/loading-spinner"

export default function FeedLoading() {
  return (
    <div className="relative w-full overflow-x-hidden">
      <div className="relative z-10 flex items-center justify-center min-h-[60vh]">
        <div className="flex flex-col items-center gap-4">
          <LoadingSpinner size="lg" />
          <p className="text-white/60 text-sm">Loading feed...</p>
        </div>
      </div>
    </div>
  )
}
