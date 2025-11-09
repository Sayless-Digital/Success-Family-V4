/**
 * Skeleton loader for the wallet page.
 * Mirrors the structure of WalletView for seamless loading transitions.
 */
export function WalletPageSkeleton() {
  return (
    <div className="relative w-full overflow-x-hidden">
      <div className="relative z-10 space-y-6">
        {/* Page header */}
        <div className="space-y-2">
          <div className="h-9 w-36 rounded bg-white/10 animate-pulse" />
          <div className="h-4 w-72 rounded bg-white/10 animate-pulse" />
        </div>

        {/* Balance card */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 p-4 rounded-lg bg-gradient-to-br from-white/10 to-transparent backdrop-blur-md">
          <div className="space-y-2">
            <div className="h-3 w-24 rounded bg-white/10 animate-pulse" />
            <div className="h-8 w-32 rounded bg-white/10 animate-pulse" />
          </div>
          <div className="h-10 w-28 rounded-md bg-white/10 animate-pulse" />
        </div>

        {/* Bank details */}
        <div className="rounded-lg bg-gradient-to-br from-white/10 to-transparent backdrop-blur-md p-4 space-y-4">
          <div className="h-6 w-32 rounded bg-white/10 animate-pulse" />
          <div className="space-y-3">
            {[1, 2].map((item) => (
              <div key={item} className="rounded-lg bg-white/5 p-4 space-y-3">
                <div className="h-5 w-40 rounded bg-white/10 animate-pulse" />
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div className="h-4 w-full rounded bg-white/10 animate-pulse" />
                  <div className="h-4 w-full rounded bg-white/10 animate-pulse" />
                  <div className="h-4 w-full rounded bg-white/10 animate-pulse" />
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Transactions */}
        <div className="space-y-4">
          <div className="h-6 w-36 rounded bg-white/10 animate-pulse" />

          {/* Desktop table */}
          <div className="hidden md:block rounded-lg bg-gradient-to-br from-white/10 to-transparent backdrop-blur-md overflow-hidden">
            <div className="grid grid-cols-7 gap-4 px-6 py-4">
              {[1, 2, 3, 4, 5, 6, 7].map((col) => (
                <div key={col} className="h-4 w-full rounded bg-white/10 animate-pulse" />
              ))}
            </div>
            <div className="space-y-3 p-6">
              {[1, 2, 3].map((row) => (
                <div key={row} className="grid grid-cols-7 gap-4">
                  {[1, 2, 3, 4, 5, 6, 7].map((col) => (
                    <div key={col} className="h-4 w-full rounded bg-white/10 animate-pulse" />
                  ))}
                </div>
              ))}
            </div>
          </div>

          {/* Mobile cards */}
          <div className="space-y-4 md:hidden">
            {[1, 2, 3].map((item) => (
              <div key={item} className="rounded-lg bg-gradient-to-br from-white/10 to-transparent backdrop-blur-md p-4 space-y-3">
                <div className="flex items-start justify-between gap-3">
                  <div className="space-y-2">
                    <div className="h-5 w-36 rounded bg-white/10 animate-pulse" />
                    <div className="h-3 w-24 rounded bg-white/10 animate-pulse" />
                  </div>
                  <div className="h-6 w-20 rounded-full bg-white/10 animate-pulse" />
                </div>
                <div className="grid grid-cols-2 gap-3 pt-3">
                  {[1, 2, 3, 4].map((detail) => (
                    <div key={detail} className="space-y-1">
                      <div className="h-3 w-20 rounded bg-white/10 animate-pulse" />
                      <div className="h-4 w-full rounded bg-white/10 animate-pulse" />
                    </div>
                  ))}
                </div>
                <div className="h-4 w-24 rounded bg-white/10 animate-pulse pt-2" />
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}


