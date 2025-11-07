import { Card, CardContent } from "@/components/ui/card"

/**
 * Exact skeleton loader for feed page
 * Matches the exact structure of FeedView (without navigation - shown separately)
 */
export function FeedSkeleton() {
  return (
    <>
      {/* Inline Post Composer - Collapsed State - Exact match */}
        <Card className="bg-gradient-to-br from-white/10 to-transparent backdrop-blur-md border-0">
          <CardContent className="p-3">
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 bg-white/10 rounded-full border-4 border-white/20 animate-pulse flex-shrink-0" />
              <div className="h-5 w-40 bg-white/10 rounded animate-pulse flex-1" />
            </div>
          </CardContent>
        </Card>

        {/* Posts List - Exact match */}
        <div className="space-y-4">
          {[1, 2, 3, 4].map((i) => (
            <Card key={i} className="group bg-white/10 backdrop-blur-md border-0">
              <CardContent className="p-3">
                {/* Post Header - Exact match */}
                <div className="flex gap-4 mb-3">
                  {/* Author Avatar - Exact size h-10 w-10 */}
                  <div className="h-10 w-10 bg-white/10 rounded-full border-4 border-white/20 animate-pulse flex-shrink-0" />
                  
                  {/* Post Info */}
                  <div className="flex items-center gap-2 flex-1">
                    <div className="flex flex-col space-y-1.5">
                      <div className="h-4 w-32 bg-white/10 rounded animate-pulse" />
                      <div className="h-3 w-24 bg-white/10 rounded animate-pulse" />
                    </div>
                  </div>

                  {/* Context Menu Button */}
                  <div className="h-8 w-8 bg-white/10 rounded-full border border-white/20 animate-pulse flex-shrink-0" />
                </div>
                
                {/* Content - Exact match */}
                <div className="space-y-3 mb-3">
                  <div className="h-4 w-full bg-white/10 rounded animate-pulse" />
                  <div className="h-4 w-5/6 bg-white/10 rounded animate-pulse" />
                  <div className="h-4 w-4/6 bg-white/10 rounded animate-pulse" />
                </div>

                {/* Media Placeholder - Exact match */}
                <div className="h-64 w-full bg-white/10 rounded-lg mb-3 animate-pulse" />

                {/* Boost and Save Buttons - Exact match */}
                <div className="flex items-center justify-between gap-4 mt-3">
                  <div className="h-8 w-32 bg-white/10 rounded-full animate-pulse" />
                  <div className="h-8 w-24 bg-white/10 rounded-full animate-pulse" />
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
    </>
  )
}
