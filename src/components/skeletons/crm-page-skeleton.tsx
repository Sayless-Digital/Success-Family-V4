import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"

/**
 * Skeleton loader for CRM page
 * Matches the exact structure of the CRM ListView
 */
export function CrmPageSkeleton() {
  return (
    <div className="relative w-full overflow-x-hidden h-full flex flex-col">
      <div className="relative z-10 space-y-6 flex-shrink-0">
        {/* Search, Buttons - Exact match */}
        <div className="flex flex-col sm:flex-row gap-4 items-start sm:items-center">
          <div className="relative flex-1 max-w-md order-1 sm:order-1">
            <div className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 bg-white/10 rounded animate-pulse" />
            <div className="h-10 w-full pl-10 bg-white/10 border border-white/20 rounded-md animate-pulse" />
          </div>
          
          <div className="flex items-center gap-2 flex-shrink-0 order-2 sm:order-2">
            <div className="h-9 w-32 bg-white/10 rounded-md animate-pulse" />
            <div className="h-9 w-24 bg-white/10 rounded-md animate-pulse" />
          </div>
        </div>

        {/* Table Skeleton - Exact match */}
        <div className="rounded-lg border border-white/20 bg-gradient-to-br from-white/10 to-transparent backdrop-blur-md overflow-hidden">
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow className="border-white/20">
                  <TableHead className="text-white/80">
                    <div className="h-4 w-16 bg-white/10 rounded animate-pulse" />
                  </TableHead>
                  <TableHead className="text-white/80">
                    <div className="h-4 w-20 bg-white/10 rounded animate-pulse" />
                  </TableHead>
                  <TableHead className="text-white/80">
                    <div className="h-4 w-16 bg-white/10 rounded animate-pulse" />
                  </TableHead>
                  <TableHead className="text-white/80">
                    <div className="h-4 w-16 bg-white/10 rounded animate-pulse" />
                  </TableHead>
                  <TableHead className="text-white/80">
                    <div className="h-4 w-32 bg-white/10 rounded animate-pulse" />
                  </TableHead>
                  <TableHead className="text-white/80">
                    <div className="h-4 w-28 bg-white/10 rounded animate-pulse" />
                  </TableHead>
                  <TableHead className="text-white/80">
                    <div className="h-4 w-20 bg-white/10 rounded animate-pulse" />
                  </TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {[1, 2, 3, 4, 5, 6, 7, 8].map((i) => (
                  <TableRow key={i} className="border-white/20">
                    <TableCell>
                      <div className="h-5 w-32 bg-white/10 rounded animate-pulse" />
                    </TableCell>
                    <TableCell>
                      <div className="space-y-1">
                        <div className="h-4 w-40 bg-white/10 rounded animate-pulse" />
                        <div className="h-4 w-36 bg-white/10 rounded animate-pulse" />
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="h-6 w-20 bg-white/10 rounded-full animate-pulse" />
                    </TableCell>
                    <TableCell>
                      <div className="h-8 w-[180px] bg-white/10 rounded-md animate-pulse" />
                    </TableCell>
                    <TableCell>
                      <div className="h-4 w-24 bg-white/10 rounded animate-pulse" />
                    </TableCell>
                    <TableCell>
                      <div className="h-4 w-24 bg-white/10 rounded animate-pulse" />
                    </TableCell>
                    <TableCell>
                      <div className="h-8 w-8 bg-white/10 rounded-md animate-pulse" />
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </div>
      </div>
    </div>
  )
}

