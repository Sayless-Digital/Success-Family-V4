import { Card, CardContent } from "@/components/ui/card"

/**
 * Exact skeleton loader for events page
 * Matches the exact structure of CommunityEventsView (without navigation - shown separately)
 */
export function EventsSkeleton() {
  return (
    <>
      {/* Create Button Area - Exact match */}
        <div className="flex justify-end">
          <div className="h-9 w-32 bg-white/10 rounded-md animate-pulse" />
        </div>

        {/* Events Grid - Exact match: grid gap-4 */}
        <div className="grid gap-4">
          {[1, 2, 3, 4].map((i) => (
            <Card key={i} className="group bg-white/10 backdrop-blur-md border-0">
              <CardContent className="p-3">
                {/* Event Header - Exact match */}
                <div className="flex gap-4 mb-3">
                  {/* Event Owner Avatar - Exact size h-10 w-10 */}
                  <div className="h-10 w-10 bg-white/10 rounded-full border-4 border-white/20 animate-pulse flex-shrink-0" />
                  
                  {/* Event Info */}
                  <div className="flex items-center gap-2 flex-1">
                    <div className="flex flex-col space-y-1.5">
                      <div className="h-4 w-32 bg-white/10 rounded animate-pulse" />
                      <div className="h-5 w-20 bg-white/10 rounded animate-pulse" />
                    </div>
                  </div>

                  {/* Context Menu Button */}
                  <div className="h-8 w-8 bg-white/10 rounded-full border border-white/20 animate-pulse flex-shrink-0" />
                </div>
                
                {/* Event Content - Exact match */}
                <div className="mb-3 space-y-2">
                  <div className="h-4 w-full bg-white/10 rounded animate-pulse" />
                  <div className="h-4 w-3/4 bg-white/10 rounded animate-pulse" />
                  <div className="h-3 w-40 bg-white/10 rounded animate-pulse" />
                </div>

                {/* Action Buttons and Registration Count - Exact match */}
                <div className="flex items-center justify-between gap-4 mt-3">
                  <div className="h-8 w-32 bg-white/10 rounded animate-pulse" />
                  <div className="h-8 w-28 bg-white/10 rounded-full animate-pulse ml-auto" />
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
    </>
  )
}
