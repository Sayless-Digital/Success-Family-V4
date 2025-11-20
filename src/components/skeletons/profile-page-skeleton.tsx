import { Card, CardContent } from "@/components/ui/card"
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs"

/**
 * Exact skeleton loader for profile page
 * Matches the exact structure of ProfileView (without navigation - shown separately)
 */
export function ProfilePageSkeleton() {
  return (
    <div className="relative w-full overflow-x-hidden">
      <div className="relative z-10 space-y-6">
        {/* Profile Header - Exact match */}
        <div className="mb-6 mt-2">
          <div className="flex flex-col items-center text-center mb-6">
            {/* Avatar - Exact size h-24 w-24 */}
            <div className="mb-4">
              <div className="h-24 w-24 bg-white/10 rounded-full border-4 border-white/20 animate-pulse" />
            </div>
            
            {/* Name - Exact match */}
            <div className="h-8 w-48 bg-white/10 rounded animate-pulse mb-2" />
            
            {/* Username - Exact match */}
            <div className="h-5 w-32 bg-white/10 rounded animate-pulse mb-1" />
            
            {/* Bio - Exact match */}
            <div className="h-4 w-64 bg-white/10 rounded animate-pulse mt-2" />
            
            {/* Action Buttons - Exact match */}
            <div className="flex flex-wrap items-center justify-center gap-3 mt-4">
              <div className="h-10 w-32 bg-white/10 rounded-full animate-pulse" />
              <div className="h-10 w-28 bg-white/10 rounded-full animate-pulse" />
            </div>
          </div>
        </div>

        {/* Tabs - Exact match */}
        <Tabs defaultValue="posts" className="w-full">
          <TabsList className="w-full">
            <TabsTrigger value="posts" disabled className="gap-2">
              <div className="h-4 w-4 bg-white/10 rounded animate-pulse" />
              <div className="h-4 w-20 bg-white/10 rounded animate-pulse" />
            </TabsTrigger>
            <TabsTrigger value="boosts" disabled className="gap-2">
              <div className="h-4 w-4 bg-white/10 rounded animate-pulse" />
              <div className="h-4 w-24 bg-white/10 rounded animate-pulse" />
            </TabsTrigger>
            <TabsTrigger value="saved" disabled className="gap-2">
              <div className="h-4 w-4 bg-white/10 rounded animate-pulse" />
              <div className="h-4 w-20 bg-white/10 rounded animate-pulse" />
            </TabsTrigger>
            <TabsTrigger value="got-boosted" disabled className="gap-2">
              <div className="h-4 w-4 bg-white/10 rounded animate-pulse" />
              <div className="h-4 w-28 bg-white/10 rounded animate-pulse" />
            </TabsTrigger>
            <TabsTrigger value="communities" disabled className="gap-2">
              <div className="h-4 w-4 bg-white/10 rounded animate-pulse" />
              <div className="h-4 w-28 bg-white/10 rounded animate-pulse" />
            </TabsTrigger>
          </TabsList>

          <TabsContent value="posts" className="mt-4">
            {/* Posts List - Exact match */}
            <div className="flex flex-col gap-4">
              {[1, 2, 3, 4].map((i) => (
                <Card key={i} className="group bg-white/10 backdrop-blur-3xl border-0">
                  <CardContent className="p-3">
                    {/* Post Header - Exact match */}
                    <div className="flex gap-4 mb-3">
                      {/* Author Avatar - Exact size h-10 w-10 */}
                      <div className="h-10 w-10 bg-white/10 rounded-full border-4 border-white/20 animate-pulse flex-shrink-0" />
                      
                      {/* Post Info */}
                      <div className="flex items-center gap-2 flex-1">
                        <div className="flex flex-col">
                          <div className="h-4 w-32 bg-white/10 rounded animate-pulse mb-1" />
                          <div className="h-3 w-24 bg-white/10 rounded animate-pulse" />
                        </div>
                      </div>
                    </div>
                    
                    {/* Content - Exact match */}
                    <div className="space-y-2 mb-3">
                      <div className="h-4 w-full bg-white/10 rounded animate-pulse" />
                      <div className="h-4 w-5/6 bg-white/10 rounded animate-pulse" />
                      <div className="h-4 w-4/6 bg-white/10 rounded animate-pulse" />
                    </div>

                    {/* Media Placeholder - Exact match */}
                    <div className="h-64 w-full bg-white/10 rounded-lg mb-3 animate-pulse" />

                    {/* Boost and Save Buttons - Exact match */}
                    <div className="flex items-center justify-between gap-4 mt-3">
                      <div className="h-8 w-32 bg-white/10 rounded-full animate-pulse" />
                      <div className="h-8 w-8 bg-white/10 rounded-full animate-pulse" />
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  )
}

