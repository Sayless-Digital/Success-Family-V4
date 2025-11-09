import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"

/**
 * Exact skeleton loader for community home page
 * Matches the exact structure of CommunityView (without navigation - shown separately)
 */
export function CommunityPageSkeleton() {
  return (
    <div className="relative w-full overflow-x-hidden">
      <div className="relative z-10 space-y-6">
        {/* Community Header - Exact match */}
        <Card className="bg-gradient-to-br from-white/10 to-transparent backdrop-blur-md border-0">
          <CardContent className="p-6">
            <div className="flex flex-col sm:flex-row items-start sm:items-center gap-6">
              {/* Community Avatar */}
              <div className="h-20 w-20 bg-white/10 rounded-full border-4 border-white/20 animate-pulse flex-shrink-0" />
              
              {/* Community Info */}
              <div className="flex-1 min-w-0">
                <div className="flex flex-col gap-2 mb-2 sm:flex-row sm:items-center sm:gap-3">
                  <div className="h-9 w-64 bg-white/10 rounded animate-pulse" />
                  <div className="h-6 w-20 bg-white/10 rounded animate-pulse sm:w-16" />
                </div>
                <div className="h-5 w-2/3 bg-white/10 rounded animate-pulse mb-4" />
                <div className="flex items-center gap-2">
                  <div className="h-4 w-4 bg-white/10 rounded animate-pulse" />
                  <div className="h-4 w-20 bg-white/10 rounded animate-pulse" />
                  <div className="h-4 w-28 bg-white/10 rounded animate-pulse" />
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Stats Cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {[1, 2, 3].map((i) => (
            <Card key={i} className="bg-gradient-to-br from-white/10 to-transparent backdrop-blur-md border-0">
              <CardContent className="p-6 text-center">
                <div className="h-8 w-8 bg-white/10 rounded-full mx-auto mb-2 animate-pulse" />
                <div className="h-7 w-16 bg-white/10 rounded mx-auto mb-1 animate-pulse" />
                <div className="h-4 w-20 bg-white/10 rounded mx-auto animate-pulse" />
              </CardContent>
            </Card>
          ))}
        </div>

        {/* Members Section */}
        <Card className="bg-gradient-to-br from-white/10 to-transparent backdrop-blur-md border-0">
          <CardHeader>
            <CardTitle className="text-white flex items-center gap-2">
              <div className="h-5 w-5 bg-white/10 rounded animate-pulse" />
              <div className="h-6 w-40 bg-white/10 rounded animate-pulse" />
            </CardTitle>
            <CardDescription className="text-white/60">
              <div className="h-4 w-56 bg-white/10 rounded animate-pulse" />
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {[1, 2, 3].map((i) => (
                <div key={i} className="flex items-center gap-3 p-3 rounded-lg bg-white/5">
                  <div className="h-10 w-10 bg-white/10 rounded-full border border-white/20 animate-pulse flex-shrink-0" />
                  <div className="flex-1 min-w-0">
                    <div className="flex flex-col items-start gap-1 sm:flex-row sm:items-center sm:gap-2">
                      <div className="h-5 w-32 bg-white/10 rounded animate-pulse" />
                      <div className="h-5 w-16 bg-white/10 rounded animate-pulse" />
                    </div>
                    <div className="h-4 w-40 bg-white/10 rounded animate-pulse mt-1" />
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
