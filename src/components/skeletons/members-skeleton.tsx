import { Card, CardContent } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Search } from "lucide-react"

/**
 * Exact skeleton loader for members page
 * Matches the exact structure of CommunityMembersView (without navigation - shown separately)
 */
export function MembersSkeleton() {
  return (
    <>
      {/* Search Bar - Exact match */}
        <div className="relative max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-white/40" />
          <Input
            type="text"
            placeholder="Search members..."
            disabled
            className="pl-10 bg-white/10 border-white/20 text-white placeholder:text-white/40"
          />
        </div>

        {/* Members Grid - Exact match: grid-cols-1 md:grid-cols-2 lg:grid-cols-3 */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {[1, 2, 3, 4, 5, 6].map((i) => (
            <Card key={i} className="bg-gradient-to-br from-white/10 to-transparent backdrop-blur-md border-0">
              <CardContent className="p-6">
                <div className="flex items-start gap-4">
                  {/* Avatar - Exact size h-16 w-16 with border-4 */}
                  <div className="h-16 w-16 bg-white/10 rounded-full border-4 border-white/20 animate-pulse flex-shrink-0" />

                  {/* Member Info */}
                  <div className="flex-1 min-w-0 space-y-2">
                    <div className="flex items-center gap-2">
                      <div className="h-5 w-32 bg-white/10 rounded animate-pulse" />
                      <div className="h-5 w-16 bg-white/10 rounded animate-pulse" />
                    </div>
                    <div className="h-4 w-24 bg-white/10 rounded animate-pulse" />
                    <div className="flex items-center gap-1">
                      <div className="h-3 w-3 bg-white/10 rounded animate-pulse" />
                      <div className="h-3 w-20 bg-white/10 rounded animate-pulse" />
                    </div>
                    <div className="h-3 w-full bg-white/10 rounded animate-pulse mt-3" />
                    <div className="h-3 w-3/4 bg-white/10 rounded animate-pulse" />
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
    </>
  )
}
