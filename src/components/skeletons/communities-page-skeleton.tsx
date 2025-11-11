import { Card, CardContent } from "@/components/ui/card"

/**
 * Exact skeleton loader for communities page
 * Matches the exact structure of CommunitiesList
 */
export function CommunitiesPageSkeleton() {
  return (
    <div className="relative w-full overflow-x-hidden">
      <div className="relative z-10 space-y-6">
        {/* Search Bar and Create Button - Exact match */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 sm:gap-4">
          <div className="relative max-w-md">
            <div className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 bg-white/10 rounded animate-pulse" />
            <div className="h-10 w-full bg-white/10 rounded-md border border-white/20 animate-pulse pl-10" />
          </div>
          <div className="h-10 w-full sm:w-auto sm:min-w-[140px] bg-white/10 rounded-md animate-pulse" />
        </div>

        {/* Communities Grid - Exact match */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {[1, 2, 3, 4, 5, 6].map((i) => (
            <Card key={i} className="bg-gradient-to-br from-white/10 to-transparent backdrop-blur-md border-0 h-full">
              <CardContent className="p-6">
                <div className="space-y-4">
                  {/* Banner Image - Exact match h-32 */}
                  <div className="relative w-full h-32 rounded-lg overflow-hidden border border-white/10 bg-white/5 animate-pulse" />

                  {/* Community Header - Exact match */}
                  <div className="flex items-start gap-3">
                    {/* Community Logo - lg size */}
                    <div className="h-16 w-16 bg-white/10 rounded-full border-4 border-white/20 animate-pulse flex-shrink-0" />
                    <div className="flex-1 min-w-0 space-y-1">
                      {/* Community Name */}
                      <div className="h-6 w-40 bg-white/10 rounded animate-pulse" />
                      {/* Owner Info with Crown */}
                      <div className="flex items-center gap-2">
                        <div className="h-3 w-3 bg-white/10 rounded animate-pulse" />
                        <div className="h-4 w-32 bg-white/10 rounded animate-pulse" />
                      </div>
                    </div>
                  </div>

                  {/* Description - Exact match (2 lines) */}
                  <div className="space-y-2">
                    <div className="h-4 w-full bg-white/10 rounded animate-pulse" />
                    <div className="h-4 w-5/6 bg-white/10 rounded animate-pulse" />
                  </div>

                  {/* Stats - Exact match */}
                  <div className="pt-3 space-y-2">
                    <div className="flex items-center gap-3">
                      {/* Users Badge */}
                      <div className="h-6 w-16 bg-white/10 rounded-full animate-pulse" />
                      {/* Calendar Badge */}
                      <div className="h-6 w-20 bg-white/10 rounded-full animate-pulse" />
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>

        {/* Create Community CTA - Exact match */}
        <Card className="bg-gradient-to-br from-white/10 to-white/5 backdrop-blur-md border-0">
          <CardContent className="p-8 text-center">
            <div className="max-w-md mx-auto">
              <div className="h-12 w-12 bg-white/10 rounded mx-auto mb-4 animate-pulse" />
              <div className="h-7 w-64 bg-white/10 rounded mx-auto mb-3 animate-pulse" />
              <div className="h-4 w-full bg-white/10 rounded mx-auto mb-6 animate-pulse" />
              <div className="h-11 w-40 bg-white/10 rounded-full mx-auto animate-pulse" />
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}

