import { LoadingSpinner } from "@/components/loading-spinner"

export default function EventsLoading() {
  return (
    <div className="relative w-full overflow-x-hidden flex-1 flex items-center justify-center">
      <div className="relative z-10 flex flex-col items-center gap-4">
        <LoadingSpinner />
        <p className="text-white/60 text-sm">Loading events...</p>
      </div>
    </div>
  )
}
