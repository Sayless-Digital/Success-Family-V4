import { Card, CardContent, CardHeader } from "@/components/ui/card"

/**
 * Exact skeleton loader for recordings page
 * Matches the exact structure of CommunityRecordingsView (without navigation - shown separately)
 */
export function RecordingsSkeleton() {
  return (
    <>
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {[1, 2, 3, 4, 5, 6].map((i) => (
          <Card 
            key={i} 
            className="bg-gradient-to-br from-white/10 to-transparent backdrop-blur-md border-0 overflow-hidden"
          >
            <div className="relative w-full h-48 bg-gradient-to-br from-white/5 to-white/10 overflow-hidden">
              <div className="absolute inset-0 bg-gradient-to-t from-black/40 via-transparent to-transparent" />
              <div className="absolute top-3 right-3">
                <div className="h-5 w-16 bg-white/10 rounded-full animate-pulse" />
              </div>
            </div>

            <CardHeader className="pb-3">
              <div className="flex items-start justify-between gap-3">
                <div className="flex-1 min-w-0 space-y-2">
                  <div className="h-6 w-5/6 bg-white/10 rounded animate-pulse" />
                  <div className="h-4 w-40 bg-white/10 rounded animate-pulse" />
                </div>
                <div className="h-8 w-8 bg-white/10 rounded-full animate-pulse flex-shrink-0" />
              </div>
            </CardHeader>
            
            <CardContent className="space-y-3 pt-0">
              <div className="space-y-3">
                <div className="h-4 w-32 bg-white/10 rounded animate-pulse" />
                <div className="h-4 w-24 bg-white/10 rounded animate-pulse" />
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </>
  )
}

